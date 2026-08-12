import { GraduationCap, CalendarDays, CheckCircle2, Pencil, Save, AlertOctagon, Zap } from "lucide-react";
import type { Dataset, TimetablingDataset, TimetablingSchedule } from "../../types";
import { days, periods } from "../../constants/schedule";

export function TeacherTab({
  timetablingData,
  selectedTeacherId,
  setSelectedTeacherId,
  selectedSchedule,
  dataset,
  absenceTimeSlotId,
  setAbsenceTimeSlotId,
  setAbsenceTeacherId,
  busy,
  fetchSubstitutions,
  setNotice,
}: {
  timetablingData: TimetablingDataset | null;
  selectedTeacherId: string;
  setSelectedTeacherId: (id: string) => void;
  selectedSchedule: TimetablingSchedule | undefined;
  dataset: Dataset;
  absenceTimeSlotId: string;
  setAbsenceTimeSlotId: (v: string) => void;
  setAbsenceTeacherId: (v: string) => void;
  busy: boolean;
  fetchSubstitutions: () => Promise<void>;
  setNotice: (msg: string) => void;
}) {
  return (
        <section aria-labelledby="teacher-space-title">
          <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card)", padding: "20px 24px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)", marginBottom: "24px" }}>
            <div>
              <span className="eyebrow">SERVICE NUMÉRIQUE ENSEIGNANT</span>
              <h2 id="teacher-space-title" style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}><GraduationCap size={19} aria-hidden="true" /> Espace Personnel Enseignant</h2>
              <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "0.88rem" }}>
                Consultez votre emploi du temps en temps réel, saisissez vos vœux d'aménagement horaire et organisez vos remplacements d'urgence.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>Profil enseignant :</span>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                style={{ padding: "8px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.9rem" }}
              >
                {timetablingData?.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName} ({t.subjects.join(", ")})
                  </option>
                )) ?? (
                    <>
                      <option value="t-1">Mme Martin (Mathématiques)</option>
                      <option value="t-2">M. Bernard (Français)</option>
                      <option value="t-3">Mme Thomas (Histoire-Géo)</option>
                    </>
                  )}
              </select>
            </div>
          </div>

          {/* Grille d'Emploi du Temps Personnel Enseignant */}
          <div className="compliance-card" style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "7px" }}><CalendarDays size={17} aria-hidden="true" /> Mon Emploi du Temps de la Semaine</h3>
              <span className="chip approved" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><CheckCircle2 size={12} aria-hidden="true" /> Planning Synchronisé</span>
            </div>

            <div className="timetabling-grid">
              <div className="time-col-header">Créneaux</div>
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
                    const myPlacements = selectedSchedule?.placements.filter((p) => {
                      const course = timetablingData?.courses.find((c) => c.id === p.courseId);
                      return course?.teacherId === selectedTeacherId && p.timeSlotId === slotId;
                    }) ?? [];

                    return (
                      <div key={slotId} className={`grid-slot ${isMeridienne ? "meridienne" : ""}`}>
                        {isMeridienne ? (
                          "Pause Méridienne"
                        ) : myPlacements.length > 0 ? (
                          myPlacements.map((placement) => {
                            const course = timetablingData?.courses.find((c) => c.id === placement.courseId);
                            const classroom = dataset.classrooms.find((c) => c.id === course?.classroomId);
                            const room = timetablingData?.rooms.find((r) => r.id === placement.roomId);
                            return (
                              <div key={placement.courseId} style={{ background: "var(--button-primary-bg)", color: "#ffffff", padding: "8px", borderRadius: "var(--radius-sm)", fontSize: "0.82rem" }}>
                                <strong style={{ display: "block" }}>{course?.subject}</strong>
                                <span>Classe : {classroom?.label ?? course?.classroomId}</span>
                                <small style={{ display: "block", marginTop: "2px", opacity: 0.9 }}>Salle {room?.label ?? placement.roomId}</small>
                              </div>
                            );
                          })
                        ) : (
                          <span style={{ color: "var(--text-light)", fontSize: "0.78rem", fontStyle: "italic" }}>Disponible</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Vœux Horaires & Remplacements */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "24px" }}>
            <div className="compliance-card">
              <h3 style={{ display: "flex", alignItems: "center", gap: "7px" }}><Pencil size={16} aria-hidden="true" /> Mes Vœux & Décharges Horaires</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "14px" }}>
                Signalez vos contraintes personnelles de décharge académique ou de réunion pédagogique pour le prochain semestre.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem", fontWeight: 600 }}>
                  <input type="checkbox" defaultChecked /> Décharge de formation académique (Mercredi Après-Midi)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem", fontWeight: 600 }}>
                  <input type="checkbox" defaultChecked /> Pas de cours en première heure le Lundi (08h00)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem", fontWeight: 600 }}>
                  <input type="checkbox" /> Préférence pour Salle Spécialisée Labo / Multimédia
                </label>
              </div>
              <button className="primary" style={{ marginTop: "16px" }} onClick={() => setNotice("Vos vœux horaires ont été enregistrés et transmis au proviseur adjoint.")}>
                <Save size={14} aria-hidden="true" style={{ marginRight: "5px" }} />Enregistrer mes vœux
              </button>
            </div>

            <div className="compliance-card">
              <h3 style={{ display: "flex", alignItems: "center", gap: "7px" }}><AlertOctagon size={16} aria-hidden="true" /> Déclarer une Absence & Trouver un Remplaçant</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "14px" }}>
                Déclenchez immédiatement la recherche automatisée d'un enseignant disponible de la même discipline.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>Créneau de l'absence</label>
                  <select
                    value={absenceTimeSlotId}
                    onChange={(e) => setAbsenceTimeSlotId(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}
                  >
                    <option value="">Sélectionner un créneau</option>
                    {timetablingData?.timeSlots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.day} ({s.period})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="validate"
                  disabled={!absenceTimeSlotId || busy}
                  onClick={() => {
                    setAbsenceTeacherId(selectedTeacherId);
                    void fetchSubstitutions();
                  }}
                >
                  <Zap size={14} aria-hidden="true" style={{ marginRight: "5px" }} />Obtenir les propositions de remplacement
                </button>
              </div>
            </div>
          </div>
        </section>
  );
}
