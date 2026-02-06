"""Add contracts and deployments tables

Revision ID: 002
Revises: 001
Create Date: 2025-01-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check existing tables
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names(schema='hyperagent')
    
    # Create generated_contracts table
    if 'generated_contracts' not in existing_tables:
        op.create_table(
            'generated_contracts',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text('uuid_generate_v4()')),
            sa.Column('workflow_id', postgresql.UUID(as_uuid=True),
                      sa.ForeignKey('hyperagent.workflows.id'), nullable=False),
            sa.Column('contract_name', sa.String(255), nullable=False),
            sa.Column('contract_type', sa.String(50)),
            sa.Column('solidity_version', sa.String(20), default='0.8.27'),
            sa.Column('source_code', sa.Text(), nullable=False),
            sa.Column('source_code_hash', sa.String(66)),
            sa.Column('abi', postgresql.JSONB()),
            sa.Column('bytecode', sa.Text()),
            sa.Column('deployed_bytecode', sa.Text()),
            sa.Column('line_count', sa.Integer()),
            sa.Column('function_count', sa.Integer()),
            sa.Column('security_flags', postgresql.JSONB(), default={}),
            sa.Column('created_at', sa.DateTime(timezone=True),
                      server_default=sa.text('NOW()')),
            sa.Column('updated_at', sa.DateTime(timezone=True)),
            sa.Column('metadata', postgresql.JSONB(), default={}),
            schema='hyperagent'
        )
        
        # Create index on workflow_id
        op.create_index('idx_generated_contracts_workflow_id', 'generated_contracts',
                       ['workflow_id'], schema='hyperagent')
    
    # Create deployments table
    if 'deployments' not in existing_tables:
        op.create_table(
            'deployments',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text('uuid_generate_v4()')),
            sa.Column('contract_id', postgresql.UUID(as_uuid=True),
                      sa.ForeignKey('hyperagent.generated_contracts.id'), nullable=False),
            sa.Column('deployment_network', sa.String(50), nullable=False),
            sa.Column('is_testnet', sa.Boolean(), nullable=False),
            sa.Column('contract_address', sa.String(42), unique=True, nullable=False),
            sa.Column('deployer_address', sa.String(42), nullable=False),
            sa.Column('transaction_hash', sa.String(66), unique=True, nullable=False),
            sa.Column('gas_used', sa.BigInteger()),
            sa.Column('gas_price', sa.BigInteger()),
            sa.Column('total_cost_wei', sa.BigInteger()),
            sa.Column('deployment_status', sa.String(50), default='pending'),
            sa.Column('block_number', sa.BigInteger()),
            sa.Column('confirmation_blocks', sa.Integer(), default=0),
            sa.Column('deployed_at', sa.DateTime(timezone=True),
                      server_default=sa.text('NOW()')),
            sa.Column('confirmed_at', sa.DateTime(timezone=True)),
            sa.Column('eigenda_commitment', sa.String(256)),
            sa.Column('eigenda_batch_header', postgresql.JSONB()),
            sa.Column('metadata', postgresql.JSONB(), default={}),
            schema='hyperagent'
        )
        
        # Create indexes
        op.create_index('idx_deployments_contract_id', 'deployments',
                       ['contract_id'], schema='hyperagent')
        op.create_index('idx_deployments_contract_address', 'deployments',
                       ['contract_address'], schema='hyperagent')
        op.create_index('idx_deployments_transaction_hash', 'deployments',
                       ['transaction_hash'], schema='hyperagent')


def downgrade() -> None:
    # Drop tables in reverse order (deployments first due to foreign key)
    op.drop_table('deployments', schema='hyperagent')
    op.drop_table('generated_contracts', schema='hyperagent')

