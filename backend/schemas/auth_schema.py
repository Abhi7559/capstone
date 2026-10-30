import uuid
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class UserSummary(BaseModel):
    """Safe user summary schema for authentication responses without sensitive data."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        extra="forbid",
        strict=True,
    )

    id: uuid.UUID
    name: str
    email: EmailStr
    role: str
    status: str
    designation: Optional[str] = None
    requires_password_change: bool = Field(
        default=False,
        alias="requiresPasswordChange",
    )


class UserMeResponse(BaseModel):
    """Detailed profile schema returned by GET /auth/me."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        extra="forbid",
        strict=True,
    )

    id: uuid.UUID
    email: EmailStr
    name: str
    role: str
    status: str
    designation: Optional[str] = None
    avatar: Optional[str] = None
    created_at: Optional[str] = Field(default=None, alias="createdAt")


class LoginRequest(BaseModel):
    """Credentials payload for login."""

    model_config = ConfigDict(
        extra="ignore",
        strict=False,
    )

    email: EmailStr
    password: str = Field(min_length=1)
    remember_me: Optional[bool] = Field(default=False, alias="rememberMe")


class LoginResponse(BaseModel):
    """Authentication tokens returned by POST /auth/login (OAuth2 & QAex.md Section 5.1 Endpoint 1)."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra="ignore",
        strict=False,
    )

    access_token: str = Field(alias="accessToken")
    refresh_token: str = Field(alias="refreshToken")
    token_type: str = Field(default="bearer", alias="tokenType")
    access_token_expires_in: int = Field(default=900, alias="accessTokenExpiresIn")
    refresh_token_expires_in: int = Field(default=604800, alias="refreshTokenExpiresIn")
    user: Optional[UserSummary] = None


class ChangePasswordRequest(BaseModel):
    """Payload for rotating account password."""

    model_config = ConfigDict(
        extra="ignore",
        populate_by_name=True,
        strict=False,
    )

    email: Optional[EmailStr] = None
    current_password: str = Field(min_length=1, alias="currentPassword")
    new_password: str = Field(min_length=8, alias="newPassword")


class RefreshTokenRequest(BaseModel):
    """Payload to rotate access token using refresh token."""

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        strict=True,
    )

    refresh_token: str = Field(min_length=1, alias="refreshToken")


class ChangePasswordResponse(BaseModel):
    """Response returned after successful password rotation."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra="forbid",
        strict=True,
    )

    message: str = "Password updated successfully"
    user: UserSummary


class TokenResponse(BaseModel):
    """Response returned when refreshing access token."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra="forbid",
        strict=True,
    )

    access_token: str = Field(alias="accessToken")
    token_type: str = Field(default="Bearer", alias="tokenType")


class MessageResponse(BaseModel):
    """Simple message response for logout."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra="forbid",
        strict=True,
    )

    message: str


class UserRegisterRequest(BaseModel):
    """Payload for self-registration: POST /auth/register."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra="forbid",
        strict=True,
    )

    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)


class UserRegisterResponse(BaseModel):
    """Response returned upon successful registration."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra="forbid",
        strict=True,
    )

    success: bool = True
    message: str = "Account created successfully."
    user_id: uuid.UUID = Field(alias="userId")
    email: EmailStr
    name: str
    role: str = "member"


class InviteAcceptRequest(BaseModel):
    """Payload for accepting email invite: POST /auth/invites/accept."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra="forbid",
        strict=True,
    )

    token: str = Field(min_length=1)
    password: str = Field(min_length=8)


class SignupRequest(BaseModel):
    """Payload for completing signup / setting password via invitation."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra="ignore",
        strict=False,
    )

    email: EmailStr
    new_password: str = Field(min_length=8, alias="newPassword")
    token: Optional[str] = None
