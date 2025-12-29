"""Database session management"""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

from hyperagent.core.config import settings

# Create async engine
# Use psycopg (async) for pgbouncer compatibility (Supabase Free Plan uses pgbouncer)
# psycopg works better with pgbouncer than asyncpg because it doesn't use prepared statements
database_url = settings.database_url
if "pooler.supabase.com" in database_url or "pooler" in database_url:
    # For pgbouncer, use psycopg (async) instead of asyncpg
    # psycopg doesn't use prepared statements by default, making it compatible with pgbouncer
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://")
    engine = create_async_engine(
        database_url,
        echo=False,
        poolclass=NullPool,  # pgbouncer handles pooling, don't pool at SQLAlchemy level
    )
else:
    # For direct connections, use asyncpg (faster)
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(
        database_url,
        echo=False,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )

# Create session factory
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Database session dependency for FastAPI

    Usage:
        @router.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(Item))
            return result.scalars().all()
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
