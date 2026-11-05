import React from "react";

export default function Sidebar({ activeTab, onTabChange, backendHealth }) {
  const navItems = [
    { id: "overview", label: "Overview", icon: "grid_view" },
    { id: "incidents", label: "Incidents", icon: "warning" },
    { id: "ai-investigations", label: "AI Investigations", icon: "psychology" },
    { id: "hindsight-memory", label: "Hindsight Memory", icon: "history_toggle_off" },
    { id: "machines", label: "Machines", icon: "precision_manufacturing" },
  ];

  const isOnline = backendHealth?.status === "healthy";

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-[#111827] text-slate-100 z-50 flex flex-col justify-between border-r border-slate-800 shadow-xl">
      <div className="flex flex-col">
        {/* Logo & App Header */}
        <div className="h-14 px-4 flex items-center gap-3 border-b border-slate-800/80 bg-[#0B0F17]/60">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
            <span className="material-symbols-outlined text-[20px]">settings_suggest</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5 leading-tight">
              RecallOps
            </span>
            <span className="text-[10px] font-medium tracking-wide uppercase text-slate-400 leading-tight">
              Episodic Maintenance
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="px-2.5 py-4">
          <div className="px-2.5 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Diagnostic Core
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  type="button"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-colors text-left w-full ${
                    isActive
                      ? "font-semibold bg-blue-600 text-white shadow-sm"
                      : "font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Sidebar Footer / System Architecture */}
      <div className="p-3 border-t border-slate-800/80 bg-[#0B0F17]/50">
        <div className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/60 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              System Architecture
            </span>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                isOnline
                  ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                  : "bg-amber-950 text-amber-300 border-amber-800"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}
              ></span>
              {isOnline ? "Online" : "Connecting..."}
            </span>
          </div>

          <div className="flex flex-col gap-1 text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[13px] text-blue-400">memory</span>
              <span className="truncate">Groq LLM Engine</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[13px] text-teal-400">history_edu</span>
              <span className="truncate">Hindsight Episodic Memory</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[13px] text-slate-400">database</span>
              <span className="truncate">SQLite Persistence</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
