import re
import logging
from typing import Any, Optional
from backend.models.incident import (
    HistoricalPrecedentRecord,
    ConflictingRepairAnalysis,
    RepairDecisionIntelligence,
)

logger = logging.getLogger(__name__)

# Canonical repair action categories with strict regex patterns for conservative normalization
CANONICAL_ACTION_PATTERNS = [
    (
        "BEARING_REPLACEMENT",
        re.compile(
            r"\b(bearing\s+(replacement|swap)|replace(d)?\s+([a-z\-]+\s+)?bearing(s)?|swapped\s+bearing(s)?|installed\s+new\s+bearing(s)?|new\s+bearing\s+assembly)\b",
            re.IGNORECASE,
        ),
        "Bearing Replacement",
    ),
    (
        "SHAFT_COUPLING_ALIGNMENT",
        re.compile(
            r"\b(laser\s+align(ed|ment)?|align(ed|ment)?\s+(the\s+)?(motor-pump\s+)?(coupling|shaft)|shaft\s+align(ed|ment)?|realign(ed)?\s+([a-z\-]+\s+)?coupling)\b",
            re.IGNORECASE,
        ),
        "Shaft / Coupling Laser Alignment",
    ),
    (
        "IMPELLER_BALANCING",
        re.compile(
            r"\b(dynamic(ally)?\s+balanc(ed|ing)|balanc(ed|ing)?\s+(the\s+)?impeller|impeller\s+balanc(ed|ing)|balanc(ed|ing)?\s+rotor)\b",
            re.IGNORECASE,
        ),
        "Impeller Dynamic Balancing",
    ),
    (
        "VENTILATION_COOLING_CLEANING",
        re.compile(
            r"\b(clean(ed|ing)?\s+(the\s+)?ventilation|clear(ed|ing)?\s+(clogged\s+)?(air\s+intake|cooling\s+fins|cooling\s+ducts)|unclog(ged|ging)?\s+cooling)\b",
            re.IGNORECASE,
        ),
        "Ventilation & Cooling Path Cleaning",
    ),
    (
        "MECHANICAL_SEAL_REPLACEMENT",
        re.compile(
            r"\b(replace(d)?\s+(the\s+)?(mechanical\s+)?seal|seal\s+replacement|repacked\s+gland(\s+packing)?)\b",
            re.IGNORECASE,
        ),
        "Mechanical Seal Replacement",
    ),
    (
        "LUBRICATION_FLUSH",
        re.compile(
            r"\b(flush(ed|ing)?\s+lubricant|oil\s+change|replenish(ed)?\s+oil|re-greas(ed|ing))\b",
            re.IGNORECASE,
        ),
        "Lubrication Flush & Recharge",
    ),
]


