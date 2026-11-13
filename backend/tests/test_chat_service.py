import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.chat_service import chat_service

client = TestClient(app)


def test_system_status():
    resp = client.get("/api/chat/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "operational"
    assert data["version"] == "2.0.0"
    assert "openai/gpt-oss-120b" in data["ai_engine"]
    assert data["credit_preservation_active"] is True


def test_create_and_list_conversations():
    conv = chat_service.create_conversation("Unit Test Compressor Vibration")
    assert conv["id"].startswith("CONV-")
    assert conv["title"] == "Unit Test Compressor Vibration"

    resp = client.get("/api/conversations")
    assert resp.status_code == 200
    convs = resp.json()
    assert len(convs) >= 1
    found = any(c["id"] == conv["id"] for c in convs)
    assert found is True


def test_chat_troubleshooting_grounded_response():
    resp = client.post(
        "/api/chat",
        json={
            "message": "My industrial centrifugal slurry pump is overheating and casing temperature is high.",
            "mock_memory": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["conversation_id"].startswith("CONV-")
    assert data["intent"] in ("TROUBLESHOOTING_QUERY", "REPORT_OUTCOME")
    assert len(data["reply"]) > 20
    assert len(data["suggested_followups"]) > 0
    # Must retrieve verified precedents from existing pump records
    assert len(data["retrieved_precedents"]) > 0
    first_prec = data["retrieved_precedents"][0]
    assert first_prec["outcome_status"] in ("SUCCESSFUL", "UNSUCCESSFUL")


def test_chat_empty_memory_honest_handling():
    resp = client.post(
        "/api/chat",
        json={
            "message": "My commercial convection oven keeps randomly shutting down mid cycle.",
            "mock_memory": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["conversation_id"].startswith("CONV-")
    assert len(data["reply"]) > 20
    # Should not invent false historical incidents
    reply_lower = data["reply"].lower()
    assert "no " in reply_lower or "not found" in reply_lower or "memory" in reply_lower or "safety" in reply_lower


def test_chat_hazard_warning():
    resp = client.post(
        "/api/chat",
        json={
            "message": "There is smoke and sparks coming from the 4160V electrical motor housing.",
            "mock_memory": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["hazard_warning"] is not None
    assert "HAZARD" in data["hazard_warning"]


def test_record_outcome_and_search_memory():
    # Record a confirmed repair
    rec_resp = client.post(
        "/api/chat/record-outcome",
        json={
            "equipment_type": "Reciprocating Air Compressor",
            "machine_id": "COMP-909",
            "symptoms": "Low discharge pressure and excessive reed valve flutter",
            "action_taken": "Replaced warped suction reed valve discs and gaskets",
            "outcome_status": "SUCCESSFUL",
            "inspection_notes": "Discharge pressure restored to 125 PSI nominal.",
            "technician_id": "TECH-LEAD-77",
            "live_retain": False,  # Mock mode preserves credits
        },
    )
    assert rec_resp.status_code == 200
    rec_data = rec_resp.json()
    assert rec_data["success"] is True
    assert rec_data["incident_id"].startswith("INC-")

    # Search for it in memory
    mem_resp = client.get("/api/memories?q=reed+valve")
    assert mem_resp.status_code == 200
    mem_data = mem_resp.json()
    assert mem_data["total"] >= 1
    found = any(m["machine_id"] == "COMP-909" for m in mem_data["memories"])
    assert found is True


def test_multi_symptom_relevance_and_deduplication():
    # Query with both vibration AND thermal symptoms
    resp = client.post(
        "/api/chat",
        json={
            "message": "My industrial centrifugal slurry pump is vibrating excessively and casing temperature is rising.",
            "mock_memory": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    precedents = data["retrieved_precedents"]
    assert len(precedents) > 0

    # Verify multi-symptom top match: M-112 matches both vibration AND casing temperature spike
    top_match = precedents[0]
    assert top_match["machine_id"] in ("M-112", "M-MOCK-001")
    assert "vibrat" in top_match["symptoms"].lower()
    assert "temp" in top_match["symptoms"].lower() or "overheat" in top_match["symptoms"].lower()

    # Verify deduplication: no duplicate machine IDs
    machine_ids = [p["machine_id"] for p in precedents]
    assert len(machine_ids) == len(set(machine_ids))

    # Verify accurate demo/sample labeling
    assert "Sample" in top_match["source_label"] or "Demo" in top_match["source_label"]
    assert top_match["source"] in ("sample_fixture", "sample_memory_demo")
    assert top_match.get("verification_status") in ("TECHNICIAN_CONFIRMED", "INDEPENDENTLY_VERIFIED", "USER_REPORTED")


