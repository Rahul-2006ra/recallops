import React, { useState, useEffect, useCallback } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

// RecallOps 2.0 Conversational Views
import ChatAssistantView from "./components/views/ChatAssistantView";
import MemoriesView from "./components/views/MemoriesView";
import ConversationsHistoryView from "./components/views/ConversationsHistoryView";
import SettingsView from "./components/views/SettingsView";

// Legacy Industrial Fleet Views (Preserved for secondary deep inspection)
import HomeView from "./components/views/HomeView";
import InvestigationResultsView from "./components/views/InvestigationResultsView";
import HindsightMemoryView from "./components/views/HindsightMemoryView";
import BenchmarkView from "./components/views/BenchmarkView";
import IncidentsView from "./components/views/IncidentsView";
import MachinesView from "./components/views/MachinesView";

// Modals
import ReportIncidentModal from "./components/modals/ReportIncidentModal";
import RepairModal from "./components/modals/RepairModal";
import VerifyOutcomeModal from "./components/modals/VerifyOutcomeModal";
import AuthModal from "./components/modals/AuthModal";

// Auth & Icons
import { useAuth } from "./context/AuthContext";
import { LogIn, Shield } from "lucide-react";

// Backend API Client
import {
  listIncidents,
  getIncidentDetails,
  createIncident,
  investigateIncident,
  logRepair,
  verifyOutcome,
  checkHealth,
} from "./services/api";

const LEGACY_TABS = [
  "overview",
  "ai-investigations",
  "hindsight-memory",
  "learning-benchmark",
  "incidents",
  "machines",
];

