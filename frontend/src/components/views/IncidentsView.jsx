import React, { useState } from "react";

export default function IncidentsView({
  incidents = [],
  onSelectIncident,
  onOpenReportModal,
  onOpenInvestigation,
  onOpenRepairModal,
  onOpenVerifyModal,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filterTabs = [
    { id: "all", label: "All Incidents" },
    { id: "open", label: "Open" },
    { id: "investigating", label: "Investigating" },
    { id: "resolved", label: "Resolved" },
  ];

  const getStatusCategory = (status) => {
    switch (status?.toUpperCase()) {
      case "REPORTED":
      case "OPEN":
        return "open";
      case "INVESTIGATING":
      case "DIAGNOSED":
        return "investigating";
      case "REPAIRED":
      case "RESOLVED":
      case "VERIFIED":
        return "resolved";
      default:
        return "open";
    }
  };

  const filteredIncidents = incidents.filter((inc) => {
    const category = getStatusCategory(inc.status);
    const matchesTab = statusFilter === "all" || category === statusFilter;

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      inc.id.toLowerCase().includes(q) ||
      inc.machine_id.toLowerCase().includes(q) ||
      (inc.equipment_type && inc.equipment_type.toLowerCase().includes(q)) ||
      (inc.symptoms && inc.symptoms.toLowerCase().includes(q));

    return matchesTab && matchesSearch;
  });

  const counts = {
    all: incidents.length,
    open: incidents.filter((i) => getStatusCategory(i.status) === "open").length,
    investigating: incidents.filter((i) => getStatusCategory(i.status) === "investigating").length,
    resolved: incidents.filter((i) => getStatusCategory(i.status) === "resolved").length,
  };

  const getStatusBadge = (status) => {
    const cat = getStatusCategory(status);
    if (cat === "investigating") {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/40 text-amber-300 font-label-sm text-label-sm font-medium tracking-wide border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
          <span>Investigating</span>
        </div>
      );
    }
    if (cat === "resolved") {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/40 text-emerald-300 font-label-sm text-label-sm font-medium tracking-wide border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>Resolved &amp; Retained</span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-950/40 text-sky-300 font-label-sm text-label-sm font-medium tracking-wide border border-sky-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
        <span>Open Anomaly</span>
      </div>
    );
  };

  const getAccentPillColor = (status) => {
    const cat = getStatusCategory(status);
    if (cat === "investigating") return "bg-amber-400/80 group-hover:bg-amber-400 group-hover:shadow-[0_0_12px_rgba(251,191,36,0.6)]";
    if (cat === "resolved") return "bg-emerald-400/80 group-hover:bg-emerald-400 group-hover:shadow-[0_0_12px_rgba(16,185,129,0.6)]";
    return "bg-sky-400/80 group-hover:bg-sky-400 group-hover:shadow-[0_0_12px_rgba(56,189,248,0.6)]";
  };

  return (
    <div className="flex flex-col w-full relative overflow-hidden">
      {/* Dynamic Ambient Glow Backdrops */}
      <div className="absolute -top-32 left-1/4 w-[540px] h-[320px] bg-primary-container/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
      <div className="absolute top-1/2 -right-24 w-[460px] h-[360px] bg-secondary/5 rounded-full blur-[140px] pointer-events-none -z-10"></div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex flex-col gap-y-8 w-full">
        {/* Header Section */}
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
          <div className="max-w-3xl flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high border border-primary-container/20 w-fit shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container shadow-[0_0_8px_rgba(13,242,200,0.8)]"></span>
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-medium">
                Incident Management &amp; Retrieval
              </span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">
              Every failure has a story.
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
              Track machine incidents, investigate recurring symptoms, and turn verified repairs into reusable intelligence across your operating footprint.
            </p>
          </div>

          <div className="flex items-center">
            <button
              onClick={onOpenReportModal}
              className="group relative inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-title-sm font-semibold shadow-[0_0_20px_rgba(13,242,200,0.25)] hover:shadow-[0_0_28px_rgba(13,242,200,0.5)] transition-all duration-200 active:scale-[0.98] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] font-semibold transition-transform group-hover:rotate-90 duration-300">
                add
              </span>
              <span>New Investigation</span>
            </button>
          </div>
        </div>

        {/* Search & Telemetry Controls Shelf */}
        <div className="relative flex flex-col gap-4">
          {/* Search Input Container */}
          <div className="relative w-full rounded-xl bg-surface-container-low border border-outline-variant/30 p-1.5 shadow-xl transition-all focus-within:border-primary-container/50">
            <div className="relative flex items-center h-14 px-4 bg-surface-container rounded-lg">
              <span className="material-symbols-outlined text-outline text-[22px] mr-3 select-none">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search machine, symptom, or incident ID (e.g. INC-20261105, vibration, casing temperature)..."
                className="w-full bg-transparent text-on-surface font-body-md text-body-md placeholder:text-outline focus:outline-none tracking-normal"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-outline hover:text-on-surface mr-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-surface-container-high shadow-inner select-none pointer-events-none">
                <span className="font-label-sm text-label-sm text-outline-variant font-medium">Press</span>
                <kbd className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface text-secondary font-mono shadow-sm">/</kbd>
                <span className="font-label-sm text-label-sm text-outline-variant font-medium">to focus</span>
              </div>
            </div>
          </div>

          {/* Segmented Category Filters & Sync Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-surface-container-low border border-outline-variant/30 rounded-lg w-fit shadow-sm">
              {filterTabs.map((tab) => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-4 py-1.5 rounded font-label-md text-label-md font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? "text-on-surface bg-surface-container-highest shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] opacity-75 font-mono">({counts[tab.id]})</span>
                  </button>
                );
              })}
            </div>

            {/* Hindsight Memory Sync Badge Indicator */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant/30 w-fit shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary-fixed opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-container shadow-[0_0_8px_rgba(13,242,200,0.8)]"></span>
              </span>
              <span className="font-label-sm text-label-sm tracking-wide uppercase text-secondary font-medium font-mono">
                Indexed in Hindsight Memory
              </span>
              <span className="font-label-sm text-label-sm text-outline-variant font-mono pl-1">
                ● 100% Sync
              </span>
            </div>
          </div>
        </div>

        {/* Incident List Feed */}
        <div className="flex flex-col gap-4">
          {filteredIncidents.length === 0 ? (
            <div className="p-12 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center text-on-surface-variant flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[36px] text-outline">
                folder_off
              </span>
              <div className="font-title-sm text-title-sm font-semibold text-on-surface">
                No incidents match your current filter
              </div>
              <p className="text-xs text-outline max-w-sm">
                Try resetting your search query or report a new machinery incident to begin an investigation.
              </p>
              <button
                onClick={onOpenReportModal}
                className="mt-2 px-4 py-2 rounded-lg bg-primary-container text-on-primary-container text-xs font-bold"
              >
                + Report New Incident
              </button>
            </div>
          ) : (
            filteredIncidents.map((inc) => (
              <article
                key={inc.id}
                className="incident-card group relative flex flex-col xl:flex-row xl:items-center justify-between gap-6 p-6 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 hover:border-outline-variant/60 transition-all duration-300 shadow-md hover:shadow-xl"
              >
                {/* Left Accent Pill */}
                <div
                  className={`absolute left-0 top-6 bottom-6 w-1 rounded-r transition-all ${getAccentPillColor(
                    inc.status
                  )}`}
                ></div>

                <div className="flex flex-col gap-3 max-w-4xl pl-2">
                  {/* Card Header Line */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 font-label-lg text-label-lg font-mono text-on-surface font-semibold tracking-tight">
                      <span className="text-primary-fixed-dim">{inc.id}</span>
                      <span className="text-outline">/</span>
                      <span className="text-on-surface-variant font-normal">{inc.machine_id}</span>
                    </div>

                    {getStatusBadge(inc.status)}

                    <div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm font-mono">
                      <span className="material-symbols-outlined text-[15px] text-outline">
                        schedule
                      </span>
                      <span>
                        {inc.created_at
                          ? new Date(inc.created_at).toLocaleString("en-US", {
                              month: "short",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Live Record"}
                      </span>
                    </div>
                  </div>

                  {/* Machine Name & Symptoms */}
                  <div className="flex flex-col gap-1">
                    <h2 className="font-headline-md text-title-lg text-on-surface font-semibold tracking-tight group-hover:text-primary transition-colors">
                      {inc.machine_id}{" "}
                      <span className="font-body-md text-on-surface-variant font-normal">
                        ({inc.equipment_type || "Machinery Asset"})
                      </span>
                    </h2>
                    <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                      {inc.symptoms}
                    </p>
                  </div>

                  {/* Precedent / Memory Tag */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-surface-container-high text-secondary font-label-sm text-label-sm font-medium border border-outline-variant/20">
                      <span className="material-symbols-outlined text-secondary text-[16px]">
                        psychology
                      </span>
                      <span>
                        {inc.status === "VERIFIED" || inc.hindsight_retained
                          ? "Verified Outcome Retained in Hindsight Cloud"
                          : "Hindsight Precedents Indexed (recallops-demo)"}
                      </span>
                    </div>

                    <div className="hidden sm:inline-flex items-center gap-1.5 font-label-sm text-label-sm text-outline font-mono">
                      <span>Severity: <strong className="text-on-surface">{inc.severity || "HIGH"}</strong></span>
                      <span className="text-outline-variant">•</span>
                      <span>Target: <strong className="text-primary-container">{inc.machine_id}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 xl:self-center xl:pl-6 shrink-0 flex-wrap">
                  <button
                    onClick={() => {
                      if (onSelectIncident) onSelectIncident(inc);
                      if (onOpenInvestigation) onOpenInvestigation(inc);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-surface-container-high text-primary hover:bg-primary-container hover:text-on-primary-container font-title-sm text-title-sm font-semibold transition-all duration-200 border border-outline-variant/30 cursor-pointer shadow-sm"
                  >
                    <span>View Investigation</span>
                    <span className="material-symbols-outlined text-[18px]">
                      arrow_forward
                    </span>
                  </button>

                  {inc.status !== "VERIFIED" && (
                    <button
                      onClick={() => onOpenRepairModal(inc)}
                      className="px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface-variant hover:text-on-surface text-xs font-semibold border border-outline-variant/20 transition-all cursor-pointer"
                    >
                      Log Repair
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
