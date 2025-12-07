"""Add spending controls table

Revision ID: 005
Revises: 004
Create Date: 2025-12-01 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'spending_controls',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('wallet_address', sa.String(42), nullable=False, unique=True),
        sa.Column('daily_limit', sa.Numeric(18, 8), nullable=True),
        sa.Column('monthly_limit', sa.Numeric(18, 8), nullable=True),
        sa.Column('whitelist_merchants', postgresql.ARRAY(sa.String), nullable=True),
        sa.Column('time_restrictions', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        schema='hyperagent'
    )
    op.create_index('idx_spending_controls_wallet_address', 'spending_controls', ['wallet_address'], schema='hyperagent')


def downgrade() -> None:
    op.drop_table('spending_controls', schema='hyperagent')

