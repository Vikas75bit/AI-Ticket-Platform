from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# ─── EXTRACTION INTEGRATION IMPORTS ──────────────────────────────────────────
# 1. Pull our type-safe config engine settings
from config import settings
# 2. Pull our core model structures and Base class metadata tracking sheets
from database import Base
import models # Registers your KnowledgeBase and Ticket tables natively into Base metadata

# This is the Alembic Config object, which provides access to the values within the .ini file in use.
config = context.config

# Dynamically override the target ini url block with your live Supabase DATABASE_URL credentials!
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ─── CRITICAL AUTOMATION METADATA LINK ────────────────────────────────────────
# Tells Alembic's autogenerate scanner exactly what your tables are supposed to look like
target_metadata = Base.metadata
# ──────────────────────────────────────────────────────────────────────────────

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

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations() -> None:
    """In a standard sync pool driver context, fallback to direct connections."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        do_run_migrations(connection)

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    import asyncio
    # Handle both synchronous or event loop thread blocks safely
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # Fallback helper for running underneath asynchronous startup containers
        run_async_migrations()
    else:
        connectable = engine_from_config(
            config.get_section(config.config_ini_section, {}),
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )
        with connectable.connect() as connection:
            do_run_migrations(connection)

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
