"""Add event_logs table for audit logging

Revision ID: 009
Revises: 007
Create Date: 2025-01-02

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "009"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create event_logs table
    op.create_table(
        "event_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", sa.String(100), nullable=False, index=True),
        sa.Column("event_type", sa.String(50), nullable=False, index=True),
        sa.Column("workflow_id", sa.String(100), nullable=True, index=True),
        sa.Column("source_agent", sa.String(50), nullable=True),
        sa.Column("data", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("event_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("metadata", postgresql.JSONB, nullable=True, server_default="{}"),
        schema="hyperagent",
    )

    # Create indexes for faster queries
    op.create_index(
        "idx_event_logs_event_type",
        "event_logs",
        ["event_type"],
        schema="hyperagent",
    )
    op.create_index(
        "idx_event_logs_workflow_id",
        "event_logs",
        ["workflow_id"],
        schema="hyperagent",
    )
    op.create_index(
        "idx_event_logs_event_timestamp",
        "event_logs",
        ["event_timestamp"],
        schema="hyperagent",
    )


def downgrade() -> None:
    op.drop_index("idx_event_logs_event_timestamp", table_name="event_logs", schema="hyperagent")
    op.drop_index("idx_event_logs_workflow_id", table_name="event_logs", schema="hyperagent")
    op.drop_index("idx_event_logs_event_type", table_name="event_logs", schema="hyperagent")
    op.drop_table("event_logs", schema="hyperagent")

