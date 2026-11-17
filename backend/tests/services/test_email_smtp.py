"""SMTP transport (#154): every e-mail can leave through the institution's own
mail server instead of Resend. Checked against a minimal in-process SMTP
server: what is sent, how it authenticates, and that logs carry no secret."""

import base64
import logging
import smtplib
import socketserver
import threading
from types import SimpleNamespace

import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import Settings, refuse_unsafe_production, settings
from app.services import email_service, otp_delivery

PASSWORD = "s3cret-smtp-pass"
ACCOUNT = "ged@minfi.cm"
RECIPIENT = "awa.ndi@minfi.cm"


def _address(line: str) -> str:
    return line.split(":", 1)[1].strip().lstrip("<").split(">")[0]


class _Handler(socketserver.StreamRequestHandler):
    def _reply(self, line: str) -> None:
        self.wfile.write(line.encode() + b"\r\n")

    def handle(self) -> None:
        box = self.server.box
        self._reply("220 fake ESMTP")
        while True:
            raw = self.rfile.readline()
            if not raw:
                return
            line = raw.decode().rstrip("\r\n")
            verb = line.split(" ", 1)[0].upper()
            box["commands"].append(verb)
            if verb in ("EHLO", "HELO"):
                self._reply("250-fake\r\n250-AUTH PLAIN\r\n250 8BITMIME")
            elif verb == "AUTH":
                _, user, password = (
                    base64.b64decode(line.split()[2]).decode().split("\0")
                )
                box["auth"] = (user, password)
                ok = password == box["accepted_password"]
                self._reply("235 ok" if ok else "535 5.7.8 bad credentials")
            elif verb == "MAIL":
                box["from"] = _address(line)
                self._reply("250 ok")
            elif verb == "RCPT":
                address = _address(line)
                if address in box["refused"]:
                    # Real servers echo the full address in their refusal.
                    self._reply(f"550 5.1.1 <{address}> unknown user")
                else:
                    box["to"].append(address)
                    self._reply("250 ok")
            elif verb == "DATA":
                self._reply("354 go")
                lines = []
                while (data := self.rfile.readline()) not in (b".\r\n", b""):
                    lines.append(data.decode())
                box["data"] = "".join(lines)
                self._reply("250 queued")
            elif verb == "QUIT":
                self._reply("221 bye")
                return
            else:
                self._reply("250 ok")


@pytest.fixture
def smtp_server():
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), _Handler)
    server.daemon_threads = True
    server.box = {
        "commands": [],
        "auth": None,
        "from": None,
        "to": [],
        "data": "",
        "refused": set(),
        "accepted_password": PASSWORD,
    }
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server
    server.shutdown()
    server.server_close()


@pytest.fixture
def use_smtp(monkeypatch, smtp_server):
    values = {
        "EMAIL_ENABLED": True,
        "EMAIL_TRANSPORT": "smtp",
        "SMTP_HOST": "127.0.0.1",
        "SMTP_PORT": smtp_server.server_address[1],
        "SMTP_USER": ACCOUNT,
        "SMTP_PASSWORD": SecretStr(PASSWORD),
        "SMTP_STARTTLS": False,
        "SMTP_FROM": "",
        "EMAIL_SEND_TIMEOUT_SECONDS": 5.0,
    }
    for name, value in values.items():
        monkeypatch.setattr(settings, name, value)
    return smtp_server.box


def _assert_no_secret(caplog):
    assert PASSWORD not in caplog.text
    assert "awa.ndi" not in caplog.text


def test_smtp_sends_the_html_mail_from_the_account(use_smtp, caplog):
    caplog.set_level(logging.INFO, logger="app.services.email_service")

    assert email_service.send_email(RECIPIENT, "Objet test", "<p>Bonjour</p>")

    assert use_smtp["auth"] == (ACCOUNT, PASSWORD)
    assert use_smtp["from"] == ACCOUNT  # SMTP_FROM empty: the account sends
    assert use_smtp["to"] == [RECIPIENT]
    assert "Subject: Objet test" in use_smtp["data"]
    assert "<p>Bonjour</p>" in use_smtp["data"]
    assert "via=smtp" in caplog.text and "a***@minfi.cm" in caplog.text
    _assert_no_secret(caplog)


def test_an_open_relay_is_used_without_login_and_with_its_own_sender(
    use_smtp, monkeypatch
):
    monkeypatch.setattr(settings, "SMTP_USER", "")
    monkeypatch.setattr(settings, "SMTP_FROM", "no-reply@minfi.cm")

    assert email_service.send_email(RECIPIENT, "Objet", "<p>x</p>")

    assert "AUTH" not in use_smtp["commands"]
    assert use_smtp["from"] == "no-reply@minfi.cm"


