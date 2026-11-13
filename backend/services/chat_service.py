import os
import re
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from backend.config import settings
from backend.database import get_db
from backend.models.chat import (
    ChatRequest,
    ChatResponse,
    PrecedentRecord,
    RecordOutcomeRequest,
    RecordOutcomeResponse,
    MemoryItemResponse,
    ConversationResponse,
    ConversationDetailResponse,
    MessageResponse,
)
from backend.services.groq_service import groq_service
from backend.services.hindsight_service import hindsight_service

logger = logging.getLogger(__name__)


def generate_id(prefix: str) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    unique = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{timestamp}-{unique}"


# Quick keyword matcher for industrial & domestic equipment
EQUIPMENT_KEYWORDS: dict[str, tuple[str, str]] = {
    "centrifugal slurry pump": ("Centrifugal Slurry Pump", "industrial"),
    "reciprocating air compressor": ("Reciprocating Air Compressor", "industrial"),
    "commercial convection oven": ("Commercial Convection Oven", "household"),
    "commercial mixer grinder": ("Commercial Mixer Grinder", "household"),
    "electric induction motor": ("Electric Induction Motor", "industrial"),
    "backup diesel generator": ("Backup Diesel Generator", "industrial"),
    "workstation laptop": ("Workstation Laptop", "electronic"),
    "centrifugal pump": ("Centrifugal Pump", "industrial"),
    "hydraulic pump": ("Hydraulic Pump", "industrial"),
    "slurry pump": ("Centrifugal Slurry Pump", "industrial"),
    "air compressor": ("Reciprocating Air Compressor", "industrial"),
    "induction motor": ("Electric Induction Motor", "industrial"),
    "diesel generator": ("Backup Diesel Generator", "industrial"),
    "mixer grinder": ("Commercial Mixer Grinder", "household"),
    "cooling tower": ("Evaporative Cooling Tower", "industrial"),
    "washing machine": ("Industrial Washing Machine", "household"),
    "panel pc": ("Industrial Panel PC", "electronic"),
    "cnc milling": ("CNC Milling Center", "industrial"),
    "cnc machine": ("CNC Milling Center", "industrial"),
    "cnc": ("CNC Milling Center", "industrial"),
    "pump": ("Centrifugal Pump", "industrial"),
    "motor": ("Electric Induction Motor", "industrial"),
    "compressor": ("Reciprocating Air Compressor", "industrial"),
    "generator": ("Backup Diesel Generator", "industrial"),
    "oven": ("Commercial Convection Oven", "household"),
    "mixer": ("Commercial Mixer Grinder", "household"),
    "grinder": ("Commercial Mixer Grinder", "household"),
    "laptop": ("Workstation Laptop", "electronic"),
    "computer": ("Industrial Panel PC", "electronic"),
    "refrigerator": ("Commercial Refrigerator", "household"),
    "fridge": ("Commercial Refrigerator", "household"),
    "press": ("Hydraulic Stamping Press", "industrial"),
}

# Known hazard keywords
HAZARD_TRIGGERS = [
    ("electrical", "HIGH ELECTRICAL HAZARD: Ensure all main circuit breakers are locked out and tagged out (LOTO). Do not touch exposed conductors."),
    ("4160v", "EXTREME VOLTAGE HAZARD: High voltage (4160V) requires qualified electrical technician and arc-flash PPE."),
    ("shock", "SHOCK HAZARD: Disconnect power immediately. Do not touch wet or exposed electrical components."),
    ("gas", "GAS/EXPLOSION HAZARD: Evacuate area if gas smell detected; isolate supply valve and contact certified technician."),
    ("pressure", "HIGH PRESSURE HAZARD: Depressurize and bleed all fluid/pneumatic lines before opening valves or flanges."),
    ("steam", "THERMAL / STEAM HAZARD: Allow lines to cool and verify zero pressure before inspection."),
    ("smoke", "FIRE / THERMAL HAZARD: Turn off equipment power immediately. Have appropriate fire extinguisher on standby."),
    ("spark", "ELECTRICAL ARC / FIRE HAZARD: Isolate power supply immediately to prevent insulation fire."),
]


