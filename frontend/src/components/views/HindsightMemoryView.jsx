import React, { useState } from "react";

export default function HindsightMemoryView({ incidents = [], systemHealth }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedMemoryId, setSelectedMemoryId] = useState("M-112");

  // Curated baseline + verified episodic memories
  const staticMemories = [
    {
      id: "M-112",
      case_id: "INC-20261105-CF6B1D",
      machine_id: "M-112",
      equipment_type: "Centrifugal Slurry Pump",
      date: "NOV 05, 2026",
      type: "success",
      status_label: "VERIFIED SUCCESS",
      technician: "TECH-941",
      symptoms: "Abnormal high-frequency vibration spike at 7.4 mm/s and casing temperature rise to 86°C under full duty cycle. Cooling grilles verified clean.",
      repair_action: "Laser aligned motor-pump shaft coupling and dynamically balanced the pump impeller. Actuator and bearings left intact.",
      outcome: "Post-repair vibration normalized to 1.2 mm/s; temperature stabilized at 48°C. Zero recurrence over extended production shift.",
      pre_telemetry: { vibration: "7.4 mm/s", temp: "86°C", acoustic: "2.4 kHz harmonic spike" },
      post_telemetry: { vibration: "1.2 mm/s", temp: "48°C", acoustic: "Baseline laminar gradient" },
      bank: "recallops-demo",
      vector_hash: "0x8F44A29B",
    },
    {
      id: "DEMO-M-104",
      case_id: "INC-DEMO-104",
      machine_id: "DEMO-M-104",
      equipment_type: "Cooling Circuit Centrifugal Pump",
      date: "OCT 12, 2026",
      type: "success",
      status_label: "VERIFIED SUCCESS",
      technician: "TECH-108",
      symptoms: "Mild casing overheating to 68°C with minor differential pressure drop across heat exchanger.",
      repair_action: "Cleaned ventilation path, vacuumed intake grilles, and cleared debris from cooling fins.",
      outcome: "Temperature normalized to 52°C; vibration stabilized at 2.1 mm/s post-cleaning.",
      pre_telemetry: { vibration: "2.8 mm/s", temp: "68°C", acoustic: "Airflow restriction noise" },
      post_telemetry: { vibration: "2.1 mm/s", temp: "52°C", acoustic: "Normal laminar flow" },
      bank: "recallops-demo",
      vector_hash: "0x3A71F8E4",
    },
    {
      id: "DEMO-M-108",
      case_id: "INC-DEMO-108",
      machine_id: "DEMO-M-108",
      equipment_type: "Drive Motor & Bearing Housing",
      date: "OCT 18, 2026",
      type: "failure",
      status_label: "VERIFIED UNSUCCESSFUL (ANTI-PATTERN)",
      technician: "TECH-212",
      symptoms: "Overheating to 89.4°C and cyclical mechanical noise after 30 minutes of continuous duty.",
      repair_action: "Replaced primary drive bearings (SKF-6205-2RSH) without clearing clogged intake ventilation path.",
      outcome: "Overheating recurred within 28 minutes. $6,800 replacement bearing expense failed to resolve root issue.",
      pre_telemetry: { vibration: "4.2 mm/s", temp: "89.4°C", acoustic: "High thermal friction" },
      post_telemetry: { vibration: "4.1 mm/s", temp: "88.9°C", acoustic: "Thermal trip repeated in 28m" },
      bank: "recallops-demo",
      vector_hash: "0x93000AE1",
    },
  ];

  // Dynamic memories from incidents with verified outcomes
  const dynamicMemories = incidents
    .filter((inc) => inc.status === "VERIFIED" || inc.hindsight_retained)
    .filter((inc) => !staticMemories.some((m) => m.case_id === inc.id || m.machine_id === inc.machine_id))
    .map((inc) => ({
      id: inc.machine_id || inc.id,
      case_id: inc.id,
      machine_id: inc.machine_id,
      equipment_type: inc.equipment_type || "Industrial Asset Unit",
      date: new Date(inc.created_at || Date.now()).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase(),
      type: "success",
      status_label: "VERIFIED SUCCESS",
      technician: "TECH-ON-DUTY",
      symptoms: inc.symptoms || "Reported machinery anomaly and telemetry deviation.",
      repair_action: "Physical corrective action logged and verified under plant protocol.",
      outcome: "Outcome verified and episodic record retained in Hindsight Cloud memory bank.",
      pre_telemetry: { vibration: "7.0+ mm/s", temp: "Elevated", acoustic: "Anomaly detected" },
      post_telemetry: { vibration: "Normal", temp: "Stabilized", acoustic: "OEM compliant" },
      bank: "recallops-demo",
      vector_hash: `0x${inc.id.slice(-6).toUpperCase()}`,
    }));

  const allMemories = [...staticMemories, ...dynamicMemories];

  // Filtering
  const filteredMemories = allMemories.filter((mem) => {
    const matchesFilter =
      filterType === "all" ||
      (filterType === "success" && mem.type === "success") ||
      (filterType === "failure" && mem.type === "failure");

    const matchesSearch =
      !searchQuery.trim() ||
      mem.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mem.machine_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mem.symptoms.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mem.repair_action.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const selectedMemory =
    allMemories.find((m) => m.id === selectedMemoryId) ||
    filteredMemories[0] ||
    allMemories[0];

  const successCount = allMemories.filter((m) => m.type === "success").length;
  const failureCount = allMemories.filter((m) => m.type === "failure").length;

  return (
    <div className="flex flex-col w-full relative overflow-hidden">
      {/* Subtle decorative ambient backlight backdrop */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[840px] h-[340px] bg-primary-container/[0.06] rounded-full blur-[140px] pointer-events-none -z-10"></div>
      <div className="absolute top-72 right-1/4 w-[420px] h-[280px] bg-secondary/[0.05] rounded-full blur-[120px] pointer-events-none -z-10"></div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex flex-col gap-y-10">
        {/* 1. Header / Hero Section */}
        <section className="flex flex-col items-center text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-container-high border border-primary-container/20 shadow-sm mb-4">
            <span className="w-2 h-2 rounded-full bg-primary-container shadow-[0_0_8px_rgba(13,242,200,0.7)]"></span>
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary font-semibold">
              PERSISTENT INDUSTRIAL INTELLIGENCE
            </span>
          </div>

          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight mb-2 font-bold">
            Every repair becomes experience.
          </h1>

          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">
            Explore how RecallOps remembers successful repairs, learns from failed attempts, and retrieves relevant experience for future machine failures.
          </p>
        </section>

        {/* 2. Visual Memory Connection: 3-step learning pathway */}
        <section className="w-full max-w-4xl mx-auto">
          <div className="relative bg-surface-container-low border border-outline-variant/30 rounded-xl p-6 shadow-md overflow-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
              {/* Step 1: Past Failure */}
              <div className="flex-1 w-full flex flex-col items-center text-center p-4 bg-surface-container rounded-lg border border-outline-variant/20">
                <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-secondary mb-2">
                  <span className="material-symbols-outlined text-[18px]">build_circle</span>
                </div>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline mb-1">
                  Observation
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Past Failure
                </span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  Symptom signature &amp; mechanical context recorded
                </p>
              </div>

              {/* Connector 1 */}
              <div className="flex flex-col items-center justify-center px-1 py-1 md:py-0">
                <div className="hidden md:flex items-center gap-1 text-primary">
                  <span className="w-6 h-[1px] bg-secondary-container"></span>
                  <span className="material-symbols-outlined text-[16px] text-secondary">
                    arrow_forward
                  </span>
                </div>
                <span className="font-label-sm text-[10px] text-secondary tracking-tight mt-1 text-center whitespace-nowrap font-mono">
                  verified outcome
                </span>
              </div>

              {/* Step 2: Verified Outcome */}
              <div className="flex-1 w-full flex flex-col items-center text-center p-4 bg-surface-container-high rounded-lg border border-primary-container/30 shadow-[0_0_24px_rgba(13,242,200,0.06)]">
                <div className="w-8 h-8 rounded-full bg-primary-container/20 flex items-center justify-center text-primary-container mb-2">
                  <span className="material-symbols-outlined text-[18px]">task_alt</span>
                </div>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary mb-1">
                  Audit Ledger
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Verified Outcome
                </span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  Technician proof: valid fixes and anti-pattern logs
                </p>
              </div>

              {/* Connector 2 */}
              <div className="flex flex-col items-center justify-center px-1 py-1 md:py-0">
                <div className="hidden md:flex items-center gap-1 text-primary">
                  <span className="w-6 h-[1px] bg-secondary-container"></span>
                  <span className="material-symbols-outlined text-[16px] text-secondary">
                    arrow_forward
                  </span>
                </div>
                <span className="font-label-sm text-[10px] text-secondary tracking-tight mt-1 text-center whitespace-nowrap font-mono">
                  nearest-neighbor
                </span>
              </div>

              {/* Step 3: Future Recommendation */}
              <div className="flex-1 w-full flex flex-col items-center text-center p-4 bg-surface-container rounded-lg border border-outline-variant/20">
                <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-secondary mb-2">
                  <span className="material-symbols-outlined text-[18px]">psychology_alt</span>
                </div>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline mb-1">
                  Instant Recall
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Future Diagnostic
                </span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  Targeted triage matching prior ground-truth history
                </p>
              </div>
            </div>

            {/* Dual Ingestion Banner */}
            <div className="mt-4 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-lowest/60 rounded px-4 py-3 border border-outline-variant/20">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-primary-container shrink-0"></span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  <strong className="text-on-surface font-semibold">Dual Ingestion: </strong>
                  Successful repairs establish proven remediation protocols. Failed attempts establish critical anti-patterns to prevent repeating misdiagnoses.
                </span>
              </div>
              <span className="font-label-sm text-label-sm text-secondary font-medium tracking-wide uppercase shrink-0 font-mono">
                Deterministic Memory
              </span>
            </div>
          </div>
        </section>

        {/* 3. Primary Memory Search & Filter Controls */}
        <section className="w-full max-w-4xl mx-auto flex flex-col gap-3">
          {/* Search Input Bar */}
          <div className="relative bg-surface-container-low border border-outline-variant/30 rounded-xl p-2 shadow-md">
            <div className="flex items-center gap-3 bg-surface-container-lowest rounded-lg px-4 py-2.5">
              <span className="material-symbols-outlined text-outline text-[22px]">manage_search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search a machine failure, symptom, or repair experience..."
                className="w-full bg-transparent text-on-surface placeholder:text-outline focus:outline-none font-body-md text-body-md"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-outline hover:text-on-surface cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            {/* Natural Query Chips */}
            <div className="flex items-center gap-2 mt-2 px-2 flex-wrap text-xs">
              <span className="font-label-sm text-label-sm text-outline">Natural Query:</span>
              <button
                type="button"
                onClick={() => setSearchQuery("vibration after bearing replacement")}
                className="font-label-sm text-label-sm text-secondary hover:text-primary transition-colors text-left cursor-pointer"
              >
                “High-frequency vibration after bearing replacement”
              </button>
              <span className="text-outline text-label-sm">·</span>
              <button
                type="button"
                onClick={() => setSearchQuery("ventilation")}
                className="font-label-sm text-label-sm text-secondary hover:text-primary transition-colors text-left cursor-pointer"
              >
                “Ventilation differential pressure harmonic”
              </button>
            </div>
          </div>

          {/* Filter Tabs & Status Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 bg-surface-container-lowest p-1 rounded-lg border border-outline-variant/30">
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1.5 rounded font-label-sm text-label-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterType === "all"
                    ? "bg-surface-container-high text-primary font-bold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span>All Memories</span>
                <span className="px-1.5 py-0.2 rounded-full bg-surface-variant text-on-surface text-[10px]">
                  {allMemories.length}
                </span>
              </button>

              <button
                onClick={() => setFilterType("success")}
                className={`px-3 py-1.5 rounded font-label-sm text-label-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterType === "success"
                    ? "bg-surface-container-high text-primary font-bold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-primary-container"></span>
                <span>Successful Repairs</span>
                <span className="px-1.5 py-0.2 rounded-full bg-surface-variant text-on-surface-variant text-[10px]">
                  {successCount}
                </span>
              </button>

              <button
                onClick={() => setFilterType("failure")}
                className={`px-3 py-1.5 rounded font-label-sm text-label-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterType === "failure"
                    ? "bg-surface-container-high text-error font-bold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-error"></span>
                <span>Failed Attempts (Anti-Patterns)</span>
                <span className="px-1.5 py-0.2 rounded-full bg-surface-variant text-on-surface-variant text-[10px]">
                  {failureCount}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-low border border-outline-variant/20">
              <span className="material-symbols-outlined text-[16px] text-primary">
                verified_user
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">
                Verified by Plant Technicians
              </span>
            </div>
          </div>
        </section>

        {/* 4 & 5. Workspace: Memory Library (Left) & Active Inspection Pane (Right) */}
        <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Memory Cards List (col-span-7) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {filteredMemories.length === 0 ? (
              <div className="p-8 rounded-xl bg-surface-container border border-outline-variant/30 text-center text-on-surface-variant">
                No memories match your filter or search query.
              </div>
            ) : (
              filteredMemories.map((mem) => {
                const isSelected = selectedMemory.id === mem.id;
                const isSuccess = mem.type === "success";

                return (
                  <article
                    key={mem.id}
                    onClick={() => setSelectedMemoryId(mem.id)}
                    className={`relative rounded-xl p-5 border transition-all cursor-pointer group shadow-md ${
                      isSelected
                        ? "bg-surface-container border-primary-container/60 shadow-[0_0_20px_rgba(13,242,200,0.12)]"
                        : "bg-surface-container-low border-outline-variant/30 hover:bg-surface-container hover:border-outline-variant/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-label-md text-label-md text-on-surface font-semibold font-mono">
                          Memory {mem.id}
                        </span>
                        <span className="text-outline text-xs">/</span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-mono">
                          {mem.case_id}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-label-sm text-[10px] font-bold uppercase tracking-wider font-mono ${
                          isSuccess
                            ? "bg-secondary-container text-on-secondary-container"
                            : "bg-error-container text-on-error-container"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {isSuccess ? "check_circle" : "warning"}
                        </span>
                        {isSuccess ? "VERIFIED SUCCESS" : "FAILED ATTEMPT"}
                      </span>
                    </div>

                    <h3 className="font-title-md text-title-md text-on-surface font-semibold mb-1 group-hover:text-primary transition-colors">
                      {mem.equipment_type} ({mem.machine_id})
                    </h3>

                    <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 leading-relaxed mb-3">
                      {mem.symptoms}
                    </p>

                    <div className="p-2.5 rounded bg-surface-container-lowest border border-outline-variant/20 flex flex-col gap-1 text-xs">
                      <div className="text-on-surface-variant">
                        <span className="font-label-sm text-[10px] uppercase text-outline">Action: </span>
                        <span>{mem.repair_action}</span>
                      </div>
                      <div className={isSuccess ? "text-primary font-medium" : "text-error font-medium"}>
                        <span className="font-label-sm text-[10px] uppercase text-outline">Outcome: </span>
                        <span>{mem.outcome}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-outline font-mono pt-2 border-t border-surface-variant/30">
                      <span>Technician: {mem.technician}</span>
                      <span className="text-primary-container group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                        Inspect Telemetry Proof →
                      </span>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* Right Column: Active Inspection Pane (col-span-5) */}
          <div className="lg:col-span-5 sticky top-20 flex flex-col gap-4">
            <div className="p-6 rounded-xl bg-surface-container-high border border-primary-container/30 shadow-xl flex flex-col gap-5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-label-sm text-label-sm text-primary-container uppercase tracking-wider font-mono">
                    Episodic Audit Inspector
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mt-0.5">
                    {selectedMemory.id} Deep Proof
                  </h3>
                </div>
                <span className="font-mono text-xs text-outline px-2 py-1 rounded bg-surface-container-lowest border border-outline-variant/20">
                  {selectedMemory.vector_hash}
                </span>
              </div>

              {/* Machine & Date */}
              <div className="p-3 rounded-lg bg-surface-container border border-outline-variant/20 flex items-center justify-between">
                <div>
                  <span className="font-label-sm text-[10px] uppercase text-outline block">Asset Target</span>
                  <span className="font-title-sm text-title-sm text-on-surface font-semibold font-mono">
                    {selectedMemory.machine_id} — {selectedMemory.equipment_type}
                  </span>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">
                  {selectedMemory.date}
                </span>
              </div>

              {/* Comparative Pre vs Post Telemetry */}
              <div className="flex flex-col gap-2">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                  Comparative Telemetry Trace
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded bg-surface-container-lowest border border-error/20 flex flex-col gap-1">
                    <span className="font-label-sm text-[10px] uppercase text-error font-bold">PRE-REPAIR SPIKE</span>
                    <div>Vibration: <strong className="text-on-surface">{selectedMemory.pre_telemetry.vibration}</strong></div>
                    <div>Temp: <strong className="text-on-surface">{selectedMemory.pre_telemetry.temp}</strong></div>
                    <div className="text-[11px] text-outline">{selectedMemory.pre_telemetry.acoustic}</div>
                  </div>

                  <div className="p-3 rounded bg-surface-container-lowest border border-primary-container/20 flex flex-col gap-1">
                    <span className="font-label-sm text-[10px] uppercase text-primary font-bold">POST-REPAIR STATE</span>
                    <div>Vibration: <strong className="text-primary-container">{selectedMemory.post_telemetry.vibration}</strong></div>
                    <div>Temp: <strong className="text-primary-container">{selectedMemory.post_telemetry.temp}</strong></div>
                    <div className="text-[11px] text-outline">{selectedMemory.post_telemetry.acoustic}</div>
                  </div>
                </div>
              </div>

              {/* Maintenance Log */}
              <div className="flex flex-col gap-1.5">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                  Archived Maintenance Action
                </span>
                <p className="p-3 rounded bg-surface-container-lowest border border-outline-variant/20 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  {selectedMemory.repair_action}
                </p>
              </div>

              {/* Provenance Footer */}
              <div className="pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs text-outline font-mono">
                <span>Hindsight Bank: <strong className="text-secondary">{selectedMemory.bank}</strong></span>
                <span>Signed by: <strong className="text-on-surface">{selectedMemory.technician}</strong></span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
