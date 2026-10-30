import uuid
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import decode_token
from dependencies.db import get_db
from dao.user_dao import user_dao
from models.user import User
from exceptions.domain import UnauthorizedException, ForbiddenException

# HTTPBearer security scheme registers the "Authorize" button and lock symbol in Swagger UI
security_bearer = HTTPBearer(auto_error=False)


async def get_current_user_allow_pending(
    request: Request,
    auth_creds: HTTPAuthorizationCredentials | None = Depends(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extracts and validates user credentials:
    1. First checks JWT access token from Authorization header (`Bearer <token>`).
    2. Fallback to developer/mock header authentication (`x-user-id` or `x-user-role`).
    """
    token = auth_creds.credentials.strip() if auth_creds and auth_creds.credentials else None

    # Handle standard JWT Authorization
    if token:
        # Check if token was revoked via logout
        from database.redis import is_token_blacklisted
        if await is_token_blacklisted(token):
            raise UnauthorizedException(detail="Token has been revoked.")

        try:
            payload = decode_token(token)
        except JWTError:
            raise UnauthorizedException(detail="Token is invalid or expired.")
        except Exception:
            raise UnauthorizedException(detail="Token is invalid or expired.")

        # Reject refresh tokens or any token other than 'access'
        if payload.get("type") != "access":
            raise UnauthorizedException(detail="Token is not an access token.")

        user_id_str = payload.get("sub")
        if not user_id_str:
            raise UnauthorizedException(detail="Token payload missing user identifier.")

        try:
            user_uuid = uuid.UUID(str(user_id_str))
        except (ValueError, TypeError):
            raise UnauthorizedException(detail="Invalid user identifier format in token.")

        user = await user_dao.get(db, user_uuid)
        if not user:
            raise UnauthorizedException(detail="User does not exist.")

        if user.status != "active":
            raise UnauthorizedException(detail="Account is inactive or pending activation.")

        return user

    # Fallback to dev header auth (x-user-id / x-user-role)
    x_user_id = request.headers.get("x-user-id")
    x_user_role = request.headers.get("x-user-role")

    if x_user_id and x_user_id.strip():
        try:
            user_uuid = uuid.UUID(x_user_id.strip())
            user = await user_dao.get(db, user_uuid)
            if user and user.status == "active":
                return user
        except (ValueError, TypeError):
            pass

    if x_user_role:
        # Fallback to default user of that role in DB
        from sqlalchemy import select
        res = await db.execute(select(User).where(User.role == x_user_role.lower(), User.status == "active").limit(1))
        user = res.scalar_one_or_none()
        if user:
            return user
        # Fallback to first available active user (e.g. initial System Admin) in development
        res = await db.execute(select(User).where(User.status == "active").limit(1))
        user = res.scalar_one_or_none()
        if user:
            return user

    raise UnauthorizedException(detail="Authorization credentials missing or invalid.")


async def get_current_user(
    current_user: User = Depends(get_current_user_allow_pending),
) -> User:
    """
    Standard dependency for ordinary protected routes.
    Blocks users with `requires_password_change=True` until they change their password.
    """
    if current_user.requires_password_change:
        raise ForbiddenException(
            detail="Password change required before accessing this resource.",
            msg="Password Change Required",
        )
    return current_user


def require_role(*allowed_roles: str):
    """
    Dependency factory for Role-Based Access Control (RBAC).
    Checks the authenticated user's role and raises 403 Forbidden
    if the caller does not have the required role.
    """
    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        user_role = (current_user.role or "").lower()
        role_strings = [str(r).lower() for r in allowed_roles]

        if user_role not in role_strings:
            raise ForbiddenException(
                detail=f"Role '{current_user.role}' does not have permission. Allowed roles: {', '.join(role_strings)}."
            )
        return current_user

    return role_checker
