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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-emerald-500/30 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Verify Maintenance Outcome
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
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Hindsight Retain Notice */}
          <div className="p-2.5 rounded bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-800 flex items-start gap-2">
            <span className="material-symbols-outlined text-[15px] text-emerald-600 shrink-0 mt-0.5">
              psychology
            </span>
            <span>
              Verifying will retain this outcome into <strong>Hindsight Cloud Episodic Memory</strong> (<code className="font-mono bg-white/70 px-1 py-0.5 rounded border border-emerald-200">OUTCOME-{incident.id}</code>). Future AI investigations across all plant machinery will use this precedent.
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Outcome Verification Result <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, outcome_status: "SUCCESSFUL" })}
                className={`py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                  formData.outcome_status === "SUCCESSFUL"
                    ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                SUCCESSFUL (Resolved)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, outcome_status: "UNSUCCESSFUL" })}
                className={`py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                  formData.outcome_status === "UNSUCCESSFUL"
                    ? "bg-rose-600 text-white border-rose-700 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                UNSUCCESSFUL (Failed)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Inspecting Technician / Engineer ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.verified_by}
              onChange={(e) => setFormData({ ...formData, verified_by: e.target.value })}
              placeholder="e.g. TECH-941"
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Post-Repair Vibration (mm/s)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.vibration_level}
                onChange={(e) => setFormData({ ...formData, vibration_level: e.target.value })}
                placeholder="1.2"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Operating Temp (°C)
              </label>
              <input
                type="number"
                step="1"
                value={formData.temperature_c}
                onChange={(e) => setFormData({ ...formData, temperature_c: e.target.value })}
                placeholder="48"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Inspection Findings & Verification Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={formData.inspection_notes}
              onChange={(e) => setFormData({ ...formData, inspection_notes: e.target.value })}
              placeholder="Record exact test procedure results and equipment response..."
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 font-medium focus:bg-white focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {/* Audit Confirmation Checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/80 border border-amber-200/90 cursor-pointer select-none transition-colors hover:bg-amber-50">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 rounded border-amber-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <div className="text-[11px] leading-relaxed text-amber-900">
              <span className="font-bold block text-amber-950 mb-0.5">
                Episodic Retention Acknowledgment (Irreversible)
              </span>
              I acknowledge that verifying this outcome will permanently commit ground truth and retain an episodic memory record (<code className="font-mono bg-white px-1 py-0.2 rounded border border-amber-200 font-bold">OUTCOME-{incident.id}</code>) to Hindsight Cloud. Once retained, this verification status is locked.
            </div>
          </label>

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
              disabled={loading || !acknowledged}
              title={!acknowledged ? "Please check the acknowledgment box above to confirm retention" : undefined}
              className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                  <span>Retaining in Hindsight...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[14px]">psychology</span>
                  <span>Verify & Retain Memory</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
