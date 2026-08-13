import { X, ShieldCheck, Lock, Pencil, Ruler, Globe, Save, BarChart3, NotebookPen, User, Clock, FileText, MapPin, ClipboardList, Plus, HeartHandshake, GraduationCap, Scale, School, Sparkles, CheckCircle2 } from "lucide-react";
import type { AuditEvent, Dataset, Gender, Scenario, Student } from "../../types";
import { getAvatarColor, nameOf } from "../../utils/format";
import {
  OPTION_TITLES,
  SUPPORT_FLAG_TITLES,
  OFFICIAL_LV1_LIST,
  OFFICIAL_LV2_LIST,
  OFFICIAL_OPTIONS_ONLY,
  OFFICIAL_NATIONAL_SUBJECTS,
} from "../../constants/referentiels";

export function StudentDetailModal({
  inspectStudent,
  setInspectStudent,
  selected,
  dataset,
  anonymous,
  isEditingStudent,
  setIsEditingStudent,
  editStudentForm,
  setEditStudentForm,
  editReason,
  setEditReason,
  userRole,
  setUserRole,
  handleSaveStudentEdit,
  audit,
}: {
  inspectStudent: Student;
  setInspectStudent: (s: Student | null) => void;
  selected: Scenario | undefined;
  dataset: Dataset;
  anonymous: boolean;
  isEditingStudent: boolean;
  setIsEditingStudent: (v: boolean) => void;
  editStudentForm: Student | null;
  setEditStudentForm: (s: Student | null) => void;
  editReason: string;
  setEditReason: (v: string) => void;
  userRole: "HEADMASTER_ADMIN" | "READONLY_TEACHER";
  setUserRole: (v: "HEADMASTER_ADMIN" | "READONLY_TEACHER") => void;
  handleSaveStudentEdit: () => Promise<void> | void;
  audit: AuditEvent[];
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
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 4000,
            padding: "20px",
          }}
          onClick={() => setInspectStudent(null)}
        >
          <div
            className="modal-card"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-lg)",
              maxWidth: "640px",
              width: "100%",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              padding: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const rawIneId = inspectStudent.id.startsWith("student-") ? inspectStudent.id.slice(8) : inspectStudent.id;
              const ineDisplay = anonymous ? `INE-SHA256-${rawIneId.slice(0, 8).toUpperCase()}… (HMAC)` : inspectStudent.id;
              const assignedClassId = selected?.assignments[inspectStudent.id];
              const assignedClassroom = dataset.classrooms.find((c) => c.id === assignedClassId);

              return (
                <>
                  {/* En-tête Fixe de la Modale */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", padding: "18px 24px", background: "var(--bg-card)", flexShrink: 0 }}>
                    <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                      <div
                        className="ui-tooltip"
                        data-tooltip="Couleur d'identification visuelle unique attribuée à l'élève pour le repérage"
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          background: getAvatarColor(inspectStudent.id),
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: "1.1rem",
                          boxShadow: "var(--shadow-sm)",
                          flexShrink: 0,
                          cursor: "help",
                        }}
                        title={anonymous ? `Identifiant visuel unique (${inspectStudent.initials})` : `Identifiant visuel unique (${inspectStudent.displayName})`}
                      >
                        {inspectStudent.initials}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span className="brand-badge" style={{ background: "var(--bg-subtle)", color: "var(--primary-brand)", border: "1px solid var(--border-light)", fontSize: "0.72rem", padding: "2px 8px", borderRadius: "12px", fontWeight: 800 }}>
                            DOSSIER PÉDAGOGIQUE ÉLÈVE
                          </span>
                          <span style={{ background: "var(--card-success-bg)", color: "var(--card-success-text)", border: "1px solid var(--card-success-border)", fontSize: "0.72rem", padding: "2px 8px", borderRadius: "12px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                            <MapPin size={11} aria-hidden="true" /> {assignedClassroom ? assignedClassroom.label : "Non affecté"}
                          </span>
                          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 700 }}>
                            Sexe : {inspectStudent.gender === "F" ? "Fille ♀" : inspectStudent.gender === "M" ? "Garçon ♂" : "Non spécifié"}
                          </span>
                        </div>
                        <h2 style={{ margin: "3px 0 2px", fontSize: "1.35rem", fontWeight: 800, color: "var(--text-main)" }}>
                          {nameOf(inspectStudent, anonymous)}
                        </h2>
                        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.78rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                          <Lock size={12} aria-hidden="true" /> Identifiant RGPD : <code style={{ fontFamily: "var(--font-mono)", background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.76rem" }}>{ineDisplay}</code>
                          &nbsp;·&nbsp;
                          Niveau : <strong>{dataset.level}</strong> (Né(e) en 2015 · 11 ans)
                        </p>
                      </div>
                    </div>
                    <button
                      className="icon-btn-subtle"
                      onClick={() => setInspectStudent(null)}
                      style={{ padding: "6px", fontSize: "1.1rem", borderRadius: "50%", cursor: "pointer", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                      title="Fermer la fenêtre"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>

                  {/* BARRE DE SÉCURITÉ & HABILITATION RGPD */}
                  <div style={{ background: userRole === "HEADMASTER_ADMIN" ? "var(--card-highlight-bg)" : "var(--bg-subtle)", borderBottom: "1px solid var(--border-light)", padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: 800, color: userRole === "HEADMASTER_ADMIN" ? "var(--card-highlight-text)" : "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        {userRole === "HEADMASTER_ADMIN" ? <ShieldCheck size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
                        {userRole === "HEADMASTER_ADMIN" ? "Habilitation : Chef d'Établissement (Droits Écriture)" : "Mode : Consultation Seule"}
                      </span>
                      <button
                        onClick={() => {
                          setUserRole(userRole === "HEADMASTER_ADMIN" ? "READONLY_TEACHER" : "HEADMASTER_ADMIN");
                          if (userRole === "HEADMASTER_ADMIN") setIsEditingStudent(false);
                        }}
                        style={{ background: "none", border: "none", color: "var(--indigo-accent)", cursor: "pointer", textDecoration: "underline", fontSize: "0.75rem", fontWeight: 700, padding: 0 }}
                        title="Permuter le rôle d'utilisateur pour tester les permissions de sécurité"
                      >
                        ({userRole === "HEADMASTER_ADMIN" ? "Tester mode Consultation" : "Activer Droits Chef d'Établissement"})
                      </button>
                    </div>
                    {!isEditingStudent ? (
                      <button
                        className="primary"
                        onClick={() => {
                          if (userRole !== "HEADMASTER_ADMIN") {
                            alert("🔒 Droits insuffisants : Seul un compte habilité Chef d'Établissement / Admin peut modifier les données d'un élève.");
                            return;
                          }
                          setEditStudentForm({ ...inspectStudent });
                          setIsEditingStudent(true);
                        }}
                        style={{ padding: "4px 12px", fontSize: "0.78rem", fontWeight: 800, background: userRole === "HEADMASTER_ADMIN" ? "var(--button-primary-bg)" : "var(--text-light)", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <Pencil size={13} aria-hidden="true" /> Modifier la fiche élève
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsEditingStudent(false)}
                        style={{ background: "var(--bg-hover)", color: "var(--text-main)", border: "1px solid var(--border-light)", padding: "4px 12px", fontSize: "0.78rem", fontWeight: 800, borderRadius: "var(--radius-sm)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <X size={13} aria-hidden="true" /> Annuler l'édition
                      </button>
                    )}
                  </div>

                  {/* Corps Déroulant Interne de la Modale */}
                  <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px", flex: 1, WebkitOverflowScrolling: "touch" }}>
                    {isEditingStudent && editStudentForm ? (
                      /* FORMULAIRE D'ÉDITION SÉCURISÉ & TRACÉ */
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div style={{ background: "var(--card-success-bg)", border: "1px solid var(--card-success-border)", padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", color: "var(--card-success-text)", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                          <Scale size={15} aria-hidden="true" style={{ flexShrink: 0 }} /> <span><strong>Traçabilité CNIL Active</strong> : Toute modification enregistrée produit un événement d'audit horodaté immuable (`STUDENT_UPDATED`).</span>
                        </div>

                        {/* Sexe & Moyenne */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
                          <div>
                            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "4px" }}>
                              Genre / Sexe :
                            </label>
                            <select
                              value={editStudentForm.gender}
                              onChange={(e) => setEditStudentForm({ ...editStudentForm, gender: e.target.value as Gender })}
                              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", fontWeight: 700, background: "var(--bg-card)", color: "var(--text-main)" }}
                            >
                              <option value="F">Fille ♀</option>
                              <option value="M">Garçon ♂</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "4px" }}>
                              Moyenne Générale (/20) (Calculée ou manuelle) :
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="0.1"
                              value={editStudentForm.levelAverage}
                              onChange={(e) => setEditStudentForm({ ...editStudentForm, levelAverage: parseFloat(e.target.value) || 0 })}
                              style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", fontWeight: 800, fontSize: "0.95rem", background: "var(--bg-card)", color: "var(--text-main)" }}
                            />
                          </div>
                        </div>

                        {/* ÉDITION DES NOTES PAR MATIÈRE */}
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary-brand)", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                              <Ruler size={14} aria-hidden="true" /> Édition des Notes par Matière (/20) :
                            </label>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const default9 = [
                                    { subject: "Mathématiques", score: 12.5 },
                                    { subject: "Français", score: 13.0 },
                                    { subject: "Histoire-Géographie & EMC", score: 12.0 },
                                    { subject: "SVT (Sciences de la Vie et de la Terre)", score: 14.0 },
                                    { subject: "Physique-Chimie", score: 11.5 },
                                    { subject: "Technologie", score: 13.5 },
                                    { subject: "Anglais (LVA / LV1)", score: 14.0 },
                                    { subject: "EPS (Éducation Physique et Sportive)", score: 15.0 },
                                    { subject: "Arts Plastiques", score: 14.5 },
                                  ];
                                  const avg = default9.reduce((sum, g) => sum + g.score, 0) / default9.length;
                                  setEditStudentForm({ ...editStudentForm, subjectGrades: default9, levelAverage: parseFloat(avg.toFixed(1)) });
                                }}
                                style={{ background: "var(--button-primary-bg)", color: "#ffffff", border: "none", padding: "4px 8px", borderRadius: "var(--radius-sm)", fontSize: "0.72rem", fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                              >
                                <ClipboardList size={12} aria-hidden="true" /> 9 Matières Officieuses
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const currentGrades = editStudentForm.subjectGrades || [];
                                  const newGrades = [...currentGrades, { subject: OFFICIAL_NATIONAL_SUBJECTS[0], score: 10.0 }];
                                  const avg = newGrades.reduce((sum, g) => sum + g.score, 0) / newGrades.length;
                                  setEditStudentForm({ ...editStudentForm, subjectGrades: newGrades, levelAverage: parseFloat(avg.toFixed(1)) });
                                }}
                                style={{ background: "var(--card-highlight-bg)", color: "var(--card-highlight-text)", border: "1px solid var(--card-highlight-border)", padding: "4px 8px", borderRadius: "var(--radius-sm)", fontSize: "0.72rem", fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                              >
                                <Plus size={12} aria-hidden="true" /> Ajouter une matière
                              </button>
                            </div>
                          </div>

                          <datalist id="official-national-subjects-list">
                            {OFFICIAL_NATIONAL_SUBJECTS.map((s) => (
                              <option key={s} value={s} />
                            ))}
                          </datalist>

                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "var(--bg-subtle)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", maxHeight: "220px", overflowY: "auto" }}>
                            {(!editStudentForm.subjectGrades || editStudentForm.subjectGrades.length === 0) ? (
                              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                                Aucune note individuelle enregistrée. Cliquez sur "9 Matières Officieuses" ou "Ajouter une matière" ci-dessus.
                              </span>
                            ) : (
                              editStudentForm.subjectGrades.map((sg, idx) => (
                                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 90px 32px", gap: "8px", alignItems: "center" }}>
                                  <input
                                    type="text"
                                    list="official-national-subjects-list"
                                    value={sg.subject}
                                    onChange={(e) => {
                                      const updated = [...(editStudentForm.subjectGrades || [])];
                                      updated[idx] = { ...updated[idx], subject: e.target.value };
                                      setEditStudentForm({ ...editStudentForm, subjectGrades: updated });
                                    }}
                                    placeholder="Choisir ou saisir une matière officielle"
                                    style={{ padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", fontSize: "0.82rem", fontWeight: 700, background: "var(--bg-card)", color: "var(--text-main)" }}
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value={sg.score}
                                    onChange={(e) => {
                                      const updated = [...(editStudentForm.subjectGrades || [])];
                                      const scoreVal = parseFloat(e.target.value) || 0;
                                      updated[idx] = { ...updated[idx], score: scoreVal };
                                      const avg = updated.reduce((sum, g) => sum + g.score, 0) / updated.length;
                                      setEditStudentForm({ ...editStudentForm, subjectGrades: updated, levelAverage: parseFloat(avg.toFixed(1)) });
                                    }}
                                    style={{ padding: "6px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", fontSize: "0.86rem", fontWeight: 800, textAlign: "right", background: "var(--bg-card)", color: "var(--text-main)" }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = (editStudentForm.subjectGrades || []).filter((_, i) => i !== idx);
                                      const avg = updated.length > 0 ? updated.reduce((sum, g) => sum + g.score, 0) / updated.length : editStudentForm.levelAverage;
                                      setEditStudentForm({ ...editStudentForm, subjectGrades: updated, levelAverage: parseFloat(avg.toFixed(1)) });
                                    }}
                                    style={{ background: "var(--card-error-bg)", color: "var(--card-error-text)", border: "1px solid var(--card-error-border)", borderRadius: "var(--radius-sm)", padding: "4px", cursor: "pointer", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}
                                    title="Supprimer cette matière"
                                  >
                                    <X size={13} aria-hidden="true" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* SÉLECTION EXPLICITE LV1 (LVA) & LV2 (LVB) */}
                        <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-light)", padding: "12px", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: "10px" }}>
                          <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Globe size={14} aria-hidden="true" /> Langues Vivantes Réglementaires (Programme Officiel MEN) :
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                            {/* Langue Vivante 1 (LVA) */}
                            <div>
                              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "4px" }}>
                                Langue Vivante 1 (LVA) :
                              </label>
                              <select
                                value={editStudentForm.lv1 || editStudentForm.options.find((o) => o.startsWith("LVA_")) || "LVA_ANG"}
                                onChange={(e) => {
                                  const newLv1 = e.target.value;
                                  const filteredOptions = editStudentForm.options.filter((o) => !o.startsWith("LVA_"));
                                  setEditStudentForm({
                                    ...editStudentForm,
                                    lv1: newLv1,
                                    options: [...filteredOptions, newLv1],
                                  });
                                }}
                                style={{ width: "100%", padding: "7px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", fontWeight: 700, fontSize: "0.82rem", background: "var(--bg-card)", color: "var(--text-main)" }}
                              >
                                {OFFICIAL_LV1_LIST.map((item) => (
                                  <option key={item.code} value={item.code}>{item.label}</option>
                                ))}
                              </select>
                            </div>

                            {/* Langue Vivante 2 (LVB) */}
                            <div>
                              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "4px" }}>
                                Langue Vivante 2 (LVB) :
                              </label>
                              <select
                                value={editStudentForm.lv2 || editStudentForm.options.find((o) => o.startsWith("LVB_")) || "LVB_ESP"}
                                onChange={(e) => {
                                  const newLv2 = e.target.value;
                                  const filteredOptions = editStudentForm.options.filter((o) => !o.startsWith("LVB_"));
                                  setEditStudentForm({
                                    ...editStudentForm,
                                    lv2: newLv2,
                                    options: [...filteredOptions, newLv2],
                                  });
                                }}
                                style={{ width: "100%", padding: "7px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", fontWeight: 700, fontSize: "0.82rem", background: "var(--bg-card)", color: "var(--text-main)" }}
                              >
                                <option value="">-- Aucune LV2 --</option>
                                {OFFICIAL_LV2_LIST.map((item) => (
                                  <option key={item.code} value={item.code}>{item.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Dispositifs d'Accompagnement */}
                        <div>
                          <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <HeartHandshake size={14} aria-hidden="true" /> Dispositifs & Aménagements Pédagogiques (PAP, PPS, PAI, PPRE, ULIS) :
                          </label>
                          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            {(["PAP", "PPS", "PAI", "PPRE", "ULIS"] as const).map((flag) => {
                              const checked = editStudentForm.supportFlags.includes(flag);
                              return (
                                <label key={flag} style={{ display: "flex", alignItems: "center", gap: "6px", background: checked ? "var(--card-highlight-bg)" : "var(--bg-subtle)", border: `1px solid ${checked ? "var(--card-highlight-border)" : "var(--border-light)"}`, padding: "6px 12px", borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: "0.82rem", fontWeight: 800, color: checked ? "var(--card-highlight-text)" : "var(--text-main)" }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const flags = e.target.checked
                                        ? [...editStudentForm.supportFlags, flag]
                                        : editStudentForm.supportFlags.filter((f) => f !== flag);
                                      setEditStudentForm({ ...editStudentForm, supportFlags: flags });
                                    }}
                                  />
                                  <span>{flag}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Options Scolaires, LCA & Sections */}
                        <div>
                          <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <GraduationCap size={14} aria-hidden="true" /> Options Facultatives, LCA & Sections Particulières :
                          </label>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", padding: "10px", background: "var(--bg-subtle)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
                            {OFFICIAL_OPTIONS_ONLY.map((item) => {
                              const checked = editStudentForm.options.includes(item.code);
                              return (
                                <label key={item.code} title={item.label} style={{ display: "flex", alignItems: "center", gap: "6px", background: checked ? "var(--card-purple-bg)" : "var(--bg-card)", border: `1px solid ${checked ? "var(--card-purple-border)" : "var(--border-light)"}`, padding: "5px 10px", borderRadius: "var(--radius-sm)", cursor: "pointer", fontSize: "0.78rem", fontWeight: 800, color: checked ? "var(--card-purple-text)" : "var(--text-main)" }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const currentOpts = editStudentForm.options.filter((o) => o !== item.code);
                                      const newOpts = e.target.checked ? [...currentOpts, item.code] : currentOpts;
                                      setEditStudentForm({ ...editStudentForm, options: newOpts });
                                    }}
                                  />
                                  <span>{item.code} ({item.label.split(" ")[0]})</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Observations / Appréciation */}
                        <div>
                          <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <NotebookPen size={13} aria-hidden="true" /> Appréciation du Conseil de Classe :
                          </label>
                          <textarea
                            rows={2}
                            value={editStudentForm.teacherComments || ""}
                            onChange={(e) => setEditStudentForm({ ...editStudentForm, teacherComments: e.target.value })}
                            style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", fontSize: "0.85rem", fontFamily: "var(--font-sans)", background: "var(--bg-card)", color: "var(--text-main)" }}
                            placeholder="Remarques et appréciations..."
                          />
                        </div>

                        {/* Motif de la Modification (CNIL) */}
                        <div>
                          <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--indigo-accent)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Scale size={13} aria-hidden="true" /> Motif de l'Ajustement (Obligatoire pour l'Audit) :
                          </label>
                          <input
                            type="text"
                            value={editReason}
                            onChange={(e) => setEditReason(e.target.value)}
                            placeholder="Ex: Décision du conseil de classe / Ajustement du profil d'apprentissage"
                            style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", fontSize: "0.85rem", color: "var(--text-main)", fontWeight: 600 }}
                          />
                        </div>

                        <button
                          className="primary"
                          onClick={() => handleSaveStudentEdit()}
                          style={{ padding: "12px", fontWeight: 800, fontSize: "0.95rem", marginTop: "6px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                        >
                          <Save size={16} aria-hidden="true" /> Enregistrer & Sceller la Modification (CNIL Audit)
                        </button>
                      </div>
                    ) : (
                      /* MODE LECTURE CLASSIQUE ENRICHI */
                      <>
                        {/* INFOS COMPLÉMENTAIRES ÉTABLISSEMENT & ORIGINE */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                          <div style={{ background: "var(--bg-subtle)", padding: "10px 12px", borderRadius: "var(--radius-sm)" }}>
                            <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", fontWeight: 700 }}><School size={12} aria-hidden="true" /> École d'Origine :</span>
                            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>École Élémentaire Jules Ferry</span>
                          </div>
                          <div style={{ background: "var(--bg-subtle)", padding: "10px 12px", borderRadius: "var(--radius-sm)" }}>
                            <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", fontWeight: 700 }}><BarChart3 size={12} aria-hidden="true" /> IPS Théorique (Social) :</span>
                            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>108.5 (Catégorie Moyenne)</span>
                          </div>
                        </div>

                        {/* Synthese Notes par Matiere */}
                        <div>
                          <h4 style={{ margin: "0 0 10px", fontSize: "0.95rem", fontWeight: 800, color: "var(--primary-brand)", display: "flex", alignItems: "center", gap: "6px" }}>
                            <BarChart3 size={15} aria-hidden="true" /> Résultats par Matière & Moyenne Générale ({inspectStudent.levelAverage.toFixed(1)}/20)
                          </h4>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
                            {inspectStudent.subjectGrades?.map((sg) => {
                              const isHigh = sg.score >= 12;
                              const isMedium = sg.score >= 10;
                              const bgColor = isHigh ? "var(--card-success-bg)" : isMedium ? "var(--card-warning-bg)" : "var(--card-warning-bg)";
                              const textColor = isHigh ? "var(--card-success-text)" : isMedium ? "var(--card-warning-text)" : "var(--card-warning-text)";
                              const borderColor = isHigh ? "var(--card-success-border)" : isMedium ? "var(--card-warning-border)" : "var(--card-warning-border)";

                              return (
                                <div
                                  key={sg.subject}
                                  style={{
                                    background: "var(--bg-subtle)",
                                    border: "1px solid var(--border-light)",
                                    borderLeft: `4px solid ${textColor}`,
                                    padding: "10px 14px",
                                    borderRadius: "var(--radius-sm)",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: "12px",
                                    minHeight: "48px",
                                  }}
                                >
                                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)", flex: 1, wordBreak: "break-word", lineHeight: 1.25 }}>
                                    {sg.subject}
                                  </span>
                                  <span
                                    style={{
                                      background: bgColor,
                                      color: textColor,
                                      border: `1px solid ${borderColor}`,
                                      padding: "3px 8px",
                                      borderRadius: "12px",
                                      fontWeight: 800,
                                      fontSize: "0.82rem",
                                      whiteSpace: "nowrap",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {sg.score.toFixed(1)} / 20
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Vie Scolaire & Comportement */}
                        <div>
                          <h4 style={{ margin: "0 0 10px", fontSize: "0.95rem", fontWeight: 800, color: "var(--primary-brand)" }}>
                            Vie Scolaire & Consultation Individuelle
                          </h4>
                          <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-light)", padding: "8px 12px", borderRadius: "var(--radius-sm)", marginBottom: "10px", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                            <strong>ℹ️ Protection des mineurs (<a href="https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3#Article22" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary-brand)", fontWeight: 800, textDecoration: "underline" }}>Art. 22 RGPD ↗</a>) :</strong> Ces données de vie scolaire sont réservées à la consultation pédagogique individuelle et sont excluses de l'algorithme automatisé de classement et de répartition des classes.
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                            <div style={{ background: "var(--bg-subtle)", padding: "10px 14px", borderRadius: "var(--radius-sm)" }}>
                              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Autonomie & Conduite</span>
                              <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>
                                {"★".repeat(inspectStudent.behavior?.conductScore ?? 4)}{"☆".repeat(5 - (inspectStudent.behavior?.conductScore ?? 4))} ({inspectStudent.behavior?.conductScore ?? 4}/5)
                              </div>
                            </div>
                            <div style={{ background: "var(--bg-subtle)", padding: "10px 14px", borderRadius: "var(--radius-sm)" }}>
                              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Assiduité & Ponctualité</span>
                              <div style={{ fontWeight: 800, fontSize: "1rem" }}>
                                {inspectStudent.behavior?.absencesHours ?? 0}h d'absence · {inspectStudent.behavior?.tardinessCount ?? 0} retards
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Remarques & Accompagnements */}
                        <div>
                          <h4 style={{ margin: "0 0 8px", fontSize: "0.95rem", fontWeight: 800, color: "var(--primary-brand)", display: "flex", alignItems: "center", gap: "6px" }}>
                            <NotebookPen size={15} aria-hidden="true" /> Appréciation & Dispositifs Pédagogiques
                          </h4>
                          <p style={{ background: "var(--bg-subtle)", padding: "12px 14px", borderRadius: "var(--radius-sm)", margin: "0 0 10px", fontSize: "0.88rem", fontStyle: "italic", color: "var(--text-main)" }}>
                            "{inspectStudent.teacherComments ?? "Aucune observation particulière enregistrée par le conseil de classe."}"
                          </p>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {inspectStudent.supportFlags.length === 0 && inspectStudent.options.length === 0 && (
                              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Aucun aménagement spécifique ni option particulière.</span>
                            )}
                            {inspectStudent.supportFlags.map((flag) => (
                              <div
                                key={flag}
                                style={{
                                  background: "var(--badge-need-bg)",
                                  color: "var(--badge-need-text)",
                                  border: "1px solid var(--badge-need-border)",
                                  padding: "6px 12px",
                                  borderRadius: "var(--radius-sm)",
                                  fontSize: "0.82rem",
                                  fontWeight: 800,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <HeartHandshake size={13} aria-hidden="true" />
                                <div>{SUPPORT_FLAG_TITLES[flag] || `Dispositif ${flag}`}</div>
                              </div>
                            ))}
                            {inspectStudent.options.map((opt) => (
                              <div
                                key={opt}
                                style={{
                                  background: "var(--badge-option-bg)",
                                  color: "var(--badge-option-text)",
                                  border: "1px solid var(--badge-option-border)",
                                  padding: "6px 12px",
                                  borderRadius: "var(--radius-sm)",
                                  fontSize: "0.82rem",
                                  fontWeight: 800,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <GraduationCap size={13} aria-hidden="true" />
                                <div>{OPTION_TITLES[opt] || `Option ${opt}`}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* CARTE SOUVERAINE IA D'EXPLICATION DES CONTRAINTES
                            Couleurs volontairement fixes (pas de token clair/sombre) : cet encart
                            est pensé comme un "spotlight" toujours contrasté pour mettre en avant
                            l'explication algorithmique, quel que soit le thème de la page. */}
                        {selected && selected.explanations && selected.explanations[inspectStudent.id] && (
                          <div style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)", padding: "16px", borderRadius: "var(--radius-md)", color: "#ffffff", boxShadow: "0 4px 16px rgba(49, 46, 129, 0.22)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                              <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: "#ffffff", display: "flex", alignItems: "center", gap: "6px" }}>
                                <Sparkles size={15} aria-hidden="true" /> Justification Algorithmique & Motif d'Affectation
                              </h4>
                              <span style={{ background: "rgba(255, 255, 255, 0.15)", color: "#e0e7ff", padding: "2px 8px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: 800, border: "1px solid rgba(255, 255, 255, 0.25)" }}>
                                🇫🇷 Mistral AI
                              </span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {selected.explanations[inspectStudent.id].hardConstraints.map((hc, idx) => (
                                <div key={idx} style={{ background: "rgba(255, 255, 255, 0.12)", border: "1px solid rgba(255, 255, 255, 0.2)", padding: "8px 12px", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                                  <CheckCircle2 size={14} aria-hidden="true" style={{ color: "#a7f3d0", flexShrink: 0 }} />
                                  <span>{hc}</span>
                                </div>
                              ))}
                              {selected.explanations[inspectStudent.id].softConsiderations.map((sc, idx) => (
                                <div key={idx} style={{ fontSize: "0.78rem", color: "#c7d2fe", paddingLeft: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span>↗</span>
                                  <span>{sc}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* HISTORIQUE ET TRAÇABILITÉ HORODATÉE DE L'ÉLÈVE */}
                        <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "12px", marginTop: "6px" }}>
                          <h4 style={{ margin: "0 0 8px", fontSize: "0.85rem", fontWeight: 800, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                            ⏱️ Historique des Modifications (Journal d'Audit Horodaté)
                          </h4>
                          {audit.filter((a) => a.details?.studentId === inspectStudent.id || a.details?.displayName === nameOf(inspectStudent, false) || a.details?.displayName === inspectStudent.displayName).length === 0 ? (
                            <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                              Aucune modification enregistrée sur cette fiche élève.
                            </p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "140px", overflowY: "auto" }}>
                              {audit
                                .filter((a) => a.details?.studentId === inspectStudent.id || a.details?.displayName === nameOf(inspectStudent, false) || a.details?.displayName === inspectStudent.displayName)
                                .map((evt) => (
                                  <div key={evt.id} style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-light)", padding: "8px 12px", borderRadius: "var(--radius-sm)", fontSize: "0.76rem" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--primary-brand)", fontWeight: 800 }}>
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><User size={12} aria-hidden="true" /> {evt.actorId}</span>
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><Clock size={12} aria-hidden="true" /> {new Date(evt.occurredAt).toLocaleString("fr-FR")}</span>
                                    </div>
                                    <div style={{ color: "var(--text-main)", fontWeight: 700, marginTop: "2px", display: "flex", alignItems: "flex-start", gap: "4px" }}>
                                      <FileText size={12} aria-hidden="true" style={{ marginTop: "2px", flexShrink: 0 }} /> {String(evt.details?.summary || evt.eventType)}
                                    </div>
                                    {evt.details?.reason && (
                                      <div style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "0.72rem", marginTop: "2px" }}>
                                        Motif : {String(evt.details.reason)}
                                      </div>
                                    )}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
  );
}
