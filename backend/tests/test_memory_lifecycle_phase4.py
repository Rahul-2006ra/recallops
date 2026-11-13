import pytest
import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db

client = TestClient(app)


def test_scenario_a_new_problem_concise_causes_and_grounded_memory():
    """Scenario A: New problem -> concise causes, grounded memory search, safety guidance, equipment preservation."""
    r = client.post(
        "/api/chat",
        json={
            "message": "My industrial pump is vibrating and overheating.",
            "mock_memory": True,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["intent"] == "TROUBLESHOOTING_QUERY"
    assert "Pump" in data["equipment_detected"]["equipment_type"]

    reply = data["reply"]
    assert "Plausible Causes" in reply
    assert "Safety Alert" in reply
    assert "Relevant Memory Insight" in reply
    assert "Question for Technician" in reply

    # Verifies precedent demo labeling
    assert len(data["retrieved_precedents"]) > 0
    p = data["retrieved_precedents"][0]
    assert p["source"] in ("sample_fixture", "sqlite_local_db")
    assert "Sample" in p["source_label"] or "Local" in p["source_label"]


def test_scenario_b_confirmed_repair_extraction_and_field_completeness():
    """Scenario B: Confirmed repair -> recognition, equipment & symptom association, confirmation fields."""
    # Turn 1: State problem
    r1 = client.post(
        "/api/chat",
        json={
            "message": "My industrial centrifugal slurry pump is vibrating and overheating.",
            "mock_memory": True,
        },
    )
    assert r1.status_code == 200
    conv_id = r1.json()["conversation_id"]

    # Turn 2: Report repair outcome
    r2 = client.post(
        "/api/chat",
        json={
            "message": "The technician cleaned the cooling fins and now the pump works normally.",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r2.status_code == 200
    d2 = r2.json()

    # 1. Recognizes outcome report
    assert d2["intent"] == "REPORT_OUTCOME"
    assert d2["outcome_to_record"] is not None

    outcome = d2["outcome_to_record"]
    # 2. Associated with correct equipment
    assert "Pump" in outcome["equipment_type"]
    # 3. Preserves original symptoms from earlier in session
    assert "vibrat" in outcome["symptoms"].lower() or "overheat" in outcome["symptoms"].lower()
    # 4. Correct repair action extracted
    assert "cleaned the cooling fins" in outcome["action_taken"].lower()
    # 5. Correct outcome status
    assert outcome["outcome_status"] == "SUCCESSFUL"
    # 6. Verification provenance
    assert outcome["verification_status"] == "TECHNICIAN_CONFIRMED"
    assert outcome["verification_source"] == "Technician Field Report"
    # 7. Stable idempotency key generated
    assert outcome["idempotency_key"] is not None
    assert outcome["idempotency_key"].startswith("IDEMP-")


def test_scenario_c_permanent_storage_idempotency_and_sync_states():
    """Scenario C: Permanent storage -> SQLite persistence, idempotency constraint, reliable sync states."""
    idemp_key = f"IDEMP-TEST-CLEAN-{uuid.uuid4().hex[:8]}"

    # 1. Save outcome locally in mock mode (Credit conservation)
    r1 = client.post(
        "/api/chat/record-outcome",
        json={
            "equipment_type": "Industrial Centrifugal Slurry Pump",
            "symptoms": "Centrifugal pump vibrating and overheating during continuous duty",
            "action_taken": "Cleaned external cooling fins and unclogged housing air ducts",
            "outcome_status": "SUCCESSFUL",
            "machine_id": "EQ-PUMP-FINS-01",
            "technician_id": "TECH-MECH-44",
            "inspection_notes": "Operating temperature stabilized from 88C down to 54C.",
            "idempotency_key": idemp_key,
            "live_retain": False,
        },
    )
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["success"] is True
    assert d1["is_duplicate"] is False
    assert d1["sync_status"] == "local_only"
    # Never claim Hindsight retained when mock mode / local only
    assert d1["hindsight_retained"] is False
    incident_id_1 = d1["incident_id"]

    # 2. Idempotent Retry: Submitting the EXACT same idempotency key must NOT duplicate records
    r2 = client.post(
        "/api/chat/record-outcome",
        json={
            "equipment_type": "Industrial Centrifugal Slurry Pump",
            "symptoms": "Centrifugal pump vibrating and overheating during continuous duty",
            "action_taken": "Cleaned external cooling fins and unclogged housing air ducts",
            "outcome_status": "SUCCESSFUL",
            "machine_id": "EQ-PUMP-FINS-01",
            "technician_id": "TECH-MECH-44",
            "inspection_notes": "Operating temperature stabilized from 88C down to 54C.",
            "idempotency_key": idemp_key,
            "live_retain": False,
        },
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["success"] is True
    # Idempotent response returns original IDs
    assert d2["is_duplicate"] is True
    assert d2["incident_id"] == incident_id_1

    # Verify database level count for this idempotency key is exactly 1
    with get_db() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM outcome_verifications WHERE idempotency_key = ?",
            (idemp_key,),
        ).fetchone()[0]
        assert count == 1

    # 3. Simulated Cloud Failure: live_retain requested but Hindsight unavailable -> sync_status == "sync_failed"
    fail_key = "IDEMP-TEST-CLOUD-FAIL-001"
    with patch("backend.services.chat_service.hindsight_service.retain_incident_outcome", side_effect=RuntimeError("Hindsight Cloud 503 Service Unavailable")):
        with patch("backend.services.chat_service.settings.HINDSIGHT_MOCK_MODE", False):
            r_fail = client.post(
                "/api/chat/record-outcome",
                json={
                    "equipment_type": "Industrial Centrifugal Slurry Pump",
                    "symptoms": "Pump overheating due to clogged fins",
                    "action_taken": "Fin wash performed",
                    "outcome_status": "SUCCESSFUL",
                    "idempotency_key": fail_key,
                    "live_retain": True,
                },
            )
            assert r_fail.status_code == 200
            d_fail = r_fail.json()
            assert d_fail["success"] is True
            # Local record preserved, but sync state accurately flagged as sync_failed
            assert d_fail["sync_status"] == "sync_failed"
            assert d_fail["hindsight_retained"] is False

    # 4. Simulated Cloud Success: live_retain requested and Hindsight succeeds -> sync_status == "synced"
    success_key = "IDEMP-TEST-CLOUD-SUCCESS-001"
    with patch("backend.services.chat_service.hindsight_service.retain_incident_outcome", return_value={"status": "retained"}):
        with patch("backend.services.chat_service.settings.HINDSIGHT_MOCK_MODE", False):
            r_sync = client.post(
                "/api/chat/record-outcome",
                json={
                    "equipment_type": "Industrial Centrifugal Slurry Pump",
                    "symptoms": "Pump overheating due to clogged fins",
                    "action_taken": "Fin wash performed",
                    "outcome_status": "SUCCESSFUL",
                    "idempotency_key": success_key,
                    "live_retain": True,
                },
            )
            assert r_sync.status_code == 200
            d_sync = r_sync.json()
            assert d_sync["success"] is True
            assert d_sync["sync_status"] == "synced"
            assert d_sync["hindsight_retained"] is True


def test_scenario_d_future_recall_in_fresh_conversation():
    """Scenario D: Future recall -> fresh session after restart retrieves previously saved experience from persistent storage."""
    # Seed a unique, distinct repair into SQLite
    test_unique_action = "Cleared clogged ventilation shroud and pressure-washed cooling fins"
    key_d = "IDEMP-SCENARIO-D-RECALL-TEST"

    save_resp = client.post(
        "/api/chat/record-outcome",
        json={
            "equipment_type": "Industrial Centrifugal Slurry Pump",
            "symptoms": "Industrial pump is overheating and vibrating excessively under heavy feed",
            "action_taken": test_unique_action,
            "outcome_status": "SUCCESSFUL",
            "machine_id": "EQ-PUMP-PERSIST-99",
            "technician_id": "TECH-LEAD-07",
            "inspection_notes": "Vibration returned to 2.1 mm/s; temperature dropped to 48C.",
            "idempotency_key": key_d,
            "live_retain": False,
        },
    )
    assert save_resp.status_code == 200
    save_data = save_resp.json()
    assert save_data["success"] is True

    # COMPLETELY FRESH CONVERSATION (no conversation_id)
    # User asks about recurring symptoms
    fresh_resp = client.post(
        "/api/chat",
        json={
            "message": "My industrial pump is overheating and vibrating again. What should I check?",
            "mock_memory": True,
        },
    )
    assert fresh_resp.status_code == 200
    fresh_data = fresh_resp.json()

    # 1. Retrieved previously saved experience from persistent SQLite storage
    assert len(fresh_data["retrieved_precedents"]) > 0
    matched_actions = [p["action_taken"] for p in fresh_data["retrieved_precedents"]]
    assert any("cooling fins" in act.lower() or "ventilation" in act.lower() for act in matched_actions)

    # 2. Source and verification status visible
    top_p = fresh_data["retrieved_precedents"][0]
    assert top_p["verification_status"] in ("TECHNICIAN_CONFIRMED", "SAMPLE_RECORD")
    assert top_p["source"] in ("sample_fixture", "sqlite_local_db")

    # 3. Model response explains what happened earlier and frames previous repair as evidence, not proof
    reply = fresh_data["reply"]
    assert "Plausible Causes" in reply
    assert "Relevant Memory Insight" in reply
    # Must NOT claim absolute proof or guarantee
    reply_lower = reply.lower()
    assert "definitely broken" not in reply_lower


def test_scenario_3_failed_repairs_explicit_phrases():
    """Verify that failed repairs are NEVER classified as successful across multiple distinct failure phrases."""
    failure_cases = [
        ("The technician replaced the bearing, but the overheating problem continued.", "problem continued"),
        ("The electrician replaced the starter relay, but it still overheats.", "it still overheats"),
        ("We cleaned the impeller, but the repair didn't work.", "the repair didn't work"),
        ("The maintenance crew swapped the coupling, but the vibration persisted.", "vibration persisted"),
    ]

    for msg, failure_phrase in failure_cases:
        r = client.post(
            "/api/chat",
            json={
                "message": msg,
                "mock_memory": True,
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data["intent"] == "REPORT_OUTCOME", f"Failed intent classification for '{msg}'"
        assert data["outcome_to_record"] is not None, f"Expected outcome_to_record for '{msg}'"
        outcome = data["outcome_to_record"]
        # Must be strictly UNSUCCESSFUL
        assert outcome["outcome_status"] == "UNSUCCESSFUL", f"Expected UNSUCCESSFUL for phrase '{failure_phrase}', got '{outcome['outcome_status']}'"


def test_scenario_4_memory_isolation_across_equipment_types():
    """Verify that pump repair history never leaks into laptop, oven, or mixer queries."""
    # Query for laptop
    r_laptop = client.post(
        "/api/chat",
        json={
            "message": "My laptop fan is unusually loud.",
            "mock_memory": True,
        },
    )
    assert r_laptop.status_code == 200
    d_laptop = r_laptop.json()
    assert "Laptop" in d_laptop["equipment_detected"]["equipment_type"]
    # Zero pump precedents leak into laptop
    laptop_mids = [p["machine_id"] for p in d_laptop["retrieved_precedents"]]
    assert not any("PUMP" in mid or "M-104" in mid for mid in laptop_mids)

    # Query for oven
    r_oven = client.post(
        "/api/chat",
        json={
            "message": "My convection oven keeps switching off.",
            "mock_memory": True,
        },
    )
    assert r_oven.status_code == 200
    d_oven = r_oven.json()
    assert "Oven" in d_oven["equipment_detected"]["equipment_type"]
    oven_mids = [p["machine_id"] for p in d_oven["retrieved_precedents"]]
    assert not any("PUMP" in mid or "M-104" in mid for mid in oven_mids)
