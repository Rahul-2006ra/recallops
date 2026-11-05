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

    def get_client(self) -> Groq:
        if self._client is None:
            if not settings.GROQ_API_KEY:
                raise ValueError("GROQ_API_KEY is not set in environment.")
            self._http_client = httpx.Client(verify=get_ssl_context())
            self._client = Groq(api_key=settings.GROQ_API_KEY, http_client=self._http_client)
        return self._client

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

        logger.info("Sending investigation request to Groq (%s)...", settings.GROQ_MODEL)
        try:
            completion = client.chat.completions.create(
                model=settings.GROQ_MODEL,
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
            logger.error("Groq investigation failed: %s", str(e), exc_info=True)
            raise

    def close(self):
        if self._http_client:
            try:
                self._http_client.close()
            except Exception:
                pass
            self._http_client = None
        self._client = None


groq_service = GroqService()
