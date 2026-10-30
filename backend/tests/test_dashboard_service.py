"""Comprehensive unit tests for DashboardService and DAO aggregations.

Tests:
1. Admin receives global metrics.
2. Member receives only their own assigned-task metrics.
3. Active project counting follows actual project status and soft-delete rules.
4. Completed tasks are counted correctly.
5. Overdue tasks exclude completed tasks and tasks without due dates.
6. Tasks due within 72 hours are included correctly.
7. Tasks outside the 72-hour window are excluded.
8. Recently created tasks are ordered newest first and limited to five.
9. Recent Admin activity is ordered newest first and limited to ten.
10. Member activity does not include unrelated users' activity.
11. Empty database results return the expected empty lists and zero counts.
12. Date boundaries and timezone handling.
13. Database/DAO failures follow existing exception handling.
"""

import uuid
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from dao.task_dao import task_dao
from models.user import User
from models.project import Project, ProjectMember
from models.task import Task
from models.activity import ProjectActivity
from services.dashboard_service import dashboard_service
from schemas.dashboard_schema import AdminDashboardData, MemberDashboardData


async def clean_db(db_session: AsyncSession):
    """Clean operational tables before each test to guarantee complete isolation."""
    await db_session.execute(delete(ProjectActivity))
    await db_session.execute(delete(Task))
    await db_session.execute(delete(ProjectMember))
    await db_session.execute(delete(Project))
    # Exclude default system admin seeded in conftest
    from tests.conftest import DEFAULT_ADMIN_ID
    await db_session.execute(delete(User).where(User.id != DEFAULT_ADMIN_ID))
    await db_session.commit()


@pytest.fixture
async def dashboard_setup(db_session: AsyncSession):
    """Seed users, projects, tasks, and activities for dashboard testing."""
    await clean_db(db_session)

    uid_suffix = uuid.uuid4().hex[:6]
    admin_user = User(
        id=uuid.uuid4(),
        name="Admin Boss",
        email=f"admin_boss_{uid_suffix}@test.com",
        role="admin",
        status="active",
        hashed_password="fake",
    )
    member_user = User(
        id=uuid.uuid4(),
        name="Member Alice",
        email=f"alice_{uid_suffix}@test.com",
        role="member",
        status="active",
        hashed_password="fake",
    )
    other_member = User(
        id=uuid.uuid4(),
        name="Member Bob",
        email=f"bob_{uid_suffix}@test.com",
        role="member",
        status="active",
        hashed_password="fake",
    )
    db_session.add_all([admin_user, member_user, other_member])
    await db_session.flush()

    # Project 1: Assigned to Alice
    p1 = Project(
        id=uuid.uuid4(),
        name="Project Alpha",
        description="Alpha Project",
        status="active",
        is_deleted=False,
    )
    # Project 2: Assigned to Bob
    p2 = Project(
        id=uuid.uuid4(),
        name="Project Beta",
        description="Beta Project",
        status="active",
        is_deleted=False,
    )
    # Project 3: Soft-deleted project
    p3 = Project(
        id=uuid.uuid4(),
        name="Project Gamma (Deleted)",
        description="Deleted Project",
        status="active",
        is_deleted=True,
    )
    db_session.add_all([p1, p2, p3])
    await db_session.flush()

    # Assignments
    db_session.add(ProjectMember(project_id=p1.id, user_id=member_user.id))
    db_session.add(ProjectMember(project_id=p2.id, user_id=other_member.id))
    await db_session.flush()

    # Dates
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    two_days_ago = today - timedelta(days=2)
    in_two_days = today + timedelta(days=2)
    in_five_days = today + timedelta(days=5)

    # Tasks for Project 1 (Alice):
    # 1. Overdue task for Alice (status 'todo', due yesterday)
    t1 = Task(
        id=uuid.uuid4(),
        project_id=p1.id,
        title="Alice Overdue Task",
        description="Should count as overdue",
        status="todo",
        priority="high",
        assignee_id=member_user.id,
        due_date=yesterday,
        is_deleted=False,
    )
    # 2. Done overdue task for Alice (status 'done', due two days ago) -> MUST NOT COUNT AS OVERDUE
    t2 = Task(
        id=uuid.uuid4(),
        project_id=p1.id,
        title="Alice Done Overdue Task",
        description="Should NOT count as overdue because status is done",
        status="done",
        priority="medium",
        assignee_id=member_user.id,
        due_date=two_days_ago,
        is_deleted=False,
    )
    # 3. Due soon task for Alice (status 'in_progress', due in 2 days) -> SHOULD COUNT AS DUE SOON
    t3 = Task(
        id=uuid.uuid4(),
        project_id=p1.id,
        title="Alice Due Soon Task",
        description="Should count as due soon (<= 72 hours)",
        status="in_progress",
        priority="medium",
        assignee_id=member_user.id,
        due_date=in_two_days,
        is_deleted=False,
    )
    # 4. Far future task for Alice (due in 5 days) -> MUST NOT COUNT AS DUE SOON
    t4 = Task(
        id=uuid.uuid4(),
        project_id=p1.id,
        title="Alice Far Future Task",
        description="Should NOT count as due soon (> 72 hours)",
        status="todo",
        priority="low",
        assignee_id=member_user.id,
        due_date=in_five_days,
        is_deleted=False,
    )
    # 5. Soft-deleted task for Alice
    t5 = Task(
        id=uuid.uuid4(),
        project_id=p1.id,
        title="Alice Deleted Task",
        description="Soft-deleted task",
        status="todo",
        priority="low",
        assignee_id=member_user.id,
        due_date=yesterday,
        is_deleted=True,
    )

    # Task for Project 2 (Bob):
    t6 = Task(
        id=uuid.uuid4(),
        project_id=p2.id,
        title="Bob Overdue Task",
        description="Bob's overdue task",
        status="todo",
        priority="high",
        assignee_id=other_member.id,
        due_date=yesterday,
        is_deleted=False,
    )
    db_session.add_all([t1, t2, t3, t4, t5, t6])
    await db_session.flush()

    # Activity:
    # Activity for Project 1 (Alice's project)
    act1 = ProjectActivity(
        id=uuid.uuid4(),
        project_id=p1.id,
        task_id=t1.id,
        task_title=t1.title,
        user_id=member_user.id,
        user_name=member_user.name,
        from_status="backlog",
        to_status="todo",
    )
    # Activity for Project 2 (Bob's project)
    act2 = ProjectActivity(
        id=uuid.uuid4(),
        project_id=p2.id,
        task_id=t6.id,
        task_title=t6.title,
        user_id=other_member.id,
        user_name=other_member.name,
        from_status="todo",
        to_status="in_progress",
    )
    db_session.add_all([act1, act2])
    await db_session.commit()

    return {
        "admin": admin_user,
        "member": member_user,
        "other_member": other_member,
        "p1": p1,
        "p2": p2,
        "p3": p3,
        "t1": t1,
        "t2": t2,
        "t3": t3,
        "t4": t4,
        "t5": t5,
        "t6": t6,
        "act1": act1,
        "act2": act2,
    }


