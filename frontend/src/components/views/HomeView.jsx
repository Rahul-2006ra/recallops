import React, { useState } from "react";

export default function HomeView({
  incidents = [],
  onStartInvestigation,
  onOpenReportModal,
  onNavigateTab,
  onSelectIncident,
}) {
  const [symptomPrompt, setSymptomPrompt] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState("M-112");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("Start Investigation");

  const examplePrompts = [
    {
      machine: "M-112",
      type: "Centrifugal Slurry Pump",
      label: "M-112: 7.4 mm/s vibration & 86°C casing temperature",
      text: "Centrifugal slurry pump experiencing 7.4 mm/s high-frequency vibration spike at 1750 RPM and casing temperature rise to 86°C while cooling grilles remain completely clear.",
    },
    {
      machine: "M-108",
      type: "Drive Motor & Bearing Housing",
      label: "M-108: Bearing temperature rise recurring after replacement",
      text: "Drive motor bearing temperature recurring at 89.4°C after 28 minutes of operation despite previous bearing replacement.",
    },
    {
      machine: "HP-450",
      type: "Hydraulic Stamping Press",
      label: "HP-450: Cyclical pressure bleed below 2,100 PSI",
      text: "Rapid cyclical pressure drop below 2,100 PSI during stroke descent accompanied by servo valve oscillation and resonance.",
    },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const prompt = symptomPrompt.trim();
    if (!prompt) {
      setSymptomPrompt(examplePrompts[0].text);
      return;
    }

    setIsSubmitting(true);
    setStatusText("Querying Memory...");

    // Check if an existing incident matches the machine or prompt
    const existing = incidents.find(
      (i) =>
        i.machine_id === selectedMachineId ||
        i.symptoms?.toLowerCase().includes(selectedMachineId.toLowerCase())
    );

    setTimeout(async () => {
      setStatusText("Synthesizing Hindsight...");
      try {
        if (onStartInvestigation) {
          await onStartInvestigation({
            machine_id: selectedMachineId || "M-112",
            equipment_type:
              examplePrompts.find((p) => p.machine === selectedMachineId)?.type ||
              "Industrial Machinery Unit",
            symptoms: prompt,
            reported_observations: "Reported via RecallOps diagnostic console prompt.",
            severity: "HIGH",
          });
        }
      } catch (err) {
        console.error("Home investigation error:", err);
      } finally {
        setIsSubmitting(false);
        setStatusText("Start Investigation");
      }
    }, 600);
  };

  const handleSelectChip = (promptObj) => {
    setSymptomPrompt(promptObj.text);
    setSelectedMachineId(promptObj.machine);
  };

  // Operational metrics
  const totalIncidents = incidents.length;
  const verifiedMemories = incidents.filter(
    (i) => i.hindsight_retained || i.status === "VERIFIED"
  ).length;
  const uniqueMachines = new Set(incidents.map((i) => i.machine_id)).size;
  const activeInvestigations = incidents.filter(
    (i) => i.status === "INVESTIGATING" || i.status === "REPORTED"
  ).length;

  return (
    <div className="flex flex-col w-full relative overflow-hidden">
      {/* Ambient Teal Field Glow Dynamics (Background Luminescence) */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[520px] bg-primary-container/[0.08] blur-[140px] rounded-full pointer-events-none -z-10"></div>
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[260px] bg-secondary-fixed/[0.05] blur-[100px] rounded-full pointer-events-none -z-10"></div>

      {/* Primary Centered Console Stage */}
      <section className="relative min-h-[calc(100vh-14rem)] w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-between py-8 md:py-12">
        {/* Core Interactive Hero Module */}
        <div className="w-full flex flex-col items-center text-center max-w-3xl my-auto">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-container-high/80 border border-primary-container/20 shadow-[0_0_12px_rgba(13,242,200,0.08)] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container shadow-[0_0_8px_rgba(13,242,200,0.7)] animate-pulse"></span>
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary font-semibold">
              AI MAINTENANCE WITH PERSISTENT MEMORY
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="font-headline-xl text-headline-xl sm:text-[54px] sm:leading-[62px] text-on-surface tracking-tight font-bold mb-5">
            Machines fail.<br />
            <span className="text-primary-container">Memory shouldn't.</span>
          </h1>

          {/* Supporting Statement */}
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mx-auto leading-relaxed mb-8">
            Meet RecallOps — the AI maintenance agent that remembers what worked, learns from what failed, and makes every repair smarter.
          </p>

          {/* Primary Investigation Input Field */}
          <div className="w-full max-w-2xl px-2 sm:px-0">
            <form onSubmit={handleSubmit} className="relative group">
              <div className="bg-surface-container-low/80 backdrop-blur-xl rounded-2xl p-2 sm:p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 border border-primary-container/20 shadow-[0_16px_40px_-12px_rgba(8,14,29,0.9),0_0_0_1px_rgba(45,212,191,0.14)] focus-within:shadow-[0_20px_48px_-8px_rgba(8,14,29,0.95),0_0_0_1px_rgba(13,242,200,0.45),0_0_24px_rgba(13,242,200,0.18)] transition-all duration-300">
                {/* Left AI Status Icon */}
                <div className="hidden sm:flex items-center pl-3 pr-1 text-primary-container shrink-0">
                  <span className="material-symbols-outlined text-[22px] transition-transform duration-300 group-focus-within:rotate-45 group-focus-within:scale-110">
                    auto_awesome
                  </span>
                </div>

                {/* Machine Target Selector */}
                <select
                  value={selectedMachineId}
                  onChange={(e) => setSelectedMachineId(e.target.value)}
                  className="bg-surface-container text-on-surface font-label-sm text-label-sm px-2.5 py-1.5 rounded-lg border border-outline-variant/30 focus:outline-none focus:border-primary-container cursor-pointer shrink-0"
                >
                  <option value="M-112">Asset M-112</option>
                  <option value="DEMO-M-104">Asset DEMO-M-104</option>
                  <option value="DEMO-M-108">Asset DEMO-M-108</option>
                  <option value="HP-450">Asset HP-450</option>
                  <option value="PUMP-04">Asset PUMP-04</option>
                </select>

                {/* Text Input */}
                <input
                  type="text"
                  autoComplete="off"
                  spellCheck="false"
                  value={symptomPrompt}
                  onChange={(e) => setSymptomPrompt(e.target.value)}
                  placeholder="Describe a machine failure or unusual symptoms..."
                  className="flex-1 bg-transparent px-3 py-2 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none min-w-0"
                />

                {/* Primary Cybernetic CTA */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary-container hover:bg-secondary-fixed text-on-primary-container font-headline-sm text-title-sm px-5 py-3 rounded-xl transition-all duration-200 active:scale-[0.98] shadow-[0_0_16px_rgba(13,242,200,0.3)] hover:shadow-[0_0_24px_rgba(13,242,200,0.5)] flex items-center justify-center gap-2 shrink-0 font-semibold cursor-pointer disabled:opacity-80"
                >
                  <span>{statusText}</span>
                  <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-0.5">
                    arrow_forward
                  </span>
                </button>
              </div>
            </form>

            {/* Quick Demonstration Chips */}
            <div className="flex items-center justify-center flex-wrap gap-2 mt-4 text-[11px]">
              <span className="font-label-sm text-label-sm text-outline">Try Sample Failure:</span>
              {examplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectChip(p)}
                  className="px-2.5 py-1 rounded-full bg-surface-container-high/60 hover:bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-primary-container transition-all cursor-pointer font-label-sm text-label-sm truncate max-w-xs"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Secondary Learning Action */}
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => onNavigateTab("learning-benchmark")}
                className="group inline-flex items-center gap-1.5 font-title-sm text-title-sm text-on-surface-variant hover:text-primary-container transition-colors duration-200 cursor-pointer"
              >
                <span>See How RecallOps Learns</span>
                <span className="font-label-md text-label-md transition-transform duration-200 group-hover:translate-x-1">
                  →
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 4-Stage Computational Sequence */}
        <div className="w-full max-w-3xl mt-12 pt-6 border-t border-outline-variant/20">
          <div className="w-full flex items-center justify-between px-2 sm:px-6">
            {/* Step 1: Investigate */}
            <div className="flex items-center gap-2.5 group cursor-default">
              <div className="relative flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-container shadow-[0_0_8px_rgba(13,242,200,0.9)]"></span>
                <span className="absolute w-5 h-5 rounded-full bg-primary-container/20 animate-ping"></span>
              </div>
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary-container font-semibold">
                Investigate
              </span>
            </div>

            <div className="flex-1 mx-2 sm:mx-6 h-[1px] bg-gradient-to-r from-primary-container/40 via-surface-container-highest to-surface-container-highest"></div>

            {/* Step 2: Recall */}
            <div className="flex items-center gap-2 group cursor-default">
              <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_6px_rgba(79,219,200,0.6)]"></span>
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">
                Recall
              </span>
            </div>

            <div className="flex-1 mx-2 sm:mx-6 h-[1px] bg-surface-container-highest"></div>

            {/* Step 3: Recommend */}
            <div className="flex items-center gap-2 group cursor-default">
              <span className="w-2 h-2 rounded-full bg-primary-fixed-dim"></span>
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">
                Recommend
              </span>
            </div>

            <div className="flex-1 mx-2 sm:mx-6 h-[1px] bg-surface-container-highest"></div>

            {/* Step 4: Learn */}
            <div className="flex items-center gap-2 group cursor-default">
              <span className="w-2 h-2 rounded-full bg-primary-container"></span>
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary font-semibold">
                Learn
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Live Operational Metrics Shelf */}
      <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            onClick={() => onNavigateTab("incidents")}
            className="p-5 rounded-xl bg-surface-container border border-outline-variant/30 shadow-md hover:border-primary-container/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Total Case Registry
              </span>
              <span className="material-symbols-outlined text-outline group-hover:text-primary-container transition-colors text-[20px]">
                warning
              </span>
            </div>
            <div className="font-headline-md text-headline-md text-on-surface font-bold">
              {totalIncidents}
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Active &amp; audited plant incidents
            </p>
          </div>

          <div
            onClick={() => onNavigateTab("hindsight-memory")}
            className="p-5 rounded-xl bg-surface-container border border-outline-variant/30 shadow-md hover:border-primary-container/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Verified Memories
              </span>
              <span className="material-symbols-outlined text-secondary group-hover:text-primary-container transition-colors text-[20px]">
                history_toggle_off
              </span>
            </div>
            <div className="font-headline-md text-headline-md text-secondary font-bold">
              {verifiedMemories} Cases
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Retained in Hindsight Cloud
            </p>
          </div>

          <div
            onClick={() => onNavigateTab("learning-benchmark")}
            className="p-5 rounded-xl bg-surface-container border border-primary-container/30 shadow-[0_0_20px_rgba(13,242,200,0.06)] hover:border-primary-container transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary">
                Controlled Trials
              </span>
              <span className="material-symbols-outlined text-primary-container text-[20px]">
                science
              </span>
            </div>
            <div className="font-headline-md text-headline-md text-primary-container font-bold">
              3 of 3 (100%)
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Coupling alignment recall rate
            </p>
          </div>

          <div
            onClick={() => onNavigateTab("machines")}
            className="p-5 rounded-xl bg-surface-container border border-outline-variant/30 shadow-md hover:border-primary-container/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Machinery Fleet
              </span>
              <span className="material-symbols-outlined text-outline group-hover:text-primary-container transition-colors text-[20px]">
                precision_manufacturing
              </span>
            </div>
            <div className="font-headline-md text-headline-md text-on-surface font-bold">
              {Math.max(uniqueMachines, 5)} Units
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Sensors &amp; telemetry connected
            </p>
          </div>
        </div>

        {/* Recent Cases Fast-Launch Strip */}
        <div className="mt-8 p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-container"></span>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface font-semibold">
                Active Machinery Case Spotlight
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Quickly launch or review the primary benchmark case M-112 or recent incidents.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {incidents.slice(0, 3).map((inc) => (
              <button
                key={inc.id}
                onClick={() => {
                  if (onSelectIncident) onSelectIncident(inc);
                  onNavigateTab("ai-investigations");
                }}
                className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface hover:text-primary-container font-mono text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
              >
                <span>{inc.machine_id}</span>
                <span className="text-[10px] text-outline">({inc.id.slice(0, 12)}...)</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
