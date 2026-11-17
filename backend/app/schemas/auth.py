from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal, Optional

# ASCII only: "\d" also matches other scripts' digits, which the code checks
# cannot compare (they raised a 500 instead of a refusal).
SIX_DIGITS = r"^[0-9]{6}$"


class LoginRequest(BaseModel):
    """Login request schema"""

    institution: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Institution code, short name, domain or display name",
    )
    matricule: str = Field(
        ..., min_length=1, max_length=50, description="User matricule"
    )
    password: str = Field(..., min_length=6, description="User password")


class LoginResponse(BaseModel):
    """Login response schema"""

    session_token: str
    message: str
    expires_in: int
    otp: Optional[str] = None  # Only in development
    # Where the code comes from: "totp" (authenticator app) or the sending
    # channel ("email", "dev_response"). Lets the screen word its prompt.
    method: Optional[str] = None


class TotpStatus(BaseModel):
    """Authenticator app of the current user."""

    available: bool  # AUTH_TOTP_ENABLED on this server
    enrolled: bool  # app confirmed: the login asks for its code
    # The role must use the app (DEC-2026-004): removing it is refused.
    required: bool = False
    # For a super_admin only: active super_admin accounts with a confirmed app.
    # Fewer than two: nobody but the ops script can reset the last one.
    super_admins_with_app: Optional[int] = None


class TotpEnrollResponse(BaseModel):
    """Shown once: the secret is never returned again."""

    secret: str
    otpauth_uri: str


class TotpEnrollRequest(BaseModel):
    """The password again: a stolen session token alone must not add an app."""

    current_password: str = Field(..., min_length=1)


class TotpCodeRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6, pattern=SIX_DIGITS)


class TotpDisableRequest(BaseModel):
    """Password and the app code: a stolen password alone must not remove it."""

    current_password: str = Field(..., min_length=1)
    code: str = Field(..., min_length=6, max_length=6, pattern=SIX_DIGITS)


class TotpEnrolmentRequired(BaseModel):
    """verify-otp for a role that must use the app and has none: no token yet,
    the screen shows the enrolment only (POST /auth/totp/enrolment/start)."""

    status: Literal["totp_enrolment_required"]
    enrolment_token: str
    expires_in: int
    message: str


class TotpEnrolmentStartRequest(BaseModel):
    enrolment_token: str = Field(..., min_length=1, max_length=128)


class TotpEnrolmentConfirmRequest(BaseModel):
    enrolment_token: str = Field(..., min_length=1, max_length=128)
    code: str = Field(..., min_length=6, max_length=6, pattern=SIX_DIGITS)


class OTPVerifyRequest(BaseModel):
    """OTP verification request schema"""

    session_token: str = Field(..., description="Session token from login")
    otp: str = Field(
        ..., min_length=6, max_length=6, pattern=SIX_DIGITS, description="6-digit OTP"
    )


class OTPResendRequest(BaseModel):
    """Ask for a new code for a login session still open"""

    session_token: str = Field(
        ..., min_length=1, description="Session token from login"
    )


class UserInfo(BaseModel):
    """User information schema"""

    id: str
    matricule: str
    email: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    full_name: str
    role: str
    role_label: str
    tenant_id: str
    org_unit_id: Optional[str]
    must_change_password: bool = False


class SecurityNotice(BaseModel):
    """A change to the account's authenticator app since its previous login."""

    event: Literal["totp_enrolled", "totp_disabled", "totp_reset"]
    at: datetime
    by_self: bool  # False: done by an administrator (reset)


class TokenResponse(BaseModel):
    """Token response schema"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserInfo
    # Shown once by the client as a banner; empty when nothing changed.
    security_notices: list[SecurityNotice] = []


class RefreshTokenRequest(BaseModel):
    """Refresh token request schema"""

    refresh_token: str


class RefreshTokenResponse(BaseModel):
    """Refresh token response schema"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LogoutResponse(BaseModel):
    """Logout response schema"""

    message: str
