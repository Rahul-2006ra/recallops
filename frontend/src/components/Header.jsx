import React from "react";

export default function Header({ activeTabLabel }) {
  return (
    <header className="h-13 bg-white border-b border-slate-200 sticky top-0 z-40 px-5 py-2 flex items-center justify-between shadow-xs">
      {/* Breadcrumb + Facility Dropdown */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <span className="hover:text-slate-800 transition-colors">Console</span>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900">{activeTabLabel || "Overview"}</span>
        </div>
        <div className="h-3.5 w-px bg-slate-200"></div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer transition-colors">
          <span className="material-symbols-outlined text-blue-600 text-[15px]">factory</span>
          <span className="font-semibold">Main Manufacturing Plant</span>
          <span className="material-symbols-outlined text-slate-400 text-[14px]">arrow_drop_down</span>
        </div>
      </div>

      {/* Right Header Actions & Avatar */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Demonstration Mode
        </div>
        <div className="h-4 w-px bg-slate-200"></div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs border border-slate-300">
            MV
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-800 leading-tight">Marcus Vance</span>
            <span className="text-[10px] font-medium text-slate-500 leading-tight">Lead Reliability Eng</span>
          </div>
        </div>
      </div>
    </header>
  );
}
