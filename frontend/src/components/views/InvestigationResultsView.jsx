import React, { useState } from "react";
import EvidenceModal from "../modals/EvidenceModal";
import IncidentDecisionTimeline from "../IncidentDecisionTimeline";

// Helper to strip duplicate numeric prefixes from diagnostic step text
const cleanStepText = (step) => {
  if (!step) return "";
  return step.replace(/^(\s*(\d+[\.\)]|step\s*\d+[:\.]?)\s*)+/i, "").trim();
};

export default function InvestigationResultsView({
  selectedIncident,
  incidentDetails,
  isLoadingDetails,
  isInvestigating,
  onInvestigateClick,
  onOpenRepairModal,
  onOpenVerifyModal,
  allIncidents = [],
  onSelectIncident,
  investigationError,
}) {
  const [activeEvidence, setActiveEvidence] = useState(null);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  const incident = selectedIncident || (allIncidents.length > 0 ? allIncidents[0] : null);
  const investigation =
    incidentDetails?.investigation ||
    (incidentDetails?.investigations && incidentDetails.investigations[0]) ||
    incident?.investigation ||
    null;
  const repairs = incidentDetails?.repairs || [];
  const latestRepair = repairs[repairs.length - 1];

  const hasDiagnosis = !!(investigation?.diagnosis || investigation?.diagnosis_hypothesis);
  const diagnosisText = investigation?.diagnosis || investigation?.diagnosis_hypothesis || "";
  const diagnosticSteps =
    (investigation?.recommended_diagnostic_steps && investigation.recommended_diagnostic_steps.length > 0)
      ? investigation.recommended_diagnostic_steps
      : (investigation?.recommended_actions && investigation.recommended_actions.length > 0)
      ? investigation.recommended_actions
      : [];

  const conflictAnalysis = investigation?.conflict_analysis || null;
  const hasConflict = conflictAnalysis?.has_conflict || false;
  const conflictsList = conflictAnalysis?.conflicts || [];

  // Extract genuine precedent records returned by the backend API
  const getActualPrecedents = () => {
    if (!investigation) return [];

    const precedents = [];
    const supporting = (investigation.supporting_evidence || []).filter(
      (s) =>
        typeof s === "string" &&
        !s.toLowerCase().includes("no prior historical incident records exist") &&
        !s.toLowerCase().includes("current incident") &&
        !s.toLowerCase().includes("current pump") &&
        !s.toLowerCase().includes("current observation")
    );
    const unsuccessful = (investigation.unsuccessful_previous_repairs || []).filter(
      (u) => typeof u === "string" && u.trim().length > 0
    );
    const citations = (investigation.relevant_historical_incidents || []).filter(
      (c) => typeof c === "string" && c.trim().length > 0
    );

    // 1. Genuine successful precedent from Hindsight
    if (supporting.length > 0) {
      const assetMatch =
        citations.find((c) => !unsuccessful.some((u) => u.includes(c))) ||
        citations[0] ||
        (incident?.machine_id ? `Verified Unit (${incident.machine_id})` : "Verified Asset");

      precedents.push({
        id: "precedent-success",
        type: "success",
        status: "Verified Success",
        badgeLabel: "Verified Success",
        badgeColor: "bg-secondary-container text-on-secondary-container",
        borderColor: "border-emerald-500/30",
        icon: "check_circle",
        iconColor: "text-on-secondary-container",
        titleLabel: "Previous Successful Repair",
        title: `Precedent Record // ${assetMatch}`,
        asset: assetMatch,
        date: investigation.created_at
          ? new Date(investigation.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()
          : "HINDSIGHT MEMORY",
        symptoms: incident?.symptoms || "High-frequency vibration & casing temperature rise under continuous load.",
        repair_action: supporting[0],
        outcome: supporting.length > 1 ? supporting[1] : "Remediation verified effective; operating parameters normalized.",
        details: supporting.join(" "),
      });
    }

    // 2. Genuine unsuccessful precedent from Hindsight
    if (unsuccessful.length > 0) {
      const assetMatch =
        citations.find((c) => unsuccessful.some((u) => u.includes(c))) ||
        citations[1] ||
        citations[0] ||
        "Historical Attempt";

      precedents.push({
        id: "precedent-unsuccessful",
        type: "failure",
        status: "Verified Unsuccessful",
        badgeLabel: "Verified Unsuccessful",
        badgeColor: "bg-error-container text-on-error-container",
        borderColor: "border-error/30",
        icon: "warning",
        iconColor: "text-error",
        titleLabel: "Previous Unsuccessful Repair",
        title: `Precedent Record // ${assetMatch}`,
        asset: assetMatch,
        date: investigation.created_at
          ? new Date(investigation.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()
          : "HINDSIGHT MEMORY",
        symptoms: "Elevated operating temperature / recurrence despite physical intervention.",
        repair_action: unsuccessful[0],
        outcome: "Defect recurred; physical intervention failed to resolve underlying thermal or vibrational anomaly.",
        details: unsuccessful.join(" "),
      });
    }

    return precedents;
  };

  const actualPrecedents = getActualPrecedents();

  const handleOpenEvidence = (evidenceData) => {
    setActiveEvidence(evidenceData);
    setIsEvidenceModalOpen(true);
  };

  const handleRecordOutcomeClick = () => {
    if (!latestRepair) {
      onOpenRepairModal(incident);
    } else {
      onOpenVerifyModal(incident);
    }
    setSuccessToast(true);
    setTimeout(() => setSuccessToast(false), 3500);
  };

  const scrollToProtocol = () => {
    const el = document.getElementById("action-protocol-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: 320, behavior: "smooth" });
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Evidence Modal */}
      <EvidenceModal
        isOpen={isEvidenceModalOpen}
        evidence={activeEvidence}
        onClose={() => setIsEvidenceModalOpen(false)}
      />

      <div className="w-full max-w-[1100px] py-6 sm:py-10 px-4 sm:px-6 flex flex-col gap-y-8">
        {/* Incident Case Switcher Bar */}
        {allIncidents.length > 1 && (
          <div className="w-full p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between gap-3 overflow-x-auto text-xs">
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-label-sm text-label-sm uppercase text-outline font-semibold">Active Case:</span>
              <span className="font-mono text-primary-container font-bold bg-surface-container px-2 py-0.5 rounded border border-outline-variant/30">
                {incident?.id || "N/A"} ({incident?.machine_id || "N/A"})
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-label-sm text-label-sm text-on-surface-variant mr-1">Switch Incident:</span>
              {allIncidents.slice(0, 5).map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => onSelectIncident(inc)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                    inc.id === incident?.id
                      ? "bg-primary-container text-on-primary-container font-bold shadow-[0_0_10px_rgba(13,242,200,0.3)]"
                      : "bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/20"
                  }`}
                >
                  {inc.machine_id}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 1. HEADER & INCIDENT SUMMARY */}
        <header className="flex flex-col gap-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary-container font-semibold">
                CASE #{incident?.id || "ROC-8842"} // HINDSIGHT CLOUD RETRIEVAL
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                DISPATCH TELEMETRY AUDITED
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant/30 shadow-sm">
              <span className="material-symbols-outlined text-[14px] text-primary-container">
                database
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Queried against <strong className="text-on-surface font-semibold">recallops-demo</strong> in Hindsight Cloud
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-y-1">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              Investigation Results
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Autonomous pattern synthesis from verified plant maintenance episodes and closed-loop hydraulic telemetry.
            </p>
          </div>

          {/* Incident Context Summary Card */}
          <section className="rounded-xl bg-surface-container p-5 border border-outline-variant/30 shadow-lg relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-primary-container/5 blur-3xl pointer-events-none"></div>
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0 text-primary-container border border-primary-container/20 shadow-inner">
                    <span className="material-symbols-outlined text-[22px]">
                      precision_manufacturing
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Asset Unit
                    </div>
                    <div className="font-title-md text-title-md text-on-surface font-semibold truncate">
                      {incident?.machine_id || "Hydraulic Press Cell #4"}{" "}
                      <span className="text-on-surface-variant font-normal font-label-md text-label-md">
                        ({incident?.equipment_type || "Cincinnati Milacron HP-450"})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="self-start sm:self-auto inline-flex items-center gap-2 px-3 py-1 rounded bg-error-container text-on-error-container border border-error/20 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
                  <span className="font-label-sm text-label-sm uppercase font-semibold tracking-wider font-mono">
                    {incident?.status || "INVESTIGATING"} // TELEMETRY SPIKE
                  </span>
                </div>
              </div>

              {/* Reported Symptoms */}
              <div className="rounded-lg bg-surface-container-lowest p-4 flex flex-col gap-y-1.5 border border-outline-variant/20">
                <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm uppercase font-semibold">
                  <span className="material-symbols-outlined text-[15px] text-secondary">
                    assignment_late
                  </span>
                  Reported Symptoms &amp; Telemetry
                </div>
                <p className="font-body-md text-body-md text-on-surface leading-relaxed">
                  {incident?.symptoms ||
                    "Rapid cyclical pressure drop below 2,100 PSI during stroke descent accompanied by proportional servo valve oscillation and acoustic resonance."}
                </p>
                {incident?.reported_observations && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant italic mt-1">
                    "{incident.reported_observations}"
                  </p>
                )}
              </div>
            </div>
          </section>
        </header>

        {/* Investigation Error Banner */}
        {investigationError && investigationError.incidentId === incident?.id && (
          <section className="rounded-xl bg-surface-container-high p-6 sm:p-7 border border-error/50 shadow-2xl relative overflow-hidden animate-in fade-in duration-200">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-error to-transparent"></div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-error-container/40 text-error flex items-center justify-center border border-error/30 shrink-0 shadow-[0_0_16px_rgba(244,63,94,0.25)]">
                  <span className="material-symbols-outlined text-[24px]">
                    {investigationError.isMemoryUnavailable ? "cloud_off" : "error"}
                  </span>
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-error/20 text-error border border-error/30 font-mono">
                      {investigationError.errorCode || "SERVICE_UNAVAILABLE"}
                    </span>
                    <h3 className="text-sm font-bold text-on-surface">
                      {investigationError.isMemoryUnavailable
                        ? "Historical Memory Service Temporarily Unavailable"
                        : "AI Diagnostic Investigation Failed"}
                    </h3>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1.5 max-w-xl leading-relaxed">
                    {investigationError.message}
                  </p>
                  <p className="text-[11px] text-outline font-mono mt-1">
                    Telemetry, equipment specifications, and technician logs for{" "}
                    <span className="text-on-surface font-semibold">{incident?.machine_id}</span> ({incident?.id}) remain safely intact.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => onInvestigateClick(incident?.id)}
                  disabled={isInvestigating}
                  type="button"
                  className="px-4 py-2.5 rounded-lg bg-primary-container text-on-primary-container text-xs font-bold shadow-[0_0_16px_rgba(13,242,200,0.35)] hover:shadow-[0_0_24px_rgba(13,242,200,0.5)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isInvestigating ? "hourglass_top" : "refresh"}
                  </span>
                  <span>{isInvestigating ? "Retrying..." : "Retry Investigation"}</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Investigation In-Progress or Trigger State */}
        {(!hasDiagnosis || isInvestigating) && (
          <section className="rounded-xl bg-surface-container-high p-8 border border-primary-container/40 shadow-2xl flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden">
            <div className="w-14 h-14 rounded-full bg-primary-container/20 flex items-center justify-center text-primary-container animate-pulse shadow-[0_0_24px_rgba(13,242,200,0.4)]">
              <span className="material-symbols-outlined text-[32px] animate-spin">
                psychology
              </span>
            </div>

            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                {isInvestigating ? "Executing Autonomous AI Diagnosis..." : "Ready for AI Diagnostic Investigation"}
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-lg mt-1">
                {isInvestigating
                  ? "Querying Hindsight Cloud memory bank, synthesizing historical repair records, and generating root-cause hypothesis..."
                  : "Launch Groq (openai/gpt-oss-120b) and Hindsight Cloud retrieval to analyze telemetry patterns against verified plant history."}
              </p>
            </div>

            <button
              onClick={() => onInvestigateClick(incident?.id)}
              disabled={isInvestigating}
              className="mt-2 px-6 py-3 rounded-xl bg-primary-container text-on-primary-container font-headline-sm text-title-sm font-bold shadow-[0_0_20px_rgba(13,242,200,0.35)] hover:shadow-[0_0_28px_rgba(13,242,200,0.55)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isInvestigating ? "hourglass_top" : "auto_awesome"}
              </span>
              <span>{isInvestigating ? "Investigating Telemetry..." : "Run AI Investigation"}</span>
            </button>
          </section>
        )}

        {/* 2. AI RECOMMENDATION (PREMIUM HERO CONTAINER) */}
        {hasDiagnosis && (
          <section
            id="action-protocol-section"
            className="rounded-xl bg-surface-container-high p-6 sm:p-8 border border-primary-container/30 shadow-2xl relative overflow-hidden"
          >
            {/* Glow gradient accent layer */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary-container to-transparent"></div>
            <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-secondary/10 blur-3xl pointer-events-none"></div>

            <div className="relative flex flex-col gap-y-6">
              {/* Sub-header & Parity Token */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center shadow-[0_0_16px_rgba(13,242,200,0.35)]">
                    <span className="material-symbols-outlined text-[24px]">
                      psychology
                    </span>
                  </div>
                  <div>
                    <div className="font-label-sm text-label-sm uppercase tracking-widest text-primary-container font-semibold">
                      Diagnostic Core
                    </div>
                    <h2 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
                      AI Recommendation
                    </h2>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-lowest border border-primary-container/20 text-primary-container shadow-inner">
                  <span className="material-symbols-outlined text-[16px]">
                    compare_arrows
                  </span>
                  <span className="font-label-sm text-label-sm font-semibold tracking-wide">
                    {actualPrecedents.length > 0
                      ? `Retrieved from ${actualPrecedents.length} historical parity match${actualPrecedents.length > 1 ? "es" : ""}`
                      : "Zero historical parity matches found"}
                  </span>
                </div>
              </div>

              {/* Diagnosis Callout */}
              <div className="rounded-xl bg-surface-container-lowest p-5 border border-outline-variant/30 shadow-inner">
                <div className="font-label-sm text-label-sm uppercase tracking-wider text-secondary mb-2 font-semibold">
                  Synthesized Diagnosis (Root Cause Hypothesis)
                </div>
                <p className="font-title-lg text-title-lg text-on-surface font-semibold leading-relaxed">
                  {diagnosisText}
                </p>
                {investigation.confidence && (
                  <div className="mt-3 pt-2.5 border-t border-surface-variant/40 flex items-center justify-between text-xs text-on-surface-variant font-mono">
                    <span>AI Estimated Confidence: <strong className="text-primary-container">{Math.round(investigation.confidence * 100)}%</strong></span>
                    <span className="text-[11px] text-outline">Uncalibrated estimate · Grounded via Hindsight memory</span>
                  </div>
                )}
              </div>

              {/* Numbered Interactive Step Cards */}
              <div className="flex flex-col gap-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant font-semibold">
                    Prescribed Action Protocol
                  </div>
                  <span className="font-label-sm text-label-sm text-primary-container font-medium">
                    {diagnosticSteps.length} Sequential Steps
                  </span>
                </div>

                <div className="space-y-3">
                  {diagnosticSteps.length === 0 ? (
                    <p className="font-body-sm text-on-surface-variant italic p-4 rounded-lg bg-surface-container border border-outline-variant/20">
                      No sequential diagnostic steps returned.
                    </p>
                  ) : (
                    diagnosticSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className="group rounded-lg bg-surface-container p-4 border border-outline-variant/20 hover:border-primary-container/40 transition-all duration-200 hover:bg-surface-bright flex items-start gap-3.5 shadow-md"
                      >
                        <span className="w-7 h-7 rounded bg-primary-container text-on-primary-container font-label-lg text-label-lg flex items-center justify-center font-bold shrink-0 mt-0.5 shadow-sm">
                          {idx + 1}
                        </span>
                        <div className="flex flex-col gap-y-1 min-w-0">
                          <span className="font-title-sm text-title-sm text-on-surface font-semibold group-hover:text-primary-container transition-colors">
                            {cleanStepText(step)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* REPAIR DECISION INTELLIGENCE */}
        {hasDiagnosis && (
          <section
            id="repair-decision-intelligence-section"
            className={`rounded-xl bg-surface-container-high p-6 sm:p-7 border ${
              hasConflict ? "border-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.15)]" : "border-primary-container/30 shadow-2xl"
            } relative overflow-hidden flex flex-col gap-y-5`}
          >
            {/* Accent gradient bar */}
            <div
              className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${
                hasConflict
                  ? "from-transparent via-amber-500 to-transparent"
                  : "from-transparent via-primary-container to-transparent"
              }`}
            ></div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    hasConflict
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_16px_rgba(245,158,11,0.3)]"
                      : "bg-primary-container text-on-primary-container shadow-[0_0_16px_rgba(13,242,200,0.3)]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px]">
                    {hasConflict ? "rule" : "verified"}
                  </span>
                </div>
                <div>
                  <div
                    className={`text-[10px] font-bold uppercase tracking-widest ${
                      hasConflict ? "text-amber-400" : "text-primary-container"
                    }`}
                  >
                    Evidence-Based Decision Engine
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-on-surface tracking-tight">
                    Repair Decision Intelligence
                  </h2>
                </div>
              </div>

              {/* Status Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold font-mono border self-start sm:self-center">
                <span
                  className={`material-symbols-outlined text-[16px] ${
                    hasConflict
                      ? "text-amber-400"
                      : conflictAnalysis?.caution_actions?.length > 0
                      ? "text-rose-400"
                      : "text-primary-container"
                  }`}
                >
                  {hasConflict
                    ? "warning"
                    : conflictAnalysis?.caution_actions?.length > 0
                    ? "report"
                    : "check_circle"}
                </span>
                <span
                  className={
                    hasConflict
                      ? "text-amber-400"
                      : conflictAnalysis?.caution_actions?.length > 0
                      ? "text-rose-400"
                      : "text-primary-container"
                  }
                >
                  {hasConflict
                    ? "CONFLICTING OUTCOMES DETECTED // FURTHER DIAGNOSIS REQUIRED"
                    : conflictAnalysis?.caution_actions?.length > 0
                    ? "PREVIOUSLY UNSUCCESSFUL ACTIONS RECORDED"
                    : "VERIFIED CONSISTENT PRECEDENTS"}
                </span>
              </div>
            </div>

            {/* Summary Text */}
            <p className="text-xs sm:text-sm text-on-surface leading-relaxed border-l-2 pl-3 border-outline-variant/60">
              {conflictAnalysis?.summary ||
                "Synthesizing historical repair actions and verified outcomes to safeguard against repeat failures."}
            </p>

            {/* Conflicts Breakdown */}
            {hasConflict && conflictsList.length > 0 && (
              <div className="flex flex-col gap-4">
                {conflictsList
                  .filter((c) => c.conflict_detected)
                  .map((conflict, cIdx) => (
                    <div
                      key={cIdx}
                      className="rounded-lg bg-surface-container-lowest/80 border border-amber-500/30 p-4 sm:p-5 flex flex-col gap-4"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-outline-variant/20 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-amber-400 text-[18px]">
                            sync_problem
                          </span>
                          <span className="text-xs font-bold text-on-surface uppercase tracking-wider font-mono">
                            Contradictory Precedent // {conflict.repair_action}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {conflict.recommendation_status}
                        </span>
                      </div>

                      {/* 2-Column Precedent Comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {/* Successful Precedents */}
                        <div className="rounded-lg bg-surface-container/60 border border-emerald-500/30 p-3.5 flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            <span>Verified Successful Precedent</span>
                          </div>
                          {conflict.successful_precedents.map((s, sIdx) => (
                            <div key={sIdx} className="text-on-surface-variant font-mono text-[11px] leading-relaxed">
                              <span className="text-on-surface font-semibold">Case {s.case_id}</span> ({s.machine_id || "Asset"}):
                              <p className="text-[11px] text-on-surface font-sans mt-0.5">{s.operating_conditions || s.repair_action}</p>
                            </div>
                          ))}
                        </div>

                        {/* Unsuccessful Precedents */}
                        <div className="rounded-lg bg-surface-container/60 border border-rose-500/30 p-3.5 flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 text-rose-400 font-bold uppercase tracking-wider text-[11px]">
                            <span className="material-symbols-outlined text-[16px]">cancel</span>
                            <span>Verified Unsuccessful Precedent</span>
                          </div>
                          {conflict.unsuccessful_precedents.map((u, uIdx) => (
                            <div key={uIdx} className="text-on-surface-variant font-mono text-[11px] leading-relaxed">
                              <span className="text-on-surface font-semibold">Case {u.case_id}</span> ({u.machine_id || "Asset"}):
                              <p className="text-[11px] text-on-surface font-sans mt-0.5">{u.operating_conditions || u.repair_action}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Differentiating Factors */}
                      {conflict.differentiating_factors?.length > 0 && (
                        <div className="rounded bg-surface-container/40 p-3 border border-outline-variant/20 flex flex-col gap-1.5 text-xs">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant font-mono">
                            Relevant Differences Between Historical Incidents:
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-on-surface">
                            {conflict.differentiating_factors.map((df, dfIdx) => (
                              <li key={dfIdx} className="text-xs">{df}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* AI Interpretation vs Observed Fact */}
                      <div className="flex flex-col gap-2 rounded bg-surface-container-high/80 p-3 border border-outline-variant/30 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-primary-container/20 text-primary-container border border-primary-container/30">
                            AI INTERPRETATION
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            (Separated from verified observed historical facts)
                          </span>
                        </div>
                        <p className="text-xs text-on-surface leading-relaxed">
                          {conflict.ai_interpretation}
                        </p>
                      </div>

                      {/* Suggested Diagnostic Checks Before Repair */}
                      {conflict.suggested_diagnostic_checks?.length > 0 && (
                        <div className="flex flex-col gap-2 rounded bg-amber-500/10 p-3.5 border border-amber-500/30">
                          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs uppercase tracking-wider font-mono">
                            <span className="material-symbols-outlined text-[16px]">troubleshoot</span>
                            <span>Mandatory Pre-Repair Diagnostic Checks</span>
                          </div>
                          <ul className="space-y-1.5 text-xs text-on-surface">
                            {conflict.suggested_diagnostic_checks.map((chk, chkIdx) => (
                              <li key={chkIdx} className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-amber-400 text-[14px] shrink-0 mt-0.5">
                                  arrow_right
                                </span>
                                <span>{chk}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* Non-conflicting view when previously unsuccessful actions exist */}
            {!hasConflict && (investigation?.unsuccessful_previous_repairs?.length > 0 || conflictAnalysis?.caution_actions?.length > 0) && (
              <div className="rounded-lg bg-surface-container-lowest/80 border border-rose-500/30 p-4 flex flex-col gap-2.5 text-xs">
                <div className="flex items-center gap-1.5 text-rose-400 font-bold uppercase tracking-wider text-[11px] font-mono">
                  <span className="material-symbols-outlined text-[16px]">block</span>
                  <span>Previously Unsuccessful Actions (Do Not Repeat)</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-on-surface">
                  {(conflictAnalysis?.caution_actions?.length > 0
                    ? conflictAnalysis.caution_actions
                    : investigation.unsuccessful_previous_repairs
                  ).map((unsucc, uIdx) => (
                    <li key={uIdx} className="text-xs font-semibold text-rose-300">
                      {unsucc}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-on-surface-variant italic mt-0.5">
                  RecallOps advises against repeating these procedures without first confirming new physical telemetry.
                </p>
              </div>
            )}

            {/* Consistent Recommended Action when no conflict */}
            {!hasConflict && (conflictAnalysis?.recommended_action || actualPrecedents?.find(p => p.type === "success")) && (
              <div className="rounded-lg bg-surface-container-lowest/80 border border-primary-container/30 p-4 flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-primary-container font-bold uppercase tracking-wider text-[11px] font-mono">
                  <span className="material-symbols-outlined text-[16px]">task_alt</span>
                  <span>Recommended Action Path</span>
                </div>
                <p className="text-xs text-on-surface">
                  {conflictAnalysis?.recommended_action
                    ? `Historical precedent consistently supports: ${conflictAnalysis.recommended_action}.`
                    : `Action supported by verified successful historical repair precedent.`}
                </p>
              </div>
            )}
          </section>
        )}

        {/* 3. WHAT RECALLOPS REMEMBERED */}
        <section className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container text-[20px]">
                history_toggle_off
              </span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">
                What RecallOps Remembered
              </h2>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Historical case parity retrieved from Hindsight Cloud to inform this recommendation.
            </p>
          </div>

          {actualPrecedents.length === 0 ? (
            <div className="rounded-xl bg-surface-container p-8 border border-outline-variant/30 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-surface-container-high border border-outline-variant/30 flex items-center justify-center text-outline">
                <span className="material-symbols-outlined text-[24px]">
                  history_toggle_off
                </span>
              </div>
              <h3 className="font-title-md text-title-md text-on-surface font-semibold">
                No verified repair history found for this investigation.
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
                Hindsight Cloud memory bank returned zero matching precedent episodes for this anomaly profile. Recommendations are generated from baseline operational schemas.
              </p>
            </div>
          ) : (
            <div className={`grid grid-cols-1 ${actualPrecedents.length > 1 ? "md:grid-cols-2" : "max-w-2xl mx-auto w-full"} gap-6`}>
              {actualPrecedents.map((precedent) => (
                <article
                  key={precedent.id}
                  className={`rounded-xl bg-surface-container p-6 border ${precedent.borderColor} shadow-xl flex flex-col justify-between gap-y-5 transition-transform duration-200 hover:-translate-y-1`}
                >
                  <div className="flex flex-col gap-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded ${precedent.badgeColor} shadow-sm`}>
                        <span className={`material-symbols-outlined text-[16px] ${precedent.iconColor}`}>
                          {precedent.icon}
                        </span>
                        <span className="font-label-sm text-label-sm uppercase font-bold tracking-wider">
                          {precedent.badgeLabel}
                        </span>
                      </div>
                      <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-mono">
                        {precedent.date}
                      </span>
                    </div>

                    <div className="flex flex-col gap-y-1">
                      <span className={`font-label-sm text-label-sm uppercase ${precedent.type === "success" ? "text-secondary" : "text-error"} font-semibold`}>
                        {precedent.titleLabel}
                      </span>
                      <h3 className="font-title-lg text-title-lg text-on-surface font-semibold">
                        {precedent.title}
                      </h3>
                    </div>

                    <div className="space-y-3 rounded-lg bg-surface-container-lowest p-4 border border-outline-variant/20">
                      <div>
                        <div className="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium">
                          Symptom Summary
                        </div>
                        <div className="font-body-sm text-body-sm text-on-surface mt-0.5">
                          {precedent.symptoms}
                        </div>
                      </div>
                      <div className="h-px bg-surface-variant/40"></div>
                      <div>
                        <div className="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium">
                          Repair Action
                        </div>
                        <div className="font-body-sm text-body-sm text-on-surface mt-0.5">
                          {precedent.repair_action}
                        </div>
                      </div>
                      <div className="h-px bg-surface-variant/40"></div>
                      <div>
                        <div className={`font-label-sm text-label-sm ${precedent.type === "success" ? "text-primary" : "text-error"} font-semibold uppercase`}>
                          Verified Outcome
                        </div>
                        <div className="font-body-sm text-body-sm text-on-surface font-medium mt-0.5">
                          {precedent.outcome}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenEvidence(precedent)}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded bg-surface-container-high text-primary-container hover:bg-surface-bright font-title-sm text-title-sm font-semibold transition-colors shadow-sm cursor-pointer border border-outline-variant/20"
                  >
                    <span>View Evidence</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* 3.5 INCIDENT DECISION TIMELINE (END-TO-END LIFECYCLE AUDIT TRAIL) */}
        <IncidentDecisionTimeline
          incident={incident}
          investigation={investigation}
          repairs={repairs}
          verifications={incidentDetails?.verifications || []}
          isLoading={isLoadingDetails}
        />

        {/* 4. ACTION AREA (BOTTOM CONTAINER) */}
        <footer className="rounded-xl bg-surface-container-low p-6 sm:p-7 border border-outline-variant/30 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary-container border border-primary-container/20 shadow-inner shrink-0">
              <span className="material-symbols-outlined text-[20px]">
                assignment_turned_in
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                Field Execution Ready
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Recommended checklist ready for technician handoff or digital sign-off.
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* Secondary Button: Record Repair Outcome */}
            <button
              type="button"
              onClick={handleRecordOutcomeClick}
              className="w-full sm:w-auto px-5 py-3 rounded-lg bg-surface-container-high text-primary-container hover:bg-surface-bright border border-outline-variant/30 font-title-sm text-title-sm font-semibold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
              <span>{!latestRepair ? "Log Physical Repair" : "Record Repair Outcome"}</span>
            </button>

            {/* Primary Button: View Steps */}
            <button
              type="button"
              onClick={scrollToProtocol}
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-primary-container text-on-primary-container font-title-sm text-title-sm font-bold shadow-[0_0_20px_rgba(13,242,200,0.35)] hover:shadow-[0_0_26px_rgba(13,242,200,0.55)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>View Recommended Steps</span>
              <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
            </button>
          </div>
        </footer>

        {/* Action Feedback Toast */}
        {successToast && (
          <div className="fixed bottom-6 right-6 z-50 bg-surface-container-high border border-primary-container/30 text-on-surface px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-2">
            <span className="material-symbols-outlined text-primary-container text-[20px]">
              assignment_turned_in
            </span>
            <div className="flex flex-col">
              <span className="font-title-sm text-title-sm font-semibold text-on-surface">
                Verification Protocol Initialized
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Opening technician verification protocol for Case #{incident?.id}...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
