"""Email sending via Resend (HTTP API) or SMTP (the institution's own server).

Set EMAIL_ENABLED=true and EMAIL_TRANSPORT (resend or smtp) with its settings
in .env to activate. When disabled, send_* helpers log the masked recipient and
return False without raising.
"""

import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Callable, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    import resend  # type: ignore

    _RESEND_AVAILABLE = True
except ImportError:
    _RESEND_AVAILABLE = False
    resend = None  # type: ignore


def mask_email(address: str) -> str:
    """``awa.ndi@minfi.cm`` -> ``a***@minfi.cm``: enough to recognise, not to harvest.

    Addresses are personal data: logs only ever carry this form.
    """
    local, _, domain = (address or "").strip().partition("@")
    if not local or not domain:
        return "***"
    return f"{local[0]}***@{domain}"


def _is_active() -> bool:
    if not settings.email_configured():
        return False
    return settings.EMAIL_TRANSPORT != "resend" or _RESEND_AVAILABLE


def _send_resend(to: str, subject: str, html: str) -> None:
    resend.api_key = settings.RESEND_API_KEY  # type: ignore[attr-defined]
    resend.Emails.send(
        {  # type: ignore[attr-defined]
            "from": settings.RESEND_FROM,
            "to": to,
            "subject": subject,
            "html": html,
        }
    )


def _send_smtp(to: str, subject: str, html: str) -> None:
    message = EmailMessage()
    message["From"] = settings.smtp_sender
    message["To"] = to
    message["Subject"] = subject
    message.set_content("Ce message s'affiche en HTML.")
    message.add_alternative(html, subtype="html")
    host, port = settings.SMTP_HOST, settings.SMTP_PORT
    timeout = settings.EMAIL_SEND_TIMEOUT_SECONDS
    context = ssl.create_default_context()
    server = (
        smtplib.SMTP_SSL(host, port, timeout=timeout, context=context)
        if settings.SMTP_SSL
        else smtplib.SMTP(host, port, timeout=timeout)
    )
    with server:
        # Fail closed: a server that does not offer STARTTLS raises here,
        # before any password or message is sent.
        if settings.SMTP_STARTTLS and not settings.SMTP_SSL:
            server.starttls(context=context)
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD.get_secret_value())
        server.send_message(message)


_TRANSPORTS: dict[str, Callable[[str, str, str], None]] = {
    "resend": _send_resend,
    "smtp": _send_smtp,
}


def _failure_summary(exc: Exception) -> str:
    # Never the message itself: a provider or SMTP reply can echo the full
    # recipient address or the account name.
    code = getattr(exc, "smtp_code", None)
    return f"{type(exc).__name__}" + (f" (code {code})" if code else "")


def send_email(to: str, subject: str, html: str) -> bool:
    """Send an HTML email through the configured transport.

    Returns True on success, False otherwise (never raises — email failure
    must not block user-creation flows).
    """
    if not _is_active():
        logger.info(
            "Email skipped (disabled or not configured) to=%s subject=%s",
            mask_email(to),
            subject,
        )
        return False

    transport = settings.EMAIL_TRANSPORT
    try:
        _TRANSPORTS[transport](to, subject, html)
        logger.info(
            "Email sent to=%s subject=%s via=%s", mask_email(to), subject, transport
        )
        return True
    except Exception as exc:
        logger.error(
            "Failed to send email to=%s via=%s: %s",
            mask_email(to),
            transport,
            _failure_summary(exc),
        )
        return False


def send_account_created(
    *,
    to: str,
    full_name: Optional[str],
    matricule: str,
    temporary_password: str,
    institution_name: Optional[str] = None,
) -> bool:
    """Send credentials for a freshly created account."""
    greeting = f"Bonjour {full_name}," if full_name else "Bonjour,"
    institution = institution_name or "votre institution"
    html = f"""
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
      <h1 style="font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px;">
        Votre compte E-Dossier est prêt
      </h1>
      <p>{greeting}</p>
      <p>Un compte a été créé pour vous sur la plateforme <strong>E-Dossier Cameroun</strong> ({institution}).</p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Matricule</p>
        <p style="margin: 0 0 16px; font-family: ui-monospace, Consolas, monospace; font-weight: 700;">{matricule}</p>

        <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Mot de passe temporaire</p>
        <p style="margin: 0; font-family: ui-monospace, Consolas, monospace; font-weight: 700; background: #0f172a; color: #fbbf24; padding: 10px 14px; border-radius: 8px; display: inline-block; letter-spacing: 1px;">{temporary_password}</p>
      </div>

      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 12px 16px; color: #92400e; font-size: 13px;">
        <strong>⚠ Sécurité :</strong> ce mot de passe est à usage unique. Vous devrez le changer à votre première connexion.
      </div>

      <p style="margin-top: 24px; font-size: 12px; color: #94a3b8;">
        Si vous n'attendiez pas ce message, ignorez-le ou contactez votre administrateur.
      </p>
    </div>
    """
    return send_email(
        to=to, subject="Votre compte E-Dossier — Identifiants de connexion", html=html
    )
