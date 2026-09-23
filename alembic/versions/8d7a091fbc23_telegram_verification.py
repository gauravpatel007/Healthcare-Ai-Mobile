"""Upgrade existing emergency contacts before the API and bot start.

Revision ID: 8d7a091fbc23
Revises: 5a81ec3787d2
"""
from alembic import op
from sqlalchemy import inspect

from migrate_telegram_verification import migrate

revision = "8d7a091fbc23"
down_revision = "5a81ec3787d2"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    # Fresh installations create model tables during API startup, including
    # users, which emergency_contacts references. Existing rows are preserved.
    if inspect(connection).has_table("emergency_contacts"):
        migrate(connection)


def downgrade():
    # Keep verification data when rolling back application code.
    pass
