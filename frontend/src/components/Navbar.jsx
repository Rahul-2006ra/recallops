import React, { useState } from "react";

export default function Navbar({
  activeTab,
  onTabChange,
  backendHealth,
  onOpenReportModal,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: "overview", label: "Overview", icon: "hub" },
    { id: "ai-investigations", label: "AI Investigations", icon: "psychology" },
    { id: "hindsight-memory", label: "Hindsight Memory", icon: "history_toggle_off" },
    { id: "learning-benchmark", label: "Learning Benchmark", icon: "compare_arrows" },
    { id: "incidents", label: "Incidents", icon: "warning" },
    { id: "machines", label: "Machines", icon: "precision_manufacturing" },
  ];

  const isOnline = backendHealth?.status === "healthy" || backendHealth?.status === "ok";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/30 shadow-[0_4px_20px_-4px_rgba(8,14,29,0.8)]">
      <div className="h-16 w-full px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-6 xl:gap-8">
          <button
            onClick={() => onTabChange("overview")}
            className="flex items-center gap-2.5 group focus:outline-none cursor-pointer text-left"
          >
            <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center border border-primary-container/30 shadow-[0_0_12px_rgba(13,242,200,0.2)] group-hover:border-primary-container transition-all">
              <span className="material-symbols-outlined text-primary-container text-[20px]">
                hub
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-headline-sm text-headline-sm font-semibold tracking-tight text-on-surface">
                Recall<span className="text-primary-container">Ops</span>
              </span>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-mono">
                v4.2
              </span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1.5 h-16">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`relative px-3 py-1.5 rounded-lg font-title-sm text-title-sm transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? "bg-primary-container text-on-primary-container font-semibold shadow-[0_0_12px_rgba(13,242,200,0.35)]"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  <span className={`material-symbols-outlined text-[17px] ${isActive ? "text-on-primary-container" : "text-outline"}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Telemetry Badge & Quick Actions */}
        <div className="flex items-center gap-3">
          {/* Telemetry Status Pill */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded bg-surface-container-high border border-primary-container/20">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? "bg-primary-container" : "bg-rose-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? "bg-primary-container shadow-[0_0_8px_rgba(13,242,200,0.8)]" : "bg-rose-500"}`}></span>
            </span>
            <span className="font-label-sm text-label-sm uppercase text-secondary tracking-widest font-semibold">
              {isOnline ? "Hindsight Memory Active" : "Backend Offline"}
            </span>
          </div>

          {/* Report Incident CTA Button */}
          <button
            onClick={onOpenReportModal}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary-container text-on-primary-container font-title-sm text-title-sm font-semibold shadow-[0_0_16px_rgba(13,242,200,0.3)] hover:shadow-[0_0_22px_rgba(13,242,200,0.5)] transition-all duration-200 active:scale-[0.98] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">add</span>
            <span>Report Incident</span>
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg bg-surface-container-high text-on-surface hover:text-primary-container focus:outline-none cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            <span className="material-symbols-outlined text-[22px]">
              {mobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-surface-container border-b border-outline-variant/30 px-4 py-3 flex flex-col gap-1.5 shadow-2xl animate-in slide-in-from-top-2 duration-150">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-lg text-left font-title-sm text-title-sm flex items-center justify-between cursor-pointer ${
                  isActive
                    ? "bg-primary-container text-on-primary-container font-semibold"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {isActive && (
                  <span className="material-symbols-outlined text-[16px]">
                    check
                  </span>
                )}
              </button>
            );
          })}
          <div className="pt-2 mt-1 border-t border-outline-variant/20 flex items-center justify-between">
            <button
              onClick={() => {
                onOpenReportModal();
                setMobileMenuOpen(false);
              }}
              className="w-full py-2 px-3 rounded-lg bg-primary-container text-on-primary-container font-title-sm text-title-sm font-semibold flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Report Incident</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
