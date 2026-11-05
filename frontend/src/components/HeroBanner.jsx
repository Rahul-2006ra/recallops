import React from "react";

export default function HeroBanner({ onReportClick, onActiveInvestigationsClick }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 flex-shrink-0">
          <span className="material-symbols-outlined text-[20px]">hub</span>
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
            Industrial Maintenance Intelligence
          </h1>
          <p className="text-xs text-slate-600 leading-snug">
            RecallOps remembers what worked, remembers what failed, and guides the active maintenance loop with verified precedents.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
        <button
          onClick={onActiveInvestigationsClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors text-xs font-semibold shadow-xs cursor-pointer"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">travel_explore</span>
          <span>Active Investigations</span>
        </button>
        <button
          onClick={onReportClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors text-xs font-semibold shadow-xs cursor-pointer"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">add_circle</span>
          <span>+ Report Incident</span>
        </button>
      </div>
    </div>
  );
}
