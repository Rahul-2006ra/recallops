import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from backend.config import settings
from backend.models.chat import (
    ChatRequest,
    ChatResponse,
    ConversationResponse,
    ConversationDetailResponse,
    RecordOutcomeRequest,
    RecordOutcomeResponse,
    MemoryListResponse,
    MemoryItemResponse,
)
from backend.services.chat_service import chat_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat_and_memory"])


@router.post("/chat", response_model=ChatResponse, summary="Send message to AI Troubleshooting Assistant")
def send_chat_message(req: ChatRequest):
    """
    Conversational troubleshooting endpoint:
    - Analyzes equipment problem and intent using Groq (openai/gpt-oss-120b).
    - Recalls relevant verified historical experiences from Hindsight memory bank.
    - Preserves safety with instant hazard warnings.
    - Cites verified precedents (success vs failure) without fabricating false diagnoses.
    """
    try:
        return chat_service.process_chat(req)
    except Exception as e:
        logger.error("Chat turn failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate AI troubleshooting response.")


@router.get("/conversations", response_model=list[ConversationResponse], summary="List past conversations")
def list_conversations():
    """Retrieve all prior troubleshooting conversations ordered by most recent."""
    try:
        return chat_service.list_conversations()
    except Exception as e:
        logger.error("Failed to list conversations: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch conversation list.")


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse, summary="Get conversation details")
def get_conversation(conversation_id: str):
    """Retrieve full message history for a conversation."""
    conv = chat_service.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conv


@router.delete("/conversations/{conversation_id}", summary="Delete a conversation")
def delete_conversation(conversation_id: str):
    """Delete a conversation and its messages."""
    deleted = chat_service.delete_conversation(conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return {"status": "success", "deleted": True}


@router.post("/chat/record-outcome", response_model=RecordOutcomeResponse, summary="Record verified repair outcome")
def record_outcome(req: RecordOutcomeRequest):
    """
    Record confirmed equipment repair outcome:
    - Retains to SQLite verified episodic database.
    - Optionally retains to Hindsight Cloud (guarded for credit preservation).
    - Distinguishes successful vs unsuccessful repairs for future recall.
    """
    try:
        return chat_service.record_outcome(req)
    except Exception as e:
        logger.error("Failed to record outcome: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to record repair outcome.")


@router.get("/memories", response_model=MemoryListResponse, summary="Search and list verified equipment memories")
def list_memories(
    q: Optional[str] = Query("", description="Search keywords"),
    equipment_type: Optional[str] = Query(None, description="Filter by equipment type"),
    outcome_status: Optional[str] = Query(None, description="Filter by outcome: SUCCESSFUL or UNSUCCESSFUL"),
    limit: int = Query(25, ge=1, le=100),
):
    """Search verified past equipment repairs, actions taken, and certified outcomes."""
    try:
        items = chat_service.search_local_memories(
            query=q or "",
            equipment_type=equipment_type,
            outcome_status=outcome_status,
            limit=limit,
        )
        return MemoryListResponse(total=len(items), memories=items)
    except Exception as e:
        logger.error("Failed to fetch memories: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch memories.")


@router.get("/memories/{memory_id}", response_model=MemoryItemResponse, summary="Get memory details")
def get_memory_detail(memory_id: str):
    """Get single verified memory record details."""
    item = chat_service.get_memory_by_id(memory_id)
    if not item:
        raise HTTPException(status_code=404, detail="Memory record not found.")
    return item


@router.get("/chat/status", summary="System settings and connection status")
def get_system_status():
    """Retrieve active AI engine, Hindsight bank, and mock-memory protection status."""
    return {
        "status": "operational",
        "version": "2.0.0",
        "ai_engine": settings.GROQ_MODEL,
        "memory_bank": settings.HINDSIGHT_BANK_ID,
        "hindsight_mock_mode": settings.HINDSIGHT_MOCK_MODE,
        "credit_preservation_active": True,
    }


@router.post("/chat/sync-outcome/{verification_id}", summary="Retry syncing outcome to Hindsight Cloud")
def retry_sync_outcome(verification_id: str):
    """Retry synchronizing a locally recorded repair outcome with Hindsight Cloud."""
    try:
        return chat_service.retry_sync_outcome(verification_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Failed to retry sync for verification %s: %s", verification_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to synchronize record with Hindsight Cloud.")

