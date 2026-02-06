"""Add contract templates table with pgvector support

Revision ID: 003
Revises: 002
Create Date: 2025-11-16 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create contract_templates table
    op.create_table(
        'contract_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('uuid_generate_v4()')),
        sa.Column('name', sa.String(255), nullable=False, unique=True),
        sa.Column('description', sa.Text()),
        sa.Column('contract_type', sa.String(50)),
        sa.Column('template_code', sa.Text(), nullable=False),
        sa.Column('ipfs_hash', sa.String(100), unique=True),
        sa.Column('embedding', Vector(1536)),  # pgvector for Gemini embeddings
        sa.Column('version', sa.String(20)),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('tags', postgresql.ARRAY(sa.String())),
        sa.Column('template_metadata', postgresql.JSONB),  # For version history and other metadata
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('NOW()')),
        schema='hyperagent'
    )
    
    # Create indexes
    op.create_index('idx_contract_templates_contract_type', 'contract_templates', 
                    ['contract_type'], schema='hyperagent')
    op.create_index('idx_contract_templates_is_active', 'contract_templates', 
                    ['is_active'], schema='hyperagent')
    op.create_index('idx_contract_templates_tags', 'contract_templates', 
                    ['tags'], schema='hyperagent', postgresql_using='gin')
    # Vector index for similarity search (pgvector)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_contract_templates_embedding 
        ON hyperagent.contract_templates 
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    """)


def downgrade() -> None:
    op.drop_index('idx_contract_templates_embedding', table_name='contract_templates', schema='hyperagent')
    op.drop_index('idx_contract_templates_tags', table_name='contract_templates', schema='hyperagent')
    op.drop_index('idx_contract_templates_is_active', table_name='contract_templates', schema='hyperagent')
    op.drop_index('idx_contract_templates_contract_type', table_name='contract_templates', schema='hyperagent')
    op.drop_table('contract_templates', schema='hyperagent')

