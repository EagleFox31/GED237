# backend/app/core/config.py
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings
from typing import List, Any
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings"""

    # Application
    APP_NAME: str = "E-Dossier Cameroun"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

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

    # Storage
    STORAGE_TYPE: str = "local"  # local | s3
    STORAGE_PATH: str = "./storage/files"
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100MB
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

    # Email (Resend)
    RESEND_API_KEY: str = Field(default="")
    RESEND_FROM: str = Field(default="onboarding@resend.dev")
    EMAIL_ENABLED: bool = Field(default=False)

    @field_validator("EMAIL_ENABLED", mode="before")
    @classmethod
    def parse_email_enabled(cls, v: Any) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ("1", "true", "yes", "on")
        return bool(v)

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        """Parse ALLOWED_ORIGINS from comma-separated string"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS_STR.split(",")]

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


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    s = Settings()
    if (
        s.ENVIRONMENT == "production"
        and s.SECRET_KEY == "dev-secret-key-change-this-in-production"  # nosec B105 - explicit production guard against unchanged dev default
    ):
        raise RuntimeError(
            "SECRET_KEY must be changed in production! Set a strong random key via the SECRET_KEY environment variable."
        )
    return s


settings = get_settings()
