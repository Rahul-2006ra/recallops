import time
import json
import logging
from typing import Any, Optional
import httpx
from groq import Groq
from backend.config import settings, get_ssl_context

logger = logging.getLogger(__name__)

INVESTIGATION_SCHEMA = {
    "type": "object",
    "properties": {
        "diagnosis_hypothesis": {
            "type": "string",
            "description": "Evidence-grounded hypothesis explaining root cause. Explicitly framed as a hypothesis, not confirmed fact.",
        },
        "confidence": {
            "type": "number",
            "description": "Confidence score between 0.0 and 1.0 reflecting correlation with historical memories and symptoms.",
        },
        "recommended_diagnostic_steps": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Sequential non-destructive diagnostic steps for the field technician to confirm the root cause.",
        },
        "relevant_historical_incidents": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Machine IDs or Incident references directly matched from retrieved historical memory.",
        },
        "supporting_evidence": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Specific facts from retrieved memory supporting this hypothesis.",
        },
        "unsuccessful_previous_repairs": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Previous repair actions that were attempted on similar symptoms but were verified UNSUCCESSFUL.",
        },
        "safety_warnings": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Critical industrial safety precautions (LOTO, thermal PPE, chemical/electrical hazard) required before inspection.",
        },
    },
    "required": [
        "diagnosis_hypothesis",
        "confidence",
        "recommended_diagnostic_steps",
        "relevant_historical_incidents",
        "supporting_evidence",
        "unsuccessful_previous_repairs",
        "safety_warnings",
    ],
    "additionalProperties": False,
}


