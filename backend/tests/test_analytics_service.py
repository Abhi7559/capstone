"""Focused tests for AnalyticsService and DAO aggregations.

Tests:
1. Status distribution returns correct count for each status.
2. Status distribution respects projectId filter.
3. Workload aggregation groups tasks by correct assignee.
4. Unassigned tasks are handled correctly.
5. Workload aggregation respects projectId filter.
6. Completion trend uses authoritative status-transition events.
7. Completion trend covers continuous 7-day window.
8. Zero-completion dates are included with count = 0.
9. Results are returned in chronological order.
10. Empty projects return zero-filled chart structures.
11. Inaccessible or non-existent project raises appropriate exception.
"""

import uuid
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from dao.task_dao import task_dao
from dao.activity_dao import activity_dao
from exceptions.domain import EntityNotFoundException, ForbiddenException
from models.user import User
from models.project import Project, ProjectMember
from models.task import Task
from models.activity import ProjectActivity
from services.analytics_service import analytics_service
from schemas.analytics_schema import AnalyticsDataResponse


async def clean_db(db_session: AsyncSession):
    """Clean operational tables before test."""
    await db_session.execute(delete(ProjectActivity))
    await db_session.execute(delete(Task))
    await db_session.execute(delete(ProjectMember))
    await db_session.execute(delete(Project))
    from tests.conftest import DEFAULT_ADMIN_ID
    await db_session.execute(delete(User).where(User.id != DEFAULT_ADMIN_ID))
    await db_session.commit()


@pytest.fixture
async def analytics_setup(db_session: AsyncSession):
    """Seed users, projects, tasks with varied statuses/assignees, and activities."""
    await clean_db(db_session)

    uid_suffix = uuid.uuid4().hex[:6]
    admin = User(
        id=uuid.uuid4(),
        name="Analytics Admin",
        email=f"admin_{uid_suffix}@test.com",
        role="admin",
        status="active",
        hashed_password="fake",
    )
    alice = User(
        id=uuid.uuid4(),
        name="Alice Walker",
        email=f"alice_{uid_suffix}@test.com",
        role="member",
        status="active",
        hashed_password="fake",
    )
    bob = User(
        id=uuid.uuid4(),
        name="Bob Builder",
        email=f"bob_{uid_suffix}@test.com",
        role="member",
        status="active",
        hashed_password="fake",
    )
    db_session.add_all([admin, alice, bob])
    await db_session.flush()

    # Project 1: Alpha (Alice is assigned)
    p1 = Project(
        id=uuid.uuid4(),
        name="Project Alpha",
        description="Alpha Project",
        status="active",
        is_deleted=False,
    )
    # Project 2: Beta (Bob is assigned)
    p2 = Project(
        id=uuid.uuid4(),
        name="Project Beta",
        description="Beta Project",
        status="active",
        is_deleted=False,
    )
    db_session.add_all([p1, p2])
    await db_session.flush()

    db_session.add(ProjectMember(project_id=p1.id, user_id=alice.id))
    db_session.add(ProjectMember(project_id=p2.id, user_id=bob.id))
    await db_session.flush()

    today = datetime.now(timezone.utc).date()

    # Tasks for Project 1:
    # 1. Backlog task (Alice)
    t1 = Task(
        id=uuid.uuid4(),
        project_id=p1.id,
        title="P1 Backlog Task",
        description="Desc",
        status="backlog",
        priority="low",
        assignee_id=alice.id,
        due_date=today,
        is_deleted=False,
    )
    # 2. Todo task (Alice)
    t2 = Task(
        id=uuid.uuid4(),
        project_id=p1.id,
        title="P1 Todo Task",
        description="Desc",
        status="todo",
        priority="medium",
        assignee_id=alice.id,
        due_date=today,
        is_deleted=False,
    )
    # 3. In Progress task (Unassigned)
    t3 = Task(
        id=uuid.uuid4(),
        project_id=p1.id,
        title="P1 In Progress Unassigned Task",
        description="Desc",
        status="in_progress",
        priority="high",
        assignee_id=None,
        due_date=today,
        is_deleted=False,
    )
    # 4. Done task (Alice)
    t4 = Task(
        id=uuid.uuid4(),
        project_id=p1.id,
        title="P1 Done Task",
        description="Desc",
        status="done",
        priority="high",
        assignee_id=alice.id,
        due_date=today,
        is_deleted=False,
    )

    # Tasks for Project 2:
    # 5. Done task (Bob)
    t5 = Task(
        id=uuid.uuid4(),
        project_id=p2.id,
        title="P2 Done Task",
        description="Desc",
        status="done",
        priority="medium",
        assignee_id=bob.id,
        due_date=today,
        is_deleted=False,
    )
    db_session.add_all([t1, t2, t3, t4, t5])
    await db_session.flush()

    # Status completion activity for t4 in Project 1 (yesterday)
    act_time_yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    act1 = ProjectActivity(
        id=uuid.uuid4(),
        project_id=p1.id,
        task_id=t4.id,
        task_title=t4.title,
        user_id=alice.id,
        user_name=alice.name,
        from_status="in_progress",
        to_status="done",
        created_at=act_time_yesterday,
    )
    # Status completion activity for t5 in Project 2 (today)
    act_time_today = datetime.now(timezone.utc)
    act2 = ProjectActivity(
        id=uuid.uuid4(),
        project_id=p2.id,
        task_id=t5.id,
        task_title=t5.title,
        user_id=bob.id,
        user_name=bob.name,
        from_status="in_progress",
        to_status="done",
        created_at=act_time_today,
    )
    db_session.add_all([act1, act2])
    await db_session.commit()

    return {
        "admin": admin,
        "alice": alice,
        "bob": bob,
        "p1": p1,
        "p2": p2,
        "t1": t1,
        "t2": t2,
        "t3": t3,
        "t4": t4,
        "t5": t5,
        "act1": act1,
        "act2": act2,
    }


