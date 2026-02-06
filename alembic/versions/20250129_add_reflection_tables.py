"""Add reflection tables for learning from workflow outcomes

Revision ID: 20250129_add_reflection_tables
Revises: 20250123_add_task_selection
Create Date: 2025-01-29 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250129_add_reflection_tables'
down_revision = '20250123_add_task_selection'
depends_on = None


def upgrade():
    # Create workflow_reflections table
    op.create_table(
        'workflow_reflections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workflow_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('outcome', sa.String(50), nullable=False),  # success, failure, capability_exceeded
        sa.Column('root_causes', postgresql.ARRAY(sa.String), nullable=True),
        sa.Column('patterns_identified', postgresql.ARRAY(sa.String), nullable=True),
        sa.Column('lessons_learned', postgresql.ARRAY(sa.String), nullable=True),
        sa.Column('improvement_suggestions', postgresql.ARRAY(sa.String), nullable=True),
        sa.Column('error_categories', postgresql.ARRAY(sa.String), nullable=True),
        sa.Column('fix_effectiveness', sa.Float, nullable=True),
        sa.Column('confidence_score', sa.Float, nullable=False, server_default='0.5'),
        sa.Column('reflection_data', postgresql.JSONB, nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema='hyperagent',
    )
    
    # Create indexes for workflow_reflections
    op.create_index(
        'idx_workflow_reflections_workflow_id',
        'workflow_reflections',
        ['workflow_id'],
        schema='hyperagent',
    )
    op.create_index(
        'idx_workflow_reflections_outcome',
        'workflow_reflections',
        ['outcome'],
        schema='hyperagent',
    )
    op.create_index(
        'idx_workflow_reflections_created_at',
        'workflow_reflections',
        ['created_at'],
        schema='hyperagent',
    )
    
    # Create long_term_memories table
    op.create_table(
        'long_term_memories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('memory_type', sa.String(50), nullable=False),  # success_pattern, failure_pattern, fix_strategy, etc.
        sa.Column('workflow_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('pattern_data', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('tags', postgresql.ARRAY(sa.String), nullable=True),
        sa.Column('effectiveness_score', sa.Float, nullable=True),
        sa.Column('usage_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
        schema='hyperagent',
    )
    
    # Create indexes for long_term_memories
    op.create_index(
        'idx_long_term_memories_memory_type',
        'long_term_memories',
        ['memory_type'],
        schema='hyperagent',
    )
    op.create_index(
        'idx_long_term_memories_workflow_id',
        'long_term_memories',
        ['workflow_id'],
        schema='hyperagent',
    )
    op.create_index(
        'idx_long_term_memories_tags',
        'long_term_memories',
        ['tags'],
        schema='hyperagent',
        postgresql_using='gin',
    )
    op.create_index(
        'idx_long_term_memories_effectiveness',
        'long_term_memories',
        ['effectiveness_score'],
        schema='hyperagent',
    )


def downgrade():
    # Drop indexes
    op.drop_index('idx_long_term_memories_effectiveness', table_name='long_term_memories', schema='hyperagent')
    op.drop_index('idx_long_term_memories_tags', table_name='long_term_memories', schema='hyperagent')
    op.drop_index('idx_long_term_memories_workflow_id', table_name='long_term_memories', schema='hyperagent')
    op.drop_index('idx_long_term_memories_memory_type', table_name='long_term_memories', schema='hyperagent')
    op.drop_index('idx_workflow_reflections_created_at', table_name='workflow_reflections', schema='hyperagent')
    op.drop_index('idx_workflow_reflections_outcome', table_name='workflow_reflections', schema='hyperagent')
    op.drop_index('idx_workflow_reflections_workflow_id', table_name='workflow_reflections', schema='hyperagent')
    
    # Drop tables
    op.drop_table('long_term_memories', schema='hyperagent')
    op.drop_table('workflow_reflections', schema='hyperagent')

