import logging
from typing import Dict, Any, Optional
import os
import uuid
from datetime import datetime

logger = logging.getLogger("lifeos.pinecone")

_pinecone_index = None
_embedding_model = None

def _get_pinecone_index():
    global _pinecone_index
    if _pinecone_index is None:
        try:
            from pinecone import Pinecone
            api_key = os.environ.get("PINECONE_API_KEY")
            if api_key:
                pc = Pinecone(api_key=api_key)
                _pinecone_index = pc.Index("mental-journal")
                logger.info("Pinecone index initialized.")
        except Exception as e:
            logger.warning(f"Failed to initialize Pinecone: {e}")
    return _pinecone_index

def _get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedding_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
            logger.info("Embedding model initialized.")
        except Exception as e:
            logger.warning(f"Failed to initialize embedding model: {e}")
    return _embedding_model

async def upsert_journal_entry(user_id: int, content: str, sentiment: str, entry_id: int) -> bool:
    try:
        model = _get_embedding_model()
        index = _get_pinecone_index()
        
        if not model or not index:
            logger.warning("Pinecone or embedding model not configured. Skipping upsert.")
            return False
            
        # Generate embedding
        vector = model.encode(content).tolist()
        
        # Upsert to Pinecone
        vector_id = f"journal-{entry_id}-{uuid.uuid4()}"
        metadata = {
            "user_id": user_id,
            "sentiment": sentiment,
            "entry_id": entry_id,
            "content": content,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        index.upsert(vectors=[(vector_id, vector, metadata)])
        logger.info(f"Successfully upserted journal entry {entry_id} to Pinecone.")
        return True
    except Exception as e:
        logger.error(f"Error upserting to Pinecone: {e}")
        return False
