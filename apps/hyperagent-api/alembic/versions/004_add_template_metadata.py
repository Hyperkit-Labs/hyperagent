"""Add template_metadata column to contract_templates

Revision ID: 004
Revises: 003
Create Date: 2025-11-16 13:30:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add template_metadata column if it doesn't exist
    op.add_column(
        'contract_templates',
        sa.Column('template_metadata', postgresql.JSONB),
        schema='hyperagent'
    )


def downgrade() -> None:
    op.drop_column('contract_templates', 'template_metadata', schema='hyperagent')

