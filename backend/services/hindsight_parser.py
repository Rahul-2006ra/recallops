"""
RecallOps 2.0 Hindsight Memory Parser and Incident Aggregator.

Parses natural-language memory fragments, structured documents, tags, and entities
returned by Hindsight Cloud, grouping related fragments into unified, verified
incident records with strict deduplication and evidence-based outcome labeling.
"""

import re
from typing import Any, Optional, Dict, List
from datetime import datetime, timezone
from backend.models.chat import MemoryItemResponse


# Known industrial equipment type patterns and canonical display names
EQUIPMENT_PATTERNS = [
    (r"\bcooling[- ]water\s+pump\b", "Cooling-water pump"),
    (r"\bcentrifugal\s+(?:slurry\s+)?pump\b", "Centrifugal pump"),
    (r"\bslurry\s+pump\b", "Slurry pump"),
    (r"\bchemical\s+(?:feed\s+)?pump\b", "Chemical feed pump"),
    (r"\bfeed(?:water)?\s+pump\b", "Feedwater pump"),
    (r"\bpump\b", "Centrifugal pump"),
    (r"\binduction\s+motor\b", "Induction motor"),
    (r"\belectric\s+(?:drive\s+)?motor\b", "Electric drive motor"),
    (r"\bmotor\b", "Industrial motor"),
    (r"\breciprocating\s+compressor\b", "Reciprocating compressor"),
    (r"\bcentrifugal\s+compressor\b", "Centrifugal compressor"),
    (r"\bair\s+compressor\b", "Air compressor"),
    (r"\bcompressor\b", "Industrial compressor"),
    (r"\bindustrial\s+mixer\b", "Industrial mixer"),
    (r"\bmixer\b", "Industrial mixer"),
    (r"\bconvection\s+oven\b", "Convection oven"),
    (r"\boven\b", "Industrial oven"),
    (r"\bcooling\s+tower\b", "Cooling tower"),
    (r"\bheat\s+exchanger\b", "Heat exchanger"),
]

ASSET_TAG_REGEX = re.compile(r"\b([A-Z]{1,5}-\d{2,5}[A-Z]?)\b")


def extract_machine_id(text: str, tags: list[str], entities: list[str], doc_id: Optional[str]) -> Optional[str]:
    """Extract machine/asset identifier from tags, entities, text, or document_id."""
    # 1. Tags: machine-{id}
    for tag in (tags or []):
        m = re.match(r"^machine-([a-zA-Z0-9_\-]+)$", tag, re.IGNORECASE)
        if m:
            val = m.group(1).upper()
            if val not in ("DOC", "UNKNOWN", "HINDSIGHT-DOC"):
                return val

    # 2. Explicit colon header in text
    m_col = re.search(r"(?:Machine\s*(?:ID)?|Asset\s*(?:ID)?|Unit\s*(?:ID)?):\s*([A-Za-z0-9_\-]+)", text, re.IGNORECASE)
    if m_col:
        val = m_col.group(1).strip().upper()
        if val not in ("DOC", "UNKNOWN", "HINDSIGHT-DOC"):
            return val

    # 3. Entities list from Hindsight
    for ent in (entities or []):
        m_ent = ASSET_TAG_REGEX.search(ent.upper())
        if m_ent:
            val = m_ent.group(1)
            if val != "HINDSIGHT-DOC":
                return val

    # 4. Natural language text pattern (e.g. "pump CP-204", "CP-204 experienced")
    m_nl = re.search(r"\b(?:pump|motor|machine|compressor|unit|equipment)?\s*([A-Z]{1,5}-\d{2,5}[A-Z]?)\b", text, re.IGNORECASE)
    if m_nl:
        val = m_nl.group(1).upper()
        if val != "HINDSIGHT-DOC":
            return val

    # 5. Extract from document_id
    if doc_id and doc_id != "HINDSIGHT-DOC":
        clean_doc = doc_id.replace("OUTCOME-", "").replace("HACKATHON-VERIFIED-", "").replace("INC-", "")
        m_doc = ASSET_TAG_REGEX.search(clean_doc.upper())
        if m_doc:
            return m_doc.group(1)

    return None


