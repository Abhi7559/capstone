from datetime import date
from typing import List, Optional, Union
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies.auth import get_current_user
from dependencies.db import get_db
from models.user import User
from schemas.task_schema import TaskCreate, TaskUpdate, TaskOut, PaginatedTasksResponse, TaskDeleteResponse
from services.task_service import task_service

router = APIRouter()


# ============================================================================
# API 12: List Tasks (with QA.md Pagination & Multi-filtering)
# ============================================================================
@router.get(
    "",
    response_model=Union[PaginatedTasksResponse, List[TaskOut]],
    status_code=status.HTTP_200_OK,
    summary="List Tasks",
    description="Retrieves tasks accessible to the current user with pagination and optional filtering by project, status, assignee, or priority.",
)
async def list_tasks(
    page: Optional[int] = Query(None, ge=1, description="Page number (1-based)"),
    page_size: Optional[int] = Query(None, alias="pageSize", ge=1, le=100, description="Page size"),
    project_id: Optional[UUID] = Query(None, alias="projectId", description="Filter by project UUID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by task status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    assignee_id: Optional[UUID] = Query(None, alias="assigneeId", description="Filter by assignee UUID"),
    due_date: Optional[date] = Query(None, alias="dueDate", description="Filter by due date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Union[PaginatedTasksResponse, List[TaskOut]]:
    """
    List tasks accessible to the current user:
    - If `page` or `pageSize` is passed, returns QA.md standard paginated envelope:
      { items: [...], pagination: { totalItems, page, pageSize, totalPages, hasNextPage, hasPrevPage } }
    - Otherwise returns flat List[TaskOut] for frontend hooks and Kanban boards.
    """
    if page is not None or page_size is not None:
        effective_page = page or 1
        effective_page_size = page_size or 20
        return await task_service.get_paginated_tasks(
            db=db,
            current_user=current_user,
            page=effective_page,
            page_size=effective_page_size,
            project_id=project_id,
            status=status_filter,
            priority=priority,
            assignee_id=assignee_id,
            due_date=due_date,
        )

    return await task_service.get_tasks(
        db=db,
        current_user=current_user,
        project_id=project_id,
        status=status_filter,
        priority=priority,
        assignee_id=assignee_id,
        due_date=due_date,
    )


# ============================================================================
# API 13: Create Task
# ============================================================================
@router.post(
    "",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Task",
    description="Creates a task within a project, validates the assignee's project membership, and invalidates affected dashboard caches.",
)
async def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    """
    Creates a new task.
    - Validates project existence.
    - If assigneeId is provided, validates that the assignee is an active member of the project.
    - Emits cache invalidation on success.
    """
    return await task_service.create_task(
        db=db,
        task_in=payload,
        current_user=current_user,
    )


# ============================================================================
# API 14: Get Task Details
# ============================================================================
@router.get(
    "/{id}",
    response_model=TaskOut,
    status_code=status.HTTP_200_OK,
    summary="Get Task Details",
    description="Retrieves full task details by its UUID.",
)
async def get_task_by_id(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    """
    Retrieve task details by ID.
    - Admins can view any task.
    - Members can only view tasks belonging to their assigned projects.
    - Returns 404 if not found, 403 if unauthorized.
    """
    return await task_service.get_task_by_id(
        db=db,
        task_id=id,
        current_user=current_user,
    )


# ============================================================================
# API 15: Update Task
# ============================================================================
@router.patch(
    "/{id}",
    response_model=TaskOut,
    status_code=status.HTTP_200_OK,
    summary="Update Task",
    description="Partially updates task details. Changing status records a project activity and invalidates affected dashboard caches.",
)
async def update_task(
    id: UUID,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    """
    Partially update task:
    - Status changes automatically create an audit trail in ProjectActivity.
    - If assigneeId is provided, validates project membership.
    - Invalidates relevant Redis dashboard cache on success.
    """
    return await task_service.update_task(
        db=db,
        task_id=id,
        task_update=payload,
        current_user=current_user,
    )


# ============================================================================
# API 16: Delete Task 
# ============================================================================
@router.delete(
    "/{id}",
    response_model=TaskDeleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete Task",
    description="Deletes a task and its related activity records. Restricted to Admin users.",
)
async def delete_task(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskDeleteResponse:
    """
    Deletes a task.
    - Only workspace Admins are permitted to delete tasks (403 Forbidden for members).
    - Returns 404 Not Found if task does not exist.
    - Invalidates affected project dashboard cache.
    - Returns 200 OK with confirmation message.
    """
    await task_service.delete_task(
        db=db,
        task_id=id,
        current_user=current_user,
    )
    return TaskDeleteResponse(
        success=True,
        message="Task deleted successfully.",
    )
