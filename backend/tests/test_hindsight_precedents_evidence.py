"""
Regression test suite for RecallOps 2.0 Historical Precedents evidence integrity,
deduplication of Hindsight Cloud memory fragments, and zero query leakage into symptoms.
"""

from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.chat_service import chat_service
from backend.models.chat import PrecedentRecord

client = TestClient(app)

MOCK_USER = {
    "uid": "tech_qa_evidence",
    "email": "qa_evidence@plant.internal",
    "name": "QA Evidence Specialist",
}
AUTH_HEADER = {"Authorization": "Bearer mock-token-qa-evidence"}


def test_historical_symptoms_never_leak_user_query():
    """
    Requirement 1: Historical symptoms must be populated exclusively from stored incident evidence,
    NEVER from the current user query or question text.
    """
    user_query = "Why is cooling pump CP-204 overheating and making a loud grinding noise?"

    raw_cloud_fragments = [
        {
            "id": "fact-symptom-1",
            "text": "Cooling-water pump CP-204 experienced high vibration, abnormal noise, and elevated drive-end temperature.",
            "document_id": "OUTCOME-PUMP-DEMO-101",
            "tags": ["machine-cp-204", "outcome-successful"],
            "entities": ["CP-204", "Cooling-water pump"],
            "timestamp": "2026-11-14T07:00:00Z",
        },
        {
            "id": "fact-action-2",
            "text": "Technician repaired pump CP-204 by replacing the drive-end spherical roller bearing (SKF 22212). Verified outcome: SUCCESSFUL.",
            "document_id": "OUTCOME-PUMP-DEMO-101",
            "tags": ["machine-cp-204", "outcome-successful"],
            "entities": ["CP-204"],
            "timestamp": "2026-11-14T07:15:00Z",
        },
    ]

    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", return_value=raw_cloud_fragments), \
         patch("backend.config.settings.HINDSIGHT_API_KEY", "mock-live-key"):

        precedents = chat_service.retrieve_precedents(
            query=user_query,
            mock_mode=False,
            equipment_type="Cooling-water pump",
            user_id=MOCK_USER["uid"],
        )

        assert len(precedents) == 1
        p = precedents[0]
        # Must strictly reflect historical evidence
        assert "high vibration, abnormal noise, and elevated drive-end temperature" in p.symptoms.lower()
        # Must NEVER contain the user's question
        assert user_query.lower() not in p.symptoms.lower()
        assert "grinding noise" not in p.symptoms.lower()
        assert "why is" not in p.symptoms.lower()


def test_missing_symptoms_never_fabricate_from_user_query():
    """
    Requirement 1 & 4: When stored fragments omit explicit symptoms, the system must NOT
    use the user's search query to fill the gap, but state honest maintenance reality.
    """
    user_query = "How do I fix the broken cooling pump CP-204 immediately?"

    raw_cloud_fragments = [
        {
            "id": "fact-action-only",
            "text": "Technician repaired cooling-water pump CP-204 by replacing drive-end spherical bearing. Verified outcome: SUCCESSFUL.",
            "document_id": "OUTCOME-PUMP-NO-SYM",
            "tags": ["machine-cp-204", "outcome-successful"],
            "entities": ["CP-204"],
            "timestamp": "2026-11-14T07:00:00Z",
        }
    ]

    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", return_value=raw_cloud_fragments), \
         patch("backend.config.settings.HINDSIGHT_API_KEY", "mock-live-key"):

        precedents = chat_service.retrieve_precedents(
            query=user_query,
            mock_mode=False,
            equipment_type="Cooling-water pump",
            user_id=MOCK_USER["uid"],
        )

        assert len(precedents) == 1
        p = precedents[0]
        assert "anomalous operating conditions" in p.symptoms.lower()
        assert user_query.lower() not in p.symptoms.lower()
        assert "how do i fix" not in p.symptoms.lower()
        assert "immediately" not in p.symptoms.lower()


