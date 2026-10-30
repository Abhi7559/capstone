"""Focused unit tests for Task and ProjectActivity schemas (Day 4 Step 1)."""

import uuid
from datetime import date, datetime
import pytest
from pydantic import ValidationError

from schemas.task_schema import (
    TaskCreate,
    TaskUpdate,
    TaskOut,
    TaskStatus,
    TaskPriority,
    ProjectActivityOut,
)


def test_task_create_valid_payload():
    """1. Valid task creation payload is successfully parsed with camelCase aliases."""
    payload = {
        "projectId": str(uuid.uuid4()),
        "title": "Configure Redis connection pool",
        "description": "Set up shared Redis connection pool and health checks",
        "priority": "high",
        "status": "todo",
        "assigneeId": str(uuid.uuid4()),
        "dueDate": "2026-11-15",
        "tags": ["backend", "redis"],
    }
    task = TaskCreate.model_validate(payload)
    assert task.title == "Configure Redis connection pool"
    assert task.priority == TaskPriority.HIGH
    assert task.status == TaskStatus.TODO
    assert task.due_date == date(2026, 11, 15)
    assert task.tags == ["backend", "redis"]


def test_task_create_missing_required_fields():
    """2. Missing required fields (projectId, title, description, dueDate) raise ValidationError."""
    with pytest.raises(ValidationError) as exc:
        TaskCreate.model_validate({"title": "Incomplete task"})
    errors = exc.value.errors()
    missing_locs = {err["loc"][0] for err in errors}
    assert "project_id" in missing_locs or "projectId" in missing_locs
    assert "description" in missing_locs
    assert "due_date" in missing_locs or "dueDate" in missing_locs


def test_task_create_invalid_priority_rejected():
    """3. Invalid priority outside defined enum is rejected."""
    with pytest.raises(ValidationError):
        TaskCreate.model_validate(
            {
                "projectId": str(uuid.uuid4()),
                "title": "Task with invalid priority",
                "description": "Desc",
                "priority": "extreme_urgent",
                "dueDate": "2026-11-15",
            }
        )


def test_task_create_invalid_status_rejected():
    """4. Invalid status outside defined enum is rejected."""
    with pytest.raises(ValidationError):
        TaskCreate.model_validate(
            {
                "projectId": str(uuid.uuid4()),
                "title": "Task with invalid status",
                "description": "Desc",
                "status": "in_review_random",
                "dueDate": "2026-11-15",
            }
        )


def test_task_create_blank_title_rejected():
    """5. Blank whitespace-only title is rejected."""
    with pytest.raises(ValidationError):
        TaskCreate.model_validate(
            {
                "projectId": str(uuid.uuid4()),
                "title": "   ",
                "description": "Desc",
                "dueDate": "2026-11-15",
            }
        )


def test_task_update_single_status_field():
    """6. Valid partial update containing only status."""
    update = TaskUpdate.model_validate({"status": "in_progress"})
    dump = update.model_dump(exclude_unset=True)
    assert dump == {"status": TaskStatus.IN_PROGRESS}


def test_task_update_single_priority_field():
    """7. Valid partial update containing only priority."""
    update = TaskUpdate.model_validate({"priority": "low"})
    dump = update.model_dump(exclude_unset=True)
    assert dump == {"priority": TaskPriority.LOW}


def test_task_update_omitted_vs_explicit_none():
    """8. Omitted fields are distinguishable from explicitly supplied null values."""
    omitted = TaskUpdate.model_validate({"title": "Updated Title"})
    assert "assignee_id" not in omitted.model_dump(exclude_unset=True)

    explicit_none = TaskUpdate.model_validate({"assigneeId": None})
    dump = explicit_none.model_dump(exclude_unset=True)
    assert "assignee_id" in dump
    assert dump["assignee_id"] is None


def test_task_out_camelcase_serialization():
    """9. Task output serializes to camelCase matching the frontend Task interface."""
    task_id = uuid.uuid4()
    proj_id = uuid.uuid4()
    assignee_id = uuid.uuid4()
    now = datetime(2026, 10, 28, 12, 0, 0)

    task_out = TaskOut(
        id=task_id,
        project_id=proj_id,
        title="Frontend Task Contract",
        description="Verify serialized keys",
        priority=TaskPriority.HIGH,
        status=TaskStatus.TODO,
        assignee_id=assignee_id,
        due_date=date(2026, 11, 20),
        tags=["frontend", "test"],
        created_at=now,
        updated_at=now,
    )
    json_data = task_out.model_dump(by_alias=True)
    assert json_data["id"] == task_id
    assert json_data["projectId"] == proj_id
    assert json_data["title"] == "Frontend Task Contract"
    assert json_data["priority"] == "high"
    assert json_data["status"] == "todo"
    assert json_data["assigneeId"] == assignee_id
    assert json_data["dueDate"] == date(2026, 11, 20)
    assert json_data["tags"] == ["frontend", "test"]
    assert "createdAt" in json_data
    assert "updatedAt" in json_data


def test_project_activity_out_serialization():
    """10. Project activity output matches the frontend ProjectActivity interface."""
    act_id = uuid.uuid4()
    proj_id = uuid.uuid4()
    task_id = uuid.uuid4()
    user_id = uuid.uuid4()
    now = datetime(2026, 10, 28, 12, 0, 0)

    activity = ProjectActivityOut(
        id=act_id,
        project_id=proj_id,
        task_id=task_id,
        task_title="Configure Redis connection pool",
        user_id=user_id,
        user_name="Sarah Connor",
        from_status="todo",
        to_status="in_progress",
        created_at=now,
    )
    data = activity.model_dump(by_alias=True)
    assert data["id"] == act_id
    assert data["projectId"] == proj_id
    assert data["taskId"] == task_id
    assert data["taskTitle"] == "Configure Redis connection pool"
    assert data["userId"] == user_id
    assert data["userName"] == "Sarah Connor"
    assert data["fromStatus"] == "todo"
    assert data["toStatus"] == "in_progress"
    assert data["createdAt"] == now


def test_task_orm_serialization():
    """11. Verify ORM object serialization using from_attributes."""
    class MockTaskORM:
        id = uuid.uuid4()
        project_id = uuid.uuid4()
        title = "ORM Serialized Task"
        description = "Loaded from DB attributes"
        priority = "medium"
        status = "in_progress"
        assignee_id = None
        due_date = date(2026, 12, 1)
        tags = ["orm", "db"]
        created_at = datetime(2026, 10, 28, 10, 0, 0)
        updated_at = datetime(2026, 10, 28, 10, 0, 0)

    task_out = TaskOut.model_validate(MockTaskORM())
    assert task_out.id == MockTaskORM.id
    assert task_out.title == "ORM Serialized Task"
    assert task_out.status == TaskStatus.IN_PROGRESS
    assert task_out.priority == TaskPriority.MEDIUM
    assert task_out.assignee_id is None
