import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from dao.user_dao import user_dao
from core.config import settings
from core.security import (
    verify_password,
    hash_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from exceptions.domain import (
    UnauthorizedException,
    ForbiddenException,
    EntityNotFoundException,
)
from models.user import User
from schemas.auth_schema import LoginRequest, LoginResponse, UserSummary


class AuthService:
    """Authentication business logic service."""

    async def authenticate_user(
        self, db: AsyncSession, login_data: LoginRequest
    ) -> LoginResponse:
        """
        Verify user credentials and return access & refresh tokens with user summary.
        Uses a generic error message to prevent account enumeration.
        """
        user = await user_dao.get_by_email(db, login_data.email)
        if not user or not verify_password(login_data.password, user.hashed_password):
            raise UnauthorizedException(detail="Invalid email or password.")

        if user.status != "active":
            raise UnauthorizedException(detail="Account is inactive or pending activation.")

        # Generate signed access and refresh tokens
        user_id_str = str(user.id)
        access_token = create_access_token(data={"sub": user_id_str})
        refresh_token = create_refresh_token(data={"sub": user_id_str})

        access_token_expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        refresh_token_expires_in = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400

        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            access_token_expires_in=access_token_expires_in,
            refresh_token_expires_in=refresh_token_expires_in,
            user=UserSummary.model_validate(user),
        )

    async def change_password(
        self,
        db: AsyncSession,
        user: User,
        current_password: str,
        new_password: str,
    ) -> UserSummary:
        """
        Verify current password, hash new password, update database,
        and clear the forced password-change flag.
        """
        if not verify_password(current_password, user.hashed_password):
            raise UnauthorizedException(detail="Current password is incorrect.")

        new_hashed = hash_password(new_password)
        updated_user = await user_dao.update_password(
            db=db, user=user, new_hashed_password=new_hashed
        )
        return UserSummary.model_validate(updated_user)

    async def setup_password_via_invitation(
        self, db: AsyncSession, email: str, new_password: str, token: str | None = None
    ) -> UserSummary:
        """
        Set up password for an invited user using email (and optional signed invitation token).
        """
        user = await user_dao.get_by_email(db, email.strip().lower())
        if not user:
            raise EntityNotFoundException(entity_name="User", identifier=email)

        # If a token was provided, verify it matches
        if token:
            try:
                payload = decode_token(token)
                if payload.get("type") != "invitation":
                    raise UnauthorizedException(detail="Invalid invitation token type.")
                if payload.get("email") and payload["email"].lower() != email.strip().lower():
                    raise UnauthorizedException(detail="Invitation token does not match email.")
            except Exception as e:
                if isinstance(e, UnauthorizedException):
                    raise e
                raise UnauthorizedException(detail="Invalid or expired invitation link.")

        new_hashed = hash_password(new_password)
        updated_user = await user_dao.update_password(
            db=db, user=user, new_hashed_password=new_hashed
        )
        return UserSummary.model_validate(updated_user)

    async def refresh_access_token(
        self, db: AsyncSession, refresh_token_str: str
    ) -> dict[str, str]:
        """
        Validate refresh token and issue a fresh access token.
        """
        try:
            payload = decode_token(refresh_token_str)
        except Exception:
            raise UnauthorizedException(detail="Invalid or expired refresh token.")

        if payload.get("type") != "refresh":
            raise UnauthorizedException(detail="Token is not a refresh token.")

        user_id_str = payload.get("sub")
        if not user_id_str:
            raise UnauthorizedException(detail="Token payload missing user identifier.")

        try:
            user_uuid = uuid.UUID(str(user_id_str))
        except (ValueError, TypeError):
            raise UnauthorizedException(detail="Invalid user identifier format in token.")

        user = await user_dao.get_by_id(db, user_uuid)
        if not user:
            raise UnauthorizedException(detail="User does not exist.")

        if user.status != "active":
            raise UnauthorizedException(detail="Account is inactive or pending activation.")

        new_access_token = create_access_token(data={"sub": str(user.id)})
        return {
            "access_token": new_access_token,
            "token_type": "Bearer",
        }


# Shared singleton instance
auth_service = AuthService()
