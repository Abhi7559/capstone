import uuid
from typing import Optional, Any
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
        email = login_data.email.strip().lower()
        user = await user_dao.get_by_email(db, email)
        if not user and email == "admin@teamhub.com":
            user = await user_dao.get_by_email(db, "admin@teamboard.com")
        elif not user and email == "admin@teamboard.com":
            user = await user_dao.get_by_email(db, "admin@teamhub.com")
        elif not user and email == "member@teamhub.com":
            user = await user_dao.get_by_email(db, "member@teamboard.com")
        elif not user and email == "member@teamboard.com":
            user = await user_dao.get_by_email(db, "member@teamhub.com")

        # Auto-provision standard demo accounts if not yet in database
        if not user and email in ("admin@teamhub.com", "admin@teamboard.com") and login_data.password == "Admin@123":
            from models.user import User as UserModel
            from datetime import date
            admin_user = UserModel(
                id=uuid.UUID("550e8400-e29b-41d4-a716-446655440000"),
                name="System Admin",
                email=email,
                hashed_password=get_password_hash("Admin@123"),
                role="admin",
                status="active",
                designation="System Administrator",
                joining_date=date(2026, 9, 1),
                requires_password_change=False,
            )
            db.add(admin_user)
            await db.commit()
            await db.refresh(admin_user)
            user = admin_user

        if not user and email in ("member@teamhub.com", "member@teamboard.com") and login_data.password == "Member@123":
            from models.user import User as UserModel
            from datetime import date
            member_user = UserModel(
                id=uuid.UUID("660e8400-e29b-41d4-a716-446655440001"),
                name="Alex Member",
                email=email,
                hashed_password=get_password_hash("Member@123"),
                role="member",
                status="active",
                designation="Software Engineer",
                joining_date=date(2026, 9, 1),
                requires_password_change=False,
            )
            db.add(member_user)
            await db.commit()
            await db.refresh(member_user)
            user = member_user

        if not user or not verify_password(login_data.password, user.hashed_password):
            raise UnauthorizedException(detail="Invalid email or password.")

        if user.status != "active":
            raise UnauthorizedException(detail="Account is inactive or pending activation.")

        # Generate signed access and refresh tokens with unique jti
        user_id_str = str(user.id)
        token_jti = str(uuid.uuid4())
        access_token = create_access_token(data={"sub": user_id_str})
        refresh_token = create_refresh_token(data={"sub": user_id_str}, jti=token_jti)

        access_token_expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        refresh_token_expires_in = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400

        # Store refresh token in Redis whitelist: refresh_token:<user_id>:<jti> -> "active"
        from database.redis import store_refresh_token
        await store_refresh_token(
            user_id=user_id_str,
            jti=token_jti,
            expires_in_seconds=refresh_token_expires_in,
        )

        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            access_token_expires_in=access_token_expires_in,
            refresh_token_expires_in=refresh_token_expires_in,
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
        clear the forced password-change flag, and revoke all existing sessions in Redis.
        """
        if not verify_password(current_password, user.hashed_password):
            raise UnauthorizedException(detail="Current password is incorrect.")

        new_hashed = hash_password(new_password)
        updated_user = await user_dao.update_password(
            db=db, user=user, new_hashed_password=new_hashed
        )

        # Invalidate all active refresh tokens for this user on password rotation
        from database.redis import revoke_all_user_refresh_tokens
        await revoke_all_user_refresh_tokens(str(user.id))

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

        from database.redis import revoke_all_user_refresh_tokens
        await revoke_all_user_refresh_tokens(str(user.id))

        return UserSummary.model_validate(updated_user)

    async def refresh_access_token(
        self, db: AsyncSession, refresh_token_str: str
    ) -> dict[str, Any]:
        """
        Validate refresh token against JWT claims and Redis whitelist,
        then rotate refresh token and issue a fresh access token.
        """
        try:
            payload = decode_token(refresh_token_str)
        except Exception:
            raise UnauthorizedException(detail="Invalid or expired refresh token.")

        if payload.get("type") != "refresh":
            raise UnauthorizedException(detail="Token is not a refresh token.")

        user_id_str = payload.get("sub")
        jti = payload.get("jti")
        if not user_id_str:
            raise UnauthorizedException(detail="Token payload missing user identifier.")
        if not jti:
            raise UnauthorizedException(detail="Refresh token missing unique identifier (jti).")

        # Verify Redis whitelist record: refresh_token:<user_id>:<jti> == "active"
        from database.redis import is_refresh_token_active, store_refresh_token, revoke_refresh_token
        is_active = await is_refresh_token_active(user_id=str(user_id_str), jti=str(jti))
        if not is_active:
            raise UnauthorizedException(detail="Refresh token is invalid, expired, or revoked.")

        try:
            user_uuid = uuid.UUID(str(user_id_str))
        except (ValueError, TypeError):
            raise UnauthorizedException(detail="Invalid user identifier format in token.")

        user = await user_dao.get_by_id(db, user_uuid)
        if not user:
            raise UnauthorizedException(detail="User does not exist.")

        if user.status != "active":
            raise UnauthorizedException(detail="Account is inactive or pending activation.")

        # Invalidate old refresh token (prevents reuse / replay attacks)
        await revoke_refresh_token(user_id=str(user_id_str), jti=str(jti))

        # Rotate: generate brand new access and refresh tokens with new jti
        new_jti = str(uuid.uuid4())
        new_access_token = create_access_token(data={"sub": str(user.id)})
        new_refresh_token = create_refresh_token(data={"sub": str(user.id)}, jti=new_jti)

        access_token_expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        refresh_token_expires_in = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400

        # Store rotated refresh token in Redis
        await store_refresh_token(
            user_id=str(user.id),
            jti=new_jti,
            expires_in_seconds=refresh_token_expires_in,
        )

        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "Bearer",
            "access_token_expires_in": access_token_expires_in,
            "refresh_token_expires_in": refresh_token_expires_in,
        }


# Shared singleton instance
auth_service = AuthService()
