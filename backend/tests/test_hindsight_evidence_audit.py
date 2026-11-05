import pytest
import asyncio
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import settings
from backend.services.hindsight_service import hindsight_service
from backend.services.investigation_service import investigation_service

client = TestClient(app)


def test_m112_memory_persistence_in_hindsight():
    """Verify that INC-20261105-CF6B1D (M-112) is genuinely stored in Hindsight Cloud bank."""
    async def _check():
        h_client = hindsight_service.get_client()
        doc = await h_client.documents.get_document(
            bank_id=settings.HINDSIGHT_BANK_ID,
            document_id="OUTCOME-INC-20261105-CF6B1D",
        )
        return doc

    try:
        doc = asyncio.run(_check())
    finally:
        hindsight_service.close()

    doc_dict = doc.to_dict() if hasattr(doc, "to_dict") else {}
    original_text = doc_dict.get("original_text", "")

    assert doc_dict.get("id") == "OUTCOME-INC-20261105-CF6B1D"
    assert "M-112" in original_text
    assert "TECH-941" in original_text
    assert "SUCCESSFUL" in original_text
    assert "1.2 mm/s" in original_text or "1.2" in original_text
    assert "48" in original_text
    assert "machine-m-112" in doc_dict.get("tags", [])


def test_hindsight_recall_retrieves_m112_for_new_machine():
    """Verify that querying symptoms from M-TEST-002 actually recalls M-112 from Hindsight Cloud."""
    query = "Industrial Centrifugal Pump High-frequency vibration and overheating after 25 minutes of operation"
    memories = hindsight_service.recall_memories(query=query, budget="low")

    assert len(memories) > 0

    # Confirm M-112 is present among retrieved memories
    m112_found = any(
        "M-112" in m.get("text", "") or m.get("document_id") == "OUTCOME-INC-20261105-CF6B1D"
        for m in memories
    )
    assert m112_found, "Hindsight Cloud recall must retrieve the verified M-112 memory for cross-machine learning."


def test_precedent_classification_m108_unsuccessful_m104_successful():
    """Verify that M-104 is classified as SUCCESSFUL and M-108 as UNSUCCESSFUL in database and investigation."""
    details = investigation_service.get_incident_details("INC-20261105-C772FE")
    assert len(details.investigations) > 0

    inv = details.investigations[0]
    unsucc_text = " ".join(inv.unsuccessful_previous_repairs).upper()
    supp_text = " ".join(inv.supporting_evidence).upper()

    # M-108 bearing replacement was unsuccessful
    assert "M-108" in unsucc_text or "M 108" in unsucc_text
    assert "BEARING" in unsucc_text

    # M-104 ventilation cleaning was successful
    assert "M-104" in supp_text or "M 104" in supp_text
    assert "VENTILATION" in supp_text or "CLEANING" in supp_text

    # M-112 alignment and balancing was successful
    assert "M-112" in supp_text or "M 112" in supp_text
    assert "BALANCING" in supp_text or "ALIGNMENT" in supp_text


def test_duplicate_verification_protection_and_conflict():
    """Verify that verified outcomes cannot be altered to a conflicting status."""
    # Attempting to post UNSUCCESSFUL verification on already SUCCESSFUL incident
    conflict_payload = {
        "verified_by": "ATTACKER-99",
        "outcome_status": "UNSUCCESSFUL",
        "inspection_notes": "Attempting unauthorized status mutation.",
    }
    res = client.post("/api/incidents/INC-20261105-CF6B1D/verify-outcome", json=conflict_payload)
    assert res.status_code == 409
    assert "already been verified" in res.json()["detail"].lower()
