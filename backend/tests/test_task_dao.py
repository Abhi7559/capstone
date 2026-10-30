"""Comprehensive unit and integration tests for TaskDAO and ActivityDAO (Day 4 Step 2)."""

import uuid
from datetime import date
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dao.task_dao import task_dao
from dao.activity_dao import activity_dao
from dao.project_dao import project_dao
from dao.user_dao import user_dao
from core.security import hash_password
from models.task import Task
from models.activity import ProjectActivity


@pytest.fixture
async def task_dao_context(db_session: AsyncSession):
    """Seed a project and assigned member for Task DAO testing."""
    member = await user_dao.create_user(
        db_session,
        {
            "id": uuid.uuid4(),
            "name": "Task Test Member",
            "email": f"task_user_{uuid.uuid4().hex[:6]}@teamboard.com",
            "hashed_password": hash_password("Password@123"),
            "role": "member",
            "status": "active",
        },
    )
    other_member = await user_dao.create_user(
        db_session,
        {
            "id": uuid.uuid4(),
            "name": "Other Member",
            "email": f"other_user_{uuid.uuid4().hex[:6]}@teamboard.com",
            "hashed_password": hash_password("Password@123"),
            "role": "member",
            "status": "active",
        },
    )
    project = await project_dao.create(
        db_session,
        project_data={
            "name": "Task DAO Project",
            "description": "Testing tasks and activities",
            "status": "active",
            "category": "Engineering",
            "priority": "high",
        },
        member_ids=[member.id, other_member.id],
    )
    other_project = await project_dao.create(
        db_session,
        project_data={
            "name": "Other Project",
            "description": "Testing project isolation",
            "status": "planning",
        },
        member_ids=[],
    )
    return {
        "project": project,
        "other_project": other_project,
        "member": member,
        "other_member": other_member,
    }


# ============================================================================
# Task DAO Tests (Tests 1 - 12)
# ============================================================================

@pytest.mark.asyncio
async def test_create_task_with_tags(db_session: AsyncSession, task_dao_context):
    """8. Create a task with the expected tags format and verify persistence."""
    ctx = task_dao_context
    task = await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "Configure Redis connection pool",
            "description": "Set up shared Redis connection pool and health checks",
            "priority": "high",
            "status": "todo",
            "assignee_id": ctx["member"].id,
            "due_date": date(2026, 11, 15),
            "tags": ["backend", "redis", "cache"],
        },
    )
    assert task.id is not None
    assert task.title == "Configure Redis connection pool"
    assert task.tags == ["backend", "redis", "cache"]
    assert task.priority == "high"
    assert task.status == "todo"
    assert task.assignee_id == ctx["member"].id


@pytest.mark.asyncio
async def test_get_tasks_without_filters(db_session: AsyncSession, task_dao_context):
    """1. Retrieve tasks without filters."""
    ctx = task_dao_context
    t1 = await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "Task 1",
            "description": "Desc 1",
            "due_date": date(2026, 11, 10),
        },
    )
    tasks = await task_dao.get_filtered(db_session)
    assert len(tasks) >= 1
    found_ids = {t.id for t in tasks}
    assert t1.id in found_ids


@pytest.mark.asyncio
async def test_filter_tasks_by_project(db_session: AsyncSession, task_dao_context):
    """2. Filter tasks by project."""
    ctx = task_dao_context
    t_proj1 = await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "Project 1 Task",
            "description": "Desc",
            "due_date": date(2026, 11, 10),
        },
    )
    t_proj2 = await task_dao.create(
        db_session,
        {
            "project_id": ctx["other_project"].id,
            "title": "Project 2 Task",
            "description": "Desc",
            "due_date": date(2026, 11, 12),
        },
    )
    tasks = await task_dao.get_filtered(db_session, project_id=ctx["project"].id)
    ids = {t.id for t in tasks}
    assert t_proj1.id in ids
    assert t_proj2.id not in ids


