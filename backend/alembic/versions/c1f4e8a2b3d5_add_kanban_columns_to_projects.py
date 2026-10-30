"""add_kanban_columns_to_projects

Revision ID: c1f4e8a2b3d5
Revises: b9d4f21a8c3e
Create Date: 2026-10-30 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c1f4e8a2b3d5'
down_revision: Union[str, Sequence[str], None] = 'b9d4f21a8c3e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop leftover extra table kanban_columns if it exists
    op.execute("DROP TABLE IF EXISTS kanban_columns CASCADE")

    # Safely add kanban_columns JSONB column to projects table if not already present
    op.execute(
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS kanban_columns JSONB DEFAULT '[]'::jsonb"
    )


def downgrade() -> None:
    op.drop_column('projects', 'kanban_columns')

