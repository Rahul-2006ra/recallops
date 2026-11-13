import uuid
import json
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db

client = TestClient(app)


def test_phase5_conversation_a_to_b_learning_lifecycle():
    """
    Task 2: Validate Complete Learning Lifecycle (Conversation A -> Conversation B)
    Conv A: Problem -> Explanation -> Outcome Report -> Confirmation -> Permanent Save
    Conv B: Fresh session -> Problem recurs -> Precedent recalled -> Calibrated evidence reply
    """
    # --- CONVERSATION A ---
    # Turn 1: User reports problem
    r_a1 = client.post(
        "/api/chat",
        json={
            "message": "My industrial pump is vibrating and overheating.",
            "mock_memory": True,
        },
    )
    assert r_a1.status_code == 200
    d_a1 = r_a1.json()
    conv_id = d_a1["conversation_id"]
    assert d_a1["intent"] == "TROUBLESHOOTING_QUERY"
    assert "Pump" in d_a1["equipment_detected"]["equipment_type"]
    assert "Plausible Causes" in d_a1["reply"]

    # Turn 2: User reports technician repair outcome
    r_a2 = client.post(
        "/api/chat",
        json={
            "message": "The technician cleaned the blocked cooling fins and the pump is now working normally.",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r_a2.status_code == 200
    d_a2 = r_a2.json()
    assert d_a2["intent"] == "REPORT_OUTCOME"

    outcome = d_a2["outcome_to_record"]
    assert outcome is not None
    # Verify 5 extraction dimensions
    assert "Pump" in outcome["equipment_type"]
    assert "vibrat" in outcome["symptoms"].lower() or "overheat" in outcome["symptoms"].lower()
    assert "cooling fins" in outcome["action_taken"].lower()
    assert outcome["outcome_status"] == "SUCCESSFUL"
    assert outcome["verification_status"] == "TECHNICIAN_CONFIRMED"
    assert outcome["verification_source"] == "Technician Field Report"

    # User reviews and confirms the 5-field card to save permanently
    unique_key = f"IDEMP-P5-LIFECYCLE-{uuid.uuid4().hex[:8]}"
    save_resp = client.post(
        "/api/chat/record-outcome",
        json={
            "equipment_type": outcome["equipment_type"],
            "symptoms": outcome["symptoms"],
            "action_taken": outcome["action_taken"],
            "outcome_status": outcome["outcome_status"],
            "machine_id": "EQ-PUMP-P5-01",
            "technician_id": "TECH-P5-LEAD",
            "inspection_notes": "Cooling fins cleared; surface temperature returned to 49C.",
            "conversation_id": conv_id,
            "idempotency_key": unique_key,
            "live_retain": False,
        },
    )
    assert save_resp.status_code == 200
    save_data = save_resp.json()
    assert save_data["success"] is True
    assert save_data["sync_status"] == "local_only"
    assert save_data["hindsight_retained"] is False

    # --- CONVERSATION B ---
    # Completely new conversation session (no conversation_id)
    r_b1 = client.post(
        "/api/chat",
        json={
            "message": "My industrial pump is overheating and vibrating again. What should I check?",
            "mock_memory": True,
        },
    )
    assert r_b1.status_code == 200
    d_b1 = r_b1.json()
    assert d_b1["conversation_id"] != conv_id
    assert d_b1["intent"] == "TROUBLESHOOTING_QUERY"

    # 1. Retrieved the previously recorded experience from persistent storage
    retrieved = d_b1["retrieved_precedents"]
    assert len(retrieved) > 0
    matched_actions = [p["action_taken"].lower() for p in retrieved]
    assert any("cooling fins" in act for act in matched_actions)

    # 2. Source & verification provenance visible
    top_p = retrieved[0]
    assert top_p["verification_status"] in ("TECHNICIAN_CONFIRMED", "SAMPLE_RECORD")
    assert top_p["source"] in ("sqlite_local_db", "sample_fixture")

    # 3. Reply grounds previous repair as evidence, not absolute proof
    reply = d_b1["reply"]
    assert "Plausible Causes" in reply
    assert "Relevant Memory Insight" in reply or "evidence" in reply.lower()


def test_phase5_live_hindsight_recall_structured_parsing():
    """
    Task 1 & 2: Verify that live Hindsight recall accurately parses structured fields
    (Machine ID, Equipment Type, Repair Action, Symptoms, Outcome, Notes) from retained cloud text.
    """
    from backend.services.chat_service import chat_service

    mock_hindsight_item = {
        "document_id": "OUTCOME-INC-P5-TEST-99",
        "text": (
            "[VERIFIED INDUSTRIAL MAINTENANCE RECORD]\n"
            "Incident ID: INC-P5-TEST-99\n"
            "Machine ID: M-LIVE-409\n"
            "Equipment Type: Industrial Centrifugal Slurry Pump\n"
            "Reported Symptoms: Heavy impeller cavitation and thermal spike\n"
            "Severity: HIGH\n"
            "Technician ID: TECH-LEAD-99\n"
            "Repair Action: Replaced worn ceramic mechanical seal and suction liner\n"
            "Parts Replaced: Ceramic mechanical seal\n"
            "Verified Outcome: SUCCESSFUL\n"
            "Inspection Notes: Pressure test passed at 14 bar; zero seal leakage.\n"
            "Verification Date: 2026-11-13T10:00:00Z"
        ),
        "score": 0.94,
    }

    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", return_value=[mock_hindsight_item]), \
         patch("backend.config.settings.HINDSIGHT_MOCK_MODE", False):

        precedents = chat_service.retrieve_precedents(
            query="pump impeller cavitation and thermal spike",
            mock_mode=False,
            equipment_type="Industrial Centrifugal Slurry Pump",
        )

        assert len(precedents) == 1
        p = precedents[0]
        # Verified exact parsing
        assert p.machine_id == "M-LIVE-409"
        assert p.equipment_type == "Industrial Centrifugal Slurry Pump"
        assert p.action_taken == "Replaced worn ceramic mechanical seal and suction liner"
        assert p.outcome_status == "SUCCESSFUL"
        assert p.source == "hindsight_cloud_live"
        assert p.source_label == "Hindsight Cloud (Live Verified)"
        assert "Pressure test passed" in p.inspection_notes


def test_phase5_cross_equipment_isolation_in_live_recall():
    """
    Task 3: Ensure unrelated equipment memories from Hindsight Cloud NEVER contaminate queries.
    If querying a Laptop, live Hindsight pump memories must be strictly filtered out.
    """
    from backend.services.chat_service import chat_service

    mock_pump_item = {
        "document_id": "OUTCOME-INC-PUMP-88",
        "text": (
            "[VERIFIED INDUSTRIAL MAINTENANCE RECORD]\n"
            "Incident ID: INC-PUMP-88\n"
            "Machine ID: M-PUMP-88\n"
            "Equipment Type: Centrifugal Slurry Pump\n"
            "Reported Symptoms: Overheating and vibration\n"
            "Repair Action: Cleaned cooling fins\n"
            "Verified Outcome: SUCCESSFUL"
        ),
        "score": 0.88,
    }

    # Query for Laptop -> pump memory must be filtered out by cross-equipment isolation guard
    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", return_value=[mock_pump_item]), \
         patch("backend.config.settings.HINDSIGHT_MOCK_MODE", False):

        precedents = chat_service.retrieve_precedents(
            query="laptop fan running hot and loud",
            mock_mode=False,
            equipment_type="Commercial Laptop",
        )

        # Pump precedent was dropped by isolation filter
        assert len(precedents) == 0


def test_phase5_sync_status_transitions_and_retry():
    """
    Task 1 & Task 4: Verify accurate sync states ('local_only', 'pending_sync', 'synced', 'sync_failed')
    and test retrying sync for failed records without creating duplicate rows.
    """
    from backend.services.hindsight_service import MemoryServiceUnavailableError

    key_sync_test = f"IDEMP-SYNC-{uuid.uuid4().hex[:8]}"

    # 1. Attempt live retain that fails with upstream network error
    with patch("backend.services.hindsight_service.hindsight_service.retain_incident_outcome", side_effect=MemoryServiceUnavailableError()), \
         patch("backend.config.settings.HINDSIGHT_MOCK_MODE", False):

        r = client.post(
            "/api/chat/record-outcome",
            json={
                "equipment_type": "Centrifugal Pump",
                "symptoms": "Overheating and vibration",
                "action_taken": "Realigned motor coupling",
                "outcome_status": "SUCCESSFUL",
                "machine_id": "EQ-PUMP-SYNC-01",
                "idempotency_key": key_sync_test,
                "live_retain": True,
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        # Truthful sync reporting: local save succeeded, but cloud sync failed
        assert data["sync_status"] == "sync_failed"
        assert data["hindsight_retained"] is False
        verif_id = data["verification_id"]

    # 2. Retry sync endpoint when upstream Hindsight is recovered
    with patch("backend.services.hindsight_service.hindsight_service.retain_incident_outcome", return_value={"status": "retained"}), \
         patch("backend.config.settings.HINDSIGHT_MOCK_MODE", False):

        retry_resp = client.post(f"/api/chat/sync-outcome/{verif_id}")
        assert retry_resp.status_code == 200
        retry_data = retry_resp.json()
        assert retry_data["success"] is True
        assert retry_data["sync_status"] == "synced"

        # Verify DB updated
        with get_db() as conn:
            row = conn.execute("SELECT sync_status, hindsight_retained FROM outcome_verifications WHERE id = ?", (verif_id,)).fetchone()
            assert row["sync_status"] == "synced"
            assert row["hindsight_retained"] == 1


def test_phase5_false_learning_prevention_matrix():
    """
    Task 3: False Learning Prevention Matrix
    - Failed repair cues strictly classify as UNSUCCESSFUL
    - Never labels user-reported as INDEPENDENTLY_VERIFIED
    - Database idempotency prevents duplicate confirmation submissions
    """
    # 1. Failed repair phrase classification
    r_fail = client.post(
        "/api/chat",
        json={
            "message": "The technician replaced the bearing, but the vibration persisted.",
            "mock_memory": True,
        },
    )
    assert r_fail.status_code == 200
    d_fail = r_fail.json()
    assert d_fail["intent"] == "REPORT_OUTCOME"
    assert d_fail["outcome_to_record"]["outcome_status"] == "UNSUCCESSFUL"
    # User-reported is NOT labeled independently verified
    assert d_fail["outcome_to_record"]["verification_status"] == "TECHNICIAN_CONFIRMED"
    assert d_fail["outcome_to_record"]["verification_source"] == "Technician Field Report"

    # 2. Zero-history equipment handling
    r_empty = client.post(
        "/api/chat",
        json={
            "message": "My microwave turntable stopped rotating.",
            "mock_memory": True,
        },
    )
    assert r_empty.status_code == 200
    d_empty = r_empty.json()
    assert len(d_empty["retrieved_precedents"]) == 0
    # No fabricated machine IDs
    assert "M-" not in d_empty["reply"]
    assert "EQ-" not in d_empty["reply"]

    # 3. Duplicate confirmation submission prevention
    idemp_key = f"IDEMP-DUP-TEST-{uuid.uuid4().hex[:8]}"
    payload = {
        "equipment_type": "Centrifugal Pump",
        "symptoms": "Overheating",
        "action_taken": "Cleaned cooling fins",
        "outcome_status": "SUCCESSFUL",
        "idempotency_key": idemp_key,
        "live_retain": False,
    }
    r1 = client.post("/api/chat/record-outcome", json=payload)
    assert r1.status_code == 200
    assert r1.json()["is_duplicate"] is False

    # Second submission with same key
    r2 = client.post("/api/chat/record-outcome", json=payload)
    assert r2.status_code == 200
    assert r2.json()["is_duplicate"] is True
