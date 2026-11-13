import uuid
import json
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_db
from backend.services.chat_service import chat_service

client = TestClient(app)


# ==============================================================================
# TEST GROUP A: DIVERSE OPEN-ENDED INTENT CLASSIFICATION & CONTEXT ISOLATION
# ==============================================================================

def test_intent_casual_conversation_how_are_you():
    """
    BUG 1 Fix: 'How are you?' must be recognized as CASUAL_CONVERSATION.
    Strict requirements:
    - Zero memory retrieval (retrieved_precedents == []).
    - Natural, friendly reply without 4-section troubleshooting headers.
    - Zero diagnostic boilerplate (no Plausible Causes, no Safety Alert).
    """
    resp = client.post(
        "/api/chat",
        json={"message": "How are you?", "mock_memory": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] in ("CASUAL_CONVERSATION", "CASUAL_GREETING")
    assert data["retrieved_precedents"] == []
    assert data["outcome_to_record"] is None
    assert "Plausible Causes" not in data["reply"]
    assert "Safety Alert" not in data["reply"]
    assert len(data["reply"]) > 10


def test_intent_casual_conversation_what_did_you_eat():
    """
    BUG 1 Fix: 'What did you eat today?' must be recognized as CASUAL_CONVERSATION.
    Strict requirements:
    - Zero memory retrieval (retrieved_precedents == []).
    - No equipment diagnosis or safety warning.
    """
    resp = client.post(
        "/api/chat",
        json={"message": "What did you eat today?", "mock_memory": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] in ("CASUAL_CONVERSATION", "CASUAL_GREETING")
    assert data["retrieved_precedents"] == []
    assert data["outcome_to_record"] is None
    assert "Plausible Causes" not in data["reply"]


def test_intent_casual_conversation_do_you_have_a_girlfriend():
    """
    BUG 1 Fix: 'Do you have a girlfriend?' must be recognized as CASUAL_CONVERSATION.
    """
    resp = client.post(
        "/api/chat",
        json={"message": "Do you have a girlfriend?", "mock_memory": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] in ("CASUAL_CONVERSATION", "CASUAL_GREETING")
    assert data["retrieved_precedents"] == []
    assert "Plausible Causes" not in data["reply"]


def test_intent_unrelated_query_python():
    """
    BUG 1 Fix: 'What is Python?' must be recognized as UNRELATED_QUERY.
    Strict requirements:
    - Zero memory retrieval.
    - Politely explains RecallOps scope (equipment/appliance troubleshooting).
    - Zero diagnostic headers.
    """
    resp = client.post(
        "/api/chat",
        json={"message": "What is Python?", "mock_memory": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "UNRELATED_QUERY"
    assert data["retrieved_precedents"] == []
    assert data["outcome_to_record"] is None
    assert "Plausible Causes" not in data["reply"]
    assert "RecallOps" in data["reply"] or "troubleshoot" in data["reply"].lower()


def test_intent_unrelated_query_capital_of_france():
    """
    BUG 1 Fix: 'What is the capital of France?' must be recognized as UNRELATED_QUERY.
    """
    resp = client.post(
        "/api/chat",
        json={"message": "What is the capital of France?", "mock_memory": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "UNRELATED_QUERY"
    assert data["retrieved_precedents"] == []
    assert "Plausible Causes" not in data["reply"]


def test_context_isolation_pump_then_how_are_you():
    """
    BUG 1 Fix: Context isolation between equipment and casual conversation.
    Turn 1: User asks about an industrial pump -> diagnoses pump.
    Turn 2: In SAME conversation, user asks 'How are you?'
    Expected:
    - Turn 2 must NOT drag in pump troubleshooting.
    - Turn 2 must NOT return pump memory precedents.
    - Turn 2 must respond naturally to 'How are you?'.
    """
    # Turn 1: Pump diagnosis
    r1 = client.post(
        "/api/chat",
        json={"message": "My industrial pump is vibrating and overheating.", "mock_memory": True},
    )
    assert r1.status_code == 200
    conv_id = r1.json()["conversation_id"]
    assert r1.json()["intent"] == "TROUBLESHOOTING_QUERY"
    assert len(r1.json()["retrieved_precedents"]) > 0

    # Turn 2: Casual conversation in same thread
    r2 = client.post(
        "/api/chat",
        json={"message": "How are you?", "conversation_id": conv_id, "mock_memory": True},
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["intent"] in ("CASUAL_CONVERSATION", "CASUAL_GREETING")
    assert d2["retrieved_precedents"] == []
    assert "Plausible Causes" not in d2["reply"]
    assert "Centrifugal Slurry Pump" not in d2["reply"]


def test_open_ended_equipment_umbrella():
    """
    Open-ended equipment support:
    'My umbrella won't open' must detect Umbrella and provide calibrated diagnosis.
    """
    resp = client.post(
        "/api/chat",
        json={"message": "My umbrella won't open.", "mock_memory": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "TROUBLESHOOTING_QUERY"
    assert data["equipment_detected"] is not None
    assert "Umbrella" in data["equipment_detected"]["equipment_type"]
    assert "Plausible Causes" in data["reply"]


def test_open_ended_equipment_power_bank_and_window():
    """
    Open-ended equipment support:
    Power Bank and Window must be detected as valid equipment.
    """
    r_pb = client.post(
        "/api/chat",
        json={"message": "My power bank won't charge.", "mock_memory": True},
    )
    assert r_pb.status_code == 200
    assert "Power Bank" in r_pb.json()["equipment_detected"]["equipment_type"]

    r_win = client.post(
        "/api/chat",
        json={"message": "My window is creaking.", "mock_memory": True},
    )
    assert r_win.status_code == 200
    assert "Window" in r_win.json()["equipment_detected"]["equipment_type"]


# ==============================================================================
# TEST GROUP B: EXACT REAL-WORLD MULTI-CONVERSATION LIFECYCLE REPRODUCTION
# ==============================================================================

def test_cross_conversation_umbrella_repair_lifecycle():
    """
    BUG 2 Exact Reproduction and Verification:
    Conversation A: User reports 3 problems:
      1. Power bank won't charge
      2. Umbrella won't open
      3. Window is creaking
    All 3 are stored as problem episodes in SQLite.

    Conversation B (completely NEW session, empty conversation history):
      User reports: 'I replaced the springs in my umbrella. Now it's opening perfectly.'
      - Assistant recognizes REPORT_OUTCOME.
      - Matches the Umbrella episode from Conversation A (NOT Power Bank, NOT Window).
      - Returns 5-field confirmation card pre-populated with Umbrella and original symptoms.
      - User confirms save via /api/chat/record-outcome.
      - Umbrella episode is marked RESOLVED in SQLite.

    Conversation C (completely NEW session):
      User asks: 'My umbrella won't open. Has something like this happened before?'
      - Assistant retrieves the newly stored Umbrella repair precedent from Conversation B.
      - Assistant cites the spring replacement in its response.
    """
    # -------------------------------------------------------------
    # Step 1: Conversation A discusses 3 different problems
    # -------------------------------------------------------------
    conv_a = client.post("/api/conversations", json={"title": "Multi-Problem Session"}).json()["id"]

    # Problem 1: Power bank
    r_a1 = client.post(
        "/api/chat",
        json={"message": "My power bank won't charge.", "conversation_id": conv_a, "mock_memory": True},
    )
    assert r_a1.status_code == 200

    # Problem 2: Umbrella
    r_a2 = client.post(
        "/api/chat",
        json={"message": "My umbrella won't open. The ribs seem completely stuck.", "conversation_id": conv_a, "mock_memory": True},
    )
    assert r_a2.status_code == 200

    # Problem 3: Window
    r_a3 = client.post(
        "/api/chat",
        json={"message": "My window is creaking whenever it opens.", "conversation_id": conv_a, "mock_memory": True},
    )
    assert r_a3.status_code == 200

    # Verify that all 3 problem episodes are recorded in SQLite as 'unresolved'
    with get_db() as conn:
        episodes = conn.execute(
            "SELECT equipment_name, status FROM problem_episodes WHERE conversation_id = ? ORDER BY created_at ASC",
            (conv_a,),
        ).fetchall()
        eq_names = [e["equipment_name"] for e in episodes]
        assert "Power Bank" in eq_names
        assert "Umbrella" in eq_names
        assert "Window" in eq_names
        assert all(e["status"] == "unresolved" for e in episodes)

    # -------------------------------------------------------------
    # Step 2: Conversation B (NEW session) reports umbrella repair
    # -------------------------------------------------------------
    conv_b = client.post("/api/conversations", json={"title": "Fresh Session Hours Later"}).json()["id"]

    r_b = client.post(
        "/api/chat",
        json={
            "message": "I replaced the springs in my umbrella. Now it's opening perfectly.",
            "conversation_id": conv_b,
            "mock_memory": True,
        },
    )
    assert r_b.status_code == 200
    d_b = r_b.json()
    assert d_b["intent"] == "REPORT_OUTCOME"

    outcome = d_b["outcome_to_record"]
    assert outcome is not None
    # Verify 5 dimensions & cross-conversation linkage
    assert "Umbrella" in outcome["equipment_type"]
    assert "spring" in outcome["action_taken"].lower()
    assert outcome["outcome_status"] == "SUCCESSFUL"
    assert outcome["episode_id"] is not None  # Linked to Conversation A's umbrella episode!

    # Confirm and store outcome in permanent memory
    confirm_key = f"IDEMP-UMB-{uuid.uuid4().hex[:8]}"
    save_resp = client.post(
        "/api/chat/record-outcome",
        json={
            "equipment_type": outcome["equipment_type"],
            "symptoms": outcome["symptoms"],
            "action_taken": outcome["action_taken"],
            "outcome_status": outcome["outcome_status"],
            "episode_id": outcome["episode_id"],
            "idempotency_key": confirm_key,
            "conversation_id": conv_b,
        },
    )
    assert save_resp.status_code == 200
    assert save_resp.json()["success"] is True

    # Verify SQLite episode resolution state:
    # Umbrella is now RESOLVED, while Power Bank and Window remain UNRESOLVED
    with get_db() as conn:
        umb_ep = conn.execute(
            "SELECT status, resolution_action FROM problem_episodes WHERE id = ?",
            (outcome["episode_id"],),
        ).fetchone()
        assert umb_ep["status"] == "resolved"
        assert "spring" in umb_ep["resolution_action"].lower()

        unresolved = conn.execute(
            "SELECT equipment_name FROM problem_episodes WHERE conversation_id = ? AND status = 'unresolved'",
            (conv_a,),
        ).fetchall()
        unres_names = [u["equipment_name"] for u in unresolved]
        assert "Power Bank" in unres_names
        assert "Window" in unres_names
        assert "Umbrella" not in unres_names

    # -------------------------------------------------------------
    # Step 3: Conversation C (NEW session) inquires about umbrella history
    # -------------------------------------------------------------
    conv_c = client.post("/api/conversations", json={"title": "Future User Session"}).json()["id"]

    r_c = client.post(
        "/api/chat",
        json={
            "message": "My umbrella won't open. Has something like this happened before?",
            "conversation_id": conv_c,
            "mock_memory": True,
        },
    )
    assert r_c.status_code == 200
    d_c = r_c.json()
    assert len(d_c["retrieved_precedents"]) > 0

    top_precedent = d_c["retrieved_precedents"][0]
    assert "Umbrella" in top_precedent["equipment_type"]
    assert "spring" in top_precedent["action_taken"].lower()
    assert top_precedent["outcome_status"] == "SUCCESSFUL"


def test_cross_conversation_hinglish_repair_recognition():
    """
    Multi-language / Hinglish repair recognition:
    User discusses an induction motor.
    In a new conversation, user reports in Hinglish:
    'Spring change kar diya, ab sahi chal raha hai'
    Expected:
    - Intent recognized as REPORT_OUTCOME.
    - Status SUCCESSFUL.
    - 5-field card populated.
    """
    conv_1 = client.post("/api/conversations", json={"title": "Motor Issue"}).json()["id"]
    client.post(
        "/api/chat",
        json={"message": "My induction motor is vibrating excessively.", "conversation_id": conv_1, "mock_memory": True},
    )

    conv_2 = client.post("/api/conversations", json={"title": "Later Repair Report"}).json()["id"]
    r_h = client.post(
        "/api/chat",
        json={"message": "Spring change kar diya, ab sahi chal raha hai", "conversation_id": conv_2, "mock_memory": True},
    )
    assert r_h.status_code == 200
    d_h = r_h.json()
    assert d_h["intent"] == "REPORT_OUTCOME"
    assert d_h["outcome_to_record"] is not None
    assert d_h["outcome_to_record"]["outcome_status"] == "SUCCESSFUL"
    assert "spring" in d_h["outcome_to_record"]["action_taken"].lower()


# ==============================================================================
# TEST GROUP C: RELIABILITY, RESILIENCE & IDEMPOTENCY
# ==============================================================================

def test_duplicate_confirmation_idempotency():
    """
    Verify that submitting the same outcome idempotency key twice is handled idempotently
    without duplicating records.
    """
    idemp_key = f"IDEMP-RESIL-{uuid.uuid4().hex[:8]}"
    payload = {
        "equipment_type": "Centrifugal Pump",
        "symptoms": "Overheating and high-frequency vibration",
        "action_taken": "Replaced mechanical seal",
        "outcome_status": "SUCCESSFUL",
        "idempotency_key": idemp_key,
    }

    r1 = client.post("/api/chat/record-outcome", json=payload)
    assert r1.status_code == 200
    assert r1.json()["is_duplicate"] is False

    r2 = client.post("/api/chat/record-outcome", json=payload)
    assert r2.status_code == 200
    assert r2.json()["is_duplicate"] is True
    assert r2.json()["verification_id"] == r1.json()["verification_id"]


# ==============================================================================
# TEST GROUP D: COMPREHENSIVE BUG 1 INTENT PRECEDENCE & ARCHITECTURAL TESTS
# ==============================================================================

def test_intent_hi_recallops_and_variations():
    """Verify 'Hi recallops', 'recallops hi', and 'namaste' receive clean greetings without LOTO or diagnosis."""
    for greeting in ["Hi recallops", "recallops hi", "namaste", "kaise ho", "kya haal hai"]:
        resp = client.post("/api/chat", json={"message": greeting, "mock_memory": True})
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] in ("CASUAL_GREETING", "CASUAL_CONVERSATION")
        assert data["retrieved_precedents"] == []
        assert data["outcome_to_record"] is None
        assert "Plausible Causes" not in data["reply"]
        assert "Safety Alert" not in data["reply"]
        assert "LOTO" not in data["reply"]
        assert "Lockout" not in data["reply"]
        assert "Question for Technician" not in data["reply"]


def test_intent_general_capabilities_what_is_recallops():
    """Verify capabilities queries receive helpful explanations without diagnostic sections."""
    for q in ["what is recallops", "what can you do", "can you help me"]:
        resp = client.post("/api/chat", json={"message": q, "mock_memory": True})
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] in ("GENERAL_CAPABILITIES_INQUIRY", "GENERAL_INQUIRY", "CASUAL_CONVERSATION")
        assert data["retrieved_precedents"] == []
        assert "Plausible Causes" not in data["reply"]
        assert "Safety Alert" not in data["reply"]
        assert "RecallOps" in data["reply"] or "troubleshoot" in data["reply"].lower()


def test_intent_unrelated_geography_and_politics():
    """Verify general knowledge questions are politely redirected without equipment diagnosis."""
    for q in ["What is the capital of India?", "Who is the Prime Minister of India?"]:
        resp = client.post("/api/chat", json={"message": q, "mock_memory": True})
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "UNRELATED_QUERY"
        assert data["retrieved_precedents"] == []
        assert "Plausible Causes" not in data["reply"]
        assert "Safety Alert" not in data["reply"]


def test_intent_ambiguous_standalone_query():
    """Verify vague cries for help without equipment ask a clarifying question rather than guessing."""
    resp = client.post("/api/chat", json={"message": "it's not working", "mock_memory": True})
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "AMBIGUOUS_QUERY"
    assert data["retrieved_precedents"] == []
    assert "Plausible Causes" not in data["reply"]
    assert "Safety Alert" not in data["reply"]
    assert "specify" in data["reply"].lower() or "equipment" in data["reply"].lower() or "machine" in data["reply"].lower()


def test_intent_unfamiliar_zentromax_machine_troubleshooting():
    """Verify an unfamiliar machine name like ZentroMax is recognized and diagnosed properly."""
    resp = client.post("/api/chat", json={"message": "My unfamiliar ZentroMax machine is vibrating", "mock_memory": True})
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "TROUBLESHOOTING_QUERY"
    assert data["equipment_detected"] is not None
    assert "Zentromax" in data["equipment_detected"]["equipment_type"]
    assert "Plausible Causes" in data["reply"]
    assert "Safety Alert" in data["reply"]
