import sys
import json
import time
import concurrent.futures
import httpx
from backend.config import get_ssl_context

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "https://recallops-y3py.onrender.com"
ORIGIN = "https://recallops-lake.vercel.app"
HEADERS = {"Origin": ORIGIN, "Content-Type": "application/json"}

results = {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "tests": [],
}

def record_test(name, passed, details=""):
    results["total"] += 1
    if passed:
        results["passed"] += 1
        print(f"  [PASS] {name}: {details}")
    else:
        results["failed"] += 1
        print(f"  [FAIL] {name}: {details}")
    results["tests"].append({"name": name, "passed": passed, "details": str(details)})

def run_tests():
    print(f"Starting Backend API Reliability & Security Audit against {BASE_URL}...")

    with httpx.Client(verify=get_ssl_context(), timeout=35.0) as client:
        # 1. Health check & Root info
        r = client.get(f"{BASE_URL}/health", headers=HEADERS)
        record_test("GET /health", r.status_code == 200 and r.json().get("status") == "healthy", f"status={r.status_code}")

        r = client.get(f"{BASE_URL}/", headers=HEADERS)
        record_test("GET /", r.status_code == 200 and r.json().get("project") == "RecallOps", f"status={r.status_code}")

        # 2. CORS Preflight & Credentials
        r = client.options(f"{BASE_URL}/api/incidents", headers={"Origin": ORIGIN, "Access-Control-Request-Method": "GET"})
        cors_ok = (
            r.status_code == 200
            and r.headers.get("access-control-allow-origin") == ORIGIN
            and r.headers.get("access-control-allow-credentials") == "true"
        )
        record_test("CORS Preflight (Origin validation)", cors_ok, f"allow-origin={r.headers.get('access-control-allow-origin')}")

        # Disallowed CORS origin test
        r_disallowed = client.options(f"{BASE_URL}/api/incidents", headers={"Origin": "https://malicious-site.com", "Access-Control-Request-Method": "GET"})
        record_test("CORS Disallowed Origin Rejection", r_disallowed.status_code == 400 or r_disallowed.headers.get("access-control-allow-origin") is None, f"status={r_disallowed.status_code}")

        # 3. Missing required fields in incident creation
        r_missing = client.post(f"{BASE_URL}/api/incidents", json={"equipment_type": "Pump"}, headers=HEADERS)
        record_test("POST /api/incidents missing machine_id/symptoms (Validation)", r_missing.status_code == 422, f"status={r_missing.status_code}")

        # 4. Unknown Incident ID tests
        fake_id = "INC-NONEXISTENT-9999"
        r_404_get = client.get(f"{BASE_URL}/api/incidents/{fake_id}", headers=HEADERS)
        record_test("GET /api/incidents/{id} 404 for unknown ID", r_404_get.status_code == 404, f"status={r_404_get.status_code}")

        r_404_inv = client.post(f"{BASE_URL}/api/incidents/{fake_id}/investigate", headers=HEADERS)
        record_test("POST /investigate 404 for unknown ID", r_404_inv.status_code == 404, f"status={r_404_inv.status_code}")

        r_404_rep = client.post(f"{BASE_URL}/api/incidents/{fake_id}/repair", json={"technician_id": "T1", "action_taken": "fixed"}, headers=HEADERS)
        record_test("POST /repair 404 for unknown ID", r_404_rep.status_code == 404, f"status={r_404_rep.status_code}")

        # 5. Safe Error Messages (No traceback / secrets leaked)
        error_detail = r_404_get.text
        has_stack_trace = "Traceback" in error_detail or "File \"" in error_detail
        record_test("Safe Error Responses (No stack trace disclosure)", not has_stack_trace, "No internal frames exposed")

        # 6. Malformed JSON Body
        r_malformed = client.post(f"{BASE_URL}/api/incidents", content="This is not valid json", headers={"Origin": ORIGIN, "Content-Type": "application/json"})
        record_test("POST /api/incidents malformed JSON handling", r_malformed.status_code == 422, f"status={r_malformed.status_code}")

        # 7. Valid Incident Creation & Schema Validation
        test_payload = {
            "machine_id": "M-201",
            "equipment_type": "Slurry Pump",
            "symptoms": "High bearing temperature and high vibration",
            "severity": "HIGH",
            "reported_observations": "Automated reliability audit test incident",
            "is_demo": True
        }
        r_create = client.post(f"{BASE_URL}/api/incidents", json=test_payload, headers=HEADERS)
        created = r_create.json() if r_create.status_code == 201 else {}
        inc_id = created.get("id")
        record_test("POST /api/incidents valid creation", r_create.status_code == 201 and inc_id is not None, f"id={inc_id}")

        # 8. Filter incidents by machine_id and status
        r_filter = client.get(f"{BASE_URL}/api/incidents?machine_id=M-201", headers=HEADERS)
        record_test("GET /api/incidents?machine_id=M-201 filtering", r_filter.status_code == 200 and all(i["machine_id"] == "M-201" for i in r_filter.json()), f"count={len(r_filter.json())}")

        # 9. Repair submission with valid schema
        repair_payload = {
            "technician_id": "QA-TECH-01",
            "action_taken": "Aligned motor shafts using dual laser indicator and replaced grease pack",
            "parts_replaced": "SKF-6205-2RSH",
            "notes": "Verified shaft offset < 0.05 mm"
        }
        r_repair = client.post(f"{BASE_URL}/api/incidents/{inc_id}/repair", json=repair_payload, headers=HEADERS)
        record_test("POST /api/incidents/{id}/repair valid submission", r_repair.status_code == 201, f"status={r_repair.status_code}")

        # 10. Malformed numeric values in verify-outcome
        malformed_verify = {
            "verified_by": "LEAD-01",
            "outcome_status": "SUCCESSFUL",
            "inspection_notes": "Testing invalid metric types",
            "follow_up_metrics": {"temp_celsius": "NOT_A_NUMBER"}
        }
        r_mal_verify = client.post(f"{BASE_URL}/api/incidents/{inc_id}/verify-outcome", json=malformed_verify, headers=HEADERS)
        # Should gracefully accept or validate
        record_test("POST /verify-outcome type handling", r_mal_verify.status_code in [201, 422], f"status={r_mal_verify.status_code}")

        # 11. Valid Verification & Hindsight Memory Retention
        valid_verify = {
            "verified_by": "QA-LEAD-01",
            "outcome_status": "SUCCESSFUL",
            "inspection_notes": "Temperature normalized to 51C; vibration amplitude 1.3 mm/s",
            "follow_up_metrics": {"temp_celsius": 51.0, "vibration_amplitude_mms": 1.3}
        }
        r_verify = client.post(f"{BASE_URL}/api/incidents/{inc_id}/verify-outcome", json=valid_verify, headers=HEADERS)
        ver_data = r_verify.json() if r_verify.status_code == 201 else {}
        record_test("POST /verify-outcome successful verification", r_verify.status_code == 201, f"hindsight_retained={ver_data.get('hindsight_retained')}")

        # 12. Idempotent Verification (Duplicate attempt should not crash or corrupt)
        r_dup_verify = client.post(f"{BASE_URL}/api/incidents/{inc_id}/verify-outcome", json=valid_verify, headers=HEADERS)
        record_test("POST /verify-outcome idempotency on duplicate verification", r_dup_verify.status_code in [201, 409], f"status={r_dup_verify.status_code}")

        # 13. Concurrency Test: 5 simultaneous requests to incidents API
        def fetch_incidents():
            with httpx.Client(verify=get_ssl_context(), timeout=20.0) as c:
                return c.get(f"{BASE_URL}/api/incidents", headers=HEADERS).status_code

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(fetch_incidents) for _ in range(5)]
            statuses = [f.result() for f in futures]
            all_200 = all(s == 200 for s in statuses)
            record_test("Concurrent API load (5 simultaneous requests)", all_200, f"statuses={statuses}")

    print("\nAPI Test Audit Summary:")
    print(f"Total: {results['total']} | Passed: {results['passed']} | Failed: {results['failed']}")

    with open("qa_evidence/reports/api_reliability_audit.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    run_tests()
