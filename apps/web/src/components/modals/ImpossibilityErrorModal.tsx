import type { DispatchWeights } from "@edtemps/domain";
import type { FeasibilityError } from "@edtemps/domain";
import { createSyntheticDemoInputCustom, setActiveDataset } from "../../api";
import type { Dataset } from "../../types";

export function ImpossibilityErrorModal({
  impossibilityErrors,
  onClose,
  simStudentCount,
  simClassCount,
  simMaxSize,
  simMinSize,
  setSimClassCount,
  setSimMaxSize,
  setSimMinSize,
  weights,
  setWeights,
  setDataset,
  setNotice,
}: {
  impossibilityErrors: FeasibilityError[];
  onClose: () => void;
  simStudentCount: number;
  simClassCount: number;
  simMaxSize: number;
  simMinSize: number;
  setSimClassCount: (val: number) => void;
  setSimMaxSize: (val: number) => void;
  setSimMinSize: (val: number) => void;
  weights: DispatchWeights;
  setWeights: (newWeights: DispatchWeights | ((prev: DispatchWeights) => DispatchWeights)) => void;
  setDataset: (ds: Dataset) => void;
  setNotice: (msg: string) => void;
}) {
  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.75)",
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
          border: "2px solid var(--rose-accent)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-lg)",
          maxWidth: "620px",
          width: "100%",
          padding: "26px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid var(--border-light)", paddingBottom: "16px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--card-warning-bg)", color: "var(--rose-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", fontWeight: 800, flexShrink: 0 }}>
            🚨
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--card-warning-text)" }}>
              Impossibilité Mathématique Détectée
            </h3>
            <span style={{ fontSize: "0.82rem", color: "var(--card-warning-text)", fontWeight: 600 }}>
              L'algorithme a interrompu le calcul car vos contraintes de structure sont physiquement irréalisables.
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {impossibilityErrors.map((err, idx) => (
            <div key={idx} style={{ background: "var(--card-warning-bg)", border: "1px solid var(--card-warning-border)", padding: "14px 16px", borderRadius: "var(--radius-sm)" }}>
              <h4 style={{ margin: "0 0 6px", fontSize: "0.92rem", fontWeight: 800, color: "var(--card-warning-text)" }}>
                {err.title}
              </h4>
              <p style={{ margin: "0 0 12px", fontSize: "0.86rem", color: "var(--card-warning-text)", lineHeight: 1.45 }}>
                {err.message}
              </p>
              {err.suggestedFix && (
                <div style={{ background: "var(--bg-card)", padding: "12px", borderRadius: "6px", border: "1px solid var(--card-warning-border)" }}>
                  <strong style={{ fontSize: "0.78rem", color: "var(--card-warning-text)", display: "block", marginBottom: "6px" }}>
                    💡 Action corrective recommandée par l'IA :
                  </strong>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)", flex: 1, minWidth: "200px" }}>
                      {err.suggestedFix.label}
                    </span>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        const newClassCount = err.suggestedFix?.recommendedClassCount ?? simClassCount;
                        const newMaxSize = err.suggestedFix?.recommendedMaxSize ?? simMaxSize;
                        const newMinSize = err.suggestedFix?.recommendedMinSize ?? simMinSize;

                        if (err.suggestedFix?.recommendedClassCount) setSimClassCount(newClassCount);
                        if (err.suggestedFix?.recommendedMaxSize) setSimMaxSize(newMaxSize);
                        if (err.suggestedFix?.recommendedMinSize) setSimMinSize(newMinSize);

                        const newWeights = { ...weights };
                        if (err.code === "OPTION_SINGLE_CLASS_OVERFLOW") {
                          newWeights.optionGroupingMode = "BALANCED_DISPERSION";
                          setWeights(newWeights);
                        }

                        const fixedInput = createSyntheticDemoInputCustom(simStudentCount, newClassCount, newMaxSize, newMinSize);
                        setDataset(fixedInput);
                        setActiveDataset(fixedInput);
                        onClose();
                        setNotice("Structure d'effectifs réajustée automatiquement selon la recommandation de l'IA.");
                      }}
                      style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 800, background: "var(--rose-accent)", borderColor: "var(--rose-accent)" }}
                    >
                      🛠️ Appliquer la correction IA
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid var(--border-light)", paddingTop: "14px" }}>
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            style={{ padding: "8px 18px", fontWeight: 700 }}
          >
            Fermer et modifier manuellement
          </button>
        </div>
      </div>
    </div>
  );
}
