import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_audit_repair_prerequisite_before_verification():
    """Verify that an unverified repair cannot be verified without a logged repair action."""
    # 1. Create incident
    resp = client.post(
        "/api/incidents",
        json={
            "machine_id": "AUDIT-M-01",
            "equipment_type": "Hydraulic Pump",
            "symptoms": "Fluid leakage",
            "severity": "MEDIUM",
            "reported_observations": "Small puddle observed near seal.",
            "is_demo": True,
        },
    )
    assert resp.status_code == 201
    inc_id = resp.json()["id"]

    # 2. Try to verify outcome immediately without logging a repair
    verify_resp = client.post(
        f"/api/incidents/{inc_id}/verify-outcome",
        json={
            "verified_by": "INSPECTOR-1",
            "outcome_status": "SUCCESSFUL",
            "inspection_notes": "Premature verification attempt.",
        },
    )
    # Must fail with 400 Bad Request because no repair action has been logged yet
    assert verify_resp.status_code == 400
    assert "No technician repair action has been recorded" in verify_resp.json()["detail"]


def test_audit_outcome_idempotency_and_conflict_protection():
    """
    Verify:
    1. Submitting the exact same verification returns the existing record idempotently.
    2. Changing an already verified outcome from SUCCESSFUL to UNSUCCESSFUL returns HTTP 409 Conflict.
    """
    # 1. Create incident and log repair
    resp = client.post(
        "/api/incidents",
        json={
            "machine_id": "AUDIT-M-02",
            "equipment_type": "Compressor",
            "symptoms": "Low pressure output",
            "severity": "HIGH",
            "reported_observations": "Discharge pressure dropped 30%.",
            "is_demo": True,
        },
    )
    assert resp.status_code == 201
    inc_id = resp.json()["id"]

    repair_resp = client.post(
        f"/api/incidents/{inc_id}/repair",
        json={
            "technician_id": "TECH-99",
            "action_taken": "Replaced valve seals",
            "notes": "Seals were worn.",
        },
    )
    assert repair_resp.status_code == 201

    # 2. First verification: SUCCESSFUL
    v1 = client.post(
        f"/api/incidents/{inc_id}/verify-outcome",
        json={
            "verified_by": "LEAD-AUDITOR",
            "outcome_status": "SUCCESSFUL",
            "inspection_notes": "Pressure restored to 8.5 bar.",
        },
    )
    assert v1.status_code == 201
    v1_data = v1.json()
    assert v1_data["outcome_status"] == "SUCCESSFUL"
    assert v1_data["hindsight_retained"] is True
    assert v1_data["hindsight_document_id"] == f"OUTCOME-{inc_id}"

    # 3. Duplicate verification with SAME status: must return existing record idempotently
    v2 = client.post(
        f"/api/incidents/{inc_id}/verify-outcome",
        json={
            "verified_by": "LEAD-AUDITOR",
            "outcome_status": "SUCCESSFUL",
            "inspection_notes": "Repeated call",
        },
    )
    assert v2.status_code in [200, 201]
    v2_data = v2.json()
    assert v2_data["id"] == v1_data["id"]
    assert v2_data["outcome_status"] == "SUCCESSFUL"
    assert v2_data["hindsight_document_id"] == f"OUTCOME-{inc_id}"

    # 4. Conflicting verification: trying to alter from SUCCESSFUL to UNSUCCESSFUL must return HTTP 409 Conflict
    v3 = client.post(
        f"/api/incidents/{inc_id}/verify-outcome",
        json={
            "verified_by": "LEAD-AUDITOR",
            "outcome_status": "UNSUCCESSFUL",
            "inspection_notes": "Trying to silently alter status",
        },
    )
    assert v3.status_code == 409
    assert "already been verified as SUCCESSFUL" in v3.json()["detail"]


