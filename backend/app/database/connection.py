from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.utils.config import settings

# Create database engine with pool pre-ping to ensure active connection checking in production
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """
    Database dependency for FastAPI endpoint routes.
    Yields a db session and automatically closes it after execution.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
