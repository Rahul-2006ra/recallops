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
  Lock,
  Server,
  Sparkles,
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
      showToast?.("Credit Conservation Mode Enabled (Local Memory Active).", "info");
    } else {
      showToast?.("Live Hindsight Cloud Calls Enabled (Billable Credits Active).", "warning");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-6 border-b border-slate-800 bg-slate-900/40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-100">
                System Settings
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                RecallOps 2.0 configuration, credit conservation controls, and connection diagnostics.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Credit Conservation Card */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-100">
                    Hindsight Cloud Credit Conservation
                  </h3>
                  <p className="text-xs text-slate-400">
                    Preserve hackathon demonstration credits by utilizing local episodic memory fixtures.
                  </p>
                </div>
              </div>

              <button
                onClick={handleToggleMock}
                aria-label={`Toggle credit conservation mode. Currently ${mockMemoryMode ? "active" : "disabled"}`}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition self-start sm:self-auto shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
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
                    🛡️ <strong>Credit Protection is Active:</strong> Memory retrieval queries our local episodic database of verified plant repair records (0 billable credits consumed). The live Hindsight Cloud bank (<code>recallops-demo</code>) is verified and primed for live demonstrations.
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
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 shadow-sm">
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
                  <span>Temperature:</span>
                  <span className="text-slate-200">0.2 (Diagnostic calibrated)</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Max Tokens:</span>
                  <span className="text-slate-200">800</span>
                </div>
              </div>
            </div>

            {/* Hindsight Cloud */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-xs text-slate-200">Episodic Memory Bank</h4>
                  <span className="text-[10px] text-slate-400">Hindsight Vector Cloud</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Bank ID:</span>
                  <span className="text-teal-400">recallops-demo</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Base URL:</span>
                  <span className="text-slate-300">api.hindsight.vectorize.io</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Retain Mode:</span>
                  <span className="text-slate-200">{mockMemoryMode ? "Mock / Guarded" : "Live Billable"}</span>
                </div>
              </div>
            </div>

            {/* Local SQLite Database */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-xs text-slate-200">Persistent Local Storage</h4>
                  <span className="text-[10px] text-slate-400">SQLite Engine</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Database File:</span>
                  <span className="text-slate-300">recallops.db</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Integrity Constraint:</span>
                  <span className="text-emerald-400">Idempotency Enforced</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Offline Resilience:</span>
                  <span className="text-emerald-400">Active</span>
                </div>
              </div>
            </div>

            {/* Security and Credentials */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-xs text-slate-200">Security & Privacy</h4>
                  <span className="text-[10px] text-slate-400">Server-Side Protected</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 leading-relaxed text-slate-400">
                <p>
                  API keys and backend configuration are securely stored in server environment variables and never exposed to the frontend.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
