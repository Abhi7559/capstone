"""add_is_deleted_to_projects

Revision ID: f0c675c67b39
Revises: cd58aa660a95
Create Date: 2026-10-27 17:31:08.721261

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f0c675c67b39'
down_revision: Union[str, Sequence[str], None] = 'cd58aa660a95'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: add is_deleted column to projects table."""
    op.add_column(
        'projects',
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.create_index('ix_projects_is_deleted', 'projects', ['is_deleted'])


def downgrade() -> None:
    """Downgrade schema: remove is_deleted column from projects table."""
    op.drop_index('ix_projects_is_deleted', table_name='projects')
    op.drop_column('projects', 'is_deleted')
