import React, { useState } from "react";

export default function VerifyOutcomeModal({ isOpen, incident, onClose, onSubmitSuccess }) {
  const [formData, setFormData] = useState({
    verified_by: "TECH-941",
    outcome_status: "SUCCESSFUL",
    inspection_notes: "Operational vibration normalized to 1.2 mm/s after 2 hours of maximum load. Temperature stabilized at 48°C.",
    vibration_level: "1.2",
    temperature_c: "48",
  });
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !incident) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      verified_by: formData.verified_by,
      outcome_status: formData.outcome_status,
      inspection_notes: formData.inspection_notes,
      follow_up_metrics: {
        vibration_amplitude_mms: parseFloat(formData.vibration_level) || undefined,
        operating_temp_c: parseFloat(formData.temperature_c) || undefined,
      },
    };

    try {
      await onSubmitSuccess(incident.id, payload);
      onClose();
    } catch (err) {
      if (err?.response?.status === 409) {
        setError(
          `Conflict (409): ${err?.response?.data?.detail || "This incident has already been verified and its episodic memory is locked in Hindsight."}`
        );
      } else {
        setError(err?.response?.data?.detail || err.message || "Failed to verify repair outcome");
      }
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
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface tracking-wide">
                Verify Maintenance Outcome
              </h2>
              <p className="text-[11px] text-on-surface-variant font-mono">
                Machine: <span className="text-primary-container font-mono">{incident.machine_id}</span> ({incident.id})
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
              <span className="material-symbols-outlined text-[16px] text-error shrink-0 mt-0.5">error</span>
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Hindsight Retain Notice */}
          <div className="p-3 rounded-lg bg-primary-container/10 border border-primary-container/30 text-xs text-primary flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[18px] text-primary-container shrink-0 mt-0.5">
              psychology
            </span>
            <div className="leading-relaxed">
              Verifying will retain this outcome into <strong>Hindsight Cloud Episodic Memory</strong> (<code className="font-mono bg-surface-container-lowest px-1 py-0.5 rounded border border-primary-container/30 text-primary-container">OUTCOME-{incident.id}</code>). Future AI investigations across all plant machinery will immediately use this precedent.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Verified By (Technician ID) <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                disabled={loading}
                value={formData.verified_by}
                onChange={(e) => setFormData({ ...formData, verified_by: e.target.value })}
                placeholder="e.g. TECH-941"
                className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-xs text-on-surface font-mono font-medium focus:border-primary-container outline-none disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Outcome Status <span className="text-error">*</span>
              </label>
              <select
                value={formData.outcome_status}
                disabled={loading}
                onChange={(e) => setFormData({ ...formData, outcome_status: e.target.value })}
                className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-xs text-on-surface font-medium focus:border-primary-container outline-none disabled:opacity-60 font-mono"
              >
                <option value="SUCCESSFUL">SUCCESSFUL (Resolved Anomaly)</option>
                <option value="FAILED">FAILED (Symptom Persists / Anti-Pattern)</option>
              </select>
            </div>
          </div>

          {/* Telemetry Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Post-Repair Vibration (mm/s)
              </label>
              <input
                type="number"
                step="0.1"
                disabled={loading}
                value={formData.vibration_level}
                onChange={(e) => setFormData({ ...formData, vibration_level: e.target.value })}
                placeholder="e.g. 1.2"
                className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-xs text-on-surface font-mono font-medium focus:border-primary-container outline-none disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Post-Repair Temp (°C)
              </label>
              <input
                type="number"
                step="0.5"
                disabled={loading}
                value={formData.temperature_c}
                onChange={(e) => setFormData({ ...formData, temperature_c: e.target.value })}
                placeholder="e.g. 48"
                className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-xs text-on-surface font-mono font-medium focus:border-primary-container outline-none disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Field Inspection &amp; Telemetry Notes <span className="text-error">*</span>
            </label>
            <textarea
              required
              disabled={loading}
              rows={3}
              value={formData.inspection_notes}
              onChange={(e) => setFormData({ ...formData, inspection_notes: e.target.value })}
              placeholder="State baseline normalization observations, continuous duty duration, acoustic check..."
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-xs text-on-surface leading-relaxed focus:border-primary-container outline-none disabled:opacity-60"
            />
          </div>

          {/* Acknowledgement Checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/20 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={loading}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 rounded border-outline-variant text-primary-container focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-[11px] text-on-surface-variant leading-snug">
              I certify that this post-repair telemetry has been verified against calibrated plant instrumentation. This will permanently index the outcome into the Hindsight Cloud memory bank.
            </span>
          </label>

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
              disabled={loading || !acknowledged}
              type="submit"
              className="px-5 py-2 rounded-lg bg-primary-container text-on-primary-container text-xs font-bold transition-all shadow-[0_0_16px_rgba(13,242,200,0.3)] hover:shadow-[0_0_22px_rgba(13,242,200,0.5)] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {loading && <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>}
              <span>{loading ? "Retaining in Hindsight..." : "Verify & Retain Memory"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
