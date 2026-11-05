from datetime import datetime, timezone
from typing import Optional, Literal, Any
from pydantic import BaseModel, Field


class IncidentCreate(BaseModel):
    machine_id: str = Field(..., min_length=1, description="Unique identifier of the machine/asset, e.g. M-104")
    equipment_type: str = Field(..., min_length=1, description="Type or category of equipment, e.g. Centrifugal Pump")
    symptoms: str = Field(..., min_length=1, description="Primary abnormal behavior or symptom observed")
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = Field(
        default="MEDIUM", description="Incident severity level"
    )
    reported_observations: str = Field(
        ...,
        min_length=1,
        description="Initial observations reported by operators (distinguished from verified diagnoses)",
    )
    timestamp: Optional[str] = Field(
        default=None, description="ISO timestamp of observation (defaults to current UTC time)"
    )
    is_demo: bool = Field(default=False, description="Flag indicating synthetic demonstration data")


class IncidentResponse(BaseModel):
    id: str
    machine_id: str
    equipment_type: str
    symptoms: str
    timestamp: str
    severity: str
    reported_observations: str
    status: str
    is_demo: bool
    created_at: str
    updated_at: str


class InvestigationResponse(BaseModel):
    id: str
    incident_id: str
    diagnosis_hypothesis: str
    confidence: float
    recommended_diagnostic_steps: list[str]
    relevant_historical_incidents: list[str]
    supporting_evidence: list[str]
    unsuccessful_previous_repairs: list[str]
    safety_warnings: list[str]
    created_at: str


class RepairCreate(BaseModel):
    technician_id: str = Field(..., min_length=1, description="Identifier of the technician executing the repair")
    action_taken: str = Field(..., min_length=1, description="Specific repair action performed on the equipment")
    parts_replaced: Optional[str] = Field(default=None, description="List or description of any parts replaced")
    notes: Optional[str] = Field(default=None, description="Additional technician repair notes")


class RepairResponse(BaseModel):
    id: str
    incident_id: str
    technician_id: str
    action_taken: str
    parts_replaced: Optional[str]
    notes: Optional[str]
    performed_at: str


class VerifyOutcomeCreate(BaseModel):
    verified_by: str = Field(..., min_length=1, description="Name or ID of inspecting technician/engineer")
    outcome_status: Literal["SUCCESSFUL", "UNSUCCESSFUL"] = Field(
        ..., description="Verification result: SUCCESSFUL or UNSUCCESSFUL"
    )
    inspection_notes: str = Field(
        ..., min_length=1, description="Detailed observations from the follow-up inspection"
    )
    follow_up_metrics: Optional[dict[str, Any]] = Field(
        default=None, description="Optional telemetry or sensor metrics collected during follow-up inspection"
    )


class VerifyOutcomeResponse(BaseModel):
    id: str
    incident_id: str
    verified_by: str
    outcome_status: str
    inspection_notes: str
    follow_up_metrics: Optional[dict[str, Any]]
    hindsight_retained: bool
    hindsight_document_id: Optional[str]
    verified_at: str


class IncidentDetailResponse(BaseModel):
    incident: IncidentResponse
    investigations: list[InvestigationResponse]
    repairs: list[RepairResponse]
    verifications: list[VerifyOutcomeResponse]
