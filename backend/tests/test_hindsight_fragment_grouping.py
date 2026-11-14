"""
Regression tests for RecallOps 2.0 Hindsight memory fragment grouping,
evidence-based outcome extraction, distinct incident preservation, and cloud/local merging.
"""

from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.chat_service import chat_service
from backend.services.hindsight_parser import (
    group_cloud_memory_fragments,
    extract_machine_id,
    extract_equipment_type,
    extract_outcome_status,
    extract_symptoms,
    extract_repair_action,
)
from backend.models.chat import RecordOutcomeRequest

client = TestClient(app)

MOCK_USER = {
    "uid": "tech_qa_test",
    "email": "qa@plant.internal",
    "name": "QA Technician",
}
AUTH_HEADER = {"Authorization": "Bearer mock-token-qa"}


def test_four_fragments_grouped_into_single_cp204_card():
    """
    Scenario 1: Four cloud memory fragments from the simulated CP-204 incident
    must be grouped into exactly ONE unified card with detailed fields.
    """
    raw_fragments = [
        {
            "id": "fact-1",
            "text": "Cooling-water pump CP-204 experienced high vibration, abnormal noise, and elevated drive-end temperature.",
            "document_id": None,
            "tags": ["demo-record", "machine-cp-204", "outcome-successful", "maintenance-history", "user-tech_qa_test"],
            "entities": ["CP-204", "Cooling-water pump"],
            "timestamp": "2026-11-14T07:00:00Z",
        },
        {
            "id": "fact-2",
            "text": "Technician TECH-RECALLOPS-01 repaired pump CP-204 by replacing the drive-end spherical roller bearing (SKF 22212) and oil seal, and replenishing synthetic ISO VG 220 lubricant.",
            "document_id": None,
            "tags": ["demo-record", "machine-cp-204", "outcome-successful", "maintenance-history", "user-tech_qa_test"],
            "entities": ["TECH-RECALLOPS-01", "CP-204", "SKF 22212"],
            "timestamp": "2026-11-14T07:15:00Z",
        },
        {
            "id": "fact-3",
            "text": "Post-repair inspection showed temperature 54°C, discharge pressure 4.2 bar, and vibration normalized to 1.4 mm/s RMS under operational load.",
            "document_id": None,
            "tags": ["demo-record", "machine-cp-204", "outcome-successful", "maintenance-history", "user-tech_qa_test"],
            "entities": ["CP-204"],
            "timestamp": "2026-11-14T07:30:00Z",
        },
        {
            "id": "fact-4",
            "text": "The verified outcome for cooling-water pump CP-204 repair was SUCCESSFUL, resolving the worn drive-end bearing and lubrication issue.",
            "document_id": None,
            "tags": ["demo-record", "machine-cp-204", "outcome-successful", "maintenance-history", "user-tech_qa_test"],
            "entities": ["CP-204", "Cooling-water pump"],
            "timestamp": "2026-11-14T07:45:00Z",
        },
    ]

    cards = group_cloud_memory_fragments(raw_fragments)
    # Exactly one card must be returned
    assert len(cards) == 1

    card = cards[0]
    assert card.machine_id == "CP-204"
    assert card.machine_id != "HINDSIGHT-DOC"
    assert card.equipment_type == "Cooling-water pump"
    assert card.outcome_status == "SUCCESSFUL"
    assert "replacing the drive-end spherical roller bearing" in card.action_taken.lower()
    assert "high vibration" in card.symptoms.lower()
    assert "54°c" in card.inspection_notes.lower()
    assert card.storage_engine == "hindsight_cloud"
    assert card.sync_status == "synced"


def test_distinct_incidents_on_different_machines_not_collapsed():
    """
    Scenario 2: Distinct incidents on different machines (CP-204 and M-112)
    must remain separate cards even if retrieved in the same recall response.
    """
    raw_fragments = [
        {
            "id": "frag-cp-1",
            "text": "Cooling-water pump CP-204 experienced high vibration.",
            "document_id": "OUTCOME-INC-CP204",
            "tags": ["machine-cp-204", "outcome-successful"],
            "entities": ["CP-204"],
        },
        {
            "id": "frag-cp-2",
            "text": "CP-204 repaired by replacing drive-end spherical bearing.",
            "document_id": "OUTCOME-INC-CP204",
            "tags": ["machine-cp-204", "outcome-successful"],
            "entities": ["CP-204"],
        },
        {
            "id": "frag-m112-1",
            "text": "Centrifugal Slurry pump M-112 suffered mechanical seal face cracking.",
            "document_id": "OUTCOME-INC-M112",
            "tags": ["machine-m-112", "outcome-successful"],
            "entities": ["M-112"],
        },
        {
            "id": "frag-m112-2",
            "text": "M-112 seal flush plan 53A installed with silicon-carbide faces.",
            "document_id": "OUTCOME-INC-M112",
            "tags": ["machine-m-112", "outcome-successful"],
            "entities": ["M-112"],
        },
    ]

    cards = group_cloud_memory_fragments(raw_fragments)
    assert len(cards) == 2

    machines = {c.machine_id for c in cards}
    assert machines == {"CP-204", "M-112"}


