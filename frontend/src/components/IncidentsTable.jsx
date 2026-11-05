import React, { useState } from "react";

export default function IncidentsTable({
  incidents,
  selectedIncidentId,
  onSelectIncident,
  onOpenInvestigation,
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
        return "bg-rose-200 text-rose-900";
      case "HIGH":
        return "bg-red-100 text-red-800";
      case "MEDIUM":
        return "bg-amber-100 text-amber-800";
      case "LOW":
        return "bg-slate-100 text-slate-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "REPORTED":
        return {
          bg: "bg-slate-100 text-slate-700",
          text: "Awaiting Inspection",
        };
      case "INVESTIGATING":
        return {
          bg: "bg-blue-100 text-blue-800",
          text: "Under Investigation",
        };
      case "INVESTIGATED":
        return {
          bg: "bg-purple-100 text-purple-900",
          text: "Precedent Found",
        };
      case "REPAIRED":
        return {
          bg: "bg-amber-100 text-amber-900",
          text: "Verification Needed",
        };
      case "VERIFIED_SUCCESSFUL":
        return {
          bg: "bg-emerald-100 text-emerald-800",
          text: "Verified Success",
        };
      case "VERIFIED_UNSUCCESSFUL":
        return {
          bg: "bg-rose-100 text-rose-800",
          text: "Verified Failure",
        };
      default:
        return { bg: "bg-slate-100 text-slate-700", text: status };
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs flex flex-col overflow-hidden">
      {/* Table Controls Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Active Incidents
          </h2>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
            {incidents.length} Records
          </span>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-44">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[15px]">
              search
            </span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-blue-500"
              placeholder="Filter machine or ID..."
              type="text"
            />
          </div>

          <div className="relative">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-700 outline-none cursor-pointer focus:bg-white focus:border-blue-500 pr-6"
            >
              <option value="ALL">Severity: All</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-700 outline-none cursor-pointer focus:bg-white focus:border-blue-500 pr-6"
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
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              <th className="py-2.5 px-3">Incident ID</th>
              <th className="py-2.5 px-3">Machine</th>
              <th className="py-2.5 px-3">Reported Symptom</th>
              <th className="py-2.5 px-3">Severity</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-800 text-[11px]">
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  <span className="material-symbols-outlined text-2xl mb-1">search_off</span>
                  <p>No matching incidents found.</p>
                </td>
              </tr>
            ) : (
              filteredIncidents.map((inc) => {
                const isSelected = selectedIncidentId === inc.id;
                const statusInfo = getStatusBadge(inc.status);
                const severityClass = getSeverityBadge(inc.severity);

                return (
                  <tr
                    key={inc.id}
                    onClick={() => onSelectIncident(inc)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/40 hover:bg-blue-50/60"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="py-2 px-3 font-mono font-bold text-blue-700">
                      {inc.id}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900">
                      {inc.machine_id}
                    </td>
                    <td className="py-2 px-3 text-slate-700 max-w-xs truncate" title={inc.symptoms}>
                      {inc.symptoms}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${severityClass}`}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusInfo.bg}`}
                      >
                        {statusInfo.text}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      {inc.status === "REPORTED" ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectIncident(inc);
                            if (onOpenInvestigation) {
                              onOpenInvestigation(inc.id);
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-blue-600 text-white font-semibold text-[11px] hover:bg-blue-700 transition-colors cursor-pointer"
                          type="button"
                        >
                          Open Investigation
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectIncident(inc);
                          }}
                          className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px] hover:bg-slate-200 transition-colors cursor-pointer"
                          type="button"
                        >
                          View Details
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="px-3.5 py-2 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between text-[11px] text-slate-500 font-medium">
        <span>Demonstration sample active incidents</span>
        <span>Total: {filteredIncidents.length} listed</span>
      </div>
    </div>
  );
}
