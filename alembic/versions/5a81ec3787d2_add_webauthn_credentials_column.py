"""Add webauthn_credentials column

Revision ID: 5a81ec3787d2
Revises: 
Create Date: 2026-09-06 23:50:00.586204
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5a81ec3787d2'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('webauthn_credentials', sa.JSON(), server_default='[]', nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'webauthn_credentials')
