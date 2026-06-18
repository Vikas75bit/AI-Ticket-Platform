from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings

# HARDENED PRODUCTION ENGINE SELECTION:
# pool_size: Keeps 10 persistent connections open for rapid recycling
# max_overflow: Allows up to 20 temporary connections during peak traffic spikes
# pool_recycle: Automatically drops and refreshes idle links every 30 minutes
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,
    pool_pre_ping=True # Verifies the connection is alive before handing it to a worker task
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
