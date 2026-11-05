import React from "react";

export default function EvidenceModal({ isOpen, evidence, onClose }) {
  if (!isOpen || !evidence) return null;

  const isSuccess = evidence.type === "success" || evidence.status === "SUCCESSFUL" || evidence.status?.includes("Success");

  return (
    <div className="fixed inset-0 z-50 bg-surface-container-lowest/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl bg-surface-container-high border border-outline-variant/40 shadow-2xl p-6 relative flex flex-col gap-4">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span
              className={`font-label-sm text-label-sm font-bold uppercase tracking-wider ${
                isSuccess ? "text-primary-container" : "text-error"
              }`}
            >
              HINDSIGHT AUDIT // {isSuccess ? "VERIFIED SUCCESS" : "VERIFIED UNSUCCESSFUL"}
            </span>
            <h4 className="font-title-lg text-title-lg text-on-surface font-bold mt-0.5">
              {evidence.title || "Historical Maintenance Precedent"}
            </h4>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="rounded-lg bg-surface-container-lowest p-4 space-y-3.5 border border-outline-variant/20">
          <div>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium">
              Machine Identifier
            </span>
            <div className="font-body-md text-body-md text-on-surface font-semibold mt-0.5">
              {evidence.asset || evidence.machine_id || "Industrial Asset Unit"}
            </div>
          </div>

          <div>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium">
              Symptom Signature
            </span>
            <p className="font-body-sm text-body-sm text-on-surface mt-0.5 leading-relaxed">
              {evidence.symptoms || "High-frequency vibration and abnormal casing temperature profile."}
            </p>
          </div>

          <div className="h-px bg-surface-variant/40"></div>

          <div>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium">
              Action Taken &amp; Audit Trail
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-relaxed">
              {evidence.details || evidence.repair_action || "Physical remediation logged and verified by field maintenance engineering."}
            </p>
          </div>

          <div className="h-px bg-surface-variant/40"></div>

          <div>
            <span className={`font-label-sm text-label-sm font-semibold uppercase ${isSuccess ? "text-primary" : "text-error"}`}>
              Telemetry Outcome Verification
            </span>
            <p className="font-body-sm text-body-sm text-on-surface font-medium mt-0.5 leading-relaxed">
              {evidence.outcome || (isSuccess ? "Parameters normalized within OEM specifications." : "Defect recurred on first production cycle; unnecessary part expense incurred.")}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="font-label-sm text-label-sm text-outline font-mono">
            Bank: recallops-demo
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-surface-container text-on-surface hover:bg-surface-bright font-title-sm text-title-sm font-semibold transition-colors cursor-pointer"
          >
            Close Evidence
          </button>
        </div>
      </div>
    </div>
  );
}
