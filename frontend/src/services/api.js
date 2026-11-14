/**
 * RecallOps API Client
 * Connects the frontend to FastAPI backend endpoints with Firebase token authentication.
 */

// Base URL for production API requests; falls back to live Render backend in production, or relative path for local dev proxy
const defaultBase = import.meta.env?.PROD ? "https://recallops-y3py.onrender.com" : "";
const rawBase = (import.meta.env?.VITE_API_BASE || defaultBase).trim().replace(/\/+$/, "");
const API_BASE = rawBase.endsWith("/api") ? rawBase.slice(0, -4) : rawBase;

let tokenProvider = null;

export function setAuthTokenProvider(provider) {
  tokenProvider = provider;
}

export async function getAuthHeader() {
  if (tokenProvider) {
    try {
      const token = await tokenProvider();
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    } catch (err) {
      console.warn("Failed to retrieve auth token", err);
    }
  }
  return {};
}

async function authFetch(url, options = {}) {
  const authHeaders = await getAuthHeader();
  const headers = {
    ...authHeaders,
    ...(options.headers || {}),
  };
  return fetch(url, {
    ...options,
    headers,
  });
}

function extractIncidentId(target) {
  if (!target) return "";
  if (typeof target === "string") return target.trim();
  if (typeof target === "object" && target.id) return String(target.id).trim();
  return String(target).trim();
}

async function handleResponse(response) {
  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    let parsedJson = null;
    try {
      parsedJson = await response.json();
      errorDetail = parsedJson.detail || errorDetail;
    } catch {
      // fallback to status text
    }

    const message =
      typeof errorDetail === "string"
        ? errorDetail
        : errorDetail?.message || JSON.stringify(errorDetail);

    const errorCode =
      typeof errorDetail === "object"
        ? errorDetail?.error_code
        : typeof parsedJson?.detail === "object"
        ? parsedJson.detail?.error_code
        : undefined;

    const err = new Error(message);
    err.status = response.status;
    err.errorCode = errorCode;
    err.response = { status: response.status, data: parsedJson || { detail: errorDetail } };
    throw err;
  }
  return response.json();
}

// System health & root info (public)
export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return handleResponse(res);
}
export const getHealth = checkHealth;

export async function getRootInfo() {
  const res = await fetch(`${API_BASE}/`);
  return handleResponse(res);
}

// Incidents (authenticated & user-isolated)
export async function listIncidents(params = {}) {
  const query = new URLSearchParams();
  if (params.machine_id) query.append("machine_id", params.machine_id);
  if (params.status) query.append("status", params.status);
  const url = `${API_BASE}/api/incidents${query.toString() ? `?${query.toString()}` : ""}`;
  const res = await authFetch(url);
  return handleResponse(res);
}
export const getIncidents = listIncidents;

export async function getIncidentDetails(incidentOrId) {
  const id = extractIncidentId(incidentOrId);
  const res = await authFetch(`${API_BASE}/api/incidents/${encodeURIComponent(id)}`);
  return handleResponse(res);
}

export async function createIncident(data) {
  const res = await authFetch(`${API_BASE}/api/incidents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

// AI Investigation (authenticated & user-isolated)
export async function investigateIncident(incidentOrId) {
  const id = extractIncidentId(incidentOrId);
  const res = await authFetch(`${API_BASE}/api/incidents/${encodeURIComponent(id)}/investigate`, {
    method: "POST",
  });
  return handleResponse(res);
}

// Technician Repair (authenticated & user-isolated)
export async function logRepair(incidentOrId, data) {
  const id = extractIncidentId(incidentOrId);
  const res = await authFetch(`${API_BASE}/api/incidents/${encodeURIComponent(id)}/repair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}
export const recordRepair = logRepair;

// Outcome Verification (authenticated & user-isolated)
export async function verifyOutcome(incidentOrId, data) {
  const id = extractIncidentId(incidentOrId);
  const res = await authFetch(`${API_BASE}/api/incidents/${encodeURIComponent(id)}/verify-outcome`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

// =============================================================================
// RecallOps 2.0 Conversational AI & Episodic Memory Endpoints
// =============================================================================

export async function sendChatMessage(data) {
  const res = await authFetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function listConversations() {
  const res = await authFetch(`${API_BASE}/api/conversations`);
  return handleResponse(res);
}

export async function getConversation(conversationId) {
  const res = await authFetch(`${API_BASE}/api/conversations/${encodeURIComponent(conversationId)}`);
  return handleResponse(res);
}

export async function deleteConversation(conversationId) {
  const res = await authFetch(`${API_BASE}/api/conversations/${encodeURIComponent(conversationId)}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

export async function recordOutcome(data) {
  const res = await authFetch(`${API_BASE}/api/chat/record-outcome`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function listMemories(params = {}) {
  const query = new URLSearchParams();
  const searchQ = params.q || params.query;
  if (searchQ) query.append("q", searchQ);
  if (params.equipment_type) query.append("equipment_type", params.equipment_type);
  if (params.outcome_status) query.append("outcome_status", params.outcome_status);
  if (params.limit) query.append("limit", params.limit);
  if (params.mock_memory !== undefined && params.mock_memory !== null) {
    query.append("mock_memory", String(params.mock_memory));
  }
  const url = `${API_BASE}/api/memories${query.toString() ? `?${query.toString()}` : ""}`;
  const res = await authFetch(url);
  return handleResponse(res);
}
export const searchMemories = listMemories;

export async function getMemoryDetails(memoryId) {
  const res = await authFetch(`${API_BASE}/api/memories/${encodeURIComponent(memoryId)}`);
  return handleResponse(res);
}

export async function getChatStatus() {
  const res = await fetch(`${API_BASE}/api/chat/status`);
  return handleResponse(res);
}

// Speech-to-Text Transcription (Multilingual Groq Whisper)
export async function transcribeAudio(audioBlob, language = null) {
  const formData = new FormData();
  const filename = audioBlob.type && audioBlob.type.includes("wav")
    ? "recording.wav"
    : audioBlob.type && (audioBlob.type.includes("mp4") || audioBlob.type.includes("m4a"))
    ? "recording.m4a"
    : "recording.webm";
  formData.append("file", audioBlob, filename);

  const query = language ? `?language=${encodeURIComponent(language)}` : "";
  const res = await authFetch(`${API_BASE}/api/transcribe${query}`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(res);
}

export async function getAuthMe() {
  const res = await authFetch(`${API_BASE}/api/auth/me`);
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
  sendChatMessage,
  listConversations,
  getConversation,
  deleteConversation,
  recordOutcome,
  listMemories,
  getMemoryDetails,
  getChatStatus,
  transcribeAudio,
  getAuthMe,
  setAuthTokenProvider,
};

export default api;
