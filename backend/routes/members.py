import secrets
import uuid
from typing import List
from urllib.parse import urlparse
from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.security import hash_password, create_invitation_token
from dao.user_dao import user_dao
from dependencies.auth import get_current_user, get_current_user_allow_pending, require_role
from dependencies.db import get_db
from exceptions.domain import DuplicateEntityException, EntityNotFoundException
from models.user import User
from schemas.user_schema import (
    MemberInviteRequest,
    MemberInviteResponse,
    MemberUpdateRequest,
    UserRead,
)
from services.email_service import send_invitation_email
from services.member_service import member_service

router = APIRouter()


def get_frontend_base_url(request: Request) -> str:
    """Determine the live frontend base URL, guaranteeing production Vercel domain over localhost."""
    origin = request.headers.get("origin") or request.headers.get("referer")
    if origin and "vercel.app" in origin:
        parsed = urlparse(origin)
        return f"{parsed.scheme}://{parsed.netloc}"

    base = settings.FRONTEND_URL or "https://capstone-git-main-abhishek-ganeshwadis-projects.vercel.app"
    if "localhost" in base:
        base = "https://capstone-git-main-abhishek-ganeshwadis-projects.vercel.app"
    return base.rstrip("/")


# ============================================================================
# API 17: List Workspace Members
# ============================================================================
@router.get(
    "",
    response_model=List[UserRead],
    status_code=status.HTTP_200_OK,
    summary="List Workspace Members",
    description="Retrieves workspace members and their public profile information. Password hashes are never returned.",
)
async def list_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[UserRead]:
    """Retrieve all workspace members."""
    return await member_service.get_members(db=db, current_user=current_user)


# ============================================================================
# API 18: Invite Member (Admin Only)
# ============================================================================
@router.post(
    "/invite",
    response_model=MemberInviteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite Member",
    description="Admin creates a new member account, assigns a temporary password, and dispatches an invitation email via BackgroundTasks.",
)
async def invite_member(
    invite_data: MemberInviteRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> MemberInviteResponse:
    """Invite a new member with a temporary password and send welcome email."""
    existing_user = await user_dao.get_by_email(db, invite_data.email)
    if existing_user:
        raise DuplicateEntityException(message="A user with this email already exists")

    # Placeholder hash for pending user until they activate via signup_url
    placeholder_pwd = secrets.token_urlsafe(32)
    hashed_pwd = hash_password(placeholder_pwd)

    user_payload = {
        "name": invite_data.name,
        "email": invite_data.email,
        "hashed_password": hashed_pwd,
        "role": "member",
        "status": "active",
        "designation": invite_data.designation or "Contributor",
        "joining_date": invite_data.joining_date,
        "requires_password_change": True,
    }
    new_user = await user_dao.create_user(db, user_payload)

    # Create signed invitation token for the new user (valid 3 days)
    invitation_token = create_invitation_token({"sub": str(new_user.id), "email": new_user.email})
    frontend_base = get_frontend_base_url(request)
    signup_url = f"{frontend_base}/signup?email={new_user.email}&token={invitation_token}"

    # Dispatch email asynchronously in background with signup link
    background_tasks.add_task(
        send_invitation_email,
        email=new_user.email,
        name=new_user.name,
        signup_url=signup_url,
    )

    return MemberInviteResponse(
        message="Invitation sent successfully",
        member=UserRead.model_validate(new_user),
        invitation_token=invitation_token,
        signup_url=signup_url,
    )


# ============================================================================
# API 18b: Resend Invitation Email
# ============================================================================
@router.post(
    "/{id}/resend-invite",
    response_model=MemberInviteResponse,
    status_code=status.HTTP_200_OK,
    summary="Resend Member Invitation",
    description="Regenerates activation token and dispatches an invitation email to the member.",
)
async def resend_invite(
    id: uuid.UUID,
    background_tasks: BackgroundTasks,
    request: Request,
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> MemberInviteResponse:
    """Resend onboarding invitation email with fresh activation link."""
    target_user = await user_dao.get_by_id(db, id)
    if not target_user:
        raise EntityNotFoundException(entity_name="Member", identifier=id)

    invitation_token = create_invitation_token({"sub": str(target_user.id), "email": target_user.email})
    frontend_base = get_frontend_base_url(request)
    signup_url = f"{frontend_base}/signup?email={target_user.email}&token={invitation_token}"

    background_tasks.add_task(
        send_invitation_email,
        email=target_user.email,
        name=target_user.name,
        signup_url=signup_url,
    )

    return MemberInviteResponse(
        message="Invitation email re-dispatched successfully",
        member=UserRead.model_validate(target_user),
        invitation_token=invitation_token,
        signup_url=signup_url,
    )


# ============================================================================
# API 19: Update Member
# ============================================================================
@router.patch(
    "/{id}",
    response_model=UserRead,
    status_code=status.HTTP_200_OK,
    summary="Update Member Profile",
    description="Updates a member's profile. Admin can update all; member can update own profile.",
)
@router.put(
    "/{id}",
    response_model=UserRead,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def update_member(
    id: uuid.UUID,
    update_data: MemberUpdateRequest,
    current_user: User = Depends(get_current_user_allow_pending),
    db: AsyncSession = Depends(get_db),
) -> UserRead:
    """Update member profile details or rotate password."""
    return await member_service.update_member(
        db=db, member_id=id, update_data=update_data, current_user=current_user
    )


# ============================================================================
# API 20: Delete Member (Admin Only)
# ============================================================================
@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Member",
    description="Deletes a member. Restricted to Admin users. Protects the last remaining admin.",
)
async def delete_member(
    id: uuid.UUID,
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a workspace member and cascade removals."""
    await member_service.delete_member(db=db, member_id=id, current_user=current_admin)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

