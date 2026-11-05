import React from "react";

export default function HindsightMemoryCenterpiece({
  selectedIncident,
  incidentDetails,
  isLoadingDetails,
  isInvestigating,
  onInvestigateClick,
  onRepairClick,
  onVerifyClick,
}) {
  if (!selectedIncident) {
    return (
      <section className="bg-white rounded-lg border border-slate-200 shadow-xs p-8 text-center text-slate-500">
        <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">find_in_page</span>
        <h3 className="text-sm font-bold text-slate-700">No Incident Selected</h3>
        <p className="text-xs text-slate-500 mt-1">
          Select an incident from the table below to inspect its Hindsight episodic memory and AI investigation.
        </p>
      </section>
    );
  }

  const investigations = incidentDetails?.investigations || [];
  const repairs = incidentDetails?.repairs || [];
  const verifications = incidentDetails?.verifications || [];

  const latestInvestigation = investigations.length > 0 ? investigations[0] : null;
  const latestRepair = repairs.length > 0 ? repairs[0] : null;
  const latestVerification = verifications.length > 0 ? verifications[0] : null;

  // Derive historical precedents with accurate machine attribution and verified outcomes
  const extractPrecedents = (inv) => {
    if (!inv) return { precedents: [], currentTelemetry: [] };

    const supportingEvidence = inv.supporting_evidence || [];
    const unsuccessfulRepairs = inv.unsuccessful_previous_repairs || [];
    const machineRegex = /\b(M-\d+|AUDIT-M-\d+|M-DUAL-\d+|DEMO-M-\d+|INC-\w+)\b/i;

    const unsuccMap = {};
    const succMap = {};
    const currentTelemetry = [];

    // 1. Group unsuccessful repairs by machine
    for (const item of unsuccessfulRepairs) {
      const match = item.match(machineRegex);
      const machine = match ? match[1].toUpperCase() : "Historical Failure";
      if (!unsuccMap[machine]) unsuccMap[machine] = [];
      unsuccMap[machine].push(item);
    }

    // 2. Group supporting evidence by machine and distinguish failures or current telemetry
    for (const item of supportingEvidence) {
      const isCurrentObservation = /\b(current pump|current observation|reached \d|vibration amplitude >|exceeds typical alarm)\b/i.test(item);
      if (isCurrentObservation) {
        currentTelemetry.push(item);
        continue;
      }

      const isUnsuccessfulRef = /\b(unsuccessful|failed|did not stop|persisted|recurred)\b/i.test(item);
      const match = item.match(machineRegex);
      const machine = match ? match[1].toUpperCase() : null;

      if (isUnsuccessfulRef) {
        const target = machine || "Historical Failure";
        if (!unsuccMap[target]) unsuccMap[target] = [];
        if (!unsuccMap[target].some((e) => e.toLowerCase().includes(item.slice(0, 25).toLowerCase()))) {
          unsuccMap[target].push(item);
        }
      } else if (machine) {
        if (!succMap[machine]) succMap[machine] = [];
        succMap[machine].push(item);
      } else {
        if (!succMap["Historical Precedent"]) succMap["Historical Precedent"] = [];
        succMap["Historical Precedent"].push(item);
      }
    }

    const precedents = [];

    // Add verified successful precedent cards
    for (const [machine, evidenceList] of Object.entries(succMap)) {
      precedents.push({
        id: `succ-${machine}`,
        machine,
        status: "SUCCESSFUL",
        badgeText: "VERIFIED SUCCESSFUL",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        borderClass: "border-emerald-200",
        badgeIcon: "check_circle",
        badgeIconClass: "text-emerald-600",
        evidenceLabel: "Supporting Precedent Evidence:",
        evidenceLabelClass: "text-emerald-900",
        evidenceList,
      });
    }

    // Add verified unsuccessful precedent cards
    for (const [machine, evidenceList] of Object.entries(unsuccMap)) {
      precedents.push({
        id: `unsucc-${machine}`,
        machine,
        status: "UNSUCCESSFUL",
        badgeText: "VERIFIED UNSUCCESSFUL",
        badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
        borderClass: "border-rose-200",
        badgeIcon: "cancel",
        badgeIconClass: "text-rose-600",
        evidenceLabel: "Ineffective / Failed Actions to Avoid:",
        evidenceLabelClass: "text-rose-900",
        evidenceList,
      });
    }

    return { precedents, currentTelemetry };
  };

  const { precedents, currentTelemetry } = extractPrecedents(latestInvestigation);
  const hasHistory = precedents.length > 0 || currentTelemetry.length > 0;

  // Status badge styling helper
  const getStatusBadge = (status) => {
    switch (status) {
      case "REPORTED":
        return {
          bg: "bg-amber-100 text-amber-900 border-amber-200",
          label: "Awaiting Investigation",
        };
      case "INVESTIGATING":
        return {
          bg: "bg-blue-100 text-blue-900 border-blue-200",
          label: "Investigating...",
        };
      case "INVESTIGATED":
        return {
          bg: "bg-purple-100 text-purple-900 border-purple-200",
          label: "Hypothesis Ready · Awaiting Repair",
        };
      case "REPAIRED":
        return {
          bg: "bg-amber-100 text-amber-900 border-amber-200",
          label: "Repair Logged · Awaiting Verification",
        };
      case "VERIFIED_SUCCESSFUL":
        return {
          bg: "bg-emerald-100 text-emerald-900 border-emerald-200",
          label: "Verified Successful · In Memory",
        };
      case "VERIFIED_UNSUCCESSFUL":
        return {
          bg: "bg-rose-100 text-rose-900 border-rose-200",
          label: "Verified Unsuccessful · In Memory",
        };
      default:
        return {
          bg: "bg-slate-100 text-slate-800 border-slate-200",
          label: status,
        };
    }
  };

  const statusBadge = getStatusBadge(selectedIncident.status);

  return (
    <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden flex flex-col">
      {/* Top Accent Bar */}
      <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-teal-500"></div>

      <div className="p-3.5 flex flex-col gap-3">
        {/* Active Context Banner: Current Incident Under Investigation */}
        <div className="bg-slate-50/90 rounded-md p-2.5 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[18px]">precision_manufacturing</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-900">
                  Current Incident — Machine {selectedIncident.machine_id}
                </span>
                <span className="text-slate-400 font-normal">|</span>
                <span className="text-xs font-semibold text-slate-700">
                  {selectedIncident.equipment_type}
                </span>
                <span className="text-slate-400 font-normal">|</span>
                <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                  {selectedIncident.id}
                </span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${statusBadge.bg}`}
                >
                  Status: {statusBadge.label}
                </span>
              </div>
              <div className="text-xs text-slate-700 mt-0.5">
                <span className="font-semibold text-red-600">Reported Symptom:</span>{" "}
                {selectedIncident.symptoms}
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200 self-start md:self-auto shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span>
              Memory Retrieval:{" "}
              <strong className="text-slate-900 font-semibold">
                {latestInvestigation
                  ? `Matched ${latestInvestigation.relevant_historical_incidents.length} Precedent(s)`
                  : "Pending AI Investigation"}
              </strong>
            </span>
          </div>
        </div>

        {/* 3 Information Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* COLUMN A: HISTORICAL EVIDENCE */}
          <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-200 flex flex-col justify-between gap-2.5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-slate-700 text-[16px]">history_edu</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Historical Evidence
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Episodic Records
                </span>
              </div>

              {isLoadingDetails ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  <span className="material-symbols-outlined animate-spin text-xl mb-1">sync</span>
                  <p>Loading historical precedents from Hindsight...</p>
                </div>
              ) : latestInvestigation ? (
                <div className="flex flex-col gap-2">
                  {/* Distinct Historical Precedent Cards (Accurately Labeled by Ground Truth) */}
                  {precedents.map((prec) => (
                    <div
                      key={prec.id}
                      className={`bg-white rounded-md p-2.5 border ${prec.borderClass} shadow-2xs flex flex-col gap-1.5`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 font-mono">
                          {prec.machine}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${prec.badgeClass}`}
                        >
                          <span className={`material-symbols-outlined text-[12px] ${prec.badgeIconClass}`}>
                            {prec.badgeIcon}
                          </span>
                          {prec.badgeText}
                        </span>
                      </div>

                      <div
                        className={`p-2 rounded border text-[11px] flex flex-col gap-0.5 ${
                          prec.status === "SUCCESSFUL"
                            ? "bg-emerald-50/50 border-emerald-100/70"
                            : "bg-rose-50/50 border-rose-100/70"
                        }`}
                      >
                        <span
                          className={`font-bold uppercase text-[9px] tracking-wide ${prec.evidenceLabelClass}`}
                        >
                          {prec.evidenceLabel}
                        </span>
                        <ul className="list-disc pl-3 font-medium text-slate-800 leading-tight space-y-0.5">
                          {prec.evidenceList.map((ev, idx) => (
                            <li key={idx}>{ev}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}

                  {/* Active Incident Telemetry Context */}
                  {currentTelemetry.length > 0 && (
                    <div className="bg-slate-50/80 rounded-md p-2 border border-slate-200 text-[11px] flex flex-col gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                        Current Telemetry Context:
                      </span>
                      <ul className="list-disc pl-3 font-medium text-slate-700 leading-tight space-y-0.5">
                        {currentTelemetry.map((tel, idx) => (
                          <li key={idx}>{tel}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!hasHistory && (
                    <div className="bg-white rounded-md p-3 border border-slate-200 text-xs text-slate-500 text-center">
                      No matching historical memories found for this symptom yet.
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-md p-4 border border-slate-200 text-center flex flex-col items-center gap-1.5">
                  <span className="material-symbols-outlined text-slate-400 text-2xl">manage_search</span>
                  <span className="text-xs font-semibold text-slate-700">Precedents Not Yet Retrieved</span>
                  <span className="text-[11px] text-slate-500">
                    Click "Run AI Investigation" to query Hindsight Cloud for matching past incidents.
                  </span>
                </div>
              )}
            </div>

            {/* Callout banner */}
            <div className="p-2 rounded bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-blue-600">lightbulb</span>
              <span>RecallOps remembers both what worked and what failed.</span>
            </div>
          </div>

          {/* COLUMN B: AI DIAGNOSTIC ANALYSIS (Groq) */}
          <div className="bg-blue-50/30 rounded-lg p-3 border border-blue-200 flex flex-col justify-between gap-2.5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-blue-200">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-blue-700 text-[16px]">psychology</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    AI Diagnostic Analysis
                  </span>
                </div>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  AI Recommendation · Not Confirmed
                </span>
              </div>

              {isInvestigating ? (
                <div className="bg-white rounded-md p-6 border border-blue-200 text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-2xl text-blue-600">hourglass_top</span>
                  <span className="text-xs font-bold text-slate-800">Groq Reasoning Engine Active</span>
                  <p className="text-[11px] text-slate-500">
                    Synthesizing Hindsight memories and formulating diagnostic hypotheses...
                  </p>
                </div>
              ) : latestInvestigation ? (
                <div className="bg-white rounded-md p-2.5 border border-blue-200 shadow-2xs flex flex-col gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                      Diagnosis Hypothesis:
                    </span>
                    <h3 className="text-xs font-bold text-slate-900">
                      {latestInvestigation.diagnosis_hypothesis}
                    </h3>
                  </div>

                  <div className="bg-blue-50/70 p-2 rounded border border-blue-100 text-xs text-blue-950 leading-snug">
                    <strong className="font-semibold text-blue-900">Operator Observation:</strong>{" "}
                    {selectedIncident.reported_observations}
                  </div>

                  <div className="pt-1 flex flex-col gap-1 border-t border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-600 tracking-wide">
                      Recommended Diagnostic Steps:
                    </span>
                    <ol className="flex flex-col gap-1 text-[11px] text-slate-800">
                      {latestInvestigation.recommended_diagnostic_steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center mt-0.5 flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {latestInvestigation.safety_warnings.length > 0 && (
                    <div className="p-2 rounded bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 flex flex-col gap-0.5">
                      <span className="font-bold uppercase text-[9px] tracking-wide text-amber-800 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-amber-700">security</span>
                        Mandatory Safety Precautions:
                      </span>
                      <ul className="list-disc pl-3 font-medium space-y-0.5">
                        {latestInvestigation.safety_warnings.map((warn, idx) => (
                          <li key={idx}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-md p-6 border border-blue-200 text-center flex flex-col items-center gap-1.5">
                  <span className="material-symbols-outlined text-blue-400 text-2xl">model_training</span>
                  <span className="text-xs font-semibold text-slate-700">Investigation Pending</span>
                  <span className="text-[11px] text-slate-500">
                    Trigger the Groq AI engine to analyze symptoms and cross-reference with plant history.
                  </span>
                </div>
              )}
            </div>

            <div className="text-[10px] font-medium text-slate-500 pt-1.5 border-t border-blue-200 flex items-center justify-between">
              <span>Model: Groq (openai/gpt-oss-120b)</span>
              <span className="text-amber-800 font-bold">
                {latestInvestigation ? `Confidence: ${(latestInvestigation.confidence * 100).toFixed(0)}%` : "Hypothesis Only"}
              </span>
            </div>
          </div>

          {/* COLUMN C: TECHNICIAN ACTION & VERIFICATION */}
          <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-200 flex flex-col justify-between gap-2.5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-slate-700 text-[16px]">verified_user</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Human Technician Workflow
                  </span>
                </div>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${statusBadge.bg}`}
                >
                  {selectedIncident.status === "REPAIRED" ? "Awaiting Verification" : selectedIncident.status}
                </span>
              </div>

              <div className="bg-white rounded-md p-2.5 border border-slate-200 shadow-2xs flex flex-col gap-2">
                {/* Workflow Pipeline */}
                <div className="p-2 rounded bg-slate-50 border border-slate-200 flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wide">
                    Workflow Pipeline:
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-bold">
                    <span
                      className={
                        selectedIncident.status !== "REPORTED" ? "text-blue-600" : "text-slate-400"
                      }
                    >
                      Inspection
                    </span>
                    <span className="text-slate-400">→</span>
                    <span
                      className={
                        selectedIncident.status === "REPAIRED" || selectedIncident.status.startsWith("VERIFIED")
                          ? "text-blue-600"
                          : "text-slate-400"
                      }
                    >
                      Repair Recorded
                    </span>
                    <span className="text-slate-400">→</span>
                    <span
                      className={
                        selectedIncident.status.startsWith("VERIFIED")
                          ? "text-emerald-600 font-extrabold"
                          : "text-slate-400"
                      }
                    >
                      Outcome Verified
                    </span>
                  </div>
                </div>

                {/* Repair Summary if present */}
                {latestRepair && (
                  <div className="p-2 rounded bg-blue-50/50 border border-blue-100 flex flex-col gap-1 text-[11px]">
                    <div className="flex items-center justify-between text-blue-900 font-semibold">
                      <span>Logged Action ({latestRepair.technician_id})</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(latestRepair.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-800 font-medium">{latestRepair.action_taken}</p>
                    {latestRepair.parts_replaced && (
                      <span className="text-slate-600 text-[10px]">
                        Parts: <strong>{latestRepair.parts_replaced}</strong>
                      </span>
                    )}
                  </div>
                )}

                {/* Verification Summary if present */}
                {latestVerification && (
                  <div
                    className={`p-2 rounded border flex flex-col gap-1 text-[11px] ${
                      latestVerification.outcome_status === "SUCCESSFUL"
                        ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                        : "bg-rose-50/70 border-rose-200 text-rose-900"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">
                          {latestVerification.outcome_status === "SUCCESSFUL" ? "check_circle" : "cancel"}
                        </span>
                        Verified Outcome: {latestVerification.outcome_status}
                      </span>
                      <span className="text-[9px] bg-white px-1.5 py-0.5 rounded border">
                        {latestVerification.hindsight_retained ? "Retained in Hindsight" : "Local Sync"}
                      </span>
                    </div>
                    <p className="text-slate-800">{latestVerification.inspection_notes}</p>
                  </div>
                )}

                {/* Protocol Disclaimer */}
                {!latestVerification && (
                  <div className="p-2 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-snug">
                    <strong className="font-semibold text-slate-800">Verification Protocol Disclaimer:</strong>{" "}
                    Physical inspection and diagnostic tests must be performed by a certified technician. No unverified repairs enter memory.
                  </div>
                )}
              </div>
            </div>

            {/* Primary Action Button based on state */}
            <div className="pt-1 border-t border-slate-200 flex flex-col gap-1.5">
              {!latestInvestigation && (
                <button
                  onClick={onInvestigateClick}
                  disabled={isInvestigating}
                  className="w-full py-2 px-3 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">psychology</span>
                  <span>{isInvestigating ? "Running AI Investigation..." : "Run AI Investigation"}</span>
                </button>
              )}

              {latestInvestigation && !latestRepair && (
                <button
                  onClick={onRepairClick}
                  className="w-full py-2 px-3 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">build</span>
                  <span>Log Technician Repair Action</span>
                </button>
              )}

              {latestRepair && !latestVerification && (
                <button
                  onClick={onVerifyClick}
                  className="w-full py-2 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Verify Outcome &amp; Retain Memory</span>
                </button>
              )}

              {latestVerification && (
                <div className="w-full py-1.5 px-3 rounded-md bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-emerald-600">cloud_done</span>
                  <span>Episode Synced to Hindsight Cloud</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
