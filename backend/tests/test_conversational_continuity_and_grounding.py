import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_stove_cylinder_got_over_flow():
    """
    CRITICAL BUG 1 / P0 REPRODUCTION:
    Turn 1: "My stove is not on."
    Turn 2 (same conversation): "Yaa broo cylinder got over."
    
    Verifications:
    - Turn 1 correctly detects Gas Stove, produces calibrated diagnosis.
    - Turn 2 recognized as PROBLEM_EXPLANATION_OR_CAUSE.
    - Equipment remains Gas Stove (context preserved).
    - Response connects empty cylinder to stove not lighting.
    - Response includes safety guidance (regulator, leaks, ventilation, no open flames).
    - NO repetitive introductory boilerplate ("I'm RecallOps, an AI that helps you...").
    - NO disconnected questions ("Tell me what's happening with your cylinder...").
    - Follow-up suggestions are relevant to stove/cylinder, NOT pump/umbrella starter prompts!
    """
    # Turn 1: Stove problem report
    r1 = client.post(
        "/api/chat",
        json={"message": "My stove is not on.", "mock_memory": True},
    )
    assert r1.status_code == 200
    d1 = r1.json()
    conv_id = d1["conversation_id"]
    assert d1["intent"] == "TROUBLESHOOTING_QUERY"
    assert d1["equipment_detected"] is not None
    assert "Stove" in d1["equipment_detected"]["equipment_type"]
    assert "Plausible Causes" in d1["reply"]

    # Turn 2: User provides root cause in same conversation
    r2 = client.post(
        "/api/chat",
        json={
            "message": "Yaa broo cylinder got over.",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["conversation_id"] == conv_id
    assert d2["intent"] == "PROBLEM_EXPLANATION_OR_CAUSE"
    assert d2["equipment_detected"] is not None
    assert "Stove" in d2["equipment_detected"]["equipment_type"]

    reply_lower = d2["reply"].lower()
    # Confirms cause-and-effect relationship
    assert any(w in reply_lower for w in ["cylinder", "gas", "fuel", "empty", "depleted", "exhausted"])
    # Provides actionable safety guidance
    assert any(w in reply_lower for w in ["regulator", "leak", "ventilate", "ventilation", "seal", "smell", "safety", "flame", "safe"])
    # Strictly NO repetitive introductory monologues
    assert "i'm recallops, an ai" not in reply_lower
    assert "i am recallops, an ai that helps" not in reply_lower
    # Strictly NO disconnected question
    assert "tell me what's happening with your cylinder" not in reply_lower

    # Follow-ups must be relevant or empty, NEVER starter pump/umbrella prompts
    followups = d2.get("suggested_followups", [])
    for f in followups:
        f_lower = f.lower()
        assert "industrial pump" not in f_lower
        assert "electric motor is making" not in f_lower
        assert "umbrella" not in f_lower


def test_memory_grounding_negative_explicit_statement():
    """
    Verify historical memory grounding:
    When no historical records exist in memory, the assistant MUST explicitly state
    that no historical records were found in memory. It must NEVER invent statistics
    or pretend past repairs occurred.
    """
    resp = client.post(
        "/api/chat",
        json={
            "message": "My commercial convection oven shuts off after 5 minutes.",
            "mock_memory": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    reply = data["reply"]

    # Must contain the calibrated memory insight section
    assert "Relevant Memory Insight:" in reply
    # Must explicitly state no records found (since oven has no mocked precedents)
    assert "no historical" in reply.lower() or "no prior" in reply.lower()
    # Must NOT invent claims like 'users commonly replace'
    assert "users commonly replace" not in reply.lower()
    assert "most commonly replaced" not in reply.lower()


def test_laptop_battery_dead_explanation_flow():
    """
    Multi-turn explanation test for electronics:
    Turn 1: "My workstation laptop won't turn on."
    Turn 2: "Turns out the battery died."
    """
    r1 = client.post(
        "/api/chat",
        json={"message": "My workstation laptop won't turn on.", "mock_memory": True},
    )
    assert r1.status_code == 200
    d1 = r1.json()
    conv_id = d1["conversation_id"]
    assert "Laptop" in d1["equipment_detected"]["equipment_type"]

    r2 = client.post(
        "/api/chat",
        json={
            "message": "Turns out the battery died.",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["intent"] == "PROBLEM_EXPLANATION_OR_CAUSE"
    assert "Laptop" in d2["equipment_detected"]["equipment_type"]
    reply_lower = d2["reply"].lower()
    assert any(w in reply_lower for w in ["battery", "charge", "charger", "power"])
    assert "i'm recallops, an ai" not in reply_lower


def test_hinglish_cause_explanation():
    """
    Hinglish cause explanation in ongoing session:
    Turn 1: "My stove is not on."
    Turn 2: "Bhai cylinder khatam ho gaya."
    """
    r1 = client.post(
        "/api/chat",
        json={"message": "My stove is not on.", "mock_memory": True},
    )
    conv_id = r1.json()["conversation_id"]

    r2 = client.post(
        "/api/chat",
        json={
            "message": "Bhai cylinder khatam ho gaya.",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["intent"] == "PROBLEM_EXPLANATION_OR_CAUSE"
    assert "Stove" in d2["equipment_detected"]["equipment_type"]


def test_failed_repair_attempt_multi_turn():
    """
    Failed repair attempt continuity:
    Turn 1: Pump overheating.
    Turn 2: User cleaned cooling fins, but problem persists.
    """
    r1 = client.post(
        "/api/chat",
        json={"message": "My centrifugal pump is overheating and vibrating.", "mock_memory": True},
    )
    conv_id = r1.json()["conversation_id"]

    r2 = client.post(
        "/api/chat",
        json={
            "message": "We cleaned the cooling fins, but it still overheats.",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["intent"] == "REPORT_OUTCOME"
    assert d2["outcome_to_record"] is not None
    assert d2["outcome_to_record"]["outcome_status"] == "UNSUCCESSFUL"
    assert "Pump" in d2["outcome_to_record"]["equipment_type"]


def test_successful_repair_populates_5_field_card():
    """
    Successful repair attempt preserves Bug 2 confirmation card.
    """
    r1 = client.post(
        "/api/chat",
        json={"message": "My umbrella won't open.", "mock_memory": True},
    )
    conv_id = r1.json()["conversation_id"]

    r2 = client.post(
        "/api/chat",
        json={
            "message": "Replaced the springs and now it opens perfectly.",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["intent"] == "REPORT_OUTCOME"
    assert d2["outcome_to_record"] is not None
    card = d2["outcome_to_record"]
    assert card["outcome_status"] == "SUCCESSFUL"
    assert "Umbrella" in card["equipment_type"]
    assert "spring" in card["action_taken"].lower()
    assert card["ready_to_save"] is True


def test_topic_switch_preserves_new_equipment():
    """
    Topic switch within a session:
    Turn 1: Industrial pump.
    Turn 2: Refrigerator.
    """
    r1 = client.post(
        "/api/chat",
        json={"message": "My industrial centrifugal pump is vibrating.", "mock_memory": True},
    )
    conv_id = r1.json()["conversation_id"]

    r2 = client.post(
        "/api/chat",
        json={
            "message": "Now my commercial refrigerator stopped cooling.",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["intent"] == "TROUBLESHOOTING_QUERY"
    assert "Refrigerator" in d2["equipment_detected"]["equipment_type"]
    assert "Pump" not in d2["equipment_detected"]["equipment_type"]


def test_multi_turn_followup_suggestions_no_starter_leakage():
    """
    Follow-up prompts in an active stove conversation must NEVER show industrial pump or umbrella starter chips.
    """
    r1 = client.post(
        "/api/chat",
        json={"message": "My stove is not on.", "mock_memory": True},
    )
    conv_id = r1.json()["conversation_id"]

    r2 = client.post(
        "/api/chat",
        json={
            "message": "Can you explain what might be wrong in simpler words?",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r2.status_code == 200
    followups = r2.json().get("suggested_followups", [])
    for f in followups:
        assert "industrial pump" not in f.lower()
        assert "umbrella" not in f.lower()
