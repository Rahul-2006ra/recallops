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


# Quick keyword matcher for industrial, domestic, electronic, and everyday equipment
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
    "microwave oven": ("Microwave Oven", "household"),
    "microwave": ("Microwave Oven", "household"),
    "oven": ("Commercial Convection Oven", "household"),
    "mixer": ("Commercial Mixer Grinder", "household"),
    "grinder": ("Commercial Mixer Grinder", "household"),
    "mixie": ("Commercial Mixer Grinder", "household"),
    "mixy": ("Commercial Mixer Grinder", "household"),
    "मिक्सी": ("Commercial Mixer Grinder", "household"),
    "मिक्सर": ("Commercial Mixer Grinder", "household"),
    "ಮಿಕ್ಸಿ": ("Commercial Mixer Grinder", "household"),
    "ಮಿಕ್ಸರ್": ("Commercial Mixer Grinder", "household"),
    "மிக்ஸி": ("Commercial Mixer Grinder", "household"),
    "మిక్సీ": ("Commercial Mixer Grinder", "household"),
    "मिक्सर ग्राइंडर": ("Commercial Mixer Grinder", "household"),

    "laptop": ("Workstation Laptop", "electronic"),
    "computer": ("Industrial Panel PC", "electronic"),
    "refrigerator": ("Commercial Refrigerator", "household"),
    "fridge": ("Commercial Refrigerator", "household"),
    "boiler": ("Industrial Boiler", "industrial"),
    "conveyor": ("Belt Conveyor System", "industrial"),
    "press": ("Hydraulic Stamping Press", "industrial"),
    # Personal, household & everyday equipment (open-ended support)
    "power bank": ("Power Bank", "electronic"),
    "powerbank": ("Power Bank", "electronic"),
    "umbrella": ("Umbrella", "household"),
    "window": ("Window", "household"),
    "drone": ("Drone", "electronic"),
    "bicycle": ("Bicycle", "household"),
    "bike": ("Bicycle", "household"),
    "headphones": ("Headphones", "electronic"),
    "headphone": ("Headphones", "electronic"),
    "earbuds": ("Earbuds", "electronic"),
    "earphones": ("Earphones", "electronic"),
    "smartphone": ("Smartphone", "electronic"),
    "phone": ("Smartphone", "electronic"),
    "tablet": ("Tablet", "electronic"),
    "keyboard": ("Keyboard", "electronic"),
    "mouse": ("Computer Mouse", "electronic"),
    "printer": ("Printer", "electronic"),
    "vacuum cleaner": ("Vacuum Cleaner", "household"),
    "vacuum": ("Vacuum Cleaner", "household"),
    "air conditioner": ("Air Conditioner", "household"),
    "ac": ("Air Conditioner", "household"),
    "toaster": ("Toaster", "household"),
    "kettle": ("Electric Kettle", "household"),
    "blender": ("Blender", "household"),
    "dishwasher": ("Dishwasher", "household"),
    "ceiling fan": ("Ceiling Fan", "household"),
    "fan": ("Fan", "household"),
    "door lock": ("Door Lock Mechanism", "household"),
    "door": ("Door Hinge / Mechanism", "household"),
    "lock": ("Lock Mechanism", "household"),
    "gas stove": ("Gas Stove", "household"),
    "electric stove": ("Electric Stove", "household"),
    "stove": ("Gas Stove", "household"),
    "cooktop": ("Cooktop", "household"),
    "gas burner": ("Gas Burner", "household"),
    "burner": ("Gas Burner", "household"),
    "gas cylinder": ("Gas Cylinder", "household"),
    "lpg cylinder": ("Gas Cylinder", "household"),
    "cylinder": ("Gas Cylinder", "household"),
    "water heater": ("Water Heater", "household"),
    "geyser": ("Water Heater", "household"),
    "clothes iron": ("Clothes Iron", "household"),
    "iron": ("Clothes Iron", "household"),
    "inverter": ("Power Inverter", "electronic"),
    "ups": ("Uninterruptible Power Supply", "electronic"),
    "battery pack": ("Battery Pack", "electronic"),
    "battery": ("Battery", "electronic"),
    "power cord": ("Power Cable", "electronic"),
    "charger": ("Battery Charger", "electronic"),
    "cable": ("Power / Data Cable", "electronic"),
    "socket": ("Electrical Socket", "household"),
    "switch": ("Electrical Switch", "household"),
    # Audio, Video & Imaging Equipment
    "bluetooth speaker": ("Bluetooth Speaker", "electronic"),
    "smart speaker": ("Smart Speaker", "electronic"),
    "speaker": ("Bluetooth Speaker", "electronic"),
    "television": ("Television", "electronic"),
    "smart tv": ("Television", "electronic"),
    "tv screen": ("Television", "electronic"),
    "tv": ("Television", "electronic"),
    "monitor": ("Computer Monitor", "electronic"),
    "display": ("Display Screen", "electronic"),
    "dash camera": ("Dash Camera", "electronic"),
    "dash cam": ("Dash Camera", "electronic"),
    "dashcam": ("Dash Camera", "electronic"),
    "camera": ("Camera", "electronic"),
    "webcam": ("Webcam", "electronic"),
    "projector": ("Digital Projector", "electronic"),
    "router": ("Wi-Fi Router", "electronic"),
    "modem": ("Network Modem", "electronic"),
}


def detect_indic_or_vernacular(text: str) -> bool:
    """Detect if text contains Indic scripts or common Indian Romanized vernacular tokens."""
    for ch in text:
        cp = ord(ch)
        if (0x0900 <= cp <= 0x0D7F) or (0x0600 <= cp <= 0x06FF):
            return True
    lower = text.lower()
    vernacular_markers = {
        "mera", "meri", "mere", "nanna", "namma", "namaste", "namaskara", "namaskar",
        "vanakkam", "namaskaram", "aagta", "agta", "illa", "beku", "beda", "maduttilla",
        "madalla", "kelsa", "pani", "nahi", "nahin", "raha", "rahi", "rahe", "khatam",
        "band", "chalu", "thik", "theek", "kar", "karo", "kare", "karna", "aaye", "aaya",
        "hua", "hui", "hue", "bhai", "yaar", "mixie", "mixy", "swalpa", "aytu", "irukku",
        "pannala", "ledu", "undi", "cheyandi", "arre", "broo", "chala", "hota", "hoti"
    }
    words = set(re.findall(r'\b[a-zA-Z]+\b', lower))
    return len(words.intersection(vernacular_markers)) >= 1


def identify_script_or_vernacular_language(text: str) -> Optional[str]:
    """Identify language from Unicode script or distinctive vernacular vocabulary."""
    for ch in text:
        cp = ord(ch)
        if 0x0C80 <= cp <= 0x0CFF:
            return "Kannada"
        elif 0x0900 <= cp <= 0x097F:
            return "Hindi"
        elif 0x0B80 <= cp <= 0x0BFF:
            return "Tamil"
        elif 0x0C00 <= cp <= 0x0C7F:
            return "Telugu"
        elif 0x0D00 <= cp <= 0x0D7F:
            return "Malayalam"
        elif 0x0980 <= cp <= 0x09FF:
            return "Bengali"
        elif 0x0600 <= cp <= 0x06FF:
            return "Urdu"

    lower = text.lower()
    words = set(re.findall(r'\b[a-zA-Z]+\b', lower))
    kannada_tokens = {"nanna", "namma", "namaskara", "aagta", "agta", "illa", "beku", "beda", "maduttilla", "madalla", "kelsa", "swalpa", "aytu"}
    hindi_tokens = {"mera", "meri", "mere", "nahi", "nahin", "raha", "rahi", "rahe", "khatam", "band", "chalu", "thik", "theek", "kar", "karo", "kare", "karna", "aaye", "aaya", "hua", "hui", "hue", "bhai", "yaar", "arre", "kaise", "kya", "haal", "accha"}
    tamil_tokens = {"vanakkam", "irukku", "pannala"}
    telugu_tokens = {"namaskaram", "ledu", "undi", "cheyandi", "chala"}

    if words.intersection(kannada_tokens):
        return "Kannada"
    elif words.intersection(hindi_tokens):
        return "Hindi"
    elif words.intersection(tamil_tokens):
        return "Tamil"
    elif words.intersection(telugu_tokens):
        return "Telugu"
    return None


