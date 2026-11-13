import pytest
import uuid
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.chat_service import chat_service
from backend.models.chat import ChatRequest, RecordOutcomeRequest
from backend.database import get_db

client = TestClient(app)

@pytest.fixture
def clean_db():
    """Ensure database is accessible and clean up any transient test entries."""
    yield
    # Cleanup any test-specific verifications if needed
    with get_db() as conn:
        conn.execute("DELETE FROM outcome_verifications WHERE idempotency_key LIKE 'IDEMP-TEST-P6-%'")
        conn.execute("DELETE FROM outcome_verifications WHERE incident_id LIKE 'INC-P6-%'")

# =========================================================================
# Scenario A: New equipment problem
# =========================================================================
def test_scenario_a_new_equipment_problem():
    """
    User: 'My industrial pump is vibrating and overheating. What could be wrong?'
    Expected: Understand equipment/symptoms, identify plausible causes, provide safety guidance,
    retrieve relevant historical records, distinguish previous repair evidence from current diagnosis.
    """
    req = ChatRequest(
        message="My industrial pump is vibrating and overheating. What could be wrong?",
        mock_memory=True,
    )
    resp = chat_service.process_chat(req)

    # 1. Equipment detected
    assert resp.equipment_detected is not None
    assert "pump" in resp.equipment_detected["equipment_type"].lower()

    # 2. Intent classified as troubleshooting
    assert resp.intent == "TROUBLESHOOTING_QUERY"

    # 3. Plausible causes & safety alert included
    content = resp.reply
    assert "Plausible Causes" in content or "Causes" in content
    assert "Safety Alert" in content or "Protocol" in content

    # 4. Memory precedents retrieved if available
    assert len(resp.retrieved_precedents) > 0
    # Provenance and distinction
    for p in resp.retrieved_precedents:
        assert p.machine_id is not None
        assert p.outcome_status in ("SUCCESSFUL", "UNSUCCESSFUL")
        assert "sample" in p.source.lower() or "demo" in p.source_label.lower() or "sqlite" in p.source.lower()

    # 5. Cautious diagnostic language
    assert "definitely defective" not in content.lower()
    assert "definitive proof" in content.lower() or "historical evidence" in content.lower() or "plausible" in content.lower()

# =========================================================================
# Scenario B: Natural follow-up (Simplify)
# =========================================================================
def test_scenario_b_natural_followup_simplify():
    """
    User: 'Explain that in simpler words.'
    Expected: Remember industrial pump, explain earlier causes simply,
    avoid repeating entire diagnostic template or memory cards.
    """
    # Turn 1: Initial problem
    conv = chat_service.create_conversation("Pump Vibration Problem")
    c_id = conv["id"]

    chat_service.process_chat(ChatRequest(
        conversation_id=c_id,
        message="My industrial pump is vibrating and overheating.",
        mock_memory=True,
    ))

    # Turn 2: Simplify follow-up
    resp2 = chat_service.process_chat(ChatRequest(
        conversation_id=c_id,
        message="Explain that in simpler words.",
        mock_memory=True,
    ))

    # Context preserved
    assert resp2.equipment_detected is not None
    assert "pump" in resp2.equipment_detected["equipment_type"].lower()
    assert resp2.intent == "FOLLOWUP_SIMPLIFY"

    # Concise: no template repetition
    assert "Plausible Causes:" not in resp2.reply
    assert "Safety Alert:" not in resp2.reply
    assert "Question for Technician:" not in resp2.reply

    # Memory cards suppressed for simple follow-up
    assert len(resp2.retrieved_precedents) == 0

    # Short and simple (<95 words)
    assert len(resp2.reply.split()) < 95

