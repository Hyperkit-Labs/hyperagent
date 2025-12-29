"""Add spending tracking columns to spending_controls

Revision ID: 20250122_spending_tracking
Revises: 
Create Date: 2025-01-22

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20250122_spending_tracking'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'spending_controls',
        sa.Column('daily_spent', sa.Float(), nullable=False, server_default='0.0'),
        schema='hyperagent'
    )
    op.add_column(
        'spending_controls',
        sa.Column('monthly_spent', sa.Float(), nullable=False, server_default='0.0'),
        schema='hyperagent'
    )
    op.add_column(
        'spending_controls',
        sa.Column('daily_reset_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema='hyperagent'
    )
    op.add_column(
        'spending_controls',
        sa.Column('monthly_reset_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema='hyperagent'
    )
    op.add_column(
        'spending_controls',
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        schema='hyperagent'
    )
    
    op.alter_column(
        'spending_controls',
        'daily_limit',
        existing_type=sa.Numeric(18, 8),
        type_=sa.Float(),
        nullable=False,
        server_default='10.0',
        schema='hyperagent'
    )
    op.alter_column(
        'spending_controls',
        'monthly_limit',
        existing_type=sa.Numeric(18, 8),
        type_=sa.Float(),
        nullable=False,
        server_default='100.0',
        schema='hyperagent'
    )


def downgrade():
    op.drop_column('spending_controls', 'is_active', schema='hyperagent')
    op.drop_column('spending_controls', 'monthly_reset_at', schema='hyperagent')
    op.drop_column('spending_controls', 'daily_reset_at', schema='hyperagent')
    op.drop_column('spending_controls', 'monthly_spent', schema='hyperagent')
    op.drop_column('spending_controls', 'daily_spent', schema='hyperagent')
    
    op.alter_column(
        'spending_controls',
        'daily_limit',
        existing_type=sa.Float(),
        type_=sa.Numeric(18, 8),
        nullable=True,
        server_default=None,
        schema='hyperagent'
    )
    op.alter_column(
        'spending_controls',
        'monthly_limit',
        existing_type=sa.Float(),
        type_=sa.Numeric(18, 8),
        nullable=True,
        server_default=None,
        schema='hyperagent'
    )

