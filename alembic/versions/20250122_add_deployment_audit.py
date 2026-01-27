"""Add deployment audit table

Revision ID: 20250122_add_deployment_audit
Revises: 
Create Date: 2025-01-22 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250122_add_deployment_audit'
down_revision = '011'
depends_on = None


def upgrade():
    op.create_table(
        'deployment_audits',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('deployment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_wallet', sa.String(42), nullable=False),
        sa.Column('server_wallet', sa.String(42), nullable=True),
        sa.Column('deployment_method', sa.String(20), nullable=False),
        sa.Column('network', sa.String(50), nullable=False),
        sa.Column('payment_tx_hash', sa.String(66), nullable=True),
        sa.Column('deployment_tx_hash', sa.String(66), nullable=False),
        sa.Column('contract_address', sa.String(42), nullable=False),
        sa.Column('gas_used', sa.String(50), nullable=False),
        sa.Column('gas_paid_by_server', sa.String(50), nullable=False),
        sa.Column('gas_price_gwei', sa.String(50), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
    )
    
    # Create indexes
    op.create_index('ix_deployment_audits_deployment_id', 'deployment_audits', ['deployment_id'])
    op.create_index('ix_deployment_audits_user_wallet', 'deployment_audits', ['user_wallet'])
    op.create_index('ix_deployment_audits_network', 'deployment_audits', ['network'])
    op.create_index('ix_deployment_audits_deployment_tx_hash', 'deployment_audits', ['deployment_tx_hash'])
    op.create_index('ix_deployment_audits_contract_address', 'deployment_audits', ['contract_address'])
    op.create_index('ix_deployment_audits_timestamp', 'deployment_audits', ['timestamp'])
    
    # Add unique constraint on deployment_tx_hash
    op.create_unique_constraint(
        'uq_deployment_audits_deployment_tx_hash',
        'deployment_audits',
        ['deployment_tx_hash']
    )


def downgrade():
    op.drop_table('deployment_audits')

