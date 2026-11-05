import React from "react";

export default function Footer({ backendHealth }) {
  const isHealthy = backendHealth?.status === "healthy" || backendHealth?.status === "ok";

  return (
    <footer className="w-full bg-surface-container-lowest/90 border-t border-outline-variant/20 py-space-md mt-auto">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-on-surface-variant font-label-sm text-label-sm">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isHealthy ? "bg-primary-container shadow-[0_0_8px_rgba(13,242,200,0.6)]" : "bg-rose-500"}`}></span>
            <span className="text-primary-container font-bold uppercase tracking-wider">
              RecallOps // Autonomous Intelligence
            </span>
          </div>
          <span className="text-outline-variant hidden sm:inline">|</span>
          <span className="text-on-surface-variant">Hindsight Cloud Memory Sync: Active</span>
          <span className="text-outline-variant hidden sm:inline">|</span>
          <span className="text-outline font-mono">v4.2.0-STABLE</span>
        </div>

        <div className="flex items-center gap-4 text-outline font-mono">
          <span>PARITY CHECK: VERIFIED</span>
          <span className="text-outline-variant">•</span>
          <span>© 2026 RecallOps</span>
        </div>
      </div>
    </footer>
  );
}