def test_starttls_is_negotiated_before_the_password_is_sent(use_smtp, monkeypatch):
    calls = []

    def fake_starttls(self, *, context=None):
        calls.append(("starttls", context))
        return (220, b"ready")

    real_login = smtplib.SMTP.login

    def recording_login(self, user, password, **kwargs):
        calls.append(("login", None))
        return real_login(self, user, password, **kwargs)

    monkeypatch.setattr(settings, "SMTP_STARTTLS", True)
    monkeypatch.setattr(smtplib.SMTP, "starttls", fake_starttls)
    monkeypatch.setattr(smtplib.SMTP, "login", recording_login)

    assert email_service.send_email(RECIPIENT, "Objet", "<p>x</p>")

    assert [name for name, _ in calls] == ["starttls", "login"]
    assert calls[0][1] is not None  # a verifying TLS context, not a bare wrap


@pytest.mark.parametrize("failure", ["bad_password", "refused_recipient"])
def test_a_refused_mail_returns_false_and_logs_no_secret_nor_address(
    use_smtp, caplog, failure
):
    if failure == "bad_password":
        use_smtp["accepted_password"] = "another"
    else:
        use_smtp["refused"].add(RECIPIENT)
    caplog.set_level(logging.INFO, logger="app.services.email_service")

    assert email_service.send_email(RECIPIENT, "Objet", "<p>x</p>") is False

    expected = (
        "SMTPAuthenticationError (code 535)"
        if failure == "bad_password"
        else "SMTPRecipientsRefused"
    )
    assert expected in caplog.text
    _assert_no_secret(caplog)


def test_an_unreachable_server_returns_false(use_smtp, monkeypatch, caplog):
    probe = socketserver.TCPServer(("127.0.0.1", 0), socketserver.BaseRequestHandler)
    free_port = probe.server_address[1]
    probe.server_close()
    monkeypatch.setattr(settings, "SMTP_PORT", free_port)

    assert email_service.send_email(RECIPIENT, "Objet", "<p>x</p>") is False
    _assert_no_secret(caplog)


@pytest.mark.asyncio
async def test_the_login_code_reaches_the_user_through_smtp(use_smtp):
    user = SimpleNamespace(email=RECIPIENT, full_name="Awa Ndi")

    result = await otp_delivery.get_channel("email").deliver(
        user, "482913", expires_in=300
    )

    assert result.delivered and result.target == "a***@minfi.cm"
    assert "482913" in use_smtp["data"]


# --- Settings -----------------------------------------------------------------


def test_transport_is_validated_and_the_password_never_printed():
    with pytest.raises(ValidationError):
        Settings(EMAIL_TRANSPORT="pigeon")
    configured = Settings(EMAIL_TRANSPORT="SMTP", SMTP_PASSWORD=PASSWORD)
    assert configured.EMAIL_TRANSPORT == "smtp"
    assert PASSWORD not in repr(configured) and PASSWORD not in str(configured)


@pytest.mark.parametrize(
    "fields, configured",
    [
        ({"EMAIL_ENABLED": False, "RESEND_API_KEY": "k"}, False),
        ({"EMAIL_ENABLED": True, "RESEND_API_KEY": ""}, False),
        ({"EMAIL_ENABLED": True, "RESEND_API_KEY": "k"}, True),
        ({"EMAIL_ENABLED": True, "EMAIL_TRANSPORT": "smtp"}, False),
        ({"EMAIL_ENABLED": True, "EMAIL_TRANSPORT": "smtp", "SMTP_HOST": "mx"}, False),
        (
            {
                "EMAIL_ENABLED": True,
                "EMAIL_TRANSPORT": "smtp",
                "SMTP_HOST": "mx",
                "SMTP_USER": ACCOUNT,
            },
            True,
        ),
    ],
)
def test_email_is_configured_only_when_its_transport_can_send(fields, configured):
    defaults = {"RESEND_API_KEY": "", "SMTP_HOST": "", "SMTP_USER": "", "SMTP_FROM": ""}
    assert Settings(**{**defaults, **fields}).email_configured() is configured


def _production(**fields):
    base = {
        "ENVIRONMENT": "production",
        "SECRET_KEY": "k" * 40,
        "AUTH_OTP_CHANNEL": "email",
        "EMAIL_ENABLED": True,
        "EMAIL_TRANSPORT": "smtp",
        "SMTP_HOST": "mx.minfi.cm",
        "SMTP_USER": ACCOUNT,
        "SMTP_STARTTLS": True,
    }
    return Settings(**{**base, **fields})


def test_production_accepts_a_configured_smtp_server():
    refuse_unsafe_production(_production())


def test_production_refuses_the_email_channel_when_mail_cannot_leave():
    with pytest.raises(RuntimeError, match="nobody could sign in"):
        refuse_unsafe_production(_production(SMTP_HOST=""))
    with pytest.raises(RuntimeError, match="nobody could sign in"):
        refuse_unsafe_production(_production(EMAIL_ENABLED=False))


def test_production_refuses_to_send_the_smtp_password_in_clear():
    with pytest.raises(RuntimeError, match="clear text"):
        refuse_unsafe_production(_production(SMTP_STARTTLS=False))
    # Without an account there is no password to protect.
    refuse_unsafe_production(
        _production(SMTP_STARTTLS=False, SMTP_USER="", SMTP_FROM="no-reply@minfi.cm")
    )
    # Development keeps the freedom of a local test relay.
    refuse_unsafe_production(
        _production(ENVIRONMENT="development", SMTP_STARTTLS=False)
    )
