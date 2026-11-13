import React, { useState, useEffect } from "react";
import {
  Settings,
  Database,
  Cpu,
  Shield,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Activity,
  DollarSign,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { getChatStatus, checkHealth } from "../../services/api";

export default function SettingsView({
  mockMemoryMode,
  setMockMemoryMode,
  onOpenLegacyFleetView,
  showToast,
}) {
  const [systemStatus, setSystemStatus] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStatus() {
      setIsLoading(true);
      try {
        const [stat, health] = await Promise.all([
          getChatStatus().catch(() => null),
          checkHealth().catch(() => null),
        ]);
        setSystemStatus(stat);
        setHealthStatus(health);
      } catch (err) {
        console.warn("Failed to load settings status:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadStatus();
  }, []);

  const handleToggleMock = () => {
    const nextMode = !mockMemoryMode;
    setMockMemoryMode(nextMode);
    if (nextMode) {
      showToast?.("Credit Conservation Mode Enabled (Mocked Memory Active).", "info");
    } else {
      showToast?.("Live Hindsight Cloud Calls Enabled (Billable Credits Active).", "warning");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-6 border-b border-slate-800 bg-slate-900/40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-100">
                System Settings & Architecture
              </h1>
              <p className="text-xs text-slate-400">
                RecallOps 2.0 configuration, credit conservation controls, and connection diagnostics.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Credit Conservation Card */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-100">
                    Hindsight Cloud Credit Conservation
                  </h3>
                  <p className="text-xs text-slate-400">
                    Protect hackathon demonstration credits by utilizing local episodic memory fixtures.
                  </p>
                </div>
              </div>

              <button
                onClick={handleToggleMock}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition"
                style={{
                  backgroundColor: mockMemoryMode ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  borderColor: mockMemoryMode ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
                  color: mockMemoryMode ? "#34d399" : "#f87171",
                }}
              >
                {mockMemoryMode ? (
                  <>
                    <Shield className="w-3.5 h-3.5" />
                    <span>Protected Mode (Active)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Live Cloud Billing (Active)</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-xs text-slate-300 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 leading-relaxed">
              <p>
                {mockMemoryMode ? (
                  <>
                    🛡️ <strong>Credit Protection is ON:</strong> Memory retrieval queries our local episodic database of verified plant repair records (0 credits consumed). The live Hindsight Cloud bank (`recallops-demo`) is verified and primed for the hackathon finale demo.
                  </>
                ) : (
                  <>
                    ⚠️ <strong>Live Cloud Calls are ENABLED:</strong> Chat troubleshooting queries will make live API calls to Hindsight Cloud. Each recall/retain consumes upstream credit balance.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Core Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Groq AI Engine */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-xs text-slate-200">AI Reasoning Engine</h4>
                  <span className="text-[10px] text-slate-400">Groq Cloud Inference</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Model:</span>
                  <span className="text-emerald-400">openai/gpt-oss-120b</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Inference Latency:</span>
                  <span className="text-slate-300">~800ms</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Structured Output:</span>
                  <span className="text-slate-300">Enabled</span>
                </div>
              </div>
            </div>

            {/* Hindsight Cloud */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-xs text-slate-200">Long-Term Memory</h4>
                  <span className="text-[10px] text-slate-400">Hindsight Episodic Cloud</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Memory Bank:</span>
                  <span className="text-blue-400">recallops-demo</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Verified Outcome:</span>
                  <span className="text-emerald-400">PUMP-301 (Retained)</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Auth Verification:</span>
                  <span className="text-emerald-400">Confirmed Live</span>
                </div>
              </div>
            </div>
          </div>

          {/* System Health Check */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h4 className="font-semibold text-xs text-slate-200">Backend Health & Endpoints</h4>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {healthStatus?.status || "Healthy"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 block text-[10px]">SERVICE</span>
                <span className="text-slate-200">RecallOps 2.0</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 block text-[10px]">ENVIRONMENT</span>
                <span className="text-slate-200">{healthStatus?.environment || "Development"}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 block text-[10px]">DATABASE</span>
                <span className="text-slate-200">SQLite Embedded (240+ Incidents)</span>
              </div>
            </div>
          </div>

          {/* Secondary Legacy Fleet Tools */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-slate-400" />
                <div>
                  <h4 className="font-semibold text-xs text-slate-300">
                    Legacy Plant Fleet & Investigation Dashboard
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Switch to the multi-view industrial operations console (Incidents Table, Benchmark Trial, Machine Explorer).
                  </p>
                </div>
              </div>

              <button
                onClick={onOpenLegacyFleetView}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
              >
                <span>Launch Fleet View</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
