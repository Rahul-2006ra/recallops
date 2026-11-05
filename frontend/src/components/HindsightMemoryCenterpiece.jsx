import React, { useState } from "react";

export default function HindsightMemoryCenterpiece({
  selectedIncident,
  incidentDetails,
  isLoadingDetails,
  isInvestigating,
  onInvestigateClick,
  onRepairClick,
  onVerifyClick,
  allIncidents = [],
}) {
  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(false);
  const [isStepsExpanded, setIsStepsExpanded] = useState(false);
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);

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

  // Ground truth registry mapping from SQLite incidents
  const extractPrecedents = (inv, incidentsList = []) => {
    if (!inv) return { precedents: [], currentTelemetry: [] };

    // Baseline ground-truth knowledge for verified demonstration machines
    const groundTruth = {
      "M-104": { status: "SUCCESSFUL", sourceInc: "INC-20261105-9BFEC1" },
      "M-108": { status: "UNSUCCESSFUL", sourceInc: "INC-20261105-CEB237" },
      "M-112": { status: "SUCCESSFUL", sourceInc: "INC-20261105-CF6B1D" },
    };

    // Dynamically augment with any incidents loaded from SQLite
    for (const inc of incidentsList) {
      const mId = inc.machine_id?.toUpperCase();
      if (!mId) continue;
      if (inc.status === "VERIFIED_SUCCESSFUL") {
        groundTruth[mId] = {
          status: "SUCCESSFUL",
          sourceInc: inc.id,
        };
      } else if (inc.status === "VERIFIED_UNSUCCESSFUL") {
        if (!groundTruth[mId] || groundTruth[mId].status !== "SUCCESSFUL") {
          groundTruth[mId] = {
            status: "UNSUCCESSFUL",
            sourceInc: inc.id,
          };
        }
      }
    }

    const supportingEvidence = inv.supporting_evidence || [];
    const unsuccessfulRepairs = inv.unsuccessful_previous_repairs || [];
    const machineRegex = /\b(M-\d+|AUDIT-M-\d+|M-DUAL-\d+|DEMO-M-\d+)\b/i;
    const incidentRegex = /\b(INC-\d+-[A-Z0-9]+|DEMO-INC-\d+)\b/i;

    const unsuccMap = {};
    const succMap = {};
    const unconfirmedMap = {};
    const currentTelemetry = [];

    // 1. Group unsuccessful repairs directly from Groq's unsuccessful_previous_repairs schema field
    for (const item of unsuccessfulRepairs) {
      const matchMach = item.match(machineRegex);
      const matchInc = item.match(incidentRegex);
      const machine = matchMach ? matchMach[1].toUpperCase() : "Historical Failure";
      const sourceInc = matchInc ? matchInc[1].toUpperCase() : groundTruth[machine]?.sourceInc || null;

      if (!unsuccMap[machine]) unsuccMap[machine] = { items: [], sourceInc };
      unsuccMap[machine].items.push(item);
      if (sourceInc && !unsuccMap[machine].sourceInc) unsuccMap[machine].sourceInc = sourceInc;
    }

    // 2. Process supporting evidence items with strict grounding (no pure keyword guessing)
    for (const item of supportingEvidence) {
      const isCurrentObservation = /\b(current pump|current observation|reached \d|vibration amplitude >|exceeds typical alarm)\b/i.test(item);
      if (isCurrentObservation) {
        currentTelemetry.push(item);
        continue;
      }

      const matchMach = item.match(machineRegex);
      const matchInc = item.match(incidentRegex);
      const machine = matchMach ? matchMach[1].toUpperCase() : null;
      const sourceInc = matchInc ? matchInc[1].toUpperCase() : (machine ? groundTruth[machine]?.sourceInc : null);

      if (machine) {
        const verifiedInfo = groundTruth[machine];
        if (verifiedInfo?.status === "SUCCESSFUL") {
          if (!succMap[machine]) succMap[machine] = { items: [], sourceInc: sourceInc || verifiedInfo.sourceInc };
          succMap[machine].items.push(item);
        } else if (verifiedInfo?.status === "UNSUCCESSFUL") {
          if (!unsuccMap[machine]) unsuccMap[machine] = { items: [], sourceInc: sourceInc || verifiedInfo.sourceInc };
          unsuccMap[machine].items.push(item);
        } else {
          // Machine mentioned but not confirmed verified in registry -> label as Outcome Unconfirmed
          if (!unconfirmedMap[machine]) unconfirmedMap[machine] = { items: [], sourceInc };
          unconfirmedMap[machine].items.push(item);
        }
      } else {
        // General historical observation without explicit machine verification
        const key = "General Historical Precedent";
        if (!unconfirmedMap[key]) unconfirmedMap[key] = { items: [], sourceInc: null };
        unconfirmedMap[key].items.push(item);
      }
    }

    const precedents = [];

    // Add verified successful precedent cards
    for (const [machine, data] of Object.entries(succMap)) {
      precedents.push({
        id: `succ-${machine}`,
        machine,
        sourceInc: data.sourceInc,
        status: "SUCCESSFUL",
        badgeText: "VERIFIED SUCCESSFUL",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        borderClass: "border-emerald-200",
        badgeIcon: "check_circle",
        badgeIconClass: "text-emerald-600",
        evidenceLabel: "Supporting Precedent Evidence:",
        evidenceLabelClass: "text-emerald-900",
        evidenceList: data.items,
      });
    }

    // Add verified unsuccessful precedent cards
    for (const [machine, data] of Object.entries(unsuccMap)) {
      precedents.push({
        id: `unsucc-${machine}`,
        machine,
        sourceInc: data.sourceInc,
        status: "UNSUCCESSFUL",
        badgeText: "VERIFIED UNSUCCESSFUL",
        badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
        borderClass: "border-rose-200",
        badgeIcon: "cancel",
        badgeIconClass: "text-rose-600",
        evidenceLabel: "Ineffective / Failed Actions to Avoid:",
        evidenceLabelClass: "text-rose-900",
        evidenceList: data.items,
      });
    }

    // Add unconfirmed precedent cards (strict integrity: never guess from keywords)
    for (const [machine, data] of Object.entries(unconfirmedMap)) {
      precedents.push({
        id: `unconfirmed-${machine}`,
        machine,
        sourceInc: data.sourceInc,
        status: "UNCONFIRMED",
        badgeText: "OUTCOME UNCONFIRMED",
        badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
        borderClass: "border-slate-200",
        badgeIcon: "help",
        badgeIconClass: "text-slate-500",
        evidenceLabel: "Historical Telemetry Reference:",
        evidenceLabelClass: "text-slate-800",
        evidenceList: data.items,
      });
    }

    return { precedents, currentTelemetry };
  };

  const { precedents, currentTelemetry } = extractPrecedents(latestInvestigation, allIncidents);
  const hasHistory = precedents.length > 0 || currentTelemetry.length > 0;

  // Visible subset of precedents for compact vertical hierarchy
  const displayedPrecedents = isEvidenceExpanded ? precedents : precedents.slice(0, 2);

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

  // 5-Stage Lifecycle Stepper State driven strictly by backend data
  const getWorkflowSteps = () => {
    const isReported = Boolean(selectedIncident?.id);
    const isInvestigated = latestInvestigation !== null;
    const isRepaired =
      latestRepair !== null ||
      ["REPAIRED", "VERIFIED_SUCCESSFUL", "VERIFIED_UNSUCCESSFUL"].includes(selectedIncident.status);

    // Stage 4: Outcome Verification State
    let stage4Status = "pending";
    let stage4Label = "4. Outcome Verified";
    let stage4BadgeText = "Pending";
    let stage4BadgeClass = "bg-slate-100 text-slate-500";
    let stage4Icon = "radio_button_unchecked";

    if (latestVerification) {
      stage4Status = "completed";
      stage4Label = `4. Outcome Verified (${latestVerification.outcome_status})`;
      stage4BadgeText = "Completed";
      stage4BadgeClass = "bg-emerald-100 text-emerald-800";
      stage4Icon = "check_circle";
    } else if (["VERIFIED_SUCCESSFUL", "VERIFIED_UNSUCCESSFUL"].includes(selectedIncident.status)) {
      stage4Status = "completed";
      stage4Label = `4. Outcome Verified (${selectedIncident.status === "VERIFIED_SUCCESSFUL" ? "SUCCESSFUL" : "UNSUCCESSFUL"})`;
      stage4BadgeText = "Completed";
      stage4BadgeClass = "bg-emerald-100 text-emerald-800";
      stage4Icon = "check_circle";
    } else if (isRepaired) {
      stage4Status = "ready";
      stage4BadgeText = "Ready";
      stage4BadgeClass = "bg-blue-100 text-blue-800";
      stage4Icon = "radio_button_checked";
    }

    // Stage 5: Hindsight Cloud Retention State
    let stage5Status = "pending";
    let stage5Label = "5. Hindsight Retention";
    let stage5BadgeText = "Pending";
    let stage5BadgeClass = "bg-slate-100 text-slate-500";
    let stage5Icon = "cloud_queue";

    if (latestVerification) {
      if (latestVerification.hindsight_retained === true) {
        stage5Status = "completed";
        stage5Label = "5. Hindsight Retention (Confirmed)";
        stage5BadgeText = "Confirmed";
        stage5BadgeClass = "bg-emerald-100 text-emerald-800";
        stage5Icon = "cloud_done";
      } else {
        // Verification recorded in SQLite but Hindsight retention is pending or encountered failure
        stage5Status = "warning";
        stage5Label = "5. Retention Sync Pending";
        stage5BadgeText = "Sync Pending";
        stage5BadgeClass = "bg-amber-100 text-amber-900 border border-amber-300";
        stage5Icon = "cloud_off";
      }
    } else if (["VERIFIED_SUCCESSFUL", "VERIFIED_UNSUCCESSFUL"].includes(selectedIncident.status)) {
      // Backend shows verified incident but verification entity record not yet loaded
      stage5Status = "unconfirmed";
      stage5Label = "5. Retention Status Unconfirmed";
      stage5BadgeText = "Unconfirmed";
      stage5BadgeClass = "bg-slate-100 text-slate-700 border border-slate-300";
      stage5Icon = "help";
    } else if (stage4Status === "completed") {
      stage5Status = "ready";
      stage5BadgeText = "Ready";
      stage5BadgeClass = "bg-blue-100 text-blue-800";
      stage5Icon = "cloud_upload";
    }

    return [
      {
        id: "report",
        label: "1. Incident Logged",
        status: isReported ? "completed" : "pending",
        badgeText: isReported ? "Completed" : "Pending",
        badgeClass: isReported ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500",
        icon: isReported ? "check_circle" : "radio_button_unchecked",
      },
      {
        id: "investigate",
        label: "2. AI Investigation",
        status: isInvestigating ? "active" : isInvestigated ? "completed" : "pending",
        badgeText: isInvestigating ? "Active" : isInvestigated ? "Completed" : "Pending",
        badgeClass: isInvestigating ? "bg-blue-100 text-blue-800" : isInvestigated ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500",
        icon: isInvestigating ? "sync" : isInvestigated ? "check_circle" : "radio_button_unchecked",
      },
      {
        id: "repair",
        label: "3. Physical Repair",
        status: isRepaired ? "completed" : isInvestigated ? "ready" : "pending",
        badgeText: isRepaired ? "Completed" : isInvestigated ? "Ready" : "Pending",
        badgeClass: isRepaired ? "bg-emerald-100 text-emerald-800" : isInvestigated ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-500",
        icon: isRepaired ? "check_circle" : "radio_button_unchecked",
      },
      {
        id: "verify",
        label: stage4Label,
        status: stage4Status,
        badgeText: stage4BadgeText,
        badgeClass: stage4BadgeClass,
        icon: stage4Icon,
      },
      {
        id: "retain",
        label: stage5Label,
        status: stage5Status,
        badgeText: stage5BadgeText,
        badgeClass: stage5BadgeClass,
        icon: stage5Icon,
      },
    ];
  };

  const workflowSteps = getWorkflowSteps();

  // Diagnostic steps subset
  const diagnosticSteps = latestInvestigation?.recommended_diagnostic_steps || [];
  const displayedDiagnosticSteps = isStepsExpanded
    ? diagnosticSteps
    : diagnosticSteps.slice(0, 3);

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
                  ? `Matched ${precedents.length} Distinct Precedent(s)`
                  : "Pending AI Investigation"}
              </strong>
            </span>
          </div>
        </div>

        {/* 3 Information Columns: Natural Content Height Alignment */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
          {/* COLUMN A: HISTORICAL EVIDENCE (Compact & Natural Height) */}
          <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-200 flex flex-col gap-2.5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-slate-700 text-[16px]">history_edu</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Historical Precedents
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  {precedents.length} Stored Cases
                </span>
              </div>

              {isLoadingDetails ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <span className="material-symbols-outlined animate-spin text-xl mb-1 text-blue-600">sync</span>
                  <p>Loading historical precedents from Hindsight Cloud...</p>
                </div>
              ) : latestInvestigation ? (
                <div className="flex flex-col gap-2">
                  {/* Precedent Cards */}
                  {displayedPrecedents.map((prec) => (
                    <div
                      key={prec.id}
                      className={`bg-white rounded-md p-2.5 border ${prec.borderClass} shadow-2xs flex flex-col gap-1.5 transition-all`}
                    >
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 font-mono">
                            {prec.machine}
                          </span>
                          {prec.sourceInc && (
                            <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {prec.sourceInc}
                            </span>
                          )}
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${prec.badgeClass}`}
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
                            : prec.status === "UNSUCCESSFUL"
                            ? "bg-rose-50/50 border-rose-100/70"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <span
                          className={`font-bold uppercase text-[9px] tracking-wide ${prec.evidenceLabelClass}`}
                        >
                          {prec.evidenceLabel}
                        </span>
                        <ul className="list-disc pl-3 font-medium text-slate-800 leading-tight space-y-0.5">
                          {prec.evidenceList.slice(0, 2).map((ev, idx) => (
                            <li key={idx}>{ev}</li>
                          ))}
                          {prec.evidenceList.length > 2 && !isEvidenceExpanded && (
                            <li className="list-none text-[10px] text-blue-700 font-semibold italic pt-0.5">
                              + {prec.evidenceList.length - 2} more specific observations
                            </li>
                          )}
                          {isEvidenceExpanded &&
                            prec.evidenceList.slice(2).map((ev, idx) => (
                              <li key={`extra-${idx}`}>{ev}</li>
                            ))}
                        </ul>
                      </div>
                    </div>
                  ))}

                  {/* Active Incident Telemetry Context */}
                  {currentTelemetry.length > 0 && (
                    <div className="bg-slate-50/90 rounded-md p-2 border border-slate-200 text-[11px] flex flex-col gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                        Current Telemetry Context:
                      </span>
                      <ul className="list-disc pl-3 font-medium text-slate-700 leading-tight space-y-0.5">
                        {currentTelemetry.slice(0, 2).map((tel, idx) => (
                          <li key={idx}>{tel}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Expand/Collapse Control for Vertical Balance */}
                  {precedents.length > 2 && (
                    <button
                      onClick={() => setIsEvidenceExpanded(!isEvidenceExpanded)}
                      type="button"
                      className="w-full py-1.5 px-2 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {isEvidenceExpanded ? "unfold_less" : "unfold_more"}
                      </span>
                      <span>
                        {isEvidenceExpanded
                          ? "Collapse to Top Precedents"
                          : `View All ${precedents.length} Historical Precedents (${precedents.length - 2} more)`}
                      </span>
                    </button>
                  )}

                  {!hasHistory && (
                    <div className="bg-white rounded-md p-4 border border-slate-200 text-xs text-slate-500 text-center">
                      No matching historical memories found for this symptom yet.
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-md p-6 border border-slate-200 text-center flex flex-col items-center gap-1.5">
                  <span className="material-symbols-outlined text-slate-400 text-2xl">manage_search</span>
                  <span className="text-xs font-semibold text-slate-700">Precedents Not Yet Retrieved</span>
                  <span className="text-[11px] text-slate-500">
                    Click "Run AI Investigation" to query Hindsight Cloud for matching past incidents.
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Callout */}
            <div className="p-2 rounded bg-slate-100 border border-slate-200 text-[10.5px] font-medium text-slate-700 flex items-center gap-1.5 mt-1">
              <span className="material-symbols-outlined text-[15px] text-blue-600 flex-shrink-0">lightbulb</span>
              <span>Learns positive fixes and avoids repeated failures across machines.</span>
            </div>
          </div>

          {/* COLUMN B: AI DIAGNOSTIC ANALYSIS (Structured & Numbered) */}
          <div className="bg-blue-50/30 rounded-lg p-3 border border-blue-200 flex flex-col gap-2.5">
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
                <div className="bg-white rounded-md p-8 border border-blue-200 text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-2xl text-blue-600">hourglass_top</span>
                  <span className="text-xs font-bold text-slate-800">Groq Reasoning Engine Active</span>
                  <p className="text-[11px] text-slate-500">
                    Cross-referencing Hindsight memories and synthesizing diagnostic hypothesis...
                  </p>
                </div>
              ) : latestInvestigation ? (
                <div className="bg-white rounded-md p-2.5 border border-blue-200 shadow-2xs flex flex-col gap-2">
                  {/* Diagnosis Hypothesis */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                        Primary Suspected Root Cause:
                      </span>
                      {latestInvestigation.diagnosis_hypothesis.length > 120 && (
                        <button
                          onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                          type="button"
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold transition-colors flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>{isReasoningExpanded ? "Less" : "Full Rationale"}</span>
                          <span className="material-symbols-outlined text-[13px]">
                            {isReasoningExpanded ? "expand_less" : "expand_more"}
                          </span>
                        </button>
                      )}
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 leading-snug">
                      {isReasoningExpanded || latestInvestigation.diagnosis_hypothesis.length <= 120
                        ? latestInvestigation.diagnosis_hypothesis
                        : `${latestInvestigation.diagnosis_hypothesis.slice(0, 120)}...`}
                    </h3>
                  </div>

                  {/* Operator Observation */}
                  <div className="bg-blue-50/70 py-1.5 px-2 rounded border border-blue-100 text-[11px] text-blue-950 leading-snug">
                    <strong className="font-semibold text-blue-900">Operator Observation:</strong>{" "}
                    {selectedIncident.reported_observations}
                  </div>

                  {/* Recommended Diagnostic Steps (Top 3 default, expandable) */}
                  <div className="pt-1 flex flex-col gap-1 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-600 tracking-wide">
                        Recommended Diagnostic Steps:
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Showing {displayedDiagnosticSteps.length} of {diagnosticSteps.length}
                      </span>
                    </div>

                    <ol className="flex flex-col gap-1 text-[11px] text-slate-800">
                      {displayedDiagnosticSteps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center mt-0.5 flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="leading-tight">{step}</span>
                        </li>
                      ))}
                    </ol>

                    {diagnosticSteps.length > 3 && (
                      <button
                        onClick={() => setIsStepsExpanded(!isStepsExpanded)}
                        type="button"
                        className="mt-0.5 py-1 px-2 rounded border border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 text-blue-700 text-[10.5px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {isStepsExpanded ? "expand_less" : "expand_more"}
                        </span>
                        <span>
                          {isStepsExpanded
                            ? "Show Top 3 Priority Steps"
                            : `Show All ${diagnosticSteps.length} Diagnostic Steps (${diagnosticSteps.length - 3} more)`}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Safety Warnings with High-Contrast Alert Styling */}
                  {latestInvestigation.safety_warnings.length > 0 && (
                    <div className="p-2 rounded bg-amber-50/80 border border-amber-300 text-[11px] text-amber-950 flex flex-col gap-0.5">
                      <span className="font-bold uppercase text-[9px] tracking-wide text-amber-800 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-amber-700">lock</span>
                        Mandatory Safety &amp; LOTO Precautions:
                      </span>
                      <ul className="list-disc pl-3 font-medium space-y-0.5 text-[10.5px]">
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

            {/* Model & AI Confidence Representation */}
            <div className="text-[10px] font-medium text-slate-500 pt-1.5 border-t border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span>Model: Groq (openai/gpt-oss-120b)</span>
              <span className="text-blue-900 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 self-start sm:self-auto">
                {latestInvestigation && typeof latestInvestigation.confidence === "number"
                  ? `AI-estimated confidence: ${(latestInvestigation.confidence * 100).toFixed(0)}% — Not statistically calibrated`
                  : "Confidence not available"}
              </span>
            </div>
          </div>

          {/* COLUMN C: TECHNICIAN ACTION & VERIFICATION (Interactive Workflow Stepper) */}
          <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-200 flex flex-col gap-2.5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-slate-700 text-[16px]">verified_user</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Technician Workflow
                  </span>
                </div>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${statusBadge.bg}`}
                >
                  {selectedIncident.status === "REPAIRED" ? "Awaiting Verification" : selectedIncident.status}
                </span>
              </div>

              <div className="bg-white rounded-md p-2.5 border border-slate-200 shadow-2xs flex flex-col gap-2">
                {/* 5-Stage Visual Workflow Stepper */}
                <div className="p-2 rounded bg-slate-50 border border-slate-200 flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Incident Resolution Pipeline:
                  </span>
                  <div className="flex flex-col gap-1">
                    {workflowSteps.map((step) => {
                      const isDone = step.status === "completed";
                      const isActive = step.status === "active" || step.status === "ready";
                      const isWarning = step.status === "warning";
                      const isUnconfirmed = step.status === "unconfirmed";

                      return (
                        <div
                          key={step.id}
                          className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-100 last:border-b-0"
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`material-symbols-outlined text-[14px] ${
                                isDone
                                  ? "text-emerald-600"
                                  : isWarning
                                  ? "text-amber-600"
                                  : isUnconfirmed
                                  ? "text-slate-500"
                                  : isActive
                                  ? "text-blue-600 animate-pulse"
                                  : "text-slate-400"
                              }`}
                            >
                              {step.icon}
                            </span>
                            <span
                              className={`font-semibold ${
                                isDone
                                  ? "text-slate-900"
                                  : isWarning
                                  ? "text-amber-900"
                                  : isActive
                                  ? "text-blue-700"
                                  : "text-slate-500"
                              }`}
                            >
                              {step.label}
                            </span>
                          </div>
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${step.badgeClass}`}
                          >
                            {step.badgeText}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Repair Summary if present */}
                {latestRepair && (
                  <div className="p-2 rounded bg-blue-50/50 border border-blue-100 flex flex-col gap-1 text-[11px]">
                    <div className="flex items-center justify-between text-blue-900 font-semibold">
                      <span>Logged Action ({latestRepair.technician_id})</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(latestRepair.performed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-slate-800 font-medium">{latestRepair.action_taken}</p>
                    {latestRepair.parts_replaced && (
                      <span className="text-slate-600 text-[10px]">
                        Parts Replaced: <strong>{latestRepair.parts_replaced}</strong>
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
                      <span className="text-[9px] bg-white px-1.5 py-0.5 rounded border border-emerald-300 font-mono">
                        {latestVerification.hindsight_retained ? "Retained in Hindsight" : "Local Sync"}
                      </span>
                    </div>
                    <p className="text-slate-800">{latestVerification.inspection_notes}</p>
                    {latestVerification.follow_up_metrics && (
                      <div className="text-[10px] font-mono bg-white/70 px-1 py-0.5 rounded border border-emerald-200 text-emerald-950">
                        Metrics: {JSON.stringify(latestVerification.follow_up_metrics)}
                      </div>
                    )}
                  </div>
                )}

                {/* Protocol Disclaimer */}
                {!latestVerification && (
                  <div className="p-2 rounded bg-slate-50 border border-slate-200 text-[10.5px] text-slate-600 leading-snug">
                    <strong className="font-semibold text-slate-800">Verification Protocol Disclaimer:</strong>{" "}
                    Physical inspection and diagnostic tests must be performed by a certified technician. Only ground-truth verified outcomes enter long-term Hindsight memory.
                  </div>
                )}
              </div>
            </div>

            {/* Primary Action Button based on state with double-submit guard */}
            <div className="pt-1 border-t border-slate-200 flex flex-col gap-1.5 mt-1">
              {!latestInvestigation && (
                <button
                  onClick={onInvestigateClick}
                  disabled={isInvestigating}
                  className="w-full py-2 px-3 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  type="button"
                >
                  {isInvestigating ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                      <span>Running AI Investigation...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">psychology</span>
                      <span>Run AI Investigation</span>
                    </>
                  )}
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
                latestVerification.hindsight_retained ? (
                  <div className="w-full py-1.5 px-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-xs flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">cloud_done</span>
                    <span>Episode Retained in Hindsight Cloud ({latestVerification.hindsight_document_id || `OUTCOME-${selectedIncident.id}`})</span>
                  </div>
                ) : (
                  <div className="w-full py-1.5 px-3 rounded-md bg-amber-50 border border-amber-300 text-amber-900 font-semibold text-xs flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-amber-600">cloud_off</span>
                    <span>Outcome verified in SQLite · Hindsight Cloud retention pending sync</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
