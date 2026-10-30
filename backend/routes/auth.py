from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import decode_token
from database.redis import blacklist_token
from dependencies.auth import get_current_user, get_current_user_allow_pending, security_bearer
from dependencies.db import get_db
from models.user import User
from schemas.auth_schema import (
    ChangePasswordRequest,
    ChangePasswordResponse,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RefreshTokenRequest,
    SignupRequest,
    TokenResponse,
    UserMeResponse,
)
from services.auth_service import auth_service

router = APIRouter()


# -----------------------------------------------------------------------------
# 1. POST /login
# -----------------------------------------------------------------------------
@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="User Login",
    description="Authenticate user with email and password, returning JWT access token, refresh token, and user profile.",
)
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """Authenticate credentials and issue JWT tokens."""
    return await auth_service.authenticate_user(db=db, login_data=login_data)


# -----------------------------------------------------------------------------
# 2. PATCH /change-password
# -----------------------------------------------------------------------------
@router.patch(
    "/change-password",
    response_model=ChangePasswordResponse,
    status_code=status.HTTP_200_OK,
    summary="Change Password",
    description="Update user password and clear forced password rotation flag via PATCH.",
)
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user_allow_pending),
    db: AsyncSession = Depends(get_db),
) -> ChangePasswordResponse:
    """Change user password via PATCH."""
    updated_user = await auth_service.change_password(
        db=db,
        user=current_user,
        current_password=data.current_password,
        new_password=data.new_password,
    )
    return ChangePasswordResponse(
        message="Password updated successfully",
        user=updated_user,
    )


# -----------------------------------------------------------------------------
# 5. POST /signup (Single Route for Invitation Signup)
# -----------------------------------------------------------------------------
@router.post(
    "/signup",
    response_model=ChangePasswordResponse,
    status_code=status.HTTP_200_OK,
    summary="Invited Member Signup",
    description="Set new password and activate account for invited member using invitation link.",
)
async def signup(
    data: SignupRequest,
    db: AsyncSession = Depends(get_db),
) -> ChangePasswordResponse:
    """Set initial password for invited member."""
    updated_user = await auth_service.setup_password_via_invitation(
        db=db,
        email=data.email,
        new_password=data.new_password,
        token=data.token,
    )
    return ChangePasswordResponse(
        message="Account activated and password set successfully",
        user=updated_user,
    )


# -----------------------------------------------------------------------------
# 3. POST /refresh
# -----------------------------------------------------------------------------
@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh Access Token",
    description="Exchange a valid refresh token for a newly signed access token.",
)
async def refresh_token(
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Exchange refresh token for a new access token."""
    result = await auth_service.refresh_access_token(
        db=db, refresh_token_str=data.refresh_token
    )
    return TokenResponse(
        access_token=result["access_token"],
        token_type=result.get("token_type", "Bearer"),
    )


# -----------------------------------------------------------------------------
# 4. POST /logout
# -----------------------------------------------------------------------------
@router.post(
    "/logout",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Logout User",
    description="Invalidate current access token by blacklisting it in Redis until expiration.",
)
async def logout(
    current_user: User = Depends(get_current_user_allow_pending),
    auth_creds: HTTPAuthorizationCredentials | None = Depends(security_bearer),
) -> MessageResponse:
    """
    Blacklist the bearer token in Redis for its remaining lifetime.
    """
    if auth_creds and auth_creds.credentials:
        token = auth_creds.credentials.strip()
        try:
            payload = decode_token(token)
            exp_timestamp = payload.get("exp")
            if exp_timestamp:
                now_timestamp = datetime.now(timezone.utc).timestamp()
                remaining_seconds = int(exp_timestamp - now_timestamp)
                if remaining_seconds > 0:
                    await blacklist_token(token, expires_in_seconds=remaining_seconds)
        except Exception:
            # Token already invalid or cannot be decoded; proceed cleanly
            pass

    return MessageResponse(message="Logged out successfully")


# -----------------------------------------------------------------------------
# 5. GET /me (Current User Profile)
# -----------------------------------------------------------------------------
@router.get(
    "/me",
    response_model=UserMeResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current User Profile",
    description="Returns public profile and avatar of the currently authenticated user based on bearer token.",
)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
) -> UserMeResponse:
    """Return the currently authenticated user's profile."""
    # Deterministic avatar generation from user display name
    avatar_url = f"https://api.dicebear.com/7.x/avataaars/svg?seed={current_user.name.replace(' ', '%20')}"
    created_at_iso = current_user.created_at.isoformat() if current_user.created_at else None

    return UserMeResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        status=current_user.status,
        designation=current_user.designation,
        avatar=avatar_url,
        created_at=created_at_iso,
    )
