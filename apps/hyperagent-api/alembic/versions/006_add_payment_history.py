"""Add payment history table

Revision ID: 006
Revises: 005
Create Date: 2025-12-01 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'payment_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('wallet_address', sa.String(42), nullable=False),
        sa.Column('amount', sa.Numeric(18, 8), nullable=False),
        sa.Column('currency', sa.String(10), server_default='USDC'),
        sa.Column('merchant', sa.String(255), nullable=True),
        sa.Column('network', sa.String(50), nullable=False),
        sa.Column('endpoint', sa.String(255), nullable=True),
        sa.Column('transaction_hash', sa.String(66), nullable=True, unique=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('status', sa.String(20), server_default='completed'),
        schema='hyperagent'
    )
    op.create_index('idx_payment_history_wallet_address', 'payment_history', ['wallet_address'], schema='hyperagent')
    op.create_index('idx_payment_history_timestamp', 'payment_history', ['timestamp'], schema='hyperagent')
    op.create_index('idx_payment_history_merchant', 'payment_history', ['merchant'], schema='hyperagent')


def downgrade() -> None:
    op.drop_table('payment_history', schema='hyperagent')

