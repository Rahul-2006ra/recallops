import React, { useState } from "react";

// Safe date/time formatter
function formatTimestamp(isoString) {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return String(isoString);
  }
}

export default function IncidentDecisionTimeline({
  incident,
  investigation,
  repairs = [],
  verifications = [],
  isLoading = false,
}) {
  const [expandedStages, setExpandedStages] = useState({
    reported: true,
    investigation: true,
    repair: true,
    verification: true,
    retention: true,
  });

  const toggleStage = (stageKey) => {
    setExpandedStages((prev) => ({
      ...prev,
      [stageKey]: !prev[stageKey],
    }));
  };

  // Derive latest repair and verification
  const latestRepair = repairs && repairs.length > 0 ? repairs[repairs.length - 1] : null;
  const latestVerification =
    verifications && verifications.length > 0 ? verifications[verifications.length - 1] : null;

  // Determine stage completion states
  const hasReport = !!incident;
  const hasInvestigation = !!investigation && (!!investigation.diagnosis_hypothesis || !!investigation.diagnosis);
  const hasRepair = !!latestRepair && !!latestRepair.action_taken;
  const hasVerification = !!latestVerification && !!latestVerification.outcome_status;
  const hasRetention = hasVerification && latestVerification.hindsight_retained === true;

  const isSuccessful = latestVerification?.outcome_status === "SUCCESSFUL";
  const isUnsuccessful = latestVerification?.outcome_status === "UNSUCCESSFUL";

  if (!incident && !isLoading) {
    return (
      <div className="rounded-xl bg-surface-container p-6 border border-outline-variant/30 text-center text-on-surface-variant">
        <span className="material-symbols-outlined text-[32px] text-outline mb-2">
          timeline
        </span>
        <div className="font-title-sm text-title-sm text-on-surface font-semibold">
          No Incident Selected
        </div>
        <p className="font-body-sm text-body-sm mt-1">
          Select or report a machine incident to view its end-to-end decision lifecycle.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-xl bg-surface-container p-5 sm:p-6 border border-outline-variant/30 shadow-xl relative overflow-hidden flex flex-col gap-y-6">
      {/* Background ambient accent */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-primary-container/5 rounded-full blur-3xl pointer-events-none -z-10"></div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-container-high border border-primary-container/30 flex items-center justify-center text-primary-container shadow-inner shrink-0">
            <span className="material-symbols-outlined text-[22px]">route</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm text-primary-container uppercase font-mono font-bold tracking-wider">
                LIFECYCLE AUDIT TRAIL
              </span>
              <span className="text-outline-variant">•</span>
              <span className="font-mono text-xs text-on-surface-variant font-semibold">
                {incident?.id || "INC-ACTIVE"}
              </span>
            </div>
            <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
              Incident Decision Timeline
            </h2>
          </div>
        </div>

        {/* Global Progress Indicator */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-surface-container-lowest px-3 py-1.5 rounded-lg border border-outline-variant/20 text-xs font-mono">
          <span className="text-on-surface-variant uppercase font-medium">Stage:</span>
          <span
            className={`font-semibold uppercase ${
              hasRetention
                ? "text-primary-container"
                : hasVerification
                ? "text-secondary"
                : hasRepair
                ? "text-on-surface"
                : hasInvestigation
                ? "text-primary"
                : "text-outline"
            }`}
          >
            {hasRetention
              ? "5/5 Memory Retained"
              : hasVerification
              ? "4/5 Outcome Verified"
              : hasRepair
              ? "3/5 Repair Recorded"
              : hasInvestigation
              ? "2/5 AI Diagnosed"
              : "1/5 Anomaly Reported"}
          </span>
        </div>
      </div>

      {/* Timeline Steps Container */}
      <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-[15px] sm:before:left-[19px] before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-primary-container before:via-secondary/40 before:to-outline-variant/40">

        {/* =========================================================================
            STAGE 1: INCIDENT REPORTED
           ========================================================================= */}
        <div className="relative group">
          {/* Node Icon */}
          <div
            className={`absolute -left-[30px] sm:-left-[35px] top-0 w-8 h-8 rounded-full flex items-center justify-center border transition-all shadow-md ${
              hasReport
                ? "bg-primary-container text-on-primary-container border-primary-container shadow-[0_0_12px_rgba(13,242,200,0.4)]"
                : "bg-surface-container-high text-outline border-outline-variant"
            }`}
          >
            <span className="material-symbols-outlined text-[16px] font-bold">
              warning
            </span>
          </div>

          {/* Card Content */}
          <div className="rounded-lg bg-surface-container-low border border-outline-variant/30 p-4 transition-all hover:border-outline-variant/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-label-sm text-label-sm text-primary-container uppercase font-mono font-bold tracking-wider">
                    STAGE 1 // REPORTED
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-error-container text-on-error-container">
                    {incident?.severity || "MEDIUM"} SEVERITY
                  </span>
                </div>
                <h3 className="font-title-md text-title-md text-on-surface font-semibold">
                  Equipment Anomaly Detected
                </h3>
              </div>

              {/* Timestamp & Expand toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-xs text-on-surface-variant font-medium">
                  {formatTimestamp(incident?.timestamp || incident?.created_at) || "Timestamp N/A"}
                </span>
                <button
                  type="button"
                  onClick={() => toggleStage("reported")}
                  className="text-on-surface-variant hover:text-on-surface transition-colors p-1"
                  aria-label="Toggle Reported Stage Details"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {expandedStages.reported ? "expand_less" : "expand_more"}
                  </span>
                </button>
              </div>
            </div>

            {/* Stage Body */}
            {expandedStages.reported && (
              <div className="mt-3 pt-3 border-t border-outline-variant/20 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-on-surface-variant uppercase font-mono font-medium block">
                    Target Machine / Asset
                  </span>
                  <span className="text-on-surface font-semibold mt-0.5 block font-mono">
                    {incident?.machine_id || "Unassigned Unit"} —{" "}
                    <span className="text-on-surface-variant font-normal font-sans">
                      {incident?.equipment_type || "Industrial Asset"}
                    </span>
                  </span>
                </div>

                <div>
                  <span className="text-on-surface-variant uppercase font-mono font-medium block">
                    Telemetry Symptoms
                  </span>
                  <span className="text-on-surface mt-0.5 block line-clamp-2">
                    {incident?.symptoms || "No symptom summary provided."}
                  </span>
                </div>

                {incident?.reported_observations && (
                  <div className="sm:col-span-2 rounded bg-surface-container-lowest p-2.5 border border-outline-variant/15 text-on-surface-variant italic">
                    "{incident.reported_observations}"
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            STAGE 2: AI INVESTIGATION
           ========================================================================= */}
        <div className="relative group">
          {/* Node Icon */}
          <div
            className={`absolute -left-[30px] sm:-left-[35px] top-0 w-8 h-8 rounded-full flex items-center justify-center border transition-all shadow-md ${
              hasInvestigation
                ? "bg-secondary text-on-secondary border-secondary shadow-[0_0_12px_rgba(79,219,200,0.4)]"
                : "bg-surface-container-high text-outline border-outline-variant"
            }`}
          >
            <span className="material-symbols-outlined text-[16px] font-bold">
              psychology
            </span>
          </div>

          {/* Card Content */}
          <div className="rounded-lg bg-surface-container-low border border-outline-variant/30 p-4 transition-all hover:border-outline-variant/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-label-sm text-label-sm text-secondary uppercase font-mono font-bold tracking-wider">
                    STAGE 2 // AI INVESTIGATION
                  </span>
                  {hasInvestigation && typeof investigation.confidence === "number" && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-secondary-container text-on-secondary-container">
                      {Math.round(investigation.confidence * 100)}% CONFIDENCE
                    </span>
                  )}
                  {!hasInvestigation && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-surface-container-highest text-outline">
                      PENDING
                    </span>
                  )}
                </div>
                <h3 className="font-title-md text-title-md text-on-surface font-semibold">
                  Autonomous Diagnostic Reasoning
                </h3>
              </div>

              {/* Timestamp & Expand toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-xs text-on-surface-variant font-medium">
                  {hasInvestigation
                    ? formatTimestamp(investigation.created_at) || "Investigated"
                    : "Awaiting Trigger"}
                </span>
                {hasInvestigation && (
                  <button
                    type="button"
                    onClick={() => toggleStage("investigation")}
                    className="text-on-surface-variant hover:text-on-surface transition-colors p-1"
                    aria-label="Toggle Investigation Details"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {expandedStages.investigation ? "expand_less" : "expand_more"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Stage Body */}
            {hasInvestigation && expandedStages.investigation && (
              <div className="mt-3 pt-3 border-t border-outline-variant/20 flex flex-col gap-y-3 text-xs">
                <div>
                  <span className="text-on-surface-variant uppercase font-mono font-medium block">
                    Diagnostic Hypothesis
                  </span>
                  <p className="text-on-surface mt-1 leading-relaxed">
                    {investigation.diagnosis_hypothesis || investigation.diagnosis}
                  </p>
                </div>

                {/* Historical Precedents Recalled from Hindsight */}
                {investigation.relevant_historical_incidents &&
                  investigation.relevant_historical_incidents.length > 0 && (
                    <div>
                      <span className="text-on-surface-variant uppercase font-mono font-medium block">
                        Hindsight Precedent Citations
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {investigation.relevant_historical_incidents.map((citation, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container-high border border-primary-container/20 text-primary font-mono text-[11px]"
                          >
                            <span className="material-symbols-outlined text-[13px] text-primary-container">
                              memory
                            </span>
                            {citation}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Unsuccessful Repairs Flagged */}
                {investigation.unsuccessful_previous_repairs &&
                  investigation.unsuccessful_previous_repairs.length > 0 && (
                    <div className="rounded bg-error-container/20 border border-error/30 p-2.5 text-error">
                      <span className="uppercase font-mono font-bold flex items-center gap-1 text-[11px]">
                        <span className="material-symbols-outlined text-[14px]">cancel</span>
                        Previous Failed Interventions (Anti-Patterns to Avoid)
                      </span>
                      <ul className="list-disc list-inside mt-1 text-[11px] text-on-surface space-y-0.5">
                        {investigation.unsuccessful_previous_repairs.map((un, idx) => (
                          <li key={idx}>{un}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}

            {!hasInvestigation && (
              <div className="mt-2 text-xs text-on-surface-variant italic">
                Awaiting diagnostic investigation via Groq (gpt-oss-120b) and Hindsight Cloud.
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            STAGE 3: REPAIR ACTION
           ========================================================================= */}
        <div className="relative group">
          {/* Node Icon */}
          <div
            className={`absolute -left-[30px] sm:-left-[35px] top-0 w-8 h-8 rounded-full flex items-center justify-center border transition-all shadow-md ${
              hasRepair
                ? "bg-primary text-on-primary border-primary shadow-[0_0_12px_rgba(199,255,236,0.3)]"
                : "bg-surface-container-high text-outline border-outline-variant"
            }`}
          >
            <span className="material-symbols-outlined text-[16px] font-bold">
              build
            </span>
          </div>

          {/* Card Content */}
          <div className="rounded-lg bg-surface-container-low border border-outline-variant/30 p-4 transition-all hover:border-outline-variant/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-label-sm text-label-sm text-primary uppercase font-mono font-bold tracking-wider">
                    STAGE 3 // FIELD EXECUTION
                  </span>
                  {hasRepair && latestRepair.technician_id && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-surface-container-highest text-on-surface">
                      TECH: {latestRepair.technician_id}
                    </span>
                  )}
                  {!hasRepair && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-surface-container-highest text-outline">
                      PENDING
                    </span>
                  )}
                </div>
                <h3 className="font-title-md text-title-md text-on-surface font-semibold">
                  Physical Maintenance Intervention
                </h3>
              </div>

              {/* Timestamp & Expand toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-xs text-on-surface-variant font-medium">
                  {hasRepair ? formatTimestamp(latestRepair.performed_at) || "Completed" : "Pending Log"}
                </span>
                {hasRepair && (
                  <button
                    type="button"
                    onClick={() => toggleStage("repair")}
                    className="text-on-surface-variant hover:text-on-surface transition-colors p-1"
                    aria-label="Toggle Repair Stage Details"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {expandedStages.repair ? "expand_less" : "expand_more"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Stage Body */}
            {hasRepair && expandedStages.repair && (
              <div className="mt-3 pt-3 border-t border-outline-variant/20 flex flex-col gap-y-2.5 text-xs">
                <div>
                  <span className="text-on-surface-variant uppercase font-mono font-medium block">
                    Action Executed
                  </span>
                  <p className="text-on-surface font-medium mt-0.5">
                    {latestRepair.action_taken}
                  </p>
                </div>

                {latestRepair.parts_replaced && latestRepair.parts_replaced.trim() !== "" && (
                  <div>
                    <span className="text-on-surface-variant uppercase font-mono font-medium block">
                      Parts Replaced
                    </span>
                    <span className="text-on-surface font-mono mt-0.5 block">
                      {latestRepair.parts_replaced}
                    </span>
                  </div>
                )}

                {latestRepair.notes && (
                  <div className="rounded bg-surface-container-lowest p-2.5 border border-outline-variant/15 text-on-surface-variant">
                    <span className="text-outline uppercase font-mono font-semibold text-[10px] block mb-0.5">
                      Technician Notes
                    </span>
                    "{latestRepair.notes}"
                  </div>
                )}
              </div>
            )}

            {!hasRepair && (
              <div className="mt-2 text-xs text-on-surface-variant italic">
                {hasInvestigation
                  ? "Investigation complete. Field technician repair action pending entry."
                  : "Requires preceding AI diagnostic investigation."}
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            STAGE 4: OUTCOME VERIFICATION
           ========================================================================= */}
        <div className="relative group">
          {/* Node Icon */}
          <div
            className={`absolute -left-[30px] sm:-left-[35px] top-0 w-8 h-8 rounded-full flex items-center justify-center border transition-all shadow-md ${
              hasVerification
                ? isSuccessful
                  ? "bg-secondary-container text-on-secondary-container border-secondary-container shadow-[0_0_12px_rgba(4,180,162,0.4)]"
                  : "bg-error text-on-error border-error shadow-[0_0_12px_rgba(255,180,171,0.4)]"
                : "bg-surface-container-high text-outline border-outline-variant"
            }`}
          >
            <span className="material-symbols-outlined text-[16px] font-bold">
              {hasVerification ? (isSuccessful ? "verified" : "dangerous") : "pending_actions"}
            </span>
          </div>

          {/* Card Content */}
          <div className="rounded-lg bg-surface-container-low border border-outline-variant/30 p-4 transition-all hover:border-outline-variant/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-label-sm text-label-sm uppercase font-mono font-bold tracking-wider ${
                      hasVerification
                        ? isSuccessful
                          ? "text-secondary"
                          : "text-error"
                        : "text-outline"
                    }`}
                  >
                    STAGE 4 // OUTCOME VERIFICATION
                  </span>
                  {hasVerification && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        isSuccessful
                          ? "bg-secondary-container text-on-secondary-container"
                          : "bg-error-container text-on-error-container"
                      }`}
                    >
                      {latestVerification.outcome_status}
                    </span>
                  )}
                  {!hasVerification && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-surface-container-highest text-outline">
                      PENDING SIGN-OFF
                    </span>
                  )}
                </div>
                <h3 className="font-title-md text-title-md text-on-surface font-semibold">
                  Certified Post-Repair Inspection
                </h3>
              </div>

              {/* Timestamp & Expand toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-xs text-on-surface-variant font-medium">
                  {hasVerification
                    ? formatTimestamp(latestVerification.verified_at) || "Certified"
                    : "Awaiting Inspection"}
                </span>
                {hasVerification && (
                  <button
                    type="button"
                    onClick={() => toggleStage("verification")}
                    className="text-on-surface-variant hover:text-on-surface transition-colors p-1"
                    aria-label="Toggle Verification Stage Details"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {expandedStages.verification ? "expand_less" : "expand_more"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Stage Body */}
            {hasVerification && expandedStages.verification && (
              <div className="mt-3 pt-3 border-t border-outline-variant/20 flex flex-col gap-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-on-surface-variant uppercase font-mono font-medium block">
                      Certified By
                    </span>
                    <span className="text-on-surface font-mono font-semibold mt-0.5 block">
                      {latestVerification.verified_by}
                    </span>
                  </div>
                </div>

                {latestVerification.inspection_notes && (
                  <div>
                    <span className="text-on-surface-variant uppercase font-mono font-medium block">
                      Inspection Notes
                    </span>
                    <p className="text-on-surface mt-0.5 leading-relaxed">
                      {latestVerification.inspection_notes}
                    </p>
                  </div>
                )}

                {latestVerification.follow_up_metrics && (
                  <div className="rounded bg-surface-container-lowest p-2.5 border border-outline-variant/15">
                    <span className="text-outline uppercase font-mono font-semibold text-[10px] block mb-1">
                      Post-Repair Telemetry Validation
                    </span>
                    <div className="flex flex-wrap gap-3 font-mono text-[11px] text-primary">
                      {Object.entries(latestVerification.follow_up_metrics).map(([key, val]) => (
                        <span key={key} className="bg-surface-container px-2 py-0.5 rounded border border-outline-variant/20">
                          {key}: <strong className="text-on-surface">{String(val)}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!hasVerification && (
              <div className="mt-2 text-xs text-on-surface-variant italic">
                {hasRepair
                  ? "Repair recorded. Post-repair inspection and technician certification pending."
                  : "Awaiting physical repair execution before outcome verification."}
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            STAGE 5: HINDSIGHT MEMORY RETENTION
           ========================================================================= */}
        <div className="relative group">
          {/* Node Icon */}
          <div
            className={`absolute -left-[30px] sm:-left-[35px] top-0 w-8 h-8 rounded-full flex items-center justify-center border transition-all shadow-md ${
              hasRetention
                ? "bg-primary-container text-on-primary-container border-primary-container shadow-[0_0_14px_rgba(13,242,200,0.5)]"
                : "bg-surface-container-high text-outline border-outline-variant"
            }`}
          >
            <span className="material-symbols-outlined text-[16px] font-bold">
              {hasRetention ? "cloud_done" : "cloud_off"}
            </span>
          </div>

          {/* Card Content */}
          <div className="rounded-lg bg-surface-container-low border border-outline-variant/30 p-4 transition-all hover:border-outline-variant/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-label-sm text-label-sm uppercase font-mono font-bold tracking-wider ${
                      hasRetention ? "text-primary-container" : "text-outline"
                    }`}
                  >
                    STAGE 5 // MEMORY RETENTION
                  </span>
                  {hasRetention && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-primary-container/20 text-primary-container border border-primary-container/30">
                      COMMITTED TO CLOUD
                    </span>
                  )}
                  {!hasRetention && hasVerification && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-surface-container-highest text-outline">
                      LOCAL ONLY
                    </span>
                  )}
                  {!hasVerification && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-surface-container-highest text-outline">
                      BLOCKED UNTIL VERIFIED
                    </span>
                  )}
                </div>
                <h3 className="font-title-md text-title-md text-on-surface font-semibold">
                  Hindsight Cloud Long-Term Memory
                </h3>
              </div>

              {/* Timestamp & Expand toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-xs text-on-surface-variant font-medium">
                  {hasRetention
                    ? formatTimestamp(latestVerification.verified_at) || "Retained"
                    : "Not Committed"}
                </span>
                {hasRetention && (
                  <button
                    type="button"
                    onClick={() => toggleStage("retention")}
                    className="text-on-surface-variant hover:text-on-surface transition-colors p-1"
                    aria-label="Toggle Memory Retention Details"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {expandedStages.retention ? "expand_less" : "expand_more"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Stage Body */}
            {hasRetention && expandedStages.retention && (
              <div className="mt-3 pt-3 border-t border-outline-variant/20 flex flex-col gap-y-2 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono">
                  <div>
                    <span className="text-on-surface-variant uppercase text-[10px] block">
                      Document Identifier
                    </span>
                    <span className="text-primary font-semibold">
                      {latestVerification.hindsight_document_id || `OUTCOME-${incident?.id}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant uppercase text-[10px] block">
                      Target Cloud Memory Bank
                    </span>
                    <span className="text-on-surface font-semibold">recallops-demo</span>
                  </div>
                </div>

                <div className="rounded bg-surface-container-lowest p-2.5 border border-primary-container/20 text-on-surface-variant text-[11px] leading-relaxed">
                  <div className="flex items-center gap-1.5 text-primary-container font-semibold font-mono uppercase mb-0.5">
                    <span className="material-symbols-outlined text-[14px]">psychology_alt</span>
                    Episodic Transfer Verified
                  </div>
                  This verified maintenance episode is now permanently indexed in Hindsight Cloud. Future AI investigations across the plant fleet will recall this resolution to guide subsequent diagnoses.
                </div>
              </div>
            )}

            {!hasRetention && (
              <div className="mt-2 text-xs text-on-surface-variant italic">
                {hasVerification
                  ? "Outcome was recorded locally, but cloud memory retention was not confirmed by Hindsight backend."
                  : "Episodic memory retention is strictly gated. Only technician-certified outcomes are committed to long-term memory."}
              </div>
            )}
          </div>
        </div>

      </div>
    </section>
  );
}
