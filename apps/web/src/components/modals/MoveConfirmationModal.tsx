import { AlertTriangle, X, MapPin, ArrowRight, Check } from "lucide-react";

export type PendingMove = {
  studentId: string;
  studentName: string;
  fromClassLabel: string;
  toClassId: string;
  toClassLabel: string;
  currentCount: number;
  maxSize: number;
};

export function MoveConfirmationModal({
  pendingMove,
  onCancel,
  onConfirm,
}: {
  pendingMove: PendingMove;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <span className="eyebrow" style={{ color: "var(--primary-brand)", display: "inline-flex", alignItems: "center", gap: "6px" }}><AlertTriangle size={13} aria-hidden="true" /> CONFIRMATION DE TRANSFERT</span>
          <button
            className="icon-btn-subtle"
            onClick={onCancel}
            style={{ padding: "4px 6px", fontSize: "0.9rem", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem", fontWeight: 800 }}>
          Transférer l'élève {pendingMove.studentName} ?
        </h3>

        <div style={{ background: "var(--bg-subtle)", padding: "14px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", marginBottom: "18px", fontSize: "0.88rem" }}>
          <p style={{ margin: "0 0 8px 0", fontWeight: 700 }}>
            <MapPin size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Provenance : <strong style={{ color: "var(--text-main)" }}>{pendingMove.fromClassLabel}</strong>
          </p>
          <p style={{ margin: 0, fontWeight: 700 }}>
            <ArrowRight size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Destination : <strong style={{ color: "var(--primary-brand)" }}>{pendingMove.toClassLabel}</strong>{" "}
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginLeft: "4px" }}>
              (Effectif cible : {pendingMove.currentCount + 1}/{pendingMove.maxSize} él.)
            </span>
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            className="secondary"
            onClick={onCancel}
            style={{ padding: "8px 16px", fontWeight: 700 }}
          >
            Annuler
          </button>
          <button
            className="primary"
            onClick={onConfirm}
            style={{ padding: "8px 18px", fontWeight: 800 }}
          >
            <Check size={15} aria-hidden="true" style={{ marginRight: "5px", verticalAlign: "-2px" }} />Confirmer le Transfert
          </button>
        </div>
      </div>
    </div>
  );
}
