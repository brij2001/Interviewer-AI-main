from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from typing import Generator

from .config import settings
from ..models.interview import Base

# Create SQLAlchemy engine
engine = create_engine(
    settings.DATABASE_URL,
    # connect_args={"check_same_thread": False}  # Needed for SQLite
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create all tables
Base.metadata.create_all(bind=engine)

def get_db() -> Generator:
    """Dependency function to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db() -> None:
    """Initialize the database, creating all tables."""
    Base.metadata.create_all(bind=engine)
