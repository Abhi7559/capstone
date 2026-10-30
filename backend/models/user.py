import uuid
from datetime import datetime, date
from typing import List, Optional
from sqlalchemy import String, Date, DateTime, Boolean, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        String(50), default="member", nullable=False
    )  # 'admin' or 'member'
    status: Mapped[str] = mapped_column(
        String(50), default="active", nullable=False
    )  # 'active' or 'invited'
    designation: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    joining_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    requires_password_change: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    projects: Mapped[List["Project"]] = relationship(
        "Project", secondary="project_members", back_populates="members"
    )
