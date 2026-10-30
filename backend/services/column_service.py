import uuid
import re
from typing import List, Dict, Any
from sqlalchemy import update
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.ext.asyncio import AsyncSession
from models.project import Project
from models.task import Task
from models.user import User
from schemas.column_schema import ColumnCreate
from exceptions.domain import EntityNotFoundException, DuplicateEntityException

DEFAULT_COLUMNS = [
    {
        "id": "todo",
        "name": "TO DO",
        "slug": "todo",
        "order": 0,
        "color": "bg-slate-100 border-slate-300 text-slate-700",
    },
    {
        "id": "in_progress",
        "name": "IN PROGRESS",
        "slug": "in_progress",
        "order": 1,
        "color": "bg-blue-50 border-blue-200 text-blue-800",
    },
    {
        "id": "done",
        "name": "COMPLETED",
        "slug": "done",
        "order": 2,
        "color": "bg-green-50 border-green-200 text-green-800",
    },
]


def generate_slug(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", name.strip().lower()).strip("_")
    return slug or "column"


class ColumnService:
    async def get_project_columns(
        self, db: AsyncSession, project_id: uuid.UUID, current_user: User
    ) -> List[Dict[str, Any]]:
        project = await db.get(Project, project_id)
        if not project or project.is_deleted:
            raise EntityNotFoundException("Project", project_id)

        cols = project.kanban_columns
        if not cols:
            cols = [
                {
                    "id": def_col["id"],
                    "project_id": str(project_id),
                    "name": def_col["name"],
                    "slug": def_col["slug"],
                    "order": def_col["order"],
                    "color": def_col["color"],
                }
                for def_col in DEFAULT_COLUMNS
            ]
            project.kanban_columns = cols
            flag_modified(project, "kanban_columns")
            await db.commit()

        for col in cols:
            col["project_id"] = str(project_id)

        return sorted(cols, key=lambda c: c.get("order", 0))

    async def create_column(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        payload: ColumnCreate,
        current_user: User,
    ) -> Dict[str, Any]:
        project = await db.get(Project, project_id)
        if not project or project.is_deleted:
            raise EntityNotFoundException("Project", project_id)

        cols = await self.get_project_columns(db, project_id, current_user)
        trimmed_name = payload.name.strip().upper()
        slug = generate_slug(payload.name)

        for col in cols:
            if col["name"].lower() == trimmed_name.lower() or col["slug"] == slug:
                raise DuplicateEntityException("A column with this name or slug already exists in this project.")

        new_col = {
            "id": str(uuid.uuid4()),
            "project_id": str(project_id),
            "name": trimmed_name,
            "slug": slug,
            "order": len(cols),
            "color": payload.color or "bg-purple-50 border-purple-200 text-purple-800",
        }
        cols.append(new_col)
        project.kanban_columns = cols
        flag_modified(project, "kanban_columns")
        await db.commit()
        return new_col

    async def delete_column(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        column_id: str,
        current_user: User,
    ) -> None:
        project = await db.get(Project, project_id)
        if not project or project.is_deleted:
            raise EntityNotFoundException("Project", project_id)

        cols = await self.get_project_columns(db, project_id, current_user)
        col_to_delete = None
        remaining_cols = []

        for c in cols:
            if str(c.get("id")) == str(column_id) or c.get("slug") == str(column_id):
                col_to_delete = c
            else:
                remaining_cols.append(c)

        if not col_to_delete:
            raise EntityNotFoundException("Column", column_id)

        # Move tasks in this column to 'backlog'
        await db.execute(
            update(Task)
            .where(Task.project_id == project_id, Task.status == col_to_delete["slug"])
            .values(status="backlog")
        )

        for idx, col in enumerate(remaining_cols):
            col["order"] = idx

        project.kanban_columns = remaining_cols
        flag_modified(project, "kanban_columns")
        await db.commit()

    async def reorder_columns(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        column_ids: List[str],
        current_user: User,
    ) -> List[Dict[str, Any]]:
        project = await db.get(Project, project_id)
        if not project or project.is_deleted:
            raise EntityNotFoundException("Project", project_id)

        cols = await self.get_project_columns(db, project_id, current_user)
        col_map = {str(c["id"]): c for c in cols}

        new_cols = []
        for idx, cid in enumerate(column_ids):
            if cid in col_map:
                col_item = col_map[cid]
                col_item["order"] = idx
                new_cols.append(col_item)

        # Include any columns that were omitted
        for c in cols:
            if str(c["id"]) not in column_ids and c not in new_cols:
                c["order"] = len(new_cols)
                new_cols.append(c)

        project.kanban_columns = new_cols
        flag_modified(project, "kanban_columns")
        await db.commit()
        return new_cols


column_service = ColumnService()
