import logging
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from backend.config import settings
from backend.auth import AuthenticatedUser, get_current_user
from backend.models.chat import (
    ChatRequest,
    ChatResponse,
    ConversationResponse,
    ConversationDetailResponse,
    RecordOutcomeRequest,
    RecordOutcomeResponse,
    MemoryListResponse,
    MemoryItemResponse,
    TranscriptionResponse,
)
from backend.services.chat_service import chat_service
from backend.services.transcription_service import transcription_service


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat_and_memory"])


@router.post("/chat", response_model=ChatResponse, summary="Send message to AI Troubleshooting Assistant")
def send_chat_message(
    req: ChatRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Conversational troubleshooting endpoint:
    - Analyzes equipment problem and intent using Groq (openai/gpt-oss-120b).
    - Recalls relevant verified historical experiences from Hindsight memory bank under user isolation.
    - Preserves safety with instant hazard warnings.
    - Cites verified precedents (success vs failure) without fabricating false diagnoses.
    """
    try:
        return chat_service.process_chat(req, user_id=current_user.uid)
    except Exception as e:
        logger.error("Chat turn failed for user %s: %s", current_user.uid, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate AI troubleshooting response.")


@router.post("/conversations", summary="Create new conversation")
def create_conversation(
    payload: Optional[dict] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    title = payload.get("title") if payload else None
    return chat_service.create_conversation(title=title, user_id=current_user.uid)


@router.get("/conversations", response_model=list[ConversationResponse], summary="List past conversations")
def list_conversations(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Retrieve all prior troubleshooting conversations ordered by most recent for the authenticated user."""
    try:
        return chat_service.list_conversations(user_id=current_user.uid)
    except Exception as e:
        logger.error("Failed to list conversations for user %s: %s", current_user.uid, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch conversation list.")


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse, summary="Get conversation details")
def get_conversation(
    conversation_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Retrieve full message history for a conversation belonging to the authenticated user."""
    conv = chat_service.get_conversation(conversation_id, user_id=current_user.uid)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conv


@router.delete("/conversations/{conversation_id}", summary="Delete a conversation")
def delete_conversation(
    conversation_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Delete a conversation and its messages belonging to the authenticated user."""
    deleted = chat_service.delete_conversation(conversation_id, user_id=current_user.uid)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return {"status": "success", "deleted": True}


@router.post("/chat/record-outcome", response_model=RecordOutcomeResponse, summary="Record verified repair outcome")
def record_outcome(
    req: RecordOutcomeRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Record confirmed equipment repair outcome:
    - Retains to SQLite verified episodic database scoped to user.
    - Optionally retains to Hindsight Cloud (guarded for credit preservation and user isolation).
    - Distinguishes successful vs unsuccessful repairs for future recall.
    """
    try:
        return chat_service.record_outcome(req, user_id=current_user.uid)
    except Exception as e:
        logger.error("Failed to record outcome for user %s: %s", current_user.uid, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to record repair outcome.")


@router.get("/memories", response_model=MemoryListResponse, summary="Search and list verified equipment memories")
def list_memories(
    q: Optional[str] = Query("", description="Search keywords"),
    equipment_type: Optional[str] = Query(None, description="Filter by equipment type"),
    outcome_status: Optional[str] = Query(None, description="Filter by outcome: SUCCESSFUL or UNSUCCESSFUL"),
    limit: int = Query(25, ge=1, le=100),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Search verified past equipment repairs and certified outcomes belonging to the authenticated user."""
    try:
        items = chat_service.search_local_memories(
            query=q or "",
            equipment_type=equipment_type,
            outcome_status=outcome_status,
            limit=limit,
            user_id=current_user.uid,
        )
        return MemoryListResponse(total=len(items), memories=items)
    except Exception as e:
        logger.error("Failed to fetch memories for user %s: %s", current_user.uid, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch memories.")


@router.get("/memories/{memory_id}", response_model=MemoryItemResponse, summary="Get memory details")
def get_memory_detail(
    memory_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Get single verified memory record details for the authenticated user."""
    item = chat_service.get_memory_by_id(memory_id, user_id=current_user.uid)
    if not item:
        raise HTTPException(status_code=404, detail="Memory record not found.")
    return item


@router.get("/chat/status", summary="System settings and connection status")
def get_system_status():
    """Retrieve active AI engine, Hindsight bank, and mock-memory protection status (public operational status)."""
    return {
        "status": "operational",
        "version": "2.0.0",
        "ai_engine": settings.GROQ_MODEL,
        "memory_bank": settings.HINDSIGHT_BANK_ID,
        "hindsight_mock_mode": settings.HINDSIGHT_MOCK_MODE,
        "credit_preservation_active": True,
    }


@router.post("/chat/sync-outcome/{verification_id}", summary="Retry syncing outcome to Hindsight Cloud")
def retry_sync_outcome(
    verification_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Retry synchronizing a locally recorded repair outcome with Hindsight Cloud for the authenticated user."""
    try:
        return chat_service.retry_sync_outcome(verification_id, user_id=current_user.uid)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Failed to retry sync for verification %s (user %s): %s", verification_id, current_user.uid, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to synchronize record with Hindsight Cloud.")


@router.post("/transcribe", response_model=TranscriptionResponse, summary="Transcribe speech with multilingual Groq Whisper")
async def transcribe_audio(
    file: UploadFile = File(..., description="Audio recording file (webm, wav, mp3, m4a, ogg)"),
    language: Optional[str] = Query(None, description="Optional ISO language code or hint"),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Multilingual speech transcription powered by Groq Whisper.
    Supports auto-language detection across English, Hindi, Kannada, Tamil, Telugu,
    Malayalam, Marathi, Bengali, Urdu, and Hinglish/code-switching. Requires authentication.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

        res = transcription_service.transcribe_audio(
            file_bytes=content,
            filename=file.filename or "recording.webm",
            content_type=file.content_type,
            language=language,
        )
        return TranscriptionResponse(**res)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Transcription failed for user %s: %s", current_user.uid, e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Speech transcription failed: {str(e)}",
        )


