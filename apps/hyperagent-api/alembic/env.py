"""Alembic environment configuration"""
import os
import sys
import socket
from logging.config import fileConfig
from urllib.parse import urlparse

# Add apps/api to Python path for monorepo structure
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alembic import context
from sqlalchemy import engine_from_config, pool

from hyperagent.core.config import settings

# this is the Alembic Config object
config = context.config

# Apply database fallback logic (Supabase -> Docker Postgres)
def get_database_url_with_fallback():
    """Apply same fallback logic as async engine"""
    primary_url = settings.database_url
    fallback_url = "postgresql://hyperagent_user:secure_password@postgres:5432/hyperagent_db"
    
    if "supabase.co" in primary_url:
        try:
            # Test DNS resolution
            parsed = urlparse(primary_url)
            hostname = parsed.hostname
            socket.setdefaulttimeout(2)
            socket.gethostbyname(hostname)
            print(f"✓ Supabase hostname resolved - using primary database for migrations")
            return primary_url
        except (socket.gaierror, socket.timeout):
            print(f"✗ Supabase unreachable - using Docker Postgres for migrations")
            return fallback_url
    else:
        return primary_url

# Set SQLAlchemy URL from settings with fallback
config.set_main_option("sqlalchemy.url", get_database_url_with_fallback())

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import models for autogenerate
from hyperagent.models import Base
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

