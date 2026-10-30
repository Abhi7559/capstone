"""Tests for ProjectService business logic and RBAC (Day 3 Step 3)."""

import uuid
from datetime import date
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import hash_password
from dao.user_dao import user_dao
from exceptions.domain import DomainException, EntityNotFoundException, ForbiddenException
from models.user import User
from schemas.project_schema import ProjectCreate, ProjectUpdate, ProjectStatus, ProjectPriority
from services.project_service import project_service


@pytest.fixture
async def admin_and_members(db_session: AsyncSession):
    """Fixture providing an Admin and two regular Members."""
    admin = await user_dao.create_user(
        db_session,
        {
            "id": uuid.uuid4(),
            "name": "Super Admin",
            "email": f"adm_{uuid.uuid4().hex[:6]}@teamboard.com",
            "hashed_password": hash_password("Admin@123"),
            "role": "admin",
            "status": "active",
        },
    )
    m1 = await user_dao.create_user(
        db_session,
        {
            "id": uuid.uuid4(),
            "name": "Member Alice",
            "email": f"alice_{uuid.uuid4().hex[:6]}@teamboard.com",
            "hashed_password": hash_password("Password@123"),
            "role": "member",
            "status": "active",
        },
    )
    m2 = await user_dao.create_user(
        db_session,
        {
            "id": uuid.uuid4(),
            "name": "Member Bob",
            "email": f"bob_{uuid.uuid4().hex[:6]}@teamboard.com",
            "hashed_password": hash_password("Password@123"),
            "role": "member",
            "status": "active",
        },
    )
    return admin, m1, m2


@pytest.mark.asyncio
async def test_admin_can_create_project(db_session: AsyncSession, admin_and_members):
    """1. Admin can successfully create a project with assigned members."""
    admin, m1, _ = admin_and_members
    payload = ProjectCreate(
        name="Platform Overhaul",
        description="Migrate backend architecture",
        status=ProjectStatus.PLANNING,
        priority=ProjectPriority.HIGH,
        startDate=date(2026, 11, 1),
        dueDate=date(2026, 11, 20),
        memberIds=[m1.id],
    )
    project = await project_service.create_project(db_session, payload, current_user=admin)
    assert project.id is not None
    assert project.name == "Platform Overhaul"
    assert project.member_ids == [m1.id]


@pytest.mark.asyncio
async def test_member_cannot_create_project(db_session: AsyncSession, admin_and_members):
    """2. Non-admin member receives 403 Forbidden when attempting to create a project."""
    _, m1, _ = admin_and_members
    payload = ProjectCreate(
        name="Unauthorized Board",
        description="Should fail",
    )
    with pytest.raises(ForbiddenException):
        await project_service.create_project(db_session, payload, current_user=m1)


@pytest.mark.asyncio
async def test_create_project_invalid_member_rejected(db_session: AsyncSession, admin_and_members):
    """3. Creating a project with non-existent member IDs raises 400 Bad Request."""
    admin, _, _ = admin_and_members
    fake_id = uuid.uuid4()
    payload = ProjectCreate(
        name="Invalid Roster",
        description="Should fail",
        memberIds=[fake_id],
    )
    with pytest.raises(DomainException) as exc:
        await project_service.create_project(db_session, payload, current_user=admin)
    assert "does not exist in workspace" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_admin_and_member_project_visibility(db_session: AsyncSession, admin_and_members):
    """4. Admin sees all projects; Member sees only their assigned projects."""
    admin, m1, m2 = admin_and_members

    p1 = await project_service.create_project(
        db_session,
        ProjectCreate(name="Alice Only", description="Desc", memberIds=[m1.id]),
        current_user=admin,
    )
    p2 = await project_service.create_project(
        db_session,
        ProjectCreate(name="Bob Only", description="Desc", memberIds=[m2.id]),
        current_user=admin,
    )

    # Admin gets all
    admin_projects = await project_service.get_projects(db_session, current_user=admin)
    admin_ids = {p.id for p in admin_projects}
    assert p1.id in admin_ids
    assert p2.id in admin_ids

    # Alice gets only p1
    alice_projects = await project_service.get_projects(db_session, current_user=m1)
    alice_ids = {p.id for p in alice_projects}
    assert p1.id in alice_ids
    assert p2.id not in alice_ids

    # Bob gets only p2
    bob_projects = await project_service.get_projects(db_session, current_user=m2)
    bob_ids = {p.id for p in bob_projects}
    assert p2.id in bob_ids
    assert p1.id not in bob_ids


