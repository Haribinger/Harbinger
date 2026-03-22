from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from src.config import settings

engine: AsyncEngine | None = None
async_session: async_sessionmaker | None = None


async def init_db():
    global engine, async_session
    try:
        engine = create_async_engine(
            settings.database_url,
            pool_size=10,
            max_overflow=5,
            pool_timeout=30,
            pool_recycle=300,
            echo=settings.app_env == "development",
        )
        # Verify connection
        async with engine.begin() as conn:
            await conn.execute(
                __import__("sqlalchemy").text("SELECT 1")
            )
        async_session = async_sessionmaker(engine, expire_on_commit=False)
    except Exception as e:
        print(f"[DB] Connection failed, running degraded: {e}")
        engine = None
        async_session = None


async def close_db():
    global engine
    if engine:
        await engine.dispose()


def db_available() -> bool:
    return engine is not None
