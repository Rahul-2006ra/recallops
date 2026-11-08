import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.main import app
from backend.models.incident import IncidentCreate
from backend.services.investigation_service import investigation_service
from backend.services.repair_conflict_service import repair_conflict_service

client = TestClient(app)


# ==============================================================================
# BENCHMARK SUITE: 5 CONTROLLED SYNTHETIC EVALUATION CASES
# ==============================================================================

def test_synthetic_case_1_similar_symptoms_same_repair_both_successful():
    """
    Synthetic Case 1:
    - Similar symptoms, same repair, both historical cases verified SUCCESSFUL.
    Expected:
    - No conflict detected (has_conflict == False).
    - Recommendation status: RECOMMENDED.
    - Zero false conflict warnings.
    - Traceable successful case IDs.
    """
    incident = {
        "id": "INC-TEST-CASE-1",
        "machine_id": "M-201",
        "equipment_type": "Centrifugal Slurry Pump",
        "symptoms": "Elevated bearing housing temperature at 82C and high-frequency vibration",
        "reported_observations": "Vibration localized at drive-end bearing. High-frequency acoustic resonance audible.",
    }

    memories = [
        {
            "document_id": "DOC-M-101",
            "text": (
                "[VERIFIED INDUSTRIAL MAINTENANCE RECORD]\n"
                "Incident ID: INC-101\n"
                "Machine ID: M-101\n"
                "Equipment Type: Centrifugal Slurry Pump\n"
                "Reported Symptoms: Overheating and high-frequency vibration\n"
                "Operator Observations: High-frequency bearing acoustic resonance\n"
                "Repair Action: Replaced drive-end bearing\n"
                "Verified Outcome: SUCCESSFUL\n"
                "Inspection Notes: Vibration normalized to 1.1 mm/s; temperature stable at 48C."
            ),
        },
        {
            "document_id": "DOC-M-102",
            "text": (
                "[VERIFIED INDUSTRIAL MAINTENANCE RECORD]\n"
                "Incident ID: INC-102\n"
                "Machine ID: M-102\n"
                "Equipment Type: Centrifugal Slurry Pump\n"
                "Reported Symptoms: Bearing thermal spike and high-frequency vibration\n"
                "Operator Observations: Localized bearing cage heating\n"
                "Repair Action: Bearing replacement and fresh grease pack\n"
                "Verified Outcome: SUCCESSFUL\n"
                "Inspection Notes: Temperature stabilized at 51C under 100% capacity."
            ),
        },
    ]

    analysis = repair_conflict_service.analyze_conflicts(incident, memories)

    assert analysis.has_conflict is False
    assert len(analysis.conflicts) == 1
    c = analysis.conflicts[0]
    assert c.normalized_action == "BEARING_REPLACEMENT"
    assert c.conflict_detected is False
    assert c.recommendation_status == "RECOMMENDED"
    assert len(c.successful_precedents) == 2
    assert len(c.unsuccessful_precedents) == 0
    assert analysis.recommended_action == "Bearing Replacement"
    assert analysis.caution_actions == []
    # Verify exact case traceability
    case_ids = {s.case_id for s in c.successful_precedents}
    assert "INC-101" in case_ids
    assert "INC-102" in case_ids