def test_distinct_trials_on_same_machine_preserved():
    """
    Scenario 3: A failed repair attempt and a subsequent successful resolution
    on the same machine (CP-204) must remain distinct cards.
    """
    raw_fragments = [
        {
            "id": "frag-trial-1",
            "text": "Cooling-water pump CP-204 attempted coupling alignment adjustment but vibration remained at 8.2 mm/s RMS.",
            "document_id": "OUTCOME-TRIAL-FAIL",
            "tags": ["machine-cp-204", "outcome-unsuccessful"],
            "entities": ["CP-204"],
        },
        {
            "id": "frag-trial-2",
            "text": "Technician repaired pump CP-204 by replacing drive-end bearing. Verified outcome: SUCCESSFUL.",
            "document_id": "OUTCOME-TRIAL-SUCCESS",
            "tags": ["machine-cp-204", "outcome-successful"],
            "entities": ["CP-204"],
        },
    ]

    cards = group_cloud_memory_fragments(raw_fragments)
    assert len(cards) == 2

    outcomes = {c.outcome_status for c in cards}
    assert outcomes == {"SUCCESSFUL", "UNSUCCESSFUL"}


def test_unverified_document_not_labeled_verified_success():
    """
    Scenario 4 (Requirement 5): A cloud document lacking outcome evidence
    must NOT be labeled SUCCESSFUL.
    """
    raw_fragments = [
        {
            "id": "frag-unverified-1",
            "text": "Routine oil analysis and vibration baseline recording on reciprocating compressor K-301.",
            "document_id": "DOC-ROUTINE-K301",
            "tags": ["machine-k-301", "maintenance-history"],
            "entities": ["K-301", "Compressor"],
        }
    ]

    cards = group_cloud_memory_fragments(raw_fragments)
    assert len(cards) == 1
    assert cards[0].outcome_status == "UNVERIFIED"
    assert cards[0].machine_id == "K-301"


def test_incomplete_metadata_natural_language_extraction():
    """
    Scenario 5: Fragments without colon headers or document IDs
    must extract asset IDs and equipment types via NLP patterns.
    """
    text = "Feedwater pump P-102 exhibited suction cavitation and pressure oscillations."
    machine = extract_machine_id(text, tags=[], entities=[], doc_id=None)
    assert machine == "P-102"

    eq = extract_equipment_type(text, entities=[])
    assert eq == "Feedwater pump"

    sym = extract_symptoms(text)
    assert "cavitation" in (sym or "").lower()


@patch("backend.auth.auth.verify_id_token", return_value=MOCK_USER)
def test_cloud_and_local_merging_deduplication(mock_auth):
    """
    Scenario 6: When local SQLite already has an incident for CP-204,
    recalling fragments from Hindsight Cloud must NOT create duplicate cards.
    The single CP-204 card must be marked synced and backed by Hindsight Cloud.
    """
    # 1. Record local outcome
    req = RecordOutcomeRequest(
        machine_id="CP-204",
        equipment_type="Cooling-water pump",
        symptoms="High vibration and casing overheating to 85°C",
        action_taken="Bearing replacement and lubrication restoration",
        outcome_status="SUCCESSFUL",
        technician_id="TECH-PUMP-LEAD",
        inspection_notes="Temperature 54°C, discharge pressure 4.2 bar, vibration normalized.",
        mock_memory=False,
        live_retain=False,
    )
    rec_resp = chat_service.record_outcome(req, user_id=MOCK_USER["uid"])
    assert rec_resp.success is True

    # 2. Mock cloud recall returning 3 fragments for the same pump CP-204
    mock_cloud_fragments = [
        {
            "id": "fact-qa-1",
            "text": "Cooling-water pump CP-204 experienced high vibration and casing overheating.",
            "document_id": "OUTCOME-PUMP-DEMO-101",
            "tags": [f"user-{MOCK_USER['uid']}", "machine-cp-204", "outcome-successful"],
            "entities": ["CP-204", "Cooling-water pump"],
            "timestamp": "2026-11-14T07:00:00Z",
        },
        {
            "id": "fact-qa-2",
            "text": "Technician repaired pump CP-204 by replacing drive-end bearing and lubrication restoration.",
            "document_id": "OUTCOME-PUMP-DEMO-101",
            "tags": [f"user-{MOCK_USER['uid']}", "machine-cp-204", "outcome-successful"],
            "entities": ["CP-204"],
            "timestamp": "2026-11-14T07:15:00Z",
        },
        {
            "id": "fact-qa-3",
            "text": "Temperature 54°C, discharge pressure 4.2 bar, vibration normalized. Verified outcome: SUCCESSFUL.",
            "document_id": "OUTCOME-PUMP-DEMO-101",
            "tags": [f"user-{MOCK_USER['uid']}", "machine-cp-204", "outcome-successful"],
            "entities": ["CP-204"],
            "timestamp": "2026-11-14T07:30:00Z",
        },
    ]

    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", return_value=mock_cloud_fragments):
        res = client.get("/api/memories?q=CP-204&mock_memory=false", headers=AUTH_HEADER)
        assert res.status_code == 200
        data = res.json()
        assert "memories" in data

        cp204_memories = [m for m in data["memories"] if m["machine_id"] == "CP-204" and m["outcome_status"] == "SUCCESSFUL"]
        # CRUCIAL ASSERTION: There must be EXACTLY ONE card for this CP-204 successful incident, not multiple!
        assert len(cp204_memories) == 1

        single_card = cp204_memories[0]
        assert single_card["machine_id"] == "CP-204"
        assert single_card["storage_engine"] == "hindsight_cloud"
        assert single_card["sync_status"] == "synced"
        assert single_card["hindsight_retained"] is True