# =========================================================================
# Scenario C: Technician guidance
# =========================================================================
def test_scenario_c_technician_guidance():
    """
    User: 'What should I ask my technician?'
    Expected: Provide 2-3 useful questions, refer to current symptoms,
    avoid claiming a specific component is definitely faulty.
    """
    conv = chat_service.create_conversation("Technician Query")
    c_id = conv["id"]

    chat_service.process_chat(ChatRequest(
        conversation_id=c_id,
        message="My industrial pump is vibrating and overheating.",
        mock_memory=True,
    ))

    resp_tech = chat_service.process_chat(ChatRequest(
        conversation_id=c_id,
        message="What should I ask my technician?",
        mock_memory=True,
    ))

    assert resp_tech.intent == "FOLLOWUP_TECHNICIAN_QUESTIONS"
    assert "pump" in resp_tech.equipment_detected["equipment_type"].lower()

    # Contains targeted technician questions
    content = resp_tech.reply.lower()
    assert any(term in content for term in ["bearing", "alignment", "cooling", "vibration", "inspect", "measure", "check"])
    assert "definitely defective" not in content

    # Concise, no repeating full 4-section template
    assert "Plausible Causes:" not in resp_tech.reply

# =========================================================================
# Scenario D: Successful repair outcome & idempotency
# =========================================================================
def test_scenario_d_successful_repair_outcome_and_idempotency():
    """
    User: 'The technician cleaned the blocked cooling fins and the pump works normally now.'
    Expected: Detect outcome, extract symptoms, identify action, classify as successful,
    present 5-field card, save only after explicit confirmation, prevent duplicate records.
    """
    conv = chat_service.create_conversation("Outcome Repair Conv")
    c_id = conv["id"]

    # Initial context
    chat_service.process_chat(ChatRequest(
        conversation_id=c_id,
        message="My industrial pump is vibrating and overheating.",
        mock_memory=True,
    ))

    # Report outcome
    resp_outcome = chat_service.process_chat(ChatRequest(
        conversation_id=c_id,
        message="The technician cleaned the blocked cooling fins and the pump works normally now.",
        mock_memory=True,
    ))

    assert resp_outcome.intent == "REPORT_OUTCOME"
    assert resp_outcome.outcome_to_record is not None

    card = resp_outcome.outcome_to_record
    assert card["outcome_status"] == "SUCCESSFUL"
    assert "cleaned" in card["action_taken"].lower()
    assert card["verification_status"] == "TECHNICIAN_CONFIRMED"
    assert card["idempotency_key"] is not None

    # Explicit confirmation via endpoint
    test_idemp = f"IDEMP-TEST-P6-{uuid.uuid4().hex[:8]}"
    confirm_req = RecordOutcomeRequest(
        conversation_id=c_id,
        equipment_type="Centrifugal Slurry Pump",
        symptoms="Vibrating and overheating under load",
        action_taken="Cleaned the blocked cooling fins",
        outcome_status="SUCCESSFUL",
        machine_id="EQ-PUMP-P6-D",
        live_retain=False,
        idempotency_key=test_idemp,
    )

    # 1st Submission: Should succeed with sync_status='local_only' (mock mode)
    res1 = chat_service.record_outcome(confirm_req)
    assert res1.success is True
    assert res1.sync_status == "local_only"
    assert res1.is_duplicate is False

    # 2nd Submission (Retry same key): Must be idempotent, no duplicates
    res2 = chat_service.record_outcome(confirm_req)
    assert res2.success is True
    assert res2.is_duplicate is True
    assert res2.document_id == res1.document_id

# =========================================================================
# Scenario E: New conversation and persistent memory recall
# =========================================================================
def test_scenario_e_new_conversation_persistent_recall():
    """
    Open a completely new conversation.
    User: 'My industrial pump is vibrating and overheating again.'
    Expected: Retrieve previously saved repair experience from persistent storage,
    cite its correct identity, explain what worked, distinguish old repair from new diagnosis.
    """
    # 1. Seed a persistent verified outcome record into SQLite
    test_mid = f"EQ-PERSIST-{uuid.uuid4().hex[:6].upper()}"
    test_idemp = f"IDEMP-TEST-P6-{uuid.uuid4().hex[:8]}"

    chat_service.record_outcome(RecordOutcomeRequest(
        equipment_type="Centrifugal Slurry Pump",
        symptoms="Pump vibrating and overheating under continuous operation",
        action_taken="Cleaned blocked cooling fins and inspected impeller",
        outcome_status="SUCCESSFUL",
        machine_id=test_mid,
        live_retain=False,
        idempotency_key=test_idemp,
    ))

    # 2. Open brand new conversation (no shared context)
    new_conv = chat_service.create_conversation("Fresh Session Conversation B")
    new_cid = new_conv["id"]

    resp = chat_service.process_chat(ChatRequest(
        conversation_id=new_cid,
        message="My industrial pump is vibrating and overheating again.",
        mock_memory=True,
    ))

    # Precedents must be retrieved
    assert len(resp.retrieved_precedents) > 0
    precedent_mids = [p.machine_id for p in resp.retrieved_precedents]
    assert any("EQ-" in mid or "M-" in mid for mid in precedent_mids)

    # Distinguishes old repair from confirmed diagnosis
    content = resp.reply
    assert "historical evidence" in content.lower() or "past plant" in content.lower() or "past records" in content.lower()

