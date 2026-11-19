"""Second-factor code delivery: one port, one adapter per channel.

``AUTH_OTP_CHANNEL`` selects the adapter:

- ``dev_response`` (default) sends nothing. The login response echoes the code in
  development only, which is the historical behaviour;
- ``email`` sends the code to the address of the account and never echoes it.

The code itself is never logged nor audited; only a masked target is.
"""

import asyncio
import logging
import hashlib
import hmac
import html
from dataclasses import dataclass
from typing import Optional, Protocol

from app.core.config import OTP_CHANNEL_NAMES, settings
from app.models.user import User
from app.services import email_service
from app.services.email_service import mask_email

logger = logging.getLogger(__name__)

REASON_NO_CONTACT = "no_contact"
REASON_SEND_FAILED = "send_failed"

HASH_PREFIX = "h1:"


@dataclass(frozen=True)
class DeliveryResult:
    delivered: bool
    # Masked address the code went to; None when nothing left the server.
    target: Optional[str] = None
    reason: Optional[str] = None


class OtpChannel(Protocol):
    name: str
    # The login response may carry the code (development only).
    echoes_code: bool
    # A message leaves the server: the attempt is audited.
    sends: bool

    async def deliver(
        self, user: User, code: str, *, expires_in: int
    ) -> DeliveryResult: ...


class DevResponseChannel:
    name = "dev_response"
    echoes_code = True
    sends = False

    async def deliver(
        self, user: User, code: str, *, expires_in: int
    ) -> DeliveryResult:
        return DeliveryResult(delivered=True)


def _email_body(user: User, code: str, expires_in: int) -> str:
    name = html.escape(user.full_name or "")
    greeting = f"Bonjour {name}," if name else "Bonjour,"
    minutes = max(1, expires_in // 60)
    return (
        '<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; '
        'max-width: 560px; margin: 0 auto; color: #1e293b;">'
        f"<p>{greeting}</p>"
        "<p>Votre code de vérification E-Dossier :</p>"
        '<p style="font-family: ui-monospace, Consolas, monospace; font-size: 28px; '
        f'font-weight: 700; letter-spacing: 6px;">{html.escape(code)}</p>'
        f"<p>Il est valable {minutes} minute{'s' if minutes > 1 else ''} "
        "et ne sert qu'une fois.</p>"
        '<p style="font-size: 12px; color: #94a3b8;">Si vous n\'êtes pas à l\'origine '
        "de cette connexion, changez votre mot de passe et prévenez votre "
        "administrateur.</p></div>"
    )


class EmailChannel:
    name = "email"
    echoes_code = False
    sends = True

    async def deliver(
        self, user: User, code: str, *, expires_in: int
    ) -> DeliveryResult:
        address = (user.email or "").strip()
        if not address:
            return DeliveryResult(delivered=False, reason=REASON_NO_CONTACT)
        target = mask_email(address)
        # The provider client is blocking: kept off the event loop, and not waited
        # for beyond EMAIL_SEND_TIMEOUT_SECONDS (the login then answers 503).
        try:
            sent = await asyncio.wait_for(
                asyncio.to_thread(
                    email_service.send_email,
                    address,
                    "Votre code de vérification E-Dossier",
                    _email_body(user, code, expires_in),
                ),
                timeout=settings.EMAIL_SEND_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            logger.warning("Login code to=%s: provider timed out", target)
            sent = False
        if not sent:
            return DeliveryResult(
                delivered=False, target=target, reason=REASON_SEND_FAILED
            )
        return DeliveryResult(delivered=True, target=target)


CHANNELS: dict[str, OtpChannel] = {
    channel.name: channel for channel in (DevResponseChannel(), EmailChannel())
}
assert set(CHANNELS) == set(OTP_CHANNEL_NAMES)  # nosec B101 - import-time contract


def get_channel(name: Optional[str] = None) -> OtpChannel:
    return CHANNELS[name or settings.AUTH_OTP_CHANNEL]


def hash_code(session_token: str, code: str) -> str:
    """What Redis keeps: bound to the session, useless without the server key."""
    digest = hmac.new(
        settings.SECRET_KEY.encode(),
        f"{session_token}:{code}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{HASH_PREFIX}{digest}"


def code_matches(stored: str, session_token: str, code: str) -> bool:
    """Constant-time check. A value without prefix is a code stored before hashing."""
    if stored.startswith(HASH_PREFIX):
        return hmac.compare_digest(stored, hash_code(session_token, code))
    return hmac.compare_digest(stored.encode(), code.encode())
