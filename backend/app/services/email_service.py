"""Email sending via Resend.

Set RESEND_API_KEY, RESEND_FROM and EMAIL_ENABLED=true in .env to activate.
When disabled, send_* helpers log the payload and return False without raising.
"""

import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    import resend  # type: ignore

    _RESEND_AVAILABLE = True
except ImportError:
    _RESEND_AVAILABLE = False
    resend = None  # type: ignore


def _is_active() -> bool:
    return bool(
        settings.EMAIL_ENABLED and settings.RESEND_API_KEY and _RESEND_AVAILABLE
    )


def send_email(to: str, subject: str, html: str) -> bool:
    """Send an HTML email via Resend.

    Returns True on success, False otherwise (never raises — email failure
    must not block user-creation flows).
    """
    if not _is_active():
        logger.info(
            "Email skipped (disabled or not configured) to=%s subject=%s", to, subject
        )
        return False

    try:
        resend.api_key = settings.RESEND_API_KEY  # type: ignore[attr-defined]
        resend.Emails.send(
            {  # type: ignore[attr-defined]
                "from": settings.RESEND_FROM,
                "to": to,
                "subject": subject,
                "html": html,
            }
        )
        logger.info("Email sent to=%s subject=%s", to, subject)
        return True
    except Exception:
        logger.exception("Failed to send email to=%s", to)
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
