import React from "react";

export default function Footer({ backendHealth }) {
  const isHealthy = backendHealth?.status === "healthy" || backendHealth?.status === "ok";

  return (
    <footer className="w-full bg-slate-950/80 border-t border-slate-900/90 py-3 mt-auto">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isHealthy ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
            }`}
          />
          <span className="font-medium text-slate-400">
            {isHealthy ? "System Operational" : "Connecting..."}
          </span>
          <span className="text-slate-700 hidden sm:inline">•</span>
          <span className="hidden sm:inline text-slate-500">
            Episodic Equipment Memory
          </span>
        </div>

        <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
          <span>RecallOps 2.0</span>
          <span className="text-slate-800">•</span>
          <span>© 2026</span>
        </div>
      </div>
    </footer>
  );
}
