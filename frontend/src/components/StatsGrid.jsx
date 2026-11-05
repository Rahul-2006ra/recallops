import React from "react";

export default function StatsGrid({ incidents }) {
  const openIncidents = incidents.filter(
    (i) => i.status !== "VERIFIED_SUCCESSFUL" && i.status !== "CLOSED"
  );
  const highSeverityCount = openIncidents.filter(
    (i) => i.severity === "HIGH" || i.severity === "CRITICAL"
  ).length;

  const activeMachines = new Set(openIncidents.map((i) => i.machine_id)).size;

  const awaitingVerification = incidents.filter(
    (i) => i.status === "REPAIRED"
  ).length;

  const verifiedOutcomesCount = incidents.filter(
    (i) => i.status === "VERIFIED_SUCCESSFUL" || i.status === "VERIFIED_UNSUCCESSFUL"
  ).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Card 1: Open Incidents */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Open Incidents
          </span>
          <div className="p-1 rounded bg-red-50 text-red-600 border border-red-100">
            <span className="material-symbols-outlined text-[15px]">warning</span>
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            {openIncidents.length}
          </span>
          {highSeverityCount > 0 && (
            <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">
              {highSeverityCount} High Severity
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-500">Demonstration Data</div>
      </div>

      {/* Card 2: Machines with Active Issues */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Machines with Active Issues
          </span>
          <div className="p-1 rounded bg-blue-50 text-blue-600 border border-blue-100">
            <span className="material-symbols-outlined text-[15px]">precision_manufacturing</span>
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            {activeMachines}
          </span>
          <span className="text-[11px] font-medium text-slate-600">Cells under diagnostic watch</span>
        </div>
        <div className="text-[11px] text-slate-500">Active telemetry monitoring</div>
      </div>

      {/* Card 3: Repairs Awaiting Verification */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Repairs Awaiting Verification
          </span>
          <div className="p-1 rounded bg-amber-50 text-amber-700 border border-amber-100">
            <span className="material-symbols-outlined text-[15px]">rule</span>
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            {awaitingVerification}
          </span>
          <span className="text-[11px] font-semibold text-amber-700">
            {awaitingVerification > 0 ? "Action logged" : "None pending"}
          </span>
        </div>
        <div className="text-[11px] text-slate-500">Pending post-repair validation</div>
      </div>

      {/* Card 4: Historical Verified Outcomes */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Historical Verified Outcomes
          </span>
          <div className="p-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
            <span className="material-symbols-outlined text-[15px]">history_edu</span>
          </div>
        </div>
        <div className="flex items-baseline gap-1.5 mb-0.5">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            {verifiedOutcomesCount} Records
          </span>
          <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
            Active Sync
          </span>
        </div>
        <div className="text-[11px] text-slate-500">Indexed in SQLite &amp; Hindsight</div>
      </div>
    </div>
  );
}
