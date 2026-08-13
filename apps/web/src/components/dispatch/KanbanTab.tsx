import type { DispatchWeights } from "@edtemps/domain";
import { Scale, Lock, CheckCircle2, FileText, Sparkles, Undo2, Redo2, FileDown, Package, AlertTriangle, Info, Target, Trophy, BarChart3, Zap, HeartHandshake, Lightbulb, Check, ClipboardList, SlidersHorizontal, Wand2, Pencil, ArrowRight, TriangleAlert, OctagonAlert, X, FolderOpen, GraduationCap, User } from "lucide-react";
import { api } from "../../api";
import type { Classroom, Dataset, Scenario, Student } from "../../types";
import { getAvatarColor, nameOf } from "../../utils/format";
import { SUPPORT_FLAG_TITLES, OPTION_TITLES } from "../../constants/referentiels";
import { Metric } from "../Metric";
import { Explanation } from "../Explanation";

export function KanbanTab({
  dataset,
  weights,
  anonymous,
  busy,
  scenarios,
  selected,
  selectedStudentId,
  setSelectedStudentId,
  selectedStudent,
  dragOverClassId,
  setDragOverClassId,
  draggedStudentId,
  setDraggedStudentId,
  openSupportModalClassId,
  setOpenSupportModalClassId,
  lastMove,
  historyPast,
  historyFuture,
  studentsByClass,
  ruleAuditList,
  setInspectStudent,
  setSelectedId,
  setShowPdfModal,
  setShowRebalanceModal,
  getBestScenarioId,
  requestMove,
  undoLastMove,
  handleUndo,
  handleRedo,
  validate,
}: {
  dataset: Dataset;
  weights: DispatchWeights;
  anonymous: boolean;
  busy: boolean;
  scenarios: Scenario[];
  selected: Scenario;
  selectedStudentId: string | undefined;
  setSelectedStudentId: (id: string | undefined) => void;
  selectedStudent: Student | undefined;
  dragOverClassId: string | null;
  setDragOverClassId: (id: string | null) => void;
  draggedStudentId: string | null;
  setDraggedStudentId: (id: string | null) => void;
  openSupportModalClassId: string | null;
  setOpenSupportModalClassId: (id: string | null) => void;
  lastMove: { studentId: string; studentName: string; fromClassId: string; toClassId: string } | null;
  historyPast: Scenario[];
  historyFuture: Scenario[];
  studentsByClass: (Classroom & { students: Student[] })[];
  ruleAuditList: {
    id: string;
    type: "CONFLICT" | "COLOCATION";
    studentAName: string;
    studentBName: string;
    classALabel: string;
    classBLabel: string;
    isViolated: boolean;
  }[];
  setInspectStudent: (s: Student | null) => void;
  setSelectedId: (id: string) => void;
  setShowPdfModal: (v: boolean) => void;
  setShowRebalanceModal: (v: boolean) => void;
  getBestScenarioId: (scens: Scenario[]) => string | undefined;
  requestMove: (studentId: string, targetClassroomId: string) => void;
  undoLastMove: () => Promise<void>;
  handleUndo: () => void;
  handleRedo: () => void;
  validate: () => Promise<void>;
}) {
  return (
            <>
              {/* BANDEAU PERMANENT D'ACTION ET DE VALIDATION HUMAINE EN HAUT DE PAGE */}
              <div style={{ background: selected?.state === "APPROVED" ? "var(--card-success-bg)" : "var(--bg-card)", border: `2px solid ${selected?.state === "APPROVED" ? "var(--card-success-border)" : "var(--primary-brand)"}`, padding: "16px 20px", borderRadius: "var(--radius-md)", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", boxShadow: "var(--shadow-md)" }}>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--primary-brand)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Scale size={14} aria-hidden="true" /> ÉTAPE 3 : DÉCISION HUMAINE OBLIGATOIRE (ART. 6.1.E RGPD)
                  </div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)", marginTop: "2px" }}>
                    Scénario examiné : <strong>{selected?.id === scenarios[0]?.id ? "Scénario A (🎯 Équilibre)" : selected?.id === scenarios[1]?.id ? "Scénario B (📊 Mixité)" : "Scénario C (🤝 Accompagnement)"}</strong> — <span style={{ color: "var(--card-success-text)" }}>{Math.round((selected?.metrics.score ?? 850) / 10)}% Score d'Équilibrage</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    className="validate"
                    onClick={validate}
                    disabled={busy || selected?.state === "APPROVED"}
                    style={{ padding: "10px 18px", fontSize: "0.9rem", fontWeight: 800, background: selected?.state === "APPROVED" ? "var(--emerald-accent)" : "var(--button-primary-bg)", color: "#ffffff", borderRadius: "var(--radius-sm)", cursor: "pointer", border: "none", boxShadow: "var(--shadow-sm)", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    {selected?.state === "APPROVED" ? <CheckCircle2 size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
                    {selected?.state === "APPROVED" ? "Officialisé (CNIL)" : "Officialiser Ce Scénario"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPdfModal(true)}
                    style={{
                      padding: "10px 18px",
                      fontSize: "0.9rem",
                      fontWeight: 800,
                      background: "var(--emerald-accent)",
                      color: "#ffffff",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      border: "none",
                      boxShadow: "var(--shadow-sm)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <FileText size={16} aria-hidden="true" /> Exporter PDF (Procès-Verbal)
                  </button>

                  <a
                    href={selected ? api.exportCsvUrl(selected.id) : "#"}
                    download={selected ? `repartition-${selected.id}.csv` : "repartition.csv"}
                    style={{
                      padding: "10px 14px",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      background: "var(--bg-subtle)",
                      color: "var(--text-main)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-light)",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <FileDown size={14} aria-hidden="true" /> CSV
                  </a>

                  <a
                    href={selected ? api.exportPronoteUrl(selected.id) : "#"}
                    download={selected ? `repartition-${selected.id}-pronote.json` : "repartition-pronote.json"}
                    style={{
                      padding: "10px 14px",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      background: "var(--bg-subtle)",
                      color: "var(--text-main)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-light)",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Package size={14} aria-hidden="true" /> PRONOTE JSON
                  </a>
                </div>
              </div>
              <section aria-labelledby="scenarios-title">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: "var(--text-main)", letterSpacing: "-0.01em" }}>
                      Répartition — {dataset.level}, rentrée 2026
                    </h2>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px", fontWeight: 600 }}>
                      {dataset.classrooms.length} classes · {dataset.students.length} élèves · scénario n°{scenarios.findIndex((s) => s.id === selected?.id) + 1} ({selected?.state === "APPROVED" ? "officialisé" : "brouillon"})
                    </div>
                  </div>

                  {/* LÉGENDE INSTITUTIONNELLE DES EFFECTIFS */}
                  <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "0.78rem", fontWeight: 700, background: "var(--bg-subtle)", padding: "6px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--emerald-accent)" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--emerald-accent)" }} />
                      Effectif conforme
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--amber-accent)" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--amber-accent)" }} />
                      Sous-effectif — à surveiller
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--rose-accent)" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--rose-accent)" }} />
                      Sur-effectif — bloquant
                    </span>
                  </div>

                  {/* BARRE D'HISTORIQUE UNDO / REDO + AUDIT RÈGLES COMPACT */}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    {ruleAuditList.length > 0 && (
                      <span
                        className="ui-tooltip"
                        data-tooltip={`Audit des Règles Individuelles :\n` + ruleAuditList.map((a) => `${a.type === "CONFLICT" ? "⛔ Séparation" : "🤝 Association"} : ${a.studentAName} (${a.classALabel}) ⬄ ${a.studentBName} (${a.classBLabel}) -> ${a.isViolated ? "❌ VIOLATION (Même classe !)" : "✅ RESPECTÉ"}`).join("\n")}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.8rem",
                          fontWeight: 800,
                          background: ruleAuditList.some((a) => a.isViolated) ? "var(--card-warning-bg)" : "var(--card-success-bg)",
                          border: `1px solid ${ruleAuditList.some((a) => a.isViolated) ? "var(--card-warning-border)" : "var(--card-success-border)"}`,
                          color: ruleAuditList.some((a) => a.isViolated) ? "var(--card-warning-text)" : "var(--card-success-text)",
                          cursor: "help",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        {ruleAuditList.some((a) => a.isViolated)
                          ? <><AlertTriangle size={12} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> {ruleAuditList.filter((a) => a.isViolated).length} Conflit de Séparation (Survoler pour détails)</>
                          : <><CheckCircle2 size={12} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> {ruleAuditList.length}/{ruleAuditList.length} Règles Respectées <Info size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /></>}
                      </span>
                    )}
                    <button
                      className={`icon-btn-subtle ui-tooltip ${historyPast.length > 0 ? "" : "disabled"}`}
                      data-tooltip="Annuler le dernier déplacement d'élève (Ctrl+Z / Cmd+Z)"
                      onClick={handleUndo}
                      disabled={historyPast.length === 0 || busy || selected?.state === "APPROVED"}
                      style={{
                        padding: "6px 12px",
                        fontWeight: 700,
                        fontSize: "0.84rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-interactive)",
                        background: historyPast.length > 0 ? "var(--bg-card)" : "var(--bg-subtle)",
                        color: historyPast.length > 0 ? "var(--text-main)" : "var(--text-muted)",
                        cursor: historyPast.length > 0 ? "pointer" : "not-allowed",
                      }}
                    >
                      <Undo2 size={15} aria-hidden="true" /> Annuler ({historyPast.length})
                    </button>
                    <button
                      className={`icon-btn-subtle ui-tooltip ${historyFuture.length > 0 ? "" : "disabled"}`}
                      data-tooltip="Rétablir le déplacement annulé (Ctrl+Y / Cmd+Shift+Z)"
                      onClick={handleRedo}
                      disabled={historyFuture.length === 0 || busy || selected?.state === "APPROVED"}
                      style={{
                        padding: "6px 12px",
                        fontWeight: 700,
                        fontSize: "0.84rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-interactive)",
                        background: historyFuture.length > 0 ? "var(--bg-card)" : "var(--bg-subtle)",
                        color: historyFuture.length > 0 ? "var(--text-main)" : "var(--text-muted)",
                        cursor: historyFuture.length > 0 ? "pointer" : "not-allowed",
                      }}
                    >
                      <Redo2 size={15} aria-hidden="true" /> Rétablir ({historyFuture.length})
                    </button>
                  </div>
                </div>

                <div className="scenario-grid">
                  {busy ? (
                    <>
                      {[1, 2, 3].map((idx) => (
                        <div key={idx} className="shimmer-card" style={{ padding: "20px", minHeight: "180px", display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <div className="shimmer-line" style={{ width: "40%", height: "24px" }} />
                            <div className="shimmer-line" style={{ width: "20%", height: "32px" }} />
                          </div>
                          <div className="shimmer-line" style={{ width: "85%", height: "16px" }} />
                          <div className="shimmer-line" style={{ width: "65%", height: "14px" }} />
                          <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                            <div className="shimmer-line" style={{ width: "30%", height: "20px" }} />
                            <div className="shimmer-line" style={{ width: "30%", height: "20px" }} />
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (() => {
                    const bestScenarioId = getBestScenarioId(scenarios);
                    const femaleCount = dataset.students.filter((s) => s.gender === "F").length;
                    const maleCount = dataset.students.filter((s) => s.gender === "M").length;
                    const avgGrade = dataset.students.length > 0 ? dataset.students.reduce((acc, st) => acc + st.levelAverage, 0) / dataset.students.length : 12;

                    return scenarios.map((scenario, index) => {
                      const qualityPct = Math.round(scenario.metrics.score / 10);
                      const isBest = scenario.id === bestScenarioId;
                      const meta =
                        index === 0
                          ? { title: <><Target size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Scénario A — Équilibre Global</>, desc: "Meilleur compromis entre parité F/M et hétérogénéité des niveaux scolaires.", badge: isBest ? <><Trophy size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> Recommandé (Meilleur score)</> : <><Target size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> Équilibre Global</>, color: isBest ? "var(--button-success-bg)" : "var(--text-muted)" }
                          : index === 1
                            ? { title: <><BarChart3 size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Scénario B — Focus Mixité Scolaire</>, desc: "Harmonise strictement les moyennes générales (écart inter-classes ≤ 0.3 pt).", badge: isBest ? <><Trophy size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> Recommandé (Meilleur score)</> : <><Zap size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> Option Hétérogénéité</>, color: isBest ? "var(--button-success-bg)" : "var(--primary-brand)" }
                            : { title: <><HeartHandshake size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Scénario C — Focus Accompagnements</>, desc: "Dispersion optimale des élèves à besoins (PAP/PPS) sur l'ensemble des classes.", badge: isBest ? <><Trophy size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> Recommandé (Meilleur score)</> : <><Lightbulb size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> Option Équilibre PAP</>, color: isBest ? "var(--button-success-bg)" : "var(--card-info-border)" };

                      return (
                        <button
                          key={scenario.id}
                          className={`scenario ${selected?.id === scenario.id ? "selected" : ""}`}
                          onClick={() => setSelectedId(scenario.id)}
                          aria-pressed={selected?.id === scenario.id}
                          style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "20px", textAlign: "left" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <span className="chip" style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}40`, padding: "3px 10px", fontSize: "0.78rem", fontWeight: 800, marginBottom: "6px", display: "inline-block" }}>
                                {meta.badge}
                              </span>
                              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)", fontFamily: "var(--font-heading)" }}>
                                {meta.title}
                              </h3>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <strong style={{ fontSize: "1.6rem", fontWeight: 800, color: meta.color, fontFamily: "var(--font-mono)", display: "block", lineHeight: 1 }}>
                                {qualityPct}%
                              </strong>
                              <small style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 700, display: "block" }}>Score d'Équilibrage</small>
                              <span
                                className="ui-tooltip"
                                data-tooltip={`📌 Origine des Métriques du Scénario :\n• Parité (${weights.genderBalance}/10) : Équilibre F/M vs cohorte (${femaleCount}F/${maleCount}M).\n• Niveaux (${weights.academicBalance}/10) : Écart inter-classes ≤ 0.3pt vs moyenne globale ${avgGrade.toFixed(1)}/20.\n• PAP/PPS (${weights.supportBalance}/10) : ${weights.supportGroupingMode === "GROUP_AESH_CLASSES" ? "Mutualisation AESH sur 1-2 classes" : "Dispersion équilibrée"}.\n• Options (${weights.optionBalance}/10) : Respect des réservations multi-classes et regroupements.`}
                                style={{ fontSize: "0.70rem", color: "var(--primary-brand)", fontWeight: 800, marginTop: "4px", textDecoration: "underline", cursor: "help", display: "inline-block" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Info size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> Origine des métriques
                              </span>
                            </div>
                          </div>

                          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                            {meta.desc}
                          </p>

                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "auto", paddingTop: "8px" }}>
                            <span
                              className="ui-tooltip"
                              data-tooltip={`Équilibre Parité F/M (Poids ${weights.genderBalance}/10) : ${scenario.metrics.genderBalance}%`}
                              style={{ background: weights.genderBalance === 0 ? "var(--bg-subtle)" : "var(--card-success-bg)", color: weights.genderBalance === 0 ? "var(--text-muted)" : "var(--card-success-text)", border: `1px solid ${weights.genderBalance === 0 ? "var(--border-light)" : "var(--card-success-border)"}`, padding: "3px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700, cursor: "help" }}
                            >
                              <Scale size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> Parité {weights.genderBalance === 0 ? "Ignorée" : `${scenario.metrics.genderBalance}%`}
                            </span>
                            <span
                              className="ui-tooltip"
                              data-tooltip={`Hétérogénéité des Niveaux (Poids ${weights.academicBalance}/10) : ${scenario.metrics.academicBalance}%`}
                              style={{ background: weights.academicBalance === 0 ? "var(--bg-subtle)" : "var(--card-highlight-bg)", color: weights.academicBalance === 0 ? "var(--text-muted)" : "var(--card-highlight-text)", border: `1px solid ${weights.academicBalance === 0 ? "var(--border-light)" : "var(--card-highlight-border)"}`, padding: "3px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700, cursor: "help" }}
                            >
                              <BarChart3 size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> Niveaux {weights.academicBalance === 0 ? "Ignorés" : `${scenario.metrics.academicBalance}%`}
                            </span>
                            <span
                              className="ui-tooltip"
                              data-tooltip={`Accompagnements PAP/PPS (Poids ${weights.supportBalance}/10) : ${scenario.metrics.supportBalance}%`}
                              style={{ background: weights.supportBalance === 0 ? "var(--bg-subtle)" : "var(--card-warning-bg)", color: weights.supportBalance === 0 ? "var(--text-muted)" : "var(--card-warning-text)", border: `1px solid ${weights.supportBalance === 0 ? "var(--border-light)" : "var(--card-warning-border)"}`, padding: "3px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700, cursor: "help" }}
                            >
                              <HeartHandshake size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> PAP {weights.supportBalance === 0 ? "Ignoré" : `${scenario.metrics.supportBalance}%`}
                            </span>
                            <span
                              className="ui-tooltip"
                              data-tooltip={`Regroupement d'Options (Poids ${weights.optionBalance}/10) : ${scenario.metrics.optionBalance}%`}
                              style={{ background: weights.optionBalance === 0 ? "var(--bg-subtle)" : "var(--card-purple-bg)", color: weights.optionBalance === 0 ? "var(--text-muted)" : "var(--card-purple-text)", border: `1px solid ${weights.optionBalance === 0 ? "var(--border-light)" : "var(--card-purple-border)"}`, padding: "3px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700, cursor: "help" }}
                            >
                              <GraduationCap size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> Options {weights.optionBalance === 0 ? "Ignorées" : `${scenario.metrics.optionBalance}% respectées`}
                            </span>
                          </div>

                          <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "10px", marginTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span className={scenario.state === "APPROVED" ? "chip approved" : "chip"}>
                              {scenario.state === "APPROVED" ? <><CheckCircle2 size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> Validé & Scellé</> : <><ClipboardList size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> En cours de relecture</>}
                            </span>
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--primary-brand)" }}>
                              {selected?.id === scenario.id ? "Actif ▸" : "Examiner ▸"}
                            </span>
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </section>

              {selected && (
                <>
                  {lastMove && (
                    <div className="undo-banner">
                      <span>
                        ↔️ <strong>{lastMove.studentName}</strong> a été transféré(e) en classe.
                      </span>
                      <button className="undo-btn" onClick={undoLastMove}>
                        ↩️ Annuler le dernier déplacement
                      </button>
                    </div>
                  )}

                  <section className="workspace" aria-labelledby="assignment-title">
                    <aside className="inspector">
                      {/* EN-TÊTE & SÉLECTEUR RAPIDE DE SCÉNARIO */}
                      <div>
                        <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><SlidersHorizontal size={12} aria-hidden="true" /> PANNEAU D'INSPECTION & AJUSTEMENT</span>
                        <div style={{ marginTop: "6px" }}>
                          <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                            Scénario actuellement examiné :
                          </label>
                          <select
                            value={selected.id}
                            onChange={(e) => setSelectedId(e.target.value)}
                            style={{ width: "100%", padding: "8px 20px 8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", fontWeight: 800, fontSize: "0.84rem", color: "var(--text-main)", boxSizing: "border-box" }}
                            title={`Scénario sélectionné : ${selected.id}`}
                          >
                            {scenarios.map((sc, idx) => (
                              <option key={sc.id} value={sc.id}>
                                {idx === 0 ? "Scénario A · 🎯 Équilibre" : idx === 1 ? "Scénario B · 📊 Mixité" : `Scénario ${String.fromCharCode(65 + idx)} · 🤝 PAP`} ({Math.round(sc.metrics.score / 10)}%){sc.state === "APPROVED" ? " ✓" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* ÉTAPE PRINCIPALE : VALIDATION HUMAINE & OFFICIALISATION EN HAUT */}
                      <div style={{ background: selected.state === "APPROVED" ? "var(--card-success-bg)" : "var(--bg-subtle)", border: `1px solid ${selected.state === "APPROVED" ? "var(--card-success-border)" : "var(--border-light)"}`, padding: "14px", borderRadius: "var(--radius-md)" }}>
                        <button
                          className="validate"
                          onClick={validate}
                          disabled={busy || selected.state === "APPROVED"}
                          style={{ width: "100%", padding: "10px 12px", fontSize: "0.88rem", fontWeight: 800, whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.25, textAlign: "center" }}
                        >
                          {selected.state === "APPROVED" ? <><CheckCircle2 size={14} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Scénario Validé & Officialisé</> : <><Lock size={14} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Valider Humainement & Officialiser</>}
                        </button>
                        <p className="hint" style={{ margin: "6px 0 0", textAlign: "center", fontSize: "0.76rem", color: "var(--text-muted)", lineHeight: 1.3 }}>
                          <Scale size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> <strong>Art. 6.1.e RGPD & CNIL</strong> : Décision humaine traçable dans le journal d'audit.
                        </p>
                      </div>

                      {/* INDICATEURS DE CONFORMITÉ & INFOBULLES */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <h4 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 800, color: "var(--text-main)", whiteSpace: "nowrap" }}>
                            <BarChart3 size={14} aria-hidden="true" style={{ marginRight: "5px", verticalAlign: "-2px" }} />Diagnostic de Conformité
                          </h4>
                          <span className="chip" style={{ background: "var(--card-success-bg)", color: "var(--card-success-text)", border: "1px solid var(--card-success-border)", padding: "3px 8px", fontSize: "0.72rem", fontWeight: 800, whiteSpace: "nowrap" }}>
                            <Check size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> Contraintes Dures OK
                          </span>
                        </div>

                        <dl className="metrics">
                          <Metric name="Parité" value={selected.metrics.genderBalance} weight={weights.genderBalance} />
                          <Metric name="Niveaux" value={selected.metrics.academicBalance} weight={weights.academicBalance} />
                          <Metric name="Accompagnements" value={selected.metrics.supportBalance} weight={weights.supportBalance} />
                          <Metric name="Options" value={selected.metrics.optionBalance} weight={weights.optionBalance} />
                        </dl>
                      </div>

                      {/* ASSISTANT DE RÉÉQUILIBRAGE SOUVERAIN MISTRAL AI */}
                      <div style={{ background: "var(--card-highlight-bg)", border: "1px solid var(--card-highlight-border)", padding: "14px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 800, color: "var(--card-highlight-text)", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
                            <Wand2 size={13} aria-hidden="true" /> Assistant Rééquilibrage
                          </span>
                          <span style={{ background: "var(--emerald-accent)", color: "#ffffff", padding: "3px 10px", borderRadius: "12px", fontSize: "0.72rem", fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            🇫🇷 Mistral AI
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.35, fontWeight: 600 }}>
                          Besoin d'ajuster les écarts de niveau ou les PAP ? L'Assistant Mistral AI analyse le scénario et s'appuie sur le solveur algorithmique pour recommander des permutations explicables pas-à-pas.
                        </p>
                        <button
                          className="primary"
                          onClick={() => setShowRebalanceModal(true)}
                          disabled={selected.state === "APPROVED"}
                          style={{ background: "var(--accent-warm)", color: "#ffffff", padding: "10px 12px", fontWeight: 800, fontSize: "0.82rem", borderRadius: "var(--radius-sm)", width: "100%", cursor: "pointer", border: "none", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.25, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                        >
                          <Sparkles size={15} aria-hidden="true" /> Proposer un rééquilibrage pas-à-pas
                        </button>
                      </div>

                      {/* FICHE & TRANSFERT MANUEL D'ÉLÈVE */}
                      <div className="transfer-card">
                        <h4 style={{ margin: "0 0 8px", fontSize: "0.92rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "6px" }}><Pencil size={14} aria-hidden="true" /> Fiche & Transfert d'Élève</h4>

                        <label htmlFor="student" style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                          Examiner un élève de la cohorte :
                        </label>
                        <select
                          id="student"
                          value={selectedStudentId ?? ""}
                          onChange={(event) => setSelectedStudentId(event.target.value || undefined)}
                          disabled={selected.state === "APPROVED"}
                          style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-main)", fontWeight: 700, width: "100%", fontSize: "0.85rem" }}
                        >
                          <option value="">-- Sélectionner un élève --</option>
                          {dataset.students.map((student) => (
                            <option key={student.id} value={student.id}>
                              {nameOf(student, anonymous)} — {dataset.classrooms.find((item) => item.id === selected.assignments[student.id])?.label} ({student.levelAverage.toFixed(1)}/20)
                            </option>
                          ))}
                        </select>

                        {selectedStudent && <Explanation student={selectedStudent} scenario={selected} />}

                        {selectedStudentId && (
                          <div style={{ marginTop: "10px" }}>
                            <span style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "6px", color: "var(--text-muted)" }}>
                              Transférer vers une autre classe :
                            </span>
                            <div className="target-pills-grid">
                              {dataset.classrooms
                                .filter((classroom) => classroom.id !== selected.assignments[selectedStudentId ?? ""])
                                .map((classroom) => {
                                  const currentCount = dataset.students.filter((s) => selected.assignments[s.id] === classroom.id).length;
                                  return (
                                    <button
                                      key={classroom.id}
                                      className="target-pill"
                                      disabled={busy || selected.state === "APPROVED"}
                                      onClick={() => requestMove(selectedStudentId!, classroom.id)}
                                    >
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><ArrowRight size={12} aria-hidden="true" /> {classroom.label}</span>
                                      <small style={{ fontSize: "0.72rem", opacity: 0.8 }}>({currentCount}/{classroom.maxSize} él.)</small>
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>


                    </aside>

                    {/* BARRE DE SAUT RAPIDE SUR MOBILE */}
                    <div className="mobile-class-tabs">
                      {studentsByClass.map((c) => (
                        <button
                          key={c.id}
                          className="mobile-class-tab-btn"
                          onClick={() => {
                            const el = document.getElementById(`class-col-${c.id}`);
                            el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                          }}
                        >
                          {c.label} ({c.students.length})
                        </button>
                      ))}
                    </div>

                    {/* KANBAN DES CLASSES AVEC DRAG & DROP & SCEAU D'ÉQUILIBRAGE */}
                    <div className="board class-columns-grid" aria-label="Répartition des élèves par classe">
                      {studentsByClass.map((classroom) => {
                        const countF = classroom.students.filter((s) => s.gender === "F").length;
                        const countM = classroom.students.filter((s) => s.gender === "M").length;
                        const totalCount = classroom.students.length;
                        const pctF = totalCount > 0 ? (countF / totalCount) * 100 : 50;
                        const pctM = 100 - pctF;
                        const avg = totalCount > 0 ? (classroom.students.reduce((sum, s) => sum + s.levelAverage, 0) / totalCount).toFixed(1) : "0.0";
                        const supportCount = classroom.students.filter((s) => s.supportFlags.length > 0).length;

                        // Diagnostic explicite des motifs lorsque la classe est marquée "À AJUSTER"
                        const adjustReasons: string[] = [];
                        if (totalCount < classroom.minSize) {
                          adjustReasons.push(`Sous-effectif (${totalCount} < ${classroom.minSize} min)`);
                        }
                        if (totalCount > classroom.maxSize) {
                          adjustReasons.push(`Sur-effectif (${totalCount} > ${classroom.maxSize} max)`);
                        }
                        if (Math.abs(countF - countM) > 4) {
                          adjustReasons.push(`Déséquilibre F/G (${countF} F / ${countM} G)`);
                        }
                        if (supportCount > 7) {
                          adjustReasons.push(`Forte concentration d'accompagnements (${supportCount} PAP/PPS)`);
                        }

                        const isBalanced = adjustReasons.length === 0;
                        const reasonText = isBalanced ? "Classe parfaitement équilibrée" : adjustReasons.join(" • ");
                        const otherClasses = dataset.classrooms.filter((c) => c.id !== classroom.id);

                        return (
                          <section
                            id={`class-col-${classroom.id}`}
                            className={`class-column classroom-column ${dragOverClassId === classroom.id ? "drag-over" : ""}`}
                            key={classroom.id}
                            aria-labelledby={`title-${classroom.id}`}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOverClassId(classroom.id);
                            }}
                            onDragLeave={() => setDragOverClassId(null)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverClassId(null);
                              if (draggedStudentId && selected.assignments[draggedStudentId] !== classroom.id) {
                                requestMove(draggedStudentId, classroom.id);
                              }
                            }}
                          >
                            <header style={{ background: "var(--bg-card)", padding: "14px 16px", borderRadius: "var(--radius-md) var(--radius-md) 0 0", borderBottom: "1px solid var(--border-light)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h3 id={`title-${classroom.id}`} style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: "1.1rem", fontWeight: 800 }}>{classroom.label}</h3>
                                <span style={{ fontWeight: 800, fontFamily: "var(--font-mono)", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                                  {totalCount}/{classroom.maxSize}
                                </span>
                              </div>

                              {/* Pastille de Statut Pill (Sous-effectif - X manquants / Effectif conforme / Sur-effectif) */}
                              <div style={{ marginTop: "8px" }}>
                                {totalCount < classroom.minSize ? (
                                  <span style={{ background: "var(--card-warning-bg)", color: "var(--card-warning-text)", border: "1px solid var(--card-warning-border)", padding: "3px 10px", borderRadius: "20px", fontSize: "0.76rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                    <TriangleAlert size={12} aria-hidden="true" /> Sous-effectif · {classroom.minSize - totalCount} manquant{classroom.minSize - totalCount > 1 ? "s" : ""}
                                  </span>
                                ) : totalCount > classroom.maxSize ? (
                                  <span style={{ background: "var(--card-purple-bg)", color: "var(--card-purple-text)", border: "1px solid var(--card-purple-border)", padding: "3px 10px", borderRadius: "20px", fontSize: "0.76rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                    <OctagonAlert size={12} aria-hidden="true" /> Sur-effectif · {totalCount - classroom.maxSize} en trop
                                  </span>
                                ) : (
                                  <span style={{ background: "var(--card-success-bg)", color: "var(--card-success-text)", border: "1px solid var(--card-success-border)", padding: "3px 10px", borderRadius: "20px", fontSize: "0.76rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                    <CheckCircle2 size={12} aria-hidden="true" /> Effectif conforme
                                  </span>
                                )}
                              </div>

                              {/* Jauge d'Effectif Graphique (min 17 - cible 24 - max 24) */}
                              <div style={{ marginTop: "10px" }}>
                                <div style={{ height: "6px", background: "var(--bg-subtle)", borderRadius: "3px", overflow: "hidden", position: "relative", border: "1px solid var(--border-light)" }}>
                                  <div
                                    style={{
                                      height: "100%",
                                      width: `${Math.min(100, (totalCount / classroom.maxSize) * 100)}%`,
                                      background: totalCount < classroom.minSize ? "var(--amber-accent)" : totalCount > classroom.maxSize ? "var(--rose-accent)" : "var(--emerald-accent)",
                                      borderRadius: "3px",
                                      transition: "width 0.3s ease",
                                    }}
                                  />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700, marginTop: "4px" }}>
                                  <span>min {classroom.minSize}</span>
                                  <span>cible {Math.round(dataset.students.length / Math.max(1, dataset.classrooms.length))}</span>
                                  <span>max {classroom.maxSize}</span>
                                </div>
                              </div>

                              {/* Ligne de Synthèse : ⚖️ Parité | ∅ Moyenne | ✦ Accompagnements & Besoins */}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, marginTop: "8px", paddingTop: "8px", borderTop: "1px solid var(--border-light)", whiteSpace: "nowrap" }}>
                                <span className="ui-tooltip" data-tooltip={`Parité filles / garçons : ${countF} Filles et ${countM} Garçons`} style={{ whiteSpace: "nowrap", cursor: "help" }}>
                                  <Scale size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> <strong>{countF}F</strong>/<strong>{countM}G</strong>
                                </span>
                                <span className="ui-tooltip" data-tooltip={`Moyenne générale calculée pour ${classroom.label} : ${avg} / 20`} style={{ whiteSpace: "nowrap", cursor: "help" }}>
                                  ∅ <strong style={{ color: "var(--primary-brand)", fontFamily: "var(--font-mono)" }}>{avg}/20</strong>
                                </span>
                                <button
                                  className={`ui-tooltip ui-tooltip-align-right ${openSupportModalClassId === classroom.id ? "active" : ""}`}
                                  data-tooltip="Cliquez pour afficher le détail des accompagnements (PAP, PPS, PAI...) de la classe"
                                  style={{
                                    background: openSupportModalClassId === classroom.id ? "var(--primary-brand)" : "transparent",
                                    color: openSupportModalClassId === classroom.id ? "#ffffff" : "var(--text-muted)",
                                    border: "1px solid var(--border-light)",
                                    borderRadius: "var(--radius-sm)",
                                    padding: "2px 6px",
                                    fontSize: "0.72rem",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                    transition: "var(--transition-fast)",
                                  }}
                                  onClick={() => setOpenSupportModalClassId(openSupportModalClassId === classroom.id ? null : classroom.id)}
                                >
                                  <HeartHandshake size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> <strong>{supportCount}</strong> besoins <Info size={10} aria-hidden="true" style={{ verticalAlign: "-1px" }} />
                                </button>
                              </div>

                              {/* Popover Informatif Interactif des Accompagnements */}
                              {openSupportModalClassId === classroom.id && (
                                <div
                                  style={{
                                    marginTop: "10px",
                                    padding: "12px",
                                    background: "var(--bg-subtle)",
                                    border: "1px solid var(--border-light)",
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: "0.78rem",
                                    color: "var(--text-main)",
                                    boxShadow: "var(--shadow-md)",
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", fontWeight: 800 }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><ClipboardList size={13} aria-hidden="true" /> Aménagements ({classroom.label})</span>
                                    <button
                                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", alignItems: "center" }}
                                      onClick={() => setOpenSupportModalClassId(null)}
                                    >
                                      <X size={14} aria-hidden="true" />
                                    </button>
                                  </div>

                                  {supportCount === 0 && classroom.students.every((s) => s.options.length === 0) ? (
                                    <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>Aucun aménagement particulier dans cette classe.</div>
                                  ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflowY: "auto" }}>
                                      {classroom.students.filter((s) => s.supportFlags.length > 0 || s.options.length > 0).map((s) => (
                                        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", fontSize: "0.74rem" }}>
                                          <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameOf(s, anonymous)}</span>
                                          <div style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
                                            {s.supportFlags.map((f) => (
                                              <span key={f} title={SUPPORT_FLAG_TITLES[f] || f} style={{ background: "var(--badge-need-bg)", color: "var(--badge-need-text)", border: "1px solid var(--badge-need-border)", padding: "1px 5px", borderRadius: "8px", fontSize: "0.66rem", fontWeight: 800 }}>
                                                {f}
                                              </span>
                                            ))}
                                            {s.options.map((o) => (
                                              <span key={o} title={OPTION_TITLES[o] || o} style={{ background: "var(--badge-option-bg)", color: "var(--badge-option-text)", border: "1px solid var(--badge-option-border)", padding: "1px 5px", borderRadius: "8px", fontSize: "0.66rem", fontWeight: 800 }}>
                                                {o}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </header>

                            <div className="student-list">
                              {classroom.students.map((student) => (
                                <div
                                  key={student.id}
                                  draggable={selected.state !== "APPROVED"}
                                  onDragStart={() => setDraggedStudentId(student.id)}
                                  onDragEnd={() => setDraggedStudentId(null)}
                                  className={`student-card ${selectedStudentId === student.id ? "active" : ""}`}
                                  onClick={() => setSelectedStudentId(student.id)}
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "6px",
                                    padding: "10px 12px",
                                    background: "var(--bg-card)",
                                    border: "1px solid var(--border-light)",
                                    borderRadius: "var(--radius-md)",
                                    boxShadow: "var(--shadow-sm)",
                                  }}
                                >
                                  {/* Ligne 1 : Poignée, Avatar, Nom + Note côte-à-côte & Boutons d'Action */}
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", width: "100%" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flex: 1 }}>
                                      <span className="drag-handle" style={{ color: "var(--text-light)", cursor: "grab", fontSize: "0.85rem", flexShrink: 0 }} title="Glisser-déposer">::</span>

                                      <div
                                        className="ui-tooltip"
                                        data-tooltip="Identifiant visuel unique attribué à l'élève pour le repérage"
                                        style={{
                                          width: "28px",
                                          height: "28px",
                                          borderRadius: "8px",
                                          background: getAvatarColor(student.id),
                                          color: "#ffffff",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontWeight: 800,
                                          fontSize: "0.74rem",
                                          flexShrink: 0,
                                          cursor: "help",
                                        }}
                                        title={anonymous ? `Identifiant visuel unique (${student.initials})` : `Identifiant visuel unique (${student.displayName})`}
                                      >
                                        {anonymous ? <Lock size={12} aria-hidden="true" /> : <User size={13} aria-hidden="true" />}
                                      </div>

                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", minWidth: 0, flex: 1 }}>
                                        <span
                                          style={{ fontWeight: 700, fontSize: "0.83rem", color: "var(--text-main)", lineHeight: 1.2, wordBreak: "break-word", flexShrink: 1 }}
                                          title={nameOf(student, anonymous)}
                                        >
                                          {nameOf(student, anonymous)}
                                        </span>
                                        <span
                                          className="ui-tooltip"
                                          data-tooltip={`Moyenne générale de ${nameOf(student, anonymous)} : ${student.levelAverage.toFixed(1)}/20`}
                                          style={{
                                            background: "var(--bg-subtle)",
                                            border: "1px solid var(--border-light)",
                                            padding: "2px 7px",
                                            borderRadius: "12px",
                                            fontSize: "0.76rem",
                                            fontWeight: 800,
                                            color: "var(--text-main)",
                                            fontFamily: "var(--font-mono)",
                                            whiteSpace: "nowrap",
                                            flexShrink: 0,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "1.5px",
                                            boxShadow: "var(--shadow-sm)",
                                            cursor: "help"
                                          }}
                                        >
                                          <span>{student.levelAverage.toFixed(1)}</span>
                                          <span style={{ color: "var(--text-light)", fontSize: "0.68rem", fontWeight: 500 }}>/20</span>
                                        </span>
                                      </div>
                                    </div>

                                    {/* Actions : Fiche & Déplacer */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                                      <button
                                        className="icon-btn-subtle ui-tooltip ui-tooltip-align-right"
                                        data-tooltip="Consulter le dossier pédagogique"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setInspectStudent(student);
                                        }}
                                        style={{ padding: "3px 6px", borderRadius: "var(--radius-sm)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                      >
                                        <FolderOpen size={13} aria-hidden="true" />
                                      </button>

                                      {selected.state !== "APPROVED" && (
                                        <select
                                          className="compact-move-select ui-tooltip ui-tooltip-align-right"
                                          data-tooltip="Transférer vers une autre classe"
                                          value=""
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            if (e.target.value) requestMove(student.id, e.target.value);
                                          }}
                                          title="Transférer vers une autre classe"
                                        >
                                          <option value="" disabled>⇄</option>
                                          {otherClasses.map((targetC) => (
                                            <option key={targetC.id} value={targetC.id}>
                                              {targetC.label}
                                            </option>
                                          ))}
                                        </select>
                                      )}
                                    </div>
                                  </div>
                                  {/* Ligne 2 : Badges d'accompagnement, d'incompatibilité et d'options sous le nom */}
                                  {(student.supportFlags.length > 0 || student.options.length > 0 || student.coLocateGroupId || student.conflictsWith.length > 0) && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", paddingLeft: "36px" }}>
                                      {classroom.students.some((m) => m.id !== student.id && student.conflictsWith.includes(m.id)) && (
                                        <span
                                          title="⚠️ Incompatibilité forcée dans cette classe (regroupement d'option strict ou capacité)"
                                          style={{
                                            background: "var(--card-warning-bg)",
                                            color: "var(--card-warning-text)",
                                            border: "1px solid var(--card-warning-border)",
                                            padding: "1px 6px",
                                            borderRadius: "10px",
                                            fontSize: "0.68rem",
                                            fontWeight: 800,
                                            lineHeight: 1.2,
                                            cursor: "help",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "3px",
                                          }}
                                        >
                                          <TriangleAlert size={10} aria-hidden="true" /> Incompatibilité
                                        </span>
                                      )}
                                      {student.coLocateGroupId && (
                                        <span
                                          title="🤝 Binôme d'amitié ou regroupement d'accompagnement AESH conservé"
                                          style={{
                                            background: "var(--card-success-bg)",
                                            color: "var(--card-success-text)",
                                            border: "1px solid var(--card-success-border)",
                                            padding: "1px 6px",
                                            borderRadius: "10px",
                                            fontSize: "0.68rem",
                                            fontWeight: 800,
                                            lineHeight: 1.2,
                                            cursor: "help",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "3px",
                                          }}
                                        >
                                          <HeartHandshake size={10} aria-hidden="true" /> Binôme
                                        </span>
                                      )}
                                      {student.supportFlags.map((flag) => (
                                        <span
                                          key={flag}
                                          title={SUPPORT_FLAG_TITLES[flag] || `Dispositif d'accompagnement : ${flag}`}
                                          style={{
                                            background: "var(--badge-need-bg)",
                                            color: "var(--badge-need-text)",
                                            border: "1px solid var(--badge-need-border)",
                                            padding: "1px 6px",
                                            borderRadius: "10px",
                                            fontSize: "0.68rem",
                                            fontWeight: 800,
                                            lineHeight: 1.2,
                                            cursor: "pointer",
                                          }}
                                        >
                                          {flag}
                                        </span>
                                      ))}
                                      {student.options.map((opt) => (
                                        <span
                                          key={opt}
                                          title={OPTION_TITLES[opt] || `Option linguistique ou artistique : ${opt}`}
                                          style={{
                                            background: "var(--card-purple-bg)",
                                            color: "var(--card-purple-text)",
                                            padding: "1px 6px",
                                            borderRadius: "10px",
                                            fontSize: "0.68rem",
                                            fontWeight: 800,
                                            lineHeight: 1.2,
                                            cursor: "help",
                                          }}
                                        >
                                          {opt}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </section>
                </>
              )}
            </>
  );
}
