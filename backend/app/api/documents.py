import os
import shutil
import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.api.deps import get_current_admin, get_current_user
from app.models.models import Document, DocumentChunk, User
from app.schemas.schemas import DocumentResponse, DocumentStats
from app.rag.text_processor import TextProcessor
from app.embeddings.vector_store import VectorStoreManager

router = APIRouter(prefix="/documents", tags=["Documents Management"])

def get_upload_dir() -> str:
    """
    Ensure the physical uploads folder exists and return its path.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    upload_path = os.path.join(base_dir, "uploads")
    os.makedirs(upload_path, exist_ok=True)
    return upload_path

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Admin-only upload endpoint. Saves, parses, chunks, and indexes documents (PDF, DOCX, TXT).
    Synchronously processes text parsing and chunk saving, then triggers vector indexing.
    """
    filename = file.filename
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in ["pdf", "docx", "txt"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Only PDF, DOCX, and TXT are supported."
        )

    upload_dir = get_upload_dir()
    file_path = os.path.join(upload_dir, filename)
    
    base_name, file_ext = os.path.splitext(filename)
    counter = 1
    while os.path.exists(file_path):
        file_path = os.path.join(upload_dir, f"{base_name}_{counter}{file_ext}")
        counter += 1
    
    saved_filename = os.path.basename(file_path)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file physically: {str(e)}"
        )

    file_size = os.path.getsize(file_path)

    doc_record = Document(
        name=saved_filename,
        file_type=ext,
        size_bytes=file_size,
        path=file_path,
        status="indexing",
        is_indexed=False
    )
    db.add(doc_record)
    db.commit()
    db.refresh(doc_record)

    try:
        pages = TextProcessor.extract_document(file_path, ext)
        page_count = len(pages)
        
        chunks_data = TextProcessor.chunk_document(pages, chunk_size=400, chunk_overlap=80)
        chunk_count = len(chunks_data)

        if chunk_count == 0:
            raise ValueError("No text could be parsed from the document.")

        for chunk in chunks_data:
            db_chunk = DocumentChunk(
                document_id=doc_record.id,
                text=chunk["text"],
                chunk_index=chunk["chunk_index"],
                page_number=chunk["page_number"]
            )
            db.add(db_chunk)
        
        doc_record.page_count = page_count
        doc_record.chunk_count = chunk_count
        doc_record.status = "indexed"
        doc_record.is_indexed = True
        db.commit()
        db.refresh(doc_record)

        # Trigger Vector Database FAISS rebuild
        VectorStoreManager.rebuild_index(db)

    except Exception as e:
        db.rollback()  # Clear any aborted transactions so the session is usable again
        try:
            doc_record.status = "failed"
            db.commit()
        except Exception:
            pass  # Avoid masking the main exception if updating the status fails
            
        if os.path.exists(file_path):
            os.remove(file_path)
            
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Document indexing failed: {str(e)}"
        )

    return doc_record

@router.get("/", response_model=List[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all uploaded company documents. Available to both users and admins.
    """
    return db.query(Document).order_by(Document.upload_date.desc()).all()

@router.delete("/{id}", status_code=status.HTTP_200_OK)
def delete_document(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Admin-only deletion. Removes document from PostgreSQL and deletes file from disk,
    then automatically rebuilds FAISS indexes.
    """
    doc = db.query(Document).filter(Document.id == id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    if os.path.exists(doc.path):
        try:
            os.remove(doc.path)
        except Exception as e:
            pass

    db.delete(doc)
    db.commit()

    VectorStoreManager.rebuild_index(db)

    return {"message": f"Document '{doc.name}' deleted successfully and FAISS index rebuilt."}

@router.post("/reindex", status_code=status.HTTP_200_OK)
def manual_reindex(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Admin-only endpoint to manually force a vector index rebuild of FAISS from Postgres chunks.
    """
    total_vectors = VectorStoreManager.rebuild_index(db)
    return {"message": "FAISS vector store re-indexed successfully.", "total_indexed_chunks": total_vectors}

@router.get("/stats", response_model=DocumentStats)
def get_document_statistics(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Admin-only analytics. Returns statistics about the indexed Knowledge Base.
    """
    docs = db.query(Document).all()
    
    total_documents = len(docs)
    total_chunks = sum(d.chunk_count for d in docs)
    total_size_bytes = sum(d.size_bytes for d in docs)
    indexed_documents = sum(1 for d in docs if d.is_indexed and d.status == "indexed")
    
    file_type_breakdown = {"pdf": 0, "docx": 0, "txt": 0}
    for d in docs:
        ft = d.file_type.lower()
        if ft in file_type_breakdown:
            file_type_breakdown[ft] += 1
        else:
            file_type_breakdown[ft] = 1

    return {
        "total_documents": total_documents,
        "total_chunks": total_chunks,
        "total_size_bytes": total_size_bytes,
        "indexed_documents": indexed_documents,
        "file_type_breakdown": file_type_breakdown
    }
