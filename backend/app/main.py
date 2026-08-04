import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.utils.config import settings
from app.database.connection import engine, Base
from app.api import auth, documents, chat
from app.embeddings.vector_store import VectorStoreManager

# Automatically bootstrap PostgreSQL database tables at application startup
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    pass

# Initialize FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Production-Ready Intelligent Customer Support AI Assistant utilizing RAG with local FAISS vector store and Google Gemini/OpenAI GPT.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Set up CORS middleware to allow seamless communication from our Vite (React) frontend
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
env_origins = os.getenv("ALLOWED_ORIGINS")
if env_origins:
    allowed_origins.extend([origin.strip() for origin in env_origins.split(",") if origin.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.onrender\.com", # Auto-allows dynamic Render deployment domains!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load existing FAISS index on application startup so vector search is instantly hot
@app.on_event("startup")
def startup_event():
    success = VectorStoreManager.load_index()
    if success:
        print("[INIT] FAISS index loaded successfully from local storage.")
    else:
        print("[INIT] No pre-existing FAISS index found. Index will be initialized upon the first document upload.")

# Register system routes
app.include_router(auth.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")

# System Health Check endpoint
@app.get("/api/health", tags=["System Utility"])
def health_check():
    """
    Standard service readiness and liveness check.
    """
    return {
        "status": "healthy",
        "llm_provider": settings.LLM_PROVIDER,
        "embedding_model": settings.EMBEDDING_MODEL_NAME
    }
