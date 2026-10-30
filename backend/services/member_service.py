"""Member Service Layer for workspace member management business rules and role permissions."""

from typing import List
from uuid import UUID
from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import hash_password, verify_password
from dao.user_dao import user_dao
from exceptions.domain import (
    DomainException,
    EntityNotFoundException,
    ForbiddenException,
    UnauthorizedException,
)
from models.user import User
from schemas.user_schema import MemberUpdateRequest, UserRead


class MemberService:
    """Service handling workspace members business logic and permissions."""

    async def get_members(
        self, db: AsyncSession, current_user: User, skip: int = 0, limit: int = 200
    ) -> List[UserRead]:
        """
        Retrieve all workspace members.
        Requires authenticated workspace access. Password hashes are never returned.
        """
        members = await user_dao.get_multi(db, skip=skip, limit=limit)
        return [UserRead.model_validate(m) for m in members]

    async def update_member(
        self,
        db: AsyncSession,
        member_id: UUID,
        update_data: MemberUpdateRequest,
        current_user: User,
    ) -> UserRead:
        """
        Update member profile or password.
        Rules:
        - If current user requires password change, they must be updating their password.
        - Non-admins can only update their own profile.
        - Non-admins cannot modify user roles.
        - Admins can update any member and modify roles.
        - Supports partial updates (omitted fields remain unchanged).
        """
        # If the user still requires a password change and is NOT updating their password, block them
        if current_user.requires_password_change and not update_data.new_password:
            raise ForbiddenException(
                detail="Password change required before accessing this resource.",
                msg="Password Change Required",
            )

        target_user = await user_dao.get_by_id(db, member_id)
        if not target_user:
            raise EntityNotFoundException(entity_name="Member", identifier=member_id)

        is_admin = (current_user.role or "").lower() == "admin"

        # Permission check: Non-admins can only edit their own profile
        if not is_admin and current_user.id != target_user.id:
            raise ForbiddenException(
                detail="You do not have permission to update another member's profile."
            )

        # Non-admins cannot change roles
        if not is_admin and update_data.role is not None and update_data.role != target_user.role:
            raise ForbiddenException(detail="Only administrators can modify user roles.")

        updates = {}
        if update_data.name is not None:
            updates["name"] = update_data.name
        if update_data.designation is not None:
            updates["designation"] = update_data.designation
        if update_data.role is not None and is_admin:
            updates["role"] = update_data.role

        # Password update support
        if update_data.new_password is not None:
            if not is_admin:
                if not update_data.current_password or not verify_password(
                    update_data.current_password, target_user.hashed_password
                ):
                    raise UnauthorizedException(
                        detail="Current password is incorrect. Please try again."
                    )
            updates["hashed_password"] = hash_password(update_data.new_password)
            updates["requires_password_change"] = False

        updated_user = await user_dao.update_user(db, target_user, updates)
        return UserRead.model_validate(updated_user)

    async def delete_member(
        self, db: AsyncSession, member_id: UUID, current_user: User
    ) -> None:
        """
        Delete a workspace member.
        Rules:
        - Only Admins can delete members.
        - Target member must exist.
        - Cannot delete the last remaining Administrator.
        - Related tasks and project memberships cascade/set null via foreign key relationships.
        """
        is_admin = (current_user.role or "").lower() == "admin"
        if not is_admin:
            raise ForbiddenException(detail="Only administrators can delete members.")

        target_user = await user_dao.get_by_id(db, member_id)
        if not target_user:
            raise EntityNotFoundException(entity_name="Member", identifier=member_id)

        # Guard: Cannot delete the last remaining Admin
        if target_user.role == "admin":
            admin_count_res = await db.execute(
                select(func.count(User.id)).where(User.role == "admin")
            )
            total_admins = admin_count_res.scalar() or 0
            if total_admins <= 1:
                raise DomainException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    msg="Bad Request",
                    details="Cannot delete the last remaining Administrator account.",
                )

        await user_dao.delete(db, id=member_id)


# Shared singleton instance
member_service = MemberService()
