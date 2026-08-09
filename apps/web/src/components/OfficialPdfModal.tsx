import { useState } from "react";
import type { Classroom, Dataset, Scenario, Student } from "../types";

export function OfficialPdfModal({
  scenario,
  dataset,
  onClose,
  anonymous: initialAnonymous,
}: {
  scenario: Scenario;
  dataset: Dataset;
  onClose: () => void;
  anonymous: boolean;
}) {
  const [identityMode, setIdentityMode] = useState<"INITIALS" | "FULL_NAME" | "INE_HASH">("INITIALS");
  const [schoolName, setSchoolName] = useState<string>("Collège Édouard Herriot — Académie de Paris");

  const getStudentDisplayName = (st: Student) => {
    if (identityMode === "FULL_NAME") {
      return st.displayName;
    }
    if (identityMode === "INE_HASH") {
      return st.id;
    }
    return st.initials;
  };

  const currentDateStr = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const totalStudents = dataset.students.length;
  const totalGirls = dataset.students.filter((s) => s.gender === "F").length;
  const totalBoys = dataset.students.filter((s) => s.gender === "M").length;
  const globalAvg = totalStudents > 0 ? dataset.students.reduce((acc, st) => acc + st.levelAverage, 0) / totalStudents : 0;
  const totalPap = dataset.students.filter((s) => s.supportFlags.length > 0).length;

  return (
    <div className="modal-overlay print-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-card print-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "1100px",
          width: "95vw",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-md)",
          padding: "28px",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* HEADER CONTROLS (HIDDEN DURING PRINT) */}
        <div className="no-print" style={{ marginBottom: "24px", borderBottom: "1px solid var(--border-light)", paddingBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                📄 Procès-Verbal de Répartition (Format PDF Imprimable)
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Prévisualisez et ajustez les options de document avant l'impression ou l'exportation PDF.
              </p>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={onClose}
              style={{ padding: "8px 16px", fontSize: "0.88rem", fontWeight: 800, background: "var(--bg-subtle)", color: "var(--text-main)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", cursor: "pointer" }}
            >
              ✕ Fermer
            </button>
          </div>

          {/* CONTROL PANEL CARD */}
          <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 800, color: "var(--text-main)", marginBottom: "8px" }}>
                Mode d'Identité Élèves :
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setIdentityMode("INITIALS")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "var(--radius-sm)",
                    fontWeight: 800,
                    fontSize: "0.84rem",
                    cursor: "pointer",
                    border: "1px solid var(--border-light)",
                    background: identityMode === "INITIALS" ? "var(--button-primary-bg)" : "var(--bg-card)",
                    color: identityMode === "INITIALS" ? "#ffffff" : "var(--text-main)",
                  }}
                >
                  👥 Initiales / App (`C.L.`)
                </button>
                <button
                  type="button"
                  onClick={() => setIdentityMode("FULL_NAME")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "var(--radius-sm)",
                    fontWeight: 800,
                    fontSize: "0.84rem",
                    cursor: "pointer",
                    border: "1px solid var(--border-light)",
                    background: identityMode === "FULL_NAME" ? "var(--button-primary-bg)" : "var(--bg-card)",
                    color: identityMode === "FULL_NAME" ? "#ffffff" : "var(--text-main)",
                  }}
                >
                  👤 Noms Complêts
                </button>
                <button
                  type="button"
                  onClick={() => setIdentityMode("INE_HASH")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "var(--radius-sm)",
                    fontWeight: 800,
                    fontSize: "0.84rem",
                    cursor: "pointer",
                    border: "1px solid var(--border-light)",
                    background: identityMode === "INE_HASH" ? "var(--button-primary-bg)" : "var(--bg-card)",
                    color: identityMode === "INE_HASH" ? "#ffffff" : "var(--text-main)",
                  }}
                >
                  🔒 INE SHA-256
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 800, color: "var(--text-main)", marginBottom: "6px" }}>
                Nom de l'Établissement (Entête PDF) :
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: "500px",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-light)",
                  background: "var(--bg-card)",
                  color: "var(--text-main)",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                }}
              />
            </div>

            <div>
              <button
                type="button"
                className="primary"
                onClick={() => window.print()}
                style={{
                  padding: "12px 24px",
                  fontSize: "0.95rem",
                  fontWeight: 800,
                  background: "#059669",
                  color: "#ffffff",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                🖨️ Imprimer / Sauvegarder en PDF (Ctrl+P)
              </button>
            </div>
          </div>
        </div>

        {/* DOCUMENT PDF À IMPRIMER */}
        <div className="official-pdf-document" style={{ color: "#0f172a", fontFamily: "var(--font-body)", background: "#ffffff", padding: "24px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>

          {/* ==================== PAGE 1 : SYNTHÈSE GLOBALE DE COHORTE ==================== */}
          <div style={{ marginBottom: "28px" }}>
            {/* ENTÊTE DU PV */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", marginBottom: "20px" }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 900, color: "#1e3a8a", fontFamily: "var(--font-serif)" }}>
                  {schoolName}
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "0.85rem", fontStyle: "italic", color: "#475569" }}>
                  Enseignement Secondaire — Registre d'Arbitrage et d'Affectation des Élèves
                </p>
              </div>

              <div style={{ textAlign: "right", fontSize: "0.82rem", lineHeight: 1.45, color: "#334155" }}>
                <strong style={{ display: "block", textTransform: "uppercase", fontSize: "0.88rem", letterSpacing: "0.03em" }}>
                  ANNÉE SCOLAIRE 2026-2027
                </strong>
                <div>Niveau : <strong>{dataset.level} (Cohorte Complète)</strong></div>
                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>EdTemps v0.1 · Synthèse d'Arbitrage</div>
                <div>Date : <strong>{currentDateStr}</strong></div>
              </div>
            </div>

            <div style={{ borderBottom: "2px solid #0f172a", marginBottom: "24px" }} />

            {/* TITRE PRINCIPAL DU PV */}
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 900, color: "#1e3a8a", letterSpacing: "0.02em", textTransform: "uppercase" }}>
                PROCÈS-VERBAL DE RÉPARTITION DES ÉLÈVES
              </h1>
              <p style={{ margin: "6px 0 0", fontSize: "0.9rem", fontStyle: "italic", color: "#475569" }}>
                Document de travail et d'arbitrage d'établissement — Scénario {scenario.id} ({scenario.state === "APPROVED" ? "Officialisé CNIL Traçable" : "Proposition Provisoire"})
              </p>
            </div>

            {/* TABLEAU DE SYNTHÈSE DE LA COHORTE */}
            <div>
              <h3 style={{ margin: "0 0 14px", fontSize: "1.05rem", fontWeight: 900, color: "#1e3a8a", textTransform: "uppercase" }}>
                📊 Synthèse Globale du Niveau {dataset.level} ({dataset.classrooms.length} Classes · {totalStudents} Élèves)
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#1e3a8a", color: "#ffffff" }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 800 }}>Structure de Classe</th>
                    <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 800 }}>Effectif</th>
                    <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 800 }}>Parité (F / M)</th>
                    <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 800 }}>Moyenne Gén.</th>
                    <th style={{ textAlign: "center", padding: "10px 12px", fontWeight: 800 }}>PAP / PPS</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 800 }}>Profil Options</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.classrooms.map((c, idx) => {
                    const students = dataset.students.filter((s) => scenario.assignments[s.id] === c.id);
                    const girls = students.filter((s) => s.gender === "F").length;
                    const boys = students.filter((s) => s.gender === "M").length;
                    const avg = students.length > 0 ? students.reduce((acc, st) => acc + st.levelAverage, 0) / students.length : 0;
                    const papCount = students.filter((s) => s.supportFlags.length > 0).length;
                    const optList = Array.from(new Set(students.flatMap((s) => s.options))).join(", ");

                    const classLabelDisplay = c.label.toUpperCase().startsWith("CLASSE")
                      ? c.label.toUpperCase()
                      : `CLASSE DE ${c.label.toUpperCase()}`;

                    return (
                      <tr key={c.id} style={{ borderBottom: "1px solid #cbd5e1", background: idx % 2 === 1 ? "#f8fafc" : "#ffffff" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 800, color: "#1e3a8a" }}>{classLabelDisplay}</td>
                        <td style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700 }}>{students.length} / {c.maxSize}</td>
                        <td style={{ textAlign: "center", padding: "10px 12px", fontWeight: 600 }}>{girls} F / {boys} M ({students.length > 0 ? Math.round((girls / students.length) * 100) : 0}% F)</td>
                        <td style={{ textAlign: "center", padding: "10px 12px", fontFamily: "var(--font-mono)", fontWeight: 800, color: "#1e3a8a" }}>{avg.toFixed(1)} / 20</td>
                        <td style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700, color: papCount > 0 ? "#9a3412" : "#64748b" }}>{papCount} él.</td>
                        <td style={{ padding: "10px 12px", fontSize: "0.8rem", color: "#475569" }}>{optList || "Formations Générales"}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: "#f1f5f9", borderTop: "2px solid #0f172a", fontWeight: 900 }}>
                    <td style={{ padding: "12px", color: "#0f172a" }}>TOTAL COHORTE {dataset.level}</td>
                    <td style={{ textAlign: "center", padding: "12px", color: "#0f172a" }}>{totalStudents} Élèves</td>
                    <td style={{ textAlign: "center", padding: "12px" }}>{totalGirls} F / {totalBoys} M ({totalStudents > 0 ? Math.round((totalGirls / totalStudents) * 100) : 0}% F)</td>
                    <td style={{ textAlign: "center", padding: "12px", fontFamily: "var(--font-mono)", color: "#1e3a8a" }}>{globalAvg.toFixed(1)} / 20</td>
                    <td style={{ textAlign: "center", padding: "12px", color: "#9a3412" }}>{totalPap} Total PAP/PPS</td>
                    <td style={{ padding: "12px", fontSize: "0.8rem", color: "#475569" }}>Cohorte Complète 6ème</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ==================== PAGES 2..N : 1 PAGE PAR CLASSE ==================== */}
          {dataset.classrooms.map((c) => {
            const students = dataset.students.filter((s) => scenario.assignments[s.id] === c.id);
            const girls = students.filter((s) => s.gender === "F").length;
            const boys = students.filter((s) => s.gender === "M").length;
            const avg = students.length > 0 ? students.reduce((acc, st) => acc + st.levelAverage, 0) / students.length : 0;
            const papCount = students.filter((s) => s.supportFlags.length > 0).length;

            const classLabelDisplay = c.label.toUpperCase().startsWith("CLASSE")
              ? c.label.toUpperCase()
              : `CLASSE DE ${c.label.toUpperCase()}`;

            return (
              <div key={c.id} className="pdf-page-class" style={{ breakBefore: "page", pageBreakBefore: "always", breakInside: "avoid", pageBreakInside: "avoid", paddingTop: "10px", marginBottom: "28px" }}>
                {/* RAPPEL MINI ENTÊTE PAGE */}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "#64748b", borderBottom: "1px solid #cbd5e1", paddingBottom: "6px", marginBottom: "14px" }}>
                  <span>{schoolName} — PV de Répartition {dataset.level}</span>
                  <span>Scénario {scenario.id} · Date : {currentDateStr}</span>
                </div>

                <div style={{ border: "2px solid #1e3a8a", borderRadius: "8px", padding: "16px 20px", background: "#ffffff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "2px solid #1e3a8a", paddingBottom: "8px" }}>
                    <strong style={{ fontSize: "1.25rem", fontWeight: 900, color: "#1e3a8a", letterSpacing: "0.02em" }}>
                      {classLabelDisplay}
                    </strong>
                    <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#1e3a8a" }}>
                      Effectif : {students.length} / {c.maxSize} élèves affectés
                    </span>
                  </div>

                  <div style={{ fontSize: "0.82rem", color: "#334155", marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", background: "#f8fafc", padding: "8px 14px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <span>Parité : <strong style={{ color: "#0f172a" }}>{girls} F / {boys} M</strong> ({students.length > 0 ? Math.round((girls / students.length) * 100) : 0}% F)</span>
                    <span>Moyenne générale de classe : <strong style={{ color: "#1e3a8a", fontFamily: "var(--font-mono)" }}>{avg.toFixed(1)} / 20</strong></span>
                    <span>Accompagnements (PAP / PPS / PAI) : <strong style={{ color: "#9a3412" }}>{papCount} él.</strong></span>
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                        <th style={{ textAlign: "left", padding: "6px 8px", width: "40px", color: "#334155", fontWeight: 800 }}>#</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "#334155", fontWeight: 800 }}>Nom & Prénom / Identité Élève</th>
                        <th style={{ textAlign: "center", padding: "6px 8px", width: "60px", color: "#334155", fontWeight: 800 }}>Sexe</th>
                        <th style={{ textAlign: "center", padding: "6px 8px", width: "95px", color: "#334155", fontWeight: 800 }}>Moyenne</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "#334155", fontWeight: 800 }}>Options & Langues</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "#334155", fontWeight: 800 }}>Accompagnements / Aménagements</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((st, i) => (
                        <tr key={st.id} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 1 ? "#fafafa" : "#ffffff" }}>
                          <td style={{ padding: "5px 8px", color: "#64748b", fontWeight: 600 }}>{i + 1}</td>
                          <td style={{ padding: "5px 8px", fontWeight: 700, color: "#0f172a", fontSize: "0.85rem" }}>
                            {getStudentDisplayName(st)}
                          </td>
                          <td style={{ textAlign: "center", padding: "5px 8px", fontWeight: 700, color: st.gender === "F" ? "#831843" : "#075985" }}>
                            {st.gender}
                          </td>
                          <td style={{ textAlign: "center", padding: "5px 8px", fontFamily: "var(--font-mono)", fontWeight: 800, color: "#1e3a8a", fontSize: "0.85rem" }}>
                            {st.levelAverage.toFixed(1)}
                          </td>
                          <td style={{ padding: "5px 8px", fontSize: "0.78rem", color: "#334155", fontWeight: 600 }}>
                            {st.options.length > 0 ? st.options.join(", ") : "—"}
                          </td>
                          <td style={{ padding: "5px 8px", fontSize: "0.78rem", color: st.supportFlags.length > 0 ? "#9a3412" : "#64748b", fontWeight: st.supportFlags.length > 0 ? 700 : 500 }}>
                            {st.supportFlags.length > 0 ? st.supportFlags.join(", ") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* ==================== BLOC DE SIGNATURES OFFICIELLES (À LA TOUTE FIN DU PV) ==================== */}
          <div className="pdf-signatures-block" style={{ marginTop: "40px", borderTop: "2px solid #0f172a", paddingTop: "24px", pageBreakInside: "avoid", breakInside: "avoid" }}>
            <h4 style={{ margin: "0 0 16px", fontSize: "0.95rem", fontWeight: 800, textTransform: "uppercase", color: "#1e3a8a" }}>
              Signatures d'Arbitrage et d'Habilitation d'Établissement :
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", textAlign: "center", minHeight: "110px" }}>
              <div style={{ border: "1px dashed #7c8fac", borderRadius: "6px", padding: "14px", background: "#f8fafc" }}>
                <strong style={{ fontSize: "0.85rem", display: "block", color: "#0f172a" }}>Le Chef d'Établissement</strong>
                <span style={{ fontSize: "0.76rem", color: "#64748b" }}>(Principal / Proviseur)</span>
              </div>
              <div style={{ border: "1px dashed #7c8fac", borderRadius: "6px", padding: "14px", background: "#f8fafc" }}>
                <strong style={{ fontSize: "0.85rem", display: "block", color: "#0f172a" }}>Le Principal Adjoint</strong>
                <span style={{ fontSize: "0.76rem", color: "#64748b" }}>(Directeur des Études)</span>
              </div>
              <div style={{ border: "1px dashed #7c8fac", borderRadius: "6px", padding: "14px", background: "#f8fafc" }}>
                <strong style={{ fontSize: "0.85rem", display: "block", color: "#0f172a" }}>Le Conseiller Principal d'Éducation</strong>
                <span style={{ fontSize: "0.76rem", color: "#64748b" }}>(CPE)</span>
              </div>
            </div>

            <p style={{ marginTop: "24px", fontSize: "0.74rem", color: "#64748b", fontStyle: "italic", textAlign: "center", lineHeight: 1.45 }}>
              Document officiel d'établissement rédigé conformément à la mission d'intérêt public (Art. 6.1.e RGPD) et aux règles de protection des mineurs (Art. 22 RGPD).<br />
              Les décisions d'affectation et événements de répartition sont tracés dans le registre append-only CNIL de l'application EdTemps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}