def detect_equipment_entity(text: str) -> Optional[dict[str, Any]]:
    """Detect equipment from explicit keywords or dynamic open-ended phrasing."""
    lower = text.lower().strip()
    sorted_keywords = sorted(EQUIPMENT_KEYWORDS.items(), key=lambda x: len(x[0]), reverse=True)
    for kw, (eq_name, category) in sorted_keywords:
        if any(ord(c) > 127 for c in kw):
            if kw in lower:
                return {
                    "equipment_type": eq_name,
                    "category": category,
                    "matched_keyword": kw,
                }
        else:
            if re.search(r'\b' + re.escape(kw) + r'\b', lower):
                return {
                    "equipment_type": eq_name,
                    "category": category,
                    "matched_keyword": kw,
                }

    # Dynamic open-ended equipment extraction for phrasing like:
    # "my umbrella won't open", "the window is stuck", "our power bank is dead", "my electric bicycle"
    # "My unfamiliar ZentroMax machine is vibrating", "hydraulic press unit is leaking"
    has_problem_indicator = any(w in lower for w in [
        "won't", "wont", "not working", "stopped", "stuck", "broken", "faulty", "creak", "creaking",
        "overheat", "vibrat", "leaking", "smoke", "dead", "shut off", "shuts off", "tripped", "failing",
        "making noise", "unusual noise", "grinding", "sparking", "blown", "not charging",
        "not on", "is not on", "won't turn on", "wont turn on", "won't start", "wont start", "doesn't turn on",
        "does not turn on", "got over", "ran out", "empty", "no flame", "not lighting", "won't ignite", "no gas",
        # Multilingual & Indian language problem indicators
        "काम नहीं", "काम नही", "खराब", "बंद", "ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ", "ಕೆಲಸ ಮಾಡ್ತಿಲ್ಲ", "ಆಗ್ತಾ ಇಲ್ಲ", "ಅಗ್ತಾ ಇಲ್ಲ",
        "ವೇಲೆ ಸೆಯ್ಯವಿಲ್ಲೈ", "పనిచేయడం లేదు", "work nahi", "work aagta illa", "kaam nahi", "chal nahi raha",
        "band ho gaya", "chal nahi rahi", "chalu nahi", "kharab ho gaya"
    ])


    non_equipment_words = {
        "technician", "problem", "fault", "issue", "question", "friend", "girlfriend", "boyfriend",
        "day", "car", "name", "boss", "opinion", "screen", "repair", "idea", "thoughts",
        "experience", "code", "work", "time", "meal", "food", "dinner", "lunch", "breakfast",
        "head", "hand", "mind", "life", "first", "last", "other", "best", "worst", "python",
        "capital", "france", "joke", "status", "outcome", "session", "springs", "spring",
        "most likely", "likely", "most", "cause", "causes", "reason", "reasons", "happen",
        "machine", "device", "equipment", "appliance", "unit", "system", "thing", "things",
        "repair records", "past repair", "records", "history", "precedents", "help", "detail",
        "this", "that", "these", "those", "each", "every", "some", "any", "unfamiliar"
    }

    # Pattern A: Specific machine/device phrasing like "ZentroMax machine", "hydraulic press unit"
    m_mach = re.search(r'\b([a-zA-Z0-9_-]{3,})\s+(machine|device|unit|equipment|appliance)\b', lower)
    if m_mach:
        candidate_brand = m_mach.group(1).strip()
        kind = m_mach.group(2).strip()
        if candidate_brand not in non_equipment_words and not any(w in candidate_brand.split() for w in ["what", "how", "why", "when", "where", "who", "can", "explain", "that", "this"]):
            formatted_name = f"{candidate_brand.title()} {kind.title()}"
            cat = "electronic" if any(k in candidate_brand for k in ["battery", "charger", "power", "phone", "usb", "drone", "audio", "device", "led"]) else "industrial"
            return {
                "equipment_type": formatted_name,
                "category": cat,
                "matched_keyword": f"{candidate_brand} {kind}",
            }

    if has_problem_indicator:
        m = re.search(r'\b(?:my|the|our)\s+([a-zA-Z]{3,}(?:\s+[a-zA-Z]{3,})?)\b', lower)
        if m:
            candidate = m.group(1).strip()
            # If candidate starts with 'unfamiliar', strip it: e.g. "unfamiliar zentromax" -> "zentromax"
            if candidate.startswith("unfamiliar "):
                candidate = candidate[len("unfamiliar "):].strip()
            if candidate not in non_equipment_words and not any(w in candidate.split() for w in ["what", "how", "why", "when", "where", "who", "can", "explain", "that", "this", "most", "likely", "happen"]):
                formatted_name = candidate.title()
                cat = "electronic" if any(k in candidate for k in ["battery", "charger", "power", "phone", "usb", "drone", "audio", "device", "led"]) else "household"
                return {
                    "equipment_type": formatted_name,
                    "category": cat,
                    "matched_keyword": candidate,
                }

    return None

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
        elif any(k in lower for k in ["gas", "cylinder", "lpg", "gas leak", "smell gas"]):
            return "GAS / EXPLOSION HAZARD: Ensure regulator valve is fully closed before disconnecting or swapping. If gas odor is present, ventilate the area immediately, do not ignite any flame or operate electrical switches, and contact certified services."
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

    def create_conversation(self, title: Optional[str] = None, user_id: Optional[str] = None) -> dict[str, Any]:
        conv_id = generate_id("CONV")
        now_iso = datetime.now(timezone.utc).isoformat()
        final_title = title or "New Troubleshooting Session"
        with get_db() as conn:
            conn.execute(
                "INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (conv_id, user_id, final_title, now_iso, now_iso),
            )
        return {"id": conv_id, "title": final_title, "user_id": user_id, "created_at": now_iso, "updated_at": now_iso, "message_count": 0}

    def list_conversations(self, user_id: Optional[str] = None) -> list[ConversationResponse]:
        with get_db() as conn:
            query = """
                SELECT c.id, c.title, c.created_at, c.updated_at,
                       COUNT(m.id) as message_count,
                       (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_preview
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
            """
            params = []
            if user_id:
                query += " WHERE c.user_id = ?"
                params.append(user_id)
            else:
                query += " WHERE c.user_id IS NULL"

            query += """
                GROUP BY c.id
                ORDER BY c.updated_at DESC
            """
            rows = conn.execute(query, params).fetchall()
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

    def get_conversation(self, conversation_id: str, user_id: Optional[str] = None) -> Optional[ConversationDetailResponse]:
        with get_db() as conn:
            conv = conn.execute(
                "SELECT id, user_id, title, created_at, updated_at FROM conversations WHERE id = ?",
                (conversation_id,),
            ).fetchone()
            if not conv:
                return None
            if user_id and conv["user_id"] and conv["user_id"] != user_id:
                return None
            if user_id and conv["user_id"] is None and user_id != "demo_user":
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

    def delete_conversation(self, conversation_id: str, user_id: Optional[str] = None) -> bool:
        with get_db() as conn:
            if user_id:
                cursor = conn.execute("DELETE FROM conversations WHERE id = ? AND user_id = ?", (conversation_id, user_id))
            else:
                cursor = conn.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
            return cursor.rowcount > 0

    def record_problem_episode(
        self,
        conversation_id: str,
        equipment_name: str,
        category: str,
        symptoms: str,
        original_description: str,
        user_scope: str = "default_user",
    ) -> str:
        """
        Record or update an active, unresolved problem episode in persistent SQLite.
        Enables cross-conversation learning and outcome linking when repairs are reported in later sessions.
        """
        ep_id = generate_id("EPISODE")
        now_iso = datetime.now(timezone.utc).isoformat()
        with get_db() as conn:
            # Check if this exact conversation and equipment already has an unresolved episode
            existing = conn.execute(
                """
                SELECT id FROM problem_episodes
                WHERE conversation_id = ? AND LOWER(equipment_name) = ? AND status = 'unresolved'
                LIMIT 1
                """,
                (conversation_id, equipment_name.lower().strip()),
            ).fetchone()
            if existing:
                conn.execute(
                    """
                    UPDATE problem_episodes
                    SET symptoms = ?, original_description = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (symptoms[:250], original_description[:500], now_iso, existing["id"]),
                )
                return existing["id"]

            conn.execute(
                """
                INSERT INTO problem_episodes (
                    id, conversation_id, user_scope, equipment_name, equipment_category,
                    symptoms, original_description, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'unresolved', ?, ?)
                """,
                (
                    ep_id,
                    conversation_id,
                    user_scope,
                    equipment_name,
                    category,
                    symptoms[:250],
                    original_description[:500],
                    now_iso,
                    now_iso,
                ),
            )
        return ep_id

    def find_matching_problem_episode(
        self,
        equipment_name: Optional[str],
        text: str,
        user_scope: str = "default_user",
        conversation_id: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Search unresolved problem episodes across all conversations for the user scope.
        Prioritizes the active conversation if conversation_id has an unresolved episode.
        Matches by equipment name, symptom keywords, and chronological recency.
        """
        if conversation_id:
            with get_db() as conn:
                conv_ep = conn.execute(
                    """
                    SELECT id, conversation_id, user_scope, equipment_name, equipment_category,
                           symptoms, original_description, status, created_at, updated_at
                    FROM problem_episodes
                    WHERE conversation_id = ? AND status = 'unresolved'
                    ORDER BY updated_at DESC
                    LIMIT 1
                    """,
                    (conversation_id,),
                ).fetchone()
                if conv_ep:
                    return dict(conv_ep)

        with get_db() as conn:
            rows = conn.execute(
                """
                SELECT id, conversation_id, user_scope, equipment_name, equipment_category,
                       symptoms, original_description, status, created_at, updated_at
                FROM problem_episodes
                WHERE user_scope = ? AND status = 'unresolved'
                ORDER BY updated_at DESC
                """,
                (user_scope,),
            ).fetchall()

        if not rows:
            return None

        lower_text = text.lower()
        lower_eq = equipment_name.lower().strip() if equipment_name else ""

        # Strategy 1: Match on explicit equipment name passed in
        if lower_eq:
            for r in rows:
                r_eq = r["equipment_name"].lower().strip()
                if lower_eq == r_eq or lower_eq in r_eq or r_eq in lower_eq:
                    return dict(r)

        # Strategy 2: Check if any episode's equipment name appears in the message text
        for r in rows:
            r_eq = r["equipment_name"].lower().strip()
            if re.search(r'\b' + re.escape(r_eq) + r'\b', lower_text):
                return dict(r)

        # Strategy 3: Token overlap between user text and episode equipment / symptoms / description
        best_match = None
        best_score = 0
        words = set(re.findall(r'\b[a-zA-Z]{3,}\b', lower_text))

        for r in rows:
            r_eq_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', r["equipment_name"].lower()))
            r_sym_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', r["symptoms"].lower()))
            r_desc_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', r["original_description"].lower()))

            # Weight equipment matches very heavily to avoid cross-equipment confusion
            eq_overlap = len(words.intersection(r_eq_words))
            sym_overlap = len(words.intersection(r_sym_words.union(r_desc_words)))
            score = (eq_overlap * 15) + sym_overlap

            if score > best_score:
                best_score = score
                best_match = r

        if best_match and best_score >= 1:
            return dict(best_match)

        # Strategy 4: If exactly 1 unresolved episode exists for this user scope, match it
        if len(rows) == 1:
            return dict(rows[0])

        return None

    def resolve_problem_episode(
        self,
        episode_id: str,
        action_taken: str,
        user_scope: str = "default_user",
    ) -> bool:
        """Mark a problem episode as resolved in SQLite with its verified repair action."""
        now_iso = datetime.now(timezone.utc).isoformat()
        with get_db() as conn:
            res = conn.execute(
                """
                UPDATE problem_episodes
                SET status = 'resolved',
                    resolution_action = ?,
                    resolved_at = ?,
                    updated_at = ?
                WHERE id = ? AND user_scope = ?
                """,
                (action_taken, now_iso, now_iso, episode_id, user_scope),
            )
            return res.rowcount > 0

    def update_problem_episode_cause(
        self,
        conversation_id: str,
        equipment_name: str,
        cause_description: str,
    ) -> bool:
        """Update an unresolved problem episode in SQLite with discovered root cause or user explanation."""
        now_iso = datetime.now(timezone.utc).isoformat()
        with get_db() as conn:
            ep = conn.execute(
                """
                SELECT id, symptoms, original_description FROM problem_episodes
                WHERE conversation_id = ? AND status = 'unresolved'
                ORDER BY updated_at DESC LIMIT 1
                """,
                (conversation_id,),
            ).fetchone()
            if ep:
                updated_desc = f"{ep['original_description']} | Cause identified: {cause_description}"[:500]
                conn.execute(
                    """
                    UPDATE problem_episodes
                    SET original_description = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (updated_desc, now_iso, ep["id"]),
                )
                return True
        return False

    def _classify_multilingual_intent_and_entity(
        self,
        raw_message: str,
        conversation_history: list[dict],
    ) -> Optional[dict[str, Any]]:
        """
        Multilingual semantic classifier powered by Groq LLM.
        Understands regional Indian languages (Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Bengali, Urdu, Hinglish, code-switching),
        unfamiliar equipment, informal phrasing, and grammatical mistakes.
        """
        prompt = (
            "You are a semantic analyzer for RecallOps equipment troubleshooting assistant.\n"
            "Analyze the user message (which may be in English, Hindi, Kannada, Tamil, Telugu, Bengali, Marathi, Urdu, Hinglish, or code-switching) "
            "and return a JSON object with EXACTLY these keys:\n"
            "{\n"
            '  "intent": "TROUBLESHOOTING_QUERY" | "PROBLEM_EXPLANATION_OR_CAUSE" | "REPORT_OUTCOME" | "CASUAL_GREETING" | "CASUAL_CONVERSATION" | "GENERAL_CAPABILITIES_INQUIRY" | "UNRELATED_QUERY" | "HISTORICAL_MEMORY_QUERY",\n'
            '  "equipment": string or null (Standard English name of equipment, e.g. "Commercial Mixer Grinder", "Gas Stove", "Centrifugal Slurry Pump", "Workstation Laptop", "Television"),\n'
            '  "category": "industrial" | "household" | "electronic" | null,\n'
            '  "symptom": string or null (Brief English description of symptom or malfunction),\n'
            '  "detected_language": string (e.g. "Hindi", "Kannada", "Hinglish", "Kannada-English", "Tamil", "Telugu", "English", "Urdu"),\n'
            '  "is_equipment_troubleshooting": boolean\n'
            "}\n"
            "Return ONLY the valid JSON object, no markdown, no other text."
        )

        context_lines = []
        if conversation_history:
            for m in conversation_history[-3:]:
                if m.get("role") in ("user", "assistant"):
                    context_lines.append(f"{m['role'].upper()}: {m['content']}")

        user_payload = f"USER MESSAGE: \"{raw_message}\""
        if context_lines:
            user_payload = "RECENT CONVERSATION CONTEXT:\n" + "\n".join(context_lines) + f"\n\nCURRENT USER MESSAGE: \"{raw_message}\""

        try:
            content, _ = groq_service.create_chat_completion(
                messages=[{"role": "system", "content": prompt}, {"role": "user", "content": user_payload}],
                temperature=0.0,
                max_tokens=300,
                response_format={"type": "json_object"},
            )
            clean = content.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            parsed = json.loads(clean)
            return parsed
        except Exception as e:
            logger.warning("Multilingual LLM classification failed: %s", e)
            return None

    def classify_intent_and_entities(

        self,
        raw_message: str,
        conversation_history: list[dict],
        user_scope: str = "default_user",
    ) -> dict[str, Any]:
        """
        Calibrated semantic intent classification and entity extraction.
        Executes BEFORE memory retrieval and guarantees strict context isolation.
        """
        lower = raw_message.lower().strip()
        words = re.findall(r'\b[a-zA-Z0-9_-]+\b', lower)
        address_tokens = {
            "recallops", "recall", "ops", "assistant", "bot", "ai", "there",
            "friend", "bro", "broo", "bhai", "yaar", "ji", "sir", "madam", "dear", "agent", "yaa", "yeah"
        }
        stripped_words = [w for w in words if w not in address_tokens]
        stripped_text = " ".join(stripped_words).strip()

        # Check if there is an active equipment context in the conversation history
        prev_equipment: Optional[dict[str, Any]] = None
        for m in reversed(conversation_history):
            m_meta = m.get("metadata", {})
            eq = m_meta.get("equipment_detected")
            if eq and isinstance(eq, dict) and eq.get("equipment_type"):
                prev_equipment = eq
                break

        # Detect equipment directly in message
        detected_equipment = detect_equipment_entity(raw_message)

        # 5b. Problem Explanation, Realization, or Resolution in multi-turn
        # E.g.: "cylinder got over", "battery died", "volume was muted on my phone",
        # "hdmi cable was loose", "set timer instead of cook time", "emergency stop was pressed",
        # "balance slider was all the way left", "switch off tha adapter ka bhai"
        cause_keywords = [
            "got over", "ran out", "is empty", "was empty", "empty cylinder", "cylinder empty",
            "gas empty", "empty gas", "gas over", "cylinder over", "khatam ho gaya", "khatam ho gayi",
            "khatam", "chala gaya", "battery died", "battery dead", "dead battery", "battery drained",
            "battery ran out", "battery down", "power cut", "power was out", "power went out",
            "light chali gayi", "breaker tripped", "fuse blew", "fuse blown", "unplugged",
            "cord was unplugged", "plug came out", "wire was loose", "plug was loose",
            "water shut off", "tank empty", "tank is empty", "no fuel", "ran out of fuel",
            "valve closed", "valve was shut", "regulator off", "switch was off", "switch is off", "switch band tha",
            # Audio, volume & phone / device settings
            "volume was muted", "volume is muted", "was muted", "is muted", "muted", "mute",
            "on mute", "volume was down", "volume down", "volume at zero", "turned down", "silent mode",
            "airplane mode", "do not disturb",
            # Cable & connection
            "loose cable", "loose hdmi", "cable was loose", "hdmi was loose", "hdmi cable was loose",
            "cable loose", "hdmi loose", "not plugged in", "wasn't plugged in", "plugged it back",
            "loosely connected", "disconnected cable", "loose wire", "wire loose",
            # Settings, timers, modes
            "timer instead of cook time", "set the timer", "timer was set", "wrong setting",
            "wrong mode", "wrong input", "timer mode",
            # Controls, Emergency Stop
            "emergency stop", "e-stop", "emergency stop button", "accidentally pressed",
            "stop button was pressed", "estop pressed", "operator pressed", "stop pressed",
            # Audio sliders & balance
            "balance slider", "audio balance", "sound balance", "slider was all the way",
            "balance was left", "balance was right", "all the way to the left", "all the way to the right",
            # Hinglish & colloquial
            "switch off tha", "switch band tha", "adapter switch", "switch off tha adapter ka bhai",
            "switch off tha bhai", "power button off tha", "arre switch off tha", "band tha", "off tha",
            "chalu nahi tha", "on nahi tha", "bhool gaya tha"
        ]

        realization_cues = [
            "i just realized", "just realized", "i realized", "i noticed", "turns out", "it turns out",
            "found out", "it was just", "actually it was", "actually it", "looks like it was",
            "my bad", "never mind", "oh wait", "wait bro", "yaa bro", "yeah bro", "bro wait",
            "bro haha", "haha", "😂", "lol", "my mistake", "silly mistake"
        ]

        has_cause_indication = (
            any(phrase in lower for phrase in cause_keywords)
            or (
                any(r in lower for r in realization_cues)
                and (
                    len(conversation_history) > 0
                    or prev_equipment is not None
                    or any(w in lower for w in [
                        "phone", "volume", "mute", "cable", "hdmi", "timer", "stop", "button",
                        "switch", "adapter", "slider", "setting", "cylinder", "gas", "battery",
                        "plug", "power", "cord", "wire"
                    ])
                )
            )
            or (
                any(w in words for w in [
                    "cylinder", "gas", "battery", "plug", "cord", "breaker", "fuse", "power",
                    "fuel", "tank", "valve", "volume", "sound", "cable", "hdmi", "switch",
                    "adapter", "slider", "timer", "stop"
                ])
                and any(w in words for w in [
                    "over", "empty", "dead", "died", "drained", "blown", "tripped", "loose",
                    "unplugged", "off", "cut", "khatam", "finished", "ended", "muted", "mute",
                    "down", "pressed", "zero", "left", "right"
                ])
                and not any(w in words for w in ["switching", "switches", "shutting", "tripping"])
            )
            or (
                any(lower.startswith(p) for p in [
                    "it turns out", "turns out", "actually it", "the reason is", "reason is",
                    "i found out", "looks like it was", "it was just", "yaa broo", "yeah bro",
                    "bro ", "oh wait", "oh haha", "my bad", "never mind", "arre "
                ])
                and any(w in lower for w in [
                    "cylinder", "gas", "battery", "power", "plug", "wire", "switch", "fuel",
                    "empty", "over", "dead", "off", "khatam", "muted", "mute", "volume", "phone",
                    "cable", "hdmi", "timer", "stop", "pressed", "adapter", "slider"
                ])
            )
        )

        is_explanation_or_cause = bool(
            has_cause_indication
            and (len(conversation_history) > 0 or prev_equipment is not None or detected_equipment is not None)
        )

        # Topic switch detection: User deliberately transitions to a different equipment problem
        is_topic_switch = bool(
            prev_equipment
            and detected_equipment
            and detected_equipment["equipment_type"] != prev_equipment["equipment_type"]
            and detected_equipment.get("matched_keyword") not in {
                "phone", "smartphone", "cable", "wire", "switch", "socket", "battery", "charger", "cord", "button", "lock", "adapter"
            }
            and any(w in lower for w in ["now my", "also my", "other", "another", "keeps", "unexpectedly", "not working", "broken", "vibrating", "stopped", "stuck", "won't", "wont"])
        )
        if is_topic_switch:
            is_explanation_or_cause = False

        # Contextual entity preservation: In an active troubleshooting thread, auxiliary items
        # (phone, smartphone, cable, wire, switch, socket, battery, charger, cord, button, adapter)
        # mentioned during an explanation or follow-up do not replace the primary equipment being troubleshot.
        if prev_equipment and not is_topic_switch:
            auxiliary_keywords = {"phone", "smartphone", "cable", "wire", "switch", "socket", "battery", "charger", "cord", "button", "lock", "adapter"}
            if is_explanation_or_cause or (detected_equipment and detected_equipment.get("matched_keyword") in auxiliary_keywords):
                detected_equipment = prev_equipment

        # 1. Casual social conversation, chitchat & greetings
        # Strict context isolation: Zero memory calls, zero diagnostic boilerplate
        casual_greetings = [
            "hello", "hi", "hey", "howdy", "greetings", "good morning",
            "good afternoon", "good evening", "good night", "what's up", "whats up",
            "sup", "yo", "namaste", "namaskar", "pranam", "salaam", "salam",
            "kaise ho", "kya haal hai", "kya haal", "subah bakhair", "ram ram"
        ]
        is_greeting = (
            not is_explanation_or_cause
            and (
                stripped_text in casual_greetings
                or any(stripped_text.startswith(g + " ") for g in casual_greetings)
                or any(
                    lower == g or lower.startswith(g + " ") or lower.startswith(g + "!") or lower.startswith(g + ",") or lower.startswith(g + ".")
                    for g in casual_greetings
                )
                or any(lower.endswith(" " + g) for g in casual_greetings)
            )
            and len(stripped_words) <= 3
        )

        casual_social_patterns = [
            "how are you", "how are you doing", "how r u", "how are u", "how is it going",
            "how's it going", "hows it going", "how do you do", "hope you are well",
            "how's your day", "how is your day",
            "what did you eat", "did you eat", "what's your favorite food", "what did you have for", "what do you eat",
            "do you have a girlfriend", "do you have a boyfriend", "are you single", "do you love me",
            "marry me", "who is your crush", "are you married",
            "what is your name", "what's your name", "who are you", "tell me about yourself",
            "who made you", "who created you", "who built you",
            "tell me a joke", "make me laugh", "say something funny",
            "how is the weather", "what's the weather", "what is the weather",
            "good to see you", "nice to meet you"
        ]
        is_social = any(phrase in lower for phrase in casual_social_patterns)

        # 2. General capabilities and help inquiry
        capabilities_patterns = [
            "what is recallops", "who is recallops", "what can you do", "what do you do",
            "what can recallops do", "how can you help", "how can you help me", "can you help me",
            "how does this work", "how does recallops work", "help me understand what you do",
            "what are your features", "what are your capabilities", "tell me what you can do",
            "what do you know", "how to use recallops", "what are you for", "who are you and what do you do"
        ]
        is_capabilities_query = (
            not is_explanation_or_cause
            and (
                any(phrase in lower for phrase in capabilities_patterns)
                or stripped_text in ("help", "help me", "what can you do", "what do you do", "can you help")
            )
        )

        # 3. Unrelated general knowledge, programming, geography, trivia, politics
        unrelated_patterns = [
            "what is python", "what is javascript", "what is java", "what is c++", "what is rust",
            "how to write python", "how to code", "write a python", "write a function", "how to write code",
            "what is react", "what is html", "what is css", "what is sql", "what is git",
            "what is the capital of france", "capital of france", "capital of germany", "capital of india",
            "capital of italy", "capital of spain", "capital of", "who was napoleon", "who was albert einstein",
            "who is the president", "who is the prime minister", "who is prime minister",
            "who won the world cup", "where is paris", "where is london", "where is tokyo",
            "how to bake a cake", "how to make pasta", "recipe for", "how to cook",
            "what is 2 + 2", "what is 2+2", "calculate ", "solve this equation",
            "what is photosynthesis", "why is the sky blue", "speed of light"
        ]
        is_unrelated = (
            not is_explanation_or_cause
            and (
                any(p in lower for p in unrelated_patterns)
                or (
                    (lower.startswith("what is ") or lower.startswith("who is ") or lower.startswith("where is ") or lower.startswith("when is ") or lower.startswith("how to "))
                    and not any(eq in lower for eq in ["pump", "motor", "compressor", "oven", "mixer", "laptop", "bearing", "seal", "valve", "fan", "boiler", "cavitation", "impeller", "stator", "rotor", "machine", "device", "appliance", "equipment", "screen", "battery", "charger", "stove", "cylinder"])
                    and any(w in lower for w in ["python", "france", "paris", "europe", "math", "code", "programming", "capital", "president", "prime minister", "minister", "cake", "pasta", "recipe", "history", "delhi", "washington", "london", "tokyo", "asia", "america", "africa"])
                )
            )
        )

        # 4. Gratitude / Acknowledgment
        acknowledgment_patterns = [
            "thank you", "thanks", "thx", "thank u", "appreciate it", "great thanks",
            "ok thanks", "got it", "perfect", "awesome", "understood", "okay thanks", "ok thank you"
        ]
        is_acknowledgment = any(
            lower == a or lower.startswith(a + " ") or lower.startswith(a + "!") or lower.startswith(a + ".")
            for a in acknowledgment_patterns
        )

        # 5. Repair Outcome Reporting (English + Hindi / Hinglish + Colloquial)
        outcome_action_cues = [
            "replaced", "technician fixed", "technician replaced", "technician cleaned", "technician serviced",
            "technician adjusted", "technician aligned", "technician inspected", "technician repaired",
            "cleaned cooling fins", "cleaned the cooling fins", "cleaned the fins", "cleaned fins",
            "cooling fins cleaned", "now working", "now it works", "now the pump works", "works normally",
            "working normally", "running normally", "runs normally", "did not work", "failed to fix",
            "fixed it", "repaired by", "outcome was", "problem resolved", "solved the issue",
            "didn't work", "still not working", "service technician", "we replaced", "we changed",
            "we cleaned", "we fixed", "we swapped", "swapped the", "problem continued", "overheating continued", "vibration continued",
            "still overheats", "it still overheats", "repair didn't work", "the repair didn't work",
            "problem persisted", "issue persisted", "vibration persisted", "overheating persisted",
            "still happening", "still overheating", "still vibrating", "still broken", "remained faulty",
            "opening perfectly", "now it opens", "now opens", "opens normally", "now opening normally",
            "replaced the springs", "replaced springs", "changed the springs", "changed springs"
        ]
        hinglish_outcome_cues = [
            "change kar diya", "badal diya", "badal di", "theek kar diya", "theek ho gaya",
            "thik kar diya", "thik ho gaya", "sahi kar diya", "sahi ho gaya", "sahi chal raha",
            "sahi chal rahi", "ab sahi chal raha", "chalne laga", "mast chal raha", "kaam kar raha",
            "ab theek hai", "nahi chala", "kaam nahi kiya", "thik nahi hua", "waisa hi hai",
            "problem solve nahi", "kharab hi hai", "spring change"
        ]
        is_outcome_report = (
            any(phrase in lower for phrase in outcome_action_cues)
            or any(phrase in lower for phrase in hinglish_outcome_cues)
            or (
                any(w in lower for w in ["technician", "mechanic", "engineer", "electrician", "maintenance", "crew", "team", "operator", "i", "we"])
                and any(w in lower for w in ["cleaned", "replaced", "aligned", "fixed", "adjusted", "serviced", "swapped", "repaired", "tightened", "changed"])
            )
            or (
                any(w in lower for w in ["now works", "works normally", "works again", "opening perfectly", "problem continued", "issue persisted", "vibration persisted", "still overheats", "still vibrating", "didn't solve", "didn't work"])
            )
        )

        # 6. Historical Memory Inquiries
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
            any(phrase in lower for phrase in hist_phrases)
            or (
                any(w in lower for w in ["happen", "occur", "seen", "worked", "failed", "fixed", "done", "record", "history", "precedent", "experience"])
                and any(w in lower for w in ["before", "previously", "last time", "prior", "past", "earlier", "history"])
            )
        )

        # 7. Follow-ups
        is_simplify = any(phrase in lower for phrase in [
            "simpler words", "simpler terms", "explain that more simply", "explain more simply",
            "can you explain in simpler", "explain in simpler", "plain english", "too technical",
            "dumb it down", "make it simpler", "eli5", "in simpler words", "simpler"
        ]) and not is_historical_memory_query

        is_technician_question = any(phrase in lower for phrase in [
            "ask my technician", "ask the technician", "questions should i ask",
            "what should i ask my technician", "what specific questions", "what to ask the technician",
            "what should i tell the technician", "tell my technician", "questions for the technician"
        ]) and not is_historical_memory_query

        is_why_or_how = any(phrase in lower for phrase in [
            "why might that happen", "why does it", "why do they", "why would that happen",
            "how do you know", "why does that cause", "what causes that", "why is that",
            "can you elaborate", "could it be"
        ]) and not is_historical_memory_query

        # 8. Concept queries
        is_concept_query = any(lower.startswith(p) for p in [
            "what is a ", "what is an ", "how does a ", "how does an ", "how does ", "define "
        ]) and any(w in lower for w in ["pump", "motor", "compressor", "oven", "mixer", "bearing", "seal", "valve", "fan", "boiler", "cavitation", "impeller", "stator", "rotor"])

        # Check for ambiguity cues in multi-turn
        has_ambiguity_cue = any(phrase in lower for phrase in ["which one", "both of them", "which machine", "either of them"])

        # Check for ambiguous standalone cries for help without equipment
        is_ambiguous_standalone = (
            detected_equipment is None
            and not is_greeting
            and not is_social
            and not is_capabilities_query
            and not is_unrelated
            and not is_acknowledgment
            and not is_outcome_report
            and not is_explanation_or_cause
            and not is_historical_memory_query
            and not is_simplify
            and not is_technician_question
            and not is_why_or_how
            and not is_concept_query
            and any(phrase in lower for phrase in [
                "it's not working", "it is not working", "it stopped", "something is broken",
                "something is wrong", "help me fix it", "can you fix this", "it is broken",
                "it won't work", "it doesn't work", "not working", "machine problem",
                "equipment problem", "having an issue", "need help with this"
            ])
            and not any(eq in lower for eq in [
                "pump", "motor", "compressor", "oven", "mixer", "fan", "laptop", "pc",
                "umbrella", "window", "power bank", "bike", "bicycle", "door", "lock", "dishwasher",
                "toaster", "kettle", "blender", "vacuum", "heater", "chiller", "boiler", "conveyor", "ac",
                "stove", "cylinder", "tv", "television", "speaker", "camera", "dashcam", "headphone", "headphones", "monitor"
            ])
            and len(conversation_history) == 0
        )

        # Multilingual semantic understanding (Hindi, Kannada, Tamil, Telugu, Hinglish, etc.)
        script_lang = identify_script_or_vernacular_language(raw_message)
        is_indic = detect_indic_or_vernacular(raw_message)
        detected_language = script_lang or "English"
        multilingual_parsed: Optional[dict[str, Any]] = None

        if is_indic or (detected_equipment is None and not is_greeting and not is_social and not is_capabilities_query and not is_unrelated and not is_acknowledgment):
            multilingual_parsed = self._classify_multilingual_intent_and_entity(raw_message, conversation_history)
            if multilingual_parsed:
                detected_language = multilingual_parsed.get("detected_language") or script_lang or ("Hindi" if is_indic else "English")
                if multilingual_parsed.get("equipment") and not detected_equipment:
                    detected_equipment = {
                        "equipment_type": multilingual_parsed["equipment"],
                        "category": multilingual_parsed.get("category", "household"),
                        "matched_keyword": raw_message,
                    }
            elif script_lang and not detected_equipment and any(w in raw_message.lower() for w in ["mixie", "mixy", "मिक्सी", "ಮಿಕ್ಸಿ", "மிக்ஸி", "మిక్సీ"]):
                detected_equipment = {
                    "equipment_type": "Commercial Mixer Grinder",
                    "category": "household",
                    "matched_keyword": "mixie",
                }

        # Final intent determination with strict semantic precedence
        if is_social:
            intent = "CASUAL_CONVERSATION"
        elif is_greeting:
            intent = "CASUAL_GREETING"
        elif is_capabilities_query:
            intent = "GENERAL_CAPABILITIES_INQUIRY"
        elif is_unrelated:
            intent = "UNRELATED_QUERY"
        elif is_acknowledgment:
            intent = "ACKNOWLEDGMENT"
        elif is_ambiguous_standalone:
            intent = "AMBIGUOUS_QUERY"
        elif has_ambiguity_cue and len(conversation_history) > 1:
            intent = "CLARIFICATION_NEEDED"
        elif is_explanation_or_cause or (multilingual_parsed and multilingual_parsed.get("intent") == "PROBLEM_EXPLANATION_OR_CAUSE"):
            intent = "PROBLEM_EXPLANATION_OR_CAUSE"
            if not detected_equipment and prev_equipment:
                detected_equipment = prev_equipment
        elif is_outcome_report or (multilingual_parsed and multilingual_parsed.get("intent") == "REPORT_OUTCOME"):
            intent = "REPORT_OUTCOME"
        elif is_historical_memory_query or (multilingual_parsed and multilingual_parsed.get("intent") == "HISTORICAL_MEMORY_QUERY"):
            intent = "HISTORICAL_MEMORY_QUERY"
        elif is_simplify:
            intent = "FOLLOWUP_SIMPLIFY"
        elif is_technician_question:
            intent = "FOLLOWUP_TECHNICIAN_QUESTIONS"
        elif is_why_or_how:
            intent = "FOLLOWUP_WHY_OR_HOW"
        elif is_concept_query:
            intent = "CONCEPT_EXPLANATION"
        elif multilingual_parsed and (multilingual_parsed.get("intent") == "TROUBLESHOOTING_QUERY" or multilingual_parsed.get("is_equipment_troubleshooting")):
            intent = "TROUBLESHOOTING_QUERY"
            if not detected_equipment and prev_equipment:
                detected_equipment = prev_equipment
        elif detected_equipment or any(kw in lower for kw in ["problem", "broken", "issue", "fault", "not working", "won't", "stops", "stopped", "stalled", "vibrat", "overheat", "noise", "loud", "leak", "smoke", "creak", "creaking", "stuck"]):
            intent = "TROUBLESHOOTING_QUERY"
        elif prev_equipment and any(w in lower for w in ["what", "how", "why", "when", "can", "could", "should", "is", "are", "do", "does", "test", "check", "fix"]):
            intent = "FOLLOWUP_QUESTION"
            detected_equipment = prev_equipment
        elif multilingual_parsed and multilingual_parsed.get("intent"):
            intent = multilingual_parsed["intent"]
        else:
            intent = "GENERAL_CAPABILITIES_INQUIRY"

        return {
            "intent": intent,
            "detected_equipment": detected_equipment,
            "is_outcome_report": is_outcome_report or (intent == "REPORT_OUTCOME"),
            "is_historical_memory_query": is_historical_memory_query or (intent == "HISTORICAL_MEMORY_QUERY"),
            "detected_language": detected_language,
        }


    def search_local_memories(
        self,
        query: str,
        equipment_type: Optional[str] = None,
        outcome_status: Optional[str] = None,
        limit: int = 15,
        user_id: Optional[str] = None,
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
                    v.id, v.user_id as verification_user_id, v.incident_id, i.user_id as incident_user_id,
                    i.machine_id, i.equipment_type, i.symptoms, r.action_taken, r.parts_replaced,
                    v.outcome_status, v.inspection_notes, v.verified_by,
                    v.verified_at, v.hindsight_retained, v.hindsight_document_id,
                    v.sync_status
                FROM outcome_verifications v
                JOIN incidents i ON v.incident_id = i.id
                LEFT JOIN repairs r ON v.incident_id = r.incident_id
                WHERE 1=1
            """
            params: list[Any] = []
            if user_id:
                if user_id == "demo_user":
                    sql += " AND (v.user_id = ? OR i.user_id = ? OR i.is_demo = 1)"
                    params.extend([user_id, user_id])
                else:
                    sql += " AND (v.user_id = ? OR i.user_id = ?)"
                    params.extend([user_id, user_id])
            else:
                # If no user_id supplied, only match non-private demo records
                sql += " AND (i.is_demo = 1 AND v.user_id IS NULL AND i.user_id IS NULL)"

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
                    sync_status=r["sync_status"] or "local_only",
                )
            )
        return results

    def get_memory_by_id(self, memory_id: str, user_id: Optional[str] = None) -> Optional[MemoryItemResponse]:
        with get_db() as conn:
            r = conn.execute(
                """
                SELECT 
                    v.id, v.user_id as verification_user_id, v.incident_id, i.user_id as incident_user_id,
                    i.machine_id, i.equipment_type, i.is_demo,
                    i.symptoms, r.action_taken, r.parts_replaced,
                    v.outcome_status, v.inspection_notes, v.verified_by,
                    v.verified_at, v.hindsight_retained, v.hindsight_document_id,
                    v.sync_status
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
            if user_id:
                owner = r["verification_user_id"] or r["incident_user_id"]
                if owner and owner != user_id:
                    return None
                if owner is None and not r["is_demo"] and user_id != "demo_user":
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
                sync_status=r["sync_status"] or "local_only",
            )

    def retrieve_precedents(
        self,
        query: str,
        mock_mode: bool = True,
        equipment_type: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> list[PrecedentRecord]:
        """Retrieve historical precedents with multi-symptom relevance ranking and outcome diversity under user isolation."""
        precedents: list[PrecedentRecord] = []

        # LIVE HINDSIGHT RECALL: only if mock_mode is explicitly False AND config permits
        if not mock_mode and not settings.HINDSIGHT_MOCK_MODE:
            try:
                logger.info("Executing deliberate live Hindsight recall for: '%s' (user=%s)", query, user_id)
                recalled = hindsight_service.recall_memories(query=query, budget="low", max_tokens=1024, user_id=user_id)
                for item in recalled:
                    text = item.get("text", "")
                    doc_id = item.get("document_id") or "HINDSIGHT-DOC"

                    # 1. Parse structured fields from retained document if present
                    m_mid = re.search(r'Machine ID:\s*([^\n]+)', text, re.IGNORECASE)
                    parsed_machine_id = m_mid.group(1).strip() if m_mid else doc_id.replace("OUTCOME-", "").replace("HACKATHON-VERIFIED-", "")

                    m_eq = re.search(r'Equipment Type:\s*([^\n]+)', text, re.IGNORECASE)
                    parsed_eq = m_eq.group(1).strip() if m_eq else (equipment_type or "Industrial Equipment")

                    # 2. Strict Cross-Equipment Isolation Check
                    # Disallow pump records leaking into laptops, ovens, or mismatched equipment
                    if equipment_type and parsed_eq:
                        eq_tokens = [t for t in re.split(r'\W+', equipment_type.lower()) if len(t) >= 4]
                        mem_tokens = [t for t in re.split(r'\W+', parsed_eq.lower()) if len(t) >= 4]
                        if eq_tokens and mem_tokens and not any(t in mem_tokens for t in eq_tokens) and not any(t in eq_tokens for t in mem_tokens):
                            logger.info("Prevented cross-equipment contamination: dropped memory for '%s' during '%s' query", parsed_eq, equipment_type)
                            continue

                    m_act = re.search(r'Repair Action:\s*([^\n]+)', text, re.IGNORECASE)
                    parsed_action = m_act.group(1).strip() if m_act else "Verified repair action from Hindsight Cloud"

                    m_sym = re.search(r'Reported Symptoms:\s*([^\n]+)', text, re.IGNORECASE)
                    parsed_symptoms = m_sym.group(1).strip() if m_sym else query

                    m_out = re.search(r'Verified Outcome:\s*([^\n]+)', text, re.IGNORECASE)
                    if m_out:
                        raw_o = m_out.group(1).strip().upper()
                        outcome_status = "UNSUCCESSFUL" if "UNSUCCESSFUL" in raw_o else "SUCCESSFUL"
                    else:
                        outcome_status = "UNSUCCESSFUL" if "UNSUCCESSFUL" in text.upper() else "SUCCESSFUL"

                    m_notes = re.search(r'Inspection Notes:\s*([^\n]+)', text, re.IGNORECASE)
                    parsed_notes = m_notes.group(1).strip() if m_notes else text[:250]

                    precedents.append(
                        PrecedentRecord(
                            id=doc_id,
                            machine_id=parsed_machine_id,
                            equipment_type=parsed_eq,
                            symptoms=parsed_symptoms,
                            action_taken=parsed_action,
                            outcome_status=outcome_status,
                            verification_status="TECHNICIAN_CONFIRMED",
                            inspection_notes=parsed_notes,
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
        local_results = self.search_local_memories(query=query, equipment_type=equipment_type, limit=8, user_id=user_id)

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

    def process_chat(self, req: ChatRequest, user_id: Optional[str] = None) -> ChatResponse:
        """Handle conversational troubleshooting with Groq reasoning and Hindsight memory integration under user isolation."""
        raw_message = req.message.strip()
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Ensure conversation exists and belongs to the authenticated user
        conv_id = req.conversation_id
        if not conv_id:
            # Auto-title based on first 35 chars of prompt
            clean_title = (raw_message[:35] + "...") if len(raw_message) > 35 else raw_message
            conv_data = self.create_conversation(title=clean_title, user_id=user_id)
            conv_id = conv_data["id"]
        else:
            with get_db() as conn:
                conv = conn.execute("SELECT id, user_id FROM conversations WHERE id = ?", (conv_id,)).fetchone()
                if not conv or (user_id and conv["user_id"] and conv["user_id"] != user_id):
                    # Conversation missing or owned by another user -> create new conversation for authenticated user
                    clean_title = (raw_message[:35] + "...") if len(raw_message) > 35 else raw_message
                    conv_data = self.create_conversation(title=clean_title, user_id=user_id)
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

        # 3. Semantic Intent Classification & Entity Extraction (Executed FIRST)
        lower_msg = raw_message.lower().strip()
        classification = self.classify_intent_and_entities(raw_message, conversation_history, user_scope=user_id or "default_user")
        intent = classification["intent"]
        matched_equipment_current = classification["detected_equipment"]
        is_historical_memory_query = classification["is_historical_memory_query"]
        is_outcome_report = classification["is_outcome_report"]
        user_language = classification.get("detected_language", "English")
        if any(w in lower_msg for w in ["in english", "speak in english", "talk in english", "english please", "can you speak in english", "answer in english"]):
            user_language = "English"
        elif user_language == "English":
            for m in reversed(conversation_history[-4:]):
                m_meta = m.get("metadata", {})
                m_lang = m_meta.get("detected_language")
                if m_lang and m_lang != "English" and (detect_indic_or_vernacular(raw_message) or len(raw_message.split()) <= 4):
                    user_language = m_lang
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
                if eq["equipment_type"] not in recent_equipments_discussed:
                    recent_equipments_discussed.append(eq["equipment_type"])
            raw_precs = m_meta.get("retrieved_precedents", [])
            if raw_precs and not prev_precedents:
                prev_precedents = [PrecedentRecord(**p) if isinstance(p, dict) else p for p in raw_precs]

        # 4. Context Resolution with Strict Isolation for Casual / Unrelated Queries
        equipment_switched = False
        is_followup = False
        detected_hazard: Optional[str] = None
        active_equipment: Optional[dict[str, Any]] = None

        is_followup_turn = intent.startswith("FOLLOWUP_") or intent in ("HISTORICAL_MEMORY_QUERY", "HISTORY_QUERY", "PROBLEM_EXPLANATION_OR_CAUSE")

        NON_EQUIPMENT_INTENTS = (
            "CASUAL_CONVERSATION",
            "CASUAL_GREETING",
            "GENERAL_CAPABILITIES_INQUIRY",
            "GENERAL_INQUIRY",
            "UNRELATED_QUERY",
            "ACKNOWLEDGMENT",
            "AMBIGUOUS_QUERY",
            "CLARIFICATION_NEEDED",
        )

        if intent in NON_EQUIPMENT_INTENTS:
            # STRICT ISOLATION: Zero context leakage from earlier machinery questions
            active_equipment = None
            detected_equipment = None
            detected_hazard = None
            is_followup = False
        elif intent == "CLARIFICATION_NEEDED":
            active_equipment = prev_equipment
            detected_equipment = prev_equipment
        elif intent == "PROBLEM_EXPLANATION_OR_CAUSE":
            active_equipment = prev_equipment or matched_equipment_current
            detected_equipment = active_equipment
            is_followup = True
        elif prev_equipment and is_followup_turn:
            # Explicit follow-up questions always inherit previous equipment context
            active_equipment = prev_equipment
            detected_equipment = active_equipment
            is_followup = True
        elif matched_equipment_current:
            if prev_equipment and prev_equipment["equipment_type"].lower() != matched_equipment_current["equipment_type"].lower():
                equipment_switched = True
                active_equipment = matched_equipment_current
            else:
                active_equipment = matched_equipment_current
            detected_equipment = active_equipment
        elif prev_equipment and intent not in ("REPORT_OUTCOME",):
            active_equipment = prev_equipment
            detected_equipment = active_equipment
            is_followup = True
        else:
            active_equipment = None
            detected_equipment = None

        # 5. Safety Hazard Determination (suppressed for casual, unrelated, or history queries)
        if active_equipment and intent not in NON_EQUIPMENT_INTENTS and intent not in ("HISTORICAL_MEMORY_QUERY",):
            category = active_equipment.get("category", "industrial")
            detected_hazard = self._get_device_appropriate_hazard(category, raw_message)

        # 6. Precedent Retrieval with Zero Memory Call Guarantee for Casual & Unrelated Queries
        mock_mode = req.mock_memory if req.mock_memory is not None else settings.HINDSIGHT_MOCK_MODE
        active_precedents: list[PrecedentRecord] = []

        if intent in NON_EQUIPMENT_INTENTS:
            # ZERO MEMORY CALLS: Do not query local database or Hindsight Cloud
            active_precedents = []
            retrieved_precedents_for_response = []
        elif (is_historical_memory_query or intent in ("HISTORICAL_MEMORY_QUERY", "HISTORY_QUERY")) and prev_precedents:
            active_precedents = prev_precedents
            retrieved_precedents_for_response = active_precedents
        elif is_historical_memory_query or intent in ("TROUBLESHOOTING_QUERY", "HISTORICAL_MEMORY_QUERY", "HISTORY_QUERY"):
            eq_type = active_equipment["equipment_type"] if active_equipment else (matched_equipment_current["equipment_type"] if matched_equipment_current else None)
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
                user_id=user_id,
            )
            retrieved_precedents_for_response = active_precedents
        elif is_followup:
            active_precedents = prev_precedents
            retrieved_precedents_for_response = []
        else:
            active_precedents = []
            retrieved_precedents_for_response = []

        # 7. Outcome Fact Extraction with Cross-Conversation Episode Linking
        outcome_to_record: Optional[dict[str, Any]] = None
        if intent == "REPORT_OUTCOME":
            failure_cues = [
                "didn't work", "did not work", "failed", "unsuccessful", "still broken",
                "still not working", "failed to fix", "still faulty", "problem continued",
                "continued", "persisted", "issue persisted", "problem persisted",
                "still overheats", "it still overheats", "still overheating", "still vibrating", "still vibrates",
                "still loud", "still making noise", "no change", "didn't solve",
                "did not solve", "repair didn't work", "the repair didn't work",
                "still not fixed", "didn't help", "did not help", "without success",
                "didn't fix", "did not fix", "remained faulty", "nahi chala", "thik nahi hua", "kharab hi hai"
            ]
            is_success = not any(neg in lower_msg for neg in failure_cues)
            is_tech = any(w in lower_msg for w in ["technician", "electrician", "mechanic", "engineer", "service center", "service person"])
            is_audit = any(w in lower_msg for w in ["certified audit", "iso audit", "lead engineer audit", "third party inspection", "independently verified"])

            verif_status = "INDEPENDENTLY_VERIFIED" if is_audit else "TECHNICIAN_CONFIRMED" if is_tech else "USER_REPORTED"
            verif_source = "Certified Independent Audit" if is_audit else "Technician Field Report" if is_tech else "Operator Field Report"

            # Cross-Conversation Episode Search: Match prior problem episode in SQLite
            eq_name_to_search = (
                matched_equipment_current["equipment_type"]
                if matched_equipment_current
                else (prev_equipment["equipment_type"] if prev_equipment else None)
            )
            matched_episode = self.find_matching_problem_episode(
                equipment_name=eq_name_to_search,
                text=raw_message,
                user_scope=user_id or "default_user",
                conversation_id=conv_id,
            )

            linked_episode_id: Optional[str] = None
            if matched_episode:
                eq_name = matched_episode["equipment_name"]
                original_symptoms = matched_episode["symptoms"]
                linked_episode_id = matched_episode["id"]
                active_equipment = {
                    "equipment_type": eq_name,
                    "category": matched_episode.get("equipment_category", "household"),
                    "matched_keyword": eq_name.lower(),
                }
                detected_equipment = active_equipment
            else:
                eq_name = (
                    matched_equipment_current["equipment_type"]
                    if matched_equipment_current
                    else (prev_equipment["equipment_type"] if prev_equipment else (active_equipment["equipment_type"] if active_equipment else "General Equipment"))
                )
                original_symptoms = "Reported equipment issue from session"
                for m in conversation_history:
                    if m["role"] == "user":
                        user_text = m["content"]
                        if any(w in user_text.lower() for w in ["stopped", "vibrat", "overheat", "noise", "shuts off", "fan loud", "error", "problem", "fault", "won't", "creak", "stuck"]):
                            original_symptoms = user_text[:120]
                            break

            # Extract specific action phrase (English + Hinglish)
            action_phrase = raw_message
            if any(k in lower_msg for k in ["spring change", "springs change", "replaced the springs", "replaced springs"]):
                action_phrase = f"Replaced the springs in {eq_name.lower()}"
            elif any(k in lower_msg for k in ["seal change", "replaced the seal", "replaced mechanical seal"]):
                action_phrase = f"Replaced mechanical seal on {eq_name.lower()}"
            elif any(k in lower_msg for k in ["bearing change", "replaced bearings", "changed bearings"]):
                action_phrase = f"Replaced drive bearings on {eq_name.lower()}"
            elif any(k in lower_msg for k in ["cooling fins", "cleaned fins", "cleaned cooling"]):
                action_phrase = f"Cleaned blocked cooling fins on {eq_name.lower()}"
            else:
                m_act_clean = re.search(r"(?:technician|mechanic|crew|engineer|team|we|operator|i)?\s*(cleaned[^\,\.]+?)(?:\s+and\s+|\.|\,|$)", raw_message, re.IGNORECASE)
                if not m_act_clean:
                    m_act_clean = re.search(r"(?:technician|mechanic|crew|engineer|team|we|operator|i)?\s*(replaced[^\,\.]+?)(?:\s+and\s+|\.|\,|$)", raw_message, re.IGNORECASE)
                if not m_act_clean:
                    m_act_clean = re.search(r"(?:technician|mechanic|crew|engineer|team|we|operator|i)?\s*(swapped[^\,\.]+?)(?:\s+and\s+|\.|\,|$)", raw_message, re.IGNORECASE)
                if not m_act_clean:
                    m_act_clean = re.search(r"(?:technician|mechanic|crew|engineer|team|we|operator|i)?\s*(repaired[^\,\.]+?)(?:\s+and\s+|\.|\,|$)", raw_message, re.IGNORECASE)
                if not m_act_clean:
                    m_act_clean = re.search(r"(?:technician|mechanic|crew|engineer|team|we|operator|i)?\s*(serviced[^\,\.]+?)(?:\s+and\s+|\.|\,|$)", raw_message, re.IGNORECASE)
                if m_act_clean:
                    action_phrase = m_act_clean.group(1).strip()
                    action_phrase = action_phrase[0].upper() + action_phrase[1:]

            # Stable idempotency key for this detected outcome
            clean_token = re.sub(r"\W+", "", raw_message[:20]).lower()
            idempotency_key = f"IDEMP-{conv_id}-{clean_token}"

            outcome_to_record = {
                "equipment_type": eq_name,
                "symptoms": original_symptoms,
                "action_taken": action_phrase,
                "outcome_status": "SUCCESSFUL" if is_success else "UNSUCCESSFUL",
                "verification_status": verif_status,
                "verification_source": verif_source,
                "idempotency_key": idempotency_key,
                "episode_id": linked_episode_id,
                "ready_to_save": True,
            }

        # 8. Record Active Problem Episode on Troubleshooting Queries for Cross-Conversation Tracking
        if intent == "TROUBLESHOOTING_QUERY" and active_equipment:
            self.record_problem_episode(
                conversation_id=conv_id,
                equipment_name=active_equipment["equipment_type"],
                category=active_equipment.get("category", "general"),
                symptoms=raw_message,
                original_description=raw_message,
                user_scope=user_id or "default_user",
            )
        elif intent == "PROBLEM_EXPLANATION_OR_CAUSE" and active_equipment:
            self.update_problem_episode_cause(
                conversation_id=conv_id,
                equipment_name=active_equipment["equipment_type"],
                cause_description=raw_message,
            )

        # 9. Build Multi-Turn Context and Groq Prompt
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

        english_only_instruction = (
            "\n\nCRITICAL LANGUAGE OUTPUT REQUIREMENT:\n"
            "- The user may communicate in any language, including Hindi (Devanagari or Romanized), Kannada (Kannada script or Romanized), Tamil, Telugu, Hinglish, Kannada-English, or another regional Indian language.\n"
            "- You must accurately comprehend the user's problem, equipment, symptoms, causes, and intent in whatever language they communicate.\n"
            "- REGARDLESS OF THE USER'S INPUT LANGUAGE, YOU MUST ALWAYS GENERATE YOUR ENTIRE RESPONSE EXCLUSIVELY IN CLEAR, NATURAL ENGLISH.\n"
            "- Do NOT respond in Hindi, Kannada, Hinglish, or any non-English script or language.\n"
            "- All section headers ('Plausible Causes', 'Safety Alert', 'Relevant Memory Insight', 'Question for Technician'), explanations, safety instructions, and follow-up suggestions must be strictly in English."
        )

        if intent == "CLARIFICATION_NEEDED":
            clarification_options = " or ".join(recent_equipments_discussed[:2]) if len(recent_equipments_discussed) >= 2 else "the equipment"
            direct_reply = f"Before I advise you, could you please clarify whether you're asking about the {clarification_options}?"

        elif intent in ("CASUAL_CONVERSATION", "CASUAL_GREETING"):
            system_instruction = (
                "You are RecallOps — an AI troubleshooting assistant that learns from verified real-world experiences.\n"
                "The user is engaging in casual conversation or friendly greeting (asking how you are, what you ate, or a social question).\n"
                "Respond warmly, naturally, and concisely (under 35 words). "
                "Do NOT mention any previous machinery or equipment unless the user explicitly mentioned it in this turn. "
                "Do NOT use troubleshooting section headers. Invite them to let you know whenever they have an equipment or device issue to diagnose."
            ) + english_only_instruction
            groq_messages = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": raw_message},
            ]

        elif intent == "UNRELATED_QUERY":
            system_instruction = (
                "You are RecallOps — an AI troubleshooting assistant specialized in diagnosing machinery, household appliances, and electronics using verified repair history.\n"
                "The user is asking an unrelated general knowledge, coding, or trivia question.\n"
                "Politely and concisely explain that RecallOps specializes in equipment diagnostics and troubleshooting rather than general knowledge. "
                "Keep your response under 45 words. Do NOT include troubleshooting section headers or fabricate equipment symptoms."
            ) + english_only_instruction
            groq_messages = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": raw_message},
            ]


        elif intent == "ACKNOWLEDGMENT":
            system_instruction = (
                "You are RecallOps. The user is thanking or acknowledging you.\n"
                "Respond warmly and briefly (under 30 words), letting them know you are here whenever they need equipment diagnostics "
                "or verified repair advice. Do NOT include troubleshooting section headers."
            ) + english_only_instruction
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
            ) + english_only_instruction
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
            ) + english_only_instruction
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
            ) + english_only_instruction
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
            ) + english_only_instruction
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
            ) + english_only_instruction
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
            ) + english_only_instruction
            groq_messages = [{"role": "system", "content": system_instruction}]
            for m in conversation_history[-4:]:
                if m["role"] in ("user", "assistant"):
                    groq_messages.append({"role": m["role"], "content": m["content"]})
            groq_messages.append({"role": "user", "content": f"USER REPORT: \"{raw_message}\"\n{precedent_text}\nProvide your concise response acknowledging the repair outcome."})

        elif intent == "PROBLEM_EXPLANATION_OR_CAUSE":
            system_instruction = (
                f"You are RecallOps — an AI troubleshooting assistant specialized in machinery, appliances, and electronics.\n"
                f"The user previously reported an issue with their {active_eq_name} and is now explaining the underlying cause: \"{raw_message}\".\n\n"
                "INSTRUCTIONS:\n"
                "1. Direct Cause-and-Effect Recognition: Clearly explain in plain English why this cause (such as an empty gas cylinder, depleted battery, or disconnected power) directly explains why the equipment is not functioning or lighting.\n"
                "2. Actionable Safety Guidance: Provide immediate, practical safety steps (e.g. for gas cylinders: verify regulator valve is shut off before swapping, check rubber O-ring seal, check for gas odor, perform soapy water leak test, never ignite or use open flame if smelling gas, ensure proper room ventilation; for electrical: check cord condition, verify correct voltage, do not handle with wet hands).\n"
                "3. Operational Next Steps: Briefly outline what to verify once replenished/restored (e.g. checking burner flame color, confirming steady ignition).\n"
                "4. STRICT CONSTRAINTS:\n"
                "- Do NOT introduce yourself ('I am RecallOps, an AI that helps you...').\n"
                "- Do NOT ask disconnected generic questions ('Tell me what's happening with your cylinder...').\n"
                "- Do NOT repeat troubleshooting section headers (Plausible Causes, Safety Alert, etc.).\n"
                "- Relevant Memory Insight: If no matching historical repair records exist, you may concisely note that no prior repair incident was recorded for this issue. NEVER invent historical repair statistics or fabricate past repairs.\n"
                "- Keep the response helpful, direct, and under 130 words."
            ) + english_only_instruction
            groq_messages = [{"role": "system", "content": system_instruction}]
            for m in conversation_history[-6:]:
                if m["role"] in ("user", "assistant"):
                    groq_messages.append({"role": m["role"], "content": m["content"]})
            groq_messages.append({
                "role": "user",
                "content": (
                    f"USER ROOT CAUSE UPDATE: \"{raw_message}\"\n\n"
                    f"ACTIVE EQUIPMENT: {active_eq_name}\n"
                    f"IDENTIFIED HAZARD: {detected_hazard or 'Standard domestic safety precautions'}\n\n"
                    f"{precedent_text}\n"
                    f"Provide your concise, safety-first response connecting this root cause to the equipment issue."
                ),
            })

        elif intent in ("GENERAL_CAPABILITIES_INQUIRY", "GENERAL_INQUIRY"):
            if len(conversation_history) > 0 and prev_equipment:
                system_instruction = (
                    f"You are RecallOps. The user is in an active troubleshooting session regarding their {prev_equipment['equipment_type']}.\n"
                    "Helpfully and concisely address their inquiry, reminding them how you can assist with their current equipment issue (inspecting symptoms, safety precautions, historical repair precedents), without repeating a full introductory monologue."
                ) + english_only_instruction
                groq_messages = [{"role": "system", "content": system_instruction}]
                for m in conversation_history[-4:]:
                    if m["role"] in ("user", "assistant"):
                        groq_messages.append({"role": m["role"], "content": m["content"]})
                groq_messages.append({"role": "user", "content": raw_message})
            else:
                system_instruction = (
                    "You are RecallOps — an AI troubleshooting assistant specialized in diagnosing machinery, household appliances, and electronics using verified repair history.\n"
                    "The user is asking what RecallOps is, what you can do, or requesting assistance.\n"
                    "Explain your capabilities warmly, clearly, and concisely (under 60 words).\n"
                    "Mention that users can describe equipment issues (such as pumps, motors, household appliances, electronics) to discover plausible causes, safety precautions, and historical repair precedents.\n"
                    "Do NOT include troubleshooting section headers."
                ) + english_only_instruction
                groq_messages = [
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": raw_message},
                ]

        elif intent == "AMBIGUOUS_QUERY":
            direct_reply = (
                "I'd be glad to help you troubleshoot! Could you please specify which equipment, appliance, or machine you are working with (such as an industrial pump, electric motor, laptop, or dishwasher) and describe the symptoms you are observing?"
            )

        elif intent == "TROUBLESHOOTING_QUERY":
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
                f"- In 1 or 2 short sentences, state what past plant experience shows from the retrieved memory below for {active_eq_name}. Mention the machine ID (e.g. M-112 or EQ-FIELD), what action was taken, and state whether the repair SUCCEEDED or was UNSUCCESSFUL. Clearly emphasize that the previous repair is historical evidence, not definitive proof of the current cause. If no matching memory exists, state in exactly 1 sentence: 'No historical repair records were found in memory for this issue.' NEVER fabricate hypothetical past repairs, machine IDs, or statistics.\n\n"
                "Question for Technician:\n"
                "- Exactly 1 targeted, practical question the user can ask their certified maintenance technician.\n\n"
                "CONSTRAINTS:\n"
                "- Total response must be under 175 words.\n"
                "- Never fabricate false machine IDs, dates, or outcomes.\n"
                "- Do not use conversational filler or generic disclaimers."
            ) + english_only_instruction
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


        else:
            # Fallback general query
            system_instruction = (
                "You are RecallOps — an AI troubleshooting assistant specialized in machinery, household appliances, and electronics.\n"
                "Respond warmly, helpfully, and concisely (under 50 words). Do NOT generate diagnostic section headers unless diagnosing a specific equipment problem."
            ) + english_only_instruction
            groq_messages = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": raw_message},
            ]

        if direct_reply:
            reply_text = direct_reply
        else:
            try:
                content, model_used = groq_service.create_chat_completion(
                    messages=groq_messages,
                    temperature=0.2,
                    max_tokens=800,
                )
                reply_text = content
            except Exception as e:
                logger.error("Groq chat inference error across models: %s", e)
                # Calibrated structured fallback adhering to diagnostic response format
                if intent in ("CASUAL_CONVERSATION", "CASUAL_GREETING"):
                    lower_r = raw_message.lower()
                    if any(q in lower_r for q in ["how are you", "how are u", "how r u", "how's it going", "how is it going"]):
                        reply_text = (
                            "I'm doing well, thank you! I'm RecallOps, ready to help you understand plausible causes and verified repair history for any equipment or device. What can I help you troubleshoot today?"
                        )
                    elif any(q in lower_r for q in ["what did you eat", "did you eat", "favorite food"]):
                        reply_text = (
                            "I run on clean electric power and code, so no food for me! But I'm fully energized and ready to help you diagnose any equipment or device problem whenever you need."
                        )
                    elif any(q in lower_r for q in ["girlfriend", "boyfriend", "single", "marry"]):
                        reply_text = (
                            "I don't have a personal life—I'm an AI dedicated to equipment diagnostics and learning from verified repair history! Let me know if you ever have a machine or device issue to troubleshoot."
                        )
                    elif any(q in lower_r for q in ["joke", "funny", "laugh"]):
                        reply_text = (
                            "Why did the electric motor break up with the bearing? Because it couldn't handle the friction! Whenever you have real equipment trouble, I'm here to help."
                        )
                    else:
                        reply_text = (
                            "Hello! I'm RecallOps, your equipment troubleshooting assistant. Let me know if you have an appliance, tool, or industrial machine you'd like help diagnosing!"
                        )
                elif intent in ("GENERAL_CAPABILITIES_INQUIRY", "GENERAL_INQUIRY"):
                    reply_text = (
                        "I am RecallOps, an AI assistant specialized in diagnosing machinery, household appliances, and electronics using verified repair history. You can ask me to troubleshoot equipment problems—such as a vibrating industrial pump, an overheating electric motor, or a broken household appliance—and I will analyze plausible causes and historical repair precedents."
                    )
                elif intent == "AMBIGUOUS_QUERY":
                    reply_text = (
                        "I'd be glad to help you troubleshoot! Could you please specify which equipment, appliance, or machine you are working with (such as a pump, motor, laptop, or dishwasher) and describe the symptoms you are observing?"
                    )
                elif intent == "UNRELATED_QUERY":
                    lower_r = raw_message.lower()
                    if any(w in lower_r for w in ["python", "javascript", "code", "programming", "software"]):
                        reply_text = (
                            "RecallOps is a specialized troubleshooting assistant for machinery, appliances, and hardware devices. I don't provide software programming help, but if you have equipment or hardware issues to diagnose, I'm glad to assist!"
                        )
                    elif any(w in lower_r for w in ["capital", "france", "paris", "geography", "country", "india"]):
                        reply_text = (
                            "RecallOps specializes in equipment diagnostics and learning from verified repair history. I don't answer general geography or trivia questions, but feel free to describe any equipment malfunction or repair issue you need help with!"
                        )
                    else:
                        reply_text = (
                            "RecallOps is dedicated to equipment troubleshooting and repair intelligence. I focus on machinery, appliances, and electronic devices. Please let me know if you have any equipment issue you'd like to troubleshoot!"
                        )
                elif intent == "ACKNOWLEDGMENT":
                    reply_text = (
                        "You're very welcome! I'm here anytime you need equipment troubleshooting, safety precautions, or verified repair history."
                    )
                elif intent == "REPORT_OUTCOME":
                    outcome_label = "successful" if (outcome_to_record and outcome_to_record.get("outcome_status") == "SUCCESSFUL") else "unsuccessful"
                    reply_text = (
                        f"Thank you for reporting this repair outcome. The {outcome_label} resolution on your {active_eq_name} has been noted. "
                        "Please verify the details in the confirmation panel below to record this in permanent plant memory."
                    )
                elif intent in ("HISTORICAL_MEMORY_QUERY", "HISTORY_QUERY"):
                    if active_precedents:
                        top_m = active_precedents[0]
                        m_stat = getattr(top_m, "outcome_status", "")
                        m_id = getattr(top_m, "machine_id", active_eq_name)
                        m_act = getattr(top_m, "action_taken", "maintenance")
                        status_str = "succeeded" if m_stat == "SUCCESSFUL" else "was unsuccessful"
                        reply_text = (
                            f"Past records for {m_id} show that {m_act} {status_str} for similar symptoms. "
                            "Review the precedent records below for exact actions taken and recorded outcomes."
                        )
                    else:
                        reply_text = "No historical repair records were found in memory for this issue."
                elif intent in ("FOLLOWUP_SIMPLIFY",):
                    reply_text = (
                        f"In simpler terms, parts inside the {active_eq_name} might be rubbing or off-balance, or dust and debris may be blocking airflow, making the unit run much hotter than normal."
                    )
                elif intent in ("FOLLOWUP_TECHNICIAN_QUESTIONS",):
                    reply_text = (
                        f"Here is what you can ask your technician: 'Could you measure the operating tolerances, verify component connections, and inspect the cooling clearances on this {active_eq_name}?'"
                    )
                elif intent == "PROBLEM_EXPLANATION_OR_CAUSE":
                    lower_r = raw_message.lower()
                    if any(k in lower_r for k in ["cylinder", "gas", "lpg"]):
                        reply_text = (
                            f"An empty gas cylinder directly explains why your {active_eq_name} won't turn on or ignite. "
                            "When replacing or connecting a new cylinder, ensure the regulator valve is turned completely off before detaching. "
                            "Once the new cylinder is securely fitted, check for proper sealing and ensure there is no smell of gas before attempting ignition—never use an open flame to check for leaks. "
                            "If you detect any gas odor, ventilate the area immediately and do not operate electrical switches."
                        )
                    elif any(k in lower_r for k in ["volume", "mute", "muted", "silent", "sound", "phone"]):
                        reply_text = (
                            f"That explains it! When the connected device's volume is muted or turned all the way down, the {active_eq_name} receives zero audio signal despite being connected. "
                            "Unmuting the device and adjusting the playback volume should have your sound playing normally right away. Enjoy the music, and let me know if you need any other troubleshooting help!"
                        )
                    elif any(k in lower_r for k in ["cable", "hdmi", "wire", "connection", "loose"]):
                        reply_text = (
                            f"Glad you caught that! A loose HDMI or display cable prevents signal transmission to your {active_eq_name}. "
                            "Reseating the cable firmly into both ports ensures solid contact and should restore your picture immediately."
                        )
                    elif any(k in lower_r for k in ["timer", "cook time", "setting", "mode"]):
                        reply_text = (
                            f"That definitely explains it! Setting the kitchen timer counts down without engaging the heating elements on your {active_eq_name}. "
                            "Switching from timer mode to active cook time and setting the power level will heat your food right up."
                        )
                    elif any(k in lower_r for k in ["emergency stop", "e-stop", "stop button", "estop", "accidentally pressed", "stop pressed"]):
                        reply_text = (
                            f"That is a very common scenario on the shop floor. An engaged Emergency Stop button directly hard-isolates the power drive circuit on your {active_eq_name}. "
                            "Twisting the E-Stop knob clockwise to unlatch it and pressing the reset button on your control console will restore drive power safely."
                        )
                    elif any(k in lower_r for k in ["balance", "slider", "left", "right", "one ear"]):
                        reply_text = (
                            f"Good catch! If the audio balance slider is shifted all the way to one channel in settings, it completely silences the opposite side of your {active_eq_name}. "
                            "Centering the balance slider in your device's accessibility or audio settings will restore stereo sound to both ears."
                        )
                    elif any(k in lower_r for k in ["adapter", "switch off", "band tha", "off tha"]):
                        reply_text = (
                            f"That explains it! Because the adapter switch was turned off, your {active_eq_name} was not receiving power. "
                            "Turning the switch on will deliver power so the device operates normally. Let me know if everything powers up fine!"
                        )
                    elif any(k in lower_r for k in ["battery", "charge", "charger"]):
                        reply_text = (
                            f"A depleted battery directly explains why your {active_eq_name} is not powering on. "
                            "Inspect the charging port and cable for physical debris or damage, then connect to a verified charger and allow it to charge for at least 15–30 minutes before testing."
                        )
                    elif any(k in lower_r for k in ["plug", "cord", "power", "breaker", "fuse", "switch"]):
                        reply_text = (
                            f"A disconnected power source or tripped circuit breaker directly explains why your {active_eq_name} won't turn on. "
                            "Ensure the power cord is firmly seated in a live outlet and check your electrical panel to verify no breakers have tripped before attempting to turn it back on."
                        )
                    else:
                        reply_text = (
                            f"That explains why your {active_eq_name} was not functioning properly. "
                            "Now that you've identified this, safely verify the connection or setting and test operation. "
                            "Let me know if the issue persists or if you need help with any other equipment!"
                        )
                elif intent in ("FOLLOWUP_WHY_OR_HOW", "FOLLOWUP_EXPLANATION", "FOLLOWUP_QUESTION", "FOLLOWUP_GENERAL") or is_followup:
                    eq_lower = active_eq_name.lower()
                    if "oven" in eq_lower:
                        reply_text = (
                            f"An {active_eq_name} often shuts off unexpectedly when a high-temperature thermal limit switch or failing thermostat sensor trips to prevent overheating, or if an electrical control relay cuts out under thermal load."
                        )
                    elif "motor" in eq_lower:
                        reply_text = (
                            f"An unusual sound in the {active_eq_name} commonly stems from dry or worn bearings, rotor-stator air gap misalignment, or loose mounting hardware vibrating under load."
                        )
                    elif "mixer" in eq_lower:
                        reply_text = (
                            f"The {active_eq_name} commonly stops when its overload protection switch trips, the motor carbon brushes wear out, or drive coupling friction causes a thermal shutdown."
                        )
                    elif any(w in eq_lower for w in ["speaker", "headphone", "audio", "phone", "tv"]):
                        reply_text = (
                            f"Audio dropouts or silence on your {active_eq_name} typically occur when Bluetooth signal interference degrades the digital packet stream, the source volume is muted, or the power management circuit triggers battery preservation."
                        )
                    else:
                        reply_text = (
                            f"This behavior on your {active_eq_name} typically arises from operational load variations, thermal safety cutoffs, or connection interface degradation."
                        )
                elif intent == "TROUBLESHOOTING_QUERY":
                    top_mem_summary = ""
                    if active_precedents:
                        top_m = active_precedents[0]
                        m_stat = getattr(top_m, "outcome_status", "")
                        m_id = getattr(top_m, "machine_id", active_eq_name)
                        m_act = getattr(top_m, "action_taken", "maintenance")
                        status_str = "SUCCEEDED" if m_stat == "SUCCESSFUL" else "was UNSUCCESSFUL"
                        top_mem_summary = (
                            f"In past records for {m_id}, {m_act} {status_str}. "
                            "Note: Past repairs serve as historical evidence, not definitive proof for this incident."
                        )
                    else:
                        top_mem_summary = "No historical repair records were found in memory for this issue."

                    eq_cat = active_equipment.get("category", "") if active_equipment else ""
                    eq_name_lower = active_eq_name.lower()
                    is_electronic = eq_cat == "electronic" or any(w in eq_name_lower for w in [
                        "phone", "speaker", "laptop", "pc", "headphone", "audio", "camera", "tablet", "drone", "bluetooth", "tv", "screen"
                    ])
                    is_household = eq_cat == "household" or any(w in eq_name_lower for w in [
                        "microwave", "stove", "oven", "fridge", "refrigerator", "kettle", "toaster", "blender", "iron", "heater", "dishwasher", "fan"
                    ])

                    if is_electronic:
                        reply_text = (
                            "Plausible Causes:\n"
                            f"• Audio level muted, Bluetooth pairing dropped, or input channel misconfigured on {active_eq_name}.\n"
                            "• Depleted battery charge or damaged charging cable failing to deliver operating power.\n"
                            "• Firmware lockup or internal audio amplifier circuit overload.\n\n"
                            "Safety Alert:\n"
                            "• Disconnect the device from charger before inspecting ports; never puncture or tamper with lithium battery cells.\n\n"
                            "Relevant Memory Insight:\n"
                            f"• {top_mem_summary}\n\n"
                            "Question for Support / Technician:\n"
                            f"• Could you test whether the Bluetooth radio module and power delivery circuit on this {active_eq_name} are operating at nominal voltage?"
                        )
                    elif is_household:
                        reply_text = (
                            "Plausible Causes:\n"
                            f"• Interrupted electrical power, tripped thermal safety fuse, or faulty supply switch on {active_eq_name}.\n"
                            "• Fuel supply shutoff, closed regulator valve, or line pressure starvation.\n"
                            "• Control timer relay failure or worn heating element.\n\n"
                            "Safety Alert:\n"
                            "• Unplug the appliance from the electrical outlet or close fuel supply shut-off valve before physical inspection; never open live enclosures.\n\n"
                            "Relevant Memory Insight:\n"
                            f"• {top_mem_summary}\n\n"
                            "Question for Technician:\n"
                            f"• Could you check the continuity of the thermal fuse, door switch, and main control relay on this {active_eq_name}?"
                        )
                    else:
                        safety_line = "Perform full Lockout/Tagout (LOTO) at electrical disconnect and verify zero energy before physical inspection."
                        reply_text = (
                            "Plausible Causes:\n"
                            f"• Potential mechanical imbalance, misalignment, or bearing wear within the {active_eq_name}.\n"
                            "• Blocked cooling passages, restricted airflow, or heat dissipation breakdown.\n"
                            "• Loose mounting fasteners, coupling degradation, or excessive operational load.\n\n"
                            "Safety Alert:\n"
                            f"• {safety_line}\n\n"
                            "Relevant Memory Insight:\n"
                            f"• {top_mem_summary}\n\n"
                            "Question for Technician:\n"
                            f"• Could you check bearing runout, mechanical alignment, and cooling passage clearances on this {active_eq_name}?"
                        )
                else:
                    reply_text = (
                        "I am RecallOps, your equipment troubleshooting assistant. Please describe the equipment, appliance, or machine you'd like help diagnosing, along with the symptoms you're seeing."
                    )

        # 9. Adaptive Suggested Follow-Up Prompts
        suggested_followups = []
        is_active_conv = len(conversation_history) > 0 or prev_equipment is not None
        eq_ctx = active_equipment or prev_equipment
        eq_name_ctx = eq_ctx["equipment_type"].lower() if eq_ctx else ""

        if intent in ("CASUAL_CONVERSATION", "CASUAL_GREETING", "GENERAL_CAPABILITIES_INQUIRY", "GENERAL_INQUIRY"):
            if is_active_conv and eq_ctx:
                if "stove" in eq_name_ctx or "cylinder" in eq_name_ctx or "burner" in eq_name_ctx:
                    suggested_followups = [
                        "How do I safely connect a new gas cylinder?",
                        "How do I check for gas leaks using soapy water?",
                        "What should I do if the burner still won't light?",
                    ]
                elif "motor" in eq_name_ctx:
                    suggested_followups = [
                        "What causes motor overheating under normal load?",
                        "How to inspect motor stator and rotor air gap?",
                        "Check previous motor repair precedents",
                    ]
                elif "pump" in eq_name_ctx:
                    suggested_followups = [
                        "How to check bearing lubrication on this pump",
                        "What should I ask my technician about shaft alignment?",
                        "Has this happened before in previous repair records?",
                    ]
                else:
                    suggested_followups = [
                        f"What questions should I ask my technician about the {eq_ctx['equipment_type']}?",
                        f"Has this issue occurred before on the {eq_ctx['equipment_type']}?",
                        f"What safety precautions should I take before inspecting?",
                    ]
            else:
                suggested_followups = [
                    "My industrial pump is vibrating and overheating.",
                    "My electric motor is making an unusual noise.",
                    "My umbrella won't open.",
                ]
        elif intent == "PROBLEM_EXPLANATION_OR_CAUSE":
            if "stove" in eq_name_ctx or "cylinder" in eq_name_ctx or "burner" in eq_name_ctx or any(k in raw_message.lower() for k in ["gas", "cylinder", "lpg"]):
                suggested_followups = [
                    "How do I safely connect a new gas cylinder?",
                    "How do I check for gas leaks using soapy water?",
                    "What should I do if the burner still won't light?",
                ]
            elif "battery" in eq_name_ctx or any(k in raw_message.lower() for k in ["battery", "charge", "charger"]):
                suggested_followups = [
                    "How long should I let the battery charge before testing?",
                    "What if it still doesn't turn on after charging?",
                    "How can I check if the charger or cable is damaged?",
                ]
            else:
                suggested_followups = [
                    f"What safety checks should I perform on the {active_eq_name}?",
                    f"What should I do if the {active_eq_name} still doesn't work?",
                    "What questions should I ask my technician?",
                ]
        elif intent == "AMBIGUOUS_QUERY":
            if is_active_conv and eq_ctx:
                suggested_followups = []
            else:
                suggested_followups = [
                    "My industrial pump is vibrating and overheating.",
                    "My ceiling fan makes a clicking noise.",
                    "My microwave won't heat food.",
                ]
        elif intent == "UNRELATED_QUERY":
            if is_active_conv and eq_ctx:
                suggested_followups = []
            else:
                suggested_followups = [
                    "My industrial pump is vibrating and overheating.",
                    "My laptop fan is unusually loud.",
                    "My power bank won't charge.",
                ]
        elif intent == "ACKNOWLEDGMENT":
            if is_active_conv and eq_ctx:
                suggested_followups = [
                    f"Check repair history for {eq_ctx['equipment_type']}",
                    "Save a verified repair to plant memory",
                    "Start a new troubleshooting question",
                ]
            else:
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
        elif intent in ("FOLLOWUP_WHY_OR_HOW", "FOLLOWUP_GENERAL", "FOLLOWUP_QUESTION"):
            if "stove" in eq_name_ctx or "cylinder" in eq_name_ctx:
                suggested_followups = [
                    "How do I check for gas leaks using soapy water?",
                    "What should I do if the burner still won't light?",
                    "What should I ask my technician?",
                ]
            else:
                suggested_followups = [
                    "What specific questions should I ask my technician?",
                    "Can you explain in simpler words?",
                    "How can I prevent this in the future?",
                ]
        else:
            if is_active_conv and eq_ctx:
                if "stove" in eq_name_ctx or "cylinder" in eq_name_ctx:
                    suggested_followups = [
                        "How do I safely connect a new gas cylinder?",
                        "How do I check for gas leaks using soapy water?",
                        "What should I do if the burner still won't light?",
                    ]
                else:
                    suggested_followups = [
                        f"Can you explain the most likely cause for {eq_ctx['equipment_type']} in simpler words?",
                        f"What specific questions should I ask my technician about {eq_ctx['equipment_type']}?",
                        "What safety steps must I take before physical inspection?",
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
            "detected_language": user_language,
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
            detected_language=user_language,
            created_at=now_iso,
        )

    def record_outcome(self, req: RecordOutcomeRequest, user_id: Optional[str] = None) -> RecordOutcomeResponse:
        """Record verified repair outcome into local SQLite database and optionally Hindsight Cloud with strict idempotency and user scoping."""
        # 1. Idempotency Check: if idempotency_key is present and already exists, return existing record
        if req.idempotency_key:
            with get_db() as conn:
                existing = conn.execute(
                    """
                    SELECT v.id as verification_id, v.incident_id, v.outcome_status,
                           v.sync_status, v.hindsight_document_id, v.hindsight_retained
                    FROM outcome_verifications v
                    WHERE v.idempotency_key = ?
                    LIMIT 1
                    """,
                    (req.idempotency_key,),
                ).fetchone()

                if existing:
                    logger.info("Idempotent outcome submission detected for key '%s'", req.idempotency_key)
                    return RecordOutcomeResponse(
                        success=True,
                        incident_id=existing["incident_id"],
                        verification_id=existing["verification_id"],
                        hindsight_retained=bool(existing["hindsight_retained"]),
                        sync_status=existing["sync_status"] or "local_only",
                        message="Repair outcome previously confirmed and recorded (idempotent submission).",
                        document_id=existing["hindsight_document_id"],
                        is_duplicate=True,
                    )

        incident_id = generate_id("INC")
        repair_id = generate_id("REP")
        verification_id = generate_id("VER")
        now_iso = datetime.now(timezone.utc).isoformat()
        doc_id = f"OUTCOME-{incident_id}"

        # 2. Persist local incident first with user_id
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO incidents (
                    id, user_id, machine_id, equipment_type, symptoms, timestamp,
                    severity, reported_observations, status, is_demo, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                """,
                (
                    incident_id,
                    user_id,
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

            # 3. Persist local repair
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

        # 4. Handle Reliable Hindsight Cloud Synchronization State with user isolation
        # States: 'local_only', 'pending_sync', 'synced', 'sync_failed'
        hindsight_retained = False
        sync_status = "local_only"
        sync_error = None

        if req.live_retain and not settings.HINDSIGHT_MOCK_MODE:
            sync_status = "pending_sync"
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
                ret_resp = hindsight_service.retain_incident_outcome(
                    incident=incident_dict,
                    repair=repair_dict,
                    verification=verification_dict,
                    user_id=user_id,
                )
                success = True
                if hasattr(ret_resp, "success"):
                    success = bool(ret_resp.success)
                elif isinstance(ret_resp, dict) and "success" in ret_resp:
                    success = bool(ret_resp["success"])

                if success:
                    hindsight_retained = True
                    sync_status = "synced"
                else:
                    hindsight_retained = False
                    sync_status = "sync_failed"
                    sync_error = "Hindsight retain returned success=False"
            except Exception as e:
                logger.warning("Live Hindsight retain failed: %s. Local record preserved with sync_status='sync_failed'.", e)
                hindsight_retained = False
                sync_status = "sync_failed"
                sync_error = str(e)[:250]
        else:
            # Mock mode or local-only: NEVER claim cloud retained
            hindsight_retained = False
            sync_status = "local_only"

        # 5. Insert into outcome_verifications with user_id, idempotency_key, sync_status, sync_error
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO outcome_verifications (
                    id, user_id, incident_id, verified_by, outcome_status, inspection_notes,
                    follow_up_metrics, hindsight_retained, hindsight_document_id, verified_at,
                    idempotency_key, sync_status, sync_error
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    verification_id,
                    user_id,
                    incident_id,
                    req.technician_id or "TECH-FIELD",
                    req.outcome_status,
                    req.inspection_notes or "Field repair completed and verified.",
                    json.dumps(req.follow_up_metrics) if req.follow_up_metrics else None,
                    1 if hindsight_retained else 0,
                    doc_id,
                    now_iso,
                    req.idempotency_key,
                    sync_status,
                    sync_error,
                ),
            )

        # Resolve associated problem episode in SQLite for cross-conversation tracking
        current_scope = user_id or "default_user"
        if req.episode_id:
            self.resolve_problem_episode(
                episode_id=req.episode_id,
                action_taken=req.action_taken,
                user_scope=current_scope,
            )
        else:
            matched_ep = self.find_matching_problem_episode(
                equipment_name=req.equipment_type,
                text=f"{req.action_taken} {req.symptoms}",
                user_scope=current_scope,
            )
            if matched_ep:
                self.resolve_problem_episode(
                    episode_id=matched_ep["id"],
                    action_taken=req.action_taken,
                    user_scope=current_scope,
                )

        # 6. If conversation_id is provided, post a confirmation message into the conversation
        if req.conversation_id:
            asst_msg_id = generate_id("MSG-AST")
            if sync_status == "synced":
                sync_label = f"Saved locally and successfully synchronized with Hindsight Cloud (`{doc_id}`)."
            elif sync_status == "sync_failed":
                sync_label = f"Saved locally in plant database. Cloud sync failed ({sync_error or 'upstream unavailable'}). Sync status: `SYNC_FAILED`."
            else:
                sync_label = f"Saved to local episodic memory bank (`{doc_id}`). Credit-preservation mode active; no billable cloud credits consumed."

            msg_text = (
                f"✅ **Verified Experience Recorded Successfully!**\n\n"
                f"• **Equipment**: {req.equipment_type} ({req.machine_id or 'EQ-FIELD'})\n"
                f"• **Repair Action**: {req.action_taken}\n"
                f"• **Verified Outcome**: `{req.outcome_status}`\n"
                f"• **Status**: {sync_label}"
            )
            with get_db() as conn:
                conn.execute(
                    "INSERT INTO messages (id, conversation_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (asst_msg_id, req.conversation_id, "assistant", msg_text, json.dumps({"type": "outcome_recorded", "incident_id": incident_id, "sync_status": sync_status}), now_iso),
                )
                conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now_iso, req.conversation_id))

        return RecordOutcomeResponse(
            success=True,
            incident_id=incident_id,
            verification_id=verification_id,
            hindsight_retained=hindsight_retained,
            sync_status=sync_status,
            message="Repair outcome recorded into episodic memory bank successfully.",
            document_id=doc_id,
            is_duplicate=False,
        )

    def retry_sync_outcome(self, verification_id: str, user_id: Optional[str] = None) -> dict[str, Any]:
        """Retry syncing a locally saved outcome to Hindsight Cloud without creating duplicate local rows, enforcing user ownership."""
        with get_db() as conn:
            row = conn.execute(
                """
                SELECT v.id, v.user_id as verification_user_id, v.incident_id, v.outcome_status, v.inspection_notes,
                       v.follow_up_metrics, v.hindsight_document_id, v.sync_status,
                       i.user_id as incident_user_id, i.machine_id, i.equipment_type, i.symptoms, i.is_demo,
                       r.action_taken, r.parts_replaced, r.technician_id
                FROM outcome_verifications v
                JOIN incidents i ON v.incident_id = i.id
                LEFT JOIN repairs r ON v.incident_id = r.incident_id
                WHERE v.id = ?
                LIMIT 1
                """,
                (verification_id,),
            ).fetchone()

        if not row:
            raise ValueError(f"Outcome verification '{verification_id}' not found.")

        if user_id:
            record_user = row["verification_user_id"] or row["incident_user_id"]
            if record_user and record_user != user_id:
                raise ValueError(f"Outcome verification '{verification_id}' not found.")
            if record_user is None and not row["is_demo"] and user_id != "demo_user":
                raise ValueError(f"Outcome verification '{verification_id}' not found.")

        if row["sync_status"] == "synced":
            return {
                "success": True,
                "sync_status": "synced",
                "message": "Record is already synchronized with Hindsight Cloud.",
                "document_id": row["hindsight_document_id"],
            }

        if settings.HINDSIGHT_MOCK_MODE:
            return {
                "success": True,
                "sync_status": "local_only",
                "message": "Credit-preservation mock mode is active; cloud sync is simulated locally.",
                "document_id": row["hindsight_document_id"],
            }

        try:
            incident_dict = {
                "id": row["incident_id"],
                "machine_id": row["machine_id"],
                "equipment_type": row["equipment_type"],
                "symptoms": row["symptoms"],
                "severity": "MEDIUM",
                "reported_observations": row["symptoms"],
                "is_demo": True,
            }
            repair_dict = {
                "technician_id": row["technician_id"] or "TECH-FIELD",
                "action_taken": row["action_taken"] or "Maintenance action",
                "parts_replaced": row["parts_replaced"] or "None",
            }
            verification_dict = {
                "outcome_status": row["outcome_status"],
                "inspection_notes": row["inspection_notes"] or "Field verified",
                "follow_up_metrics": json.loads(row["follow_up_metrics"]) if row["follow_up_metrics"] else None,
                "verified_at": datetime.now(timezone.utc).isoformat(),
            }
            ret_resp = hindsight_service.retain_incident_outcome(
                incident=incident_dict,
                repair=repair_dict,
                verification=verification_dict,
                user_id=user_id,
            )
            success = True
            if hasattr(ret_resp, "success"):
                success = bool(ret_resp.success)
            elif isinstance(ret_resp, dict) and "success" in ret_resp:
                success = bool(ret_resp["success"])

            if success:
                with get_db() as conn:
                    conn.execute(
                        "UPDATE outcome_verifications SET sync_status = 'synced', hindsight_retained = 1, sync_error = NULL WHERE id = ?",
                        (verification_id,),
                    )
                return {
                    "success": True,
                    "sync_status": "synced",
                    "message": "Successfully synchronized with Hindsight Cloud.",
                    "document_id": row["hindsight_document_id"],
                }
            else:
                err_msg = "Hindsight retain returned success=False"
                with get_db() as conn:
                    conn.execute(
                        "UPDATE outcome_verifications SET sync_status = 'sync_failed', sync_error = ? WHERE id = ?",
                        (err_msg, verification_id),
                    )
                return {
                    "success": False,
                    "sync_status": "sync_failed",
                    "message": f"Sync retry failed: {err_msg}",
                    "document_id": row["hindsight_document_id"],
                }
        except Exception as e:
            err_msg = str(e)[:250]
            with get_db() as conn:
                conn.execute(
                    "UPDATE outcome_verifications SET sync_status = 'sync_failed', sync_error = ? WHERE id = ?",
                    (err_msg, verification_id),
                )
            return {
                "success": False,
                "sync_status": "sync_failed",
                "message": f"Sync retry failed: {err_msg}",
                "document_id": row["hindsight_document_id"],
            }


chat_service = ChatService()
