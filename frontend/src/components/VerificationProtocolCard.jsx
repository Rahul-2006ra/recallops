import React from "react";

export default function VerificationProtocolCard({ systemHealth }) {
  const isHealthy = systemHealth?.status === "healthy";
  const hindsightStatus = systemHealth?.hindsight_status || "connected";
  const bankId = systemHealth?.hindsight_bank || "recallops-demo";

  return (
    <div className="flex flex-col gap-3">
      {/* Verification Protocol Card */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
            <span className="material-symbols-outlined text-[15px]">verified</span>
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Verification Protocol
          </h3>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed font-normal">
          RecallOps strictly separates AI hypotheses from ground truth. AI recommendations provide triage orientation, but{" "}
          <strong className="font-semibold text-slate-900">
            only verified technician outcomes enter long-term episodic memory
          </strong>.
        </p>

        <div className="p-2.5 rounded bg-slate-50 border border-slate-200/80 flex flex-col gap-1 text-[11px] text-slate-700">
          <div className="flex items-center gap-1.5 text-blue-700 font-semibold">
            <span className="material-symbols-outlined text-[13px]">lock_clock</span>
            <span>Audit Safeguard Active</span>
          </div>
          <span>
            Every outcome written to SQLite and Hindsight Cloud requires technician ID sign-off.
          </span>
        </div>

        <div className="p-2.5 rounded bg-amber-50/70 border border-amber-200/70 flex flex-col gap-1 text-[11px] text-slate-700">
          <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
            <span className="material-symbols-outlined text-[13px]">shield</span>
            <span>Outcome Idempotency</span>
          </div>
          <span className="text-amber-900/90 text-[10.5px]">
            Deterministic ID <code className="font-mono bg-white/70 px-1 py-0.5 rounded border border-amber-200">OUTCOME-{`{id}`}</code> prevents duplicate retention. Conflicting modifications are rejected (HTTP 409).
          </span>
        </div>
      </div>

      {/* Quick Navigation / System Status Banner */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-lg p-3.5 shadow-xs flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Memory Integrity
          </span>
          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {isHealthy ? "Episodic Sync Healthy" : "System Initializing"}
          </span>
          <span className="text-[10px] text-slate-400 font-mono mt-0.5">
            Bank: {bankId}
          </span>
        </div>
        <div className="w-8 h-8 rounded-md bg-slate-800 flex items-center justify-center border border-slate-700">
          <span className="material-symbols-outlined text-slate-300 text-[18px]">
            database
          </span>
        </div>
      </div>
    </div>
  );
}
