import { Users, Scale, HeartHandshake, GraduationCap, Search, Dices, Timer, FolderOpen } from "lucide-react";
import type { Dataset, Scenario, Student } from "../../types";
import { nameOf } from "../../utils/format";

export function RosterTab({
  dataset,
  anonymous,
  selected,
  rosterSearch,
  setRosterSearch,
  rosterFilter,
  setRosterFilter,
  rosterPage,
  setRosterPage,
  rosterPageSize,
  setRosterPageSize,
  setInspectStudent,
  move,
  handleRegenerateCohort,
}: {
  dataset: Dataset;
  anonymous: boolean;
  selected: Scenario | undefined;
  rosterSearch: string;
  setRosterSearch: (v: string) => void;
  rosterFilter: "ALL" | "PAP" | "OPTIONS";
  setRosterFilter: (v: "ALL" | "PAP" | "OPTIONS") => void;
  rosterPage: number;
  setRosterPage: (v: number | ((prev: number) => number)) => void;
  rosterPageSize: number;
  setRosterPageSize: (v: number) => void;
  setInspectStudent: (s: Student | null) => void;
  move: (studentId: string, targetClassroomId: string) => Promise<void>;
  handleRegenerateCohort: () => Promise<void>;
}) {
  return (
            <section className="roster-section" style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", padding: "24px", borderRadius: "var(--radius-md)", marginBottom: "24px" }}>
              <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
                <div>
                  <span className="eyebrow">COHORTE DU NIVEAU {dataset.level}</span>
                  <h3 style={{ margin: "4px 0", fontSize: "1.2rem", fontWeight: 800 }}>Effectif complet & Profils des Élèves</h3>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.88rem" }}>
                    Consultez la liste nominative des élèves, leurs caractéristiques (genre, niveau, accompagnements PAP/PPS, options) et leur classe ciblée.
                  </p>
                </div>

                <div className="roster-metrics-pills" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <span className="chip" style={{ background: "var(--bg-subtle)", padding: "6px 12px", borderRadius: "var(--radius-sm)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <Users size={13} aria-hidden="true" /> {dataset.students.length} Élèves
                  </span>
                  <span className="chip" style={{ background: "var(--bg-subtle)", padding: "6px 12px", borderRadius: "var(--radius-sm)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <Scale size={13} aria-hidden="true" /> {dataset.students.filter(s => s.gender === 'F').length} F / {dataset.students.filter(s => s.gender === 'M').length} M
                  </span>
                  <span className="chip" style={{ background: "var(--bg-subtle)", padding: "6px 12px", borderRadius: "var(--radius-sm)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <HeartHandshake size={13} aria-hidden="true" /> {dataset.students.filter(s => s.supportFlags.length > 0).length} PAP/PPS
                  </span>
                  <span className="chip" style={{ background: "var(--bg-subtle)", padding: "6px 12px", borderRadius: "var(--radius-sm)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <GraduationCap size={13} aria-hidden="true" /> {dataset.students.filter(s => s.options.length > 0).length} Options
                  </span>
                </div>
              </div>

              {/* Roster Controls */}
              <div className="roster-controls" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ position: "relative", flex: "1 1 240px", minWidth: "200px" }}>
                  <Search size={15} aria-hidden="true" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-light)", pointerEvents: "none" }} />
                  <input
                    type="text"
                    placeholder="Rechercher un élève par nom, identifiant ou option..."
                    value={rosterSearch}
                    onChange={(e) => {
                      setRosterSearch(e.target.value);
                      setRosterPage(1);
                    }}
                    style={{ width: "100%", padding: "8px 14px 8px 36px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", color: "var(--text-main)", fontSize: "0.88rem", boxSizing: "border-box" }}
                  />
                </div>
                <div className="roster-filter-btns" style={{ display: "flex", gap: "8px", flexWrap: "wrap", flexShrink: 0 }}>
                  <button
                    className={`secondary ${rosterFilter === "ALL" ? "active-filter" : ""}`}
                    onClick={() => { setRosterFilter("ALL"); setRosterPage(1); }}
                  >
                    Tous ({dataset.students.length})
                  </button>
                  <button
                    className={`secondary ${rosterFilter === "PAP" ? "active-filter" : ""}`}
                    onClick={() => { setRosterFilter("PAP"); setRosterPage(1); }}
                  >
                    Besoins PAP/PPS ({dataset.students.filter(s => s.supportFlags.length > 0).length})
                  </button>
                  <button
                    className={`secondary ${rosterFilter === "OPTIONS" ? "active-filter" : ""}`}
                    onClick={() => { setRosterFilter("OPTIONS"); setRosterPage(1); }}
                    style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                  >
                    <GraduationCap size={14} aria-hidden="true" /> Options Spécifiques ({dataset.students.filter(s => s.options.some(opt => !["LVA_ANG", "LVB_ESP"].includes(opt))).length})
                  </button>
                  <button
                    className="secondary"
                    onClick={() => void handleRegenerateCohort()}
                    style={{ background: "var(--card-highlight-bg)", color: "var(--card-highlight-text)", border: "1px solid var(--card-highlight-border)", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "5px" }}
                    title="Générer une nouvelle cohorte aléatoire de 70 élèves complètement remplis (LV1, LV2, options, 9 notes)"
                  >
                    <Dices size={14} aria-hidden="true" /> Régénérer 70 Élèves
                  </button>
                </div>
              </div>

              {(() => {
                const filteredStudents = dataset.students.filter((student) => {
                  const nameMatches = nameOf(student, anonymous).toLowerCase().includes(rosterSearch.toLowerCase());
                  const optionMatches = student.options.some((o) => o.toLowerCase().includes(rosterSearch.toLowerCase()));
                  if (!nameMatches && !optionMatches) return false;
                  if (rosterFilter === "PAP") return student.supportFlags.length > 0;
                  if (rosterFilter === "OPTIONS") return student.options.some((opt) => !["LVA_ANG", "LVB_ESP"].includes(opt));
                  return true;
                });

                const totalPages = Math.max(1, Math.ceil(filteredStudents.length / rosterPageSize));
                const currentPage = Math.min(rosterPage, totalPages);
                const paginatedStudents = filteredStudents.slice((currentPage - 1) * rosterPageSize, currentPage * rosterPageSize);

                return (
                  <>
                    {/* BARRE DE PAGINATION HAUT & BAS */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", fontSize: "0.82rem", flexWrap: "wrap", gap: "10px" }}>
                      <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                        Affichage <strong>{filteredStudents.length > 0 ? (currentPage - 1) * rosterPageSize + 1 : 0}–{Math.min(currentPage * rosterPageSize, filteredStudents.length)}</strong> sur <strong>{filteredStudents.length}</strong> élèves
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button
                          className="secondary"
                          disabled={currentPage === 1}
                          onClick={() => setRosterPage((p) => Math.max(1, p - 1))}
                          style={{ padding: "4px 10px", fontSize: "0.78rem", fontWeight: 700 }}
                        >
                          ◄ Précédent
                        </button>
                        <span style={{ fontWeight: 800, padding: "0 6px" }}>
                          Page {currentPage} / {totalPages}
                        </span>
                        <button
                          className="secondary"
                          disabled={currentPage === totalPages}
                          onClick={() => setRosterPage((p) => Math.min(totalPages, p + 1))}
                          style={{ padding: "4px 10px", fontSize: "0.78rem", fontWeight: 700 }}
                        >
                          Suivant ►
                        </button>
                        <select
                          value={rosterPageSize}
                          onChange={(e) => {
                            setRosterPageSize(Number(e.target.value));
                            setRosterPage(1);
                          }}
                          style={{ padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", fontSize: "0.78rem", fontWeight: 700, marginLeft: "6px" }}
                        >
                          <option value={15}>15 par page</option>
                          <option value={25}>25 par page</option>
                          <option value={50}>50 par page</option>
                          <option value={100}>100 par page</option>
                        </select>
                      </div>
                    </div>

                    {/* Roster View (Desktop Table + Mobile Responsive Cards) */}
                    <div className="desktop-only-table table-wrapper" style={{ overflowX: "auto", border: "1px solid var(--border-light)", borderRadius: "var(--radius-sm)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                        <thead>
                          <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-light)" }}>
                            <th style={{ padding: "10px 14px", fontWeight: 800 }}>Élève</th>
                            <th style={{ padding: "10px 14px", fontWeight: 800 }}>Genre</th>
                            <th style={{ padding: "10px 14px", fontWeight: 800 }}>Moyenne Scolaire</th>
                            <th style={{ padding: "10px 14px", fontWeight: 800 }}>
                              <span className="ui-tooltip" data-tooltip="Score d'autonomie comportementale (sur 5 étoiles) et cumul d'heures d'absence à la Vie Scolaire" style={{ cursor: "help" }}>
                                ⭐ Autonomie & ⏱️ Assiduité ℹ️
                              </span>
                            </th>
                            <th style={{ padding: "10px 14px", fontWeight: 800 }}>Accompagnements</th>
                            <th style={{ padding: "10px 14px", fontWeight: 800 }}>Options & Langues</th>
                            <th style={{ padding: "10px 14px", fontWeight: 800 }}>Classe Cible</th>
                            <th style={{ padding: "10px 14px", fontWeight: 800 }}>Dossier</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedStudents.map((student) => {
                            const currentAssignedClassId = selected?.assignments[student.id] ?? dataset.classrooms[0]?.id;
                            return (
                              <tr key={student.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                <td style={{ padding: "10px 14px", fontWeight: 700 }}>
                                  {nameOf(student, anonymous)}
                                </td>
                                <td style={{ padding: "10px 14px" }}>
                                  <span className="chip" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px", whiteSpace: "nowrap", padding: "3px 8px", borderRadius: "12px", fontSize: "0.78rem", fontWeight: 800, background: student.gender === "F" ? "var(--badge-female-bg)" : "var(--badge-male-bg)", color: student.gender === "F" ? "var(--badge-female-text)" : "var(--badge-male-text)", border: `1px solid ${student.gender === "F" ? "var(--badge-female-border)" : "var(--badge-male-border)"}` }}>
                                    {student.gender === "F" ? "♀ Fille" : "♂ Garçon"}
                                  </span>
                                </td>
                                <td style={{ padding: "10px 14px" }}>
                                  <span style={{ fontWeight: 800, color: "var(--primary-brand)" }}>
                                    {student.levelAverage.toFixed(1)} / 20
                                  </span>
                                </td>
                                <td style={{ padding: "10px 14px" }}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                    <span className="ui-tooltip" data-tooltip={`Autonomie comportementale : ${student.behavior?.conductScore ?? 4}/5 étoiles`} style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--amber-accent)", cursor: "help" }}>
                                      {"★".repeat(student.behavior?.conductScore ?? 4)}{"☆".repeat(5 - (student.behavior?.conductScore ?? 4))}
                                    </span>
                                    <span className="ui-tooltip" data-tooltip={`Cumul d'absences signalées : ${student.behavior?.absencesHours ?? 0}h`} style={{ fontSize: "0.76rem", fontWeight: 700, color: (student.behavior?.absencesHours ?? 0) > 5 ? "var(--rose-accent)" : "var(--text-muted)", cursor: "help", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                      <Timer size={11} aria-hidden="true" /> {student.behavior?.absencesHours ?? 0}h abs.
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: "10px 14px" }}>
                                  {student.supportFlags.length > 0 ? (
                                    student.supportFlags.map((need) => (
                                      <span key={need} className="chip" style={{ background: "var(--badge-need-bg)", color: "var(--badge-need-text)", border: "1px solid var(--badge-need-border)", padding: "2px 8px", borderRadius: "4px", fontSize: "0.78rem", fontWeight: 800, marginRight: "4px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                        <HeartHandshake size={11} aria-hidden="true" /> {need}
                                      </span>
                                    ))
                                  ) : (
                                    <span style={{ color: "var(--text-light)" }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: "10px 14px" }}>
                                  {student.options.length > 0 ? (
                                    student.options.map((opt) => (
                                      <span key={opt} className="chip" style={{ background: "var(--badge-option-bg)", color: "var(--badge-option-text)", border: "1px solid var(--badge-option-border)", padding: "2px 8px", borderRadius: "4px", fontSize: "0.78rem", fontWeight: 800, marginRight: "4px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                        <GraduationCap size={11} aria-hidden="true" /> {opt}
                                      </span>
                                    ))
                                  ) : (
                                    <span style={{ color: "var(--text-light)" }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: "10px 14px" }}>
                                  <select
                                    value={currentAssignedClassId}
                                    disabled={selected?.state === "APPROVED"}
                                    onChange={(e) => {
                                      void move(student.id, e.target.value);
                                    }}
                                    style={{ padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-interactive)", background: "var(--bg-subtle)", fontWeight: 700 }}
                                  >
                                    {dataset.classrooms.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ padding: "10px 14px" }}>
                                  <button
                                    className="secondary"
                                    onClick={() => setInspectStudent(student)}
                                    style={{ padding: "3px 8px", fontSize: "0.78rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}
                                  >
                                    <FolderOpen size={13} aria-hidden="true" /> Dossier
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Student Card List */}
                    <div className="mobile-student-cards">
                      {paginatedStudents.map((student) => {
                        const currentAssignedClassId = selected?.assignments[student.id] ?? dataset.classrooms[0]?.id;
                        return (
                          <div key={student.id} className="mobile-student-card-item">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontWeight: 800, fontSize: "0.98rem" }}>{nameOf(student, anonymous)}</span>
                              <span style={{ fontWeight: 800, color: "var(--primary-brand)", fontSize: "0.92rem" }}>
                                {student.levelAverage.toFixed(1)} / 20
                              </span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "0.78rem" }}>
                              <span className="chip" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px", whiteSpace: "nowrap", padding: "2px 8px", borderRadius: "12px", fontWeight: 800, background: student.gender === "F" ? "var(--badge-female-bg)" : "var(--badge-male-bg)", color: student.gender === "F" ? "var(--badge-female-text)" : "var(--badge-male-text)", border: `1px solid ${student.gender === "F" ? "var(--badge-female-border)" : "var(--badge-male-border)"}` }}>
                                {student.gender === "F" ? "♀ Fille" : "♂ Garçon"}
                              </span>
                              <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                                {"★".repeat(student.behavior?.conductScore ?? 4)} ({student.behavior?.absencesHours ?? 0}h abs)
                              </span>
                            </div>

                            {(student.supportFlags.length > 0 || student.options.length > 0) && (
                              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                {student.supportFlags.map((need) => (
                                  <span key={need} className="chip" style={{ background: "var(--badge-need-bg)", color: "var(--badge-need-text)", border: "1px solid var(--badge-need-border)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                    <HeartHandshake size={10} aria-hidden="true" /> {need}
                                  </span>
                                ))}
                                {student.options.map((opt) => (
                                  <span key={opt} className="chip" style={{ background: "var(--badge-option-bg)", color: "var(--badge-option-text)", border: "1px solid var(--badge-option-border)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                    <GraduationCap size={10} aria-hidden="true" /> {opt}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px", paddingTop: "8px", borderTop: "1px solid var(--border-light)" }}>
                              <select
                                value={currentAssignedClassId}
                                disabled={selected?.state === "APPROVED"}
                                onChange={(e) => {
                                  void move(student.id, e.target.value);
                                }}
                                style={{ flex: 1, padding: "6px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-interactive)", background: "var(--bg-subtle)", fontWeight: 700, fontSize: "0.82rem" }}
                              >
                                {dataset.classrooms.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                className="secondary"
                                onClick={() => setInspectStudent(student)}
                                style={{ padding: "6px 10px", fontSize: "0.82rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}
                              >
                                <FolderOpen size={13} aria-hidden="true" /> Dossier
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* BARRE DE PAGINATION (BAS) */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", fontSize: "0.82rem", flexWrap: "wrap", gap: "10px", borderTop: "1px solid var(--border-light)", paddingTop: "12px" }}>
                      <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                        Affichage <strong>{filteredStudents.length > 0 ? (currentPage - 1) * rosterPageSize + 1 : 0}–{Math.min(currentPage * rosterPageSize, filteredStudents.length)}</strong> sur <strong>{filteredStudents.length}</strong> élèves
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button
                          className="secondary"
                          disabled={currentPage === 1}
                          onClick={() => setRosterPage((p) => Math.max(1, p - 1))}
                          style={{ padding: "4px 10px", fontSize: "0.78rem", fontWeight: 700 }}
                        >
                          ◄ Précédent
                        </button>
                        <span style={{ fontWeight: 800, padding: "0 6px" }}>
                          Page {currentPage} / {totalPages}
                        </span>
                        <button
                          className="secondary"
                          disabled={currentPage === totalPages}
                          onClick={() => setRosterPage((p) => Math.min(totalPages, p + 1))}
                          style={{ padding: "4px 10px", fontSize: "0.78rem", fontWeight: 700 }}
                        >
                          Suivant ►
                        </button>
                        <select
                          value={rosterPageSize}
                          onChange={(e) => {
                            setRosterPageSize(Number(e.target.value));
                            setRosterPage(1);
                          }}
                          style={{ padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", fontSize: "0.78rem", fontWeight: 700, marginLeft: "6px" }}
                        >
                          <option value={15}>15 par page</option>
                          <option value={25}>25 par page</option>
                          <option value={50}>50 par page</option>
                          <option value={100}>100 par page</option>
                        </select>
                      </div>
                    </div>
                  </>
                );
              })()}
            </section>
  );
}
