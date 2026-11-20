from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from app.core.config import settings
import secrets
import string

# Password hashing context (Argon2)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password using Argon2"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    data: Dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(data: Dict[str, Any]) -> str:
    """Create a JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def new_session_id() -> str:
    """Login session shared by the access and refresh tokens it issues (claim ``sid``)."""
    return secrets.token_urlsafe(16)


def revoked_session_key(session_id: str) -> str:
    """Redis key set at logout: every token of this session is refused from then on."""
    return f"revoked_session:{session_id}"


DOCUMENT_LINK_JWT_KIND = "document_access"


def create_document_access_token(
    *,
    document_id: str,
    user_id: str,
    tenant_id: str,
    session_id: str,
) -> tuple[str, str, datetime]:
    """Token of an "Open" link: one document, one user, DOCUMENT_ACCESS_URL_TTL_SECONDS.

    Its own ``type`` keeps it out of every authenticated route (they require
    "access"), and an access token is refused by the stream route in return.
    ``session_id`` (claim ``sid``) ties the link to the login session: a logout
    revokes it with the session's tokens. It is required: a link no logout could
    revoke is never issued. Returns (token, jti, expires_at, naive UTC).
    """
    if not session_id:
        raise ValueError("an Open link needs the login session it belongs to")
    jti = secrets.token_urlsafe(16)
    expire = datetime.utcnow() + timedelta(
        seconds=settings.DOCUMENT_ACCESS_URL_TTL_SECONDS
    )
    payload = {
        "type": DOCUMENT_LINK_JWT_KIND,
        "doc": document_id,
        "sub": user_id,
        "tenant_id": tenant_id,
        "jti": jti,
        "sid": session_id,
        "exp": expire,
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, jti, expire


def decode_document_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Payload of a valid, unexpired "Open" link token; None otherwise."""
    payload = decode_token(token)
    if not payload or payload.get("type") != DOCUMENT_LINK_JWT_KIND:
        return None
    if not all(payload.get(key) for key in ("doc", "sub", "tenant_id", "jti", "sid")):
        return None
    return payload


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a JWT token"""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP"""
    return "".join(secrets.choice(string.digits) for _ in range(length))


def generate_random_string(length: int = 32) -> str:
    """Generate a random alphanumeric string"""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))
