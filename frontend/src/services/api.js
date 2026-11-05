/**
 * RecallOps API Client
 * Connects the frontend to FastAPI backend endpoints.
 */

const API_BASE = "";

function extractIncidentId(target) {
  if (!target) return "";
  if (typeof target === "string") return target.trim();
  if (typeof target === "object" && target.id) return String(target.id).trim();
  return String(target).trim();
}

async function handleResponse(response) {
  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      // fallback to status text
    }
    const err = new Error(errorDetail);
    err.status = response.status;
    err.response = { status: response.status, data: { detail: errorDetail } };
    throw err;
  }
  return response.json();
}

// System health & root info
export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return handleResponse(res);
}
export const getHealth = checkHealth;

export async function getRootInfo() {
  const res = await fetch(`${API_BASE}/`);
  return handleResponse(res);
}

// Incidents
export async function listIncidents(params = {}) {
  const query = new URLSearchParams();
  if (params.machine_id) query.append("machine_id", params.machine_id);
  if (params.status) query.append("status", params.status);
  const url = `${API_BASE}/api/incidents${query.toString() ? `?${query.toString()}` : ""}`;
  const res = await fetch(url);
  return handleResponse(res);
}
export const getIncidents = listIncidents;

export async function getIncidentDetails(incidentOrId) {
  const id = extractIncidentId(incidentOrId);
  const res = await fetch(`${API_BASE}/api/incidents/${encodeURIComponent(id)}`);
  return handleResponse(res);
}

export async function createIncident(data) {
  const res = await fetch(`${API_BASE}/api/incidents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

// AI Investigation
export async function investigateIncident(incidentOrId) {
  const id = extractIncidentId(incidentOrId);
  const res = await fetch(`${API_BASE}/api/incidents/${encodeURIComponent(id)}/investigate`, {
    method: "POST",
  });
  return handleResponse(res);
}

// Technician Repair
export async function logRepair(incidentOrId, data) {
  const id = extractIncidentId(incidentOrId);
  const res = await fetch(`${API_BASE}/api/incidents/${encodeURIComponent(id)}/repair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}
export const recordRepair = logRepair;

// Outcome Verification
export async function verifyOutcome(incidentOrId, data) {
  const id = extractIncidentId(incidentOrId);
  const res = await fetch(`${API_BASE}/api/incidents/${encodeURIComponent(id)}/verify-outcome`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export const api = {
  checkHealth,
  getHealth,
  getRootInfo,
  listIncidents,
  getIncidents,
  getIncidentDetails,
  createIncident,
  investigateIncident,
  logRepair,
  recordRepair,
  verifyOutcome,
};

export default api;
