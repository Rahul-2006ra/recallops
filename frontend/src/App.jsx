import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import HeroBanner from "./components/HeroBanner";
import StatsGrid from "./components/StatsGrid";
import HindsightMemoryCenterpiece from "./components/HindsightMemoryCenterpiece";
import IncidentsTable from "./components/IncidentsTable";
import VerificationProtocolCard from "./components/VerificationProtocolCard";

import IncidentsView from "./components/views/IncidentsView";
import InvestigationsView from "./components/views/InvestigationsView";
import HindsightMemoryView from "./components/views/HindsightMemoryView";
import MachinesView from "./components/views/MachinesView";

import ReportIncidentModal from "./components/modals/ReportIncidentModal";
import RepairModal from "./components/modals/RepairModal";
import VerifyOutcomeModal from "./components/modals/VerifyOutcomeModal";

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
  const fetchAllIncidents = useCallback(async (preferredSelectId = null) => {
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
  }, [loadIncidentDetails]);

  // Initial load
  useEffect(() => {
    checkHealth()
      .then((h) => setSystemHealth(h))
      .catch(() => setSystemHealth({ status: "offline" }));

    fetchAllIncidents();
  }, [fetchAllIncidents]);

  // When user selects an incident row or card
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

  // When user clicks Open Investigation in table
  const handleOpenInvestigation = (incidentOrId) => {
    handleSelectIncident(incidentOrId);
    // Smoothly scroll to the Centerpiece so the technician immediately sees the diagnostic panel
    window.scrollTo({ top: 120, behavior: "smooth" });
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
  };

  const handleRepairSubmit = async (incidentId, payload) => {
    await logRepair(incidentId, payload);
    showToast("Physical repair action logged into audit history.", "success");
    await fetchAllIncidents(incidentId);
  };

  const handleVerifySubmit = async (incidentId, payload) => {
    await verifyOutcome(incidentId, payload);
    showToast("Outcome verified & episodic memory retained in Hindsight Cloud!", "success");
    await fetchAllIncidents(incidentId);
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case "overview":
        return "Live Diagnostic Overview";
      case "incidents":
        return "Active Incidents & Audit Registry";
      case "ai-investigations":
        return "AI Investigations & Causal Graph";
      case "hindsight-memory":
        return "Hindsight Cloud Memory Bank";
      case "machines":
        return "Machinery Fleet Directory";
      default:
        return "Overview";
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex font-sans antialiased">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-xl border flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-3 duration-200 ${
            toast.type === "success"
              ? "bg-slate-900 text-white border-emerald-500/50"
              : "bg-rose-900 text-white border-rose-500/50"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[18px] ${
              toast.type === "success" ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Persistent Navy Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        backendHealth={systemHealth}
      />

      {/* Main Content Pane */}
      <div className="ml-60 flex-1 flex flex-col min-w-0">
        {/* Top Sticky Header */}
        <Header activeTabLabel={getTabTitle()} />

        {/* Dynamic Workspace Container */}
        <main className="p-4 sm:p-5 flex flex-col gap-3.5 max-w-[1600px] w-full mx-auto">
          {isLoadingIncidents && incidents.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <span className="material-symbols-outlined text-[36px] animate-spin text-blue-600">
                sync
              </span>
              <span className="text-xs font-semibold">
                Connecting to RecallOps Intelligence Engine...
              </span>
            </div>
          ) : (
            <>
              {activeTab === "overview" && (
                <>
                  {/* Hero Banner */}
                  <HeroBanner
                    onReportClick={() => setIsReportModalOpen(true)}
                    onActiveInvestigationsClick={() => setActiveTab("ai-investigations")}
                  />

                  {/* Operational Metrics Grid */}
                  <StatsGrid incidents={incidents} />

                  {/* 3-Column Hindsight Episodic Centerpiece */}
                  <HindsightMemoryCenterpiece
                    selectedIncident={selectedIncident}
                    incidentDetails={incidentDetails}
                    isLoadingDetails={isLoadingDetails}
                    isInvestigating={isInvestigating}
                    onInvestigateClick={() => handleInvestigate(selectedIncident?.id)}
                    onRepairClick={() => handleOpenRepair(selectedIncident)}
                    onVerifyClick={() => handleOpenVerify(selectedIncident)}
                  />

                  {/* Active Incidents Table (8 cols) + Verification Protocol (4 cols) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    <div className="lg:col-span-8">
                      <IncidentsTable
                        incidents={incidents}
                        selectedIncidentId={selectedIncident?.id}
                        onSelectIncident={handleSelectIncident}
                        onOpenInvestigation={handleOpenInvestigation}
                      />
                    </div>
                    <div className="lg:col-span-4">
                      <VerificationProtocolCard systemHealth={systemHealth} />
                    </div>
                  </div>
                </>
              )}

              {activeTab === "incidents" && (
                <IncidentsView
                  incidents={incidents}
                  onSelectIncident={(inc) => {
                    handleSelectIncident(inc);
                    setActiveTab("overview");
                  }}
                  onOpenReportModal={() => setIsReportModalOpen(true)}
                  onOpenInvestigation={handleInvestigate}
                  onOpenRepairModal={handleOpenRepair}
                  onOpenVerifyModal={handleOpenVerify}
                />
              )}

              {activeTab === "ai-investigations" && (
                <InvestigationsView
                  incidents={incidents}
                  onSelectIncident={handleSelectIncident}
                  onOpenRepairModal={handleOpenRepair}
                  onOpenInvestigation={handleInvestigate}
                />
              )}

              {activeTab === "hindsight-memory" && (
                <HindsightMemoryView
                  incidents={incidents}
                  systemHealth={systemHealth}
                />
              )}

              {activeTab === "machines" && (
                <MachinesView
                  incidents={incidents}
                  onSelectIncident={(inc) => {
                    handleSelectIncident(inc);
                    setActiveTab("overview");
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

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