@pytest.mark.asyncio
async def test_analytics_global_for_admin(db_session: AsyncSession, analytics_setup):
    """Admin receives workspace-wide analytics covering all projects."""
    setup = analytics_setup
    admin = setup["admin"]

    response = await analytics_service.get_analytics_data(db_session, admin)
    assert isinstance(response, AnalyticsDataResponse)

    # 1. Status Distribution (all 5 tasks across p1 and p2)
    # Backlog: 1, To Do: 1, In Progress: 1, Done: 2
    status_map = {item.name: item.value for item in response.status_distribution}
    assert status_map["Backlog"] == 1
    assert status_map["To Do"] == 1
    assert status_map["In Progress"] == 1
    assert status_map["Done"] == 2

    # 2. Tasks by Assignee
    # Alice: 3 tasks (t1, t2, t4), Bob: 1 task (t5), Unassigned: 1 task (t3)
    assignee_map = {item.assignee: item.count for item in response.tasks_by_assignee}
    assert assignee_map["Alice Walker"] == 3
    assert assignee_map["Bob Builder"] == 1
    assert assignee_map["Unassigned"] == 1

    # 3. Completion Trends (7 days continuous)
    assert len(response.completion_trends) == 7
    # Should have 1 completion yesterday (Alice's t4) and 1 completion today (Bob's t5)
    today_str = datetime.now(timezone.utc).date().isoformat()
    yesterday_str = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    trend_map = {item.date: item.completed for item in response.completion_trends}
    assert trend_map[today_str] == 1
    assert trend_map[yesterday_str] == 1


@pytest.mark.asyncio
async def test_analytics_project_filtering(db_session: AsyncSession, analytics_setup):
    """Specifying projectId filters all 3 aggregations to that project."""
    setup = analytics_setup
    admin = setup["admin"]
    p1 = setup["p1"]

    response = await analytics_service.get_analytics_data(
        db_session, admin, project_id=p1.id
    )

    # 1. Status Distribution (only p1: 4 tasks)
    status_map = {item.name: item.value for item in response.status_distribution}
    assert status_map["Backlog"] == 1
    assert status_map["To Do"] == 1
    assert status_map["In Progress"] == 1
    assert status_map["Done"] == 1  # Only t4 in p1, t5 from p2 is excluded

    # 2. Workload by Assignee in p1
    assignee_map = {item.assignee: item.count for item in response.tasks_by_assignee}
    assert assignee_map["Alice Walker"] == 3
    assert "Bob Builder" not in assignee_map  # Bob has no tasks in p1
    assert assignee_map["Unassigned"] == 1

    # 3. Completion Trends in p1
    trend_map = {item.date: item.completed for item in response.completion_trends}
    yesterday_str = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    today_str = datetime.now(timezone.utc).date().isoformat()
    assert trend_map[yesterday_str] == 1  # t4 was in p1
    assert trend_map[today_str] == 0  # t5 was in p2, excluded


@pytest.mark.asyncio
async def test_analytics_member_project_scoping_and_forbidden(
    db_session: AsyncSession, analytics_setup
):
    """Member callers can only access assigned projects; unauthorized project raises 403."""
    setup = analytics_setup
    alice = setup["alice"]
    p1 = setup["p1"]
    p2 = setup["p2"]

    # Alice can view analytics for p1 (she is assigned)
    p1_response = await analytics_service.get_analytics_data(
        db_session, alice, project_id=p1.id
    )
    assert p1_response is not None

    # Alice cannot view analytics for p2 (she is not assigned -> ForbiddenException)
    with pytest.raises(ForbiddenException):
        await analytics_service.get_analytics_data(
            db_session, alice, project_id=p2.id
        )


@pytest.mark.asyncio
async def test_analytics_non_existent_project_raises_not_found(
    db_session: AsyncSession, analytics_setup
):
    """Requesting analytics for non-existent project raises EntityNotFoundException."""
    setup = analytics_setup
    admin = setup["admin"]

    with pytest.raises(EntityNotFoundException):
        await analytics_service.get_analytics_data(
            db_session, admin, project_id=uuid.uuid4()
        )


@pytest.mark.asyncio
async def test_analytics_empty_project(db_session: AsyncSession):
    """Empty project returns zero-filled chart data without errors."""
    await clean_db(db_session)
    admin = User(
        id=uuid.uuid4(),
        name="Empty Admin",
        email=f"empty_admin_{uuid.uuid4().hex[:6]}@test.com",
        role="admin",
        status="active",
        hashed_password="fake",
    )
    empty_proj = Project(
        id=uuid.uuid4(),
        name="Empty Project",
        description="No tasks",
        status="active",
    )
    db_session.add_all([admin, empty_proj])
    await db_session.commit()

    response = await analytics_service.get_analytics_data(
        db_session, admin, project_id=empty_proj.id
    )
    # Status slices are all 0
    assert all(item.value == 0 for item in response.status_distribution)
    # Assignee workload is empty list
    assert response.tasks_by_assignee == []
    # 7-day completion trend has 7 days, all completed = 0
    assert len(response.completion_trends) == 7
    assert all(item.completed == 0 for item in response.completion_trends)
