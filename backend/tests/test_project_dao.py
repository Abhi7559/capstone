"""Comprehensive tests for ProjectDAO (Day 3 Step 2)."""

import uuid
from datetime import date
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dao.project_dao import project_dao
from dao.user_dao import user_dao
from core.security import hash_password


@pytest.fixture
async def sample_members(db_session: AsyncSession):
    """Fixture providing two distinct active workspace members."""
    m1 = await user_dao.create_user(
        db_session,
        {
            "id": uuid.uuid4(),
            "name": "Alice Member",
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
            "name": "Bob Member",
            "email": f"bob_{uuid.uuid4().hex[:6]}@teamboard.com",
            "hashed_password": hash_password("Password@123"),
            "role": "member",
            "status": "active",
        },
    )
    return m1, m2


@pytest.mark.asyncio
async def test_create_project_with_members(db_session: AsyncSession, sample_members):
    """1. Create a project with member assignments and verify eager loading."""
    m1, m2 = sample_members
    project = await project_dao.create(
        db_session,
        project_data={
            "name": "Alpha Project",
            "description": "First project",
            "status": "planning",
            "priority": "high",
            "start_date": date(2026, 11, 1),
            "due_date": date(2026, 11, 30),
        },
        member_ids=[m1.id, m2.id],
    )
    assert project.id is not None
    assert project.name == "Alpha Project"
    assert len(project.members) == 2
    assigned_ids = {m.id for m in project.members}
    assert m1.id in assigned_ids
    assert m2.id in assigned_ids


@pytest.mark.asyncio
async def test_create_project_without_members(db_session: AsyncSession):
    """2. Create a project with empty/None member_ids."""
    project = await project_dao.create(
        db_session,
        project_data={
            "name": "Solo Project",
            "description": "No team assigned initially",
            "status": "planning",
        },
        member_ids=None,
    )
    assert project.id is not None
    assert project.name == "Solo Project"
    assert len(project.members) == 0


@pytest.mark.asyncio
async def test_get_by_id_found_and_not_found(db_session: AsyncSession):
    """3. Test retrieval by ID for existing and non-existing records."""
    project = await project_dao.create(
        db_session,
        project_data={"name": "Lookup Project", "description": "Desc"},
    )
    fetched = await project_dao.get_by_id(db_session, project.id)
    assert fetched is not None
    assert fetched.id == project.id

    missing = await project_dao.get_by_id(db_session, uuid.uuid4())
    assert missing is None


@pytest.mark.asyncio
async def test_admin_vs_member_project_queries(db_session: AsyncSession, sample_members):
    """4. Admin query returns all; member query returns only assigned projects."""
    m1, m2 = sample_members

    p1 = await project_dao.create(
        db_session,
        project_data={"name": "Alice Exclusive", "description": "Only Alice"},
        member_ids=[m1.id],
    )
    p2 = await project_dao.create(
        db_session,
        project_data={"name": "Bob Exclusive", "description": "Only Bob"},
        member_ids=[m2.id],
    )

    # Admin query returns all
    all_projects = await project_dao.get_all_admin(db_session)
    admin_project_ids = {p.id for p in all_projects}
    assert p1.id in admin_project_ids
    assert p2.id in admin_project_ids

    # Alice query returns p1 only
    alice_projects = await project_dao.get_all_for_member(db_session, m1.id)
    alice_ids = {p.id for p in alice_projects}
    assert p1.id in alice_ids
    assert p2.id not in alice_ids

    # Bob query returns p2 only
    bob_projects = await project_dao.get_all_for_member(db_session, m2.id)
    bob_ids = {p.id for p in bob_projects}
    assert p2.id in bob_ids
    assert p1.id not in bob_ids


@pytest.mark.asyncio
async def test_update_project_partial_and_sync_members(db_session: AsyncSession, sample_members):
    """5. Partial update modifies fields and synchronizes member assignments."""
    m1, m2 = sample_members

    project = await project_dao.create(
        db_session,
        project_data={"name": "Original Name", "description": "Original Desc", "priority": "low"},
        member_ids=[m1.id],
    )

    # Update name only; leave member_ids=None (must keep m1)
    up1 = await project_dao.update(
        db_session,
        project_id=project.id,
        update_data={"name": "Updated Name"},
        member_ids=None,
    )
    assert up1.name == "Updated Name"
    assert up1.description == "Original Desc"  # Preserved
    assert len(up1.members) == 1
    assert up1.members[0].id == m1.id

    # Update members to [m2.id] (replace m1 with m2)
    up2 = await project_dao.update(
        db_session,
        project_id=project.id,
        update_data={"priority": "high"},
        member_ids=[m2.id],
    )
    assert up2.priority == "high"
    assert len(up2.members) == 1
    assert up2.members[0].id == m2.id

    # Update unknown project returns None
    assert await project_dao.update(db_session, uuid.uuid4(), {"name": "Fail"}) is None


@pytest.mark.asyncio
async def test_delete_project(db_session: AsyncSession, sample_members):
    """6. Delete soft-deletes project by setting is_deleted=True."""
    m1, _ = sample_members
    project = await project_dao.create(
        db_session,
        project_data={"name": "To Delete", "description": "Temp"},
        member_ids=[m1.id],
    )

    assert await project_dao.delete(db_session, project.id) is True
    # Confirm soft-deletion: excluded by default
    assert await project_dao.get_by_id(db_session, project.id) is None
    # Can still be found if include_deleted=True
    soft_deleted = await project_dao.get_by_id(db_session, project.id, include_deleted=True)
    assert soft_deleted is not None
    assert soft_deleted.is_deleted is True
    # Deleting missing or already-deleted returns False
    assert await project_dao.delete(db_session, project.id) is False
    assert await project_dao.delete(db_session, uuid.uuid4()) is False
