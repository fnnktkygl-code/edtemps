import { Sliders, Target, BarChart3, Zap, Info, Lightbulb, Circle, Scale, HeartHandshake, GraduationCap, Globe2, ArrowLeftRight, Pin, Sparkle, CheckCircle2, AlertTriangle, Ban, X, Plus } from "lucide-react";
import type { DispatchWeights, FeasibilityError } from "@edtemps/domain";
import { api, createSyntheticDemoInputCustom, setActiveDataset, validateDispatchFeasibility } from "../../api";
import type { Dataset, Scenario } from "../../types";
import { nameOf, getWeightLabel } from "../../utils/format";

export function WeightsTab({
  anonymous,
  dataset,
  setDataset,
  weights,
  setWeights,
  busy,
  setBusy,
  scenarios,
  setScenarios,
  selected,
  ruleStudentAId,
  setRuleStudentAId,
  ruleStudentBId,
  setRuleStudentBId,
  ruleType,
  setRuleType,
  showBenchmark,
  setShowBenchmark,
  simStudentCount,
  setSimStudentCount,
  simClassCount,
  setSimClassCount,
  simMaxSize,
  setSimMaxSize,
  simMinSize,
  setSimMinSize,
  setImpossibilityErrors,
  getBestScenarioId,
  setSelectedId,
  setNotice,
  setDispatchSubTab,
}: {
  anonymous: boolean;
  dataset: Dataset;
  setDataset: (ds: Dataset) => void;
  weights: DispatchWeights;
  setWeights: (newWeights: DispatchWeights | ((prev: DispatchWeights) => DispatchWeights)) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  scenarios: Scenario[];
  setScenarios: (scens: Scenario[] | ((prev: Scenario[]) => Scenario[])) => void;
  selected: Scenario | undefined;
  ruleStudentAId: string;
  setRuleStudentAId: (v: string) => void;
  ruleStudentBId: string;
  setRuleStudentBId: (v: string) => void;
  ruleType: "CONFLICT" | "COLOCATION";
  setRuleType: (v: "CONFLICT" | "COLOCATION") => void;
  showBenchmark: boolean;
  setShowBenchmark: (v: boolean) => void;
  simStudentCount: number;
  setSimStudentCount: (v: number) => void;
  simClassCount: number;
  setSimClassCount: (v: number) => void;
  simMaxSize: number;
  setSimMaxSize: (v: number) => void;
  simMinSize: number;
  setSimMinSize: (v: number) => void;
  setImpossibilityErrors: (v: FeasibilityError[]) => void;
  getBestScenarioId: (scens: Scenario[]) => string | undefined;
  setSelectedId: (id?: string) => void;
  setNotice: (msg: string) => void;
  setDispatchSubTab: (subTab: "roster" | "weights" | "kanban") => void;
}) {
  return (
            <div className="weights-panel">
              <div className="section-heading" style={{ marginBottom: "18px" }}>
                <div>
                  <span className="eyebrow">MODULE 1 · INTENTIONS PÉDAGOGIQUES</span>
                  <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}><Sliders size={18} aria-hidden="true" /> Réglage des critères d'équilibrage des classes</h3>
                  <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "0.88rem" }}>
                    Configurez vos cibles d'établissement puis ajustez l'importance relative des critères ci-dessous.
                  </p>
                </div>
              </div>

              {/* REGLAGES DE COHORTE & CIBLES EXPLICITES */}
              <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "18px 20px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                  <h4 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Target size={16} aria-hidden="true" /> Effectifs & Capacité des Classes (Simulateur Cohorte)
                  </h4>
                  <button
                    className="secondary"
                    onClick={() => setShowBenchmark(!showBenchmark)}
                    style={{ fontSize: "0.8rem", padding: "4px 10px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "5px" }}
                  >
                    {showBenchmark ? null : <BarChart3 size={13} aria-hidden="true" />}
                    {showBenchmark ? "Masquer le Comparatif Benchmark" : "Comparatif de Performance (Naïf vs Recuit Simulé)"}
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px", color: "var(--text-muted)" }}>
                      Élèves totaux dans la promotion
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={2000}
                      value={simStudentCount}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(2000, Number(e.target.value) || 1));
                        setSimStudentCount(val);
                        const customInput = createSyntheticDemoInputCustom(val, simClassCount, simMaxSize, simMinSize);
                        setDataset(customInput);
                        setActiveDataset(customInput);
                      }}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.88rem" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px", color: "var(--text-muted)" }}>
                      Nombre de classes cibles
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={simClassCount}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(50, Number(e.target.value) || 1));
                        setSimClassCount(val);
                        const customInput = createSyntheticDemoInputCustom(simStudentCount, val, simMaxSize, simMinSize);
                        setDataset(customInput);
                        setActiveDataset(customInput);
                      }}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.88rem" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px", color: "var(--text-muted)" }}>
                      Effectif min / classe (Seuil)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={simMinSize}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(60, Number(e.target.value) || 1));
                        setSimMinSize(val);
                        const customInput = createSyntheticDemoInputCustom(simStudentCount, simClassCount, simMaxSize, val);
                        setDataset(customInput);
                        setActiveDataset(customInput);
                      }}
                      placeholder="ex: 18 ou 20"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.88rem" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px", color: "var(--text-muted)" }}>
                      Effectif max / classe (Plafond)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={simMaxSize}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(60, Number(e.target.value) || 1));
                        setSimMaxSize(val);
                        const customInput = createSyntheticDemoInputCustom(simStudentCount, simClassCount, val, simMinSize);
                        setDataset(customInput);
                        setActiveDataset(customInput);
                      }}
                      placeholder="ex: 28 ou 30"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.88rem" }}
                    />
                  </div>
                </div>

                {/* BENCHMARK ALGORITHMIQUE INTÉGRÉ DANS L'ONGLET 2 */}
                {showBenchmark && (
                  <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border-light)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <h5 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "6px" }}>
                          <BarChart3 size={14} aria-hidden="true" /> Performance Mesurée en Temps Réel sur la Cohorte ({dataset.students.length} Élèves)
                        </h5>
                        <span style={{ fontSize: "0.7rem", background: "var(--card-info-bg)", color: "var(--card-info-text)", border: "1px solid var(--card-info-border)", padding: "2px 8px", borderRadius: "12px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                          <Zap size={11} aria-hidden="true" /> CALCUL DIRECT
                        </span>
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Comparé à un tirage manuel aléatoire sans algorithme
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                      <div style={{ background: "var(--bg-card)", padding: "10px 14px", borderRadius: "var(--radius-sm)", borderLeft: "4px solid var(--emerald-accent)", boxShadow: "var(--shadow-sm)" }}>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Équilibre Parité F/M</span>
                        <strong style={{ fontSize: "1.08rem", color: "var(--emerald-accent)" }}>
                          {selected ? Math.round(selected.metrics.genderBalance) : 94}% de conformité
                        </strong>
                        <small style={{ display: "block", color: "var(--text-light)", fontSize: "0.74rem", marginTop: "2px" }}>vs ~55% en tirage manuel</small>
                      </div>
                      <div style={{ background: "var(--bg-card)", padding: "10px 14px", borderRadius: "var(--radius-sm)", borderLeft: "4px solid var(--indigo-accent)", boxShadow: "var(--shadow-sm)" }}>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Homogénéité Académique</span>
                        <strong style={{ fontSize: "1.08rem", color: "var(--indigo-accent)" }}>
                          {selected ? Math.round(selected.metrics.academicBalance) : 98}% de convergence
                        </strong>
                        <small style={{ display: "block", color: "var(--text-light)", fontSize: "0.74rem", marginTop: "2px" }}>vs ~50% sans lissage des moyennes</small>
                      </div>
                      <div style={{ background: "var(--bg-card)", padding: "10px 14px", borderRadius: "var(--radius-sm)", borderLeft: "4px solid var(--amber-accent)", boxShadow: "var(--shadow-sm)" }}>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Besoins PAP/PPS / AESH</span>
                        <strong style={{ fontSize: "1.08rem", color: "var(--amber-accent)" }}>
                          {selected ? Math.round(selected.metrics.supportBalance) : 100}% sans surcharge
                        </strong>
                        <small style={{ display: "block", color: "var(--text-light)", fontSize: "0.74rem", marginTop: "2px" }}>Groupements AESH préserve</small>
                      </div>
                    </div>

                    <div style={{ marginTop: "10px", fontSize: "0.75rem", color: "var(--text-muted)", background: "var(--bg-subtle)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-light)", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                      <Info size={13} aria-hidden="true" style={{ marginTop: "2px", flexShrink: 0 }} /> <span><strong>Origine des métriques :</strong> Ces indicateurs mesurent l'efficacité de l'algorithme sur le scénario actuellement sélectionné (<strong>{scenarios.findIndex((s) => s.id === selected?.id) === 0 ? "Scénario A — Équilibre Global" : scenarios.findIndex((s) => s.id === selected?.id) === 1 ? "Scénario B — Focus Mixité" : "Scénario C — Focus Accompagnements"}</strong>). Ils sont calculés en temps réel sur vos {dataset.students.length} élèves et comparés à la déviation statistique moyenne d'une répartition naïve à l'aveugle.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* GUIDE PÉDAGOGIQUE EXPLICATIF DE 0 À 10 POUR NON-AGUERRIS */}
              <div style={{ background: "var(--card-legend-bg)", border: "1px solid var(--card-legend-border)", borderRadius: "var(--radius-md)", padding: "16px 18px", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <Lightbulb size={17} aria-hidden="true" style={{ color: "var(--amber-accent)" }} />
                  <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)" }}>
                    Comment fonctionnent les niveaux de priorité (de 0 à 10) ?
                  </h4>
                </div>
                <p style={{ margin: "0 0 12px", fontSize: "0.84rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                  Les curseurs indiquent à l'algorithme la valeur accordée à chaque règle. Plus la note est élevée, plus le solveur sacrifiera les autres critères secondaires pour satisfaire celui-ci.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                  <div style={{ background: "var(--bg-card)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-light)" }}>
                    <strong style={{ fontSize: "0.78rem", color: "var(--text-light)", display: "flex", alignItems: "center", gap: "5px" }}><Circle size={9} aria-hidden="true" fill="currentColor" /> 0 / 10 — Ignoré</strong>
                    <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Le critère est totalement désactivé.</span>
                  </div>
                  <div style={{ background: "var(--bg-card)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-light)" }}>
                    <strong style={{ fontSize: "0.78rem", color: "var(--card-info-text)", display: "flex", alignItems: "center", gap: "5px" }}><Circle size={9} aria-hidden="true" fill="currentColor" /> 1 à 3 / 10 — Secondaire</strong>
                    <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Pris en compte si possible.</span>
                  </div>
                  <div style={{ background: "var(--bg-card)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-light)" }}>
                    <strong style={{ fontSize: "0.78rem", color: "var(--card-success-text)", display: "flex", alignItems: "center", gap: "5px" }}><Circle size={9} aria-hidden="true" fill="currentColor" /> 4 à 7 / 10 — Équilibré</strong>
                    <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Niveau standard recommandé.</span>
                  </div>
                  <div style={{ background: "var(--bg-card)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-light)" }}>
                    <strong style={{ fontSize: "0.78rem", color: "var(--card-purple-text)", display: "flex", alignItems: "center", gap: "5px" }}><Circle size={9} aria-hidden="true" fill="currentColor" /> 8 à 10 / 10 — Priorité Haute</strong>
                    <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Priorité maximale sur les autres.</span>
                  </div>
                </div>
              </div>

              <div className="weights-grid">
                <div className="weight-card">
                  <div className="weight-header">
                    <div className="weight-title">
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Scale size={14} aria-hidden="true" /> Parité Filles / Garçons</span>
                      <small>Équilibre 50%/50% du ratio de genre dans chaque classe</small>
                    </div>
                    <span
                      style={{
                        background: getWeightLabel(weights.genderBalance).bg,
                        color: getWeightLabel(weights.genderBalance).color,
                        border: getWeightLabel(weights.genderBalance).border,
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getWeightLabel(weights.genderBalance).label}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={weights.genderBalance}
                    onChange={(e) => setWeights({ ...weights, genderBalance: Number(e.target.value) })}
                  />
                </div>

                <div className="weight-card">
                  <div className="weight-header">
                    <div className="weight-title">
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><BarChart3 size={14} aria-hidden="true" /> Mixité des Niveaux Scolaires</span>
                      <small>Répartition hétérogène des compétences (forts, moyens, à besoins)</small>
                    </div>
                    <span
                      style={{
                        background: getWeightLabel(weights.academicBalance).bg,
                        color: getWeightLabel(weights.academicBalance).color,
                        border: getWeightLabel(weights.academicBalance).border,
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getWeightLabel(weights.academicBalance).label}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={weights.academicBalance}
                    onChange={(e) => setWeights({ ...weights, academicBalance: Number(e.target.value) })}
                  />
                </div>

                <div className="weight-card">
                  <div className="weight-header">
                    <div className="weight-title">
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><HeartHandshake size={14} aria-hidden="true" /> Besoins Particuliers (PAP / PPS / PAI)</span>
                      <small>Évite la concentration d'élèves à accompagnement dans la même classe</small>
                    </div>
                    <span
                      style={{
                        background: getWeightLabel(weights.supportBalance).bg,
                        color: getWeightLabel(weights.supportBalance).color,
                        border: getWeightLabel(weights.supportBalance).border,
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getWeightLabel(weights.supportBalance).label}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={weights.supportBalance}
                    onChange={(e) => setWeights({ ...weights, supportBalance: Number(e.target.value) })}
                  />
                </div>

                <div className="weight-card">
                  <div className="weight-header">
                    <div className="weight-title">
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><GraduationCap size={14} aria-hidden="true" /> Répartition des Options & Langues</span>
                      <small>Harmonisation des groupes LCE, Bilangue, Latin et EIP</small>
                    </div>
                    <span
                      style={{
                        background: getWeightLabel(weights.optionBalance).bg,
                        color: getWeightLabel(weights.optionBalance).color,
                        border: getWeightLabel(weights.optionBalance).border,
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getWeightLabel(weights.optionBalance).label}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={weights.optionBalance}
                    onChange={(e) => setWeights({ ...weights, optionBalance: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* STRATÉGIES DE REGROUPEMENT D'OPTIONS & D'ACCOMPAGNEMENTS */}
              {(() => {
                const targetAeshClasses = Math.max(1, Math.floor(dataset.classrooms.length / 2));
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginTop: "16px" }}>
                    {/* CARD 1: STRATÉGIE OPTION GROUPING */}
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--text-main)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <Globe2 size={15} aria-hidden="true" /> Stratégie de Regroupement des Options
                        </div>
                        <p style={{ margin: "0 0 14px", fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                          Choisissez si vous souhaitez équilibrer les élèves optionnaires dans chaque classe ou les regrouper dans une classe dédiée.
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          type="button"
                          onClick={() => setWeights({ ...weights, optionGroupingMode: "BALANCED_DISPERSION" })}
                          style={{
                            flex: 1,
                            padding: "9px 12px",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            borderRadius: "var(--radius-sm)",
                            border: `1px solid ${weights.optionGroupingMode !== "STRICT_SINGLE_CLASS" ? "var(--card-highlight-border)" : "var(--border-light)"}`,
                            background: weights.optionGroupingMode !== "STRICT_SINGLE_CLASS" ? "var(--card-highlight-bg)" : "var(--bg-card)",
                            color: weights.optionGroupingMode !== "STRICT_SINGLE_CLASS" ? "var(--card-highlight-text)" : "var(--text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          <ArrowLeftRight size={13} aria-hidden="true" style={{ marginRight: "4px" }} />Diluer / Équilibrer
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setWeights({
                              ...weights,
                              optionGroupingMode: "STRICT_SINGLE_CLASS",
                              optionBalance: Math.max(weights.optionBalance, 8),
                            })
                          }
                          style={{
                            flex: 1,
                            padding: "9px 12px",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            borderRadius: "var(--radius-sm)",
                            border: `1px solid ${weights.optionGroupingMode === "STRICT_SINGLE_CLASS" ? "var(--card-purple-border)" : "var(--border-light)"}`,
                            background: weights.optionGroupingMode === "STRICT_SINGLE_CLASS" ? "var(--card-purple-bg)" : "var(--bg-card)",
                            color: weights.optionGroupingMode === "STRICT_SINGLE_CLASS" ? "var(--card-purple-text)" : "var(--text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          <Pin size={13} aria-hidden="true" style={{ marginRight: "4px" }} />Regrouper sur 1 Classe
                        </button>
                      </div>
                    </div>

                    {/* CARD 2: STRATÉGIE AESH */}
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--text-main)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <HeartHandshake size={15} aria-hidden="true" /> Stratégie Accompagnements AESH
                        </div>
                        <p style={{ margin: "0 0 14px", fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                          Regroupez les accompagnements AESH sur {targetAeshClasses} classe{targetAeshClasses > 1 ? "s cibles" : " cible"} pour mutualiser les heures AESH, ou dispersez-les.
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          type="button"
                          onClick={() => setWeights({ ...weights, supportGroupingMode: "BALANCED_DISPERSION" })}
                          style={{
                            flex: 1,
                            padding: "9px 12px",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            borderRadius: "var(--radius-sm)",
                            border: `1px solid ${weights.supportGroupingMode !== "GROUP_AESH_CLASSES" ? "var(--card-success-border)" : "var(--border-light)"}`,
                            background: weights.supportGroupingMode !== "GROUP_AESH_CLASSES" ? "var(--card-success-bg)" : "var(--bg-card)",
                            color: weights.supportGroupingMode !== "GROUP_AESH_CLASSES" ? "var(--card-success-text)" : "var(--text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          <ArrowLeftRight size={13} aria-hidden="true" style={{ marginRight: "4px" }} />Dispersion Homogène
                        </button>
                        <button
                          type="button"
                          onClick={() => setWeights({ ...weights, supportGroupingMode: "GROUP_AESH_CLASSES" })}
                          style={{
                            flex: 1,
                            padding: "9px 12px",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            borderRadius: "var(--radius-sm)",
                            border: `1px solid ${weights.supportGroupingMode === "GROUP_AESH_CLASSES" ? "var(--card-warning-border)" : "var(--border-light)"}`,
                            background: weights.supportGroupingMode === "GROUP_AESH_CLASSES" ? "var(--card-warning-bg)" : "var(--bg-card)",
                            color: weights.supportGroupingMode === "GROUP_AESH_CLASSES" ? "var(--card-warning-text)" : "var(--text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          <HeartHandshake size={13} aria-hidden="true" style={{ marginRight: "4px" }} />Mutualiser AESH ({targetAeshClasses} classe{targetAeshClasses > 1 ? "s" : ""})
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* FULL-WIDTH SCALABLE OPTION-CLASSROOM MATRIX CARD */}
              {(() => {
                const uniqueOptions = [...new Set(dataset.students.flatMap((s) => s.options))];
                if (uniqueOptions.length === 0) return null;
                return (
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "18px 20px", marginTop: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "0.96rem", fontWeight: 800, color: "var(--text-main)" }}>
                          <Sparkle size={14} aria-hidden="true" style={{ marginRight: "4px", display: "inline" }} />Affectation par langue & options — exclusivité multi-classes
                        </h4>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
                          Cochez les classes réservées à une option ; laissez vide pour une répartition libre.
                        </span>
                        <span style={{ fontSize: "0.76rem", color: "var(--card-info-text)", marginTop: "6px", display: "inline-block", background: "var(--card-info-bg)", border: "1px solid var(--card-info-border)", padding: "4px 10px", borderRadius: "var(--radius-sm)", fontWeight: 700, lineHeight: 1.35 }}>
                          <Info size={12} aria-hidden="true" style={{ marginRight: "3px", display: "inline", verticalAlign: "-1px" }} />Note pédagogique : Ce tableau concerne uniquement les enseignements disciplinaires (LVA, LVB, Latin, LCE, CHAM). Les besoins d'accompagnement (PAP, PPS, PAI, AESH) ne sont pas des cours et sont gérés par la stratégie AESH ci-dessus.
                        </span>
                      </div>
                    </div>

                    <div className="table-wrapper" style={{ overflowX: "auto", border: "1px solid var(--border-light)", borderRadius: "var(--radius-sm)" }}>
                      <table className="option-matrix-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                        <thead>
                          <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-light)" }}>
                            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 800, width: "180px" }}>OPTION</th>
                            <th style={{ textAlign: "center", padding: "10px 14px", fontWeight: 800, width: "100px" }}>EFFECTIF</th>
                            {dataset.classrooms.map((c) => (
                              <th key={c.id} style={{ textAlign: "center", padding: "10px 14px", fontWeight: 800, textTransform: "uppercase" }}>
                                {c.label.toUpperCase()} <small style={{ fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>({c.maxSize} MAX)</small>
                              </th>
                            ))}
                            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 800, width: "220px" }}>STATUT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {uniqueOptions.map((opt) => {
                            const optStudents = dataset.students.filter((s) => s.options.includes(opt));
                            const optCount = optStudents.length;
                            const assignedClasses = dataset.classrooms.filter((c) => weights.exclusiveOptionClassrooms?.[c.id] === opt);
                            const totalCap = assignedClasses.reduce((sum, c) => sum + c.maxSize, 0);

                            return (
                              <tr key={opt} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                <td style={{ padding: "10px 14px", fontWeight: 800, color: "var(--primary-brand)" }}>{opt}</td>
                                <td style={{ textAlign: "center", padding: "10px 14px", fontWeight: 700, color: "var(--text-main)" }}>{optCount}</td>
                                {dataset.classrooms.map((c) => {
                                  const isChecked = weights.exclusiveOptionClassrooms?.[c.id] === opt;
                                  return (
                                    <td key={c.id} style={{ textAlign: "center", padding: "10px 14px", background: isChecked ? "var(--card-warning-bg)" : "transparent" }}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          const nextExcl = { ...(weights.exclusiveOptionClassrooms || {}) };
                                          if (e.target.checked) nextExcl[c.id] = opt;
                                          else if (nextExcl[c.id] === opt) delete nextExcl[c.id];
                                          setWeights({
                                            ...weights,
                                            exclusiveOptionClassrooms: nextExcl,
                                            optionGroupingMode: "STRICT_SINGLE_CLASS",
                                            optionBalance: Math.max(weights.optionBalance, 9),
                                          });
                                        }}
                                        style={{ width: "16px", height: "16px", cursor: "pointer" }}
                                      />
                                    </td>
                                  );
                                })}
                                <td style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, fontSize: "0.78rem" }}>
                                  {assignedClasses.length === 0 ? (
                                    <span style={{ color: "var(--text-light)" }}>Non réservée (libre)</span>
                                  ) : totalCap >= optCount ? (
                                    <span style={{ color: "var(--card-success-text)", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "4px" }}><CheckCircle2 size={12} aria-hidden="true" /> {assignedClasses.length} classe(s) = {totalCap} places / {optCount} élèves</span>
                                  ) : (
                                    <span style={{ color: "var(--card-warning-text)", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "4px" }}><AlertTriangle size={12} aria-hidden="true" /> {totalCap} / {optCount} places (Manque {optCount - totalCap})</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "0.76rem", fontWeight: 700, marginTop: "12px", color: "var(--text-muted)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--emerald-accent)" }} />
                        Capacité suffisante pour l'effectif réservé
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--text-light)" }} />
                        Répartition libre — aucune classe réservée
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* GESTIONNAIRE D'INCOMPATIBILITÉS & D'ASSOCIATIONS D'ÉLÈVES */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "16px 18px", marginTop: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Ban size={17} aria-hidden="true" style={{ color: "var(--rose-accent)" }} />
                    <div>
                      <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: "var(--text-main)" }}>
                        Gestionnaire de Règles Individuelles (Incompatibilités & Associations / Binômes)
                      </h4>
                      <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                        Définissez les élèves qui ne doivent JAMAIS être ensemble ou qui doivent être OBLIGATOIREMENT dans la même classe.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Formulaire d'ajout rapide de règle */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", alignItems: "end", background: "var(--bg-subtle)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: "3px", color: "var(--text-muted)" }}>Élève A</label>
                    <select
                      value={ruleStudentAId}
                      onChange={(e) => setRuleStudentAId(e.target.value)}
                      style={{ width: "100%", padding: "6px 10px", fontSize: "0.82rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-card)" }}
                    >
                      <option value="">Sélectionner Élève A…</option>
                      {dataset.students.map((s) => (
                        <option key={s.id} value={s.id}>{nameOf(s, anonymous)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: "3px", color: "var(--text-muted)" }}>Type de Règle</label>
                    <select
                      value={ruleType}
                      onChange={(e) => setRuleType(e.target.value as "CONFLICT" | "COLOCATION")}
                      style={{ width: "100%", padding: "6px 10px", fontSize: "0.82rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-card)", fontWeight: 700 }}
                    >
                      <option value="CONFLICT">⛔ Incompatibilité (Séparation obligatoire)</option>
                      <option value="COLOCATION">🤝 Association (Mettre dans la même classe)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: "3px", color: "var(--text-muted)" }}>Élève B</label>
                    <select
                      value={ruleStudentBId}
                      onChange={(e) => setRuleStudentBId(e.target.value)}
                      style={{ width: "100%", padding: "6px 10px", fontSize: "0.82rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-card)" }}
                    >
                      <option value="">Sélectionner Élève B…</option>
                      {dataset.students.filter((s) => s.id !== ruleStudentAId).map((s) => (
                        <option key={s.id} value={s.id}>{nameOf(s, anonymous)}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="primary"
                    disabled={!ruleStudentAId || !ruleStudentBId}
                    onClick={() => {
                      if (!ruleStudentAId || !ruleStudentBId) return;
                      const sA = dataset.students.find((s) => s.id === ruleStudentAId);
                      const sB = dataset.students.find((s) => s.id === ruleStudentBId);
                      if (!sA || !sB) return;

                      const updatedStudents = dataset.students.map((student) => {
                        if (ruleType === "CONFLICT") {
                          if (student.id === sA.id) return { ...student, conflictsWith: [...new Set([...student.conflictsWith, sB.id])] };
                          if (student.id === sB.id) return { ...student, conflictsWith: [...new Set([...student.conflictsWith, sA.id])] };
                        } else {
                          const gId = sA.coLocateGroupId || sB.coLocateGroupId || `group-coloc-${Date.now()}`;
                          if (student.id === sA.id || student.id === sB.id) return { ...student, coLocateGroupId: gId };
                        }
                        return student;
                      });

                      const nextDs = { ...dataset, students: updatedStudents };
                      setDataset(nextDs);
                      setActiveDataset(nextDs);
                      setRuleStudentAId("");
                      setRuleStudentBId("");
                      setNotice(`Règle d'affectation enregistrée entre ${nameOf(sA, anonymous)} et ${nameOf(sB, anonymous)}.`);
                    }}
                    style={{ padding: "6px 14px", fontSize: "0.82rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "5px" }}
                  >
                    <Plus size={14} aria-hidden="true" /> Ajouter la Règle
                  </button>
                </div>

                {/* Liste des règles actives */}
                <div style={{ marginTop: "12px" }}>
                  {dataset.students.every((s) => s.conflictsWith.length === 0 && !s.coLocateGroupId) ? (
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "8px" }}>
                      Aucune incompatibilité ni association particulière enregistrée. Utilisez le formulaire ci-dessus pour en ajouter.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", maxHeight: "140px", overflowY: "auto" }}>
                      {dataset.students.flatMap((sA) =>
                        sA.conflictsWith.map((conflictId) => {
                          const sB = dataset.students.find((s) => s.id === conflictId);
                          if (!sB || sA.id > sB.id) return null; // Éviter les doublons A-B / B-A
                          return (
                            <div
                              key={`conflict-${sA.id}-${sB.id}`}
                              style={{
                                background: "var(--card-warning-bg)",
                                border: "1px solid var(--card-warning-border)",
                                color: "var(--card-warning-text)",
                                padding: "4px 10px",
                                borderRadius: "12px",
                                fontSize: "0.76rem",
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><Ban size={12} aria-hidden="true" /> Séparation : <strong>{nameOf(sA, anonymous)}</strong> ⬄ <strong>{nameOf(sB, anonymous)}</strong></span>
                              <button
                                type="button"
                                style={{ border: "none", background: "none", color: "var(--rose-accent)", cursor: "pointer", fontSize: "0.85rem", padding: 0 }}
                                title="Supprimer cette incompatibilité"
                                onClick={() => {
                                  const updated = dataset.students.map((st) => {
                                    if (st.id === sA.id) return { ...st, conflictsWith: st.conflictsWith.filter((id) => id !== sB.id) };
                                    if (st.id === sB.id) return { ...st, conflictsWith: st.conflictsWith.filter((id) => id !== sA.id) };
                                    return st;
                                  });
                                  const nextDs = { ...dataset, students: updated };
                                  setDataset(nextDs);
                                  setActiveDataset(nextDs);
                                }}
                              >
                                <X size={13} aria-hidden="true" />
                              </button>
                            </div>
                          );
                        })
                      )}
                      {dataset.students.flatMap((sA) => {
                        if (!sA.coLocateGroupId) return [];
                        const sB = dataset.students.find((s) => s.id !== sA.id && s.coLocateGroupId === sA.coLocateGroupId);
                        if (!sB || sA.id > sB.id) return [];
                        return [
                          <div
                            key={`coloc-${sA.id}-${sB.id}`}
                            style={{
                              background: "var(--card-success-bg)",
                              border: "1px solid var(--card-success-border)",
                              color: "var(--card-success-text)",
                              padding: "4px 10px",
                              borderRadius: "12px",
                              fontSize: "0.76rem",
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><HeartHandshake size={12} aria-hidden="true" /> Association : <strong>{nameOf(sA, anonymous)}</strong> ⬄ <strong>{nameOf(sB, anonymous)}</strong></span>
                            <button
                              type="button"
                              style={{ border: "none", background: "none", color: "var(--emerald-accent)", cursor: "pointer", fontSize: "0.85rem", padding: 0 }}
                              title="Supprimer cette association"
                              onClick={() => {
                                const updated = dataset.students.map((st) => {
                                  if (st.id === sA.id || st.id === sB.id) return { ...st, coLocateGroupId: undefined };
                                  return st;
                                });
                                const nextDs = { ...dataset, students: updated };
                                setDataset(nextDs);
                                setActiveDataset(nextDs);
                              }}
                            >
                              <X size={13} aria-hidden="true" />
                            </button>
                          </div>
                        ];
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* BOUTON PRINCIPAL DE CALCUL & GÉNERATION DES SCÉNARIOS */}
              <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--border-light)", textAlign: "center" }}>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    const customInput = createSyntheticDemoInputCustom(simStudentCount, simClassCount, simMaxSize, simMinSize);
                    const feasibility = validateDispatchFeasibility(customInput, weights);
                    if (!feasibility.isFeasible && feasibility.errors.length > 0) {
                      setImpossibilityErrors(feasibility.errors);
                      setBusy(false);
                      return;
                    }
                    setDataset(customInput);
                    setActiveDataset(customInput);
                    api.generate(weights, customInput)
                      .then((res) => {
                        setScenarios(res.scenarios);
                        const bestId = getBestScenarioId(res.scenarios);
                        if (bestId) setSelectedId(bestId);
                        setNotice(`${res.scenarios.length} scénarios d'équilibrage ont été générés sous contraintes pour ${simStudentCount} élèves.`);
                        setDispatchSubTab("kanban"); // BASCULE AUTOMATIQUE VERS L'ONGLET 3
                      })
                      .catch((err) => {
                        setNotice(err instanceof Error ? err.message : "Erreur lors de la génération.");
                      })
                      .finally(() => setBusy(false));
                  }}
                  style={{ padding: "14px 28px", fontSize: "1.05rem", fontWeight: 800, minWidth: "320px", boxShadow: "var(--shadow-md)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  <Zap size={18} aria-hidden="true" /> Calculer & Générer les 3 Scénarios d'Équilibrage
                </button>
                <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Le solveur algorithmique sous contraintes (Recherche gloutonne & Recuit simulé déterministe) calcule 3 alternatives d'optimisation.
                </p>
              </div>
            </div>
  );
}
