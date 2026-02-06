"""Initial database schema

Revision ID: 001
Revises: 
Create Date: 2025-11-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create extensions schema first
    op.execute('CREATE SCHEMA IF NOT EXISTS extensions')
    
    # Enable extensions in extensions schema
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions')
    # pgvector extension - handle gracefully if not available
    try:
        op.execute('CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions')
    except Exception:
        # Extension may already exist or not be available
        # This is handled by the init script
        pass
    
    # Create schemas
    op.execute('CREATE SCHEMA IF NOT EXISTS hyperagent')
    op.execute('CREATE SCHEMA IF NOT EXISTS audit')
    
    # Create workflow_status enum (with existence check using DO block)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE hyperagent.workflow_status AS ENUM (
                'created', 'nlp_parsing', 'generating', 'auditing',
                'testing', 'deploying', 'completed', 'failed', 'cancelled'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Create users table (with existence check)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names(schema='hyperagent')
    existing_indexes = [idx['name'] for idx in inspector.get_indexes('workflows', schema='hyperagent')] if 'workflows' in existing_tables else []
    existing_indexes.extend([idx['name'] for idx in inspector.get_indexes('users', schema='hyperagent')] if 'users' in existing_tables else [])
    
    if 'users' not in existing_tables:
        op.create_table(
            'users',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text('uuid_generate_v4()')),
            sa.Column('email', sa.String(255), nullable=False, unique=True),
            sa.Column('username', sa.String(100), unique=True),
            sa.Column('wallet_address', sa.String(42), unique=True),
            sa.Column('created_at', sa.DateTime(timezone=True),
                      server_default=sa.text('NOW()')),
            sa.Column('updated_at', sa.DateTime(timezone=True)),
            sa.Column('is_active', sa.Boolean(), default=True),
            schema='hyperagent'
        )
    
    # Create workflows table (with existence check)
    if 'workflows' not in existing_tables:
        op.create_table(
            'workflows',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text('uuid_generate_v4()')),
            sa.Column('user_id', postgresql.UUID(as_uuid=True),
                      sa.ForeignKey('hyperagent.users.id'), nullable=False),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('description', sa.Text()),
            sa.Column('status', sa.String(50), default='created'),
            sa.Column('progress_percentage', sa.Integer(), default=0),
            sa.Column('nlp_input', sa.Text(), nullable=False),
            sa.Column('nlp_tokens', sa.Integer()),
            sa.Column('network', sa.String(50), nullable=False),
            sa.Column('is_testnet', sa.Boolean(), default=True),
            sa.Column('created_at', sa.DateTime(timezone=True),
                      server_default=sa.text('NOW()')),
            sa.Column('updated_at', sa.DateTime(timezone=True)),
            sa.Column('completed_at', sa.DateTime(timezone=True)),
            sa.Column('error_message', sa.Text()),
            sa.Column('error_stacktrace', sa.Text()),
            sa.Column('retry_count', sa.Integer(), default=0),
            sa.Column('metadata', postgresql.JSONB(), default={}),
            schema='hyperagent'
        )
    
    # Create indexes (with existence check)
    if 'idx_workflows_user_id' not in existing_indexes:
        op.create_index('idx_workflows_user_id', 'workflows', ['user_id'],
                        schema='hyperagent')
    if 'idx_workflows_status' not in existing_indexes:
        op.create_index('idx_workflows_status', 'workflows', ['status'],
                        schema='hyperagent')
    if 'idx_users_email' not in existing_indexes:
        op.create_index('idx_users_email', 'users', ['email'],
                        schema='hyperagent')


def downgrade() -> None:
    op.drop_index('idx_workflows_status', table_name='workflows', schema='hyperagent')
    op.drop_index('idx_workflows_user_id', table_name='workflows', schema='hyperagent')
    op.drop_index('idx_users_email', table_name='users', schema='hyperagent')
    op.drop_table('workflows', schema='hyperagent')
    op.drop_table('users', schema='hyperagent')
    op.execute('DROP TYPE IF EXISTS hyperagent.workflow_status')

