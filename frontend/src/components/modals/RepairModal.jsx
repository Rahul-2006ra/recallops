import React, { useState } from "react";

export default function RepairModal({ isOpen, incident, onClose, onSubmitSuccess }) {
  const [formData, setFormData] = useState({
    technician_id: "TECH-941",
    action_taken: "Replaced mechanical seal and balanced pump impeller",
    parts_replaced: "Seal Cartridge SKF-8821, Flange Gasket",
    notes: "Torqued casing bolts to 85 Nm as per manufacturer specification.",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !incident) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.technician_id.trim()) {
      setError("Technician ID is required for audit traceability.");
      return;
    }
    if (!formData.action_taken.trim()) {
      setError("Action Taken description is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmitSuccess(incident.id, formData);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to log physical repair action");
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
            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-amber-400 border border-amber-500/30 shadow-[0_0_12px_rgba(251,191,36,0.2)]">
              <span className="material-symbols-outlined text-[18px]">build</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface tracking-wide">
                Log Physical Repair Action
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
              <span className="material-symbols-outlined text-[16px] text-error mt-0.5 shrink-0">error</span>
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* Context box */}
          <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-xs text-on-surface-variant flex flex-col gap-1">
            <div>
              <span className="font-bold text-on-surface">Equipment / Symptoms: </span>
              {incident.equipment_type} — {incident.symptoms}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Executing Technician ID <span className="text-error">*</span>
            </label>
            <input
              type="text"
              required
              disabled={loading}
              value={formData.technician_id}
              onChange={(e) => setFormData({ ...formData, technician_id: e.target.value })}
              placeholder="e.g. TECH-941"
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-xs text-on-surface font-mono font-medium focus:border-primary-container outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Physical Repair Action Taken <span className="text-error">*</span>
            </label>
            <textarea
              required
              disabled={loading}
              rows={3}
              value={formData.action_taken}
              onChange={(e) => setFormData({ ...formData, action_taken: e.target.value })}
              placeholder="Detailed description of physical actions: alignment, torque specifications, component replacements..."
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-xs text-on-surface leading-relaxed focus:border-primary-container outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Parts / Components Replaced
            </label>
            <input
              type="text"
              disabled={loading}
              value={formData.parts_replaced}
              onChange={(e) => setFormData({ ...formData, parts_replaced: e.target.value })}
              placeholder="e.g. Viton O-ring B-2, SKF-6205 bearing, Coupling insert"
              className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-xs text-on-surface font-medium focus:border-primary-container outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Technician Notes / Post-Service Observations
            </label>
            <textarea
              disabled={loading}
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any procedural deviations, manufacturer specs, or follow-up recommendations..."
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
              <span>{loading ? "Logging Repair..." : "Save Repair Record"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
