import React from "react";

export default function MachinesView({ incidents, onSelectIncident }) {
  // Group incidents by machine_id
  const machineMap = incidents.reduce((acc, inc) => {
    if (!acc[inc.machine_id]) {
      acc[inc.machine_id] = {
        machine_id: inc.machine_id,
        equipment_type: inc.equipment_type,
        is_demo: inc.is_demo,
        incidents: [],
      };
    }
    acc[inc.machine_id].incidents.push(inc);
    return acc;
  }, {});

  const machines = Object.values(machineMap);

  const getMachineHealth = (machineIncidents) => {
    const hasUnresolved = machineIncidents.some(
      (i) => i.status === "REPORTED" || i.status === "INVESTIGATING" || i.status === "INVESTIGATED"
    );
    const hasAwaitingVerification = machineIncidents.some((i) => i.status === "REPAIRED");
    if (hasUnresolved) {
      return { status: "ATTENTION NEEDED", bg: "bg-rose-100 text-rose-800 border-rose-300" };
    }
    if (hasAwaitingVerification) {
      return { status: "AWAITING VERIFICATION", bg: "bg-amber-100 text-amber-800 border-amber-300" };
    }
    return { status: "OPTIMAL (VERIFIED)", bg: "bg-emerald-100 text-emerald-800 border-emerald-300" };
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Machine Fleet Health Directory</h2>
          <p className="text-xs text-slate-500">
            Telemetry tracking and episodic memory indexing grouped by industrial asset.
          </p>
        </div>
        <div className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded border border-slate-200">
          Total Monitored Assets: {machines.length}
        </div>
      </div>

      {/* Grid of Machines */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {machines.map((mach) => {
          const health = getMachineHealth(mach.incidents);
          return (
            <div
              key={mach.machine_id}
              className="bg-white rounded-lg border border-slate-200 shadow-xs p-4 flex flex-col justify-between gap-3 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base text-slate-900">
                      {mach.machine_id}
                    </span>
                    {mach.is_demo && (
                      <span className="text-[9px] px-1 py-0.5 bg-slate-100 text-slate-500 rounded font-mono">
                        DEMO
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${health.bg}`}>
                    {health.status}
                  </span>
                </div>

                <div className="text-xs text-slate-600 font-medium">
                  {mach.equipment_type}
                </div>

                <div className="text-[11px] text-slate-500">
                  Total Logged Incidents:{" "}
                  <strong className="text-slate-800 font-semibold">{mach.incidents.length}</strong>
                </div>

                <div className="mt-2 border-t border-slate-100 pt-2 flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Recent Incidents:
                  </span>
                  <div className="flex flex-col gap-1">
                    {mach.incidents.slice(0, 3).map((inc) => (
                      <div
                        key={inc.id}
                        onClick={() => onSelectIncident(inc)}
                        className="cursor-pointer p-1.5 rounded bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs transition-colors"
                      >
                        <span className="font-mono text-slate-700 text-[11px]">{inc.id}</span>
                        <span className="text-[10px] font-medium text-slate-500">
                          {inc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectIncident(mach.incidents[0])}
                className="w-full py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
              >
                Inspect Primary Incident
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
