import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

test_prompts = [
    "Hello!",
    "What is a bearing?",
    "My industrial pump is overheating.",
    "The technician replaced the bearing and now it works.",
    "Thank you."
]

conversation_id = None
print("=" * 70)
print("TESTING 5 INTENT-AWARE PROMPTS (MOCK_MEMORY=TRUE, 0 HINDSIGHT CREDITS)")
print("=" * 70)

for p in test_prompts:
    payload = {"message": p, "mock_memory": True}
    if conversation_id:
        payload["conversation_id"] = conversation_id
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    
    conversation_id = data.get("conversation_id", conversation_id)
    print(f"\n>>> USER: {p}")
    print(f"INTENT DETECTED: {data.get('intent')}")
    print(f"PRECEDENTS RETRIEVED: {len(data.get('retrieved_precedents', []))}")
    if data.get("retrieved_precedents"):
        for prec in data["retrieved_precedents"]:
            print(f"  - [{prec['machine_id']}] {prec['equipment_type']}: {prec['action_taken']} ({prec['outcome_status']}) | Source: {prec.get('source_label')} | Status: {prec.get('verification_status')}")
    if data.get("hazard_warning"):
        print(f"SAFETY ALERT: {data['hazard_warning']}")
    if data.get("outcome_to_record"):
        print(f"OUTCOME DETECTED: {data['outcome_to_record']}")
    print(f"ASSISTANT REPLY:\n{data.get('reply', '').strip()}\n")
    print("-" * 70)

print("\nALL 5 INTENT-AWARE CONVERSATIONAL TESTS COMPLETED SUCCESSFULLY.")
