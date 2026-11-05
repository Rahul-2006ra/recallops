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
    setLoading(true);
    setError(null);

    try {
      await onSubmitSuccess(incident.id, formData);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to log repair action");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-amber-500/30 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <span className="material-symbols-outlined text-[18px]">build</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Log Physical Repair Action
              </h2>
              <p className="text-[11px] text-slate-400">
                Machine: <span className="text-white font-mono">{incident.machine_id}</span> ({incident.id})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {error && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-xs text-slate-700">
            <span className="font-bold text-slate-900">Incident Symptoms: </span>
            {incident.symptoms}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Technician ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.technician_id}
              onChange={(e) => setFormData({ ...formData, technician_id: e.target.value })}
              placeholder="e.g. TECH-941"
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Action Taken <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              value={formData.action_taken}
              onChange={(e) => setFormData({ ...formData, action_taken: e.target.value })}
              placeholder="Describe exact physical repair or maintenance performed..."
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Parts Replaced (Optional)
            </label>
            <input
              type="text"
              value={formData.parts_replaced}
              onChange={(e) => setFormData({ ...formData, parts_replaced: e.target.value })}
              placeholder="e.g. Dynamic Seal Cartridge, Oil Filter"
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Technician Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Torque specifications, sensor baseline readings, etc."
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-500 outline-none resize-none"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3 py-1.5 rounded border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                  <span>Saving Repair...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[14px]">save</span>
                  <span>Log Repair</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
