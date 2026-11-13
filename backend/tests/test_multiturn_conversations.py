import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db

client = TestClient(app)


def test_scenario_a_mixer_grinder_multiturn():
    """A. Mixer grinder -> simpler explanation -> technician question in ONE session."""
    # Turn 1: Problem statement
    r1 = client.post(
        "/api/chat",
        json={
            "message": "My mixer grinder suddenly stopped working. What might be the problem?",
            "mock_memory": True,
        },
    )
    assert r1.status_code == 200
    d1 = r1.json()
    conv_id = d1["conversation_id"]
    assert d1["intent"] == "TROUBLESHOOTING_QUERY"
    assert d1["equipment_detected"] is not None
    assert "Mixer" in d1["equipment_detected"]["equipment_type"]
    assert len(d1["retrieved_precedents"]) > 0
    assert "EQ-FIELD" in [p["machine_id"] for p in d1["retrieved_precedents"]]
    assert "Plausible Causes" in d1["reply"]

    # Turn 2: Request simpler explanation (Memory cards suppressed on follow-up to keep chat clean)
    r2 = client.post(
        "/api/chat",
        json={
            "message": "Can you explain the most likely cause in simpler words?",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["conversation_id"] == conv_id
    assert d2["intent"] == "FOLLOWUP_SIMPLIFY"
    assert d2["equipment_detected"] is not None
    assert "Mixer" in d2["equipment_detected"]["equipment_type"]
    # Precedent cards are suppressed in follow-up responses to prevent repetitive UI clutter
    assert len(d2["retrieved_precedents"]) == 0
    # Does NOT repeat rigid 4 troubleshooting headers
    assert "Plausible Causes:" not in d2["reply"]
    assert "Relevant Memory Insight:" not in d2["reply"]
    assert "Question for Technician:" not in d2["reply"]
    # Does NOT switch to pump
    assert "pump" not in d2["reply"].lower() or "mixer" in d2["reply"].lower()

    # Turn 3: Ask technician question (Memory cards suppressed on technician follow-up)
    r3 = client.post(
        "/api/chat",
        json={
            "message": "What specific questions should I ask my technician?",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r3.status_code == 200
    d3 = r3.json()
    assert d3["conversation_id"] == conv_id
    assert d3["intent"] == "FOLLOWUP_TECHNICIAN_QUESTIONS"
    assert "Mixer" in d3["equipment_detected"]["equipment_type"]
    assert len(d3["retrieved_precedents"]) == 0
    # Does NOT repeat 4 headers
    assert "Plausible Causes:" not in d3["reply"]
    assert "Relevant Memory Insight:" not in d3["reply"]

    # Turn 4: Explicit history request -> Memory cards must reappear
    r4 = client.post(
        "/api/chat",
        json={
            "message": "Has this happened before in our previous repair records?",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r4.status_code == 200
    d4 = r4.json()
    assert d4["intent"] == "HISTORY_QUERY"
    assert len(d4["retrieved_precedents"]) > 0
    assert d4["retrieved_precedents"][0]["machine_id"] == "EQ-FIELD"


def test_scenario_b_equipment_switching_and_pronoun_resolution():
    """B. Pump issue -> new oven issue -> follow-up referring to the oven."""
    # Turn 1: Pump issue
    r1 = client.post(
        "/api/chat",
        json={
            "message": "My industrial centrifugal slurry pump is vibrating excessively.",
            "mock_memory": True,
        },
    )
    assert r1.status_code == 200
    d1 = r1.json()
    conv_id = d1["conversation_id"]
    assert "Pump" in d1["equipment_detected"]["equipment_type"]
    assert len(d1["retrieved_precedents"]) > 0
    assert any("M-" in p["machine_id"] for p in d1["retrieved_precedents"])

    # Turn 2: Switch to oven
    r2 = client.post(
        "/api/chat",
        json={
            "message": "Now my oven keeps switching off unexpectedly.",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["conversation_id"] == conv_id
    assert d2["intent"] == "TROUBLESHOOTING_QUERY"
    assert "Oven" in d2["equipment_detected"]["equipment_type"]
    # Zero pump precedents leak into oven
    assert len(d2["retrieved_precedents"]) == 0
    assert "M-104" not in [p["machine_id"] for p in d2["retrieved_precedents"]]

    # Turn 3: Follow-up using pronoun "it" -> must resolve to oven, NOT pump
    r3 = client.post(
        "/api/chat",
        json={
            "message": "Why does it do that?",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r3.status_code == 200
    d3 = r3.json()
    assert d3["intent"] in ("FOLLOWUP_WHY_OR_HOW", "FOLLOWUP_GENERAL")
    assert "Oven" in d3["equipment_detected"]["equipment_type"]
    # Does NOT repeat 4 section headers
    assert "Plausible Causes:" not in d3["reply"]
    # Mentions thermal cut-off, temperature, thermostat, or oven concepts
    reply_lower = d3["reply"].lower()
    assert any(w in reply_lower for w in ["oven", "heat", "temp", "thermal", "sensor", "shut", "switch"])
    # Does NOT switch back to pump
    assert "slurry" not in reply_lower
    assert "impeller" not in reply_lower


def test_scenario_c_greeting_troubleshooting_followup_acknowledgment():
    """C. Greeting -> troubleshooting -> follow-up -> acknowledgment."""
    # Turn 1: Greeting
    r1 = client.post(
        "/api/chat",
        json={"message": "Hello!", "mock_memory": True},
    )
    assert r1.status_code == 200
    d1 = r1.json()
    conv_id = d1["conversation_id"]
    assert d1["intent"] == "CASUAL_GREETING"
    assert len(d1["retrieved_precedents"]) == 0
    assert "Plausible Causes" not in d1["reply"]

    # Turn 2: Troubleshooting query
    r2 = client.post(
        "/api/chat",
        json={
            "message": "My electric motor is making an unusual noise.",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["intent"] == "TROUBLESHOOTING_QUERY"
    assert "Motor" in d2["equipment_detected"]["equipment_type"]
    assert "Plausible Causes" in d2["reply"]

    # Turn 3: Follow-up
    r3 = client.post(
        "/api/chat",
        json={
            "message": "Why might that happen?",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r3.status_code == 200
    d3 = r3.json()
    assert d3["intent"] == "FOLLOWUP_WHY_OR_HOW"
    assert "Motor" in d3["equipment_detected"]["equipment_type"]
    assert "Plausible Causes:" not in d3["reply"]

    # Turn 4: Acknowledgment
    r4 = client.post(
        "/api/chat",
        json={
            "message": "Thank you for the help.",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r4.status_code == 200
    d4 = r4.json()
    assert d4["intent"] == "ACKNOWLEDGMENT"
    assert len(d4["retrieved_precedents"]) == 0
    assert "welcome" in d4["reply"].lower() or "anytime" in d4["reply"].lower()


def test_scenario_d_repair_outcome_correct_association():
    """D. Repair outcome -> confirmation -> correct incident association."""
    # Turn 1: Mixer grinder
    r1 = client.post(
        "/api/chat",
        json={
            "message": "My mixer grinder suddenly stopped working.",
            "mock_memory": True,
        },
    )
    assert r1.status_code == 200
    d1 = r1.json()
    conv_id = d1["conversation_id"]
    assert "Mixer" in d1["equipment_detected"]["equipment_type"]

    # Turn 2: Report outcome
    r2 = client.post(
        "/api/chat",
        json={
            "message": "The technician replaced the bearing and now it works.",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["intent"] == "REPORT_OUTCOME"
    assert d2["outcome_to_record"] is not None

    outcome = d2["outcome_to_record"]
    # Correct equipment association (NOT generic Industrial Equipment or Pump)
    assert "Mixer" in outcome["equipment_type"]
    assert outcome["outcome_status"] == "SUCCESSFUL"
    assert outcome["verification_status"] == "TECHNICIAN_CONFIRMED"
    assert "replaced the bearing" in outcome["action_taken"].lower()

    # Save outcome to database
    save_resp = client.post(
        "/api/chat/record-outcome",
        json={
            "equipment_type": outcome["equipment_type"],
            "symptoms": outcome["symptoms"],
            "action_taken": outcome["action_taken"],
            "outcome_status": outcome["outcome_status"],
            "conversation_id": conv_id,
            "live_retain": False,
        },
    )
    assert save_resp.status_code == 200
    save_data = save_resp.json()
    assert save_data["success"] is True
    assert save_data["document_id"] is not None


def test_scenario_e_no_matching_memory_without_fabrication():
    """E. No matching memory -> general AI guidance without fabricated history."""
    # Query for equipment with no precedents in database
    r = client.post(
        "/api/chat",
        json={
            "message": "My laptop fan is unusually loud.",
            "mock_memory": True,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["equipment_detected"] is not None
    assert "Laptop" in data["equipment_detected"]["equipment_type"]
    # ZERO precedents returned
    assert len(data["retrieved_precedents"]) == 0
    # Response provides guidance but does NOT invent fake machine IDs
    reply = data["reply"]
    assert "Plausible Causes" in reply
    assert "M-999" not in reply
    assert "M-104" not in reply  # Pump record must not be cited for a laptop
    assert "no historical" in reply.lower() or "no prior" in reply.lower() or "not found" in reply.lower()


def test_scenario_f_consistent_memory_provenance():
    """F. Relevant memory -> explicit history query -> consistent memory provenance."""
    # Turn 1: Pump issue
    r1 = client.post(
        "/api/chat",
        json={
            "message": "My industrial centrifugal slurry pump is vibrating excessively and overheating.",
            "mock_memory": True,
        },
    )
    assert r1.status_code == 200
    d1 = r1.json()
    conv_id = d1["conversation_id"]
    assert len(d1["retrieved_precedents"]) > 0
    p1 = d1["retrieved_precedents"][0]
    machine_id_turn1 = p1["machine_id"]
    source_turn1 = p1["source"]
    label_turn1 = p1["source_label"]
    verif_turn1 = p1["verification_status"]

    # Turn 2: Explicit query for past repair records
    r2 = client.post(
        "/api/chat",
        json={
            "message": "What past repair records or history do we have for this machine?",
            "conversation_id": conv_id,
            "mock_memory": True,
        },
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["intent"] == "HISTORY_QUERY"
    assert len(d2["retrieved_precedents"]) > 0
    p2 = d2["retrieved_precedents"][0]

    # Verification of EXACT provenance consistency across turns
    assert p2["machine_id"] == machine_id_turn1
    assert p2["source"] == source_turn1
    assert p2["source_label"] == label_turn1
    assert p2["verification_status"] == verif_turn1


def test_scenario_g_device_appropriate_safety_household_vs_industrial():
    """G. Safety guidance distinguishes household appliances (unplug) from industrial (LOTO)."""
    # Household appliance: Mixer Grinder
    r_home = client.post(
        "/api/chat",
        json={
            "message": "My mixer grinder suddenly stopped working. How should I inspect it safely?",
            "mock_memory": True,
        },
    )
    assert r_home.status_code == 200
    d_home = r_home.json()
    reply_home = d_home["reply"].lower()
    # Household must advise unplugging or disconnecting from mains wall outlet
    assert any(term in reply_home for term in ["unplug", "wall outlet", "disconnect from mains", "power supply"])
    # Household must NOT tell ordinary consumer to execute industrial Lockout/Tagout at the motor control center
    assert "lockout/tagout" not in reply_home
    assert "loto" not in reply_home

    # Industrial equipment: Slurry Pump
    r_ind = client.post(
        "/api/chat",
        json={
            "message": "Our industrial centrifugal slurry pump is vibrating excessively and overheating.",
            "mock_memory": True,
        },
    )
    assert r_ind.status_code == 200
    d_ind = r_ind.json()
    reply_ind = d_ind["reply"].lower()
    # Industrial must recommend Lockout/Tagout (LOTO) or de-energizing at the breaker
    assert any(term in reply_ind for term in ["lockout", "loto", "breaker", "disconnect switch", "zero-energy", "isolated"])


def test_scenario_h_calibrated_diagnostic_language():
    """H. Calibrated language: distinguishes plausible causes from unconfirmed assertions."""
    r = client.post(
        "/api/chat",
        json={
            "message": "My electric motor is making an unusual grinding noise.",
            "mock_memory": True,
        },
    )
    assert r.status_code == 200
    data = r.json()
    reply = data["reply"]
    # Check calibrated language headers or phrasing
    assert "Plausible Causes" in reply
    # Must NOT claim absolute certainty without diagnostic inspection
    reply_lower = reply.lower()
    assert "definitely broken" not in reply_lower
    assert "most common cause" not in reply_lower
    assert "replacing this usually fixes it" not in reply_lower

