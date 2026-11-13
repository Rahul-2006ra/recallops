from typing import Any, Optional
from pydantic import BaseModel, Field


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str  # 'user' | 'assistant' | 'system'
    content: str
    metadata: Optional[dict[str, Any]] = None
    created_at: str


class ConversationResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int = 0
    last_message_preview: Optional[str] = None


class ConversationDetailResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    messages: list[MessageResponse] = []


class PrecedentRecord(BaseModel):
    id: str
    machine_id: str
    equipment_type: str
    symptoms: str
    action_taken: str
    outcome_status: str  # 'SUCCESSFUL' | 'UNSUCCESSFUL'
    inspection_notes: Optional[str] = None
    verified_at: Optional[str] = None
    relevance_reason: Optional[str] = None
    source: str = "sample_memory_demo"  # 'sample_memory_demo' | 'hindsight_cloud_live'
    source_label: str = "Sample Plant Record (Demo Mode)"


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: Optional[str] = None
    mock_memory: Optional[bool] = None


class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    reply: str
    intent: str
    equipment_detected: Optional[dict[str, Any]] = None
    hazard_warning: Optional[str] = None
    retrieved_precedents: list[PrecedentRecord] = []
    outcome_to_record: Optional[dict[str, Any]] = None
    suggested_followups: list[str] = []
    created_at: str


class RecordOutcomeRequest(BaseModel):
    equipment_type: str
    symptoms: str
    action_taken: str
    outcome_status: str  # 'SUCCESSFUL' | 'UNSUCCESSFUL'
    machine_id: Optional[str] = "EQ-FIELD"
    inspection_notes: Optional[str] = None
    technician_id: Optional[str] = "TECH-FIELD"
    follow_up_metrics: Optional[dict[str, Any]] = None
    conversation_id: Optional[str] = None
    live_retain: Optional[bool] = False


class RecordOutcomeResponse(BaseModel):
    success: bool
    incident_id: str
    verification_id: str
    hindsight_retained: bool
    message: str
    document_id: Optional[str] = None


class MemoryItemResponse(BaseModel):
    id: str
    incident_id: str
    machine_id: str
    equipment_type: str
    symptoms: str
    action_taken: str
    parts_replaced: Optional[str] = None
    outcome_status: str
    inspection_notes: str
    verified_by: str
    verified_at: str
    hindsight_retained: bool
    hindsight_document_id: Optional[str] = None


class MemoryListResponse(BaseModel):
    total: int
    memories: list[MemoryItemResponse]
