from typing import Any, Dict, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from dao.base_dao import BaseDAO
from models.user import User


class UserDAO(BaseDAO[User]):
    """Data Access Object for User database operations."""

    def __init__(self):
        super().__init__(User)

    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """Find a user by their email address."""
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_id(self, db: AsyncSession, user_id: UUID) -> Optional[User]:
        """Find a user by their unique UUID."""
        return await self.get(db, user_id)

    async def create_user(self, db: AsyncSession, user_in: Dict[str, Any]) -> User:
        """Create and persist a new user record."""
        return await self.create(db, obj_in=user_in)

    async def update_password(
        self, db: AsyncSession, user: User, new_hashed_password: str
    ) -> User:
        """
        Update the user's password hash and clear the forced-change flag.
        Never stores plain-text passwords.
        """
        user.hashed_password = new_hashed_password
        user.requires_password_change = False
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    async def update_user(
        self, db: AsyncSession, user: User, update_data: Dict[str, Any]
    ) -> User:
        """
        Update specified profile fields on the user without overwriting unprovided fields.
        """
        for field, value in update_data.items():
            if hasattr(user, field) and value is not None:
                setattr(user, field, value)

        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user


# Shared singleton instance
user_dao = UserDAO()
