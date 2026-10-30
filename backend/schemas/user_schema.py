import uuid
from datetime import datetime, date
from typing import Optional
from pydantic import EmailStr
from schemas.base import CamelCaseModel


class UserBase(CamelCaseModel):
    name: str
    email: EmailStr
    role: str = "member"
    status: str = "active"
    designation: Optional[str] = None
    joining_date: Optional[date] = None


class UserRead(UserBase):
    id: uuid.UUID
    requires_password_change: bool
    created_at: datetime
    updated_at: datetime


class MemberUpdateRequest(CamelCaseModel):
    """Payload for updating member details, including optional password rotation."""
    name: Optional[str] = None
    designation: Optional[str] = None
    role: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None



class MemberInviteRequest(CamelCaseModel):
    """Payload for inviting a new workspace member."""
    # Allow ISO date string parsing (e.g. '2026-10-27') into datetime.date
    model_config = CamelCaseModel.model_config.copy()
    model_config["strict"] = False

    name: str
    email: EmailStr
    designation: Optional[str] = None
    joining_date: Optional[date] = None



class MemberInviteResponse(CamelCaseModel):
    """Response returned upon successful member invitation."""
    message: str = "Invitation sent successfully"
    member: UserRead
    invitation_token: str
    signup_url: str


