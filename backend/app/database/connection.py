from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.utils.config import settings

db_url = settings.DATABASE_URL

# 1. Resolve PostgreSQL dialect mismatch (Render returns 'postgres://', SQLAlchemy expects 'postgresql://')
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# 2. Force SSL mode on cloud environments (like Render) to avoid pg_hba.conf connection denials
if "sslmode" not in db_url and "localhost" not in db_url and "db:5432" not in db_url:
    if "?" in db_url:
        db_url = f"{db_url}&sslmode=require"
    else:
        db_url = f"{db_url}?sslmode=require"

# Create database engine with pool pre-ping to ensure active connection checking in production
engine = create_engine(
    db_url,
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
