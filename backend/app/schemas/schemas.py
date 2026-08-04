from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- Token & Security Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

# --- User Schemas ---
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Document & Chunk Schemas ---
class DocumentResponse(BaseModel):
    id: int
    name: str
    file_type: str
    size_bytes: int
    page_count: int
    chunk_count: int
    status: str
    is_indexed: bool
    upload_date: datetime

    class Config:
        from_attributes = True

class DocumentChunkResponse(BaseModel):
    id: int
    document_id: int
    text: str
    chunk_index: int
    page_number: int

    class Config:
        from_attributes = True

class DocumentStats(BaseModel):
    total_documents: int
    total_chunks: int
    total_size_bytes: int
    indexed_documents: int
    file_type_breakdown: Dict[str, int]

# --- Chat & Conversation Schemas ---
class MessageCreate(BaseModel):
    text: str

class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    role: str
    text: str
    confidence_score: Optional[float] = None
    sources: Optional[List[Dict[str, Any]]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ConversationCreate(BaseModel):
    title: Optional[str] = None

class ConversationResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ConversationDetail(ConversationResponse):
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True

# --- Analytics & Logs Schemas ---
class QueryLogResponse(BaseModel):
    id: int
    query_text: str
    response_text: str
    confidence_score: Optional[float] = None
    latency_ms: int
    timestamp: datetime
    llm_provider: str
    username: Optional[str] = None

    class Config:
        from_attributes = True

class AnalyticsDashboard(BaseModel):
    total_queries: int
    avg_confidence: float
    avg_latency_ms: float
    provider_distribution: Dict[str, int]
    daily_query_volume: List[Dict[str, Any]]
