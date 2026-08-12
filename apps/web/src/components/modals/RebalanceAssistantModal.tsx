import { X, BarChart3, AlertTriangle, Check, Zap, ListChecks, PartyPopper, Lightbulb, RotateCcw, Sparkles, Wand2, ArrowRight } from "lucide-react";
import { validateAssignment, type DispatchWeights } from "@edtemps/domain";
import type { Dataset, Scenario } from "../../types";
import { computeRebalanceSteps } from "../../utils/rebalance";

export function RebalanceAssistantModal({
  dataset,
  selected,
  weights,
  anonymous,
  scenarios,
  setScenarios,
  move,
  onClose,
}: {
  dataset: Dataset;
  selected: Scenario;
  weights: DispatchWeights;
  anonymous: boolean;
  scenarios: Scenario[];
  setScenarios: (scens: Scenario[] | ((prev: Scenario[]) => Scenario[])) => void;
  move: (studentId: string, targetClassroomId: string) => Promise<void>;
  onClose: () => void;
}) {
  const rebalanceData = computeRebalanceSteps(dataset, selected.assignments, weights, anonymous);
  const violations = validateAssignment(dataset as any, selected.assignments);

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 5000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-lg)",
          maxWidth: "680px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "26px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-light)", paddingBottom: "14px" }}>
          <div>
            <span className="brand-badge" style={{ background: "var(--badge-option-bg)", color: "var(--badge-option-text)", padding: "3px 10px", borderRadius: "12px", fontSize: "0.74rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <Wand2 size={12} aria-hidden="true" /> ASSISTANT ALGORITHMIQUE DE RÉÉQUILIBRAGE
            </span>
            <h2 style={{ margin: "6px 0 2px", fontSize: "1.35rem", fontWeight: 800, color: "var(--text-main)" }}>
              Plan d'Ajustement Pédagogique Pas-à-Pas
            </h2>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.84rem" }}>
              Analyse en temps réel de votre répartition manuelle et recommandations d'équilibrage calculées par le solveur.
            </p>
          </div>
          <button className="icon-btn-subtle" onClick={onClose} style={{ padding: "6px 10px", fontSize: "1.1rem", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Diagnostic d'Équilibre (Validation Check) */}
        <div style={{ background: "var(--bg-subtle)", padding: "14px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
          <h4 style={{ margin: "0 0 8px", fontSize: "0.92rem", fontWeight: 800, color: "var(--text-main)" }}>
            <BarChart3 size={15} aria-hidden="true" style={{ marginRight: "5px", verticalAlign: "-2px" }} />Diagnostic de la Répartition Courante
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
            <div style={{ background: violations.length > 0 ? "var(--card-error-bg)" : "var(--card-success-bg)", padding: "8px 12px", borderRadius: "6px", border: `1px solid ${violations.length > 0 ? "var(--card-error-border)" : "var(--card-success-border)"}` }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: violations.length > 0 ? "var(--card-error-text)" : "var(--card-success-text)" }}>
                {violations.length > 0 ? <><AlertTriangle size={12} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> {violations.length} Contrainte(s) dures violées</> : <><Check size={12} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> Respect strict des contraintes dures</>}
              </span>
            </div>
            <div style={{ background: rebalanceData.issuesCount > 0 ? "var(--card-warning-bg)" : "var(--card-success-bg)", padding: "8px 12px", borderRadius: "6px", border: `1px solid ${rebalanceData.issuesCount > 0 ? "var(--card-warning-border)" : "var(--card-success-border)"}` }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: rebalanceData.issuesCount > 0 ? "var(--card-warning-text)" : "var(--card-success-text)" }}>
                {rebalanceData.issuesCount > 0 ? <><Zap size={12} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> {rebalanceData.issuesCount} Ajustement(s) d'effectifs requis</> : <><Check size={12} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> Effectifs de classes conformes</>}
              </span>
            </div>
          </div>
        </div>

        {/* Liste des Étapes Suggérées Pas-à-Pas */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h4 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 800, color: "var(--primary-brand)" }}>
              <ListChecks size={15} aria-hidden="true" style={{ marginRight: "5px", verticalAlign: "-2px" }} />Étapes d'Ajustement Proposées ({rebalanceData.steps.length})
            </h4>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
              Vous conservez la validation finale sur chaque étape.
            </span>
          </div>

          {rebalanceData.steps.length === 0 ? (
            <div style={{ background: "var(--card-success-bg)", color: "var(--card-success-text)", border: "1px solid var(--card-success-border)", padding: "16px", borderRadius: "var(--radius-sm)", textAlign: "center", fontWeight: 700, fontSize: "0.9rem" }}>
              <PartyPopper size={16} aria-hidden="true" style={{ marginRight: "6px", verticalAlign: "-3px" }} />Votre répartition manuelle est parfaitement équilibrée ! Aucune action corrective n'est nécessaire.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {rebalanceData.steps.map((step, index) => (
                <div
                  key={step.id}
                  style={{
                    background: "var(--bg-card)",
                    border: `1px solid ${step.priority === "HIGH" ? "var(--card-warning-border)" : "var(--border-light)"}`,
                    borderRadius: "var(--radius-md)",
                    padding: "14px 16px",
                    boxShadow: "var(--shadow-sm)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ background: "var(--button-primary-bg)", color: "#fff", width: "22px", height: "22px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.75rem" }}>
                        {index + 1}
                      </span>
                      <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: step.avatarColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.72rem" }}>
                        {step.studentInitials}
                      </div>
                      <span style={{ fontWeight: 800, fontSize: "0.92rem", color: "var(--text-main)" }}>
                        {step.studentName}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ background: "var(--bg-subtle)", padding: "3px 8px", borderRadius: "6px", fontSize: "0.78rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        {step.fromClassLabel} <ArrowRight size={12} aria-hidden="true" /> <strong style={{ color: "var(--primary-brand)" }}>{step.toClassLabel}</strong>
                      </span>
                      <button
                        className="primary"
                        onClick={async () => {
                          await move(step.studentId, step.toClassId);
                        }}
                        style={{ padding: "4px 12px", fontSize: "0.78rem", fontWeight: 800 }}
                      >
                        <Zap size={12} aria-hidden="true" style={{ marginRight: "4px", verticalAlign: "-1px" }} />Appliquer cette étape
                      </button>
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)", background: "var(--bg-subtle)", padding: "8px 12px", borderRadius: "var(--radius-sm)", lineHeight: 1.4 }}>
                    <Lightbulb size={12} aria-hidden="true" style={{ marginRight: "4px", verticalAlign: "-1px" }} /><strong>Raison & Validation :</strong> {step.reasoning}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Boutons Globaux de Sortie */}
        <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <button
            className="secondary"
            onClick={() => {
              if (confirm("Réinitialiser toutes vos modifications manuelles et revenir au scénario initial ?")) {
                const orig = scenarios.find((s) => s.id === selected.id);
                if (orig) setScenarios((prev) => prev.map((s) => s.id === selected.id ? { ...s, assignments: { ...orig.assignments } } : s));
                onClose();
              }
            }}
            style={{ fontSize: "0.82rem", padding: "8px 14px" }}
          >
            <RotateCcw size={13} aria-hidden="true" style={{ marginRight: "5px", verticalAlign: "-2px" }} />Réinitialiser au scénario d'origine
          </button>

          <div style={{ display: "flex", gap: "10px" }}>
            <button className="secondary" onClick={onClose} style={{ padding: "8px 16px" }}>
              Fermer & Conserver
            </button>
            {rebalanceData.steps.length > 0 && (
              <button
                className="primary"
                onClick={async () => {
                  for (const step of rebalanceData.steps) {
                    await move(step.studentId, step.toClassId);
                  }
                  onClose();
                }}
                style={{ padding: "8px 20px", fontWeight: 800, background: "var(--button-success-bg)" }}
              >
                <Sparkles size={15} aria-hidden="true" style={{ marginRight: "6px", verticalAlign: "-2px" }} />Appliquer Tout le Rééquilibrage ({rebalanceData.steps.length} étapes)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
