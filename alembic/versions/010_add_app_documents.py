"""Add app_documents table for application-wide semantic index

Revision ID: 010
Revises: 007
Create Date: 2026-01-27 06:35:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision = "010"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure schemas exist
    op.execute('CREATE SCHEMA IF NOT EXISTS hyperagent')

    # Create app_documents table
    op.create_table(
        "app_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("repo_name", sa.String(255), nullable=True),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("language", sa.String(30), nullable=True),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536)),
        sa.Column("tokens_estimate", sa.Integer(), nullable=True),
        sa.Column("metadata", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("file_path", "checksum", "chunk_index", name="uq_app_documents_file_checksum_chunk"),
        schema="hyperagent",
    )

    # Helpful indexes
    op.create_index("idx_app_documents_file_path", "app_documents", ["file_path"], schema="hyperagent")

    # Vector index for similarity search (pgvector)
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_app_documents_embedding 
        ON hyperagent.app_documents 
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
        """
    )


def downgrade() -> None:
    op.drop_index("idx_app_documents_embedding", table_name="app_documents", schema="hyperagent")
    op.drop_index("idx_app_documents_file_path", table_name="app_documents", schema="hyperagent")
    op.drop_table("app_documents", schema="hyperagent")
