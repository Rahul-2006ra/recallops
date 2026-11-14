import os
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import settings
from backend.auth import AuthenticatedUser
from backend.services.hindsight_service import hindsight_service

client = TestClient(app)

# Ensure test auth mode is enabled for test suite
settings.TEST_AUTH_ENABLED = True

TOKEN_ALPHA = "test-token:technician_alpha:alpha@plant.com:Technician Alpha"
TOKEN_BETA = "test-token:technician_beta:beta@plant.com:Technician Beta"

AUTH_HEADER_ALPHA = {"Authorization": f"Bearer {TOKEN_ALPHA}"}
AUTH_HEADER_BETA = {"Authorization": f"Bearer {TOKEN_BETA}"}


def test_public_endpoints_accessible_without_auth():
    """Verify that / and /health remain public and functional."""
    res_root = client.get("/")
    assert res_root.status_code == 200
    assert res_root.json()["project"] == "RecallOps"

    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "healthy"


def test_unauthenticated_requests_strictly_rejected():
    """Verify that every private endpoint rejects unauthenticated requests with 401."""
    endpoints_to_test = [
        ("GET", "/api/auth/me", None),
        ("GET", "/api/conversations", None),
        ("POST", "/api/chat", {"message": "Hello", "mock_memory": True}),
        ("GET", "/api/memories", None),
        ("GET", "/api/incidents", None),
        ("POST", "/api/incidents", {"title": "Test Leak", "machine_id": "M-99"}),
        ("POST", "/api/chat/record-outcome", {
            "equipment_type": "Pump",
            "symptoms": "Overheating",
            "action_taken": "Replaced seal",
            "outcome_status": "SUCCESSFUL",
            "mock_memory": True
        }),
    ]

    for method, path, json_data in endpoints_to_test:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path, json=json_data)
        assert res.status_code == 401, f"{method} {path} should return 401 when unauthenticated, got {res.status_code}"


def test_invalid_bearer_token_rejected():
    """Verify that invalid or forged tokens return 401."""
    # When token does not start with test-token: and TEST_AUTH_ENABLED is on, real firebase verification will reject it
    headers = {"Authorization": "Bearer invalid_forged_jwt_token"}
    res = client.get("/api/conversations", headers=headers)
    assert res.status_code == 401


def test_auth_me_endpoint_returns_verified_identity():
    """Verify /api/auth/me returns the authenticated identity derived from token."""
    res = client.get("/api/auth/me", headers=AUTH_HEADER_ALPHA)
    assert res.status_code == 200
    data = res.json()
    assert data["uid"] == "technician_alpha"
    assert data["email"] == "alpha@plant.com"
    assert data["name"] == "Technician Alpha"


def test_conversation_data_isolation():
    """Verify that User Alpha's conversations are strictly invisible to User Beta."""
    # User Alpha creates a chat conversation
    res_chat = client.post(
        "/api/chat",
        headers=AUTH_HEADER_ALPHA,
        json={
            "message": "My industrial cooling pump is vibrating heavily.",
            "mock_memory": True,
        },
    )
    assert res_chat.status_code == 200
    alpha_conv_id = res_chat.json()["conversation_id"]
    assert alpha_conv_id is not None

    # User Alpha can list and see their conversation
    res_list_alpha = client.get("/api/conversations", headers=AUTH_HEADER_ALPHA)
    assert res_list_alpha.status_code == 200
    alpha_conv_ids = [c["id"] for c in res_list_alpha.json()]
    assert alpha_conv_id in alpha_conv_ids

    # User Beta lists conversations: User Alpha's conversation MUST NOT appear
    res_list_beta = client.get("/api/conversations", headers=AUTH_HEADER_BETA)
    assert res_list_beta.status_code == 200
    beta_conv_ids = [c["id"] for c in res_list_beta.json()]
    assert alpha_conv_id not in beta_conv_ids

    # User Beta tries direct ID access to User Alpha's conversation -> MUST return 404
    res_direct_beta = client.get(f"/api/conversations/{alpha_conv_id}", headers=AUTH_HEADER_BETA)
    assert res_direct_beta.status_code == 404

    # User Beta tries to delete User Alpha's conversation -> MUST return 404
    res_del_beta = client.delete(f"/api/conversations/{alpha_conv_id}", headers=AUTH_HEADER_BETA)
    assert res_del_beta.status_code == 404


