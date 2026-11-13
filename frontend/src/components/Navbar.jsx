import React, { useState } from "react";
import {
  Sparkles,
  Database,
  History,
  Settings,
  Plus,
  Menu,
  X,
  Layers,
  ArrowLeft,
  Shield,
} from "lucide-react";

export default function Navbar({
  activeTab,
  onTabChange,
  backendHealth,
  onNewChat,
  isLegacyMode,
  mockMemoryMode,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const primaryNavItems = [
    { id: "assistant", label: "AI Assistant", icon: Sparkles },
    { id: "memories", label: "My Memories", icon: Database },
    { id: "history", label: "History", icon: History },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const isOnline = backendHealth?.status === "healthy" || backendHealth?.status === "ok";

  const handleNavClick = (tabId) => {
    onTabChange(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 shadow-md">
      <div className="h-16 w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => handleNavClick("assistant")}
            className="flex items-center gap-2.5 group focus:outline-none cursor-pointer text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-950/40 group-hover:scale-105 transition-all">
              <Sparkles className="w-4 h-4 fill-slate-950" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold tracking-tight text-white">
                Recall<span className="text-emerald-400">Ops</span>
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                2.0
              </span>
            </div>
          </button>

          {/* Return from Legacy Fleet pill if applicable */}
          {isLegacyMode ? (
            <button
              onClick={() => handleNavClick("assistant")}
              className="hidden md:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to AI Assistant</span>
            </button>
          ) : (
            /* Desktop Navigation Tabs */
            <nav className="hidden md:flex items-center gap-1">
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                      isActive
                        ? "bg-slate-800 text-emerald-400 border border-slate-700/80 shadow-inner"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-3">
          {/* Status Pills */}
          <div className="hidden sm:flex items-center gap-2">
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${
                isOnline
                  ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-400"
                  : "bg-amber-950/60 border-amber-800/60 text-amber-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOnline ? "bg-emerald-400" : "bg-amber-400 animate-ping"
                }`}
              ></span>
              {isOnline ? "System Ready" : "Connecting"}
            </span>

            {mockMemoryMode && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-400" />
                Protected
              </span>
            )}
          </div>

          {/* Quick Action: New Chat */}
          <button
            onClick={onNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Chat</span>
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950 px-4 py-3 space-y-1 shadow-2xl">
          {isLegacyMode && (
            <button
              onClick={() => handleNavClick("assistant")}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white flex items-center gap-2 mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to AI Assistant</span>
            </button>
          )}
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2.5 ${
                  isActive
                    ? "bg-slate-800 text-emerald-400 font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
