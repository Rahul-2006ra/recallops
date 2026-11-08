import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.models.incident import IncidentCreate, RepairCreate, VerifyOutcomeCreate
from backend.services.investigation_service import investigation_service
from hindsight_client_api.exceptions import ApiException

client = TestClient(app)


@pytest.fixture
def sample_incident():
    """Create a temporary incident for testing."""
    data = IncidentCreate(
        machine_id="M-MOCK-001",
        equipment_type="Centrifugal Slurry Pump",
        symptoms="High vibration at 7.1 mm/s and drive end thermal spike",
        severity="HIGH",
        reported_observations="Vibration measured with handheld accelerometer. Casing warm to touch.",
        is_demo=True,
    )
    inc = investigation_service.create_incident(data)
    return inc


def test_successful_memory_retrieval(sample_incident):
    """Test investigation when Hindsight Cloud successfully returns relevant precedents."""
    mock_memories = [
        {
            "text": "Centrifugal Slurry Pump M-112 had shaft misalignment causing 7.2 mm/s vibration. Laser aligned coupling and dynamically balanced impeller. Verified SUCCESSFUL.",
            "score": 0.89,
            "document_id": "OUTCOME-M-112",
        },
        {
            "text": "DEMO-M-108 had overheating; replaced bearings. Verified UNSUCCESSFUL.",
            "score": 0.65,
            "document_id": "OUTCOME-DEMO-M-108",
        },
    ]

    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", return_value=mock_memories), \
         patch("backend.services.hindsight_service.hindsight_service.reflect_on_incident", return_value="Verified precedent M-112 resolved misalignment."):

        resp = client.post(f"/api/incidents/{sample_incident.id}/investigate")
        assert resp.status_code == 200
        data = resp.json()

        assert data["incident_id"] == sample_incident.id
        assert "diagnosis_hypothesis" in data
        assert 0.0 <= data["confidence"] <= 1.0
        assert len(data["recommended_diagnostic_steps"]) > 0


def test_failed_memory_retrieval_empty_provenance(sample_incident):
    """Test investigation when Hindsight Cloud returns zero matching memories (empty bank)."""
    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", return_value=[]), \
         patch("backend.services.hindsight_service.hindsight_service.reflect_on_incident", return_value=None):

        resp = client.post(f"/api/incidents/{sample_incident.id}/investigate")
        assert resp.status_code == 200
        data = resp.json()

        assert data["relevant_historical_incidents"] == []
        assert data["unsuccessful_previous_repairs"] == []
        # Check diagnosis is still made based on current symptoms
        assert len(data["diagnosis_hypothesis"]) > 0


def test_http_402_payment_required_on_recall(sample_incident):
    """Test behavior when Hindsight Cloud returns HTTP 402 Payment Required during memory recall."""
    api_exc = ApiException(
        status=402,
        reason="Payment Required",
        http_resp=MagicMock(data=b'{"detail":"Insufficient credits. Balance: $0.00"}'),
    )

    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", side_effect=api_exc):
        resp = client.post(f"/api/incidents/{sample_incident.id}/investigate")
        # Currently, an uncaught recall error bubbles up as HTTP 500 with diagnostic failure detail
        assert resp.status_code == 500
        assert "Diagnostic investigation failed" in resp.json()["detail"]


def test_successful_verified_outcome_retention(sample_incident):
    """Test that when Hindsight retention succeeds, hindsight_retained is True and doc ID is assigned."""
    # Step 1: Log repair
    rep_data = RepairCreate(
        technician_id="TECH-888",
        action_taken="Realigned motor-pump coupling and torqued bolts to 90 Nm.",
        notes="Coupling offset was 0.08mm out of spec.",
    )
    rep_resp = client.post(f"/api/incidents/{sample_incident.id}/repair", json=rep_data.model_dump())
    assert rep_resp.status_code == 201

    # Step 2: Verify outcome with mocked successful Hindsight retain
    ver_data = VerifyOutcomeCreate(
        verified_by="LEAD-ENG-001",
        outcome_status="SUCCESSFUL",
        inspection_notes="Vibration dropped to 1.1 mm/s during 60-min test run. Temperature stable.",
        follow_up_metrics={"vibration_mm_s": 1.1, "temp_c": 49},
    )

    with patch("backend.services.hindsight_service.hindsight_service.retain_incident_outcome", return_value={"status": "retained"}):
        ver_resp = client.post(f"/api/incidents/{sample_incident.id}/verify-outcome", json=ver_data.model_dump())
        assert ver_resp.status_code == 201
        res_data = ver_resp.json()

        assert res_data["hindsight_retained"] is True
        assert res_data["hindsight_document_id"] == f"OUTCOME-{sample_incident.id}"
        assert res_data["outcome_status"] == "SUCCESSFUL"


def test_failed_memory_retention_resilience_and_no_false_success(sample_incident):
    """
    Test that when Hindsight Cloud retention fails (HTTP 402 or connection drop),
    the endpoint does NOT crash, records local verification, and explicitly returns
    hindsight_retained=False (NO false positive confirmation).
    """
    # Step 1: Log repair
    rep_data = RepairCreate(
        technician_id="TECH-888",
        action_taken="Cleaned pump casing and cleared clogged cooling intake fins.",
        notes="Dust accumulation removed.",
    )
    rep_resp = client.post(f"/api/incidents/{sample_incident.id}/repair", json=rep_data.model_dump())
    assert rep_resp.status_code == 201

    # Step 2: Verify outcome with Hindsight retain raising HTTP 402
    api_exc = ApiException(
        status=402,
        reason="Payment Required",
        http_resp=MagicMock(data=b'{"detail":"Insufficient credits. Balance: $0.00"}'),
    )

    ver_data = VerifyOutcomeCreate(
        verified_by="LEAD-ENG-001",
        outcome_status="SUCCESSFUL",
        inspection_notes="Thermal camera shows temperature normalized to 51°C.",
        follow_up_metrics={"temp_c": 51.0},
    )

    with patch("backend.services.hindsight_service.hindsight_service.retain_incident_outcome", side_effect=api_exc):
        ver_resp = client.post(f"/api/incidents/{sample_incident.id}/verify-outcome", json=ver_data.model_dump())
        assert ver_resp.status_code == 201
        res_data = ver_resp.json()

        # Crucial: Must be False, never falsely claiming retention succeeded!
        assert res_data["hindsight_retained"] is False
        assert res_data["outcome_status"] == "SUCCESSFUL"

        # Check detail endpoint reflects exact state
        detail_resp = client.get(f"/api/incidents/{sample_incident.id}")
        assert detail_resp.status_code == 200
        ver_record = detail_resp.json()["verifications"][0]
        assert ver_record["hindsight_retained"] is False
