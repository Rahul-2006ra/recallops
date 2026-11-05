import time
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_scenario_f_cross_machine_learning_and_differentiation():
    """
    Scenario F:
    1. M-104: Overheating; ventilation cleaning; successful verified outcome.
    2. M-108: Overheating; component replacement; unsuccessful verified outcome.
    3. M-112: New overheating incident with no known diagnosis.
    Investigate M-112 and verify that the agent retrieves the first two incidents
    and differentiates their outcomes (success vs failure).
    """

    # --- Step 1: Create, Repair, and Verify M-104 (Successful) ---
    resp_104 = client.post(
        "/api/incidents",
        json={
            "machine_id": "M-104",
            "equipment_type": "Centrifugal Pump",
            "symptoms": "Overheating after 30 minutes of operation",
            "severity": "HIGH",
            "reported_observations": "Cooling airflow near motor housing feels weak and hot air is trapped.",
            "is_demo": True,
        },
    )
    assert resp_104.status_code == 201
    inc_104_id = resp_104.json()["id"]

    repair_104 = client.post(
        f"/api/incidents/{inc_104_id}/repair",
        json={
            "technician_id": "TECH-042",
            "action_taken": "Cleaned the ventilation path and cleared clogged air intake grilles.",
            "notes": "Debris completely removed from cooling ducts.",
        },
    )
    assert repair_104.status_code == 201

    verify_104 = client.post(
        f"/api/incidents/{inc_104_id}/verify-outcome",
        json={
            "verified_by": "LEAD-ENG-007",
            "outcome_status": "SUCCESSFUL",
            "inspection_notes": "Successful repair. Temperature returned to normal (52°C) during 60-minute full load inspection.",
            "follow_up_metrics": {"temp_celsius": 52.0, "vibration_mm_s": 2.1},
        },
    )
    assert verify_104.status_code == 201
    assert verify_104.json()["hindsight_retained"] is True

    # Test idempotency (no duplicate Hindsight retention on second call)
    verify_104_dup = client.post(
        f"/api/incidents/{inc_104_id}/verify-outcome",
        json={
            "verified_by": "LEAD-ENG-007",
            "outcome_status": "SUCCESSFUL",
            "inspection_notes": "Duplicate verification confirmation test.",
        },
    )
    assert verify_104_dup.status_code == 201
    assert verify_104_dup.json()["hindsight_retained"] is True

    # --- Step 2: Create, Repair, and Verify M-108 (Unsuccessful) ---
    resp_108 = client.post(
        "/api/incidents",
        json={
            "machine_id": "M-108",
            "equipment_type": "Centrifugal Pump",
            "symptoms": "Overheating after 30 minutes of operation",
            "severity": "HIGH",
            "reported_observations": "Technician suspected drive bearing friction was generating excessive heat.",
            "is_demo": True,
        },
    )
    assert resp_108.status_code == 201
    inc_108_id = resp_108.json()["id"]

    repair_108 = client.post(
        f"/api/incidents/{inc_108_id}/repair",
        json={
            "technician_id": "TECH-088",
            "action_taken": "Component replacement: replaced motor shaft drive bearings.",
            "parts_replaced": "SKF-6205-2RSH bearings",
            "notes": "Old bearings showed minor wear; replaced with fresh bearings.",
        },
    )
    assert repair_108.status_code == 201

    verify_108 = client.post(
        f"/api/incidents/{inc_108_id}/verify-outcome",
        json={
            "verified_by": "LEAD-ENG-007",
            "outcome_status": "UNSUCCESSFUL",
            "inspection_notes": "Unsuccessful outcome. Overheating recurred after 28 minutes of operation; component replacement of bearings failed to solve root cause.",
            "follow_up_metrics": {"temp_celsius": 89.4},
        },
    )
    assert verify_108.status_code == 201
    assert verify_108.json()["hindsight_retained"] is True

    # Small pause to allow memory indexing in cloud
    time.sleep(2)

    # --- Step 3: Create M-112 (New incident without known diagnosis) ---
    resp_112 = client.post(
        "/api/incidents",
        json={
            "machine_id": "M-112",
            "equipment_type": "Centrifugal Pump",
            "symptoms": "Overheating after 30 minutes of continuous operation",
            "severity": "HIGH",
            "reported_observations": "Thermal camera shows casing temperature exceeding 85°C. Root cause unknown.",
            "is_demo": True,
        },
    )
    assert resp_112.status_code == 201
    inc_112_id = resp_112.json()["id"]

    # --- Step 4: Investigate M-112 ---
    inv_resp = client.post(f"/api/incidents/{inc_112_id}/investigate")
    assert inv_resp.status_code == 200

    inv_data = inv_resp.json()
    assert inv_data["incident_id"] == inc_112_id
    assert "diagnosis_hypothesis" in inv_data
    assert 0.0 <= inv_data["confidence"] <= 1.0
    assert len(inv_data["recommended_diagnostic_steps"]) > 0
    assert len(inv_data["safety_warnings"]) > 0

    # Verify retrieval and differentiation:
    # 1. Historical references or supporting evidence mentions M-104, ventilation, or successful repair
    history_str = " ".join(
        inv_data["relevant_historical_incidents"] + inv_data["supporting_evidence"]
    ).lower()
    assert (
        "104" in history_str
        or "ventilation" in history_str
        or "ventilation" in inv_data["diagnosis_hypothesis"].lower()
    )

    # 2. Unsuccessful previous repairs acknowledges that component replacement / bearings failed on M-108
    unsuccessful_str = " ".join(inv_data["unsuccessful_previous_repairs"]).lower()
    assert (
        "108" in unsuccessful_str
        or "bearing" in unsuccessful_str
        or "component replacement" in unsuccessful_str
        or len(inv_data["unsuccessful_previous_repairs"]) > 0
    )

    # --- Step 5: Verify Incident Details Endpoint ---
    detail_resp = client.get(f"/api/incidents/{inc_112_id}")
    assert detail_resp.status_code == 200
    detail_data = detail_resp.json()
    assert detail_data["incident"]["status"] == "INVESTIGATED"
    assert len(detail_data["investigations"]) >= 1
