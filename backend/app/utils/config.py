import os
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "Intelligent Customer Support AI Assistant"
    PORT: int = 8000
    DEBUG: bool = True
    
    # Database Configurations
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/customer_support_db"
    
    # Security & Authentication
    JWT_SECRET: str = "80e7cf239cb1dc7f3ba3a58b291a13b5e4063df478bcfca9bda4659b8fb492cd"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # LLM Settings (gemini, openai)
    LLM_PROVIDER: str = "gemini"
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    
    # RAG & NLP Settings
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    FAISS_INDEX_PATH: str = "faiss_index"
    TOP_K: int = 4
    CONFIDENCE_THRESHOLD: float = 0.3

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