# =========================================================================
# Scenario F: Failed repair
# =========================================================================
def test_scenario_f_failed_repair():
    """
    User: 'The technician replaced the bearings, but the pump still overheats.'
    Expected: Classify attempted repair as unsuccessful, record failure after confirmation,
    avoid recommending failed action as established solution, preserve both.
    """
    conv = chat_service.create_conversation("Failed Repair Conv")
    c_id = conv["id"]

    chat_service.process_chat(ChatRequest(
        conversation_id=c_id,
        message="My industrial pump is vibrating and overheating.",
        mock_memory=True,
    ))

    resp = chat_service.process_chat(ChatRequest(
        conversation_id=c_id,
        message="The technician replaced the bearings, but the pump still overheats.",
        mock_memory=True,
    ))

    assert resp.intent == "REPORT_OUTCOME"
    assert resp.outcome_to_record is not None
    assert resp.outcome_to_record["outcome_status"] == "UNSUCCESSFUL"
    assert "replaced" in resp.outcome_to_record["action_taken"].lower()

    # Save failed outcome
    test_idemp = f"IDEMP-TEST-P6-{uuid.uuid4().hex[:8]}"
    save_res = chat_service.record_outcome(RecordOutcomeRequest(
        conversation_id=c_id,
        equipment_type="Centrifugal Slurry Pump",
        symptoms="Pump still overheats after run",
        action_taken=resp.outcome_to_record["action_taken"],
        outcome_status="UNSUCCESSFUL",
        machine_id="EQ-PUMP-P6-FAIL",
        live_retain=False,
        idempotency_key=test_idemp,
    ))
    assert save_res.success is True

    # Verify failed record in database has outcome_status="UNSUCCESSFUL"
    with get_db() as conn:
        row = conn.execute("SELECT outcome_status FROM outcome_verifications WHERE idempotency_key = ?", (test_idemp,)).fetchone()
        assert row["outcome_status"] == "UNSUCCESSFUL"

# =========================================================================
# Scenario G: Unrelated equipment (Laptop)
# =========================================================================
def test_scenario_g_unrelated_equipment():
    """
    User: 'My laptop suddenly shuts down.'
    Expected: Do not retrieve unrelated pump records, provide safe general troubleshooting,
    acknowledge when no relevant past experience exists, continue functioning normally.
    """
    conv = chat_service.create_conversation("Laptop Diagnosis")
    c_id = conv["id"]

    resp = chat_service.process_chat(ChatRequest(
        conversation_id=c_id,
        message="My laptop suddenly shuts down.",
        mock_memory=True,
    ))

    assert resp.equipment_detected is not None
    assert "laptop" in resp.equipment_detected["equipment_type"].lower()

    # Isolation: Must NOT retrieve pump records
    for p in resp.retrieved_precedents:
        assert "pump" not in p.equipment_type.lower()
        assert "compressor" not in p.equipment_type.lower()

    # Mentions that no historical precedents exist for laptop
    assert "no historical" in resp.reply.lower() or len(resp.retrieved_precedents) == 0