def test_cp204_four_fragments_deduplicated_to_single_precedent():
    """
    Requirement 2 & 3: Four fragments from the same CP-204 incident must be deduplicated
    into exactly ONE precedent card, preserving real document ID, outcome status, and notes.
    """
    user_query = "What is the historical resolution for pump CP-204?"

    raw_cloud_fragments = [
        {
            "id": "fact-1",
            "text": "Cooling-water pump CP-204 experienced high vibration, abnormal noise, and elevated drive-end temperature.",
            "document_id": "OUTCOME-PUMP-DEMO-101",
            "tags": ["machine-cp-204", "outcome-successful"],
            "entities": ["CP-204", "Cooling-water pump"],
            "timestamp": "2026-11-14T07:00:00Z",
        },
        {
            "id": "fact-2",
            "text": "Technician TECH-RECALLOPS-01 repaired pump CP-204 by replacing the drive-end spherical roller bearing (SKF 22212) and oil seal, and replenishing synthetic ISO VG 220 lubricant.",
            "document_id": "OUTCOME-PUMP-DEMO-101",
            "tags": ["machine-cp-204", "outcome-successful"],
            "entities": ["TECH-RECALLOPS-01", "CP-204", "SKF 22212"],
            "timestamp": "2026-11-14T07:15:00Z",
        },
        {
            "id": "fact-3",
            "text": "Post-repair inspection showed temperature 54°C, discharge pressure 4.2 bar, and vibration normalized to 1.4 mm/s RMS under operational load.",
            "document_id": "OUTCOME-PUMP-DEMO-101",
            "tags": ["machine-cp-204", "outcome-successful"],
            "entities": ["CP-204"],
            "timestamp": "2026-11-14T07:30:00Z",
        },
        {
            "id": "fact-4",
            "text": "The verified outcome for cooling-water pump CP-204 repair was SUCCESSFUL, resolving the worn drive-end bearing and lubrication issue.",
            "document_id": "OUTCOME-PUMP-DEMO-101",
            "tags": ["machine-cp-204", "outcome-successful"],
            "entities": ["CP-204", "Cooling-water pump"],
            "timestamp": "2026-11-14T07:45:00Z",
        },
    ]

    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", return_value=raw_cloud_fragments), \
         patch("backend.config.settings.HINDSIGHT_API_KEY", "mock-live-key"):

        precedents = chat_service.retrieve_precedents(
            query=user_query,
            mock_mode=False,
            equipment_type="Cooling-water pump",
            user_id=MOCK_USER["uid"],
        )

        # CRITICAL: Must be EXACTLY ONE card, NOT two identical cards!
        assert len(precedents) == 1
        p = precedents[0]
        assert p.machine_id == "CP-204"
        assert p.equipment_type == "Cooling-water pump"
        assert p.outcome_status == "SUCCESSFUL"
        assert p.verification_status == "TECHNICIAN_CONFIRMED"
        assert p.source == "hindsight_cloud_live"
        assert p.source_label == "Hindsight Cloud (Live Verified)"
        assert "replacing the drive-end spherical roller bearing" in p.action_taken.lower()
        assert "54°c" in (p.inspection_notes or "").lower()
        assert p.id == "OUTCOME-PUMP-DEMO-101"


def test_distinct_trials_on_same_machine_preserved_as_two_precedents():
    """
    Requirement 2 & 3: Distinct repair attempts on the same machine (CP-204)
    (a failed coupling alignment attempt and a successful bearing replacement)
    must both be preserved as two distinct precedent cards with accurate outcome statuses.
    """
    user_query = "Cooling water pump CP-204 troubleshooting history"

    raw_cloud_fragments = [
        {
            "id": "frag-trial-fail",
            "text": "Cooling-water pump CP-204 experienced high vibration. Attempted coupling alignment adjustment but vibration remained high at 8.2 mm/s RMS. Verified outcome: UNSUCCESSFUL.",
            "document_id": "OUTCOME-TRIAL-FAIL-101",
            "tags": ["machine-cp-204", "outcome-unsuccessful"],
            "entities": ["CP-204"],
            "timestamp": "2026-11-14T06:00:00Z",
        },
        {
            "id": "frag-trial-success",
            "text": "Technician repaired pump CP-204 by replacing drive-end bearing and replenishing lubricant. Verified outcome: SUCCESSFUL.",
            "document_id": "OUTCOME-TRIAL-SUCC-102",
            "tags": ["machine-cp-204", "outcome-successful"],
            "entities": ["CP-204"],
            "timestamp": "2026-11-14T07:00:00Z",
        },
    ]

    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", return_value=raw_cloud_fragments), \
         patch("backend.config.settings.HINDSIGHT_API_KEY", "mock-live-key"):

        precedents = chat_service.retrieve_precedents(
            query=user_query,
            mock_mode=False,
            equipment_type="Cooling-water pump",
            user_id=MOCK_USER["uid"],
        )

        assert len(precedents) == 2
        outcomes = {p.outcome_status for p in precedents}
        assert outcomes == {"SUCCESSFUL", "UNSUCCESSFUL"}

        succ = next(p for p in precedents if p.outcome_status == "SUCCESSFUL")
        assert "replacing drive-end bearing" in succ.action_taken.lower()
        assert succ.id == "OUTCOME-TRIAL-SUCC-102"
        assert succ.verification_status == "TECHNICIAN_CONFIRMED"

        fail = next(p for p in precedents if p.outcome_status == "UNSUCCESSFUL")
        assert "coupling alignment" in fail.action_taken.lower()
        assert fail.id == "OUTCOME-TRIAL-FAIL-101"
        assert fail.verification_status == "TECHNICIAN_CONFIRMED"


