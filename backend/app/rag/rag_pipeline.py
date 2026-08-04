import logging
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.embeddings.vector_store import VectorStoreManager
from app.llm.llm_client import LLMClient
from app.utils.config import settings
from app.models.models import Message

logger = logging.getLogger(__name__)

class RAGPipeline:
    @staticmethod
    def answer_query(query: str, db: Session, chat_history: List[Message] = []) -> Dict[str, Any]:
        """
        Execute the RAG lifecycle:
        1. Retrieve relevant text chunks from FAISS index.
        2. Evaluate semantic confidence (Cosine Similarity).
        3. Enforce the double-layer guardrail for unknown answers.
        4. Assemble conversational memory, call LLM, and return response.
        """
        try:
            search_results = VectorStoreManager.search(query, db, top_k=settings.TOP_K)
        except Exception as e:
            logger.error(f"Error during semantic vector search: {str(e)}")
            search_results = []

        if not search_results:
            return {
                "answer": "I don't know.",
                "confidence_score": 0.0,
                "sources": []
            }

        highest_score = search_results[0][1]
        
        # Guardrail Layer 1: Vector Space Similarity thresholding
        if highest_score < settings.CONFIDENCE_THRESHOLD:
            logger.info(f"Query '{query}' similarity score ({highest_score:.4f}) is below threshold ({settings.CONFIDENCE_THRESHOLD}). Replying: I don't know.")
            return {
                "answer": "I don't know.",
                "confidence_score": round(highest_score, 4),
                "sources": []
            }

        context_parts = []
        sources = []
        seen_chunks = set()

        for chunk, score in search_results:
            if chunk.id in seen_chunks:
                continue
            seen_chunks.add(chunk.id)
            
            context_parts.append(
                f"[Source: {chunk.document.name}, Page: {chunk.page_number}]\n"
                f"Content: {chunk.text}\n"
            )
            sources.append({
                "document_name": chunk.document.name,
                "file_type": chunk.document.file_type,
                "page_number": chunk.page_number,
                "chunk_index": chunk.chunk_index,
                "score": round(score, 4)
            })

        context_str = "\n---\n".join(context_parts)

        history_str = ""
        if chat_history:
            recent_messages = chat_history[-6:]
            history_parts = []
            for msg in recent_messages:
                role_label = "User" if msg.role == "user" else "Assistant"
                history_parts.append(f"{role_label}: {msg.text}")
            history_str = "\n".join(history_parts)

        prompt = (
            f"RETRIVED COMPANY CONTEXT:\n{context_str}\n\n"
        )
        if history_str:
            prompt += f"RECENT CONVERSATION HISTORY:\n{history_str}\n\n"
            
        prompt += f"CURRENT USER QUERY: {query}"

        system_instruction = (
            "You are a highly precise customer support AI assistant for our company. "
            "You have been provided with matching context extracted from official company documents. "
            "Your task is to answer the CURRENT USER QUERY accurately and concisely, relying ONLY on the RETRIEVED COMPANY CONTEXT.\n\n"
            "CRITICAL MANDATES:\n"
            "1. Rely strictly on the retrieved context. Do not make up facts, synthesize info outside the context, or use personal general knowledge.\n"
            "2. If the answer cannot be confidently and directly resolved from the retrieved context, you MUST respond EXACTLY with: 'I don't know.' (do not add any explanations, preambles, or formatting - just the exact 12-character sentence with a period).\n"
            "3. If the context contains sufficient info to answer, make your response brief, clear, and professional. Mention specific facts, metrics, or instructions directly.\n"
            "4. Never say 'Based on the context...' or 'According to the documents...'. Answer naturally as the company support expert."
        )

        try:
            raw_answer = LLMClient.generate_response(prompt, system_instruction=system_instruction)
            cleaned_answer = raw_answer.strip()
            
            if "i don't know" in cleaned_answer.lower() or "don't know" in cleaned_answer.lower():
                return {
                    "answer": "I don't know.",
                    "confidence_score": round(highest_score, 4),
                    "sources": []
                }

            return {
                "answer": cleaned_answer,
                "confidence_score": round(highest_score, 4),
                "sources": sources
            }
        except Exception as e:
            logger.error(f"Error in RAG LLM execution: {str(e)}")
            return {
                "answer": "I don't know.",
                "confidence_score": round(highest_score, 4),
                "sources": []
            }
