import type { SubstitutionSuggestion, TimetablingDataset, TimetablingSchedule } from "../../types";
import { days, periods } from "../../constants/schedule";
import { subjectColorClass } from "../../utils/format";

export function TimetablingTab({
  selectedWeekFilter,
  setSelectedWeekFilter,
  timetablingAxisFilter,
  setTimetablingAxisFilter,
  generateTimetable,
  validateTimetable,
  busy,
  selectedSchedule,
  timetablingData,
  absenceTeacherId,
  setAbsenceTeacherId,
  absenceTimeSlotId,
  setAbsenceTimeSlotId,
  absenceReason,
  setAbsenceReason,
  fetchSubstitutions,
  substitutions,
}: {
  selectedWeekFilter: "ALL" | "A" | "B";
  setSelectedWeekFilter: (v: "ALL" | "A" | "B") => void;
  timetablingAxisFilter: string;
  setTimetablingAxisFilter: (v: string) => void;
  generateTimetable: () => Promise<void>;
  validateTimetable: () => Promise<void>;
  busy: boolean;
  selectedSchedule: TimetablingSchedule | undefined;
  timetablingData: TimetablingDataset | null;
  absenceTeacherId: string;
  setAbsenceTeacherId: (v: string) => void;
  absenceTimeSlotId: string;
  setAbsenceTimeSlotId: (v: string) => void;
  absenceReason: string;
  setAbsenceReason: (v: string) => void;
  fetchSubstitutions: () => Promise<void>;
  substitutions: SubstitutionSuggestion[] | null;
}) {
  return (
        <section aria-labelledby="timetabling-title">
          <div className="section-header">
            <div>
              <span className="eyebrow">MODULE 2 · PLANIFICATION HORAIRE & REMPLACEMENTS</span>
              <h2 id="timetabling-title">Emplois du Temps & Planning Semestriel</h2>
            </div>
            <div className="section-controls" style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", flexShrink: 0 }}>
              <div className="control-group" style={{ display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: 0 }}>
                <label htmlFor="week-select" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>Semaines :</label>
                <select id="week-select" value={selectedWeekFilter} onChange={(e) => setSelectedWeekFilter(e.target.value as "ALL" | "A" | "B")}>
                  <option value="ALL">Toutes les semaines (A/B)</option>
                  <option value="A">Semaine A</option>
                  <option value="B">Semaine B</option>
                </select>
              </div>

              <div className="control-group" style={{ display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: 0 }}>
                <label htmlFor="axis-select" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>Vue :</label>
                <select id="axis-select" value={timetablingAxisFilter} onChange={(e) => setTimetablingAxisFilter(e.target.value)}>
                  <option value="ALL">Vue globale de l'établissement</option>
                  <option value="6A">Classe 6e A</option>
                  <option value="6B">Classe 6e B</option>
                  <option value="prof-math-1">Mme Martin (Maths)</option>
                  <option value="prof-fra-1">M. Dubois (Français)</option>
                  <option value="room-101">Salle 101 (Standard)</option>
                </select>
              </div>

              <button className="primary" onClick={generateTimetable} disabled={busy} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                {busy ? "Calcul en cours…" : "⚡ Calculer l'EDT"}
              </button>

              <button
                className="validate"
                onClick={validateTimetable}
                disabled={!selectedSchedule || selectedSchedule.state === "APPROVED"}
                style={{ padding: "10px 20px", fontSize: "0.9rem", fontWeight: 800, borderRadius: "var(--radius-sm)", whiteSpace: "nowrap", flexShrink: 0, height: "40px", display: "inline-flex", alignItems: "center", gap: "8px" }}
              >
                {selectedSchedule?.state === "APPROVED" ? "✓ EDT Scellé" : "✓ Valider & Sceller l'EDT"}
              </button>
            </div>
          </div>

          {/* PANNEAU DE GESTION DES REMPLACEMENTS */}
          <div className="substitutions-panel">
            <div style={{ marginBottom: "16px" }}>
              <span className="eyebrow">URGENCES & CONTINUITÉ PÉDAGOGIQUE</span>
              <h3 style={{ margin: "2px 0 0", fontSize: "1.2rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                🚨 Gestion des Absences & Remplacements d'Enseignants
              </h3>
            </div>
            <div className="substitutions-form">
              <label>
                Enseignant absent
                <select value={absenceTeacherId} onChange={(e) => setAbsenceTeacherId(e.target.value)}>
                  <option value="">Sélectionner un enseignant</option>
                  {timetablingData?.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Créneau d'absence
                <select value={absenceTimeSlotId} onChange={(e) => setAbsenceTimeSlotId(e.target.value)}>
                  <option value="">Sélectionner un créneau</option>
                  {timetablingData?.timeSlots.filter((s) => !s.isMeridienne).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.day} {s.period}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Motif / Type
                <input value={absenceReason} onChange={(e) => setAbsenceReason(e.target.value)} placeholder="Stage, maladie..." />
              </label>
              <button className="primary" onClick={fetchSubstitutions} disabled={busy || !absenceTeacherId || !absenceTimeSlotId}>
                ⚡ Trouver un remplaçant
              </button>
            </div>

            {substitutions && (
              <div className="suggestions-list">
                <p>
                  <strong>Enseignants disponibles et qualifiés pour substitution :</strong>
                </p>
                {substitutions.length === 0 ? (
                  <p style={{ color: "var(--card-error-text)" }}>Aucun enseignant disponible sur ce créneau.</p>
                ) : (
                  substitutions.map((sug) => (
                    <div key={sug.substituteTeacherId} className="suggestion-card">
                      <div>
                        <strong>{sug.substituteTeacherName}</strong>
                        <br />
                        <small>{sug.reason}</small>
                      </div>
                      <div>
                        <span className="chip approved">Score : {sug.matchScore}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {selectedSchedule && (
            <>
              {selectedSchedule.conflicts.length > 0 && (
                <div className="conflict-banner">
                  <h3>Diagnostic d'infaisabilité et conflits ({selectedSchedule.conflicts.length})</h3>
                  <ul className="conflict-list">
                    {selectedSchedule.conflicts.map((conflict, idx) => (
                      <li key={idx}>⚠️ {conflict.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="timetabling-grid">
                <div className="time-col-header">Horaires</div>
                {days.map((day) => (
                  <div key={day} className="grid-header">
                    {day}
                  </div>
                ))}

                {periods.map((period, periodIdx) => (
                  <div key={period} style={{ display: "contents" }}>
                    <div className="time-label">{period.slice(0, 5)}</div>
                    {days.map((day) => {
                      const isMeridienne = period.includes("12h00 - 13h00");
                      const slotId = `slot-${day.toLowerCase().slice(0, 3)}-${periodIdx + 1}`;
                      const placements = selectedSchedule.placements.filter((p) => p.timeSlotId === slotId);

                      const filteredPlacements = placements.filter((p) => {
                        if (timetablingAxisFilter === "ALL") return true;
                        const course = timetablingData?.courses.find((c) => c.id === p.courseId);
                        if (!course) return false;
                        return course.classroomId === timetablingAxisFilter || course.teacherId === timetablingAxisFilter || p.roomId === timetablingAxisFilter;
                      });

                      return (
                        <div key={slotId} className={`grid-slot ${isMeridienne ? "meridienne" : ""}`}>
                          {isMeridienne ? (
                            "Pause Méridienne"
                          ) : (
                            filteredPlacements.map((placement) => {
                              const course = timetablingData?.courses.find((c) => c.id === placement.courseId);
                              const teacher = timetablingData?.teachers.find((t) => t.id === course?.teacherId);
                              const room = timetablingData?.rooms.find((r) => r.id === placement.roomId);
                              if (!course) return null;
                              return (
                                <div key={placement.courseId} className={`course-badge ${subjectColorClass(course.subject)}`}>
                                  <div className="course-title-row">
                                    <span className="course-subject">{course.subject}</span>
                                    <span className="course-class-tag">{course.classroomId}</span>
                                  </div>
                                  <div className="course-details-row">
                                    <span>👤 {teacher?.displayName}</span>
                                    <span>📍 {room?.label}</span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
  );
}
