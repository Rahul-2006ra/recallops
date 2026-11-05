import React, { useState } from "react";

export default function IncidentsView({
  incidents,
  onSelectIncident,
  onOpenReportModal,
  onOpenInvestigation,
  onOpenRepairModal,
  onOpenVerifyModal,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch =
      inc.machine_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.symptoms.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.equipment_type.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity =
      severityFilter === "ALL" || inc.severity === severityFilter;

    const matchesStatus =
      statusFilter === "ALL" || inc.status === statusFilter;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-rose-200 text-rose-900 border border-rose-300";
      case "HIGH":
        return "bg-red-100 text-red-800 border border-red-200";
      case "MEDIUM":
        return "bg-amber-100 text-amber-800 border border-amber-200";
      case "LOW":
        return "bg-slate-100 text-slate-700 border border-slate-200";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "REPORTED":
        return { bg: "bg-slate-100 text-slate-700 border-slate-200", label: "Awaiting Investigation" };
      case "INVESTIGATING":
        return { bg: "bg-blue-100 text-blue-800 border-blue-200", label: "Investigating..." };
      case "INVESTIGATED":
        return { bg: "bg-purple-100 text-purple-900 border-purple-200", label: "Precedent Found" };
      case "REPAIRED":
        return { bg: "bg-amber-100 text-amber-900 border-amber-200", label: "Repair Done (Unverified)" };
      case "VERIFIED_SUCCESSFUL":
        return { bg: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Verified Successful" };
      case "VERIFIED_UNSUCCESSFUL":
        return { bg: "bg-rose-100 text-rose-800 border-rose-200", label: "Verified Unsuccessful" };
      default:
        return { bg: "bg-slate-100 text-slate-700 border-slate-200", label: status };
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top action row */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Incident Registry & Operations</h2>
          <p className="text-xs text-slate-500">
            Comprehensive audit log of all machinery anomalies, diagnostic runs, and verified outcomes.
          </p>
        </div>
        <button
          onClick={onOpenReportModal}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[15px]">add_circle</span>
          <span>Report New Incident</span>
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, machine, equipment, symptoms..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:bg-white focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-700 outline-none cursor-pointer focus:bg-white focus:border-blue-500"
          >
            <option value="ALL">Severity: All</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-700 outline-none cursor-pointer focus:bg-white focus:border-blue-500"
          >
            <option value="ALL">Status: All</option>
            <option value="REPORTED">Reported</option>
            <option value="INVESTIGATED">Investigated</option>
            <option value="REPAIRED">Repaired</option>
            <option value="VERIFIED_SUCCESSFUL">Verified Success</option>
            <option value="VERIFIED_UNSUCCESSFUL">Verified Failure</option>
          </select>
        </div>
      </div>

      {/* Full Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3.5">Incident ID</th>
                <th className="py-2.5 px-3">Machine</th>
                <th className="py-2.5 px-3">Equipment</th>
                <th className="py-2.5 px-3">Symptoms</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3.5 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No incidents match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((incident) => {
                  const statusInfo = getStatusBadge(incident.status);
                  return (
                    <tr
                      key={incident.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-2.5 px-3.5 font-mono font-semibold text-slate-900">
                        {incident.id}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {incident.machine_id}
                        {incident.is_demo && (
                          <span className="ml-1 text-[9px] px-1 py-0.2 bg-slate-100 text-slate-500 rounded font-mono">
                            DEMO
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{incident.equipment_type}</td>
                      <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate" title={incident.symptoms}>
                        {incident.symptoms}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${getSeverityBadge(
                            incident.severity
                          )}`}
                        >
                          {incident.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${statusInfo.bg}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => onSelectIncident(incident)}
                            className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold text-[11px] hover:bg-slate-200 transition-colors"
                          >
                            Details
                          </button>
                          {incident.status === "REPORTED" && (
                            <button
                              onClick={() => {
                                onSelectIncident(incident);
                                onOpenInvestigation(incident.id);
                              }}
                              className="px-2 py-1 rounded bg-blue-600 text-white font-semibold text-[11px] hover:bg-blue-700 transition-colors"
                            >
                              Investigate
                            </button>
                          )}
                          {incident.status === "INVESTIGATED" && (
                            <button
                              onClick={() => {
                                onSelectIncident(incident);
                                onOpenRepairModal(incident);
                              }}
                              className="px-2 py-1 rounded bg-amber-600 text-white font-semibold text-[11px] hover:bg-amber-700 transition-colors"
                            >
                              Log Repair
                            </button>
                          )}
                          {incident.status === "REPAIRED" && (
                            <button
                              onClick={() => {
                                onSelectIncident(incident);
                                onOpenVerifyModal(incident);
                              }}
                              className="px-2 py-1 rounded bg-emerald-600 text-white font-semibold text-[11px] hover:bg-emerald-700 transition-colors"
                            >
                              Verify
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3.5 py-2 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between text-[11px] text-slate-500">
          <span>Showing {filteredIncidents.length} of {incidents.length} recorded incidents</span>
          <span>SQLite Store + Hindsight Episodic Retain</span>
        </div>
      </div>
    </div>
  );
}