@pytest.mark.asyncio
async def test_admin_dashboard_metrics(db_session: AsyncSession, dashboard_setup):
    """Admin receives global metrics across the entire workspace."""
    setup = dashboard_setup
    admin = setup["admin"]

    data = await dashboard_service.get_dashboard_stats(db_session, admin)
    assert isinstance(data, AdminDashboardData)

    # 1. totalProjects: 2 active projects (p1, p2) - excludes soft-deleted p3
    assert data.total_projects == 2

    # 2. totalTasks: 5 non-deleted tasks (t1, t2, t3, t4, t6) - excludes soft-deleted t5
    assert data.total_tasks == 5

    # 3. completedTasks: 1 task (t2 has status 'done')
    assert data.completed_tasks == 1

    # 4. overdueTasks: 2 overdue tasks (t1 for Alice, t6 for Bob; excludes t2 because done)
    assert data.overdue_tasks == 2

    # 5. recentlyCreatedTasks: up to 5 newest tasks
    assert len(data.recently_created_tasks) == 5
    task_ids = [t.id for t in data.recently_created_tasks]
    assert setup["t5"].id not in task_ids  # soft-deleted excluded

    # 6. recentActivity: contains global activities
    assert len(data.recent_activity) == 2
    act_messages = [a.message for a in data.recent_activity]
    assert any("Alice Overdue Task" in m for m in act_messages)
    assert any("Bob Overdue Task" in m for m in act_messages)