def test_unverified_record_not_labeled_as_verified():
    """
    Requirement 4: An unverified historical record lacking verified outcome evidence
    must NEVER be labeled as TECHNICIAN_CONFIRMED or VERIFIED SUCCESS.
    """
    user_query = "What baseline history exists for pump CP-204?"

    raw_cloud_fragments = [
        {
            "id": "frag-baseline-1",
            "text": "Routine operational baseline inspection and vibration recording on cooling-water pump CP-204.",
            "document_id": "DOC-BASELINE-204",
            "tags": ["machine-cp-204", "maintenance-history"],
            "entities": ["CP-204"],
            "timestamp": "2026-11-14T05:00:00Z",
        }
    ]

    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", return_value=raw_cloud_fragments), \
         patch("backend.config.settings.HINDSIGHT_API_KEY", "mock-live-key"):

        precedents = chat_service.retrieve_precedents(
            query=user_query,
            mock_mode=False,
            equipment_type="Cooling-water pump",
            user_id=MOCK_USER["uid"],
        )

        assert len(precedents) == 1
        p = precedents[0]
        assert p.outcome_status == "UNRESOLVED"
        assert p.verification_status == "USER_REPORTED"
        assert p.verification_status != "TECHNICIAN_CONFIRMED"
        assert p.source_label == "Hindsight Cloud (Historical Record)"


@patch("backend.auth.auth.verify_id_token", return_value=MOCK_USER)
def test_api_chat_returns_deduplicated_precedents_with_clean_symptoms(mock_auth):
    """
    End-to-end API test: POST /api/chat with mock_memory=False returns clean precedents
    without query leakage into symptoms and with duplicate fragments deduplicated.
    """
    raw_cloud_fragments = [
        {
            "id": "frag-e2e-1",
            "text": "Cooling-water pump CP-204 experienced high vibration, abnormal noise, and elevated drive-end temperature.",
            "document_id": "OUTCOME-PUMP-DEMO-101",
            "tags": [f"user-{MOCK_USER['uid']}", "machine-cp-204", "outcome-successful"],
            "entities": ["CP-204", "Cooling-water pump"],
            "timestamp": "2026-11-14T07:00:00Z",
        },
        {
            "id": "frag-e2e-2",
            "text": "Technician repaired pump CP-204 by replacing the drive-end spherical roller bearing (SKF 22212). Verified outcome: SUCCESSFUL.",
            "document_id": "OUTCOME-PUMP-DEMO-101",
            "tags": [f"user-{MOCK_USER['uid']}", "machine-cp-204", "outcome-successful"],
            "entities": ["CP-204"],
            "timestamp": "2026-11-14T07:15:00Z",
        },
    ]

    user_message = "Why is cooling pump CP-204 overheating and shaking violently?"

    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", return_value=raw_cloud_fragments), \
         patch("backend.config.settings.HINDSIGHT_API_KEY", "mock-live-key"):

        response = client.post(
            "/api/chat",
            json={
                "message": user_message,
                "mock_memory": False,
            },
            headers=AUTH_HEADER,
        )

        assert response.status_code == 200
        data = response.json()
        assert "retrieved_precedents" in data
        precedents = data["retrieved_precedents"]

        # Exactly 1 precedent card for CP-204, NOT 2 duplicate cards
        assert len(precedents) == 1
        prec = precedents[0]
        assert prec["machine_id"] == "CP-204"
        assert prec["outcome_status"] == "SUCCESSFUL"
        assert "high vibration, abnormal noise, and elevated drive-end temperature" in prec["symptoms"].lower()

        # ZERO user question leakage
        assert user_message.lower() not in prec["symptoms"].lower()
        assert "shaking violently" not in prec["symptoms"].lower()
        assert "why is" not in prec["symptoms"].lower()