class RepairConflictService:
    def normalize_action(self, action_text: str) -> tuple[str, str]:
        """
        Conservatively normalize a repair action to a canonical cluster.
        Returns: (normalized_key, display_label)
        If not matching a known canonical group, returns conservative normalized text.
        """
        if not action_text:
            return "UNKNOWN", "Unknown Action"

        cleaned = action_text.strip()
        for key, pattern, label in CANONICAL_ACTION_PATTERNS:
            if pattern.search(cleaned):
                return key, label

        # Conservative fallback: lowercase alphanumeric tokens without collapsing unrelated repairs
        tokens = [w for w in re.findall(r"[a-zA-Z]+", cleaned.lower()) if len(w) > 2]
        if tokens:
            custom_key = "_".join(tokens[:3]).upper()
            return custom_key, cleaned.capitalize()
        return "GENERIC_ACTION", cleaned

    def parse_memory_records(self, memories: list[dict[str, Any]]) -> list[HistoricalPrecedentRecord]:
        """
        Extract verified historical repair records from retrieved Hindsight memory documents.
        Distinguishes verified outcomes from unverified or incomplete records.
        """
        records: list[HistoricalPrecedentRecord] = []
        if not memories:
            return records

        for idx, mem in enumerate(memories, 1):
            text = mem.get("text", "")
            if not text:
                continue

            doc_id = mem.get("document_id") or f"MEM-{idx}"

            # 1. Structured Format Parsing (Key: Value)
            if "Verified Outcome:" in text or "Repair Action:" in text:
                case_id = doc_id
                machine_id = None
                equipment_type = None
                repair_action = None
                outcome_status = "UNVERIFIED"
                operating_conditions = None

                for line in text.split("\n"):
                    line = line.strip()
                    if line.startswith("Incident ID:"):
                        case_id = line.split(":", 1)[1].strip()
                    elif line.startswith("Machine ID:"):
                        machine_id = line.split(":", 1)[1].strip()
                    elif line.startswith("Equipment Type:"):
                        equipment_type = line.split(":", 1)[1].strip()
                    elif line.startswith("Repair Action:"):
                        repair_action = line.split(":", 1)[1].strip()
                    elif line.startswith("Operator Observations:"):
                        operating_conditions = line.split(":", 1)[1].strip()
                    elif line.startswith("Verified Outcome:"):
                        status_str = line.split(":", 1)[1].strip().upper()
                        if "SUCCESSFUL" in status_str and "UNSUCCESSFUL" not in status_str:
                            outcome_status = "SUCCESSFUL"
                        elif "UNSUCCESSFUL" in status_str:
                            outcome_status = "UNSUCCESSFUL"
                    elif line.startswith("Reported Symptoms:") and not operating_conditions:
                        operating_conditions = line.split(":", 1)[1].strip()

                if repair_action and outcome_status in ("SUCCESSFUL", "UNSUCCESSFUL"):
                    records.append(
                        HistoricalPrecedentRecord(
                            case_id=case_id,
                            machine_id=machine_id,
                            equipment_type=equipment_type,
                            repair_action=repair_action,
                            outcome_status=outcome_status,
                            operating_conditions=operating_conditions,
                            is_verified=True,
                        )
                    )
                    continue

            # 2. Semi-structured or Sentence-based Parsing
            upper_text = text.upper()
            outcome_match = None
            if "VERIFIED SUCCESSFUL" in upper_text or "OUTCOME: SUCCESSFUL" in upper_text or "VERIFIED AS SUCCESSFUL" in upper_text:
                outcome_match = "SUCCESSFUL"
            elif "VERIFIED UNSUCCESSFUL" in upper_text or "OUTCOME: UNSUCCESSFUL" in upper_text or "VERIFIED AS UNSUCCESSFUL" in upper_text:
                outcome_match = "UNSUCCESSFUL"

            if outcome_match:
                # Extract machine ID or case reference
                m_match = re.search(r"\b(M-[A-Z0-9\-]+|INC-[A-Z0-9\-]+|DEMO-M-[A-Z0-9\-]+)\b", text, re.IGNORECASE)
                machine_ref = m_match.group(1).upper() if m_match else doc_id

                # Extract repair action from canonical patterns
                detected_action = None
                for key, pattern, label in CANONICAL_ACTION_PATTERNS:
                    match = pattern.search(text)
                    if match:
                        detected_action = match.group(0)
                        break

                if not detected_action:
                    # Look for action verbs followed by object
                    verb_match = re.search(r"\b(replaced|realigned|aligned|cleaned|cleared|balanced|swapped)\s+([a-zA-Z\s]{4,30})[\.\;\,]", text, re.IGNORECASE)
                    if verb_match:
                        detected_action = f"{verb_match.group(1)} {verb_match.group(2).strip()}"

                if detected_action:
                    records.append(
                        HistoricalPrecedentRecord(
                            case_id=machine_ref,
                            machine_id=machine_ref,
                            equipment_type=None,
                            repair_action=detected_action,
                            outcome_status=outcome_match,
                            operating_conditions=text.strip(),
                            is_verified=True,
                        )
                    )

        logger.info("Parsed %d verified historical repair precedents from %d memory items.", len(records), len(memories))
        return records

    def analyze_conflicts(
        self,
        incident: dict[str, Any],
        historical_memories: list[dict[str, Any]],
        investigation_result: Optional[dict[str, Any]] = None,
    ) -> RepairDecisionIntelligence:
        """
        Deterministic, evidence-grounded conflict detection across historical repair records.
        Identifies when the same repair has produced contradictory outcomes for similar symptoms.
        """
        records = self.parse_memory_records(historical_memories)

        # Insufficient evidence handling
        if not records:
            return RepairDecisionIntelligence(
                has_conflict=False,
                summary="Insufficient historical precedent records exist to confirm or refute conflicting repair outcomes.",
                conflicts=[],
                recommended_action=None,
                caution_actions=[],
                suggested_diagnostic_checks=[
                    "Perform initial physical inspection and verify operating telemetry before applying repairs."
                ],
            )

        # Group records by normalized action
        action_groups: dict[str, list[HistoricalPrecedentRecord]] = {}
        action_labels: dict[str, str] = {}

        for rec in records:
            norm_key, label = self.normalize_action(rec.repair_action)
            action_groups.setdefault(norm_key, []).append(rec)
            action_labels[norm_key] = label

        conflicts: list[ConflictingRepairAnalysis] = []
        caution_actions: list[str] = []
        recommended_actions: list[str] = []
        global_diagnostics: list[str] = []
        overall_conflict_detected = False

        current_symptoms = (incident.get("symptoms", "") + " " + incident.get("reported_observations", "")).lower()

        for norm_key, group in action_groups.items():
            label = action_labels[norm_key]
            successful = [r for r in group if r.outcome_status == "SUCCESSFUL"]
            unsuccessful = [r for r in group if r.outcome_status == "UNSUCCESSFUL"]

            # CONFLICT DETECTED: Same repair produced both SUCCESSFUL and UNSUCCESSFUL verified outcomes
            if successful and unsuccessful:
                overall_conflict_detected = True
                conflict_detected = True
                recommendation_status = "FURTHER_DIAGNOSIS_REQUIRED"

                # Identify differentiating factors between successful and unsuccessful cases
                succ_cues = []
                for s in successful:
                    cues = s.operating_conditions or s.repair_action
                    succ_cues.append(f"Case {s.case_id} ({s.machine_id or 'Asset'}): {cues}")

                unsucc_cues = []
                for u in unsuccessful:
                    cues = u.operating_conditions or u.repair_action
                    unsucc_cues.append(f"Case {u.case_id} ({u.machine_id or 'Asset'}): {cues}")

                differentiating_factors = [
                    f"Successful Precedent: {label} verified effective in {', '.join(s.case_id for s in successful)}.",
                    f"Unsuccessful Precedent: {label} verified ineffective in {', '.join(u.case_id for u in unsuccessful)}.",
                ]

                # Specific domain checks based on the conflicting action
                suggested_checks = []
                if norm_key == "BEARING_REPLACEMENT":
                    suggested_checks = [
                        "Perform laser dial indicator shaft alignment measurement across the motor-pump coupling before disassembling the bearing housing.",
                        "Execute FFT vibration spectrum analysis to distinguish 1X/2X shaft running frequency harmonics (misalignment) from high-frequency bearing cage/race pass frequencies.",
                        "Inspect coupling elastomer elements for radial/angular backlash and verify coupling bolt torque specifications.",
                    ]
                elif norm_key == "SHAFT_COUPLING_ALIGNMENT":
                    suggested_checks = [
                        "Verify soft foot tolerances with dial indicators on each machine foot before coupling realignment.",
                        "Perform casing thermal growth calculation if equipment operates at elevated process temperatures.",
                    ]
                elif norm_key == "VENTILATION_COOLING_CLEANING":
                    suggested_checks = [
                        "Measure motor current draw and voltage across all phases to rule out electrical overload before assuming thermal airflow restriction.",
                    ]
                else:
                    suggested_checks = [
                        f"Perform differential telemetry inspection on {incident.get('machine_id')} to determine whether primary causal factors match successful vs unsuccessful precedent cases."
                    ]

                observed_evidence = [
                    f"OBSERVED HISTORICAL FACT: {label} succeeded in Case {', '.join(s.case_id for s in successful)}.",
                    f"OBSERVED HISTORICAL FACT: {label} failed in Case {', '.join(u.case_id for u in unsuccessful)} under similar high-level symptoms.",
                ]

                ai_interpretation = (
                    f"AI INTERPRETATION: Historical precedent analysis reveals conflicting verified outcomes for '{label}'. "
                    f"While {label} resolved symptoms in {', '.join(s.case_id for s in successful)}, it failed in "
                    f"{', '.join(u.case_id for u in unsuccessful)} because secondary symptoms masked an underlying root cause. "
                    f"Current observations for {incident.get('machine_id')} contain symptom overlaps with both cases. "
                    f"Executing '{label}' prematurely without targeted diagnostic verification carries a high probability of repeat failure."
                )

                caution_actions.append(label)
                global_diagnostics.extend(suggested_checks)

                conflicts.append(
                    ConflictingRepairAnalysis(
                        repair_action=label,
                        normalized_action=norm_key,
                        recommendation_status=recommendation_status,
                        conflict_detected=conflict_detected,
                        successful_precedents=successful,
                        unsuccessful_precedents=unsuccessful,
                        differentiating_factors=differentiating_factors,
                        observed_historical_evidence=observed_evidence,
                        ai_interpretation=ai_interpretation,
                        suggested_diagnostic_checks=suggested_checks,
                    )
                )

            # ONLY UNSUCCESSFUL PRECEDENTS: Blind repetition caution
            elif unsuccessful and not successful:
                caution_actions.append(label)
                observed_evidence = [
                    f"OBSERVED HISTORICAL FACT: {label} was attempted in Case {', '.join(u.case_id for u in unsuccessful)} and verified UNSUCCESSFUL."
                ]
                ai_interpretation = (
                    f"AI INTERPRETATION: '{label}' has zero verified successful precedents in the plant memory bank for these symptoms. "
                    f"Avoid repeating this action without verifying new causal factors."
                )
                suggested_checks = [
                    f"Rule out previous failed action '{label}' and test alternative hypotheses before dispatching parts."
                ]
                conflicts.append(
                    ConflictingRepairAnalysis(
                        repair_action=label,
                        normalized_action=norm_key,
                        recommendation_status="CAUTION",
                        conflict_detected=False,
                        successful_precedents=[],
                        unsuccessful_precedents=unsuccessful,
                        differentiating_factors=[
                            f"Action previously verified UNSUCCESSFUL in {', '.join(u.case_id for u in unsuccessful)}."
                        ],
                        observed_historical_evidence=observed_evidence,
                        ai_interpretation=ai_interpretation,
                        suggested_diagnostic_checks=suggested_checks,
                    )
                )

            # ONLY SUCCESSFUL PRECEDENTS
            elif successful and not unsuccessful:
                recommended_actions.append(label)
                observed_evidence = [
                    f"OBSERVED HISTORICAL FACT: {label} was verified SUCCESSFUL in Case {', '.join(s.case_id for s in successful)}."
                ]
                ai_interpretation = (
                    f"AI INTERPRETATION: Historical precedent strongly supports '{label}'. "
                    f"Verified resolution confirmed across {len(successful)} plant incident(s)."
                )
                conflicts.append(
                    ConflictingRepairAnalysis(
                        repair_action=label,
                        normalized_action=norm_key,
                        recommendation_status="RECOMMENDED",
                        conflict_detected=False,
                        successful_precedents=successful,
                        unsuccessful_precedents=[],
                        differentiating_factors=[
                            f"Consistent verified resolution across {', '.join(s.case_id for s in successful)}."
                        ],
                        observed_historical_evidence=observed_evidence,
                        ai_interpretation=ai_interpretation,
                        suggested_diagnostic_checks=[
                            f"Proceed with standard verification protocol for {label}."
                        ],
                    )
                )

        # Build summary statement
        if overall_conflict_detected:
            summary = (
                f"Conflicting historical repair outcomes detected for {len(caution_actions)} action(s). "
                f"The proposed repair has produced both successful and unsuccessful outcomes in past plant incidents. "
                f"Differential diagnostic checks required before executing physical repair."
            )
        elif caution_actions:
            summary = (
                f"Historical precedents identify previously unsuccessful repair action(s): {', '.join(caution_actions)}. "
                f"Caution advised against repeating failed procedures."
            )
        elif recommended_actions:
            summary = (
                f"Historical precedents consistently support: {', '.join(recommended_actions)}. "
                f"No conflicting outcomes found in plant memory."
            )
        else:
            summary = "Insufficient historical precedent records exist to confirm or refute conflicting repair outcomes."

        return RepairDecisionIntelligence(
            has_conflict=overall_conflict_detected,
            summary=summary,
            conflicts=conflicts,
            recommended_action=recommended_actions[0] if recommended_actions else None,
            caution_actions=caution_actions,
            suggested_diagnostic_checks=list(dict.fromkeys(global_diagnostics)),
        )


repair_conflict_service = RepairConflictService()
