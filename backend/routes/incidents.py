import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from backend.auth import AuthenticatedUser, get_current_user
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
from backend.services.hindsight_service import MemoryServiceError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.post(
    "",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new maintenance incident",
)
def create_incident(
    data: IncidentCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Register a new maintenance anomaly or equipment incident for the authenticated user.
    - Generates a unique incident ID.
    - Distinguishes operator-reported observations from verified diagnoses.
    - Saves incident to SQLite scoped to user.
    """
    try:
        return investigation_service.create_incident(data, user_id=current_user.uid)
    except Exception as e:
        logger.error("Failed to create incident for user %s: %s", current_user.uid, str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to register incident.")


@router.get(
    "",
    response_model=list[IncidentResponse],
    summary="List maintenance incidents",
)
def list_incidents(
    machine_id: Optional[str] = Query(None, description="Filter incidents by machine ID"),
    status: Optional[str] = Query(None, description="Filter incidents by status"),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Retrieve all logged maintenance incidents for the authenticated user with optional filters."""
    try:
        return investigation_service.list_incidents(
            machine_id=machine_id,
            status=status,
            user_id=current_user.uid,
        )
    except Exception as e:
        logger.error("Failed to list incidents for user %s: %s", current_user.uid, str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch incidents.")


@router.get(
    "/{incident_id}",
    response_model=IncidentDetailResponse,
    summary="Get incident details",
)
def get_incident(
    incident_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Retrieve full incident details, investigation history, logged repairs, and outcome verifications for the authenticated user."""
    try:
        return investigation_service.get_incident_details(incident_id, user_id=current_user.uid)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error("Failed to get incident details for user %s: %s", current_user.uid, str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch incident details.")


@router.post(
    "/{incident_id}/investigate",
    response_model=InvestigationResponse,
    summary="Run AI diagnostic investigation",
)
def investigate_incident(
    incident_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Trigger RecallOps intelligence investigation:
    1. Cross-machine historical memory recall in Hindsight Cloud under user isolation.
    2. Contextual diagnostic reflection over verified past outcomes.
    3. Groq reasoning with strict schema output (grounded, hypothesis-separated, safety-checked).
    """
    try:
        return investigation_service.run_investigation(incident_id, user_id=current_user.uid)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except MemoryServiceError as mse:
        logger.warning(
            "Memory service unavailable for incident %s (user %s): [%s] %s",
            incident_id,
            current_user.uid,
            mse.error_code,
            mse.message,
        )
        raise HTTPException(
            status_code=mse.status_code,
            detail={
                "error_code": mse.error_code,
                "message": mse.message,
            },
        )
    except Exception as e:
        status_code = getattr(e, "status", None)
        logger.error("Investigation failed for incident %s (user %s, status=%s)", incident_id, current_user.uid, status_code, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "INTERNAL_INVESTIGATION_ERROR",
                "message": "Diagnostic investigation encountered an internal error. Please retry shortly.",
            },
        )


@router.post(
    "/{incident_id}/repair",
    response_model=RepairResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record technician repair action",
)
def record_repair(
    incident_id: str,
    data: RepairCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Log a physical repair action taken by a field technician for an incident owned by the authenticated user.
    Does NOT mark the incident verified or successful until inspection.
    """
    try:
        return investigation_service.record_repair(incident_id, data, user_id=current_user.uid)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error("Failed to record repair for user %s: %s", current_user.uid, str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to record repair.")


@router.post(
    "/{incident_id}/verify-outcome",
    response_model=VerifyOutcomeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Verify outcome and retain to persistent memory",
)
def verify_outcome(
    incident_id: str,
    data: VerifyOutcomeCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Submit post-repair inspection outcome (SUCCESSFUL or UNSUCCESSFUL) for an incident owned by the authenticated user.
    - Stores verified outcome in SQLite scoped to user.
    - Retains the full episode in Hindsight Cloud with user isolation tags.
    - Prevents duplicate retention if submitted multiple times.
    """
    try:
        return investigation_service.verify_outcome(incident_id, data, user_id=current_user.uid)
    except OutcomeConflictError as ce:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(ce))
    except ValueError as ve:
        err_msg = str(ve)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)
    except Exception as e:
        logger.error("Failed to verify outcome for user %s: %s", current_user.uid, str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to verify outcome: {str(e)}")
