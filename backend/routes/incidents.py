import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from backend.models.incident import (
    IncidentCreate,
    IncidentResponse,
    InvestigationResponse,
    RepairCreate,
    RepairResponse,
    VerifyOutcomeCreate,
    VerifyOutcomeResponse,
    IncidentDetailResponse,
)
from backend.services.investigation_service import investigation_service, OutcomeConflictError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.post(
    "",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new maintenance incident",
)
def create_incident(data: IncidentCreate):
    """
    Register a new maintenance anomaly or equipment incident.
    - Generates a unique incident ID.
    - Distinguishes operator-reported observations from verified diagnoses.
    - Saves incident to SQLite.
    """
    try:
        return investigation_service.create_incident(data)
    except Exception as e:
        logger.error("Failed to create incident: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to register incident.")


@router.get(
    "",
    response_model=list[IncidentResponse],
    summary="List maintenance incidents",
)
def list_incidents(
    machine_id: Optional[str] = Query(None, description="Filter incidents by machine ID"),
    status: Optional[str] = Query(None, description="Filter incidents by status"),
):
    """Retrieve all logged maintenance incidents with optional filters."""
    try:
        return investigation_service.list_incidents(machine_id=machine_id, status=status)
    except Exception as e:
        logger.error("Failed to list incidents: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch incidents.")


@router.get(
    "/{incident_id}",
    response_model=IncidentDetailResponse,
    summary="Get incident details",
)
def get_incident(incident_id: str):
    """Retrieve full incident details, investigation history, logged repairs, and outcome verifications."""
    try:
        return investigation_service.get_incident_details(incident_id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error("Failed to get incident details: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch incident details.")


@router.post(
    "/{incident_id}/investigate",
    response_model=InvestigationResponse,
    summary="Run AI diagnostic investigation",
)
def investigate_incident(incident_id: str):
    """
    Trigger RecallOps intelligence investigation:
    1. Cross-machine historical memory recall in Hindsight Cloud.
    2. Contextual diagnostic reflection over verified past outcomes.
    3. Groq reasoning with strict schema output (grounded, hypothesis-separated, safety-checked).
    """
    try:
        return investigation_service.run_investigation(incident_id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error("Investigation failed for incident %s: %s", incident_id, str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Diagnostic investigation failed: {str(e)}")


@router.post(
    "/{incident_id}/repair",
    response_model=RepairResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record technician repair action",
)
def record_repair(incident_id: str, data: RepairCreate):
    """
    Log a physical repair action taken by a field technician.
    Does NOT mark the incident verified or successful until inspection.
    """
    try:
        return investigation_service.record_repair(incident_id, data)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error("Failed to record repair: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to record repair.")


@router.post(
    "/{incident_id}/verify-outcome",
    response_model=VerifyOutcomeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Verify outcome and retain to persistent memory",
)
def verify_outcome(incident_id: str, data: VerifyOutcomeCreate):
    """
    Submit post-repair inspection outcome (SUCCESSFUL or UNSUCCESSFUL).
    - Stores verified outcome in SQLite.
    - Retains the full episode in Hindsight Cloud for continuous self-learning.
    - Prevents duplicate retention if submitted multiple times.
    """
    try:
        return investigation_service.verify_outcome(incident_id, data)
    except OutcomeConflictError as ce:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(ce))
    except ValueError as ve:
        err_msg = str(ve)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)
    except Exception as e:
        logger.error("Failed to verify outcome: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to verify outcome: {str(e)}")
