"""Focused unit tests for TaskService business logic (Day 4 Step 3)."""

import uuid
from datetime import date
from unittest.mock import AsyncMock, patch
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dao.project_dao import project_dao
from dao.user_dao import user_dao
from dao.task_dao import task_dao
from dao.activity_dao import activity_dao
from core.security import hash_password
from exceptions.domain import (
    EntityNotFoundException,
    ForbiddenException,
    ValidationException,
)
from models.user import User
from schemas.task_schema import (
    TaskCreate,
    TaskUpdate,
    TaskStatus,
    TaskPriority,
)
from services.task_service import task_service


@pytest.fixture
async def service_context(db_session: AsyncSession):
    """Seed Admin, Project Member, Non-Member, and Project for Service testing."""
    admin = await user_dao.create_user(
        db_session,
        {
            "id": uuid.uuid4(),
            "name": "Admin User",
            "email": f"adm_{uuid.uuid4().hex[:6]}@teamboard.com",
            "hashed_password": hash_password("Admin@123"),
            "role": "admin",
            "status": "active",
        },
    )
    member = await user_dao.create_user(
        db_session,
        {
            "id": uuid.uuid4(),
            "name": "Project Member",
            "email": f"mem_{uuid.uuid4().hex[:6]}@teamboard.com",
            "hashed_password": hash_password("Member@123"),
            "role": "member",
            "status": "active",
        },
    )
    non_member = await user_dao.create_user(
        db_session,
        {
            "id": uuid.uuid4(),
            "name": "Non Member",
            "email": f"non_{uuid.uuid4().hex[:6]}@teamboard.com",
            "hashed_password": hash_password("Member@123"),
            "role": "member",
            "status": "active",
        },
    )
    project = await project_dao.create(
        db_session,
        project_data={
            "name": "Service Project",
            "description": "Project for testing task service",
            "status": "active",
            "category": "Engineering",
            "priority": "high",
        },
        member_ids=[member.id],
    )
    return {
        "admin": admin,
        "member": member,
        "non_member": non_member,
        "project": project,
    }


@pytest.mark.asyncio
async def test_create_task_with_valid_member_assignee(db_session: AsyncSession, service_context):
    """1. Creating a task with a valid project-member assignee succeeds."""
    ctx = service_context
    task_in = TaskCreate(
        projectId=ctx["project"].id,
        title="Valid Member Task",
        description="Testing valid assignee assignment",
        priority=TaskPriority.HIGH,
        status=TaskStatus.TODO,
        assigneeId=ctx["member"].id,
        dueDate=date(2026, 11, 20),
        tags=["backend"],
    )

    with patch("services.task_service.invalidate_dashboard_cache", new_callable=AsyncMock) as mock_cache:
        task_out = await task_service.create_task(db_session, task_in, ctx["admin"])
        assert task_out.id is not None
        assert task_out.title == "Valid Member Task"
        assert task_out.assignee_id == ctx["member"].id
        mock_cache.assert_awaited_once_with(str(ctx["project"].id))


@pytest.mark.asyncio
async def test_create_task_with_invalid_assignee_raises_validation_exception(
    db_session: AsyncSession, service_context
):
    """2. Creating a task with an invalid project-member assignee raises ValidationException."""
    ctx = service_context
    task_in = TaskCreate(
        projectId=ctx["project"].id,
        title="Invalid Assignee Task",
        description="Testing non-member assignment",
        priority=TaskPriority.MEDIUM,
        status=TaskStatus.TODO,
        assigneeId=ctx["non_member"].id,
        dueDate=date(2026, 11, 20),
    )

    with pytest.raises(ValidationException) as exc:
        await task_service.create_task(db_session, task_in, ctx["admin"])
    assert "Assignee is not a member of this project" in str(exc.value.details)


@pytest.mark.asyncio
async def test_update_task_with_valid_assignee(db_session: AsyncSession, service_context):
    """3. Updating a task with a valid assignee succeeds."""
    ctx = service_context
    # First create task without assignee
    task_in = TaskCreate(
        projectId=ctx["project"].id,
        title="Task to Assign",
        description="Desc",
        dueDate=date(2026, 11, 20),
    )
    created = await task_service.create_task(db_session, task_in, ctx["admin"])

    # Update with valid assignee
    update_in = TaskUpdate(assigneeId=ctx["member"].id)
    with patch("services.task_service.invalidate_dashboard_cache", new_callable=AsyncMock) as mock_cache:
        updated = await task_service.update_task(
            db_session, created.id, update_in, ctx["admin"]
        )
        assert updated.assignee_id == ctx["member"].id
        mock_cache.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_task_with_invalid_assignee_fails(db_session: AsyncSession, service_context):
    """4. Updating a task to assign a non-member fails with ValidationException."""
    ctx = service_context
    task_in = TaskCreate(
        projectId=ctx["project"].id,
        title="Task to Reassign",
        description="Desc",
        dueDate=date(2026, 11, 20),
    )
    created = await task_service.create_task(db_session, task_in, ctx["admin"])

    update_in = TaskUpdate(assigneeId=ctx["non_member"].id)
    with pytest.raises(ValidationException) as exc:
        await task_service.update_task(db_session, created.id, update_in, ctx["admin"])
    assert "Assignee is not a member of this project" in str(exc.value.details)