class ChatService:
    def _get_device_appropriate_hazard(self, category: str, message: str) -> Optional[str]:
        lower = message.lower()
        is_household = category in ("household", "electronic")

        if any(k in lower for k in ["4160", "4160v", "arc-flash", "medium voltage"]):
            return "EXTREME VOLTAGE HAZARD: High voltage (4160V) switchgear requires qualified industrial electrician and arc-flash PPE. Do not approach unshielded equipment."
        elif any(k in lower for k in ["shock", "spark", "electrical"]):
            if is_household:
                return "ELECTRICAL SAFETY: Unplug the appliance immediately from the electrical wall outlet. Do not open energized housings; internal servicing should be handled by an authorized technician."
            else:
                return "HIGH ELECTRICAL HAZARD: Ensure all main circuit breakers are locked out and tagged out (LOTO). Do not touch exposed conductors; verify zero voltage before inspection."
        elif any(k in lower for k in ["gas", "gas leak", "smell gas"]):
            return "GAS / EXPLOSION HAZARD: Evacuate the area immediately if gas smell is detected; isolate supply valve and contact certified emergency services."
        elif any(k in lower for k in ["pressure", "psi", "pneumatic"]):
            if is_household:
                return "PRESSURE SAFETY: Allow internal chamber to depressurize completely before opening; disconnect power."
            else:
                return "HIGH PRESSURE HAZARD: Depressurize and bleed all fluid/pneumatic lines before opening valves or flanges."
        elif any(k in lower for k in ["steam", "scald"]):
            return "THERMAL / STEAM HAZARD: Allow lines to cool and verify zero pressure before inspection."
        elif any(k in lower for k in ["smoke", "fire", "burning"]):
            if is_household:
                return "FIRE / SMOKE SAFETY: Unplug the appliance immediately from the electrical outlet. Discontinue use and have it inspected by a service professional."
            else:
                return "FIRE / THERMAL HAZARD: Turn off equipment power immediately. Have appropriate fire extinguisher on standby."
        return None

    def create_conversation(self, title: Optional[str] = None) -> dict[str, Any]:
        conv_id = generate_id("CONV")
        now_iso = datetime.now(timezone.utc).isoformat()
        final_title = title or "New Troubleshooting Session"
        with get_db() as conn:
            conn.execute(
                "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (conv_id, final_title, now_iso, now_iso),
            )
        return {"id": conv_id, "title": final_title, "created_at": now_iso, "updated_at": now_iso, "message_count": 0}

    def list_conversations(self) -> list[ConversationResponse]:
        with get_db() as conn:
            rows = conn.execute(
                """
                SELECT c.id, c.title, c.created_at, c.updated_at,
                       COUNT(m.id) as message_count,
                       (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_preview
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
                GROUP BY c.id
                ORDER BY c.updated_at DESC
                """
            ).fetchall()
            return [
                ConversationResponse(
                    id=row["id"],
                    title=row["title"],
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                    message_count=row["message_count"] or 0,
                    last_message_preview=row["last_preview"][:80] if row["last_preview"] else None,
                )
                for row in rows
            ]

    def get_conversation(self, conversation_id: str) -> Optional[ConversationDetailResponse]:
        with get_db() as conn:
            conv = conn.execute(
                "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?",
                (conversation_id,),
            ).fetchone()
            if not conv:
                return None
            msg_rows = conn.execute(
                "SELECT id, conversation_id, role, content, metadata, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
                (conversation_id,),
            ).fetchall()
            messages = []
            for r in msg_rows:
                meta = json.loads(r["metadata"]) if r["metadata"] else None
                messages.append(
                    MessageResponse(
                        id=r["id"],
                        conversation_id=r["conversation_id"],
                        role=r["role"],
                        content=r["content"],
                        metadata=meta,
                        created_at=r["created_at"],
                    )
                )
            return ConversationDetailResponse(
                id=conv["id"],
                title=conv["title"],
                created_at=conv["created_at"],
                updated_at=conv["updated_at"],
                messages=messages,
            )

    def delete_conversation(self, conversation_id: str) -> bool:
        with get_db() as conn:
            cursor = conn.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
            return cursor.rowcount > 0

    def search_local_memories(
        self,
        query: str,
        equipment_type: Optional[str] = None,
        outcome_status: Optional[str] = None,
        limit: int = 15,
    ) -> list[MemoryItemResponse]:
        """Search verified outcomes from SQLite database with multi-symptom pattern relevance and deduplication."""
        lower_query = query.lower()
        terms = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 2]

        # Detect active symptom dimensions in query
        symptom_patterns = {
            "vibration": ["vibrat", "resonance", "harmonic", "flutter", "oscillation", "shake"],
            "thermal": ["overheat", "temp", "thermal", "hot", "heat"],
            "acoustic": ["noise", "sound", "hum", "squeal", "grind", "knock", "rattle"],
            "pressure": ["pressure", "psi", "leak", "drip", "flow", "clog", "valve"],
            "electrical": ["spark", "smoke", "arc", "shock", "trip", "breaker", "fuse", "capacitor", "4160"],
            "mechanical": ["stall", "stopped", "won't start", "shut down", "halt", "seized", "bearing", "coupling"],
        }
        query_dims = {dim for dim, kws in symptom_patterns.items() if any(kw in lower_query for kw in kws)}

        with get_db() as conn:
            sql = """
                SELECT 
                    v.id, v.incident_id, i.machine_id, i.equipment_type,
                    i.symptoms, r.action_taken, r.parts_replaced,
                    v.outcome_status, v.inspection_notes, v.verified_by,
                    v.verified_at, v.hindsight_retained, v.hindsight_document_id
                FROM outcome_verifications v
                JOIN incidents i ON v.incident_id = i.id
                LEFT JOIN repairs r ON v.incident_id = r.incident_id
                WHERE 1=1
            """
            params: list[Any] = []
            if equipment_type:
                eq_lower = equipment_type.lower()
                core_kw = "pump" if "pump" in eq_lower else "mixer" if "mixer" in eq_lower else "oven" if "oven" in eq_lower else "motor" if "motor" in eq_lower else "compressor" if "compressor" in eq_lower else "laptop" if "laptop" in eq_lower else eq_lower
                sql += " AND (LOWER(i.equipment_type) LIKE ? OR LOWER(i.equipment_type) LIKE ?)"
                params.extend([f"%{eq_lower}%", f"%{core_kw}%"])
            if outcome_status:
                sql += " AND UPPER(v.outcome_status) = ?"
                params.append(outcome_status.upper())
            sql += " ORDER BY v.verified_at DESC"

            rows = conn.execute(sql, params).fetchall()

        # Deduplicate records by (machine_id, normalized action_taken)
        unique_records: dict[tuple[str, str], Any] = {}
        for r in rows:
            machine_key = r["machine_id"].strip().upper()
            action_key = (r["action_taken"] or "").strip().lower()[:40]
            dedup_key = (machine_key, action_key)
            if dedup_key not in unique_records:
                unique_records[dedup_key] = r

        scored_items = []
        for r in unique_records.values():
            symptom_text = r["symptoms"].lower()
            record_text = f"{r['machine_id']} {r['equipment_type']} {symptom_text} {r['action_taken']} {r['inspection_notes']}".lower()

            score = 0

            # 1. Equipment type match
            if equipment_type and equipment_type.lower() in r["equipment_type"].lower():
                score += 15
            elif any(eq_term in record_text for eq_term in ["pump", "motor", "compressor", "oven", "mixer"] if eq_term in lower_query):
                score += 8

            # 2. Multi-symptom pattern co-occurrence matching
            if query_dims:
                record_dims = {dim for dim, kws in symptom_patterns.items() if any(kw in symptom_text for kw in kws)}
                matched_dims = query_dims.intersection(record_dims)
                if len(query_dims) > 1 and matched_dims == query_dims:
                    # Full pattern synergy bonus (matches ALL query symptoms, e.g. BOTH vibration and thermal)
                    score += 35
                elif matched_dims:
                    # Partial symptom match
                    score += 10 * (len(matched_dims) / len(query_dims))

            # 3. Individual keyword overlap
            for term in terms:
                if term in record_text:
                    score += 2 if term in symptom_text else 1

            scored_items.append((score, r))

        scored_items.sort(key=lambda x: x[0], reverse=True)

        results = []
        for score, r in scored_items[:limit]:
            results.append(
                MemoryItemResponse(
                    id=r["id"],
                    incident_id=r["incident_id"],
                    machine_id=r["machine_id"],
                    equipment_type=r["equipment_type"],
                    symptoms=r["symptoms"],
                    action_taken=r["action_taken"] or "Inspection & diagnostics performed",
                    parts_replaced=r["parts_replaced"],
                    outcome_status=r["outcome_status"],
                    inspection_notes=r["inspection_notes"] or "",
                    verified_by=r["verified_by"],
                    verified_at=r["verified_at"],
                    hindsight_retained=bool(r["hindsight_retained"]),
                    hindsight_document_id=r["hindsight_document_id"],
                )
            )
        return results

    def get_memory_by_id(self, memory_id: str) -> Optional[MemoryItemResponse]:
        with get_db() as conn:
            r = conn.execute(
                """
                SELECT 
                    v.id, v.incident_id, i.machine_id, i.equipment_type,
                    i.symptoms, r.action_taken, r.parts_replaced,
                    v.outcome_status, v.inspection_notes, v.verified_by,
                    v.verified_at, v.hindsight_retained, v.hindsight_document_id
                FROM outcome_verifications v
                JOIN incidents i ON v.incident_id = i.id
                LEFT JOIN repairs r ON v.incident_id = r.incident_id
                WHERE v.id = ? OR v.incident_id = ?
                LIMIT 1
                """,
                (memory_id, memory_id),
            ).fetchone()
            if not r:
                return None
            return MemoryItemResponse(
                id=r["id"],
                incident_id=r["incident_id"],
                machine_id=r["machine_id"],
                equipment_type=r["equipment_type"],
                symptoms=r["symptoms"],
                action_taken=r["action_taken"] or "Inspection & diagnostics performed",
                parts_replaced=r["parts_replaced"],
                outcome_status=r["outcome_status"],
                inspection_notes=r["inspection_notes"] or "",
                verified_by=r["verified_by"],
                verified_at=r["verified_at"],
                hindsight_retained=bool(r["hindsight_retained"]),
                hindsight_document_id=r["hindsight_document_id"],
            )

    def retrieve_precedents(
        self,
        query: str,
        mock_mode: bool = True,
        equipment_type: Optional[str] = None,
    ) -> list[PrecedentRecord]:
        """Retrieve historical precedents with multi-symptom relevance ranking and outcome diversity."""
        precedents: list[PrecedentRecord] = []

        # LIVE HINDSIGHT RECALL: only if mock_mode is explicitly False AND config permits
        if not mock_mode and not settings.HINDSIGHT_MOCK_MODE:
            try:
                logger.info("Executing deliberate live Hindsight recall for: '%s'", query)
                recalled = hindsight_service.recall_memories(query=query, budget="low", max_tokens=1024)
                for item in recalled:
                    text = item.get("text", "")
                    doc_id = item.get("document_id") or "HINDSIGHT-DOC"
                    outcome_status = "SUCCESSFUL" if "SUCCESSFUL" in text.upper() and "UNSUCCESSFUL" not in text.upper() else "UNSUCCESSFUL" if "UNSUCCESSFUL" in text.upper() else "SUCCESSFUL"
                    precedents.append(
                        PrecedentRecord(
                            id=doc_id,
                            machine_id=doc_id.replace("OUTCOME-", "").replace("HACKATHON-VERIFIED-", ""),
                            equipment_type=equipment_type or "Industrial Equipment",
                            symptoms=query,
                            action_taken="Retrieved from live Hindsight Cloud episodic bank",
                            outcome_status=outcome_status,
                            inspection_notes=text[:250],
                            verified_at=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                            relevance_reason="Live semantic recall from Hindsight Cloud long-term memory bank.",
                            source="hindsight_cloud_live",
                            source_label="Hindsight Cloud (Live Verified)",
                        )
                    )
                if precedents:
                    return precedents[:2]
            except Exception as e:
                logger.warning("Live Hindsight recall skipped/failed (%s); falling back cleanly to local memory.", e)

        # LOCAL SAMPLE / DEMO MEMORY RECALL (0 billable credits consumed)
        local_results = self.search_local_memories(query=query, equipment_type=equipment_type, limit=8)

        # Group and diversify: Select top SUCCESSFUL match + top UNSUCCESSFUL match (if relevant)
        successful_matches = [r for r in local_results if r.outcome_status == "SUCCESSFUL"]
        unsuccessful_matches = [r for r in local_results if r.outcome_status == "UNSUCCESSFUL"]

        selected: list[MemoryItemResponse] = []
        if successful_matches:
            selected.append(successful_matches[0])
        if unsuccessful_matches and len(selected) < 2:
            # Add top unsuccessful attempt to warn field engineers against repeating failed actions
            selected.append(unsuccessful_matches[0])
        elif len(successful_matches) > 1 and len(selected) < 2:
            selected.append(successful_matches[1])

        lower_query = query.lower()
        has_vibe = any(w in lower_query for w in ["vibrat", "resonance", "harmonic"])
        has_temp = any(w in lower_query for w in ["temp", "overheat", "thermal", "heat"])

        for r in selected:
            is_dual_match = has_vibe and has_temp and any(w in r.symptoms.lower() for w in ["vibrat", "resonance"]) and any(w in r.symptoms.lower() for w in ["temp", "overheat", "spike"])
            relevance_desc = (
                f"Multi-symptom match: Both vibration and thermal anomalies observed on {r.machine_id}."
                if is_dual_match
                else f"Relevant equipment precedent for {r.equipment_type} ({r.machine_id})."
            )

            # Audit verification labels: independently verified must only appear when genuine independent verification evidence exists
            is_independently_verified = (
                not mock_mode
                and any(k in (r.verified_by or "").upper() for k in ["AUDIT", "CERT", "ISO", "INDEPENDENT"])
                and "independent" in (r.inspection_notes or "").lower()
            )
            if is_independently_verified:
                verification_status = "INDEPENDENTLY_VERIFIED"
            elif mock_mode:
                verification_status = "TECHNICIAN_CONFIRMED" if (r.verified_by or r.action_taken) else "SAMPLE_RECORD"
            else:
                verification_status = "TECHNICIAN_CONFIRMED" if r.verified_by else "USER_REPORTED"
            source_key = "sample_fixture" if mock_mode else "sqlite_local_db"
            source_tag = "Sample Memory (Demo Mode)" if mock_mode else "Local Plant Audit Log"

            precedents.append(
                PrecedentRecord(
                    id=r.id,
                    machine_id=r.machine_id,
                    equipment_type=r.equipment_type,
                    symptoms=r.symptoms,
                    action_taken=r.action_taken,
                    outcome_status=r.outcome_status,
                    verification_status=verification_status,
                    inspection_notes=r.inspection_notes,
                    verified_at=r.verified_at[:10] if r.verified_at else None,
                    relevance_reason=relevance_desc,
                    source=source_key,
                    source_label=source_tag,
                )
            )

        return precedents[:2]

    def process_chat(self, req: ChatRequest) -> ChatResponse:
        """Handle conversational troubleshooting with Groq reasoning and Hindsight memory integration."""
        raw_message = req.message.strip()
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Ensure conversation exists
        conv_id = req.conversation_id
        if not conv_id:
            # Auto-title based on first 30 chars of prompt
            clean_title = (raw_message[:35] + "...") if len(raw_message) > 35 else raw_message
            conv_data = self.create_conversation(title=clean_title)
            conv_id = conv_data["id"]
        else:
            with get_db() as conn:
                conv = conn.execute("SELECT id FROM conversations WHERE id = ?", (conv_id,)).fetchone()
                if not conv:
                    conv_data = self.create_conversation(title=raw_message[:35])
                    conv_id = conv_data["id"]

        # 2. Retrieve Conversation History for Multi-Turn Continuity
        conversation_history: list[dict[str, Any]] = []
        with get_db() as conn:
            msg_rows = conn.execute(
                """
                SELECT id, role, content, metadata, created_at 
                FROM messages 
                WHERE conversation_id = ? 
                ORDER BY created_at ASC
                """,
                (conv_id,),
            ).fetchall()
            for r in msg_rows:
                meta = json.loads(r["metadata"]) if r["metadata"] else {}
                conversation_history.append({
                    "id": r["id"],
                    "role": r["role"],
                    "content": r["content"],
                    "metadata": meta,
                    "created_at": r["created_at"],
                })

        # 3. Context Resolution: Detect Equipment & Equipment Switching
        lower_msg = raw_message.lower().strip()
        matched_equipment_current: Optional[dict[str, Any]] = None

        # Sorted by key length descending so specific terms match first
        sorted_keywords = sorted(EQUIPMENT_KEYWORDS.items(), key=lambda x: len(x[0]), reverse=True)
        for kw, (eq_name, category) in sorted_keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', lower_msg) or kw in lower_msg:
                matched_equipment_current = {
                    "equipment_type": eq_name,
                    "category": category,
                    "matched_keyword": kw,
                }
                break

        # Retrieve previous equipment & precedents from conversation history
        prev_equipment: Optional[dict[str, Any]] = None
        prev_precedents: list[PrecedentRecord] = []
        recent_equipments_discussed: list[str] = []

        for m in reversed(conversation_history):
            m_meta = m.get("metadata", {})
            eq = m_meta.get("equipment_detected")
            if eq and isinstance(eq, dict) and eq.get("equipment_type"):
                if not prev_equipment:
                    prev_equipment = eq
                    raw_precs = m_meta.get("retrieved_precedents", [])
                    prev_precedents = [PrecedentRecord(**p) if isinstance(p, dict) else p for p in raw_precs]
                if eq["equipment_type"] not in recent_equipments_discussed:
                    recent_equipments_discussed.append(eq["equipment_type"])

        # Determine active equipment & detect equipment switching or ambiguity
        equipment_switched = False
        is_followup = False
        ambiguity_detected = False

        if matched_equipment_current:
            if prev_equipment and prev_equipment["equipment_type"].lower() != matched_equipment_current["equipment_type"].lower():
                equipment_switched = True
                active_equipment = matched_equipment_current
            else:
                active_equipment = matched_equipment_current
        elif prev_equipment:
            has_ambiguity_cue = any(phrase in lower_msg for phrase in ["which one", "both of them", "which machine", "either of them"])
            if has_ambiguity_cue and len(recent_equipments_discussed) > 1:
                ambiguity_detected = True
                active_equipment = prev_equipment
            else:
                active_equipment = prev_equipment
                is_followup = True
        else:
            active_equipment = None

        detected_equipment = active_equipment

        # 4. Check hazard keywords with device-appropriate safety
        category = active_equipment.get("category", "industrial") if active_equipment else "industrial"
        detected_hazard = self._get_device_appropriate_hazard(category, raw_message)

        # 5. Detect Intent Adaptively
        # Greetings
        is_greeting = any(lower_msg == g or lower_msg.startswith(g + " ") or lower_msg.startswith(g + "!") or lower_msg.startswith(g + ",") for g in [
            "hello", "hi", "hey", "good morning", "good afternoon", "good evening", "howdy", "greetings"
        ])

        # Gratitude / Acknowledgment
        is_gratitude = any(lower_msg == g or lower_msg.startswith(g + " ") or lower_msg.startswith(g + "!") or lower_msg.startswith(g + ".") for g in [
            "thank you", "thanks", "thx", "thank u", "appreciate it", "great thanks", "ok thanks", "got it", "perfect", "awesome"
        ])

        # Outcome reporting
        is_outcome_report = any(phrase in lower_msg for phrase in [
            "replaced", "technician fixed", "technician replaced", "now working", "now it works",
            "did not work", "failed to fix", "fixed it", "repaired by", "outcome was",
            "problem resolved", "solved the issue", "didn't work", "still not working", "service technician",
            "we replaced", "we changed"
        ])

        # Dedicated HISTORICAL_MEMORY_QUERY recognition
        # Handles variations: "Has this happened before?", "Have we seen this issue previously?",
        # "What worked last time?", "Which repairs failed?", "Has a similar problem happened before?", etc.
        hist_phrases = [
            "happened before", "happened previously", "seen this before", "seen this issue previously",
            "seen this problem", "have we seen this", "has this happened", "have we encountered",
            "worked last time", "worked before", "worked previously", "repairs failed", "repair failed",
            "repairs succeeded", "repair succeeded", "repairs worked", "what worked", "which repairs",
            "what happened before", "previous incident", "prior incident", "past incident",
            "past repair", "prior repair", "previous repair", "repair record", "repair history",
            "history of this", "what was done before", "what was done last time", "did anyone fix this before",
            "how was this fixed before", "past experience", "historical record", "historical incident",
            "historical precedent", "historical memory", "in our history", "plant history", "past failure", "prior failure",
            "similar problem happened", "similar issue happened", "similar incident", "like this happened before",
            "like this occurred", "occurred before", "occurred previously", "seen before",
            "occurred in past", "occurred in previous", "happened on any other", "past repair records"
        ]
        is_historical_memory_query = (
            any(phrase in lower_msg for phrase in hist_phrases)
            or (
                any(w in lower_msg for w in ["happen", "occur", "seen", "worked", "failed", "fixed", "done", "record", "history", "precedent", "experience"])
                and any(w in lower_msg for w in ["before", "previously", "last time", "prior", "past", "earlier", "history"])
            )
        )
        is_explicit_memory_request = is_historical_memory_query

        # Simplify follow-up inquiry
        is_simplify = any(phrase in lower_msg for phrase in [
            "simpler words", "simpler terms", "explain that more simply", "explain more simply",
            "can you explain in simpler", "explain in simpler", "plain english", "too technical",
            "dumb it down", "make it simpler", "eli5", "in simpler words", "simpler"
        ]) and not is_historical_memory_query

        # Technician question inquiry
        is_technician_question = any(phrase in lower_msg for phrase in [
            "ask my technician", "ask the technician", "questions should i ask",
            "what should i ask my technician", "what specific questions", "what to ask the technician",
            "what should i tell the technician", "tell my technician", "questions for the technician"
        ]) and not is_historical_memory_query

        # Why or How causal inquiry
        is_why_or_how = any(phrase in lower_msg for phrase in [
            "why might that happen", "why does it", "why do they", "why would that happen",
            "how do you know", "why does that cause", "what causes that", "why is that",
            "can you elaborate", "could it be"
        ]) and not is_historical_memory_query

        # Educational / Conceptual inquiry
        is_concept_query = any(lower_msg.startswith(p) for p in [
            "what is a ", "what is an ", "what is ", "what are ",
            "how does a ", "how does an ", "how does ", "define "
        ]) and not is_outcome_report and not is_simplify and not is_technician_question and not is_followup and not is_historical_memory_query

        # Equipment Troubleshooting Query
        is_troubleshooting = (any(phrase in lower_msg for phrase in [
            "overheating", "overheat", "vibrating", "vibration", "noise", "loud", "smoke", "leaking", "leak",
            "shutting down", "switching off", "turns off", "shuts off", "tripping", "broken",
            "stopped", "stalled", "not starting", "error", "problem", "fault", "failure", "flutter",
            "won't turn on", "not turning on", "won't start"
        ]) or (matched_equipment_current is not None and not is_greeting and not is_concept_query and not is_outcome_report)) and not is_historical_memory_query

        if ambiguity_detected:
            intent = "CLARIFICATION_NEEDED"
        elif is_greeting:
            intent = "CASUAL_GREETING"
        elif is_gratitude:
            intent = "ACKNOWLEDGMENT"
        elif is_outcome_report:
            intent = "REPORT_OUTCOME"
        elif is_historical_memory_query:
            intent = "HISTORICAL_MEMORY_QUERY"
        elif is_simplify:
            intent = "FOLLOWUP_SIMPLIFY"
        elif is_technician_question:
            intent = "FOLLOWUP_TECHNICIAN_QUESTIONS"
        elif is_why_or_how:
            intent = "FOLLOWUP_WHY_OR_HOW"
        elif is_concept_query:
            intent = "CONCEPT_EXPLANATION"
        elif is_troubleshooting:
            intent = "TROUBLESHOOTING_QUERY"
        elif is_followup:
            intent = "FOLLOWUP_GENERAL"
        else:
            intent = "GENERAL_INQUIRY"

        # Suppress hazard warning on historical memory inquiries to prevent unsolicited Safety Alert banners
        if is_historical_memory_query:
            detected_hazard = None

        # 6. Retrieve Precedents & Determine Memory Card Visibility
        mock_mode = req.mock_memory if req.mock_memory is not None else settings.HINDSIGHT_MOCK_MODE

        active_precedents: list[PrecedentRecord] = []
        if (is_historical_memory_query or intent == "HISTORICAL_MEMORY_QUERY") and is_followup and prev_precedents:
            # In an active conversation, asking about history/records refers to the active incident's precedents
            active_precedents = prev_precedents
        elif is_historical_memory_query or intent in ("TROUBLESHOOTING_QUERY", "HISTORICAL_MEMORY_QUERY", "HISTORY_QUERY", "REPORT_OUTCOME"):
            eq_type = active_equipment["equipment_type"] if active_equipment else None
            query_for_retrieval = raw_message
            if is_followup and not any(w in raw_message.lower() for w in ["vibrat", "temp", "overheat", "noise", "leak"]):
                for m in conversation_history:
                    if m["role"] == "user" and any(w in m["content"].lower() for w in ["vibrat", "overheat", "noise", "stop", "shuts off"]):
                        query_for_retrieval = f"{m['content']} {raw_message}"
                        break
            active_precedents = self.retrieve_precedents(
                query=query_for_retrieval,
                mock_mode=mock_mode,
                equipment_type=eq_type,
            )
        elif is_followup:
            active_precedents = prev_precedents

        # Context-aware memory card display:
        # Precedent cards are displayed on initial troubleshooting questions or when the user specifically asks a historical-memory question.
        # Cards are suppressed on simple follow-ups (simplifications, technician questions, causal inquiries, greetings, acknowledgments).
        show_memory_cards = (
            (intent == "TROUBLESHOOTING_QUERY" and not is_followup)
            or is_historical_memory_query
            or intent in ("HISTORICAL_MEMORY_QUERY", "HISTORY_QUERY")
        )
        retrieved_precedents_for_response = active_precedents if show_memory_cards else []

        # 7. Extract Outcome Facts with Grounding
        outcome_to_record: Optional[dict[str, Any]] = None
        if intent == "REPORT_OUTCOME":
            is_success = not any(neg in lower_msg for neg in ["didn't work", "did not work", "failed", "unsuccessful", "still broken", "still not working", "failed to fix", "still faulty"])
            is_tech = any(w in lower_msg for w in ["technician", "electrician", "mechanic", "engineer", "service center", "service person"])
            verif_status = "TECHNICIAN_CONFIRMED" if is_tech else "USER_REPORTED"
            
            eq_name = active_equipment["equipment_type"] if active_equipment else "Industrial Equipment"
            
            # Extract actual symptoms from earlier messages in session
            original_symptoms = "Reported equipment issue from session"
            for m in conversation_history:
                if m["role"] == "user":
                    user_text = m["content"]
                    if any(w in user_text.lower() for w in ["stopped", "vibrat", "overheat", "noise", "shuts off", "fan loud", "error", "problem", "fault", "won't"]):
                        original_symptoms = user_text[:120]
                        break

            outcome_to_record = {
                "equipment_type": eq_name,
                "symptoms": original_symptoms,
                "action_taken": raw_message,
                "outcome_status": "SUCCESSFUL" if is_success else "UNSUCCESSFUL",
                "verification_status": verif_status,
                "ready_to_save": True,
            }

        # 8. Build Multi-Turn Context and Groq Prompt
        active_eq_name = active_equipment["equipment_type"] if active_equipment else "the equipment"
        precedent_text = ""
        if active_precedents:
            precedent_text = "VERIFIED HISTORICAL PRECEDENTS IN EPISODIC MEMORY:\n"
            for p in active_precedents:
                precedent_text += (
                    f"- Machine: {p.machine_id} ({p.equipment_type})\n"
                    f"  Date: {p.verified_at or 'Recorded in plant history'}\n"
                    f"  Reported Symptoms: {p.symptoms}\n"
                    f"  Repair Action Taken: {p.action_taken}\n"
                    f"  Verified Outcome: {p.outcome_status} (Verification: {p.verification_status})\n"
                    f"  Inspection Notes: {p.inspection_notes}\n\n"
                )
        else:
            precedent_text = f"No prior historical repair precedents were found in the episodic memory bank for {active_eq_name}.\n"

        groq_messages: list[dict[str, str]] = []
        direct_reply: Optional[str] = None

        if intent == "CLARIFICATION_NEEDED":
            clarification_options = " or ".join(recent_equipments_discussed[:2]) if len(recent_equipments_discussed) >= 2 else "the equipment"
            direct_reply = f"Before I advise you, could you please clarify whether you're asking about the {clarification_options}?"

        elif intent == "CASUAL_GREETING":
            system_instruction = (
                "You are RecallOps — an AI troubleshooting assistant that learns from verified real-world experiences.\n"
                "Respond warmly, concisely, and naturally. Greet the user and invite them to describe any equipment problem "
                "(motors, pumps, compressors, appliances, or devices) they need help understanding or diagnosing. "
                "Do NOT use troubleshooting section headers. Keep response under 40 words."
            )
            groq_messages = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": raw_message},
            ]

        elif intent == "ACKNOWLEDGMENT":
            system_instruction = (
                "You are RecallOps. The user is thanking or acknowledging you.\n"
                "Respond warmly and briefly (under 30 words), letting them know you are here whenever they need equipment diagnostics "
                "or verified repair advice. Do NOT include troubleshooting section headers."
            )
            groq_messages = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": raw_message},
            ]

        elif intent == "CONCEPT_EXPLANATION":
            system_instruction = (
                "You are RecallOps — an AI industrial troubleshooting assistant.\n"
                "Provide a clear, educational explanation of the requested equipment concept in plain English. "
                "Use 2 to 3 concise, readable bullet points or short paragraphs. "
                "Do NOT include troubleshooting section headers. Keep response under 120 words."
            )
            groq_messages = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": raw_message},
            ]

        elif intent == "FOLLOWUP_SIMPLIFY":
            system_instruction = (
                f"You are RecallOps. The user is asking to explain the previously discussed causes or diagnosis for their {active_eq_name} in simpler, everyday words.\n\n"
                "INSTRUCTIONS:\n"
                "- Directly explain the most plausible causes in simple, plain English in 2 to 4 short sentences or brief bullets without technical jargon.\n"
                "- Frame causes as possibilities to inspect, not confirmed defects.\n"
                "- Use a clear, relatable everyday analogy if helpful (e.g. an overload trip is like a safety fuse tripping when it gets too hot; a capacitor is like a small booster battery that kick-starts the motor).\n"
                "- Do NOT repeat the four troubleshooting section headers (Plausible Causes, Safety Alert, Relevant Memory Insight, Question for Technician).\n"
                f"- Stay strictly focused on {active_eq_name}.\n"
                "- Total response must be under 85 words."
            )
            groq_messages = [{"role": "system", "content": system_instruction}]
            for m in conversation_history[-6:]:
                if m["role"] in ("user", "assistant"):
                    groq_messages.append({"role": m["role"], "content": m["content"]})
            groq_messages.append({"role": "user", "content": raw_message})

        elif intent == "FOLLOWUP_TECHNICIAN_QUESTIONS":
            system_instruction = (
                f"You are RecallOps. The user is asking what specific questions they should ask their technician regarding their {active_eq_name}.\n\n"
                "INSTRUCTIONS:\n"
                f"- Directly provide 2 to 3 targeted, practical questions as concise bullets for the technician regarding this {active_eq_name}.\n"
                "- Focus on testing and inspecting the specific components discussed in this conversation (such as checking capacitors, overload reset switches, bearings, or wiring).\n"
                "- Do NOT repeat the four troubleshooting section headers.\n"
                f"- Stay strictly focused on {active_eq_name}.\n"
                "- Total response must be under 85 words."
            )
            groq_messages = [{"role": "system", "content": system_instruction}]
            for m in conversation_history[-6:]:
                if m["role"] in ("user", "assistant"):
                    groq_messages.append({"role": m["role"], "content": m["content"]})
            groq_messages.append({"role": "user", "content": raw_message})

        elif intent in ("FOLLOWUP_WHY_OR_HOW", "FOLLOWUP_GENERAL"):
            system_instruction = (
                f"You are RecallOps. The user is asking a follow-up question regarding their {active_eq_name}.\n\n"
                "INSTRUCTIONS:\n"
                "- Answer the specific follow-up question directly, accurately, and concisely in 2 to 4 short sentences.\n"
                "- Clearly distinguish plausible causes from confirmed faults without claiming a component is definitely defective.\n"
                "- Explain the underlying physical or electrical mechanism in plain terms.\n"
                "- Do NOT repeat the four troubleshooting section headers.\n"
                f"- Stay strictly focused on {active_eq_name}.\n"
                "- Total response must be under 90 words."
            )
            groq_messages = [{"role": "system", "content": system_instruction}]
            for m in conversation_history[-6:]:
                if m["role"] in ("user", "assistant"):
                    groq_messages.append({"role": m["role"], "content": m["content"]})
            groq_messages.append({"role": "user", "content": raw_message})

        elif intent in ("HISTORICAL_MEMORY_QUERY", "HISTORY_QUERY"):
            system_instruction = (
                f"You are RecallOps — an AI assistant learning from verified equipment repair experiences.\n"
                f"The user is asking a historical memory question about past repair records or previous incidents for their {active_eq_name}.\n\n"
                "STRICT INSTRUCTIONS:\n"
                "- Directly answer the historical-memory question in 2 to 4 concise sentences (under 85 words).\n"
                "- State what past repair records in episodic memory show for this equipment and symptom pattern.\n"
                "- Explicitly distinguish what worked (successful repairs) from what failed (unsuccessful actions), citing the specific machine ID, the exact repair action taken, and the recorded outcome.\n"
                "- If no prior repair history exists for this equipment in memory, state plainly and honestly that no previous repair records were found.\n"
                "- NEVER invent or hallucinate machine IDs, repair actions, dates, or verification evidence.\n"
                "- Do NOT generate 'Plausible Causes', 'Safety Alert', 'Relevant Memory Insight', or 'Question for Technician' sections.\n"
                "- Keep the response direct, natural, and helpful."
            )
            groq_messages = [{"role": "system", "content": system_instruction}]
            for m in conversation_history[-6:]:
                if m["role"] in ("user", "assistant"):
                    groq_messages.append({"role": m["role"], "content": m["content"]})
            groq_messages.append({"role": "user", "content": f"USER HISTORICAL MEMORY QUESTION: \"{raw_message}\"\n\n{precedent_text}\nAnswer the historical-memory question directly in 2 to 4 concise sentences distinguishing successful and unsuccessful precedents above."})

        elif intent == "REPORT_OUTCOME":
            system_instruction = (
                f"You are RecallOps. The user is reporting a completed repair outcome on their {active_eq_name}.\n\n"
                "INSTRUCTIONS (Respond based ONLY on facts provided by user):\n"
                "1. Acknowledge the reported outcome (confirming whether the action succeeded or failed).\n"
                "2. Briefly explain in plain English why this mechanical or electrical fix addressed (or failed to address) the underlying symptoms. Do NOT invent unstated test results or root causes.\n"
                "3. Invite them to confirm storing this resolution in permanent plant memory for future fleet learning.\n"
                "Do NOT repeat troubleshooting section headers. Keep response under 125 words."
            )
            groq_messages = [{"role": "system", "content": system_instruction}]
            for m in conversation_history[-4:]:
                if m["role"] in ("user", "assistant"):
                    groq_messages.append({"role": m["role"], "content": m["content"]})
            groq_messages.append({"role": "user", "content": f"USER REPORT: \"{raw_message}\"\n{precedent_text}\nProvide your concise response acknowledging the repair outcome."})

        else:
            # Standard Troubleshooting Query
            is_household = active_equipment.get("category") in ("household", "electronic") if active_equipment else False
            device_safety_instruction = (
                "- Exactly 1 clear precaution recommending unplugging the appliance from the wall outlet and seeking qualified service; never instruct the user to open energized enclosures."
                if is_household else
                "- Exactly 1 clear industrial precaution (Lockout/Tagout at the breaker, verify zero energy with certified PPE) before opening covers or rotating parts."
            )

            system_instruction = (
                "You are RecallOps — an AI industrial & equipment troubleshooting assistant that learns from verified real-world experiences.\n"
                "Communicate simply, crisply, and practically for equipment operators and technicians.\n\n"
                "CALIBRATED DIAGNOSTIC LANGUAGE:\n"
                "- Clearly distinguish plausible causes from confirmed faults.\n"
                "- Use evidence-calibrated phrases (e.g., 'plausible cause', 'potential contributor', 'inspect to verify').\n"
                "- NEVER claim a component is definitely defective without physical diagnostic evidence.\n"
                "- AVOID unsupported claims such as 'the most common cause', 'this is definitely the problem', or 'replacing this usually fixes it'.\n\n"
                "MANDATORY RESPONSE STRUCTURE:\n"
                "Plausible Causes:\n"
                "- 3 to 4 concise, easily understandable bullet points explaining likely root causes in plain English. Frame them as possibilities to inspect.\n\n"
                "Safety Alert:\n"
                f"{device_safety_instruction}\n\n"
                "Relevant Memory Insight:\n"
                f"- In 1 or 2 short sentences, state what past plant experience shows from the retrieved memory below for {active_eq_name}. Mention the machine ID (e.g. M-112 or EQ-FIELD) and state whether the repair SUCCEEDED or was UNSUCCESSFUL. If no matching memory exists, state in 1 sentence that no historical record was found in memory for this symptom.\n\n"
                "Question for Technician:\n"
                "- Exactly 1 targeted, practical question the user can ask their certified maintenance technician.\n\n"
                "CONSTRAINTS:\n"
                "- Total response must be under 175 words.\n"
                "- Never fabricate false machine IDs, dates, or outcomes.\n"
                "- Do not use conversational filler or generic disclaimers."
            )
            groq_messages = [{"role": "system", "content": system_instruction}]
            for m in conversation_history[-4:]:
                if m["role"] in ("user", "assistant"):
                    groq_messages.append({"role": m["role"], "content": m["content"]})
            groq_user_prompt = (
                f"USER INQUIRY: \"{raw_message}\"\n\n"
                f"ACTIVE EQUIPMENT: {active_eq_name}\n"
                f"IDENTIFIED HAZARD: {detected_hazard or ('Household appliance electrical isolation caution' if is_household else 'Standard industrial isolation protocol')}\n\n"
                f"{precedent_text}\n"
                f"Provide your concise diagnostic response adhering strictly to the 4 sections above."
            )
            groq_messages.append({"role": "user", "content": groq_user_prompt})

        if direct_reply:
            reply_text = direct_reply
        else:
            try:
                client = groq_service.get_client()
                completion = client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=groq_messages,
                    temperature=0.2,
                    max_tokens=800,
                )
                reply_text = completion.choices[0].message.content
            except Exception as e:
                logger.error("Groq chat inference error: %s", e)
                reply_text = (
                    "**Diagnostic Assessment:**\n"
                    "• Plausible Cause: Based on the reported symptoms, internal friction, mechanical misalignment, or power supply irregularities may be present.\n"
                    "• Immediate Safety: Disconnect electrical power or isolate drive before physical inspection.\n"
                    "• Next Step: Consult a certified maintenance technician to verify operating parameters."
                )

        # 9. Adaptive Suggested Follow-Up Prompts
        suggested_followups = []
        if intent == "CASUAL_GREETING":
            suggested_followups = [
                "My industrial pump is vibrating and overheating.",
                "My electric motor is making an unusual noise.",
                "My oven keeps switching off.",
            ]
        elif intent == "ACKNOWLEDGMENT":
            suggested_followups = [
                "Check my saved memories",
                "Start a new troubleshooting question",
                "Show recent repairs",
            ]
        elif intent == "CONCEPT_EXPLANATION":
            suggested_followups = [
                "How does bearing wear cause excessive vibration?",
                "What are common symptoms of coupling misalignment?",
                "Check pump repair history",
            ]
        elif intent == "REPORT_OUTCOME":
            suggested_followups = [
                "Save this verified repair to plant memory",
                "What follow-up inspection metrics should I record?",
                "Check for similar unresolved incidents",
            ]
        elif intent == "FOLLOWUP_SIMPLIFY":
            suggested_followups = [
                "What specific questions should I ask my technician?",
                "What safety steps must I take before opening the housing?",
                "Why does that part fail?",
            ]
        elif intent == "FOLLOWUP_TECHNICIAN_QUESTIONS":
            suggested_followups = [
                "The technician replaced the part and now it works.",
                "Can you explain that more simply?",
                "What if the technician finds no electrical faults?",
            ]
        elif intent in ("HISTORICAL_MEMORY_QUERY", "HISTORY_QUERY"):
            suggested_followups = [
                "What specific questions should I ask my technician?",
                "Can you explain that in simpler words?",
                "Which replacement parts were used?",
            ]
        elif intent in ("FOLLOWUP_WHY_OR_HOW", "FOLLOWUP_GENERAL"):
            suggested_followups = [
                "What specific questions should I ask my technician?",
                "Can you explain in simpler words?",
                "How can I prevent this in the future?",
            ]
        else:
            suggested_followups = [
                "Can you explain the most likely cause in simpler words?",
                "What specific questions should I ask my technician?",
                "What safety steps must I take before opening the housing?",
            ]

        # 10. Persist messages to SQLite
        user_msg_id = generate_id("MSG-USR")
        asst_msg_id = generate_id("MSG-AST")

        metadata = {
            "intent": intent,
            "equipment_detected": detected_equipment,
            "hazard_warning": detected_hazard,
            "retrieved_precedents": [p.model_dump() for p in active_precedents],
            "outcome_to_record": outcome_to_record,
            "suggested_followups": suggested_followups,
        }

        with get_db() as conn:
            conn.execute(
                "INSERT INTO messages (id, conversation_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (user_msg_id, conv_id, "user", raw_message, None, now_iso),
            )
            conn.execute(
                "INSERT INTO messages (id, conversation_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (asst_msg_id, conv_id, "assistant", reply_text, json.dumps(metadata), now_iso),
            )
            conn.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now_iso, conv_id),
            )

        return ChatResponse(
            conversation_id=conv_id,
            message_id=asst_msg_id,
            reply=reply_text,
            intent=intent,
            equipment_detected=detected_equipment,
            hazard_warning=detected_hazard,
            retrieved_precedents=retrieved_precedents_for_response,
            outcome_to_record=outcome_to_record,
            suggested_followups=suggested_followups,
            created_at=now_iso,
        )

    def record_outcome(self, req: RecordOutcomeRequest) -> RecordOutcomeResponse:
        """Record verified repair outcome into local SQLite database and optionally Hindsight Cloud."""
        incident_id = generate_id("INC")
        repair_id = generate_id("REP")
        verification_id = generate_id("VER")
        now_iso = datetime.now(timezone.utc).isoformat()
        doc_id = f"OUTCOME-{incident_id}"

        # 1. Insert into incidents table
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO incidents (
                    id, machine_id, equipment_type, symptoms, timestamp,
                    severity, reported_observations, status, is_demo, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                """,
                (
                    incident_id,
                    req.machine_id or "EQ-FIELD",
                    req.equipment_type,
                    req.symptoms,
                    now_iso,
                    "MEDIUM",
                    req.symptoms,
                    "VERIFIED_SUCCESSFUL" if req.outcome_status == "SUCCESSFUL" else "VERIFIED_UNSUCCESSFUL",
                    now_iso,
                    now_iso,
                ),
            )

            # 2. Insert into repairs table
            conn.execute(
                """
                INSERT INTO repairs (
                    id, incident_id, technician_id, action_taken, parts_replaced, notes, performed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    repair_id,
                    incident_id,
                    req.technician_id or "TECH-FIELD",
                    req.action_taken,
                    "Verified component",
                    req.inspection_notes or "Field repair completed and verified.",
                    now_iso,
                ),
            )

        # 3. Handle Hindsight Retention (Strictly guarded by live_retain flag and config)
        retained = False
        if req.live_retain and not settings.HINDSIGHT_MOCK_MODE:
            try:
                incident_dict = {
                    "id": incident_id,
                    "machine_id": req.machine_id or "EQ-FIELD",
                    "equipment_type": req.equipment_type,
                    "symptoms": req.symptoms,
                    "severity": "MEDIUM",
                    "reported_observations": req.symptoms,
                    "is_demo": True,
                }
                repair_dict = {
                    "technician_id": req.technician_id or "TECH-FIELD",
                    "action_taken": req.action_taken,
                    "parts_replaced": "Verified component",
                }
                verification_dict = {
                    "outcome_status": req.outcome_status,
                    "inspection_notes": req.inspection_notes or "Outcome confirmed by technician",
                    "follow_up_metrics": req.follow_up_metrics,
                    "verified_at": now_iso,
                }
                hindsight_service.retain_incident_outcome(
                    incident=incident_dict,
                    repair=repair_dict,
                    verification=verification_dict,
                )
                retained = True
            except Exception as e:
                logger.warning("Live Hindsight retain error: %s. Saved locally.", e)
                retained = False
        else:
            # Mock mode: marked as retained locally without spending credits
            retained = True

        # 4. Insert into outcome_verifications
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO outcome_verifications (
                    id, incident_id, verified_by, outcome_status, inspection_notes,
                    follow_up_metrics, hindsight_retained, hindsight_document_id, verified_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    verification_id,
                    incident_id,
                    req.technician_id or "TECH-FIELD",
                    req.outcome_status,
                    req.inspection_notes or "Field repair completed and verified.",
                    json.dumps(req.follow_up_metrics) if req.follow_up_metrics else None,
                    1 if retained else 0,
                    doc_id,
                    now_iso,
                ),
            )

        # 5. If conversation_id is provided, post a confirmation message into the conversation
        if req.conversation_id:
            asst_msg_id = generate_id("MSG-AST")
            msg_text = (
                f"✅ **Verified Experience Recorded Successfully!**\n\n"
                f"• **Equipment**: {req.equipment_type} ({req.machine_id or 'EQ-FIELD'})\n"
                f"• **Repair Action**: {req.action_taken}\n"
                f"• **Verified Outcome**: `{req.outcome_status}`\n"
                f"• **Status**: Saved to permanent memory bank (`{doc_id}`). Subsequent troubleshooting queries will now reference this verified experience."
            )
            with get_db() as conn:
                conn.execute(
                    "INSERT INTO messages (id, conversation_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (asst_msg_id, req.conversation_id, "assistant", msg_text, json.dumps({"type": "outcome_recorded", "incident_id": incident_id}), now_iso),
                )
                conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now_iso, req.conversation_id))

        return RecordOutcomeResponse(
            success=True,
            incident_id=incident_id,
            verification_id=verification_id,
            hindsight_retained=retained,
            message="Repair outcome recorded into episodic memory bank successfully.",
            document_id=doc_id,
        )


chat_service = ChatService()
