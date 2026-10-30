"""Tests for Project Pydantic schemas (Day 3 Step 1)."""

import uuid
from datetime import date
import pytest
from pydantic import ValidationError

from schemas.project_schema import (
    ProjectCreate,
    ProjectUpdate,
    ProjectOut,
    ProjectStatus,
    ProjectPriority,
)


# ============================================================================
# Tests: ProjectCreate
# ============================================================================
def test_project_create_valid_data():
    """1. Valid project data is accepted with camelCase aliases."""
    member_id = uuid.uuid4()
    data = {
        "name": "Design System",
        "description": "Create standard UI design components",
        "status": "planning",
        "category": "Engineering",
        "priority": "high",
        "startDate": "2026-11-01",
        "dueDate": "2026-11-15",
        "endDate": "2026-11-20",
        "memberIds": [str(member_id)],
    }
    project = ProjectCreate.model_validate(data)
    assert project.name == "Design System"
    assert project.description == "Create standard UI design components"
    assert project.status == ProjectStatus.PLANNING
    assert project.priority == ProjectPriority.HIGH
    assert project.start_date == date(2026, 11, 1)
    assert project.due_date == date(2026, 11, 15)
    assert project.member_ids == [member_id]


def test_project_create_missing_required_fields():
    """2. Missing required fields (name, description) are rejected."""
    with pytest.raises(ValidationError) as exc:
        ProjectCreate.model_validate({"description": "Some description"})
    assert "name" in str(exc.value)

    with pytest.raises(ValidationError) as exc:
        ProjectCreate.model_validate({"name": "Test Project"})
    assert "description" in str(exc.value)


def test_project_create_short_name_rejected():
    """3. Project name shorter than 3 characters is rejected."""
    with pytest.raises(ValidationError):
        ProjectCreate.model_validate({"name": "AB", "description": "Valid description"})


def test_project_create_invalid_date_format():
    """4. Invalid date format string is rejected."""
    with pytest.raises(ValidationError):
        ProjectCreate.model_validate(
            {
                "name": "Valid Name",
                "description": "Valid description",
                "startDate": "not-a-date",
            }
        )


def test_project_create_due_date_later_than_start_date_accepted():
    """5. A due date later than the start date is accepted."""
    project = ProjectCreate.model_validate(
        {
            "name": "Valid Name",
            "description": "Valid description",
            "startDate": "2026-11-01",
            "dueDate": "2026-11-05",
        }
    )
    assert project.start_date == date(2026, 11, 1)
    assert project.due_date == date(2026, 11, 5)


def test_project_create_due_date_equal_to_start_date_accepted():
    """6. A due date equal to the start date is accepted."""
    project = ProjectCreate.model_validate(
        {
            "name": "Single Day Sprint",
            "description": "Valid description",
            "startDate": "2026-11-01",
            "dueDate": "2026-11-01",
        }
    )
    assert project.start_date == project.due_date


def test_project_create_due_date_earlier_than_start_date_rejected():
    """7. A due date earlier than the start date is rejected."""
    with pytest.raises(ValidationError) as exc:
        ProjectCreate.model_validate(
            {
                "name": "Valid Name",
                "description": "Valid description",
                "startDate": "2026-11-10",
                "dueDate": "2026-11-01",
            }
        )
    assert "dueDate must be greater than or equal to startDate" in str(exc.value)


def test_project_create_invalid_status_rejected():
    """8. Invalid status values outside defined enums are rejected."""
    with pytest.raises(ValidationError):
        ProjectCreate.model_validate(
            {
                "name": "Valid Name",
                "description": "Valid description",
                "status": "unknown_status",
            }
        )


def test_project_create_invalid_priority_rejected():
    """9. Invalid priority values outside defined enums are rejected."""
    with pytest.raises(ValidationError):
        ProjectCreate.model_validate(
            {
                "name": "Valid Name",
                "description": "Valid description",
                "priority": "critical_extreme",
            }
        )


def test_project_create_invalid_category_rejected():
    """9b. Invalid category values outside defined enums are rejected."""
    with pytest.raises(ValidationError):
        ProjectCreate.model_validate(
            {
                "name": "Valid Name",
                "description": "Valid description",
                "category": "Random Invalid Category",
            }
        )


def test_project_create_invalid_member_ids_rejected():
    """10. Member IDs that are not valid UUIDs are rejected."""
    with pytest.raises(ValidationError):
        ProjectCreate.model_validate(
            {
                "name": "Valid Name",
                "description": "Valid description",
                "memberIds": ["not-a-valid-uuid"],
            }
        )


# ============================================================================
# Tests: ProjectUpdate
# ============================================================================
def test_project_update_single_field_name():
    """11. Updating only the project name works without requiring creation fields."""
    update = ProjectUpdate.model_validate({"name": "Updated Name"})
    assert update.name == "Updated Name"
    assert update.description is None
    assert update.status is None


def test_project_update_single_field_priority():
    """12. Updating only the priority works."""
    update = ProjectUpdate.model_validate({"priority": "high"})
    assert update.priority == ProjectPriority.HIGH


def test_project_update_supported_status_changes():
    """13. Updating project status and archiving lifecycle works."""
    update = ProjectUpdate.model_validate(
        {
            "status": "archived",
            "previousStatus": "active",
        }
    )
    assert update.status == ProjectStatus.ARCHIVED
    assert update.previous_status == ProjectStatus.ACTIVE


def test_project_update_invalid_date_combination_rejected():
    """14. Invalid date combination in partial update is rejected."""
    with pytest.raises(ValidationError) as exc:
        ProjectUpdate.model_validate(
            {
                "startDate": "2026-12-10",
                "dueDate": "2026-12-01",
            }
        )
    assert "dueDate must be greater than or equal to startDate" in str(exc.value)


def test_project_update_single_date_without_db_lookup():
    """15. A single changed date does not fail in schema and does not perform DB lookups."""
    update = ProjectUpdate.model_validate({"dueDate": "2026-12-25"})
    assert update.due_date == date(2026, 12, 25)
    assert update.start_date is None


def test_project_update_omitted_fields_remain_unset():
    """16. Omitted fields are preserved as None and can be inspected via model_dump(exclude_unset=True)."""
    update = ProjectUpdate.model_validate({"name": "Renamed Board"})
    dumped = update.model_dump(exclude_unset=True)
    assert dumped == {"name": "Renamed Board"}
    assert "status" not in dumped


# ============================================================================
# Tests: ProjectOut
# ============================================================================
def test_project_out_valid_construction():
    """17. A valid project response matches frontend Project interface."""
    project_id = uuid.uuid4()
    admin_id = uuid.uuid4()
    member_id = uuid.uuid4()

    out = ProjectOut.model_validate(
        {
            "id": str(project_id),
            "name": "Frontend Redesign",
            "description": "Next.js migration",
            "status": "active",
            "category": "Frontend",
            "priority": "medium",
            "startDate": "2026-10-01",
            "dueDate": "2026-11-01",
            "endDate": None,
            "previousStatus": None,
            "createdBy": str(admin_id),
            "createdAt": "2026-10-01T10:00:00Z",
            "updatedAt": "2026-10-02T12:00:00Z",
            "memberIds": [str(member_id)],
        }
    )

    dumped = out.model_dump(by_alias=True)
    assert dumped["id"] == project_id
    assert dumped["name"] == "Frontend Redesign"
    assert dumped["status"] == "active"
    assert dumped["startDate"] == date(2026, 10, 1)
    assert dumped["dueDate"] == date(2026, 11, 1)
    assert dumped["memberIds"] == [member_id]
    assert "hashed_password" not in dumped
    assert "password" not in dumped