@pytest.mark.asyncio
async def test_status_change_records_activity_and_invalidates_cache(
    db_session: AsyncSession, service_context
):
    """5. Changing status from todo to in_progress records a project activity and purges cache."""
    ctx = service_context
    task_in = TaskCreate(
        projectId=ctx["project"].id,
        title="Activity Trigger Task",
        description="Desc",
        status=TaskStatus.TODO,
        assigneeId=ctx["member"].id,
        dueDate=date(2026, 11, 20),
    )
    created = await task_service.create_task(db_session, task_in, ctx["admin"])

    # Move task to in_progress
    update_in = TaskUpdate(status=TaskStatus.IN_PROGRESS)
    with patch("services.task_service.invalidate_dashboard_cache", new_callable=AsyncMock) as mock_cache:
        updated = await task_service.update_task(
            db_session, created.id, update_in, ctx["member"]
        )
        assert updated.status == TaskStatus.IN_PROGRESS
        mock_cache.assert_awaited_once_with(str(ctx["project"].id))

    # Verify activity record was created
    activities = await task_service.get_project_activities(
        db_session, ctx["project"].id, ctx["admin"]
    )
    assert len(activities) >= 1
    recent = activities[0]
    assert recent.task_id == created.id
    assert recent.from_status == "todo"
    assert recent.to_status == "in_progress"
    assert recent.user_name == ctx["member"].name


@pytest.mark.asyncio
async def test_no_activity_recorded_when_status_unchanged(
    db_session: AsyncSession, service_context
):
    """6. A status update with no actual status change does not create duplicate activity records."""
    ctx = service_context
    task_in = TaskCreate(
        projectId=ctx["project"].id,
        title="No Duplicate Activity",
        description="Desc",
        status=TaskStatus.TODO,
        dueDate=date(2026, 11, 20),
    )
    created = await task_service.create_task(db_session, task_in, ctx["admin"])

    # Clear initial count
    initial_activities = await task_service.get_project_activities(
        db_session, ctx["project"].id, ctx["admin"]
    )
    initial_count = len(initial_activities)

    # Update with the same status
    update_in = TaskUpdate(status=TaskStatus.TODO, priority=TaskPriority.HIGH)
    await task_service.update_task(db_session, created.id, update_in, ctx["admin"])

    after_activities = await task_service.get_project_activities(
        db_session, ctx["project"].id, ctx["admin"]
    )
    assert len(after_activities) == initial_count


@pytest.mark.asyncio
async def test_task_not_found_raises_entity_not_found_exception(
    db_session: AsyncSession, service_context
):
    """7. Task-not-found handling works correctly."""
    ctx = service_context
    fake_id = uuid.uuid4()
    with pytest.raises(EntityNotFoundException) as exc:
        await task_service.get_task_by_id(db_session, fake_id, ctx["admin"])
    assert str(fake_id) in str(exc.value.details)

    with pytest.raises(EntityNotFoundException):
        await task_service.update_task(
            db_session, fake_id, TaskUpdate(title="New"), ctx["admin"]
        )

    with pytest.raises(EntityNotFoundException):
        await task_service.delete_task(db_session, fake_id, ctx["admin"])


@pytest.mark.asyncio
async def test_delete_task_admin_only_and_triggers_cache_invalidation(
    db_session: AsyncSession, service_context
):
    """8. Deleting a task is restricted to Admin and invalidates dashboard cache."""
    ctx = service_context
    task_in = TaskCreate(
        projectId=ctx["project"].id,
        title="Task to Delete",
        description="Desc",
        dueDate=date(2026, 11, 20),
    )
    created = await task_service.create_task(db_session, task_in, ctx["admin"])

    # Member attempt should fail with 403 Forbidden
    with pytest.raises(ForbiddenException):
        await task_service.delete_task(db_session, created.id, ctx["member"])

    # Admin attempt succeeds and invalidates cache
    with patch("services.task_service.invalidate_dashboard_cache", new_callable=AsyncMock) as mock_cache:
        deleted = await task_service.delete_task(db_session, created.id, ctx["admin"])
        assert deleted is True
        mock_cache.assert_awaited_once_with(str(ctx["project"].id))