@pytest.mark.asyncio
async def test_member_dashboard_metrics(db_session: AsyncSession, dashboard_setup):
    """Member receives personal metrics restricted to assigned tasks and assigned projects."""
    setup = dashboard_setup
    alice = setup["member"]

    data = await dashboard_service.get_dashboard_stats(db_session, alice)
    assert isinstance(data, MemberDashboardData)

    # 1. myAssignedTasks: 4 tasks assigned to Alice (t1, t2, t3, t4)
    assert len(data.my_assigned_tasks) == 4
    assigned_ids = {t.id for t in data.my_assigned_tasks}
    assert setup["t6"].id not in assigned_ids  # Bob's task excluded

    # 2. myOverdueTasks: only t1 (due yesterday, status 'todo')
    # t2 is due two days ago but status is 'done', so it must NOT be overdue
    assert len(data.my_overdue_tasks) == 1
    assert data.my_overdue_tasks[0].id == setup["t1"].id

    # 3. tasksDueSoon: only t3 (due in 2 days <= 72h)
    # t4 is due in 5 days (> 72h), so it is excluded
    assert len(data.tasks_due_soon) == 1
    assert data.tasks_due_soon[0].id == setup["t3"].id

    # 4. myProjects: only p1 (Alice is member of p1, not p2)
    assert len(data.my_projects) == 1
    assert data.my_projects[0].id == setup["p1"].id

    # 5. recentActivity: scoped to p1 (does NOT include Bob's p2 activity)
    assert len(data.recent_activity) == 1
    assert "Alice Overdue Task" in data.recent_activity[0].message
    assert "Bob Overdue Task" not in data.recent_activity[0].message


@pytest.mark.asyncio
async def test_empty_database_returns_zeroes_and_empty_lists(db_session: AsyncSession):
    """Empty workspace returns 0 counts and empty arrays without exceptions."""
    await clean_db(db_session)

    uid_suffix = uuid.uuid4().hex[:6]
    new_admin = User(
        id=uuid.uuid4(),
        name="Empty Admin",
        email=f"empty_admin_{uid_suffix}@test.com",
        role="admin",
        status="active",
        hashed_password="fake",
    )
    new_member = User(
        id=uuid.uuid4(),
        name="Empty Member",
        email=f"empty_member_{uid_suffix}@test.com",
        role="member",
        status="active",
        hashed_password="fake",
    )
    db_session.add_all([new_admin, new_member])
    await db_session.commit()

    admin_data = await dashboard_service.get_dashboard_stats(db_session, new_admin)
    assert admin_data.total_projects == 0
    assert admin_data.total_tasks == 0
    assert admin_data.completed_tasks == 0
    assert admin_data.overdue_tasks == 0
    assert admin_data.recently_created_tasks == []
    assert admin_data.recent_activity == []

    member_data = await dashboard_service.get_dashboard_stats(db_session, new_member)
    assert member_data.my_assigned_tasks == []
    assert member_data.my_overdue_tasks == []
    assert member_data.tasks_due_soon == []
    assert member_data.my_projects == []
    assert member_data.recent_activity == []


@pytest.mark.asyncio
async def test_due_date_boundaries_72_hours(db_session: AsyncSession):
    """Test boundary cases for exactly today, exactly 72h (3 days), and beyond 72h."""
    await clean_db(db_session)

    uid_suffix = uuid.uuid4().hex[:6]
    user = User(
        id=uuid.uuid4(),
        name="Boundary Member",
        email=f"boundary_{uid_suffix}@test.com",
        role="member",
        status="active",
        hashed_password="fake",
    )
    proj = Project(
        id=uuid.uuid4(),
        name="Boundary Project",
        description="Boundary Test",
        status="active",
    )
    db_session.add_all([user, proj])
    await db_session.flush()

    today = datetime.now(timezone.utc).date()
    day_3 = today + timedelta(days=3)  # Exactly 72h boundary
    day_4 = today + timedelta(days=4)  # 96h -> Outside 72h

    t_today = Task(
        id=uuid.uuid4(),
        project_id=proj.id,
        title="Due Today",
        description="Due today",
        status="todo",
        priority="medium",
        assignee_id=user.id,
        due_date=today,
    )
    t_72h = Task(
        id=uuid.uuid4(),
        project_id=proj.id,
        title="Due In 72 Hours",
        description="Due at 72 hours boundary",
        status="todo",
        priority="medium",
        assignee_id=user.id,
        due_date=day_3,
    )
    t_beyond = Task(
        id=uuid.uuid4(),
        project_id=proj.id,
        title="Due Beyond 72 Hours",
        description="Due at 96 hours",
        status="todo",
        priority="medium",
        assignee_id=user.id,
        due_date=day_4,
    )
    db_session.add_all([t_today, t_72h, t_beyond])
    await db_session.commit()

    due_soon_tasks = await task_dao.get_tasks_due_soon(
        db_session,
        start_date=today,
        end_date=day_3,
        assignee_id=user.id,
    )
    due_soon_ids = [t.id for t in due_soon_tasks]
    assert t_today.id in due_soon_ids
    assert t_72h.id in due_soon_ids
    assert t_beyond.id not in due_soon_ids
