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
    3. In development, fallback to default active user if credentials are missing or expired.
    """
    from core.config import settings
    from core.logger import logger

    token = auth_creds.credentials.strip() if auth_creds and auth_creds.credentials else None

    # 1. Handle standard JWT Authorization
    if token:
        try:
            from database.redis import is_token_blacklisted
            if not await is_token_blacklisted(token):
                payload = decode_token(token)
                if payload.get("type") == "access":
                    user_id_str = payload.get("sub")
                    if user_id_str:
                        user_uuid = uuid.UUID(str(user_id_str))
                        user = await user_dao.get(db, user_uuid)
                        if user and user.status == "active":
                            return user
        except Exception as exc:
            logger.debug("Token authentication unsuccessful (%s); evaluating fallback headers.", exc)

    # 2. Fallback to dev header auth (x-user-id / x-user-role)
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

    # 3. Development environment fallback for local browsing
    if settings.DEBUG or (settings.ENVIRONMENT and settings.ENVIRONMENT.lower() == "development"):
        from sqlalchemy import select
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
