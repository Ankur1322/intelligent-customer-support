import time
import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.connection import get_db
from app.api.deps import get_current_user, get_current_admin
from app.models.models import Conversation, Message, QueryLog, User
from app.schemas.schemas import (
    ConversationResponse, ConversationCreate, ConversationDetail,
    MessageCreate, MessageResponse, QueryLogResponse, AnalyticsDashboard
)
from app.rag.rag_pipeline import RAGPipeline
from app.utils.config import settings

router = APIRouter(prefix="/chat", tags=["AI Chat & Support"])

@router.get("/conversations", response_model=List[ConversationResponse])
def get_user_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all active conversations of the current authenticated user.
    """
    return db.query(Conversation)\
        .filter(Conversation.user_id == current_user.id)\
        .order_by(Conversation.updated_at.desc())\
        .all()

@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    conv_in: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new conversation thread.
    """
    title = conv_in.title if conv_in.title else "New Chat"
    conversation = Conversation(
        user_id=current_user.id,
        title=title
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation

@router.get("/conversations/{id}", response_model=ConversationDetail)
def get_conversation_details(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve full details (including message history) of a specific conversation thread.
    """
    conv = db.query(Conversation).filter(Conversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conv.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to access this conversation")
        
    return conv

@router.delete("/conversations/{id}", status_code=status.HTTP_200_OK)
def delete_conversation(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a conversation thread.
    """
    conv = db.query(Conversation).filter(Conversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    if conv.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete this conversation")
        
    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted successfully"}

@router.post("/conversations/{id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    id: int,
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a message in a conversation thread and get a RAG-augmented AI response.
    Measures latency and creates structured system QueryLogs for analytics.
    """
    conv = db.query(Conversation).filter(Conversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    if conv.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to participate in this conversation")

    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        text=msg_in.text
    )
    db.add(user_msg)
    
    if conv.title == "New Chat":
        conv.title = msg_in.text[:40] + ("..." if len(msg_in.text) > 40 else "")
    
    db.commit()

    history = db.query(Message).filter(Message.conversation_id == conv.id).order_by(Message.created_at.asc()).all()

    start_time = time.time()
    rag_response = RAGPipeline.answer_query(msg_in.text, db, chat_history=history[:-1])
    latency_ms = int((time.time() - start_time) * 1000)

    ai_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        text=rag_response["answer"],
        confidence_score=rag_response["confidence_score"],
        sources=rag_response["sources"]
    )
    db.add(ai_msg)
    
    conv.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(ai_msg)

    query_log = QueryLog(
        user_id=current_user.id,
        query_text=msg_in.text,
        response_text=rag_response["answer"],
        confidence_score=rag_response["confidence_score"],
        latency_ms=latency_ms,
        llm_provider=settings.LLM_PROVIDER
    )
    db.add(query_log)
    db.commit()

    return ai_msg

@router.post("/conversations/{id}/clear", status_code=status.HTTP_200_OK)
def clear_conversation(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Clear all message logs in an existing conversation thread.
    """
    conv = db.query(Conversation).filter(Conversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    if conv.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to clear this conversation")

    db.query(Message).filter(Message.conversation_id == id).delete()
    db.commit()
    return {"message": "Chat history cleared successfully"}

@router.get("/query-logs", response_model=List[QueryLogResponse])
def get_query_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Admin-only audit log. List recent queries, AI responses, confidence levels, and latency.
    """
    logs = db.query(QueryLog).order_by(QueryLog.timestamp.desc()).limit(limit).all()
    
    response = []
    for log in logs:
        username = log.user.username if log.user else "Anonymous"
        response.append({
            "id": log.id,
            "query_text": log.query_text,
            "response_text": log.response_text,
            "confidence_score": log.confidence_score,
            "latency_ms": log.latency_ms,
            "timestamp": log.timestamp,
            "llm_provider": log.llm_provider,
            "username": username
        })
    return response

@router.get("/analytics", response_model=AnalyticsDashboard)
def get_analytics_dashboard(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Admin-only analytics dashboard. Gathers query volume, average latency,
    confidence metrics, daily distribution, and providers usage.
    """
    total_queries = db.query(QueryLog).count()
    if total_queries == 0:
        return {
            "total_queries": 0,
            "avg_confidence": 0.0,
            "avg_latency_ms": 0.0,
            "provider_distribution": {},
            "daily_query_volume": []
        }

    avg_confidence = db.query(func.avg(QueryLog.confidence_score)).scalar() or 0.0
    avg_latency = db.query(func.avg(QueryLog.latency_ms)).scalar() or 0.0

    provider_query = db.query(QueryLog.llm_provider, func.count(QueryLog.id))\
        .group_by(QueryLog.llm_provider).all()
    provider_distribution = {provider: count for provider, count in provider_query}

    # Use standard extract(day/date) or simple string format
    # For PostgreSQL / SQLite compatibility, let's group by day. 
    # Since postgres is explicitly selected, func.to_char works beautifully.
    seven_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=7)
    daily_query = db.query(
        func.to_char(QueryLog.timestamp, 'YYYY-MM-DD').label('day'),
        func.count(QueryLog.id).label('count')
    ).filter(QueryLog.timestamp >= seven_days_ago)\
     .group_by('day')\
     .order_by('day')\
     .all()

    daily_query_volume = [{"date": r.day, "count": r.count} for r in daily_query]

    return {
        "total_queries": total_queries,
        "avg_confidence": round(float(avg_confidence), 4),
        "avg_latency_ms": round(float(avg_latency), 2),
        "provider_distribution": provider_distribution,
        "daily_query_volume": daily_query_volume
    }
