import React, { useState, useEffect, useCallback } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

// Six Stitch Views
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

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [incidentDetails, setIncidentDetails] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);

  const [isLoadingIncidents, setIsLoadingIncidents] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isInvestigating, setIsInvestigating] = useState(false);

  // Modals state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [modalTargetIncident, setModalTargetIncident] = useState(null);

  // Notification Toast state
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

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
  }, []);

  // Fetch all incidents
  const fetchAllIncidents = useCallback(
    async (preferredSelectId = null) => {
      try {
        const data = await listIncidents();
        setIncidents(data);

        if (data.length > 0) {
          let toSelect = null;
          if (preferredSelectId) {
            toSelect = data.find((i) => i.id === preferredSelectId);
          }
          if (!toSelect) {
            // Default to M-112 or first investigated incident for dramatic demo centerpiece
            toSelect =
              data.find((i) => i.machine_id === "M-112") ||
              data.find((i) => i.status !== "REPORTED") ||
              data[0];
          }
          setSelectedIncident(toSelect);
          loadIncidentDetails(toSelect.id);
        }
      } catch (err) {
        console.error("Failed to fetch incidents:", err);
        showToast("Could not connect to RecallOps backend.", "error");
      } finally {
        setIsLoadingIncidents(false);
      }
    },
    [loadIncidentDetails]
  );

  // Initial load
  useEffect(() => {
    checkHealth()
      .then((h) => setSystemHealth(h))
      .catch(() => setSystemHealth({ status: "offline" }));

    fetchAllIncidents();
  }, [fetchAllIncidents]);

  // When user selects an incident
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

    if (incident) {
      setSelectedIncident(incident);
    }
    if (incidentId) {
      loadIncidentDetails(incidentId);
    }
  };

  // Run AI investigation
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
      showToast("No incident ID provided for investigation.", "error");
      return;
    }

    setIsInvestigating(true);
    try {
      await investigateIncident(id);
      showToast("Diagnostic investigation completed via Groq & Hindsight Cloud!", "success");
      await fetchAllIncidents(id);
      await loadIncidentDetails(id);
    } catch (err) {
      console.error("Investigation error:", err);
      showToast(err?.response?.data?.detail || "Investigation failed. Check backend logs.", "error");
    } finally {
      setIsInvestigating(false);
    }
  };

  // Start Investigation from Homepage prompt input
  const handleStartInvestigationFromHome = async (formData) => {
    try {
      const created = await createIncident(formData);
      showToast(`Incident ${created.id} registered. Running autonomous AI investigation...`, "success");
      await fetchAllIncidents(created.id);
      setSelectedIncident(created);
      setActiveTab("ai-investigations");
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Trigger actual AI investigation immediately
      await handleInvestigate(created.id);
    } catch (err) {
      console.error("Start investigation error:", err);
      showToast("Failed to initiate investigation.", "error");
    }
  };

  // Open modals
  const handleOpenRepair = (incident) => {
    setModalTargetIncident(incident || selectedIncident);
    setIsRepairModalOpen(true);
  };

  const handleOpenVerify = (incident) => {
    setModalTargetIncident(incident || selectedIncident);
    setIsVerifyModalOpen(true);
  };

  // Modal submissions
  const handleReportSubmit = async (formData) => {
    const created = await createIncident(formData);
    showToast(`Incident ${created.id} registered successfully!`, "success");
    await fetchAllIncidents(created.id);
    setSelectedIncident(created);
    setActiveTab("ai-investigations");
  };

  const handleRepairSubmit = async (incidentId, payload) => {
    await logRepair(incidentId, payload);
    showToast("Physical repair action logged into audit history.", "success");
    await fetchAllIncidents(incidentId);
    await loadIncidentDetails(incidentId);
  };

  const handleVerifySubmit = async (incidentId, payload) => {
    await verifyOutcome(incidentId, payload);
    showToast("Outcome verified & episodic memory retained in Hindsight Cloud!", "success");
    await fetchAllIncidents(incidentId);
    await loadIncidentDetails(incidentId);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col font-body antialiased">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-2xl border flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-3 duration-200 ${
            toast.type === "success"
              ? "bg-surface-container-high text-on-surface border-primary-container/40 shadow-[0_0_16px_rgba(13,242,200,0.25)]"
              : "bg-surface-container-high text-error border-error/40 shadow-[0_0_16px_rgba(244,63,94,0.25)]"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[18px] ${
              toast.type === "success" ? "text-primary-container" : "text-error"
            }`}
          >
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Persistent Top Navbar (Tactile Industrial Memory) */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        backendHealth={systemHealth}
        onOpenReportModal={() => setIsReportModalOpen(true)}
      />

      {/* Main Content Workspace */}
      <main className="w-full pt-16 flex-1 min-h-[calc(100vh-64px)] flex flex-col">
        {isLoadingIncidents && incidents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-16 gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-[36px] animate-spin text-primary-container">
              sync
            </span>
            <span className="text-xs font-mono font-semibold tracking-wider">
              CONNECTING TO RECALLOPS DIAGNOSTIC ENGINE...
            </span>
          </div>
        ) : (
          <>
            {/* Screen 1: Homepage */}
            {activeTab === "overview" && (
              <HomeView
                incidents={incidents}
                onStartInvestigation={handleStartInvestigationFromHome}
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

            {/* Screen 2: Investigation Results */}
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
              />
            )}

            {/* Screen 3: Learning Benchmark */}
            {activeTab === "learning-benchmark" && (
              <BenchmarkView />
            )}

            {/* Screen 4: Hindsight Memory */}
            {activeTab === "hindsight-memory" && (
              <HindsightMemoryView
                incidents={incidents}
                systemHealth={systemHealth}
              />
            )}

            {/* Screen 5: Incidents */}
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

            {/* Screen 6: Machines */}
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
          </>
        )}
      </main>

      {/* Persistent Industrial Footer */}
      <Footer backendHealth={systemHealth} />

      {/* Interactive Lifecycle Action Modals */}
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
    </div>
  );
}