def extract_equipment_type(text: str, entities: list[str], fallback: Optional[str] = None) -> str:
    """Extract canonical equipment type from text, entities, or fallback."""
    # 1. Explicit colon header
    m_col = re.search(r"Equipment(?:\s*Type)?:\s*([^\n\.,]+)", text, re.IGNORECASE)
    if m_col:
        eq = m_col.group(1).strip()
        if len(eq) >= 3 and eq.lower() != "industrial equipment":
            return eq.title()

    # 2. Known equipment vocabulary across entities and text
    combined = " ".join(entities or []) + " " + text
    for pattern, canonical_name in EQUIPMENT_PATTERNS:
        if re.search(pattern, combined, re.IGNORECASE):
            return canonical_name

    if fallback and fallback.lower() != "industrial equipment":
        return fallback.title()

    return "Industrial Equipment"


def extract_outcome_status(text: str, tags: list[str]) -> str:
    """
    Extract verified outcome status with strict evidence requirements.
    Never automatically defaults to 'SUCCESSFUL' unless substantiated.
    Returns: 'SUCCESSFUL', 'UNSUCCESSFUL', or 'UNVERIFIED'.
    """
    for tag in (tags or []):
        t_low = tag.lower()
        if t_low in ("outcome-successful", "status-successful"):
            return "SUCCESSFUL"
        if t_low in ("outcome-unsuccessful", "status-unsuccessful", "outcome-failed"):
            return "UNSUCCESSFUL"

    m_col = re.search(r"Verified\s*Outcome:\s*(SUCCESSFUL|UNSUCCESSFUL|RESOLVED|FAILED)", text, re.IGNORECASE)
    if m_col:
        val = m_col.group(1).upper()
        if val in ("SUCCESSFUL", "RESOLVED"):
            return "SUCCESSFUL"
        if val in ("UNSUCCESSFUL", "FAILED"):
            return "UNSUCCESSFUL"

    lower = text.lower()
    unsuccessful_signals = [
        "failed attempt", "vibration remained", "temperature remained",
        "did not resolve", "unsuccessful", "avoid repeating", "recurred",
        "still overheating", "remained elevated", "abort",
    ]
    if any(sig in lower for sig in unsuccessful_signals):
        return "UNSUCCESSFUL"

    successful_signals = [
        "verified outcome: successful", "outcome was successful", "successfully resolved",
        "successfully repaired", "normalized", "vibration normalized",
        "temperature normalized", "returned to normal", "repair verified",
    ]
    if any(sig in lower for sig in successful_signals):
        return "SUCCESSFUL"

    return "UNVERIFIED"


def extract_incident_id(text: str, tags: list[str], doc_id: Optional[str], machine_id: Optional[str]) -> str:
    """Extract or derive stable incident identifier."""
    for tag in (tags or []):
        m = re.match(r"^incident-([a-zA-Z0-9_\-]+)$", tag, re.IGNORECASE)
        if m:
            return m.group(1).upper()

    if doc_id and doc_id != "HINDSIGHT-DOC":
        clean = doc_id.replace("OUTCOME-", "").replace("HACKATHON-VERIFIED-", "")
        if clean:
            return clean.upper()

    m_inc = re.search(r"Incident(?:\s*ID)?:\s*([A-Za-z0-9_\-]+)", text, re.IGNORECASE)
    if m_inc:
        val = m_inc.group(1).strip().upper()
        if val not in ("DOC", "HINDSIGHT-DOC"):
            return val

    if machine_id:
        return f"INC-{machine_id}"

    return "INC-UNKNOWN"


def extract_symptoms(text: str) -> Optional[str]:
    """Extract symptom description from text."""
    m_col = re.search(r"(?:Reported\s*Symptoms|Symptoms|Problem|Issue|Failure\s*Mode):\s*([^\n]+)", text, re.IGNORECASE)
    if m_col:
        return m_col.group(1).strip()

    m_exp = re.search(r"(?:experienced|reported|exhibited|suffered|presented|showed)\s+([^\|\.\n]+)", text, re.IGNORECASE)
    if m_exp:
        sym = m_exp.group(1).strip()
        sym = re.sub(r"\s+(?:when|with)\s+.*$", "", sym, flags=re.IGNORECASE).strip()
        if len(sym) >= 6:
            return sym[0].upper() + sym[1:]

    return None


