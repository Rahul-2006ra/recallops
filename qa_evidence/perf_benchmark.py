import sys
import time
import json
import httpx
from backend.config import get_ssl_context

sys.stdout.reconfigure(encoding='utf-8')

FRONTEND_URL = "https://recallops-lake.vercel.app"
BACKEND_URL = "https://recallops-y3py.onrender.com"

def run_perf():
    print("--- Phase 9: Performance & Latency Measurements ---")
    metrics = {}

    with httpx.Client(verify=get_ssl_context(), timeout=45.0) as client:
        # 1. Frontend Homepage Latency
        latencies_fe = []
        for i in range(3):
            t0 = time.perf_counter()
            r = client.get(FRONTEND_URL)
            dur = (time.perf_counter() - t0) * 1000
            latencies_fe.append(dur)
        avg_fe = sum(latencies_fe) / len(latencies_fe)
        metrics["frontend_avg_ms"] = round(avg_fe, 2)
        print(f"Frontend Homepage Avg Latency: {metrics['frontend_avg_ms']} ms")

        # 2. Backend Health Latency
        latencies_health = []
        for i in range(3):
            t0 = time.perf_counter()
            r = client.get(f"{BACKEND_URL}/health", headers={"Origin": FRONTEND_URL})
            dur = (time.perf_counter() - t0) * 1000
            latencies_health.append(dur)
        avg_health = sum(latencies_health) / len(latencies_health)
        metrics["backend_health_avg_ms"] = round(avg_health, 2)
        print(f"Backend /health Avg Latency: {metrics['backend_health_avg_ms']} ms")

        # 3. Incidents List Latency
        latencies_inc = []
        for i in range(3):
            t0 = time.perf_counter()
            r = client.get(f"{BACKEND_URL}/api/incidents", headers={"Origin": FRONTEND_URL})
            dur = (time.perf_counter() - t0) * 1000
            latencies_inc.append(dur)
        avg_inc = sum(latencies_inc) / len(latencies_inc)
        metrics["backend_incidents_list_avg_ms"] = round(avg_inc, 2)
        print(f"Backend /api/incidents Avg Latency: {metrics['backend_incidents_list_avg_ms']} ms")

        # 4. Measure live AI Investigation Latency (Groq + Hindsight)
        print("Measuring AI Investigation Latency (Groq inference + Hindsight retrieval)...")
        # Create incident
        r_create = client.post(
            f"{BACKEND_URL}/api/incidents",
            json={
                "machine_id": "M-301",
                "equipment_type": "Centrifugal Slurry Pump",
                "symptoms": "Benchmark casing vibration 7.1 mm/s",
                "severity": "HIGH",
                "reported_observations": "Baseline run for automated performance testing",
                "is_demo": True
            },
            headers={"Origin": FRONTEND_URL, "Content-Type": "application/json"}
        )
        inc_id = r_create.json()["id"]

        t0 = time.perf_counter()
        r_inv = client.post(f"{BACKEND_URL}/api/incidents/{inc_id}/investigate", headers={"Origin": FRONTEND_URL})
        inv_dur = (time.perf_counter() - t0) * 1000
        metrics["ai_investigation_total_ms"] = round(inv_dur, 2)
        print(f"AI Investigation (Groq + Hindsight) Total Latency: {metrics['ai_investigation_total_ms']} ms")

    with open("qa_evidence/reports/performance_metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

if __name__ == "__main__":
    run_perf()