export default function App() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState("signin");

  // RecallOps 2.0 Default Landing Experience: AI Assistant
  const [activeTab, setActiveTab] = useState("assistant");
  const [activeConversationId, setActiveConversationId] = useState(() => {
    try {
      return sessionStorage.getItem("recallops_active_conv") || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (activeConversationId) {
        sessionStorage.setItem("recallops_active_conv", activeConversationId);
      } else {
        sessionStorage.removeItem("recallops_active_conv");
      }
    } catch (_) {}
  }, [activeConversationId]);

  const [mockMemoryMode, setMockMemoryMode] = useState(() => {
    try {
      const saved = localStorage.getItem("recallops_mock_mode");
      if (saved !== null) {
        return saved === "true";
      }
    } catch (_) {}
    return false; // Default to Live Hindsight Cloud mode so live memories and retention work out of the box
  });

  useEffect(() => {
    try {
      localStorage.setItem("recallops_mock_mode", String(mockMemoryMode));
    } catch (_) {}
  }, [mockMemoryMode]);

  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [incidentDetails, setIncidentDetails] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);

  const [isLoadingIncidents, setIsLoadingIncidents] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isInvestigating, setIsInvestigating] = useState(false);

  // Modals state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [modalTargetIncident, setModalTargetIncident] = useState(null);

  // Notification Toast state
  const [toast, setToast] = useState(null);
  const [investigationError, setInvestigationError] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  // Fetch full incident details
  const loadIncidentDetails = useCallback(async (incidentId) => {
    if (!incidentId) return;
    setIsLoadingDetails(true);
    try {
      const details = await getIncidentDetails(incidentId);
      setIncidentDetails(details);
    } catch (err) {
      console.error("Failed to fetch incident details:", err);
      showToast("Failed to fetch incident details.", "error");
    } finally {
      setIsLoadingDetails(false);
    }
  }, [showToast]);

  // Fetch all incidents
  const fetchAllIncidents = useCallback(
    async (preferredSelectId = null) => {
      if (!isAuthenticated) {
        setIncidents([]);
        setSelectedIncident(null);
        setIncidentDetails(null);
        setIsLoadingIncidents(false);
        return;
      }

      setIsLoadingIncidents(true);
      try {
        const data = await listIncidents();
        setIncidents(data);

        if (data.length > 0) {
          let toSelect = null;
          if (preferredSelectId) {
            toSelect = data.find((i) => i.id === preferredSelectId);
          }
          if (!toSelect) {
            toSelect =
              data.find((i) => i.machine_id === "M-112") ||
              data.find((i) => i.status !== "REPORTED") ||
              data[0];
          }
          setSelectedIncident(toSelect);
          loadIncidentDetails(toSelect.id);
        } else {
          setSelectedIncident(null);
          setIncidentDetails(null);
        }
      } catch (err) {
        console.error("Failed to fetch incidents:", err);
      } finally {
        setIsLoadingIncidents(false);
      }
    },
    [isAuthenticated, loadIncidentDetails]
  );

  // System health check
  useEffect(() => {
    checkHealth()
      .then((h) => setSystemHealth(h))
      .catch(() => setSystemHealth({ status: "offline" }));
  }, []);

  // Sync incidents and reset active conversation when user changes
  useEffect(() => {
    setActiveConversationId(null);
    fetchAllIncidents();
  }, [user?.uid, isAuthenticated, fetchAllIncidents]);

  const handleSelectIncident = (incidentOrId) => {
    let incident = null;
    let incidentId = null;

    if (typeof incidentOrId === "object" && incidentOrId !== null) {
      incident = incidentOrId;
      incidentId = incidentOrId.id;
    } else if (typeof incidentOrId === "string") {
      incidentId = incidentOrId;
      incident = incidents.find((i) => i.id === incidentOrId) || null;
    }

    if (incident) setSelectedIncident(incident);
    if (incidentId) {
      loadIncidentDetails(incidentId);
      setInvestigationError((prev) => (prev && prev.incidentId !== incidentId ? null : prev));
    }
  };

  const handleInvestigate = async (incidentOrId) => {
    let id = null;
    if (typeof incidentOrId === "object" && incidentOrId !== null) {
      id = incidentOrId.id;
      setSelectedIncident(incidentOrId);
    } else if (typeof incidentOrId === "string") {
      id = incidentOrId;
      const found = incidents.find((i) => i.id === incidentOrId);
      if (found) setSelectedIncident(found);
    } else if (selectedIncident) {
      id = selectedIncident.id;
    }

    if (!id) {
      showToast("Please select an incident to investigate.", "error");
      return;
    }

    setIsInvestigating(true);
    setInvestigationError(null);
    try {
      await investigateIncident(id);
      showToast("AI Diagnostic Investigation complete with episodic recall!", "success");
      await loadIncidentDetails(id);
      await fetchAllIncidents(id);
    } catch (err) {
      console.error("Investigation failed:", err);
      const isQuotaError =
        err?.status === 402 ||
        err?.status === 503 ||
        err?.errorCode === "MEMORY_SERVICE_CREDITS_EXHAUSTED" ||
        err?.message?.includes("credit quota") ||
        err?.message?.includes("402");

      setInvestigationError({
        incidentId: id,
        message: err.message,
        isQuotaError,
      });
      showToast(err.message || "Failed to run AI investigation.", "error");
    } finally {
      setIsInvestigating(false);
    }
  };

  const handleOpenRepair = (incident) => {
    setModalTargetIncident(incident || selectedIncident);
    setIsRepairModalOpen(true);
  };

  const handleOpenVerify = (incident) => {
    setModalTargetIncident(incident || selectedIncident);
    setIsVerifyModalOpen(true);
  };

  const handleReportSubmit = async (formData) => {
    try {
      const created = await createIncident(formData);
      showToast(`Incident ${created.id} reported successfully!`, "success");
      setIsReportModalOpen(false);
      await fetchAllIncidents(created.id);
      setActiveTab("ai-investigations");
    } catch (err) {
      console.error("Failed to report incident:", err);
      showToast(err.message || "Failed to submit incident report.", "error");
    }
  };

  const handleRepairSubmit = async (repairData) => {
    if (!modalTargetIncident) return;
    try {
      await logRepair(modalTargetIncident.id, repairData);
      showToast("Physical field repair logged successfully!", "success");
      setIsRepairModalOpen(false);
      await loadIncidentDetails(modalTargetIncident.id);
      await fetchAllIncidents(modalTargetIncident.id);
    } catch (err) {
      console.error("Failed to log repair:", err);
      showToast(err.message || "Failed to record repair log.", "error");
    }
  };

  const handleVerifySubmit = async (verifyData) => {
    if (!modalTargetIncident) return;
    try {
      const res = await verifyOutcome(modalTargetIncident.id, verifyData);
      if (res.hindsight_retained) {
        showToast("Outcome verified and retained in Hindsight Cloud!", "success");
      } else {
        showToast("Outcome verified and recorded in plant audit log.", "info");
      }
      setIsVerifyModalOpen(false);
      await loadIncidentDetails(modalTargetIncident.id);
      await fetchAllIncidents(modalTargetIncident.id);
    } catch (err) {
      console.error("Failed to verify outcome:", err);
      showToast(err.message || "Failed to verify outcome.", "error");
    }
  };

  const isLegacyMode = LEGACY_TABS.includes(activeTab);

  const handleNewChat = () => {
    setActiveConversationId(null);
    setActiveTab("assistant");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectConversationFromHistory = (convId) => {
    setActiveConversationId(convId);
    setActiveTab("assistant");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-xs font-medium transition-all transform animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            toast.type === "error"
              ? "bg-rose-950/95 text-rose-200 border-rose-800"
              : toast.type === "info"
              ? "bg-blue-950/95 text-blue-200 border-blue-800"
              : "bg-emerald-950/95 text-emerald-200 border-emerald-800"
          }`}
        >
          <span>{toast.message}</span>
        </div>
      )}

      {/* Modern RecallOps 2.0 Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        backendHealth={systemHealth}
        onNewChat={handleNewChat}
        isLegacyMode={isLegacyMode}
        mockMemoryMode={mockMemoryMode}
        onOpenAuthModal={(mode = "signin") => {
          setAuthModalMode(mode);
          setIsAuthModalOpen(true);
        }}
      />

      {/* Guest/Unauthenticated Security Notice Banner */}
      {!isAuthenticated && !authLoading && (
        <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 border-b border-emerald-800/40 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong className="text-white">Multi-User Security:</strong> Sign in with Google or Email for private conversation history, isolated memory bank, and incident logs.
              </span>
            </div>
            <button
              onClick={() => {
                setAuthModalMode("signin");
                setIsAuthModalOpen(true);
              }}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Register</span>
            </button>
          </div>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* ========================================================================= */}
        {/* RecallOps 2.0 PRIMARY SCREENS                                             */}
        {/* ========================================================================= */}

        {activeTab === "assistant" && (
          <ChatAssistantView
            activeConversationId={activeConversationId}
            setActiveConversationId={setActiveConversationId}
            mockMemoryMode={mockMemoryMode}
            showToast={showToast}
          />
        )}

        {activeTab === "memories" && (
          <MemoriesView mockMemoryMode={mockMemoryMode} showToast={showToast} />
        )}

        {activeTab === "history" && (
          <ConversationsHistoryView
            onSelectConversation={handleSelectConversationFromHistory}
            onNewChat={handleNewChat}
            showToast={showToast}
          />
        )}

        {activeTab === "settings" && (
          <SettingsView
            mockMemoryMode={mockMemoryMode}
            setMockMemoryMode={setMockMemoryMode}
            onOpenLegacyFleetView={() => setActiveTab("overview")}
            showToast={showToast}
          />
        )}

        {/* ========================================================================= */}
        {/* SECONDARY PRESERVED SCREENS (Legacy Plant Operations Console)             */}
        {/* ========================================================================= */}

        {activeTab === "overview" && (
          <HomeView
            incidents={incidents}
            onStartInvestigation={(inc) => {
              handleSelectIncident(inc);
              setActiveTab("ai-investigations");
            }}
            onOpenReportModal={() => setIsReportModalOpen(true)}
            onNavigateTab={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onSelectIncident={(inc) => {
              handleSelectIncident(inc);
              setActiveTab("ai-investigations");
            }}
          />
        )}

        {activeTab === "ai-investigations" && (
          <InvestigationResultsView
            selectedIncident={selectedIncident}
            incidentDetails={incidentDetails}
            isLoadingDetails={isLoadingDetails}
            isInvestigating={isInvestigating}
            onInvestigateClick={handleInvestigate}
            onOpenRepairModal={handleOpenRepair}
            onOpenVerifyModal={handleOpenVerify}
            allIncidents={incidents}
            onSelectIncident={handleSelectIncident}
            investigationError={investigationError}
          />
        )}

        {activeTab === "learning-benchmark" && <BenchmarkView />}

        {activeTab === "hindsight-memory" && (
          <HindsightMemoryView incidents={incidents} systemHealth={systemHealth} />
        )}

        {activeTab === "incidents" && (
          <IncidentsView
            incidents={incidents}
            onSelectIncident={(inc) => {
              handleSelectIncident(inc);
              setActiveTab("ai-investigations");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onOpenReportModal={() => setIsReportModalOpen(true)}
            onOpenInvestigation={(inc) => {
              handleSelectIncident(inc);
              setActiveTab("ai-investigations");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onOpenRepairModal={handleOpenRepair}
            onOpenVerifyModal={handleOpenVerify}
          />
        )}

        {activeTab === "machines" && (
          <MachinesView
            incidents={incidents}
            onSelectIncident={(inc) => {
              handleSelectIncident(inc);
              setActiveTab("ai-investigations");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onOpenReportModal={() => setIsReportModalOpen(true)}
            onNavigateTab={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
      </main>

      {/* Persistent Footer */}
      <Footer backendHealth={systemHealth} />

      {/* Lifecycle Action Modals */}
      <ReportIncidentModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmitSuccess={handleReportSubmit}
      />

      <RepairModal
        isOpen={isRepairModalOpen}
        incident={modalTargetIncident}
        onClose={() => setIsRepairModalOpen(false)}
        onSubmitSuccess={handleRepairSubmit}
      />

      <VerifyOutcomeModal
        isOpen={isVerifyModalOpen}
        incident={modalTargetIncident}
        onClose={() => setIsVerifyModalOpen(false)}
        onSubmitSuccess={handleVerifySubmit}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}
