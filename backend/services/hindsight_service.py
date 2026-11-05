import logging
import json
import threading
from typing import Optional, Any
from hindsight_client import Hindsight
from backend.config import settings

logger = logging.getLogger(__name__)


class HindsightService:
    def __init__(self):
        self._local = threading.local()

    def get_client(self) -> Hindsight:
        """Get or create a thread-local Hindsight client to avoid cross-thread aiohttp session conflicts."""
        client = getattr(self._local, "client", None)
        if client is None:
            if not settings.HINDSIGHT_API_KEY:
                raise ValueError("HINDSIGHT_API_KEY is not set in environment.")
            client = Hindsight(
                base_url=settings.HINDSIGHT_BASE_URL,
                api_key=settings.HINDSIGHT_API_KEY,
                timeout=60.0,
            )
            self._local.client = client
        return client

    def recall_memories(self, query: str, budget: str = "low", max_tokens: int = 4096) -> list[dict[str, Any]]:
        """Retrieve relevant past incidents and maintenance history from Hindsight across machines."""
        client = self.get_client()
        try:
            logger.info("Executing Hindsight recall for query: '%s' (budget=%s)", query, budget)
            response = client.recall(
                bank_id=settings.HINDSIGHT_BANK_ID,
                query=query,
                budget=budget,
                max_tokens=max_tokens,
            )
            results = []
            if hasattr(response, "results") and response.results:
                for item in response.results:
                    results.append({
                        "text": getattr(item, "text", str(item)),
                        "score": getattr(item, "score", None),
                        "timestamp": str(getattr(item, "timestamp", "")),
                        "document_id": getattr(item, "document_id", None),
                    })
            logger.info("Hindsight recall returned %d memory items.", len(results))
            return results
        except Exception as e:
            logger.error("Hindsight recall error: %s", str(e), exc_info=True)
            raise

    def reflect_on_incident(self, query: str, budget: str = "low") -> Optional[str]:
        """Perform synthesis and diagnostic reflection over historical memory."""
        client = self.get_client()
        try:
            logger.info("Executing Hindsight reflect for query: '%s'", query)
            response = client.reflect(
                bank_id=settings.HINDSIGHT_BANK_ID,
                query=query,
                budget=budget,
            )
            text = getattr(response, "text", "")
            return text if text else None
        except Exception as e:
            logger.warning("Hindsight reflect returned warning/error: %s", str(e))
            return None

    def retain_incident_outcome(
        self,
        incident: dict[str, Any],
        repair: dict[str, Any],
        verification: dict[str, Any],
    ) -> Any:
        """Store the completed incident, repair, and verified outcome in Hindsight Cloud."""
        client = self.get_client()
        
        # Incident-based document ID: ensures different incidents on the same machine retain independently,
        # while retrying retention for the same incident upserts into the exact same document ID.
        document_id = f"OUTCOME-{incident['id']}"

        tag_prefix = "demo" if incident.get("is_demo") else "prod"
        label = "SYNTHETIC DEMONSTRATION DATA" if incident.get("is_demo") else "VERIFIED INDUSTRIAL MAINTENANCE RECORD"

        content = (
            f"[{label}]\n"
            f"Incident ID: {incident['id']}\n"
            f"Machine ID: {incident['machine_id']}\n"
            f"Equipment Type: {incident['equipment_type']}\n"
            f"Reported Symptoms: {incident['symptoms']}\n"
            f"Severity: {incident['severity']}\n"
            f"Operator Observations: {incident['reported_observations']}\n"
            f"Technician ID: {repair.get('technician_id', 'Unknown')}\n"
            f"Repair Action: {repair.get('action_taken', 'N/A')}\n"
            f"Parts Replaced: {repair.get('parts_replaced') or 'None'}\n"
            f"Verified Outcome: {verification.get('outcome_status')}\n"
            f"Inspection Notes: {verification.get('inspection_notes')}\n"
            f"Follow-up Metrics: {json.dumps(verification.get('follow_up_metrics')) if verification.get('follow_up_metrics') else 'None'}\n"
            f"Verification Date: {verification.get('verified_at')}"
        )

        tags = [
            f"{tag_prefix}-record",
            f"machine-{incident['machine_id'].lower()}",
            f"outcome-{verification.get('outcome_status', '').lower()}",
            "maintenance-history",
        ]

        logger.info("Retaining verified outcome into Hindsight bank '%s' with doc_id '%s'", settings.HINDSIGHT_BANK_ID, document_id)
        response = client.retain(
            bank_id=settings.HINDSIGHT_BANK_ID,
            content=content,
            document_id=document_id,
            context="RecallOps industrial incident outcome verification record",
            tags=tags,
        )
        return response

    def close(self):
        client = getattr(self._local, "client", None)
        if client:
            try:
                client.close()
            except Exception:
                pass
            self._local.client = None


hindsight_service = HindsightService()