def test_synthetic_case_2_similar_symptoms_same_repair_conflicting_outcomes():
    """
    Synthetic Case 2 (The Core Benchmark):
    - Similar symptoms: Overheating and vibration on centrifugal pump.
    - Case A: Bearing replacement -> SUCCESSFUL (localized bearing fault).
    - Case B: Bearing replacement -> UNSUCCESSFUL (secondary symptom of shaft misalignment).
    Expected:
    - has_conflict == True.
    - Recommendation status: FURTHER_DIAGNOSIS_REQUIRED.
    - Identified differentiating factors between Case A and Case B.
    - Mandatory pre-repair diagnostic checks (laser alignment, FFT spectrum).
    - Distinct AI interpretation vs observed facts.
    """
    incident = {
        "id": "INC-TEST-CASE-2",
        "machine_id": "M-202",
        "equipment_type": "Centrifugal Slurry Pump",
        "symptoms": "Overheating and severe casing vibration under continuous load",
        "reported_observations": "Drive end warm to touch; vibration audible throughout skid.",
    }

    memories = [
        {
            "document_id": "DOC-M-104",
            "text": (
                "[VERIFIED INDUSTRIAL MAINTENANCE RECORD]\n"
                "Incident ID: INC-104\n"
                "Machine ID: M-104\n"
                "Equipment Type: Centrifugal Slurry Pump\n"
                "Reported Symptoms: Overheating and vibration\n"
                "Operator Observations: Localized bearing race temperature rise and high-frequency chatter\n"
                "Repair Action: Bearing replacement\n"
                "Verified Outcome: SUCCESSFUL\n"
                "Inspection Notes: Vibration normalized to 1.2 mm/s."
            ),
        },
        {
            "document_id": "DOC-M-108",
            "text": (
                "[VERIFIED INDUSTRIAL MAINTENANCE RECORD]\n"
                "Incident ID: INC-108\n"
                "Machine ID: M-108\n"
                "Equipment Type: Centrifugal Slurry Pump\n"
                "Reported Symptoms: Overheating and vibration\n"
                "Operator Observations: Shaft misalignment and coupling oscillation inducing secondary bearing heat\n"
                "Repair Action: Bearing replacement\n"
                "Verified Outcome: UNSUCCESSFUL\n"
                "Inspection Notes: New bearing ran hot immediately; shaft coupling misalignment was the actual root cause."
            ),
        },
    ]

    analysis = repair_conflict_service.analyze_conflicts(incident, memories)

    assert analysis.has_conflict is True
    assert len(analysis.conflicts) == 1
    c = analysis.conflicts[0]
    assert c.normalized_action == "BEARING_REPLACEMENT"
    assert c.conflict_detected is True
    assert c.recommendation_status == "FURTHER_DIAGNOSIS_REQUIRED"

    # Verify both precedent branches are populated
    assert len(c.successful_precedents) == 1
    assert c.successful_precedents[0].case_id == "INC-104"
    assert len(c.unsuccessful_precedents) == 1
    assert c.unsuccessful_precedents[0].case_id == "INC-108"

    # Verify differentiating factors
    assert len(c.differentiating_factors) >= 2
    assert any("successful" in df.lower() for df in c.differentiating_factors)
    assert any("unsuccessful" in df.lower() for df in c.differentiating_factors)

    # Verify mandatory diagnostic checks
    assert len(c.suggested_diagnostic_checks) >= 2
    checks_str = " ".join(c.suggested_diagnostic_checks).lower()
    assert "alignment" in checks_str
    assert "vibration" in checks_str or "fft" in checks_str

    # Verify clear separation of observed facts vs AI interpretation
    assert len(c.observed_historical_evidence) >= 2
    assert any("OBSERVED HISTORICAL FACT" in ev for ev in c.observed_historical_evidence)
    assert "AI INTERPRETATION" in c.ai_interpretation
    assert "conflicting verified outcomes" in c.ai_interpretation.lower()


