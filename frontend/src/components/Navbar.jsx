import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Database,
  History,
  Settings,
  Plus,
  Menu,
  X,
  ArrowLeft,
  Shield,
  LogIn,
  LogOut,
  ChevronDown,
  User,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Navbar({
  activeTab,
  onTabChange,
  backendHealth,
  onNewChat,
  isLegacyMode,
  mockMemoryMode,
  onOpenAuthModal,
}) {
  const { user, logout, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    await logout();
  };

  const userDisplayName = user?.displayName || user?.email?.split("@")[0] || "Technician";
  const userInitials = (userDisplayName[0] || "U").toUpperCase();

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/90 shadow-sm">
      <div className="h-16 w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => handleNavClick("assistant")}
            aria-label="RecallOps Home"
            className="flex items-center gap-2.5 group cursor-pointer text-left rounded-lg p-1 focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-emerald-950/40 group-hover:scale-105 transition-transform duration-150">
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
              className="hidden md:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to AI Assistant</span>
            </button>
          ) : (
            /* Desktop Navigation Tabs */
            <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none ${
                      isActive
                        ? "bg-slate-800 text-emerald-400 border border-slate-700/80 shadow-inner"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/80"
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
          {/* Status Indicators (Shown on Desktop/Laptop viewports) */}
          <div className="hidden lg:flex items-center gap-2">
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${
                isOnline
                  ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-400"
                  : "bg-amber-950/60 border-amber-800/60 text-amber-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOnline ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
                }`}
              />
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
            aria-label="Start new chat"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors duration-150 shadow-sm border border-slate-700/80 focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">New Chat</span>
          </button>

          {/* User Authentication Menu / Sign-In Button */}
          {isAuthenticated ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-white transition focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
                aria-expanded={userDropdownOpen}
              >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={userDisplayName}
                    className="w-6 h-6 rounded-lg object-cover border border-emerald-500/50"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-emerald-700 text-slate-950 font-bold text-xs flex items-center justify-center">
                    {userInitials}
                  </div>
                )}
                <span className="hidden sm:inline max-w-[110px] truncate">{userDisplayName}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-2 px-3 z-50 text-white animate-fadeIn">
                  <div className="pb-2 border-b border-slate-800 mb-2">
                    <p className="text-xs font-bold truncate text-white">{userDisplayName}</p>
                    <p className="text-[11px] text-slate-400 truncate font-mono">{user?.email}</p>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Isolated Workspace Active</span>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 py-2 px-2.5 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => onOpenAuthModal && onOpenAuthModal("signin")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-slate-950 transition shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
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
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white flex items-center gap-2 mb-2 focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none"
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
                aria-current={isActive ? "page" : undefined}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2.5 focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:outline-none ${
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

          <div className="pt-2 border-t border-slate-800/80 mt-2">
            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-950/40 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out ({user?.email})</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuthModal && onOpenAuthModal("signin");
                }}
                className="w-full text-center px-3 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-slate-950 flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to RecallOps</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
