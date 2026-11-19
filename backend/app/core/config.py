# backend/app/core/config.py
import json
import logging
import os

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings
from typing import List, Any
from functools import lru_cache


OTP_CHANNEL_NAMES = ("dev_response", "email")
# Channels that never deliver the code. Declared here because otp_delivery
# imports this module; the guard test checks it against each channel's ``sends``.
OTP_SILENT_CHANNELS = ("dev_response",)
# Services that can carry every e-mail (login codes, new accounts).
EMAIL_TRANSPORT_NAMES = ("resend", "smtp")


class Settings(BaseSettings):
    """Application settings"""

    # Application
    APP_NAME: str = "E-Dossier Cameroun"
    # Version shown by FastAPI and /health. Never hard-coded: a release sets it
    # from the git tag (APP_VERSION env), anything else is a dev build.
    APP_VERSION: str = "0.0.0-dev"
    ENVIRONMENT: str = "development"
    # DEBUG only drives SQLAlchemy echo (database.py). It never relaxes security
    # controls such as rate limits: those have their own settings below.
    DEBUG: bool = False

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v: Any) -> bool:
        """Tolerate non-boolean env values like 'release' (VS Code / system vars)."""
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ("1", "true", "yes", "on")
        return bool(v)

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://edossier_user:changeme@localhost:5432/edossier"
    )
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0")

    # Security
    SECRET_KEY: str = Field(default="dev-secret-key-change-this-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Auth rate limits (slowapi syntax: "<count>/<minute|hour|day>"), keyed by
    # client IP. Demo stacks raise them (docker-compose.yml); tests set them high.
    AUTH_LOGIN_RATE_LIMIT: str = "5/minute"
    AUTH_OTP_RATE_LIMIT: str = "5/minute"
    AUTH_REFRESH_RATE_LIMIT: str = "10/minute"
    # Account lock: after this many wrong OTP codes the account is refused (423) for
    # AUTH_LOCKOUT_SECONDS, password not even checked. Counted per user in Redis.
    AUTH_OTP_MAX_FAILURES: int = 3
    AUTH_LOCKOUT_SECONDS: int = 900
    # How the second-factor code reaches the user (services/otp_delivery.py).
    # dev_response sends nothing: the code is echoed in development only.
    AUTH_OTP_CHANNEL: str = "dev_response"
    # Minimum delay between two sendings of a code for the same login session.
    AUTH_OTP_RESEND_COOLDOWN_SECONDS: int = Field(default=30, ge=0)
    # Resends per account and per window, whatever the login session (0: no quota).
    AUTH_OTP_RESEND_MAX_PER_WINDOW: int = Field(default=3, ge=0)
    AUTH_OTP_RESEND_WINDOW_SECONDS: int = Field(default=900, ge=1)

    # Authenticator app (RFC 6238, services/totp.py), off by default. When on, an
    # account with a confirmed app gives its app code, with no e-mail fallback
    # (DEC-2026-004); the others keep AUTH_OTP_CHANNEL.
    AUTH_TOTP_ENABLED: bool = False
    # Name shown in the authenticator app.
    AUTH_TOTP_ISSUER: str = "E-Dossier"
    # Roles that must use the app (comma-separated role codes). Such an account
    # without an app is led to enrolment after the password, before any token.
    AUTH_TOTP_REQUIRED_ROLES: str = "tenant_admin,super_admin"
    # Fernet keys for the stored app secrets, comma-separated: the first encrypts,
    # all decrypt (rotation: put the new key first, keep the old one until every
    # account has logged in once). Empty: a key derived from SECRET_KEY, for
    # development only; required in production when the app is enabled.
    TOTP_ENCRYPTION_KEYS: str = ""

    @property
    def totp_required_roles(self) -> frozenset[str]:
        return frozenset(
            code.strip().lower()
            for code in self.AUTH_TOTP_REQUIRED_ROLES.split(",")
            if code.strip()
        )

    @property
    def totp_encryption_keys(self) -> list[str]:
        return [
            key.strip() for key in self.TOTP_ENCRYPTION_KEYS.split(",") if key.strip()
        ]

    @field_validator("TOTP_ENCRYPTION_KEYS")
    @classmethod
    def validate_totp_keys(cls, v: str) -> str:
        from cryptography.fernet import Fernet

        for index, key in enumerate(k.strip() for k in v.split(",") if k.strip()):
            try:
                Fernet(key)
            except (ValueError, TypeError) as exc:
                # The key itself is never echoed.
                raise ValueError(
                    f"TOTP_ENCRYPTION_KEYS: key #{index + 1} is not a Fernet key "
                    "(32 url-safe base64 bytes)"
                ) from exc
        return v

    @field_validator("AUTH_OTP_CHANNEL", mode="before")
    @classmethod
    def validate_otp_channel(cls, v: Any) -> str:
        value = str(v).strip().lower()
        if value not in OTP_CHANNEL_NAMES:
            raise ValueError(
                "AUTH_OTP_CHANNEL must be one of: " + ", ".join(OTP_CHANNEL_NAMES)
            )
        return value

    # Development only. True: the OTP comes back in the login response and the screen
    # fills it in. False (demo in front of an audience): the code is only written to
    # the API log, for the presenter (gestion-projet/innovateur/parcours-demo.md).
    LOGIN_DEMO_HINTS: bool = True
    # True only when the API is reachable exclusively through a reverse proxy
    # that sets X-Forwarded-For (nginx/nginx.conf). Otherwise the header is
    # client-controlled and ignored.
    TRUSTED_PROXY: bool = False

    # Storage
    STORAGE_TYPE: str = "local"  # local | s3
    STORAGE_PATH: str = "./storage/files"
    # Per-file upload cap, enforced by the storage layer on every upload path
    # (documents, versions, bulk imports). Operators set MAX_UPLOAD_SIZE_MB; the
    # byte value is derived from it and is what the code reads.
    MAX_UPLOAD_SIZE_MB: int | None = None
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100 MiB
    # Directory import (POST /documents/ingest-directory): absolute container
    # paths the API may read from, separated by os.pathsep (':' on Linux).
    # Empty (default) refuses every import: least privilege, opt-in per stack.
    INGEST_ALLOWED_ROOTS_STR: str = Field(default="", alias="INGEST_ALLOWED_ROOTS")
    # Watched folders (lot 5): JSON list of {"path", "tenant_code", "org_unit_code",
    # "matricule", "document_category_code"?, "recursive"?, "processing_mode"?}.
    # Each path must sit under INGEST_ALLOWED_ROOTS. Empty list: nothing is watched.
    INGEST_WATCH_FOLDERS_STR: str = Field(default="[]", alias="INGEST_WATCH_FOLDERS")
    INGEST_WATCH_INTERVAL_SECONDS: int = 60  # 0 disables the periodic pass
    # A file modified more recently than this is still being copied: next pass.
    INGEST_WATCH_SETTLE_SECONDS: int = 10
    # Folders imported by hand (demo live import): a watched folder that is, contains or
    # sits inside one of them is ignored, so the worker never empties it. Same format
    # as INGEST_ALLOWED_ROOTS.
    INGEST_WATCH_PROTECTED_DIRS_STR: str = Field(
        default="", alias="INGEST_WATCH_PROTECTED_DIRS"
    )
    # Trash retention: trashed documents older than this are purged for good by the
    # worker. 0 (default) disables the automatic purge and its beat entry.
    TRASH_RETENTION_DAYS: int = Field(default=0, ge=0, le=36500)
    TRASH_PURGE_INTERVAL_SECONDS: int = Field(default=3600, ge=60)
    # Documents purged per transaction (automatic purge) and per bulk-purge call.
    TRASH_PURGE_BATCH: int = Field(default=200, ge=1, le=1000)
    DEFAULT_TENANT_STORAGE_QUOTA_MB: int = 5120  # 5 GB default per tenant

    # Celery
    CELERY_BROKER_URL: str = Field(default="redis://localhost:6379/1")
    CELERY_RESULT_BACKEND: str = Field(default="redis://localhost:6379/2")

    # CORS - comma-separated string
    ALLOWED_ORIGINS_STR: str = Field(
        default="http://localhost:3000,http://localhost:5173", alias="ALLOWED_ORIGINS"
    )

    # Logging
    LOG_LEVEL: str = "INFO"

    # Authorization backend
    # csv    : Casbin FileAdapter (policy.csv) source active
    # sql    : Casbin SQLAlchemyAdapter source active
    # shadow : décision active CSV + comparaison SQL (logs de divergence)
    AUTHZ_BACKEND: str = "csv"
    AUTHZ_POLICY_DATABASE_URL: str = ""
    AUTHZ_METRICS_BACKEND: str = "memory"  # memory | redis
    AUTHZ_METRICS_REDIS_URL: str = ""
    AUTHZ_METRICS_REDIS_PREFIX: str = "authz:metrics"

    @model_validator(mode="after")
    def _derive_max_upload_size(self):
        if self.MAX_UPLOAD_SIZE_MB is not None:
            if self.MAX_UPLOAD_SIZE_MB <= 0:
                raise ValueError("MAX_UPLOAD_SIZE_MB must be a positive integer")
            self.MAX_UPLOAD_SIZE = self.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        return self

    @field_validator("AUTHZ_BACKEND", mode="before")
    @classmethod
    def validate_authz_backend(cls, v: Any) -> str:
        if v is None:
            return "csv"
        value = str(v).strip().lower()
        if value not in {"csv", "sql", "shadow"}:
            raise ValueError("AUTHZ_BACKEND must be one of: csv, sql, shadow")
        return value

    @field_validator("AUTHZ_METRICS_BACKEND", mode="before")
    @classmethod
    def validate_authz_metrics_backend(cls, v: Any) -> str:
        if v is None:
            return "memory"
        value = str(v).strip().lower()
        if value not in {"memory", "redis"}:
            raise ValueError("AUTHZ_METRICS_BACKEND must be one of: memory, redis")
        return value

    # OCR engine tried first on photos, screenshots and forms: rapidocr (default,
    # PP-OCRv5 latin ONNX, peak ~610-700 MB at 1600 px, ~630 MB at 1800), tesseract, or easyocr (torch,
    # ~1.3 GB per worker child). Tesseract stays the fallback of rapidocr; clean PDF
    # scans always start with Tesseract.
    OCR_PRIMARY_ENGINE: str = "rapidocr"
    # Kill switch: false routes everything to Tesseract without a rebuild.
    OCR_RAPIDOCR_ENABLED: bool = True
    # Longest side sent to RapidOCR. 1800 keeps the process peak near 630 MB in a
    # 2 GB worker (2000 px measured 755-895 MB; recall -0.64 pt vs 2000 at 1800).
    OCR_RAPIDOCR_MAX_SIDE: int = 1800
    OCR_RAPIDOCR_TIMEOUT_SECONDS: float = 60
    # Models baked into the image at build time; never downloaded at runtime.
    RAPIDOCR_MODEL_DIR: str = "/opt/rapidocr"

    @field_validator("OCR_PRIMARY_ENGINE", mode="before")
    @classmethod
    def validate_ocr_primary_engine(cls, v: Any) -> str:
        if v is None or str(v).strip() == "":
            return "rapidocr"
        value = str(v).strip().lower()
        if value not in {"rapidocr", "tesseract", "easyocr"}:
            raise ValueError(
                "OCR_PRIMARY_ENGINE must be one of: rapidocr, tesseract, easyocr"
            )
        return value

    # Second-chance engine when the first result is empty or low-confidence. Off by
    # default: EasyOCR (torch, ~1.3 GB) pushes a 2 GB worker over its limit and the
    # task is killed, so the primary engine's text is kept as is.
    OCR_FALLBACK_ENABLED: bool = False

    # Startup check that the database is at the Alembic head
    # fail : refuse to start (default) ; warn : log only ; off : skip
    SCHEMA_CHECK_MODE: str = "fail"

    @field_validator("SCHEMA_CHECK_MODE", mode="before")
    @classmethod
    def validate_schema_check_mode(cls, v: Any) -> str:
        if v is None:
            return "fail"
        value = str(v).strip().lower()
        if value not in {"fail", "warn", "off"}:
            raise ValueError("SCHEMA_CHECK_MODE must be one of: fail, warn, off")
        return value

    # Email (Resend)
    RESEND_API_KEY: str = Field(default="")
    RESEND_FROM: str = Field(default="onboarding@resend.dev")
    EMAIL_ENABLED: bool = Field(default=False)
    # Longest wait for the provider when sending a login code; beyond it the
    # login answers 503 (retryable) instead of hanging.
    EMAIL_SEND_TIMEOUT_SECONDS: float = Field(default=10.0, gt=0)
    # resend (HTTP API, RESEND_*) or smtp (the institution's own mail server).
    EMAIL_TRANSPORT: str = Field(default="resend")
    SMTP_HOST: str = Field(default="")
    SMTP_PORT: int = Field(default=587, ge=1, le=65535)
    SMTP_USER: str = Field(default="")
    # Secret: masked in any repr, never logged.
    SMTP_PASSWORD: SecretStr = Field(default=SecretStr(""))
    SMTP_STARTTLS: bool = Field(default=True)
    # Implicit TLS from the first byte (usually port 465). When true, STARTTLS
    # is not used: the connection is already encrypted.
    SMTP_SSL: bool = Field(default=False)
    # Sender address; the SMTP account itself when empty and it is an address.
    SMTP_FROM: str = Field(default="")

    @field_validator("EMAIL_ENABLED", mode="before")
    @classmethod
    def parse_email_enabled(cls, v: Any) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ("1", "true", "yes", "on")
        return bool(v)

    @field_validator("EMAIL_TRANSPORT", mode="before")
    @classmethod
    def validate_email_transport(cls, v: Any) -> str:
        value = str(v or "").strip().lower()
        if value not in EMAIL_TRANSPORT_NAMES:
            raise ValueError(
                "EMAIL_TRANSPORT must be one of: " + ", ".join(EMAIL_TRANSPORT_NAMES)
            )
        return value

    @property
    def smtp_sender(self) -> str:
        if self.SMTP_FROM:
            return self.SMTP_FROM
        # A login such as "ged-mailer" is not a valid From: require SMTP_FROM.
        return self.SMTP_USER if "@" in self.SMTP_USER else ""

    @property
    def smtp_encrypted(self) -> bool:
        return self.SMTP_SSL or self.SMTP_STARTTLS

    def email_configured(self) -> bool:
        """E-mail is on and its transport has what it needs to send."""
        if not self.EMAIL_ENABLED:
            return False
        if self.EMAIL_TRANSPORT == "smtp":
            # A login needs its password: an empty one fails on every mail.
            has_password = bool(self.SMTP_PASSWORD.get_secret_value())
            return bool(
                self.SMTP_HOST
                and self.smtp_sender
                and (not self.SMTP_USER or has_password)
            )
        return bool(self.RESEND_API_KEY)

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        """Parse ALLOWED_ORIGINS from comma-separated string"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS_STR.split(",")]

    @property
    def INGEST_ALLOWED_ROOTS(self) -> List[str]:
        """Parse INGEST_ALLOWED_ROOTS (os.pathsep-separated, blanks ignored)."""
        return [
            p.strip()
            for p in self.INGEST_ALLOWED_ROOTS_STR.split(os.pathsep)
            if p.strip()
        ]

    @property
    def INGEST_WATCH_PROTECTED_DIRS(self) -> List[str]:
        return [
            p.strip()
            for p in self.INGEST_WATCH_PROTECTED_DIRS_STR.split(os.pathsep)
            if p.strip()
        ]

    @property
    def INGEST_WATCH_FOLDERS(self) -> List[dict]:
        """Parse INGEST_WATCH_FOLDERS; invalid JSON or entries without a path are ignored."""
        try:
            raw = json.loads(self.INGEST_WATCH_FOLDERS_STR or "[]")
        except ValueError:
            logging.getLogger(__name__).warning(
                "INGEST_WATCH_FOLDERS ignored: not valid JSON"
            )
            return []
        if not isinstance(raw, list):
            return []
        return [f for f in raw if isinstance(f, dict) and f.get("path")]

    @property
    def AUTHZ_EFFECTIVE_POLICY_DATABASE_URL(self) -> str:
        """
        Effective SQL policy URL.
        Falls back to DATABASE_URL if AUTHZ_POLICY_DATABASE_URL is not set.
        """
        return self.AUTHZ_POLICY_DATABASE_URL or self.DATABASE_URL

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        # A refused value (key, password) is never echoed in the startup error.
        hide_input_in_errors = True


def refuse_unsafe_production(s: Settings) -> None:
    """Stop a production start that would be insecure or let nobody sign in."""
    if (
        s.ENVIRONMENT == "production"
        and s.SECRET_KEY == "dev-secret-key-change-this-in-production"  # nosec B105 - explicit production guard against unchanged dev default
    ):
        raise RuntimeError(
            "SECRET_KEY must be changed in production! Set a strong random key via the SECRET_KEY environment variable."
        )
    if (
        s.ENVIRONMENT == "production"
        and s.AUTH_TOTP_ENABLED
        and not s.totp_encryption_keys
    ):
        raise RuntimeError(
            "TOTP_ENCRYPTION_KEYS must be set in production when AUTH_TOTP_ENABLED is on."
        )
    if s.ENVIRONMENT == "production" and s.AUTH_OTP_CHANNEL in OTP_SILENT_CHANNELS:
        # A silent channel echoes the code only in development: in production
        # nobody could complete the second factor. These settings are shared
        # with the worker: a worker started with ENVIRONMENT=production must
        # also receive AUTH_OTP_CHANNEL, or it will refuse to start.
        raise RuntimeError(
            "AUTH_OTP_CHANNEL=dev_response sends no login code: in production "
            "nobody could sign in. Set AUTH_OTP_CHANNEL to a channel that sends "
            "the code (email) and configure it."
        )
    if (
        s.ENVIRONMENT == "production"
        and s.AUTH_OTP_CHANNEL == "email"
        and not s.email_configured()
    ):
        raise RuntimeError(
            "AUTH_OTP_CHANNEL=email but e-mail cannot be sent: nobody could sign "
            "in. Set EMAIL_ENABLED=true and configure EMAIL_TRANSPORT "
            "(RESEND_API_KEY, or SMTP_HOST, a sender address and the password "
            "of SMTP_USER)."
        )
    if (
        s.ENVIRONMENT == "production"
        and s.EMAIL_TRANSPORT == "smtp"
        and not s.smtp_encrypted
    ):
        if s.SMTP_USER:
            raise RuntimeError(
                "SMTP without TLS would send the SMTP password in clear text. "
                "Enable SMTP_STARTTLS (or SMTP_SSL for port 465) in production."
            )
        # A relay without login has no password to leak, but mails (login
        # codes, temporary passwords) still travel in clear: warn, not refuse,
        # as some internal relays only accept plain connections.
        logging.getLogger(__name__).warning(
            "SMTP relay without TLS in production: e-mails, login codes "
            "included, travel in clear text. Enable SMTP_STARTTLS or SMTP_SSL."
        )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    s = Settings()
    refuse_unsafe_production(s)
    return s


settings = get_settings()