def extract_repair_action(text: str) -> Optional[str]:
    """Extract repair action taken from text."""
    m_col = re.search(r"(?:Repair\s*Action|Action\s*Taken|Physical\s*Action|Failed\s*Action|Attempted\s*Action):\s*([^\n]+)", text, re.IGNORECASE)
    if m_col:
        return m_col.group(1).strip()

    m_att = re.search(r"\b(?:attempted|tried|performed)\s+([^\|\.\n]+)", text, re.IGNORECASE)
    if m_att:
        act = m_att.group(1).strip()
        act = re.sub(r"\s+but\s+.*$", "", act, flags=re.IGNORECASE).strip()
        if len(act) >= 6:
            return act[0].upper() + act[1:]

    m_by = re.search(r"(?:repaired|serviced|resolved|fixed)[^b\n]*by\s+([^\|\.\n]+)", text, re.IGNORECASE)
    if m_by:
        act = m_by.group(1).strip()
        if len(act) >= 6:
            return act[0].upper() + act[1:]

    m_rep = re.search(r"\b((?:replacing|replaced|installed|aligned|lubricated|serviced|regreased|adjusted|coupling alignment)\s+[^\|\.\n]+)", text, re.IGNORECASE)
    if m_rep:
        act = m_rep.group(1).strip()
        if len(act) >= 6:
            return act[0].upper() + act[1:]

    return None


def extract_technician(text: str) -> Optional[str]:
    """Extract technician identifier from text."""
    m_col = re.search(r"Technician(?:\s*ID)?:\s*([A-Za-z0-9_\-]+)", text, re.IGNORECASE)
    if m_col:
        return m_col.group(1).strip()
    m_nl = re.search(r"Technician\s+([A-Za-z0-9_\-]+)", text, re.IGNORECASE)
    if m_nl:
        return m_nl.group(1).strip()
    return None


def extract_inspection_notes(text: str) -> Optional[str]:
    """Extract post-repair inspection notes or operational metric observations."""
    m_col = re.search(r"Inspection\s*Notes:\s*([^\n]+)", text, re.IGNORECASE)
    if m_col:
        return m_col.group(1).strip()
    m_metric = re.search(r"(?:temperature|discharge pressure|vibration)\s*[^\|\n\.]*(?:normalized|bar|°C|mm/s)[^\|\n\.]*", text, re.IGNORECASE)
    if m_metric:
        return m_metric.group(0).strip()
    return None


