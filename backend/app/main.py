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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to specific domains
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