@pytest.mark.asyncio
async def test_get_project_by_id_permissions(db_session: AsyncSession, admin_and_members):
    """5. Admin and assigned member can fetch by ID; unassigned member receives 403 Forbidden."""
    admin, m1, m2 = admin_and_members

    project = await project_service.create_project(
        db_session,
        ProjectCreate(name="Secure Board", description="Desc", memberIds=[m1.id]),
        current_user=admin,
    )

    # Admin access OK
    res_admin = await project_service.get_project_by_id(db_session, project.id, current_user=admin)
    assert res_admin.id == project.id

    # Assigned member access OK
    res_m1 = await project_service.get_project_by_id(db_session, project.id, current_user=m1)
    assert res_m1.id == project.id

    # Unassigned member receives 403 Forbidden
    with pytest.raises(ForbiddenException):
        await project_service.get_project_by_id(db_session, project.id, current_user=m2)

    # Unknown ID raises 404 Not Found
    with pytest.raises(EntityNotFoundException):
        await project_service.get_project_by_id(db_session, uuid.uuid4(), current_user=admin)


@pytest.mark.asyncio
async def test_admin_update_and_archive_lifecycle(db_session: AsyncSession, admin_and_members):
    """6. Admin can update project and toggle archive/restore preserving previousStatus."""
    admin, m1, _ = admin_and_members

    project = await project_service.create_project(
        db_session,
        ProjectCreate(
            name="Lifecycle Project",
            description="Testing archive",
            status=ProjectStatus.ACTIVE,
            startDate=date(2026, 11, 1),
            dueDate=date(2026, 11, 30),
            memberIds=[m1.id],
        ),
        current_user=admin,
    )

    # Archive the project
    archived = await project_service.update_project(
        db_session,
        project.id,
        ProjectUpdate(status=ProjectStatus.ARCHIVED),
        current_user=admin,
    )
    assert archived.status == ProjectStatus.ARCHIVED
    assert archived.previous_status == ProjectStatus.ACTIVE

    # Restore the project back to active
    restored = await project_service.update_project(
        db_session,
        project.id,
        ProjectUpdate(status=ProjectStatus.ACTIVE),
        current_user=admin,
    )
    assert restored.status == ProjectStatus.ACTIVE
    assert restored.previous_status is None


@pytest.mark.asyncio
async def test_update_cross_field_date_validation(db_session: AsyncSession, admin_and_members):
    """7. Updating only start date to be after existing due date is rejected."""
    admin, _, _ = admin_and_members

    project = await project_service.create_project(
        db_session,
        ProjectCreate(
            name="Date Test",
            description="Testing dates",
            startDate=date(2026, 11, 1),
            dueDate=date(2026, 11, 10),
        ),
        current_user=admin,
    )

    # Client sends ONLY startDate=2026-11-15 (after existing due date 2026-11-10)
    with pytest.raises(DomainException) as exc:
        await project_service.update_project(
            db_session,
            project.id,
            ProjectUpdate(startDate=date(2026, 11, 15)),
            current_user=admin,
        )
    assert "dueDate must be greater than or equal to startDate" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_member_cannot_update_or_delete(db_session: AsyncSession, admin_and_members):
    """8. Members cannot update or delete projects."""
    admin, m1, _ = admin_and_members

    project = await project_service.create_project(
        db_session,
        ProjectCreate(name="Guarded Project", description="Desc"),
        current_user=admin,
    )

    with pytest.raises(ForbiddenException):
        await project_service.update_project(
            db_session, project.id, ProjectUpdate(name="Hacked"), current_user=m1
        )

    with pytest.raises(ForbiddenException):
        await project_service.delete_project(db_session, project.id, current_user=m1)


@pytest.mark.asyncio
async def test_admin_delete_project(db_session: AsyncSession, admin_and_members):
    """9. Admin can delete project, and non-existent delete returns 404."""
    admin, _, _ = admin_and_members

    project = await project_service.create_project(
        db_session,
        ProjectCreate(name="To Be Deleted", description="Desc"),
        current_user=admin,
    )

    assert await project_service.delete_project(db_session, project.id, current_user=admin) is True

    # Deleting missing project raises EntityNotFoundException
    with pytest.raises(EntityNotFoundException):
        await project_service.delete_project(db_session, uuid.uuid4(), current_user=admin)
