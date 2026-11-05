import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Any
from backend.database import get_db
from backend.models.incident import (
    IncidentCreate,
    IncidentResponse,
    InvestigationResponse,
    RepairCreate,
    RepairResponse,
    VerifyOutcomeCreate,
    VerifyOutcomeResponse,
    IncidentDetailResponse,
)
from backend.services.hindsight_service import hindsight_service
from backend.services.groq_service import groq_service

logger = logging.getLogger(__name__)


class OutcomeConflictError(ValueError):
    """Raised when an attempt is made to alter an already verified outcome status."""
    pass


def generate_incident_id() -> str:
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    short_uuid = uuid.uuid4().hex[:6].upper()
    return f"INC-{now_str}-{short_uuid}"


def generate_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


class InvestigationService:
    def create_incident(self, data: IncidentCreate) -> IncidentResponse:
        """Register a new maintenance incident in SQLite."""
        incident_id = generate_incident_id()
        now_iso = datetime.now(timezone.utc).isoformat()
        incident_time = data.timestamp or now_iso

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO incidents (
                    id, machine_id, equipment_type, symptoms, timestamp,
                    severity, reported_observations, status, is_demo,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    incident_id,
                    data.machine_id,
                    data.equipment_type,
                    data.symptoms,
                    incident_time,
                    data.severity,
                    data.reported_observations,
                    "REPORTED",
                    1 if data.is_demo else 0,
                    now_iso,
                    now_iso,
                ),
            )

        return self.get_incident_by_id(incident_id)

    def list_incidents(
        self,
        machine_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[IncidentResponse]:
        """List all maintenance incidents with optional filters."""
        query = "SELECT * FROM incidents WHERE 1=1"
        params = []
        if machine_id:
            query += " AND machine_id = ?"
            params.append(machine_id)
        if status:
            query += " AND status = ?"
            params.append(status)
        query += " ORDER BY created_at DESC"

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [
                IncidentResponse(
                    id=row["id"],
                    machine_id=row["machine_id"],
                    equipment_type=row["equipment_type"],
                    symptoms=row["symptoms"],
                    timestamp=row["timestamp"],
                    severity=row["severity"],
                    reported_observations=row["reported_observations"],
                    status=row["status"],
                    is_demo=bool(row["is_demo"]),
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                )
                for row in rows
            ]

    def get_incident_by_id(self, incident_id: str) -> IncidentResponse:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Incident with ID '{incident_id}' not found.")
            return IncidentResponse(
                id=row["id"],
                machine_id=row["machine_id"],
                equipment_type=row["equipment_type"],
                symptoms=row["symptoms"],
                timestamp=row["timestamp"],
                severity=row["severity"],
                reported_observations=row["reported_observations"],
                status=row["status"],
                is_demo=bool(row["is_demo"]),
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )

    def get_incident_details(self, incident_id: str) -> IncidentDetailResponse:
        incident = self.get_incident_by_id(incident_id)
        with get_db() as conn:
            cursor = conn.cursor()

            # Investigations
            cursor.execute("SELECT * FROM investigations WHERE incident_id = ? ORDER BY created_at DESC", (incident_id,))
            inv_rows = cursor.fetchall()
            investigations = [
                InvestigationResponse(
                    id=r["id"],
                    incident_id=r["incident_id"],
                    diagnosis_hypothesis=r["diagnosis_hypothesis"],
                    confidence=r["confidence"],
                    recommended_diagnostic_steps=json.loads(r["recommended_diagnostic_steps"]),
                    relevant_historical_incidents=json.loads(r["relevant_historical_incidents"]),
                    supporting_evidence=json.loads(r["supporting_evidence"]),
                    unsuccessful_previous_repairs=json.loads(r["unsuccessful_previous_repairs"]),
                    safety_warnings=json.loads(r["safety_warnings"]),
                    created_at=r["created_at"],
                )
                for r in inv_rows
            ]

            # Repairs
            cursor.execute("SELECT * FROM repairs WHERE incident_id = ? ORDER BY performed_at DESC", (incident_id,))
            rep_rows = cursor.fetchall()
            repairs = [
                RepairResponse(
                    id=r["id"],
                    incident_id=r["incident_id"],
                    technician_id=r["technician_id"],
                    action_taken=r["action_taken"],
                    parts_replaced=r["parts_replaced"],
                    notes=r["notes"],
                    performed_at=r["performed_at"],
                )
                for r in rep_rows
            ]

            # Verifications
            cursor.execute("SELECT * FROM outcome_verifications WHERE incident_id = ? ORDER BY verified_at DESC", (incident_id,))
            ver_rows = cursor.fetchall()
            verifications = [
                VerifyOutcomeResponse(
                    id=r["id"],
                    incident_id=r["incident_id"],
                    verified_by=r["verified_by"],
                    outcome_status=r["outcome_status"],
                    inspection_notes=r["inspection_notes"],
                    follow_up_metrics=json.loads(r["follow_up_metrics"]) if r["follow_up_metrics"] else None,
                    hindsight_retained=bool(r["hindsight_retained"]),
                    hindsight_document_id=r["hindsight_document_id"],
                    verified_at=r["verified_at"],
                )
                for r in ver_rows
            ]

        return IncidentDetailResponse(
            incident=incident,
            investigations=investigations,
            repairs=repairs,
            verifications=verifications,
        )

    def run_investigation(self, incident_id: str) -> InvestigationResponse:
        """Perform cross-machine historical recall and AI reasoning for the incident."""
        incident = self.get_incident_by_id(incident_id)

        # 1. Cross-machine historical search in Hindsight
        recall_query = f"{incident.equipment_type} {incident.symptoms}"
        historical_memories = hindsight_service.recall_memories(query=recall_query, budget="low")

        # 2. Reflect on incident history
        reflect_query = (
            f"What previous repairs and root causes were verified for {incident.equipment_type} "
            f"with symptoms '{incident.symptoms}'? Which repairs succeeded and which failed?"
        )
        reflect_summary = hindsight_service.reflect_on_incident(query=reflect_query, budget="low")

        # 3. Groq strict structured reasoning
        incident_dict = incident.model_dump()
        investigation_result = groq_service.investigate_incident(
            incident=incident_dict,
            historical_memories=historical_memories,
            reflect_summary=reflect_summary,
        )

        # 4. Memory provenance audit: ensure no hallucinations of non-existent history
        if not historical_memories:
            investigation_result["relevant_historical_incidents"] = []
            investigation_result["unsuccessful_previous_repairs"] = []
            if not investigation_result.get("supporting_evidence"):
                investigation_result["supporting_evidence"] = ["No prior historical incident records exist in memory bank for these symptoms."]
        else:
            # Verify that cited incidents/machines actually appear in retrieved memories text
            all_mem_text = " ".join(m.get("text", "") for m in historical_memories).upper()
            verified_citations = []
            for citation in investigation_result.get("relevant_historical_incidents", []):
                # Clean citation
                words = [w for w in citation.upper().replace("-", " ").replace(":", " ").split() if len(w) >= 3]
                if any(w in all_mem_text for w in words):
                    verified_citations.append(citation)
            investigation_result["relevant_historical_incidents"] = verified_citations

        # 5. Store investigation in SQLite
        inv_id = generate_id("INV")
        now_iso = datetime.now(timezone.utc).isoformat()

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO investigations (
                    id, incident_id, diagnosis_hypothesis, confidence,
                    recommended_diagnostic_steps, relevant_historical_incidents,
                    supporting_evidence, unsuccessful_previous_repairs, safety_warnings,
                    raw_model_output, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    inv_id,
                    incident_id,
                    investigation_result["diagnosis_hypothesis"],
                    float(investigation_result["confidence"]),
                    json.dumps(investigation_result["recommended_diagnostic_steps"]),
                    json.dumps(investigation_result["relevant_historical_incidents"]),
                    json.dumps(investigation_result["supporting_evidence"]),
                    json.dumps(investigation_result["unsuccessful_previous_repairs"]),
                    json.dumps(investigation_result["safety_warnings"]),
                    json.dumps(investigation_result),
                    now_iso,
                ),
            )
            # Update incident status
            cursor.execute(
                "UPDATE incidents SET status = 'INVESTIGATED', updated_at = ? WHERE id = ?",
                (now_iso, incident_id),
            )

        return InvestigationResponse(
            id=inv_id,
            incident_id=incident_id,
            diagnosis_hypothesis=investigation_result["diagnosis_hypothesis"],
            confidence=float(investigation_result["confidence"]),
            recommended_diagnostic_steps=investigation_result["recommended_diagnostic_steps"],
            relevant_historical_incidents=investigation_result["relevant_historical_incidents"],
            supporting_evidence=investigation_result["supporting_evidence"],
            unsuccessful_previous_repairs=investigation_result["unsuccessful_previous_repairs"],
            safety_warnings=investigation_result["safety_warnings"],
            created_at=now_iso,
        )

    def record_repair(self, incident_id: str, data: RepairCreate) -> RepairResponse:
        """Record an executed technician repair action in SQLite."""
        self.get_incident_by_id(incident_id)  # Validate existence
        repair_id = generate_id("REP")
        now_iso = datetime.now(timezone.utc).isoformat()

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO repairs (
                    id, incident_id, technician_id, action_taken, parts_replaced, notes, performed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    repair_id,
                    incident_id,
                    data.technician_id,
                    data.action_taken,
                    data.parts_replaced,
                    data.notes,
                    now_iso,
                ),
            )
            cursor.execute(
                "UPDATE incidents SET status = 'REPAIRED', updated_at = ? WHERE id = ?",
                (now_iso, incident_id),
            )

        return RepairResponse(
            id=repair_id,
            incident_id=incident_id,
            technician_id=data.technician_id,
            action_taken=data.action_taken,
            parts_replaced=data.parts_replaced,
            notes=data.notes,
            performed_at=now_iso,
        )

    def verify_outcome(self, incident_id: str, data: VerifyOutcomeCreate) -> VerifyOutcomeResponse:
        """Verify the repair outcome and retain the completed experience into Hindsight Cloud."""
        incident = self.get_incident_by_id(incident_id)

        # 1. Require that a technician repair action was logged before outcome verification
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM repairs WHERE incident_id = ? ORDER BY performed_at DESC LIMIT 1",
                (incident_id,),
            )
            repair_row = cursor.fetchone()

            # 2. Check if this incident has already been verified
            cursor.execute(
                "SELECT * FROM outcome_verifications WHERE incident_id = ? ORDER BY verified_at DESC LIMIT 1",
                (incident_id,),
            )
            existing_verification = cursor.fetchone()

        if not repair_row:
            raise ValueError(
                f"Cannot verify outcome for incident '{incident_id}': No technician repair action has been recorded. "
                "A repair action must be logged before verifying its outcome."
            )

        if existing_verification:
            existing_status = existing_verification["outcome_status"]
            # Prevent silent tampering between SUCCESSFUL and UNSUCCESSFUL
            if existing_status != data.outcome_status:
                raise OutcomeConflictError(
                    f"Incident '{incident_id}' has already been verified as {existing_status}. "
                    f"Cannot alter verified outcome status to {data.outcome_status}."
                )
            # Idempotent response: return existing record without duplicate retention
            logger.info("Incident %s is already verified with status %s. Returning existing verification.", incident_id, existing_status)
            return VerifyOutcomeResponse(
                id=existing_verification["id"],
                incident_id=incident_id,
                verified_by=existing_verification["verified_by"],
                outcome_status=existing_verification["outcome_status"],
                inspection_notes=existing_verification["inspection_notes"],
                follow_up_metrics=json.loads(existing_verification["follow_up_metrics"]) if existing_verification["follow_up_metrics"] else None,
                hindsight_retained=bool(existing_verification["hindsight_retained"]),
                hindsight_document_id=existing_verification["hindsight_document_id"],
                verified_at=existing_verification["verified_at"],
            )

        repair_dict = dict(repair_row)
        verification_id = generate_id("VER")
        now_iso = datetime.now(timezone.utc).isoformat()
        document_id = f"OUTCOME-{incident_id}"

        # Retain to Hindsight Cloud
        verification_dict = {
            "outcome_status": data.outcome_status,
            "inspection_notes": data.inspection_notes,
            "follow_up_metrics": data.follow_up_metrics,
            "verified_at": now_iso,
        }
        try:
            hindsight_service.retain_incident_outcome(
                incident=incident.model_dump(),
                repair=repair_dict,
                verification=verification_dict,
            )
            retained_flag = True
        except Exception as e:
            logger.error("Failed to retain outcome into Hindsight: %s", str(e), exc_info=True)
            retained_flag = False

        new_status = "VERIFIED_SUCCESSFUL" if data.outcome_status == "SUCCESSFUL" else "VERIFIED_UNSUCCESSFUL"

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO outcome_verifications (
                    id, incident_id, verified_by, outcome_status,
                    inspection_notes, follow_up_metrics, hindsight_retained,
                    hindsight_document_id, verified_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    verification_id,
                    incident_id,
                    data.verified_by,
                    data.outcome_status,
                    data.inspection_notes,
                    json.dumps(data.follow_up_metrics) if data.follow_up_metrics else None,
                    1 if retained_flag else 0,
                    document_id,
                    now_iso,
                ),
            )
            cursor.execute(
                "UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?",
                (new_status, now_iso, incident_id),
            )

        return VerifyOutcomeResponse(
            id=verification_id,
            incident_id=incident_id,
            verified_by=data.verified_by,
            outcome_status=data.outcome_status,
            inspection_notes=data.inspection_notes,
            follow_up_metrics=data.follow_up_metrics,
            hindsight_retained=retained_flag,
            hindsight_document_id=document_id,
            verified_at=now_iso,
        )


investigation_service = InvestigationService()