def test_two_incidents_same_machine_independent_retention():
    """
    Verify:
    1. Two different incidents on the exact same machine retain independently in Hindsight.
    2. Each uses 'OUTCOME-{INCIDENT_ID}' as its document ID.
    3. Repeated retention of the same incident is idempotent and does not create duplicate memories.
    """
    machine_id = "M-DUAL-99"

    # --- Incident 1 on M-DUAL-99 ---
    resp_inc1 = client.post(
        "/api/incidents",
        json={
            "machine_id": machine_id,
            "equipment_type": "Centrifugal Pump",
            "symptoms": "Intake filter clogging",
            "severity": "LOW",
            "reported_observations": "Differential pressure across filter increased.",
            "is_demo": True,
        },
    )
    assert resp_inc1.status_code == 201
    inc1_id = resp_inc1.json()["id"]

    client.post(
        f"/api/incidents/{inc1_id}/repair",
        json={
            "technician_id": "TECH-01",
            "action_taken": "Replaced air intake filter element.",
        },
    )

    v_inc1 = client.post(
        f"/api/incidents/{inc1_id}/verify-outcome",
        json={
            "verified_by": "LEAD-01",
            "outcome_status": "SUCCESSFUL",
            "inspection_notes": "Pressure restored to normal range.",
        },
    )
    assert v_inc1.status_code == 201
    v_inc1_data = v_inc1.json()
    assert v_inc1_data["hindsight_document_id"] == f"OUTCOME-{inc1_id}"

    # Repeated retention for incident 1 must remain idempotent
    v_inc1_repeat = client.post(
        f"/api/incidents/{inc1_id}/verify-outcome",
        json={
            "verified_by": "LEAD-01",
            "outcome_status": "SUCCESSFUL",
            "inspection_notes": "Pressure restored to normal range.",
        },
    )
    assert v_inc1_repeat.status_code in [200, 201]
    assert v_inc1_repeat.json()["id"] == v_inc1_data["id"]

    # --- Incident 2 on SAME machine M-DUAL-99 ---
    resp_inc2 = client.post(
        "/api/incidents",
        json={
            "machine_id": machine_id,
            "equipment_type": "Centrifugal Pump",
            "symptoms": "Seal leakage and fluid drip",
            "severity": "MEDIUM",
            "reported_observations": "Fluid dripping from primary mechanical seal gland.",
            "is_demo": True,
        },
    )
    assert resp_inc2.status_code == 201
    inc2_id = resp_inc2.json()["id"]
    assert inc2_id != inc1_id

    client.post(
        f"/api/incidents/{inc2_id}/repair",
        json={
            "technician_id": "TECH-02",
            "action_taken": "Tightened packing gland without replacing mechanical seal.",
        },
    )

    v_inc2 = client.post(
        f"/api/incidents/{inc2_id}/verify-outcome",
        json={
            "verified_by": "LEAD-02",
            "outcome_status": "UNSUCCESSFUL",
            "inspection_notes": "Leakage persisted after 15 minutes of operation.",
        },
    )
    assert v_inc2.status_code == 201
    v_inc2_data = v_inc2.json()
    assert v_inc2_data["hindsight_document_id"] == f"OUTCOME-{inc2_id}"

    # Confirm distinct document IDs for the two incidents on the same machine
    assert v_inc1_data["hindsight_document_id"] != v_inc2_data["hindsight_document_id"]
    assert v_inc1_data["hindsight_document_id"] == f"OUTCOME-{inc1_id}"
    assert v_inc2_data["hindsight_document_id"] == f"OUTCOME-{inc2_id}"


def test_audit_all_six_endpoints_workflow():
    """Verify all six endpoints in full lifecycle sequence."""
    # 1. POST /api/incidents
    create_resp = client.post(
        "/api/incidents",
        json={
            "machine_id": "AUDIT-M-03",
            "equipment_type": "Centrifugal Pump",
            "symptoms": "Vibration spikes at 1800 RPM",
            "severity": "MEDIUM",
            "reported_observations": "Operator reports unusual harmonic vibration.",
            "is_demo": True,
        },
    )
    assert create_resp.status_code == 201
    inc = create_resp.json()
    inc_id = inc["id"]
    assert inc["status"] == "REPORTED"

    # 2. GET /api/incidents
    list_resp = client.get("/api/incidents?machine_id=AUDIT-M-03")
    assert list_resp.status_code == 200
    assert any(item["id"] == inc_id for item in list_resp.json())

    # 3. GET /api/incidents/{incident_id}
    detail_resp = client.get(f"/api/incidents/{inc_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["incident"]["id"] == inc_id

    # 4. POST /api/incidents/{incident_id}/investigate
    inv_resp = client.post(f"/api/incidents/{inc_id}/investigate")
    assert inv_resp.status_code == 200
    inv = inv_resp.json()
    assert "diagnosis_hypothesis" in inv
    assert "confidence" in inv

    # 5. POST /api/incidents/{incident_id}/repair
    repair_resp = client.post(
        f"/api/incidents/{inc_id}/repair",
        json={
            "technician_id": "TECH-AUDIT",
            "action_taken": "Aligned motor coupling and dynamic balanced impeller.",
        },
    )
    assert repair_resp.status_code == 201

    # 6. POST /api/incidents/{incident_id}/verify-outcome
    verify_resp = client.post(
        f"/api/incidents/{inc_id}/verify-outcome",
        json={
            "verified_by": "CHIEF-ENGINEER",
            "outcome_status": "SUCCESSFUL",
            "inspection_notes": "Vibration RMS dropped to 1.1 mm/s well below alarm threshold.",
        },
    )
    assert verify_resp.status_code == 201

    # Verify final updated status
    final_detail = client.get(f"/api/incidents/{inc_id}").json()
    assert final_detail["incident"]["status"] == "VERIFIED_SUCCESSFUL"
    assert len(final_detail["investigations"]) >= 1
    assert len(final_detail["repairs"]) >= 1
    assert len(final_detail["verifications"]) >= 1
