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
    """
    Test behavior when Hindsight Cloud returns HTTP 402 Payment Required during memory recall.
    Must return HTTP 503 with structured error_code MEMORY_SERVICE_CREDITS_EXHAUSTED.
    Must not expose keys or stack traces, and must not create an invalid investigation record.
    """
    api_exc = ApiException(
        status=402,
        reason="Payment Required",
        http_resp=MagicMock(data=b'{"detail":"Insufficient credits. Balance: $0.00"}'),
    )

    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", side_effect=api_exc):
        resp = client.post(f"/api/incidents/{sample_incident.id}/investigate")
        assert resp.status_code == 503
        data = resp.json()
        assert "detail" in data
        assert data["detail"]["error_code"] == "MEMORY_SERVICE_CREDITS_EXHAUSTED"
        assert "temporarily unavailable" in data["detail"]["message"].lower()

        # Check incident records in SQLite remain untouched
        detail_resp = client.get(f"/api/incidents/{sample_incident.id}")
        assert detail_resp.status_code == 200
        assert len(detail_resp.json()["investigations"]) == 0


def test_unexpected_hindsight_api_error_on_recall(sample_incident):
    """
    Test behavior when Hindsight Cloud returns a 502/503 gateway error or timeout.
    Must return HTTP 503 with structured error_code MEMORY_SERVICE_UNAVAILABLE.
    """
    api_exc = ApiException(
        status=503,
        reason="Service Unavailable: Gateway timeout upstream",
    )

    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", side_effect=api_exc):
        resp = client.post(f"/api/incidents/{sample_incident.id}/investigate")
        assert resp.status_code == 503
        data = resp.json()
        assert data["detail"]["error_code"] == "MEMORY_SERVICE_UNAVAILABLE"


def test_failed_verification_without_repair(sample_incident):
    """
    Test that verifying an outcome before logging a repair action fails safely (HTTP 400).
    """
    ver_data = VerifyOutcomeCreate(
        verified_by="LEAD-ENG-001",
        outcome_status="SUCCESSFUL",
        inspection_notes="Attempting premature verification.",
    )
    resp = client.post(f"/api/incidents/{sample_incident.id}/verify-outcome", json=ver_data.model_dump())
    assert resp.status_code == 400
    assert "No technician repair action has been recorded" in resp.json()["detail"]


def test_failed_verification_status_conflict(sample_incident):
    """
    Test that conflicting verification statuses (SUCCESSFUL vs UNSUCCESSFUL) raise HTTP 409 Conflict.
    """
    # 1. Log repair
    rep_data = RepairCreate(
        technician_id="TECH-100",
        action_taken="Replaced mechanical seal face.",
    )
    client.post(f"/api/incidents/{sample_incident.id}/repair", json=rep_data.model_dump())

    # 2. Verify as SUCCESSFUL
    ver_data1 = VerifyOutcomeCreate(
        verified_by="TECH-100",
        outcome_status="SUCCESSFUL",
        inspection_notes="Initial test passed.",
    )
    with patch("backend.services.hindsight_service.hindsight_service.retain_incident_outcome", return_value={"status": "ok"}):
        res1 = client.post(f"/api/incidents/{sample_incident.id}/verify-outcome", json=ver_data1.model_dump())
        assert res1.status_code == 201

    # 3. Attempt to verify as UNSUCCESSFUL -> 409 Conflict
    ver_data2 = VerifyOutcomeCreate(
        verified_by="TECH-200",
        outcome_status="UNSUCCESSFUL",
        inspection_notes="Attempting conflicting status.",
    )
    res2 = client.post(f"/api/incidents/{sample_incident.id}/verify-outcome", json=ver_data2.model_dump())
    assert res2.status_code == 409
    assert "already been verified as SUCCESSFUL" in res2.json()["detail"]


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


def test_hindsight_service_direct_classification_on_402():
    """Test that direct calls to hindsight_service.recall_memories wrap 402 in MemoryServiceQuotaExhaustedError."""
    from backend.services.hindsight_service import hindsight_service, MemoryServiceQuotaExhaustedError
    mock_client = MagicMock()
    mock_client.recall.side_effect = ApiException(status=402, reason="Payment Required")

    with patch.object(hindsight_service, "get_client", return_value=mock_client):
        with pytest.raises(MemoryServiceQuotaExhaustedError) as exc_info:
            hindsight_service.recall_memories(query="test query")
        assert exc_info.value.status_code == 503
        assert exc_info.value.error_code == "MEMORY_SERVICE_CREDITS_EXHAUSTED"


def test_hindsight_service_reflect_graceful_on_error():
    """Test that hindsight_service.reflect_on_incident returns None without crashing on API errors."""
    from backend.services.hindsight_service import hindsight_service
    mock_client = MagicMock()
    mock_client.reflect.side_effect = ApiException(status=402, reason="Payment Required")

    with patch.object(hindsight_service, "get_client", return_value=mock_client):
        result = hindsight_service.reflect_on_incident(query="test query")
        assert result is None
