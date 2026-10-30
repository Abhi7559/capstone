"""add_is_deleted_to_tasks

Revision ID: b9d4f21a8c3e
Revises: f0c675c67b39
Create Date: 2026-10-28 17:06:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b9d4f21a8c3e'
down_revision: Union[str, Sequence[str], None] = 'f0c675c67b39'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: add is_deleted column to tasks table."""
    op.add_column(
        'tasks',
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.create_index('ix_tasks_is_deleted', 'tasks', ['is_deleted'])


def downgrade() -> None:
    """Downgrade schema: remove is_deleted column from tasks table."""
    op.drop_index('ix_tasks_is_deleted', table_name='tasks')
    op.drop_column('tasks', 'is_deleted')
