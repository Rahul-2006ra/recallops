import React, { useState } from "react";

export default function ReportIncidentModal({ isOpen, onClose, onSubmitSuccess }) {
  const [formData, setFormData] = useState({
    machine_id: "M-112",
    equipment_type: "Centrifugal Slurry Pump",
    symptoms: "Abnormal high-frequency vibration and casing temperature spike",
    reported_observations: "Vibration amplitude exceeded 7.2 mm/s during maximum duty cycle.",
    severity: "HIGH",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.machine_id.trim()) {
      setError("Machine ID is required.");
      return;
    }
    if (!formData.equipment_type.trim()) {
      setError("Equipment Type is required.");
      return;
    }
    if (!formData.symptoms.trim()) {
      setError("Symptoms description is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmitSuccess(formData);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to submit incident to RecallOps engine.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-container-lowest/80 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-surface-container rounded-xl border border-outline-variant/40 shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-surface-container-high border-b border-outline-variant/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary-container border border-primary-container/30 shadow-[0_0_12px_rgba(13,242,200,0.2)]">
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface tracking-wide">
                Report Incident &amp; Telemetry Anomaly
              </h2>
              <p className="text-[11px] text-on-surface-variant font-mono">
                Register active machinery anomaly into the RecallOps audit registry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            type="button"
            className="text-on-surface-variant hover:text-on-surface p-1 rounded transition-colors disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-error-container/30 border border-error/30 text-xs text-error flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-error mt-0.5 shrink-0">error</span>
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Machine ID <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                disabled={loading}
                value={formData.machine_id}
                onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
                placeholder="e.g. M-104, M-112"
                className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-xs text-on-surface font-mono font-medium focus:border-primary-container outline-none disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Severity Level
              </label>
              <select
                value={formData.severity}
                disabled={loading}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-xs text-on-surface font-medium focus:border-primary-container outline-none disabled:opacity-60"
              >
                <option value="LOW">LOW — Minor Warning</option>
                <option value="MEDIUM">MEDIUM — Operational Deviation</option>
                <option value="HIGH">HIGH — Telemetry Spike / Immediate Triage</option>
                <option value="CRITICAL">CRITICAL — Plant Interlock Tripped</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Equipment Type <span className="text-error">*</span>
            </label>
            <input
              type="text"
              required
              disabled={loading}
              value={formData.equipment_type}
              onChange={(e) => setFormData({ ...formData, equipment_type: e.target.value })}
              placeholder="e.g. Centrifugal Slurry Pump, Induction Motor"
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-xs text-on-surface font-medium focus:border-primary-container outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Reported Symptoms &amp; Sensor Telemetry <span className="text-error">*</span>
            </label>
            <textarea
              required
              disabled={loading}
              rows={2}
              value={formData.symptoms}
              onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
              placeholder="Describe telemetry anomaly: vibration levels, temperature spikes, or acoustic noise..."
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-xs text-on-surface leading-relaxed focus:border-primary-container outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Initial Field Observations
            </label>
            <textarea
              disabled={loading}
              rows={2}
              value={formData.reported_observations}
              onChange={(e) => setFormData({ ...formData, reported_observations: e.target.value })}
              placeholder="Visual checks, operating load, speed, cooling condition..."
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-xs text-on-surface leading-relaxed focus:border-primary-container outline-none disabled:opacity-60"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-outline-variant/20">
            <button
              onClick={onClose}
              disabled={loading}
              type="button"
              className="px-4 py-2 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer border border-outline-variant/20"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              type="submit"
              className="px-5 py-2 rounded-lg bg-primary-container text-on-primary-container text-xs font-bold transition-all shadow-[0_0_16px_rgba(13,242,200,0.3)] hover:shadow-[0_0_22px_rgba(13,242,200,0.5)] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {loading && <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>}
              <span>{loading ? "Registering..." : "Submit Incident"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
