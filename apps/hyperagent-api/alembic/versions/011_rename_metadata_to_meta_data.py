"""Rename metadata column to meta_data to avoid SQLAlchemy reserved name conflict

Revision ID: 011
Revises: 010
Create Date: 2026-01-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Rename 'metadata' columns to 'meta_data' to avoid SQLAlchemy reserved name conflict"""
    
    # Check if columns exist before renaming (for fresh installs)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # Rename metadata column in workflows table
    if 'workflows' in inspector.get_table_names(schema='hyperagent'):
        columns = [c['name'] for c in inspector.get_columns('workflows', schema='hyperagent')]
        if 'metadata' in columns:
            op.alter_column('workflows', 'metadata', new_column_name='meta_data', schema='hyperagent')
    
    # Rename metadata column in generated_contracts table
    if 'generated_contracts' in inspector.get_table_names(schema='hyperagent'):
        columns = [c['name'] for c in inspector.get_columns('generated_contracts', schema='hyperagent')]
        if 'metadata' in columns:
            op.alter_column('generated_contracts', 'metadata', new_column_name='meta_data', schema='hyperagent')
    
    # Rename metadata column in deployments table
    if 'deployments' in inspector.get_table_names(schema='hyperagent'):
        columns = [c['name'] for c in inspector.get_columns('deployments', schema='hyperagent')]
        if 'metadata' in columns:
            op.alter_column('deployments', 'metadata', new_column_name='meta_data', schema='hyperagent')
    
    # Rename metadata column in security_audits table
    if 'security_audits' in inspector.get_table_names(schema='hyperagent'):
        columns = [c['name'] for c in inspector.get_columns('security_audits', schema='hyperagent')]
        if 'metadata' in columns:
            op.alter_column('security_audits', 'metadata', new_column_name='meta_data', schema='hyperagent')
    
    # Rename metadata column in app_documents table
    if 'app_documents' in inspector.get_table_names(schema='hyperagent'):
        columns = [c['name'] for c in inspector.get_columns('app_documents', schema='hyperagent')]
        if 'metadata' in columns:
            op.alter_column('app_documents', 'metadata', new_column_name='meta_data', schema='hyperagent')


def downgrade() -> None:
    """Revert meta_data columns back to metadata"""
    
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # Revert meta_data column in workflows table
    if 'workflows' in inspector.get_table_names(schema='hyperagent'):
        columns = [c['name'] for c in inspector.get_columns('workflows', schema='hyperagent')]
        if 'meta_data' in columns:
            op.alter_column('workflows', 'meta_data', new_column_name='metadata', schema='hyperagent')
    
    # Revert meta_data column in generated_contracts table
    if 'generated_contracts' in inspector.get_table_names(schema='hyperagent'):
        columns = [c['name'] for c in inspector.get_columns('generated_contracts', schema='hyperagent')]
        if 'meta_data' in columns:
            op.alter_column('generated_contracts', 'meta_data', new_column_name='metadata', schema='hyperagent')
    
    # Revert meta_data column in deployments table
    if 'deployments' in inspector.get_table_names(schema='hyperagent'):
        columns = [c['name'] for c in inspector.get_columns('deployments', schema='hyperagent')]
        if 'meta_data' in columns:
            op.alter_column('deployments', 'meta_data', new_column_name='metadata', schema='hyperagent')
    
    # Revert meta_data column in security_audits table
    if 'security_audits' in inspector.get_table_names(schema='hyperagent'):
        columns = [c['name'] for c in inspector.get_columns('security_audits', schema='hyperagent')]
        if 'meta_data' in columns:
            op.alter_column('security_audits', 'meta_data', new_column_name='metadata', schema='hyperagent')
    
    # Revert meta_data column in app_documents table
    if 'app_documents' in inspector.get_table_names(schema='hyperagent'):
        columns = [c['name'] for c in inspector.get_columns('app_documents', schema='hyperagent')]
        if 'meta_data' in columns:
            op.alter_column('app_documents', 'meta_data', new_column_name='metadata', schema='hyperagent')

