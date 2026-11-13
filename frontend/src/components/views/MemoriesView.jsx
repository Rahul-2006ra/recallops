import React, { useState, useEffect } from "react";
import {
  Search,
  Database,
  CheckCircle2,
  XCircle,
  Filter,
  Wrench,
  Clock,
  ExternalLink,
  X,
  ShieldCheck,
  Tag,
  RefreshCw,
} from "lucide-react";
import { listMemories } from "../../services/api";

export default function MemoriesView({ mockMemoryMode, showToast }) {
  const [memories, setMemories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("ALL");
  const [selectedMemory, setSelectedMemory] = useState(null);

  const fetchMemories = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (outcomeFilter !== "ALL") params.outcome_status = outcomeFilter;
      params.limit = 40;

      const data = await listMemories(params);
      setMemories(data.memories || []);
    } catch (err) {
      console.error("Failed to load memories:", err);
      showToast?.("Failed to retrieve episodic memory records.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [outcomeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchMemories();
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* View Header */}
      <div className="px-6 py-6 border-b border-slate-800 bg-slate-900/40">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Database className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-100">
                Episodic Memory Bank
              </h1>
              {mockMemoryMode ? (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-amber-800/60 flex items-center gap-1">
                  <span>Sample Memory / Demo Mode</span>
                </span>
              ) : (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 flex items-center gap-1">
                  <span>Hindsight Cloud Live (recallops-demo)</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Verified equipment repairs, failure modes, and certified field outcomes retained for multi-machine learning.
            </p>
          </div>

          <button
            onClick={fetchMemories}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh Bank</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/20">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-3 items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by equipment, symptom, or repair action..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </form>

          {/* Outcome Filter Chips */}
          <div className="flex items-center gap-1.5 w-full md:w-auto">
            <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3" />
              Outcome:
            </span>
            {["ALL", "SUCCESSFUL", "UNSUCCESSFUL"].map((status) => (
              <button
                key={status}
                onClick={() => setOutcomeFilter(status)}
                className={`text-xs px-2.5 py-1 rounded-lg transition font-medium ${
                  outcomeFilter === status
                    ? status === "SUCCESSFUL"
                      ? "bg-emerald-600 text-white"
                      : status === "UNSUCCESSFUL"
                      ? "bg-rose-600 text-white"
                      : "bg-blue-600 text-white"
                    : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                {status === "ALL" ? "All Memories" : status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Memory List Grid */}
      <div className="flex-1 px-6 py-6">
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-400">Loading episodic memories from bank...</p>
            </div>
          ) : memories.length === 0 ? (
            <div className="py-20 text-center max-w-sm mx-auto space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-slate-600 flex items-center justify-center mx-auto">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-sm text-slate-200">No Memories Found</h3>
              <p className="text-xs text-slate-400">
                No verified records match your filter criteria. Troubleshooting sessions will automatically retain verified field outcomes here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {memories.map((mem) => {
                const isSuccess = mem.outcome_status === "SUCCESSFUL";
                return (
                  <div
                    key={mem.id}
                    onClick={() => setSelectedMemory(mem)}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 transition cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-200 group-hover:text-blue-300 transition">
                            {mem.machine_id}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium px-2 py-0.5 rounded bg-slate-800">
                            {mem.equipment_type}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1 ${
                            isSuccess
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800/80"
                              : "bg-rose-950 text-rose-400 border border-rose-800/80"
                          }`}
                        >
                          {isSuccess ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          {mem.outcome_status}
                        </span>
                      </div>

                      {/* Symptoms */}
                      <p className="text-xs text-slate-300 mb-2 font-medium line-clamp-2">
                        {mem.symptoms}
                      </p>

                      {/* Action Taken */}
                      <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/60 text-xs text-slate-400 mb-3">
                        <strong className="text-slate-300 block mb-0.5">Repair Action:</strong>
                        <span className="line-clamp-2">{mem.action_taken}</span>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>Verified: {mem.verified_at ? mem.verified_at.slice(0, 10) : "Recorded"}</span>
                      <span className="flex items-center gap-1 group-hover:text-blue-400 transition">
                        <span>Details</span>
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Full Record Modal */}
      {selectedMemory && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative text-slate-100">
            <button
              onClick={() => setSelectedMemory(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-base text-slate-100">
                Verified Episodic Record
              </h3>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Machine ID:</span>
                <span className="font-mono text-slate-200">{selectedMemory.machine_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Equipment Type:</span>
                <span className="text-slate-200">{selectedMemory.equipment_type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Verified Outcome:</span>
                <span
                  className={`font-bold ${
                    selectedMemory.outcome_status === "SUCCESSFUL"
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {selectedMemory.outcome_status}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Technician ID:</span>
                <span className="font-mono text-slate-300">{selectedMemory.verified_by}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Verification Date:</span>
                <span className="font-mono text-slate-300">{selectedMemory.verified_at}</span>
              </div>
              {selectedMemory.hindsight_document_id && (
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Memory Doc ID:</span>
                  <span className="font-mono text-blue-400 text-[11px]">
                    {selectedMemory.hindsight_document_id}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5 text-xs">
              <strong className="text-slate-300 block">Reported Problem Symptoms:</strong>
              <p className="text-slate-400 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                {selectedMemory.symptoms}
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <strong className="text-slate-300 block">Physical Action Taken:</strong>
              <p className="text-slate-400 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                {selectedMemory.action_taken}
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <strong className="text-slate-300 block">Post-Repair Inspection Notes:</strong>
              <p className="text-slate-400 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                {selectedMemory.inspection_notes || "Inspection completed under load."}
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedMemory(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