class GroqService:
    def __init__(self):
        self._client: Optional[Groq] = None
        self._http_client: Optional[httpx.Client] = None
        self._rate_limited_cooldowns: dict[str, float] = {}

    def get_client(self) -> Groq:
        if self._client is None:
            if not settings.GROQ_API_KEY:
                raise ValueError("GROQ_API_KEY is not set in environment.")
            self._http_client = httpx.Client(verify=get_ssl_context(), timeout=8.0)
            self._client = Groq(api_key=settings.GROQ_API_KEY, http_client=self._http_client, max_retries=1, timeout=8.0)
        return self._client

    def get_model_candidate_list(self) -> list[str]:
        now = time.time()
        self._rate_limited_cooldowns = {m: exp for m, exp in self._rate_limited_cooldowns.items() if exp > now}

        candidates = [settings.GROQ_MODEL, "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
        seen = set()
        active = []
        cooldown = []
        for c in candidates:
            if c and c not in seen:
                seen.add(c)
                if c in self._rate_limited_cooldowns:
                    cooldown.append(c)
                else:
                    active.append(c)
        return active + cooldown

    def create_chat_completion(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        response_format: Optional[dict[str, Any]] = None,
    ) -> tuple[str, str]:
        """
        Execute chat completion with automatic model failover across accessible Groq models.
        Returns (content, model_used).
        """
        client = self.get_client()
        models = self.get_model_candidate_list()
        last_exception = None

        for model_name in models:
            try:
                kwargs: dict[str, Any] = {
                    "model": model_name,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                if response_format:
                    kwargs["response_format"] = response_format

                completion = client.chat.completions.create(**kwargs)
                content = completion.choices[0].message.content or ""
                if content.strip():
                    return content, model_name
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "rate_limit" in err_str.lower():
                    self._rate_limited_cooldowns[model_name] = time.time() + 180.0
                logger.warning("Groq model '%s' failed (%s). Attempting failover...", model_name, err_str)
                last_exception = e
                continue

        if last_exception:
            raise last_exception
        raise RuntimeError("All Groq candidate models failed to return content.")

    def investigate_incident(
        self,
        incident: dict[str, Any],
        historical_memories: list[dict[str, Any]],
        reflect_summary: Optional[str] = None,
    ) -> dict[str, Any]:
        """Perform reasoning over the incident and historical memories using Groq with strict JSON output."""
        client = self.get_client()

        memories_formatted = ""
        if historical_memories:
            for idx, mem in enumerate(historical_memories, 1):
                memories_formatted += f"[{idx}] {mem.get('text', '')}\n"
        else:
            memories_formatted = "No prior historical incidents found in memory bank for these symptoms.\n"

        system_prompt = (
            "You are RecallOps — an advanced, safety-first AI Industrial Maintenance Reasoning Engine.\n"
            "Your objective is to help plant technicians diagnose equipment anomalies by cross-referencing "
            "reported observations against verified historical memory from the plant.\n\n"
            "STRICT GROUNDING RULES:\n"
            "1. Ground all historical claims ONLY in the provided RETRIEVED HISTORICAL MEMORIES. Do not invent incidents or outcomes.\n"
            "2. Note which repairs SUCCEEDED and which were UNSUCCESSFUL in previous incidents with similar symptoms.\n"
            "3. Clearly distinguish operator observations from confirmed diagnoses (frame initial assessments as hypotheses).\n"
            "4. NEVER declare a repair successful autonomously; only field technician inspections can verify outcomes.\n"
            "5. Always prescribe vital safety warnings (Lockout/Tagout, thermal/pressure relief, PPE) before physical access."
        )

        user_prompt = (
            f"--- CURRENT INCIDENT ---\n"
            f"Incident ID: {incident['id']}\n"
            f"Machine ID: {incident['machine_id']}\n"
            f"Equipment Type: {incident['equipment_type']}\n"
            f"Severity: {incident['severity']}\n"
            f"Symptoms Reported: {incident['symptoms']}\n"
            f"Reported Observations: {incident['reported_observations']}\n\n"
            f"--- RETRIEVED HISTORICAL MEMORIES FROM HINDSIGHT ---\n"
            f"{memories_formatted}\n"
        )

        if reflect_summary:
            user_prompt += f"--- HINDSIGHT REFLECTION SYNTHESIS ---\n{reflect_summary}\n\n"

        user_prompt += "Analyze this incident and output your diagnostic investigation strictly according to schema."

        models = self.get_model_candidate_list()
        for model_name in models:
            try:
                logger.info("Sending investigation request to Groq (%s)...", model_name)
                completion = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_format={
                        "type": "json_schema",
                        "json_schema": {
                            "name": "incident_investigation",
                            "strict": True,
                            "schema": INVESTIGATION_SCHEMA,
                        },
                    },
                    temperature=0.1,
                    max_tokens=3000,
                )

                raw_content = completion.choices[0].message.content
                parsed = json.loads(raw_content)
                return parsed
            except Exception as e:
                logger.warning("Groq investigation model '%s' failed: %s. Trying candidate fallback...", model_name, str(e))
                continue

        logger.error("All Groq investigation models failed. Using resilient category-calibrated schema fallback.")
        eq_type = incident.get("equipment_type", "Equipment")
        eq_lower = eq_type.lower()
        rel_incidents = [m.get("document_id", "DOC-REF") for m in historical_memories[:3]] if historical_memories else []

        is_electronic = any(w in eq_lower for w in ["phone", "laptop", "pc", "speaker", "headphone", "audio", "camera", "tablet", "electronic", "drone"])
        is_household = any(w in eq_lower for w in ["microwave", "stove", "oven", "fridge", "refrigerator", "kettle", "toaster", "blender", "iron", "heater", "dishwasher"])

        if is_electronic:
            return {
                "diagnosis_hypothesis": f"Preliminary hypothesis for {eq_type}: Reported symptoms indicate power delivery failure, audio/signal interface misconfiguration, or firmware lockup.",
                "confidence": 0.70,
                "recommended_diagnostic_steps": [
                    "Disconnect charging power and inspect cable connections for physical integrity.",
                    "Verify audio level, mute status, and device pairing on connected source.",
                    "Perform power-cycle reboot to clear temporary firmware state.",
                ],
                "relevant_historical_incidents": rel_incidents,
                "supporting_evidence": [
                    f"Reported symptoms correlate with standard electronic interface and power delivery failure modes for {eq_type}."
                ],
                "unsuccessful_previous_repairs": [],
                "safety_warnings": [
                    "Disconnect charging adapter from electrical source before inspecting ports or cables.",
                    "Do not puncture lithium battery or expose electronic components to liquid.",
                ],
            }
        elif is_household:
            return {
                "diagnosis_hypothesis": f"Preliminary hypothesis for {eq_type}: Operational symptoms suggest supply interruption, thermal cutoff trip, or control relay failure.",
                "confidence": 0.70,
                "recommended_diagnostic_steps": [
                    "Unplug appliance from wall outlet or close fuel supply shut-off valve.",
                    "Inspect power plug, supply line, and thermal safety cutoff sensors.",
                    "Verify control settings and power source continuity.",
                ],
                "relevant_historical_incidents": rel_incidents,
                "supporting_evidence": [
                    f"Reported symptoms align with common appliance supply and thermal regulation issues for {eq_type}."
                ],
                "unsuccessful_previous_repairs": [],
                "safety_warnings": [
                    "Always unplug electrical appliance from the wall before removing access panels.",
                    "Allow all heated elements and surfaces to cool completely before inspection.",
                ],
            }
        else:
            return {
                "diagnosis_hypothesis": f"Preliminary hypothesis for {eq_type}: Operating symptoms suggest bearing wear, mechanical misalignment, or thermal ventilation restriction.",
                "confidence": 0.70,
                "recommended_diagnostic_steps": [
                    "Verify zero-energy Lockout/Tagout (LOTO) isolation protocol.",
                    "Check bearing radial runout and mechanical shaft alignment.",
                    "Inspect cooling fins, heat dissipation passages, and ventilation shrouds.",
                ],
                "relevant_historical_incidents": rel_incidents,
                "supporting_evidence": [
                    f"Reported symptoms correlate with standard operational mechanical failure modes for {eq_type}."
                ],
                "unsuccessful_previous_repairs": [],
                "safety_warnings": [
                    "De-energize main electrical breaker and tag out according to OSHA 1910.147 standard.",
                    "Allow thermal surfaces to cool below 45°C before opening protective shrouds.",
                ],
            }

    def close(self):
        if self._http_client:
            try:
                self._http_client.close()
            except Exception:
                pass
            self._http_client = None
        self._client = None


groq_service = GroqService()

