import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import AuthenticationError, NotFoundError
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    OTPVerifyRequest,
    RefreshTokenRequest,
    RefreshTokenResponse,
    TokenResponse,
)
from app.services.auth_service import AuthService
from app.core.dependencies import get_current_user
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import ChangePasswordRequest

logger = logging.getLogger(__name__)

router = APIRouter()
auth_service = AuthService()
limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=LoginResponse)
@limiter.limit("1000/minute" if settings.DEBUG else "5/minute")
async def login(
    request: Request,
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 1: Login with tenant-scoped credentials.

    Returns a temporary session token and triggers OTP generation.
    The OTP is sent to the user's registered contact.

    In development, the OTP is echoed for local testing.
    """
    try:
        result = await auth_service.login(
            db=db,
            institution=credentials.institution,
            matricule=credentials.matricule,
            password=credentials.password,
        )
        return LoginResponse(**result)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Login failed unexpectedly")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during login: {exc}",
        ) from exc


@router.post("/verify-otp", response_model=TokenResponse)
@limiter.limit("1000/minute" if settings.DEBUG else "5/minute")
async def verify_otp(
    request: Request,
    otp_data: OTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Step 2: Verify OTP and get JWT tokens."""
    try:
        result = await auth_service.verify_otp(
            db=db,
            session_token=otp_data.session_token,
            otp=otp_data.otp,
        )
        return TokenResponse(**result)
    except (AuthenticationError, NotFoundError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during OTP verification",
        ) from exc


@router.post("/refresh", response_model=RefreshTokenResponse)
@limiter.limit("1000/minute" if settings.DEBUG else "10/minute")
async def refresh_token(
    request: Request,
    token_data: RefreshTokenRequest,
):
    """Refresh access token using refresh token."""
    try:
        result = await auth_service.refresh_access_token(
            refresh_token=token_data.refresh_token,
        )
        return RefreshTokenResponse(**result)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during token refresh",
        ) from exc


security = HTTPBearer()


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the authenticated user's password.

    Verifies the current password, stores the new hash and clears the
    `must_change_password` flag. Returns 204 on success.
    """
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect",
        )
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nouveau mot de passe doit être différent de l'ancien",
        )
    current_user.password_hash = hash_password(payload.new_password)
    current_user.must_change_password = False
    await db.commit()
    return None


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Logout user by blacklisting the current access token."""
    try:
        result = await auth_service.logout(access_token=credentials.credentials)
        return LogoutResponse(**result)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during logout",
        ) from exc