def test_synthetic_case_3_similar_symptoms_different_repairs_different_outcomes():
    """
    Synthetic Case 3:
    - Similar symptoms: Overheating.
    - Repair 1: Ventilation cleaning -> SUCCESSFUL.
    - Repair 2: Mechanical seal replacement -> UNSUCCESSFUL.
    Expected:
    - has_conflict == False (different repair actions, no internal contradiction).
    - Ventilation cleaning: RECOMMENDED.
    - Mechanical seal replacement: CAUTION (previously unsuccessful).
    """
    incident = {
        "id": "INC-TEST-CASE-3",
        "machine_id": "M-203",
        "equipment_type": "Centrifugal Pump",
        "symptoms": "Elevated casing temperature after 40 minutes of operation",
        "reported_observations": "Airflow around motor cowl feels weak and restricted.",
    }

    memories = [
        {
            "document_id": "DOC-M-110",
            "text": (
                "[VERIFIED INDUSTRIAL MAINTENANCE RECORD]\n"
                "Incident ID: INC-110\n"
                "Machine ID: M-110\n"
                "Equipment Type: Centrifugal Pump\n"
                "Reported Symptoms: Overheating after 30 minutes\n"
                "Operator Observations: Dust clogging cooling air intake\n"
                "Repair Action: Cleaned the ventilation path and cleared clogged air intake grilles\n"
                "Verified Outcome: SUCCESSFUL\n"
                "Inspection Notes: Temperature dropped to 52C."
            ),
        },
        {
            "document_id": "DOC-M-111",
            "text": (
                "[VERIFIED INDUSTRIAL MAINTENANCE RECORD]\n"
                "Incident ID: INC-111\n"
                "Machine ID: M-111\n"
                "Equipment Type: Centrifugal Pump\n"
                "Reported Symptoms: Overheating on thermal imaging\n"
                "Operator Observations: Suspected seal friction\n"
                "Repair Action: Replace mechanical seal\n"
                "Verified Outcome: UNSUCCESSFUL\n"
                "Inspection Notes: Overheating persisted; seal was not the root cause."
            ),
        },
    ]

    analysis = repair_conflict_service.analyze_conflicts(incident, memories)

    assert analysis.has_conflict is False
    assert len(analysis.conflicts) == 2

    actions_map = {c.normalized_action: c for c in analysis.conflicts}
    assert "VENTILATION_COOLING_CLEANING" in actions_map
    assert "MECHANICAL_SEAL_REPLACEMENT" in actions_map

    vent_c = actions_map["VENTILATION_COOLING_CLEANING"]
    assert vent_c.recommendation_status == "RECOMMENDED"

    seal_c = actions_map["MECHANICAL_SEAL_REPLACEMENT"]
    assert seal_c.recommendation_status == "CAUTION"
    assert "Mechanical Seal Replacement" in analysis.caution_actions


def test_synthetic_case_4_insufficient_historical_evidence():
    """
    Synthetic Case 4:
    - Insufficient historical precedent records in memory bank.
    Expected:
    - has_conflict == False.
    - Explicit statement that conflict cannot be determined due to insufficient data.
    - No fabricated precedents or hallucinations.
    """
    incident = {
        "id": "INC-TEST-CASE-4",
        "machine_id": "M-204",
        "equipment_type": "Positive Displacement Compressor",
        "symptoms": "Intermittent magnetic pickup sensor pulse dropout",
        "reported_observations": "Tachometer reading drops to 0 RPM intermittently.",
    }

    # Empty memory retrieval
    analysis_empty = repair_conflict_service.analyze_conflicts(incident, [])
    assert analysis_empty.has_conflict is False
    assert "insufficient historical precedent" in analysis_empty.summary.lower()
    assert analysis_empty.conflicts == []
    assert analysis_empty.recommended_action is None

    # Memory with unverified outcome
    unverified_memories = [
        {
            "document_id": "DOC-UNVERIFIED",
            "text": "Machine M-999 had sensor dropout. Replaced magnetic pickup sensor. Outcome pending inspection.",
        }
    ]
    analysis_unverified = repair_conflict_service.analyze_conflicts(incident, unverified_memories)
    assert analysis_unverified.has_conflict is False
    assert len(analysis_unverified.conflicts) == 0