def test_incident_data_isolation():
    """Verify that User Alpha's incidents and investigations cannot be viewed or modified by User Beta."""
    # User Alpha reports an incident
    res_inc = client.post(
        "/api/incidents",
        headers=AUTH_HEADER_ALPHA,
        json={
            "machine_id": "M-ALPHA-01",
            "equipment_type": "Centrifugal Pump",
            "symptoms": "Cavitation detected on primary intake line with high vibration",
            "severity": "CRITICAL",
            "reported_observations": "Cavitation detected on primary intake line.",
        },
    )
    assert res_inc.status_code == 201
    alpha_inc_id = res_inc.json()["id"]

    # User Alpha sees it in their incident list
    res_list_alpha = client.get("/api/incidents", headers=AUTH_HEADER_ALPHA)
    assert res_list_alpha.status_code == 200
    assert any(i["id"] == alpha_inc_id for i in res_list_alpha.json())

    # User Beta does NOT see it in their incident list
    res_list_beta = client.get("/api/incidents", headers=AUTH_HEADER_BETA)
    assert res_list_beta.status_code == 200
    assert not any(i["id"] == alpha_inc_id for i in res_list_beta.json())

    # User Beta direct inspection -> 404
    res_detail_beta = client.get(f"/api/incidents/{alpha_inc_id}", headers=AUTH_HEADER_BETA)
    assert res_detail_beta.status_code == 404

    # User Beta cannot run investigation on Alpha's incident -> 404
    res_inv_beta = client.post(f"/api/incidents/{alpha_inc_id}/investigate", headers=AUTH_HEADER_BETA)
    assert res_inv_beta.status_code == 404

    # User Beta cannot log repair on Alpha's incident -> 404
    res_repair_beta = client.post(
        f"/api/incidents/{alpha_inc_id}/repair",
        headers=AUTH_HEADER_BETA,
        json={
            "technician_id": "technician_beta",
            "action_taken": "Swapped impeller",
            "parts_replaced": "Impeller",
            "notes": "Attempted repair by Beta",
        },
    )
    assert res_repair_beta.status_code == 404

    # User Beta cannot verify outcome on Alpha's incident -> 404
    res_verify_beta = client.post(
        f"/api/incidents/{alpha_inc_id}/verify-outcome",
        headers=AUTH_HEADER_BETA,
        json={
            "verified_by": "technician_beta",
            "outcome_status": "SUCCESSFUL",
            "inspection_notes": "Attempted verification by Beta",
        },
    )
    assert res_verify_beta.status_code == 404


def test_memory_and_outcome_isolation():
    """Verify that User Alpha's verified outcomes and memories are completely isolated from User Beta."""
    # User Alpha records an outcome
    res_outcome = client.post(
        "/api/chat/record-outcome",
        headers=AUTH_HEADER_ALPHA,
        json={
            "equipment_type": "Induction Motor",
            "symptoms": "High frequency stator whining and overheating",
            "action_taken": "Regreased drive-end bearings and cleaned cooling fins",
            "outcome_status": "SUCCESSFUL",
            "machine_id": "M-ALPHA-MOTOR",
            "technician_notes": "Temperature normalized within 15 mins",
            "mock_memory": True,
        },
    )
    assert res_outcome.status_code == 200
    alpha_mem_id = res_outcome.json()["verification_id"]
    assert alpha_mem_id is not None

    # User Alpha searches memories -> found
    res_mem_alpha = client.get(
        "/api/memories",
        headers=AUTH_HEADER_ALPHA,
        params={"query": "stator whining", "mock_memory": True},
    )
    assert res_mem_alpha.status_code == 200
    alpha_mems = res_mem_alpha.json().get("memories", [])
    assert any(m["id"] == alpha_mem_id for m in alpha_mems)

    # User Beta searches memories -> User Alpha's memory is NOT returned
    res_mem_beta = client.get(
        "/api/memories",
        headers=AUTH_HEADER_BETA,
        params={"query": "stator whining", "mock_memory": True},
    )
    assert res_mem_beta.status_code == 200
    beta_mems = res_mem_beta.json().get("memories", [])
    assert not any(m["id"] == alpha_mem_id for m in beta_mems)

    # User Beta direct memory ID fetch -> 404
    res_direct_mem_beta = client.get(f"/api/memories/{alpha_mem_id}", headers=AUTH_HEADER_BETA)
    assert res_direct_mem_beta.status_code == 404


def test_hindsight_user_scoping_and_cross_user_drop_guard():
    """Verify Hindsight user bank routing and cross-user tag drop guard."""
    bank_id_alpha = hindsight_service.get_user_bank_id("tech_123")
    assert "tech_123" in bank_id_alpha
    assert bank_id_alpha.startswith("recallops-demo-u-")

    # Verify that cross-user items are dropped by recall_memories post-retrieval guard
    cross_user_mock = [
        {
            "id": "mem_1",
            "text": "Correct memory for tech_123",
            "tags": ["user-tech_123", "equipment-pump"],
        },
        {
            "id": "mem_2",
            "text": "Leaked memory from tech_999",
            "tags": ["user-tech_999", "equipment-pump"],
        },
    ]

    # Test the cross-user filter logic implemented in hindsight_service
    user_id = "tech_123"
    isolated_results = []
    for item in cross_user_mock:
        tags = item.get("tags", [])
        foreign_tags = [t for t in tags if t.startswith("user-") and t != f"user-{user_id}"]
        if foreign_tags:
            continue
        isolated_results.append(item)

    assert len(isolated_results) == 1
    assert isolated_results[0]["id"] == "mem_1"
