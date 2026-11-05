import React from "react";

export default function HindsightMemoryView({ incidents, systemHealth }) {
  const verifiedIncidents = incidents.filter(
    (i) => i.status === "VERIFIED_SUCCESSFUL" || i.status === "VERIFIED_UNSUCCESSFUL"
  );

  const bankId = systemHealth?.hindsight_bank || "recallops-demo";

  return (
    <div className="flex flex-col gap-4">
      {/* Overview Banner */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[20px]">psychology</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Hindsight Episodic Memory Bank
                </h2>
                <p className="text-xs text-slate-500">
                  Cross-machine ground truth repository powered by official Hindsight Cloud API.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-slate-900 text-white font-mono text-xs flex items-center gap-1.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Bank: {bankId}
            </span>
          </div>
        </div>

        {/* 4 Pillars of Learning */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-blue-700 font-bold text-xs uppercase tracking-wider">
              <span className="material-symbols-outlined text-[15px]">input</span>
              <span>1. Retain</span>
            </div>
            <p className="text-[11px] text-slate-600">
              Deterministic upsert via <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">OUTCOME-{`{id}`}</code> stores verified outcomes with zero duplicates.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-purple-700 font-bold text-xs uppercase tracking-wider">
              <span className="material-symbols-outlined text-[15px]">saved_search</span>
              <span>2. Recall</span>
            </div>
            <p className="text-[11px] text-slate-600">
              Vector search with <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">budget="low"</code> retrieves cross-machine precedents in &lt;2s.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-amber-700 font-bold text-xs uppercase tracking-wider">
              <span className="material-symbols-outlined text-[15px]">psychology_alt</span>
              <span>3. Reflect</span>
            </div>
            <p className="text-[11px] text-slate-600">
              Synthesizes repair efficacy across history to identify proven fixes vs contraindicated steps.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs uppercase tracking-wider">
              <span className="material-symbols-outlined text-[15px]">verified_user</span>
              <span>4. Provenance</span>
            </div>
            <p className="text-[11px] text-slate-600">
              AI hypotheses are strictly segregated from ground truth. Only technician-signed outcomes enter memory.
            </p>
          </div>
        </div>
      </div>

      {/* Retained Memories List */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Retained Episodic Memory Units
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
              {verifiedIncidents.length} Ground Truth Units
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Episodic Sync Status: Synchronized
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {verifiedIncidents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No verified repair outcomes have been retained yet. Verify an incident repair to commit its first memory.
            </div>
          ) : (
            verifiedIncidents.map((incident) => {
              const isSuccess = incident.status === "VERIFIED_SUCCESSFUL";
              return (
                <div key={incident.id} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex flex-col gap-1.5 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        OUTCOME-{incident.id}
                      </span>
                      <span className="font-semibold text-xs text-slate-800">
                        {incident.machine_id} &bull; {incident.equipment_type}
                      </span>
                      {incident.is_demo && (
                        <span className="text-[9px] px-1 py-0.2 bg-slate-200 text-slate-600 rounded font-mono">
                          SYNTHETIC DEMO
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-700">
                      <span className="font-semibold text-slate-900">Symptom: </span>
                      {incident.symptoms}
                    </div>

                    <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200/80">
                      <span className="font-semibold text-slate-800">Field Observation: </span>
                      {incident.reported_observations}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border ${
                        isSuccess
                          ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                          : "bg-rose-100 text-rose-900 border-rose-300"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {isSuccess ? "check_circle" : "cancel"}
                      </span>
                      {isSuccess ? "VERIFIED SUCCESSFUL" : "VERIFIED UNSUCCESSFUL"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Target: bank/{bankId}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
