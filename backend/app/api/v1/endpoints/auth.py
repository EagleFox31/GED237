import logging
from typing import Union

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.errors.domain import (
    AccountLockedError,
    OtpDeliveryError,
    OtpResendQuotaError,
    OtpResendTooSoonError,
    TotpResendUnavailableError,
)
from app.core.exceptions import AuthenticationError, NotFoundError
from app.core.rate_limit import limiter
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    OTPResendRequest,
    OTPVerifyRequest,
    RefreshTokenRequest,
    RefreshTokenResponse,
    TokenResponse,
    TotpCodeRequest,
    TotpDisableRequest,
    TotpEnrolmentConfirmRequest,
    TotpEnrolmentRequired,
    TotpEnrolmentStartRequest,
    TotpEnrollRequest,
    TotpEnrollResponse,
    TotpStatus,
)
from app.services.auth_service import AuthService
from app.core.dependencies import get_current_user
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.services import otp_delivery, totp
from app.services.audit_trail import audit_entry
from app.schemas.user import ChangePasswordRequest

logger = logging.getLogger(__name__)

router = APIRouter()
auth_service = AuthService()
# Limits are read at request time so settings can be changed without reload
# (and by tests). DEBUG never relaxes them.


@router.post("/login", response_model=LoginResponse)
@limiter.limit(lambda: settings.AUTH_LOGIN_RATE_LIMIT)
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
            request=request,
        )
        return LoginResponse(**result)
    except (AccountLockedError, OtpDeliveryError):
        raise
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


@router.post("/resend-otp", response_model=LoginResponse)
@limiter.limit(lambda: settings.AUTH_OTP_RATE_LIMIT)
async def resend_otp(
    request: Request,
    payload: OTPResendRequest,
    db: AsyncSession = Depends(get_db),
):
    """New code for a login session still open; the previous code stops working."""
    try:
        result = await auth_service.resend_otp(
            db=db, session_token=payload.session_token, request=request
        )
        return LoginResponse(**result)
    except (
        AccountLockedError,
        OtpDeliveryError,
        OtpResendQuotaError,
        OtpResendTooSoonError,
        TotpResendUnavailableError,
    ):
        raise
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("OTP resend failed unexpectedly")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while sending a new code",
        ) from exc


@router.post("/verify-otp", response_model=Union[TokenResponse, TotpEnrolmentRequired])
@limiter.limit(lambda: settings.AUTH_OTP_RATE_LIMIT)
async def verify_otp(
    request: Request,
    otp_data: OTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Step 2: Verify OTP and get JWT tokens.

    A role that must use the app and has none gets no token: an enrolment token
    instead (status "totp_enrolment_required"), for /totp/enrolment/start."""
    try:
        result = await auth_service.verify_otp(
            db=db,
            session_token=otp_data.session_token,
            otp=otp_data.otp,
            request=request,
        )
        if "enrolment_token" in result:
            return TotpEnrolmentRequired(**result)
        return TokenResponse(**result)
    except AccountLockedError:
        raise
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
@limiter.limit(lambda: settings.AUTH_REFRESH_RATE_LIMIT)
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


# --- Authenticator app (TOTP, post-rc1 lot 4, DEC-2026-004) ------------------

TOTP_OFF = "L'application d'authentification n'est pas activée sur ce serveur."


def _require_totp_enabled() -> None:
    if not settings.AUTH_TOTP_ENABLED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=TOTP_OFF)


def _role_code(user: User):
    return user.role.code if user.role else None


async def _audit_totp(db: AsyncSession, user: User, action: str, request: Request):
    db.add(
        audit_entry(
            tenant_id=user.tenant_id,
            user_id=user.id,
            table_name="users",
            record_id=user.id,
            action=action,
            details={"name": user.full_name, "matricule": user.matricule},
            request=request,
        )
    )
    await db.commit()


@router.get("/totp", response_model=TotpStatus)
async def totp_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await totp.get_record(db, current_user.id)
    role = _role_code(current_user)
    super_admins = None
    if settings.AUTH_TOTP_ENABLED and role == totp.SUPER_ADMIN:
        super_admins = await totp.count_super_admins_with_app(db)
    return TotpStatus(
        available=settings.AUTH_TOTP_ENABLED,
        enrolled=record is not None and record.confirmed_at is not None,
        required=totp.required_for(role),
        super_admins_with_app=super_admins,
    )


@router.post("/totp/enroll", response_model=TotpEnrollResponse)
@limiter.limit(lambda: settings.AUTH_OTP_RATE_LIMIT)
async def totp_enroll(
    payload: TotpEnrollRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """New secret for the app. Not used at login until confirmed with a first code.
    Asks for the password: a stolen session token alone must not add an app."""
    _require_totp_enabled()
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect",
        )
    try:
        secret, uri = await totp.begin_enrolment(db, current_user)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une application est déjà enregistrée. Retirez-la d'abord.",
        ) from exc
    return TotpEnrollResponse(secret=secret, otpauth_uri=uri)


@router.post("/totp/confirm", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(lambda: settings.AUTH_OTP_RATE_LIMIT)
async def totp_confirm(
    payload: TotpCodeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """First code from the app: from now on the login asks for the app code."""
    _require_totp_enabled()
    if not await totp.consume(db, current_user.id, payload.code, confirming=True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Code incorrect"
        )
    await _audit_totp(db, current_user, "totp_enrolled", request)
    await otp_delivery.notify_totp_event(current_user, "enrolled")
    return None


@router.post("/totp/enrolment/start", response_model=TotpEnrollResponse)
@limiter.limit(lambda: settings.AUTH_OTP_RATE_LIMIT)
async def totp_enrolment_start(
    payload: TotpEnrolmentStartRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Forced enrolment (role that must use the app): secret for the app.
    No access token exists yet: the enrolment token from verify-otp is the proof."""
    _require_totp_enabled()
    try:
        result = await auth_service.start_enrolment(db, payload.enrolment_token)
    except AccountLockedError:
        raise
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc
    return TotpEnrollResponse(**result)


@router.post("/totp/enrolment/confirm", response_model=TokenResponse)
@limiter.limit(lambda: settings.AUTH_OTP_RATE_LIMIT)
async def totp_enrolment_confirm(
    payload: TotpEnrolmentConfirmRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """First app code of a forced enrolment: the login ends with the tokens."""
    _require_totp_enabled()
    try:
        result = await auth_service.confirm_enrolment(
            db, payload.enrolment_token, payload.code, request=request
        )
    except AccountLockedError:
        raise
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Code incorrect"
        )
    return TokenResponse(**result)


@router.post("/totp/disable", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(lambda: settings.AUTH_OTP_RATE_LIMIT)
async def totp_disable(
    payload: TotpDisableRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove the app: password AND the app code. A stolen password alone must not
    switch it off. Refused for a role that must use it: a lost phone is reset by
    a superior (POST /users/{id}/totp/reset)."""
    # Before the password: the refusal tells nothing about it.
    if totp.required_for(_role_code(current_user)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Obligatoire pour votre rôle. Téléphone perdu : demandez une "
            "réinitialisation à un administrateur.",
        )
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect",
        )
    if not await totp.consume(db, current_user.id, payload.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Code incorrect"
        )
    record = await totp.get_record(db, current_user.id)
    if record is not None:
        await db.delete(record)
        await db.commit()
        await _audit_totp(db, current_user, "totp_disabled", request)
        await otp_delivery.notify_totp_event(current_user, "disabled")
    return None
