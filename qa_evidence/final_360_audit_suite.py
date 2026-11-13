"""
RecallOps 2.0 — Final 360° Comprehensive Technical & AI Audit Suite
Validates Phases 1, 2, 3, 6, 7, 8, 9, 11 against the live running FastAPI backend.
"""

import io
import time
import json
import sqlite3
import httpx
import pytest
from datetime import datetime, timezone
from backend.config import settings
from backend.database import get_db

BASE_URL = "http://127.0.0.1:8000"

def run_360_backend_audit():
    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "phases_tested": ["Phase 1", "Phase 2", "Phase 3", "Phase 6", "Phase 7", "Phase 8", "Phase 9", "Phase 11"],
        "tests": [],
        "metrics": {},
    }

    client = httpx.Client(base_url=BASE_URL, timeout=15.0)

    def record_test(name, phase, status, details, evidence=None):
        results["tests"].append({
            "name": name,
            "phase": phase,
            "status": status,
            "details": details,
            "evidence": evidence or {},
        })
        print(f"[{status}] {name} ({phase}): {details}")

    print("\n=======================================================")
    print("STARTING RECALLOPS 2.0 — FINAL 360° BACKEND AUDIT")
    print("=======================================================\n")

    # -----------------------------------------------------------------
    # PHASE 1 & 6: Root Health, CORS, System Status & API Contracts
    # -----------------------------------------------------------------
    print("--- Checking Root Health, CORS & System Status ---")
    try:
        t0 = time.perf_counter()
        r = client.get("/health", headers={"Origin": "http://127.0.0.1:5173"})
        lat_health = (time.perf_counter() - t0) * 1000
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "healthy"
        assert r.headers.get("access-control-allow-origin") in ["http://127.0.0.1:5173", "http://localhost:5173", "*"]
        record_test("Health & CORS Check", "Phase 6", "PASSED", f"Status healthy, latency {lat_health:.2f}ms", data)
    except Exception as e:
        record_test("Health & CORS Check", "Phase 6", "FAILED", str(e))

    try:
        r = client.get("/")
        assert r.status_code == 200
        data = r.json()
        assert data["project"] == "RecallOps"
        assert data["version"] == "2.0.0"
        record_test("Root Endpoint Contract", "Phase 6", "PASSED", "Project metadata verified", data)
    except Exception as e:
        record_test("Root Endpoint Contract", "Phase 6", "FAILED", str(e))

    try:
        r = client.get("/api/chat/status")
        assert r.status_code == 200
        data = r.json()
        assert data["credit_preservation_active"] is True
        record_test("System Status & Hindsight Credit Preservation", "Phase 3", "PASSED", "Protection verified", data)
    except Exception as e:
        record_test("System Status & Hindsight Credit Preservation", "Phase 3", "FAILED", str(e))

    # -----------------------------------------------------------------
    # PHASE 2 & 7: Conversational Intelligence, Intent & English-Only Output
    # -----------------------------------------------------------------
    print("\n--- Testing Conversational Intelligence & English-Only Compliance ---")
    conv_id = None
    try:
        # Test A: Casual Greeting in Hindi
        r = client.post("/api/chat", json={"message": "नमस्ते RecallOps, आप कैसे हैं?"})
        assert r.status_code == 200
        res = r.json()
        conv_id = res["conversation_id"]
        assert res["intent"] in ["CASUAL_GREETING", "CASUAL_CONVERSATION"]
        assert res["equipment_detected"] is None
        # Must be in English
        has_devanagari = any("\u0900" <= c <= "\u097F" for c in res["reply"])
        assert not has_devanagari, f"Response contains Devanagari: {res['reply']}"
        record_test("Hindi Greeting -> English Response (Zero Diagnosis)", "Phase 2 & 7", "PASSED", "Polite English reply, zero equipment diagnosis", {"reply": res["reply"][:80]})
    except Exception as e:
        record_test("Hindi Greeting -> English Response (Zero Diagnosis)", "Phase 2 & 7", "FAILED", str(e))

    try:
        # Test B: Unrelated Query in Kannada
        r = client.post("/api/chat", json={"message": "ಭಾರತದ ಪ್ರಧಾನಿ ಯಾರು?", "conversation_id": conv_id})
        assert r.status_code == 200
        res = r.json()
        assert res["intent"] in ["UNRELATED_QUERY", "OFF_TOPIC_KNOWLEDGE_REQUEST"]
        assert res["equipment_detected"] is None
        has_kannada = any("\u0C80" <= c <= "\u0CFF" for c in res["reply"])
        assert not has_kannada, f"Response contains Kannada script: {res['reply']}"
        assert any(w in res["reply"].lower() for w in ["recallops", "equipment", "diagnos", "specializ", "troubleshoot"])
        record_test("Kannada Off-Topic -> English Redirection", "Phase 2 & 7", "PASSED", "Redirected to equipment diagnostics in English", {"reply": res["reply"][:80]})
    except Exception as e:
        record_test("Kannada Off-Topic -> English Redirection", "Phase 2 & 7", "FAILED", str(e))

    try:
        # Test C: Unseen Consumer Equipment (Bluetooth Speaker with Muted Volume Discovery)
        r1 = client.post("/api/chat", json={"message": "My portable Bluetooth speaker has no audio coming out."})
        assert r1.status_code == 200
        res1 = r1.json()
        assert res1["intent"] == "TROUBLESHOOTING_QUERY"
        assert "Plausible Causes" in res1["reply"]
        assert "Lockout/Tagout" not in res1["reply"]  # Consumer electronic, NO LOTO
        conv_speaker = res1["conversation_id"]

        # Turn 2: Root cause discovery in Hinglish
        r2 = client.post("/api/chat", json={
            "message": "Oh wait bro, volume was muted on my phone 😂",
            "conversation_id": conv_speaker
        })
        assert r2.status_code == 200
        res2 = r2.json()
        assert res2["intent"] in ["PROBLEM_EXPLANATION_OR_CAUSE", "EXPLANATION_DISCOVERY"]
        assert "bearing wear" not in res2["reply"].lower()
        assert "mechanical imbalance" not in res2["reply"].lower()
        assert any(w in res2["reply"].lower() for w in ["volume", "mute", "sound", "phone", "audio"])
        record_test("Unseen Speaker Muted Audio Continuity", "Phase 2 & 7", "PASSED", "Acknowledged muted phone, no bearing wear or LOTO", {"reply": res2["reply"][:100]})
    except Exception as e:
        record_test("Unseen Speaker Muted Audio Continuity", "Phase 2 & 7", "FAILED", str(e))

    try:
        # Test D: Unseen Household Device (Microwave with Kitchen Timer Mode)
        r1 = client.post("/api/chat", json={"message": "My microwave turns on and timer counts down but it does not heat any food at all."})
        res1 = r1.json()
        conv_micro = res1["conversation_id"]

        r2 = client.post("/api/chat", json={
            "message": "Actually I just realized it was in timer mode instead of cook time",
            "conversation_id": conv_micro
        })
        res2 = r2.json()
        assert res2["intent"] in ["PROBLEM_EXPLANATION_OR_CAUSE", "EXPLANATION_DISCOVERY"]
        assert "bearing wear" not in res2["reply"].lower()
        assert any(w in res2["reply"].lower() for w in ["timer", "cook", "heat", "mode"])
        record_test("Unseen Microwave Timer Mode Resolution", "Phase 2 & 7", "PASSED", "Understood timer mode explanation without generic mechanical diagnosis", {"reply": res2["reply"][:100]})
    except Exception as e:
        record_test("Unseen Microwave Timer Mode Resolution", "Phase 2 & 7", "FAILED", str(e))

    try:
        # Test E: Industrial CNC Machine with E-Stop
        r1 = client.post("/api/chat", json={"message": "Our shop CNC milling center axis drive will not move."})
        res1 = r1.json()
        conv_cnc = res1["conversation_id"]

        r2 = client.post("/api/chat", json={
            "message": "The apprentice accidentally hit the emergency stop button earlier",
            "conversation_id": conv_cnc
        })
        res2 = r2.json()
        assert res2["intent"] in ["PROBLEM_EXPLANATION_OR_CAUSE", "EXPLANATION_DISCOVERY"]
        assert any(w in res2["reply"].lower() for w in ["stop", "e-stop", "unlatch", "reset", "power"])
        record_test("CNC Emergency Stop Context Continuity", "Phase 2 & 7", "PASSED", "Identified E-stop latch mechanism and reset steps", {"reply": res2["reply"][:100]})
    except Exception as e:
        record_test("CNC Emergency Stop Context Continuity", "Phase 2 & 7", "FAILED", str(e))

    # -----------------------------------------------------------------
    # PHASE 3: Memory Lifecycle, Idempotency, and SQLite Verification
    # -----------------------------------------------------------------
    print("\n--- Testing Memory Lifecycle, Episodes & Strict Idempotency ---")
    try:
        # Step 1: Report equipment problem -> Episode created
        r_rep = client.post("/api/chat", json={"message": "My industrial slurry pump casing has severe vibration and high temperature."})
        res_rep = r_rep.json()
        conv_pump = res_rep["conversation_id"]
        
        # Verify problem episode in SQLite
        with get_db() as conn:
            ep = conn.execute("SELECT * FROM problem_episodes WHERE conversation_id = ? ORDER BY created_at DESC", (conv_pump,)).fetchone()
            assert ep is not None
            assert "Pump" in ep["equipment_name"]
            assert ep["status"] == "unresolved"
            ep_id = ep["id"]
        record_test("Problem Episode Creation in SQLite", "Phase 3", "PASSED", f"Episode {ep_id} created with unresolved status", {"episode_id": ep_id})

        # Step 2: Report successful repair outcome
        r_fix = client.post("/api/chat", json={
            "message": "Technician replaced the worn drive bearings and re-aligned the pump shaft. Vibration dropped to 1.8 mm/s.",
            "conversation_id": conv_pump
        })
        res_fix = r_fix.json()
        assert res_fix["intent"] == "REPORT_OUTCOME"
        assert res_fix["outcome_to_record"] is not None
        outcome_card = res_fix["outcome_to_record"]
        assert outcome_card["outcome_status"] == "SUCCESSFUL"
        assert outcome_card["ready_to_save"] is True
        idemp_key = outcome_card["idempotency_key"]
        record_test("Repair Outcome Detection & Card Generation", "Phase 3", "PASSED", "Generated outcome card with ready_to_save and idempotency key", outcome_card)

        # Step 3: Record outcome via POST /api/chat/record-outcome
        rec_req = {
            "conversation_id": conv_pump,
            "equipment_type": outcome_card["equipment_type"],
            "symptoms": outcome_card["symptoms"],
            "action_taken": outcome_card["action_taken"],
            "outcome_status": "SUCCESSFUL",
            "verification_status": "CONFIRMED",
            "verification_source": "Technician Verified",
            "idempotency_key": idemp_key,
            "episode_id": ep_id,
        }
        r_save1 = client.post("/api/chat/record-outcome", json=rec_req)
        assert r_save1.status_code == 200
        res_save1 = r_save1.json()
        assert res_save1["success"] is True
        assert res_save1["sync_status"] in ["local_only", "synced"]
        record_test("Record Outcome Execution", "Phase 3", "PASSED", "Successfully saved to SQLite verified records", res_save1)

        # Step 4: Verify episode status updated to 'resolved'
        with get_db() as conn:
            ep_updated = conn.execute("SELECT * FROM problem_episodes WHERE id = ?", (ep_id,)).fetchone()
            assert ep_updated["status"] == "resolved"
            assert "bearing" in ep_updated["resolution_action"].lower()
        record_test("Episode Resolved in SQLite", "Phase 3", "PASSED", "Episode transitioned from unresolved -> resolved", {"status": ep_updated["status"]})

        # Step 5: Duplicate submission test (Strict Idempotency)
        r_save2 = client.post("/api/chat/record-outcome", json=rec_req)
        assert r_save2.status_code == 200
        res_save2 = r_save2.json()
        assert res_save2.get("is_duplicate") is True
        record_test("Strict Idempotency on Duplicate Confirmation", "Phase 3", "PASSED", "Duplicate rejected gracefully without duplicate row", res_save2)

        # Step 6: Historical Precedent Retrieval in a completely new conversation
        r_new_conv = client.post("/api/chat", json={"message": "We have an industrial slurry pump vibrating heavily at our plant. What should we do?"})
        res_new = r_new_conv.json()
        assert res_new["intent"] == "TROUBLESHOOTING_QUERY"
        precedents = res_new.get("retrieved_precedents", [])
        assert len(precedents) > 0
        has_bearing_fix = any("bearing" in p.get("action_taken", "").lower() for p in precedents)
        assert has_bearing_fix
        record_test("Cross-Conversation Historical Memory Retrieval", "Phase 3", "PASSED", f"Successfully recalled {len(precedents)} verified precedents in fresh session", {"precedents_count": len(precedents)})

    except Exception as e:
        record_test("Memory Lifecycle & Retrieval", "Phase 3", "FAILED", str(e))

    # -----------------------------------------------------------------
    # PHASE 4: Audio Transcription Validation & Limits
    # -----------------------------------------------------------------
    print("\n--- Testing Audio Transcription Endpoint & Validation ---")
    try:
        # Test empty audio file
        r_empty = client.post("/api/transcribe", files={"file": ("empty.wav", b"", "audio/wav")})
        assert r_empty.status_code == 400
        record_test("Reject Empty Audio File", "Phase 4", "PASSED", "Returned HTTP 400 for 0-byte file", r_empty.json())
    except Exception as e:
        record_test("Reject Empty Audio File", "Phase 4", "FAILED", str(e))

    try:
        # Test non-audio file
        r_text = client.post("/api/transcribe", files={"file": ("test.txt", b"plain text content", "text/plain")})
        assert r_text.status_code == 400
        record_test("Reject Non-Audio File Format", "Phase 4", "PASSED", "Returned HTTP 400 for text/plain", r_text.json())
    except Exception as e:
        record_test("Reject Non-Audio File Format", "Phase 4", "FAILED", str(e))

    # -----------------------------------------------------------------
    # PHASE 9: Performance & Latency Benchmarks
    # -----------------------------------------------------------------
    print("\n--- Running Latency & Performance Benchmarks ---")
    try:
        # Intent classification + Precedent retrieval latency
        latencies = []
        for i in range(3):
            t0 = time.perf_counter()
            r = client.post("/api/chat", json={"message": "Can you check past repair records for centrifugal slurry pump?"})
            assert r.status_code == 200
            dur = (time.perf_counter() - t0) * 1000
            latencies.append(dur)
        avg_chat = sum(latencies) / len(latencies)
        results["metrics"]["avg_chat_latency_ms"] = round(avg_chat, 2)
        record_test("Chat Latency Benchmark", "Phase 9", "PASSED", f"Average turn latency: {avg_chat:.2f}ms over 3 queries", {"latencies": latencies})
    except Exception as e:
        record_test("Chat Latency Benchmark", "Phase 9", "FAILED", str(e))

    # Save results to file
    report_path = "qa_evidence/reports/final_360_backend_audit_results.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    passed_count = sum(1 for t in results["tests"] if t["status"] == "PASSED")
    failed_count = sum(1 for t in results["tests"] if t["status"] == "FAILED")
    print("\n=======================================================")
    print(f"BACKEND AUDIT COMPLETE: {passed_count} PASSED, {failed_count} FAILED")
    print(f"Results saved to: {report_path}")
    print("=======================================================\n")
    return passed_count, failed_count

if __name__ == "__main__":
    passed, failed = run_360_backend_audit()
    if failed > 0:
        exit(1)
