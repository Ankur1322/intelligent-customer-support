import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import os
import sys

# Ensure backend directory is in python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database.connection import get_db, Base
from app.models.models import User, Conversation, Message, Document, DocumentChunk
from app.utils.security import get_password_hash
from unittest.mock import patch, MagicMock

# Setup in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override database dependency in FastAPI app
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_db():
    """Create a clean database schema before each test."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

client = TestClient(app)

def test_user_registration_and_login():
    # 1. Register first user (automatically should become admin)
    register_response = client.post(
        "/api/auth/register",
        json={"username": "testadmin", "email": "admin@example.com", "password": "password123"}
    )
    assert register_response.status_code == 201
    data = register_response.json()
    assert data["username"] == "testadmin"
    assert data["role"] == "admin"

    # 2. Login
    login_response = client.post(
        "/api/auth/login",
        json={"username": "testadmin", "password": "password123"}
    )
    assert login_response.status_code == 200
    token_data = login_response.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"

    # 3. Access authenticated 'me' route
    headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    me_response = client.get("/api/auth/me", headers=headers)
    assert me_response.status_code == 200
    me_data = me_response.json()
    assert me_data["username"] == "testadmin"
    assert me_data["role"] == "admin"


def test_conversation_management():
    # Setup test user and acquire token
    db = TestingSessionLocal()
    hashed_pass = get_password_hash("password123")
    user = User(username="testuser", email="user@example.com", hashed_password=hashed_pass, role="user")
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()

    login_response = client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "password123"}
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a conversation
    create_response = client.post(
        "/api/chat/conversations",
        json={"title": "Custom Test Title"},
        headers=headers
    )
    assert create_response.status_code == 201
    conv = create_response.json()
    assert conv["title"] == "Custom Test Title"

    # 2. List conversations
    list_response = client.get("/api/chat/conversations", headers=headers)
    assert list_response.status_code == 200
    convs = list_response.json()
    assert len(convs) == 1
    assert convs[0]["id"] == conv["id"]

    # 3. Fetch specific conversation details
    detail_response = client.get(f"/api/chat/conversations/{conv['id']}", headers=headers)
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert len(detail["messages"]) == 0

    # 4. Delete conversation
    delete_response = client.delete(f"/api/chat/conversations/{conv['id']}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["message"] == "Conversation deleted successfully"


@patch("app.rag.rag_pipeline.RAGPipeline.answer_query")
def test_chat_message_and_rag_logging(mock_answer_query):
    # Mock RAG output
    mock_answer_query.return_value = {
        "answer": "This is a mocked RAG answer about product warranty.",
        "confidence_score": 0.89,
        "sources": [{"document_name": "warranty.pdf", "file_type": "pdf", "page_number": 2, "chunk_index": 5, "score": 0.89}]
    }

    # Create admin user
    db = TestingSessionLocal()
    hashed_pass = get_password_hash("password123")
    user = User(username="testadmin", email="admin@example.com", hashed_password=hashed_pass, role="admin")
    db.add(user)
    db.commit()
    db.close()

    login_response = client.post("/api/auth/login", json={"username": "testadmin", "password": "password123"})
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create conversation
    conv_response = client.post("/api/chat/conversations", json={"title": "New Chat"}, headers=headers)
    conv_id = conv_response.json()["id"]

    # Send message and get mocked answer
    msg_response = client.post(
        f"/api/chat/conversations/{conv_id}/messages",
        json={"text": "How long is the product warranty?"},
        headers=headers
    )
    assert msg_response.status_code == 201
    msg_data = msg_response.json()
    assert msg_data["role"] == "assistant"
    assert msg_data["text"] == "This is a mocked RAG answer about product warranty."
    assert msg_data["confidence_score"] == 0.89
    assert len(msg_data["sources"]) == 1

    # Verify query logs can be retrieved by admin
    logs_response = client.get("/api/chat/query-logs", headers=headers)
    assert logs_response.status_code == 200
    logs = logs_response.json()
    assert len(logs) == 1
    assert logs[0]["query_text"] == "How long is the product warranty?"
    assert logs[0]["confidence_score"] == 0.89


def test_unauthorized_endpoints():
    # Attempting to fetch query logs without Authorization header
    response = client.get("/api/chat/query-logs")
    assert response.status_code in (401, 403)