@pytest.mark.asyncio
async def test_filter_tasks_by_status(db_session: AsyncSession, task_dao_context):
    """3. Filter tasks by status (case-insensitive)."""
    ctx = task_dao_context
    t_done = await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "Done Task",
            "description": "Desc",
            "status": "done",
            "due_date": date(2026, 11, 10),
        },
    )
    t_todo = await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "Todo Task",
            "description": "Desc",
            "status": "todo",
            "due_date": date(2026, 11, 10),
        },
    )
    tasks = await task_dao.get_filtered(db_session, status="DONE")
    ids = {t.id for t in tasks}
    assert t_done.id in ids
    assert t_todo.id not in ids


@pytest.mark.asyncio
async def test_filter_tasks_by_priority(db_session: AsyncSession, task_dao_context):
    """4. Filter tasks by priority."""
    ctx = task_dao_context
    t_high = await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "High Priority Task",
            "description": "Desc",
            "priority": "high",
            "due_date": date(2026, 11, 10),
        },
    )
    t_low = await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "Low Priority Task",
            "description": "Desc",
            "priority": "low",
            "due_date": date(2026, 11, 10),
        },
    )
    tasks = await task_dao.get_filtered(db_session, priority="high")
    ids = {t.id for t in tasks}
    assert t_high.id in ids
    assert t_low.id not in ids


@pytest.mark.asyncio
async def test_filter_tasks_by_assignee(db_session: AsyncSession, task_dao_context):
    """5. Filter tasks by assignee."""
    ctx = task_dao_context
    t_assigned = await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "Assigned Task",
            "description": "Desc",
            "assignee_id": ctx["member"].id,
            "due_date": date(2026, 11, 10),
        },
    )
    t_other = await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "Other Assigned Task",
            "description": "Desc",
            "assignee_id": ctx["other_member"].id,
            "due_date": date(2026, 11, 10),
        },
    )
    tasks = await task_dao.get_filtered(db_session, assignee_id=ctx["member"].id)
    ids = {t.id for t in tasks}
    assert t_assigned.id in ids
    assert t_other.id not in ids


@pytest.mark.asyncio
async def test_apply_multiple_filters_together(db_session: AsyncSession, task_dao_context):
    """6. Apply multiple filters together (project + status + priority + assignee)."""
    ctx = task_dao_context
    match_task = await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "Exact Match Task",
            "description": "Desc",
            "status": "in_progress",
            "priority": "high",
            "assignee_id": ctx["member"].id,
            "due_date": date(2026, 11, 20),
        },
    )
    # Non-matching priority
    await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "Mismatch Priority",
            "description": "Desc",
            "status": "in_progress",
            "priority": "low",
            "assignee_id": ctx["member"].id,
            "due_date": date(2026, 11, 20),
        },
    )
    tasks = await task_dao.get_filtered(
        db_session,
        project_id=ctx["project"].id,
        status="in_progress",
        priority="high",
        assignee_id=ctx["member"].id,
    )
    assert len(tasks) == 1
    assert tasks[0].id == match_task.id


@pytest.mark.asyncio
async def test_filter_by_due_date(db_session: AsyncSession, task_dao_context):
    """7. Handle due-date filtering."""
    ctx = task_dao_context
    target_date = date(2026, 11, 25)
    t_target = await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "Due Date Match",
            "description": "Desc",
            "due_date": target_date,
        },
    )
    t_other = await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "Due Date Mismatch",
            "description": "Desc",
            "due_date": date(2026, 12, 1),
        },
    )
    tasks = await task_dao.get_filtered(db_session, due_date=target_date)
    ids = {t.id for t in tasks}
    assert t_target.id in ids
    assert t_other.id not in ids


@pytest.mark.asyncio
async def test_get_by_id_found_and_not_found(db_session: AsyncSession, task_dao_context):
    """9 & 10. Retrieve an existing task by ID, and handle a nonexistent task."""
    ctx = task_dao_context
    task = await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "Specific Task",
            "description": "Desc",
            "due_date": date(2026, 11, 10),
        },
    )
    found = await task_dao.get_by_id(db_session, task.id)
    assert found is not None
    assert found.id == task.id
    assert found.title == "Specific Task"

    # Nonexistent task returns None
    missing = await task_dao.get_by_id(db_session, uuid.uuid4())
    assert missing is None


