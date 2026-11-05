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
      // Retain form data on error so technician does not lose typed data
      setError(err?.response?.data?.detail || err.message || "Failed to submit incident to RecallOps engine.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Report Incident &amp; Telemetry Anomaly</h2>
              <p className="text-[11px] text-slate-400">Register active machinery anomaly into the RecallOps audit registry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            type="button"
            className="text-slate-400 hover:text-white p-1 rounded transition-colors disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5">
          {error && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-rose-600 mt-0.5 shrink-0">error</span>
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Machine ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={loading}
                value={formData.machine_id}
                onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
                placeholder="e.g. M-104, M-112"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-500 outline-none disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Severity Level
              </label>
              <select
                value={formData.severity}
                disabled={loading}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-500 outline-none disabled:opacity-60"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Equipment Type <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={loading}
              value={formData.equipment_type}
              onChange={(e) => setFormData({ ...formData, equipment_type: e.target.value })}
              placeholder="e.g. Centrifugal Slurry Pump, Induction Motor"
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-500 outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Symptoms Reported <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={loading}
              value={formData.symptoms}
              onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
              placeholder="Describe abnormal vibration, temperature, acoustic signature..."
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-500 outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Field Observations &amp; Telemetry
            </label>
            <textarea
              rows={3}
              disabled={loading}
              value={formData.reported_observations}
              onChange={(e) => setFormData({ ...formData, reported_observations: e.target.value })}
              placeholder="Detailed technician remarks, sensory findings, or sensor readings..."
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-500 outline-none resize-none disabled:opacity-60"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3 py-1.5 rounded border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                  <span>Registering Incident...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[14px]">save</span>
                  <span>Log Incident</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