def test_synthetic_case_5_previously_unsuccessful_repair_not_blindly_repeated():
    """
    Synthetic Case 5:
    - Only unsuccessful historical precedent exists for a specific repair.
    Expected:
    - has_conflict == False (no successful precedent to conflict with).
    - Status: CAUTION (do not blindly repeat failed repair).
    - Action flagged in caution_actions.
    """
    incident = {
        "id": "INC-TEST-CASE-5",
        "machine_id": "M-205",
        "equipment_type": "Slurry Pump",
        "symptoms": "Acoustic resonance and 7.5 mm/s casing vibration",
        "reported_observations": "Vibration persists under no-load condition.",
    }

    memories = [
        {
            "document_id": "DOC-M-115",
            "text": (
                "[VERIFIED INDUSTRIAL MAINTENANCE RECORD]\n"
                "Incident ID: INC-115\n"
                "Machine ID: M-115\n"
                "Equipment Type: Slurry Pump\n"
                "Reported Symptoms: Acoustic resonance and 7.4 mm/s casing vibration\n"
                "Operator Observations: Suspected lube oil degradation\n"
                "Repair Action: Flush lubricant and replenish oil\n"
                "Verified Outcome: UNSUCCESSFUL\n"
                "Inspection Notes: Vibration amplitude unchanged at 7.4 mm/s. Oil flush did not resolve issue."
            ),
        }
    ]

    analysis = repair_conflict_service.analyze_conflicts(incident, memories)

    assert analysis.has_conflict is False
    assert len(analysis.conflicts) == 1
    c = analysis.conflicts[0]
    assert c.normalized_action == "LUBRICATION_FLUSH"
    assert c.recommendation_status == "CAUTION"
    assert "Lubrication Flush & Recharge" in analysis.caution_actions
    assert "avoid repeating" in c.ai_interpretation.lower()


# ==============================================================================
# INTEGRATION & API TEST: FASTAPI INVESTIGATION WITH CONFLICT INTELLIGENCE
# ==============================================================================

def test_investigation_endpoint_with_conflict_intelligence():
    """
    Test full end-to-end FastAPI `/investigate` and `/incidents/{id}` flow.
    Verifies that `conflict_analysis` is embedded in the response and SQLite persistence.
    """
    # 1. Create temporary incident
    inc_resp = client.post(
        "/api/incidents",
        json={
            "machine_id": "M-CONF-TEST",
            "equipment_type": "Centrifugal Slurry Pump",
            "symptoms": "Overheating and vibration",
            "severity": "HIGH",
            "reported_observations": "Continuous high vibration and casing temperature spike.",
            "is_demo": True,
        },
    )
    assert inc_resp.status_code == 201
    inc_id = inc_resp.json()["id"]

    # 2. Mock Hindsight recall with conflicting precedents (Case A vs Case B)
    mock_memories = [
        {
            "document_id": "DOC-CONF-A",
            "text": (
                "Incident ID: INC-CONF-A\n"
                "Machine ID: M-104\n"
                "Repair Action: Bearing replacement\n"
                "Operator Observations: High-frequency bearing chatter\n"
                "Verified Outcome: SUCCESSFUL"
            ),
        },
        {
            "document_id": "DOC-CONF-B",
            "text": (
                "Incident ID: INC-CONF-B\n"
                "Machine ID: M-108\n"
                "Repair Action: Bearing replacement\n"
                "Operator Observations: Shaft misalignment oscillation\n"
                "Verified Outcome: UNSUCCESSFUL"
            ),
        },
    ]

    with patch("backend.services.hindsight_service.hindsight_service.recall_memories", return_value=mock_memories), \
         patch("backend.services.hindsight_service.hindsight_service.reflect_on_incident", return_value="Historical conflict noted."):

        resp = client.post(f"/api/incidents/{inc_id}/investigate")
        assert resp.status_code == 200
        data = resp.json()

        assert "conflict_analysis" in data
        assert data["conflict_analysis"] is not None
        ca = data["conflict_analysis"]
        assert ca["has_conflict"] is True
        assert len(ca["conflicts"]) == 1
        assert ca["conflicts"][0]["recommendation_status"] == "FURTHER_DIAGNOSIS_REQUIRED"

        # 3. Verify SQLite persistence via GET /api/incidents/{id}
        get_resp = client.get(f"/api/incidents/{inc_id}")
        assert get_resp.status_code == 200
        details = get_resp.json()
        assert len(details["investigations"]) > 0
        inv = details["investigations"][0]
        assert inv["conflict_analysis"] is not None
        assert inv["conflict_analysis"]["has_conflict"] is True
        assert inv["conflict_analysis"]["conflicts"][0]["conflict_detected"] is True
