import React, { useState } from "react";

export default function MachinesView({ incidents = [], onSelectIncident, onOpenReportModal, onNavigateTab }) {
  const [searchQuery, setSearchQuery] = useState("");

  // Base machinery fleet in the plant
  const fleetMachines = [
    {
      id: "M-112",
      name: "Centrifugal Slurry Pump M-112",
      type: "Centrifugal Slurry Pump",
      line: "Processing Plant · Bay 3 / Slurry Line Alpha",
      hindsight_code: "REC-112",
      icon: "precision_manufacturing",
      specs: "1750 RPM · 75 kW Drive · SKF Bearings",
    },
    {
      id: "DEMO-M-104",
      name: "Centrifugal Pump DEMO-M-104",
      type: "Centrifugal Pump",
      line: "Cooling Circuit C · Line 1",
      hindsight_code: "REC-104",
      icon: "water_pump",
      specs: "1450 RPM · Dual Impeller · In-line Chiller",
    },
    {
      id: "DEMO-M-108",
      name: "Drive Motor Assembly DEMO-M-108",
      type: "Drive Motor & Bearing Housing",
      line: "Main Extrusion West · Conveyor Drive",
      hindsight_code: "REC-108",
      icon: "settings_slow_motion",
      specs: "2800 RPM · 45 kW Induction · Forced Air",
    },
    {
      id: "HP-450",
      name: "Hydraulic Press Cell #4 (HP-450)",
      type: "Hydraulic Stamping Press",
      line: "Heavy Stamping Bay · Line 4",
      hindsight_code: "REC-450",
      icon: "compress",
      specs: "450 Ton Force · 2,400 PSI Nominal · Servo Actuated",
    },
    {
      id: "PUMP-04",
      name: "Boiler Feed Pump #4",
      type: "High-Pressure Feed Pump",
      line: "Thermal Utility Station · Boiler Bay 2",
      hindsight_code: "REC-004",
      icon: "hvac",
      specs: "3000 RPM · Multi-Stage Turbine · Water Feed",
    },
  ];

  // Also include any new machines discovered in the incidents list
  const incidentMachineIds = [...new Set(incidents.map((i) => i.machine_id))];
  const allFleet = [...fleetMachines];
  incidentMachineIds.forEach((id) => {
    if (!allFleet.some((m) => m.id === id)) {
      const matchInc = incidents.find((i) => i.machine_id === id);
      allFleet.push({
        id,
        name: `Asset ${id} (${matchInc?.equipment_type || "Machinery Unit"})`,
        type: matchInc?.equipment_type || "Machinery Unit",
        line: "Operating Footprint · Industrial Floor",
        hindsight_code: `REC-${id.slice(-3).toUpperCase()}`,
        icon: "precision_manufacturing",
        specs: "Operational Plant Machinery Unit",
      });
    }
  });

  const filteredFleet = allFleet.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      m.id.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.type.toLowerCase().includes(q) ||
      m.line.toLowerCase().includes(q)
    );
  });

  const getMachineIncidentStatus = (machineId) => {
    const machineIncidents = incidents.filter((i) => i.machine_id === machineId);
    if (machineIncidents.length === 0) {
      return {
        label: "Nominal · 0 Open Faults",
        type: "nominal",
        color: "text-primary border-primary-container/20 bg-surface-container-highest",
        dot: "bg-primary-container shadow-[0_0_8px_rgba(13,242,200,0.7)]",
        count: 0,
        incident: null,
      };
    }
    const active = machineIncidents.find((i) => i.status === "INVESTIGATING" || i.status === "REPORTED");
    if (active) {
      return {
        label: `Active Investigation (${active.id.slice(0, 10)})`,
        type: "active",
        color: "text-error border-error/20 bg-error-container/20",
        dot: "bg-error shadow-[0_0_8px_rgba(244,63,94,0.7)] animate-pulse",
        count: machineIncidents.length,
        incident: active,
      };
    }
    const resolved = machineIncidents.find((i) => i.status === "VERIFIED" || i.status === "RESOLVED");
    return {
      label: `Resolved · ${machineIncidents.length} Memories Retained`,
      type: "resolved",
      color: "text-secondary border-secondary/20 bg-surface-container-highest",
      dot: "bg-secondary shadow-[0_0_8px_rgba(79,219,200,0.6)]",
      count: machineIncidents.length,
      incident: resolved || machineIncidents[0],
    };
  };

  const handleInspectMachine = (machine) => {
    const status = getMachineIncidentStatus(machine.id);
    if (status.incident && onSelectIncident) {
      onSelectIncident(status.incident);
      if (onNavigateTab) onNavigateTab("ai-investigations");
    } else if (onSelectIncident) {
      // Find or create synthetic reference
      onSelectIncident({
        id: `CASE-${machine.id}`,
        machine_id: machine.id,
        equipment_type: machine.type,
        symptoms: `Telemetry audit record for ${machine.name}`,
        status: "RESOLVED",
      });
      if (onNavigateTab) onNavigateTab("ai-investigations");
    }
  };

  return (
    <div className="flex flex-col w-full relative overflow-hidden">
      {/* Background Glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[840px] h-[340px] bg-gradient-to-b from-primary-container/10 via-primary-container/5 to-transparent blur-3xl opacity-70 -z-10"></div>

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex flex-col gap-y-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2">
          <div className="flex flex-col gap-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full bg-surface-container-high border border-primary-container/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container shadow-[0_0_8px_rgba(13,242,200,0.8)]"></span>
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest font-mono">
                EQUIPMENT DIRECTORY
              </span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">
              Your machines. <span className="text-primary drop-shadow-[0_0_24px_rgba(13,242,200,0.25)]">Their memories.</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Every machine has a history. RecallOps makes it useful.
            </p>
          </div>

          <div className="flex items-center self-start md:self-end">
            <button
              onClick={onOpenReportModal}
              className="group relative inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-primary-container text-on-primary-container font-title-sm text-title-sm font-semibold transition-all duration-200 hover:shadow-[0_0_20px_rgba(13,242,200,0.4)] active:scale-[0.98] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:rotate-90">
                add
              </span>
              <span>Investigate a Failure</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="w-full">
          <div className="relative w-full rounded-xl bg-surface-container-low border border-outline-variant/30 shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all focus-within:border-primary-container/50">
            <div className="flex items-center h-14 px-4 gap-3">
              <span className="material-symbols-outlined text-outline text-[22px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your machines by asset ID, type, line, or bay..."
                className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-outline hover:text-on-surface cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
              <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-high border border-outline-variant/20 font-mono text-xs text-outline">
                <span>⌘</span>
                <span>K</span>
              </div>
            </div>
          </div>
        </div>

        {/* Machine Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {filteredFleet.length === 0 ? (
            <div className="col-span-2 p-12 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center text-on-surface-variant">
              No machines match your query "{searchQuery}".
            </div>
          ) : (
            filteredFleet.map((machine) => {
              const status = getMachineIncidentStatus(machine.id);

              return (
                <div
                  key={machine.id}
                  onClick={() => handleInspectMachine(machine)}
                  className="group relative rounded-xl bg-surface-container-low p-6 sm:p-7 flex flex-col justify-between border border-outline-variant/30 transition-all duration-300 hover:bg-surface-container hover:border-primary-container/40 hover:shadow-[0_0_28px_rgba(13,242,200,0.12)] cursor-pointer"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-lg bg-surface-container-highest border border-outline-variant/30 flex items-center justify-center text-primary group-hover:text-primary-container group-hover:border-primary-container/40 transition-colors shadow-inner">
                        <span className="material-symbols-outlined text-[26px]">
                          {machine.icon}
                        </span>
                      </div>

                      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border ${status.color}`}>
                        <span className={`w-2 h-2 rounded-full ${status.dot}`}></span>
                        <span className="font-label-sm text-[11px] font-mono font-medium">
                          {status.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <h2 className="font-title-lg text-title-lg text-on-surface group-hover:text-primary transition-colors tracking-tight font-bold">
                        {machine.name}
                      </h2>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        {machine.line}
                      </p>
                      <p className="font-label-sm text-label-sm text-outline font-mono mt-1">
                        {machine.specs}
                      </p>
                    </div>
                  </div>

                  <div className="pt-6 mt-4 border-t border-outline-variant/20 flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-mono">
                      HINDSIGHT // {machine.hindsight_code}
                    </span>
                    <span className="inline-flex items-center gap-1 font-label-md text-label-md text-secondary hover:text-primary-container transition-colors group-hover:translate-x-0.5">
                      <span>View History &amp; Diagnostics</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
