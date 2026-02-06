"""Add task selection to workflows table

Revision ID: 20250123_add_task_selection
Revises: 20250122_spending_tracking
Create Date: 2025-01-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250123_add_task_selection'
down_revision = '20250122_spending_tracking'  # Update to latest revision
depends_on = None


def upgrade():
    # Add selected_tasks JSON column
    op.add_column(
        'workflows',
        sa.Column('selected_tasks', postgresql.JSON, nullable=True),
        schema='hyperagent'
    )
    
    # Add cost_breakdown JSON column
    op.add_column(
        'workflows',
        sa.Column('cost_breakdown', postgresql.JSON, nullable=True),
        schema='hyperagent'
    )
    
    # Add payment_amount_usdc FLOAT column
    op.add_column(
        'workflows',
        sa.Column('payment_amount_usdc', sa.Float, nullable=True),
        schema='hyperagent'
    )


def downgrade():
    # Remove columns in reverse order
    op.drop_column('workflows', 'payment_amount_usdc', schema='hyperagent')
    op.drop_column('workflows', 'cost_breakdown', schema='hyperagent')
    op.drop_column('workflows', 'selected_tasks', schema='hyperagent')

