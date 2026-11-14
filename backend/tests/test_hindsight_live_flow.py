"""
Integration tests for RecallOps 2.0 Hindsight Cloud live memory retention and retrieval flow.
Verifies simulated incident PUMP-DEMO-101 across local and cloud retention, blending, and deduplication.
"""

from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.chat_service import chat_service
from backend.models.chat import RecordOutcomeRequest

client = TestClient(app)

MOCK_USER_ALPHA = {
    "uid": "tech_alpha_live",
    "email": "alpha_live@plant.internal",
    "name": "Technician Alpha Live",
}

AUTH_HEADER_ALPHA = {"Authorization": "Bearer mock-token-alpha-live"}


@patch("backend.auth.auth.verify_id_token", return_value=MOCK_USER_ALPHA)
def test_simulated_pump_demo_101_retention_and_blending(mock_auth):
    """
    Test full lifecycle of simulated incident PUMP-DEMO-101:
    - Equipment: Cooling-water pump CP-204
    - Root cause: Worn drive-end bearing and insufficient lubrication
    - Failed action: Coupling alignment adjustment (UNSUCCESSFUL)
    - Successful action: Bearing replacement and lubrication restoration (SUCCESSFUL)
    - Verified outcome: Temperature 54°C, discharge pressure 4.2 bar, vibration normalized
    """
    # 1. Record Failed Attempt
    req_failed = RecordOutcomeRequest(
        machine_id="CP-204",
        equipment_type="Cooling-water pump",
        symptoms="High vibration and casing overheating to 85°C",
        action_taken="Coupling alignment adjustment",
        outcome_status="UNSUCCESSFUL",
        technician_id="TECH-PUMP-LEAD",
        inspection_notes="Vibration remained at 8.2 mm/s RMS; temperature did not drop.",
        follow_up_metrics={"vibration_rms": 8.2, "temperature_c": 85},
        mock_memory=True,
    )
    resp_failed = chat_service.record_outcome(req_failed, user_id=MOCK_USER_ALPHA["uid"])
    assert resp_failed.success is True
    assert resp_failed.sync_status == "local_only"
    assert resp_failed.hindsight_retained is False

    # 2. Record Successful Outcome with Live Retain Mocked Client Response
    mock_retain_resp = MagicMock()
    mock_retain_resp.success = True
    mock_retain_resp.document_id = "OUTCOME-PUMP-DEMO-101"

    req_success = RecordOutcomeRequest(
        machine_id="CP-204",
        equipment_type="Cooling-water pump",
        symptoms="High vibration and casing overheating to 85°C",
        action_taken="Bearing replacement and lubrication restoration",
        outcome_status="SUCCESSFUL",
        technician_id="TECH-PUMP-LEAD",
        inspection_notes="Replaced worn drive-end bearing with SKF Explorer. Temperature 54°C, discharge pressure 4.2 bar, vibration normalized.",
        follow_up_metrics={"vibration_rms": 1.4, "temperature_c": 54, "discharge_pressure_bar": 4.2},
        live_retain=True,
    )

    with patch("backend.services.hindsight_service.hindsight_service.retain_incident_outcome", return_value=mock_retain_resp):
        resp_success = chat_service.record_outcome(req_success, user_id=MOCK_USER_ALPHA["uid"])
        assert resp_success.success is True
        assert resp_success.sync_status == "synced"
        assert resp_success.hindsight_retained is True

    # 3. Test Memories Retrieval in Mock Mode
    memories_mock = chat_service.get_memories(
        query="CP-204",
        mock_memory=True,
        user_id=MOCK_USER_ALPHA["uid"],
    )
    assert len(memories_mock) >= 2
    actions = [m.action_taken for m in memories_mock]
    assert "Coupling alignment adjustment" in actions
    assert "Bearing replacement and lubrication restoration" in actions

    # 4. Test Memories Retrieval in Live Mode (Blending Hindsight Cloud)
    mock_cloud_item = {
        "text": (
            "[VERIFIED INDUSTRIAL MAINTENANCE RECORD]\n"
            "Incident ID: PUMP-DEMO-101\n"
            "Machine ID: CP-204\n"
            "Equipment Type: Cooling-water pump\n"
            "Reported Symptoms: High vibration and casing overheating to 85°C\n"
            "Repair Action: Bearing replacement and lubrication restoration\n"
            "Verified Outcome: SUCCESSFUL\n"
            "Inspection Notes: Temperature 54°C, discharge pressure 4.2 bar, vibration normalized.\n"
            "Technician ID: TECH-PUMP-LEAD\n"
            "Verification Date: 2026-11-14T07:00:00Z"
        ),
        "document_id": "OUTCOME-PUMP-DEMO-101",
        "tags": ["user-tech_alpha_live", "machine-cp-204", "outcome-successful"],
    }

    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", return_value=[mock_cloud_item]):
        memories_live = chat_service.get_memories(
            query="CP-204",
            mock_memory=False,
            user_id=MOCK_USER_ALPHA["uid"],
        )
        assert len(memories_live) >= 2
        # Verify deduplication: bearing replacement should appear once and have sync_status='synced'
        bearing_records = [m for m in memories_live if "Bearing replacement" in m.action_taken]
        assert len(bearing_records) == 1
        assert bearing_records[0].sync_status == "synced"
        assert bearing_records[0].storage_engine == "hindsight_cloud"
        assert bearing_records[0].hindsight_retained is True

    # 5. Test API endpoint /api/memories via TestClient
    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", return_value=[mock_cloud_item]):
        res = client.get("/api/memories?q=CP-204&mock_memory=false", headers=AUTH_HEADER_ALPHA)
        assert res.status_code == 200
        data = res.json()
        assert "memories" in data
        assert any(m["machine_id"] == "CP-204" for m in data["memories"])
        success_mem = next(m for m in data["memories"] if "Bearing replacement" in m["action_taken"])
        assert success_mem["sync_status"] == "synced"
        assert success_mem["storage_engine"] == "hindsight_cloud"
