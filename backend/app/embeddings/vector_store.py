import os
import faiss
import numpy as np
import httpx
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.utils.config import settings
from app.models.models import DocumentChunk, Document

class VectorStoreManager:
    _index_instance = None
    _chunk_ids_mapping = []  # Index-to-DB-chunk-ID mapping

    @classmethod
    def _get_embedding_dimension(cls) -> int:
        """
        Default backup embedding dimensions depending on the LLM provider.
        - Gemini (gemini-embedding-001 / text-embedding-004): 3072 dimensions
        - OpenAI (text-embedding-3-small): 1536 dimensions
        """
        provider = settings.LLM_PROVIDER.lower()
        if provider == "gemini":
            return 3072
        elif provider == "openai":
            return 1536
        else:
            return 3072  # Fallback

    @classmethod
    def _generate_embeddings_api(cls, texts: List[str]) -> List[List[float]]:
        """
        Generates vector embeddings for a list of texts by making a high-speed
        HTTP call to Gemini or OpenAI embedding endpoints.
        """
        provider = settings.LLM_PROVIDER.lower()

        if provider == "gemini":
            return cls._generate_gemini_embeddings(texts)
        elif provider == "openai":
            return cls._generate_openai_embeddings(texts)
        else:
            raise ValueError(f"Unsupported Embedding Provider: {provider}")

    @classmethod
    def _generate_gemini_embeddings(cls, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings using Google Gemini's official gemini-embedding-001 model via embedContent.
        Runs a fast, sequential HTTP loop that is universally supported and 100% stable.
        """
        api_key = settings.GEMINI_API_KEY
        if not api_key or api_key == "your_gemini_api_key_here":
            raise ValueError("GEMINI_API_KEY is not configured inside .env")

        all_embeddings = []

        for text in texts:
            # Current stable model endpoint that is guaranteed to exist on all keys
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={api_key}"
            
            payload = {
                "model": "models/gemini-embedding-001",
                "content": {
                    "parts": [{"text": text}]
                }
            }

            try:
                with httpx.Client(timeout=30.0) as client:
                    response = client.post(url, json=payload)
                    response.raise_for_status()
                    data = response.json()
                    
                    vector = data["embedding"]["values"]
                    all_embeddings.append(vector)
            except Exception as e:
                raise RuntimeError(f"Gemini Embedding API failure: {str(e)}")

        return all_embeddings

    @classmethod
    def _generate_openai_embeddings(cls, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings using OpenAI text-embedding-3-small model.
        """
        api_key = settings.OPENAI_API_KEY
        if not api_key or api_key == "your_openai_api_key_here":
            raise ValueError("OPENAI_API_KEY is not configured inside .env")

        url = "https://api.openai.com/v1/embeddings"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        payload = {
            "input": texts,
            "model": "text-embedding-3-small"
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                
                embeddings = [emb["embedding"] for emb in data["data"]]
                return embeddings
        except Exception as e:
                raise RuntimeError(f"OpenAI Embedding API failure: {str(e)}")

    @classmethod
    def get_index_dir(cls) -> str:
        """
        Get absolute path to FAISS index directory, making sure it exists.
        """
        path = settings.FAISS_INDEX_PATH
        if not os.path.isabs(path):
            path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), path)
        os.makedirs(path, exist_ok=True)
        return path

    @classmethod
    def save_index(cls, index: faiss.IndexFlatIP, chunk_ids: List[int]):
        """
        Save the FAISS index and the index-to-chunk-ID mapping to disk.
        """
        dir_path = cls.get_index_dir()
        faiss_file = os.path.join(dir_path, "index.faiss")
        mapping_file = os.path.join(dir_path, "mapping.npy")

        faiss.write_index(index, faiss_file)
        np.save(mapping_file, np.array(chunk_ids))
        
        cls._index_instance = index
        cls._chunk_ids_mapping = chunk_ids

    @classmethod
    def load_index(cls) -> bool:
        """
        Load FAISS index and chunk mapping from disk. Returns True if successful.
        """
        dir_path = cls.get_index_dir()
        faiss_file = os.path.join(dir_path, "index.faiss")
        mapping_file = os.path.join(dir_path, "mapping.npy")

        if os.path.exists(faiss_file) and os.path.exists(mapping_file):
            try:
                cls._index_instance = faiss.read_index(faiss_file)
                cls._chunk_ids_mapping = np.load(mapping_file).tolist()
                return True
            except Exception:
                pass
        return False

    @classmethod
    def rebuild_index(cls, db: Session) -> int:
        """
        Rebuild FAISS index from scratch using all document chunks currently stored in PostgreSQL.
        This handles document updates and deletions gracefully.
        """
        chunks = db.query(DocumentChunk).join(Document).filter(Document.is_indexed == True).all()

        if not chunks:
            dimension = cls._get_embedding_dimension()
            index = faiss.IndexFlatIP(dimension)
            cls.save_index(index, [])
            return 0

        texts = [chunk.text for chunk in chunks]
        chunk_ids = [chunk.id for chunk in chunks]

        # Call the Cloud Embeddings API in a fast batch
        raw_embeddings = cls._generate_embeddings_api(texts)
        embeddings = np.array(raw_embeddings, dtype=np.float32)

        # DYNAMIC DIMENSION ALIGNMENT
        dimension = embeddings.shape[1]

        # L2-normalize to achieve exact Cosine Similarity with Inner Product (FlatIP)
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms[norms == 0] = 1.0  # Avoid division by zero
        normalized_embeddings = embeddings / norms

        # Build index with the exact matched dimension dynamically
        index = faiss.IndexFlatIP(dimension)
        index.add(normalized_embeddings)

        cls.save_index(index, chunk_ids)
        return len(chunk_ids)

    @classmethod
    def search(cls, query: str, db: Session, top_k: int = None) -> List[Tuple[DocumentChunk, float]]:
        """
        Generate query embedding, normalize it, and search FAISS index for top-K matches.
        Returns a list of tuples: (DocumentChunk, CosineSimilarityScore).
        """
        if top_k is None:
            top_k = settings.TOP_K

        if cls._index_instance is None:
            loaded = cls.load_index()
            if not loaded or not cls._chunk_ids_mapping:
                count = cls.rebuild_index(db)
                if count == 0:
                    return []

        if cls._index_instance is None or cls._index_instance.ntotal == 0:
            return []

        # Call API to generate query embedding
        raw_query_emb = cls._generate_embeddings_api([query])
        query_emb = np.array(raw_query_emb, dtype=np.float32)

        # L2-normalize query embedding
        norm = np.linalg.norm(query_emb, axis=1, keepdims=True)
        norm[norm == 0] = 1.0
        normalized_query_emb = query_emb / norm

        effective_k = min(top_k, cls._index_instance.ntotal)
        if effective_k <= 0:
            return []

        scores, indices = cls._index_instance.search(normalized_query_emb, effective_k)
        
        results = []
        for i in range(effective_k):
            score = float(scores[0][i])
            idx = int(indices[0][i])
            
            if idx == -1 or idx >= len(cls._chunk_ids_mapping):
                continue
                
            chunk_db_id = cls._chunk_ids_mapping[idx]
            chunk = db.query(DocumentChunk).filter(DocumentChunk.id == chunk_db_id).first()
            if chunk:
                results.append((chunk, score))
                
        return results
