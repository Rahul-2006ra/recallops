import React, { useState, useEffect } from "react";
import { getIncidentDetails } from "../../services/api";

export default function InvestigationsView({ incidents, onSelectIncident, onOpenRepairModal, onOpenInvestigation }) {
  const [selectedIncidentId, setSelectedIncidentId] = useState(
    incidents.find((i) => i.status !== "REPORTED")?.id || incidents[0]?.id || null
  );
  const [incidentDetail, setIncidentDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedIncidentId) {
      setLoading(true);
      getIncidentDetails(selectedIncidentId)
        .then((data) => setIncidentDetail(data))
        .catch((err) => console.error("Error loading incident detail:", err))
        .finally(() => setLoading(false));
    }
  }, [selectedIncidentId]);

  const investigatedIncidents = incidents.filter(
    (i) => i.status !== "REPORTED" || i.id === selectedIncidentId
  );

  const currentInvestigation = incidentDetail?.investigations?.[0];

  return (
    <div className="flex flex-col gap-4">
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">AI Diagnostic Investigations</h2>
          <p className="text-xs text-slate-500">
            Powered by Groq <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">openai/gpt-oss-120b</code> reasoning grounded in Hindsight Cloud episodic memory.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left list: investigated incidents */}
        <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200 shadow-xs p-3 flex flex-col gap-2 max-h-[700px] overflow-y-auto">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-1">
            Investigated Equipment ({investigatedIncidents.length})
          </span>
          {investigatedIncidents.map((inc) => {
            const isSelected = inc.id === selectedIncidentId;
            return (
              <button
                key={inc.id}
                onClick={() => setSelectedIncidentId(inc.id)}
                type="button"
                className={`p-2.5 rounded-lg border text-left transition-all flex flex-col gap-1 ${
                  isSelected
                    ? "bg-blue-50/70 border-blue-400 shadow-xs"
                    : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-slate-900">{inc.id}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                    {inc.machine_id}
                  </span>
                </div>
                <p className="text-xs text-slate-700 line-clamp-1 font-medium">{inc.symptoms}</p>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                  <span>Status: {inc.status}</span>
                  <span className="font-bold text-blue-600">Select &rarr;</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right pane: Detailed Investigation View */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {loading ? (
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <span className="material-symbols-outlined text-[32px] animate-spin text-blue-600">sync</span>
              <span className="text-xs font-semibold">Retrieving investigation dossier...</span>
            </div>
          ) : incidentDetail ? (
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
              {/* Incident Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base text-slate-900">
                      {incidentDetail.incident.id}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800">
                      {incidentDetail.incident.machine_id}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                      {incidentDetail.incident.equipment_type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    {incidentDetail.incident.symptoms}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenInvestigation(incidentDetail.incident.id)}
                    type="button"
                    className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">refresh</span>
                    <span>Re-Analyze</span>
                  </button>
                  {incidentDetail.incident.status === "INVESTIGATED" && (
                    <button
                      onClick={() => onOpenRepairModal(incidentDetail.incident)}
                      type="button"
                      className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                    >
                      <span className="material-symbols-outlined text-[15px]">build</span>
                      <span>Log Repair</span>
                    </button>
                  )}
                </div>
              </div>

              {currentInvestigation ? (
                <div className="flex flex-col gap-4">
                  {/* Hypothesis Box */}
                  <div className="bg-blue-50/50 rounded-lg border border-blue-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-blue-800 font-bold text-xs uppercase tracking-wider">
                        <span className="material-symbols-outlined text-[16px]">psychology</span>
                        <span>AI Diagnostic Hypothesis</span>
                      </div>
                      <div className="flex items-center gap-1 bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-bold">
                        <span>Confidence:</span>
                        <span>{Math.round(currentInvestigation.confidence * 100)}%</span>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                      {currentInvestigation.diagnosis_hypothesis}
                    </p>
                  </div>

                  {/* Safety Warnings */}
                  {currentInvestigation.safety_warnings?.length > 0 && (
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs uppercase tracking-wider">
                        <span className="material-symbols-outlined text-[16px]">warning</span>
                        <span>Mandatory Safety Protocols</span>
                      </div>
                      <ul className="list-disc list-inside text-xs text-rose-900 space-y-1">
                        {currentInvestigation.safety_warnings.map((warn, i) => (
                          <li key={i}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommended Steps */}
                  <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block mb-2">
                      Recommended Diagnostic Steps
                    </span>
                    <ol className="space-y-1.5">
                      {currentInvestigation.recommended_diagnostic_steps?.map((step, idx) => (
                        <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="leading-snug">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Provenance Evidence */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1 mb-1.5">
                        <span className="material-symbols-outlined text-[14px]">verified</span>
                        Supporting Evidence (Hindsight Recall)
                      </span>
                      <ul className="text-xs text-emerald-950 space-y-1">
                        {currentInvestigation.supporting_evidence?.map((ev, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span>•</span>
                            <span>{ev}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="border border-rose-200 bg-rose-50/40 rounded-lg p-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1 mb-1.5">
                        <span className="material-symbols-outlined text-[14px]">block</span>
                        Contraindicated / Ineffective Past Actions
                      </span>
                      <ul className="text-xs text-rose-950 space-y-1">
                        {currentInvestigation.unsuccessful_previous_repairs?.length > 0 ? (
                          currentInvestigation.unsuccessful_previous_repairs.map((un, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span>•</span>
                              <span>{un}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-slate-500 italic">No unsuccessful repair history recorded for this failure pattern.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-lg flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-[36px] text-slate-400">psychology</span>
                  <span className="text-xs font-semibold text-slate-700">No investigation has been executed for this incident yet.</span>
                  <button
                    onClick={() => onOpenInvestigation(incidentDetail.incident.id)}
                    className="mt-1 px-3 py-1.5 rounded bg-blue-600 text-white font-semibold text-xs shadow-xs hover:bg-blue-700 transition-colors"
                  >
                    Run AI Investigation Now
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-400 text-xs">
              Select an incident on the left to view AI diagnostic investigation details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