def group_cloud_memory_fragments(
    raw_fragments: list[dict[str, Any]],
    query: str = "",
    equipment_type_filter: Optional[str] = None,
    outcome_status_filter: Optional[str] = None,
) -> list[MemoryItemResponse]:
    """
    Group recalled memory fragments belonging to the same verified incident into unified incident cards.
    Applies strict evidence-based outcome labeling and avoids creating multiple cards for one incident.
    """
    if not raw_fragments:
        return []

    # Map: group_key -> list of fragment data
    groups: dict[str, list[dict[str, Any]]] = {}

    for item in raw_fragments:
        text = item.get("text", "") or ""
        tags = item.get("tags") or []
        entities = item.get("entities") or []
        doc_id = item.get("document_id")
        ts = item.get("timestamp") or ""

        # Extract primary components
        m_id = extract_machine_id(text, tags, entities, doc_id)
        eq_type = extract_equipment_type(text, entities, equipment_type_filter)
        inc_id = extract_incident_id(text, tags, doc_id, m_id)
        outcome = extract_outcome_status(text, tags)
        symptoms = extract_symptoms(text)
        action = extract_repair_action(text)
        tech = extract_technician(text)
        notes = extract_inspection_notes(text)

        parsed_data = {
            "text": text,
            "tags": tags,
            "entities": entities,
            "doc_id": doc_id,
            "machine_id": m_id,
            "equipment_type": eq_type,
            "incident_id": inc_id,
            "outcome_status": outcome,
            "symptoms": symptoms,
            "action": action,
            "technician": tech,
            "notes": notes,
            "timestamp": ts,
            "score": item.get("score"),
        }

        # Stable group key determination
        # Priority 1: Concrete document ID
        if doc_id and doc_id != "HINDSIGHT-DOC":
            group_key = f"doc:{doc_id.upper()}"
        # Priority 2: Concrete incident ID
        elif inc_id and inc_id != "INC-UNKNOWN":
            group_key = f"inc:{inc_id.upper()}"
        # Priority 3: Machine ID + outcome status (keeps distinct incidents/trials on the same machine distinct)
        elif m_id:
            # Group by machine and outcome status so successful and failed attempts remain distinct
            group_key = f"mach:{m_id.upper()}:{outcome}"
        else:
            # Fallback for untagged items: use text hash/item id to avoid over-collapsing unrelated items
            group_key = f"raw:{item.get('id') or hash(text[:60])}"

        if group_key not in groups:
            groups[group_key] = []
        groups[group_key].append(parsed_data)

    unified_records: list[MemoryItemResponse] = []

    for group_key, frags in groups.items():
        # Synthesize the best values across all fragments in this incident group
        # Machine ID: first non-None
        final_machine_id = next((f["machine_id"] for f in frags if f["machine_id"]), None) or "EQ-FIELD"

        # Equipment Type: preferred specific over generic
        final_eq = "Industrial Equipment"
        for f in frags:
            cand = f["equipment_type"]
            if cand and cand.lower() != "industrial equipment":
                final_eq = cand
                break

        # Incident ID
        final_inc_id = next((f["incident_id"] for f in frags if f["incident_id"] and f["incident_id"] != "INC-UNKNOWN"), None)
        if not final_inc_id:
            final_inc_id = f"INC-{final_machine_id}"

        # Document ID
        final_doc_id = next((f["doc_id"] for f in frags if f["doc_id"] and f["doc_id"] != "HINDSIGHT-DOC"), None)
        if not final_doc_id:
            final_doc_id = f"OUTCOME-{final_inc_id}"

        # Outcome Status: check evidence across all fragments
        outcomes = [f["outcome_status"] for f in frags]
        if "UNSUCCESSFUL" in outcomes and "SUCCESSFUL" not in outcomes:
            final_outcome = "UNSUCCESSFUL"
        elif "SUCCESSFUL" in outcomes:
            final_outcome = "SUCCESSFUL"
        elif "UNSUCCESSFUL" in outcomes:
            final_outcome = "UNSUCCESSFUL"
        else:
            final_outcome = "UNVERIFIED"

        # Symptoms: strictly extracted from stored evidence fragments; never from user prompt
        symptom_cands = [f["symptoms"] for f in frags if f["symptoms"]]
        final_symptoms = max(symptom_cands, key=len) if symptom_cands else "Anomalous operating conditions recorded in maintenance history"

        # Action: pick the longest / most descriptive
        action_cands = [f["action"] for f in frags if f["action"]]
        final_action = max(action_cands, key=len) if action_cands else f"Diagnostic inspection and component servicing on {final_machine_id}"

        # Technician
        final_tech = next((f["technician"] for f in frags if f["technician"]), None) or "TECH-CLOUD"

        # Notes
        notes_cands = [f["notes"] for f in frags if f["notes"]]
        final_notes = max(notes_cands, key=len) if notes_cands else "Verified episodic record recalled from Hindsight Cloud bank."

        # Timestamp
        final_ts = next((f["timestamp"] for f in frags if f["timestamp"]), None) or datetime.now(timezone.utc).isoformat()

        # Apply filters
        if equipment_type_filter:
            filter_lower = equipment_type_filter.lower()
            eq_lower = final_eq.lower()
            if filter_lower not in eq_lower and eq_lower not in filter_lower:
                filter_tokens = [t for t in re.split(r'\W+', filter_lower) if len(t) >= 4]
                eq_tokens = [t for t in re.split(r'\W+', eq_lower) if len(t) >= 4]
                if filter_tokens and eq_tokens and not any(t in eq_tokens for t in filter_tokens) and not any(t in filter_tokens for t in eq_tokens):
                    continue
        if outcome_status_filter and outcome_status_filter.upper() != final_outcome.upper():
            continue

        unified_records.append(
            MemoryItemResponse(
                id=f"hs-{final_doc_id}",
                incident_id=final_inc_id,
                machine_id=final_machine_id,
                equipment_type=final_eq,
                symptoms=final_symptoms,
                action_taken=final_action,
                parts_replaced=None,
                outcome_status=final_outcome,
                inspection_notes=final_notes,
                verified_by=final_tech,
                verified_at=final_ts,
                hindsight_retained=True,
                hindsight_document_id=final_doc_id,
                sync_status="synced",
                storage_engine="hindsight_cloud",
            )
        )

    return unified_records