# =========================================================================
# Scenario H: Natural equipment switching
# =========================================================================
def test_scenario_h_natural_equipment_switching():
    """
    User: 'My oven switches off while cooking.'
    Follow-up: 'Why does it do that?'
    Expected: Recognize active equipment is oven, preserve context,
    explain causes without mixing pump or laptop histories.
    """
    conv = chat_service.create_conversation("Oven Troubleshooting")
    c_id = conv["id"]

    # Turn 1: Oven problem
    resp1 = chat_service.process_chat(ChatRequest(
        conversation_id=c_id,
        message="My oven switches off while cooking.",
        mock_memory=True,
    ))
    assert "oven" in resp1.equipment_detected["equipment_type"].lower()

    # Turn 2: Follow-up "Why does it do that?"
    resp2 = chat_service.process_chat(ChatRequest(
        conversation_id=c_id,
        message="Why does it do that?",
        mock_memory=True,
    ))

    # Active equipment must remain oven
    assert resp2.equipment_detected is not None
    assert "oven" in resp2.equipment_detected["equipment_type"].lower()
    assert resp2.intent in ("FOLLOWUP_WHY_OR_HOW", "FOLLOWUP_GENERAL")

    # Explanation focuses on oven thermal switches/sensors, not pumps
    reply = resp2.reply.lower()
    assert any(term in reply for term in ["oven", "thermal", "sensor", "heating", "switch", "thermostat", "element"])
    assert "pump" not in reply

# =========================================================================
# Scenario I: Memory evidence inquiry
# =========================================================================
def test_scenario_i_memory_evidence():
    """
    User: 'Has this happened before?'
    Expected: Search relevant historical experience, return concise factual answer,
    distinguish successful vs unsuccessful repairs, do not repeat entire troubleshooting template.
    """
    conv = chat_service.create_conversation("Memory Query Test")
    c_id = conv["id"]

    chat_service.process_chat(ChatRequest(
        conversation_id=c_id,
        message="My industrial pump is vibrating and overheating.",
        mock_memory=True,
    ))

    resp_hist = chat_service.process_chat(ChatRequest(
        conversation_id=c_id,
        message="Has this happened before?",
        mock_memory=True,
    ))

    assert resp_hist.intent == "HISTORICAL_MEMORY_QUERY"
    # Does NOT repeat 4-section diagnostic template
    assert "Plausible Causes:" not in resp_hist.reply
    assert "Safety Alert:" not in resp_hist.reply

    # Cites records concisely
    reply = resp_hist.reply.lower()
    assert any(w in reply for w in ["records", "past", "history", "precedent", "succeeded", "unsuccessful"])

# =========================================================================
# Scenario J: Service interruption & graceful degradation
# =========================================================================
def test_scenario_j_service_interruption_resilience():
    """
    Simulate Hindsight timeout, quota exhaustion (402), or service unavailability (503).
    Expected: No application crash, no fabricated cloud success, local SQLite functionality remains,
    clear sync state ('local_only' or 'sync_failed'), recoverable error handling.
    """
    from backend.services.hindsight_service import MemoryServiceQuotaExhaustedError, MemoryServiceUnavailableError

    # 1. Simulate Hindsight 402 Quota Exhausted on live retain attempt
    with patch("backend.services.chat_service.settings.HINDSIGHT_MOCK_MODE", False), \
         patch("backend.services.chat_service.hindsight_service.retain_incident_outcome", side_effect=MemoryServiceQuotaExhaustedError()):
        test_idemp = f"IDEMP-TEST-P6-FAIL402-{uuid.uuid4().hex[:6]}"
        res = chat_service.record_outcome(RecordOutcomeRequest(
            equipment_type="Centrifugal Slurry Pump",
            symptoms="Bearing friction vibration",
            action_taken="Realigned coupling",
            outcome_status="SUCCESSFUL",
            machine_id="EQ-PUMP-J-402",
            live_retain=True, # Force live retain attempt
            idempotency_key=test_idemp,
        ))

        # Local record must be preserved safely!
        assert res.success is True
        # Must NOT falsely claim cloud sync
        assert res.sync_status == "sync_failed"
        assert res.hindsight_retained is False

    # 2. Simulate Hindsight 503 Service Unavailable on recall
    with patch("backend.services.chat_service.hindsight_service.recall_memories", side_effect=MemoryServiceUnavailableError()):
        # Chat troubleshooting must gracefully fall back to local SQLite memory without crashing
        resp = chat_service.process_chat(ChatRequest(
            message="My industrial pump is vibrating and overheating.",
            mock_memory=False, # Attempt live recall
        ))
        assert resp is not None
        assert resp.reply is not None
        assert "Plausible Causes" in resp.reply or len(resp.reply) > 50
