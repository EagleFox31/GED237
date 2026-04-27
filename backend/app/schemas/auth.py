from pydantic import BaseModel, Field
from typing import Optional


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


class OTPVerifyRequest(BaseModel):
    """OTP verification request schema"""

    session_token: str = Field(..., description="Session token from login")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit OTP")


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


class TokenResponse(BaseModel):
    """Token response schema"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserInfo


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
