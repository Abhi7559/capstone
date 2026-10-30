import uuid
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies.auth import get_current_user, require_role
from dependencies.db import get_db
from models.user import User
from schemas.project_schema import (
    ProjectCreate,
    ProjectUpdate,
    ProjectOut,
    ProjectDeleteResponse,
    PaginatedProjectsResponse,
)
from schemas.task_schema import ProjectActivityOut
from schemas.column_schema import ColumnCreate, ColumnOut, ColumnReorder
from services.project_service import project_service
from services.task_service import task_service
from services.column_service import column_service

router = APIRouter()


# ============================================================================
# API 6: List Workspace Projects (with QA.md Pagination & Filtering support)
# ============================================================================
@router.get(
    "",
    response_model=Union[PaginatedProjectsResponse, List[ProjectOut]],
    status_code=status.HTTP_200_OK,
    summary="List Projects",
    description="Retrieve projects visible to the authenticated user. Supports pagination (page, pageSize) and filters (status, category, search).",
)
async def list_projects(
    page: Optional[int] = Query(None, ge=1, description="Page number (1-based)"),
    page_size: Optional[int] = Query(None, alias="pageSize", ge=1, le=100, description="Page size"),
    status_filter: Optional[str] = Query(None, alias="status", description="Project status filter"),
    category: Optional[str] = Query(None, description="Project category filter"),
    search: Optional[str] = Query(None, description="Search by project name"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Union[PaginatedProjectsResponse, List[ProjectOut]]:
    """
    Get projects for the current user based on role:
    - If `page` or `pageSize` is passed, returns QA.md paginated envelope:
      { items: [...], pagination: { totalItems, page, pageSize, totalPages, hasNextPage, hasPrevPage } }
    - Otherwise returns flat List[ProjectOut] preserving backward compatibility with frontend hooks.
    """
    if page is not None or page_size is not None:
        effective_page = page or 1
        effective_page_size = page_size or 12
        return await project_service.get_paginated_projects(
            db=db,
            current_user=current_user,
            page=effective_page,
            page_size=effective_page_size,
            status=status_filter,
            category=category,
            search=search,
        )

    return await project_service.get_projects(
        db=db,
        current_user=current_user,
        status=status_filter,
        category=category,
        search=search,
    )


# ============================================================================
# API 8: Create Project (Admin Only)
# ============================================================================
@router.post(
    "",
    response_model=ProjectOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Project",
    description="Creates a new project and assigns members. Restricted to Admin users.",
)
async def create_project(
    project_in: ProjectCreate,
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> ProjectOut:
    """
    Create a new project:
    - Admin only (enforced via require_role and service layer).
    - Validates member IDs and date ordering.
    - Returns 201 Created with full project details.
    """
    return await project_service.create_project(
        db=db, project_in=project_in, current_user=current_admin
    )


# ============================================================================
# API 9: Get Project by ID
# ============================================================================
@router.get(
    "/{id}",
    response_model=ProjectOut,
    status_code=status.HTTP_200_OK,
    summary="Get Project Details",
    description="Retrieve project details by ID. Accessible to Admin or assigned project members.",
)
async def get_project_by_id(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectOut:
    """
    Get single project details:
    - Admin: Can view any project in workspace.
    - Member: Can only view if assigned to the project.
    - Returns 404 if project does not exist.
    - Returns 403 if member is not assigned.
    """
    return await project_service.get_project_by_id(
        db=db, project_id=id, current_user=current_user
    )


# ============================================================================
# API 9: Update Project (Admin Only)
# ============================================================================
@router.patch(
    "/{id}",
    response_model=ProjectOut,
    status_code=status.HTTP_200_OK,
    summary="Update Project",
    description="Partially updates project details, status, or member assignments. Restricted to Admin users.",
)
async def update_project(
    id: uuid.UUID,
    project_in: ProjectUpdate,
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> ProjectOut:
    """
    Update project details:
    - Admin only (enforced via require_role and service).
    - Preserves unprovided fields.
    - Validates cross-field dates.
    - Handles archive/restore lifecycle and tracks previousStatus.
    - Synchronizes member assignments if memberIds is passed.
    """
    return await project_service.update_project(
        db=db,
        project_id=id,
        project_in=project_in,
        current_user=current_admin,
    )


# ============================================================================
# API 10: Delete Project (Admin Only)
# ============================================================================
@router.delete(
    "/{id}",
    response_model=ProjectDeleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete Project",
    description="Deletes a project and cascades removal to linked tasks and memberships. Restricted to Admin users.",
)
async def delete_project(
    id: uuid.UUID,
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> ProjectDeleteResponse:
    """
    Delete a project:
    - Admin only.
    - Cascades to project_members, tasks, and activities via DB foreign keys.
    - Returns 200 OK with success confirmation.
    """
    await project_service.delete_project(
        db=db, project_id=id, current_user=current_admin
    )
    return ProjectDeleteResponse(
        success=True,
        message="Project deleted successfully.",
    )


# ============================================================================
# API 11: Get Project Activities
# ============================================================================
@router.get(
    "/{id}/activities",
    response_model=List[ProjectActivityOut],
    status_code=status.HTTP_200_OK,
    summary="Get Project Activities",
    description="Returns project activity records in descending creation-time order.",
)
async def get_project_activities(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ProjectActivityOut]:
    """
    Get activities for a project:
    - Accessible to Admins and assigned members of the project.
    - Returns 404 if project does not exist.
    - Returns 403 if member is not part of this project.
    """
    return await task_service.get_project_activities(
        db=db,
        project_id=id,
        current_user=current_user,
    )


# ============================================================================
# Dynamic Kanban Column Endpoints
# ============================================================================
@router.get(
    "/{id}/columns",
    response_model=List[ColumnOut],
    status_code=status.HTTP_200_OK,
    summary="Get Project Columns",
    description="Retrieve all Kanban columns configured for this project.",
)
async def get_columns(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ColumnOut]:
    cols = await column_service.get_project_columns(db=db, project_id=id, current_user=current_user)
    return [ColumnOut(**col) for col in cols]


@router.post(
    "/{id}/columns",
    response_model=ColumnOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Project Column",
    description="Add a new custom Kanban column to this project.",
)
async def create_column(
    id: uuid.UUID,
    payload: ColumnCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ColumnOut:
    col = await column_service.create_column(
        db=db, project_id=id, payload=payload, current_user=current_user
    )
    return ColumnOut(**col)


@router.put(
    "/{id}/columns/reorder",
    response_model=List[ColumnOut],
    status_code=status.HTTP_200_OK,
    summary="Reorder Project Columns",
    description="Reorder Kanban columns for a project. Admin only.",
)
async def reorder_columns(
    id: uuid.UUID,
    payload: ColumnReorder,
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> List[ColumnOut]:
    cols = await column_service.reorder_columns(
        db=db, project_id=id, column_ids=payload.column_ids, current_user=current_admin
    )
    return [ColumnOut(**col) for col in cols]


@router.delete(
    "/{id}/columns/{column_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Project Column",
    description="Delete a column and reassign all tasks in it to 'backlog'.",
)
async def delete_column(
    id: uuid.UUID,
    column_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await column_service.delete_column(
        db=db, project_id=id, column_id=column_id, current_user=current_user
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