@pytest.mark.asyncio
async def test_update_task_partial_and_preserves_omitted(db_session: AsyncSession, task_dao_context):
    """11. Update only supplied fields and preserve omitted fields."""
    ctx = task_dao_context
    task = await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "Original Title",
            "description": "Original Description",
            "status": "todo",
            "priority": "low",
            "assignee_id": ctx["member"].id,
            "due_date": date(2026, 11, 10),
            "tags": ["v1"],
        },
    )

    # Move task to in_progress without sending description or tags
    updated = await task_dao.update(
        db_session,
        task.id,
        {"status": "in_progress", "priority": "high"},
    )
    assert updated is not None
    assert updated.status == "in_progress"
    assert updated.priority == "high"
    # Preserved fields
    assert updated.title == "Original Title"
    assert updated.description == "Original Description"
    assert updated.assignee_id == ctx["member"].id
    assert updated.tags == ["v1"]

    # Explicit unassignment
    unassigned = await task_dao.update(db_session, task.id, {"assignee_id": None})
    assert unassigned.assignee_id is None


@pytest.mark.asyncio
async def test_delete_task(db_session: AsyncSession, task_dao_context):
    """12. Delete a task according to existing database rules."""
    ctx = task_dao_context
    task = await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "Task to Delete",
            "description": "Desc",
            "due_date": date(2026, 11, 10),
        },
    )
    success = await task_dao.delete(db_session, task.id)
    assert success is True

    # Confirm it cannot be found with normal get_by_id
    retrieved = await task_dao.get_by_id(db_session, task.id)
    assert retrieved is None

    # Confirm record still exists in DB marked as is_deleted = True
    in_db = await task_dao.get_by_id(db_session, task.id, include_deleted=True)
    assert in_db is not None
    assert in_db.is_deleted is True

    # Deleting missing task returns False
    missing_delete = await task_dao.delete(db_session, uuid.uuid4())
    assert missing_delete is False


# ============================================================================
# Activity DAO Tests (Tests 13 - 17)
# ============================================================================

@pytest.mark.asyncio
async def test_create_and_retrieve_project_activity(db_session: AsyncSession, task_dao_context):
    """13, 14, 15, 17. Create and retrieve project activity in newest-first order with actual model fields."""
    ctx = task_dao_context
    task = await task_dao.create(
        db_session,
        {
            "project_id": ctx["project"].id,
            "title": "Activity Task",
            "description": "Desc",
            "due_date": date(2026, 11, 10),
        },
    )

    act1 = await activity_dao.create_project_activity(
        db_session,
        project_id=ctx["project"].id,
        task_id=task.id,
        task_title=task.title,
        user_id=ctx["member"].id,
        user_name=ctx["member"].name,
        from_status="todo",
        to_status="in_progress",
    )
    import asyncio
    await asyncio.sleep(0.05)
    act2 = await activity_dao.create_project_activity(
        db_session,
        project_id=ctx["project"].id,
        task_id=task.id,
        task_title=task.title,
        user_id=ctx["member"].id,
        user_name=ctx["member"].name,
        from_status="in_progress",
        to_status="done",
    )

    assert act1.id is not None
    assert act2.id is not None

    activities = await activity_dao.get_by_project(db_session, ctx["project"].id)
    assert len(activities) >= 2
    # Verify newest first ordering
    assert activities[0].id == act2.id
    assert activities[1].id == act1.id
    assert activities[0].to_status == "done"
    assert activities[0].from_status == "in_progress"


@pytest.mark.asyncio
async def test_get_activities_for_project_with_no_records(db_session: AsyncSession, task_dao_context):
    """16. Return an empty list when no activities exist for a project."""
    ctx = task_dao_context
    activities = await activity_dao.get_by_project(db_session, ctx["other_project"].id)
    assert activities == []
