import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import type {
  AuditEvent,
  Classroom,
  Dataset,
  Scenario,
  SIECLEImportPreview,
  Student,
  SubstitutionSuggestion,
  TimeSlot,
  TimetablingDataset,
  TimetablingSchedule,
} from "./types";

const emptyDataset: Dataset = {
  establishmentId: "demo-college",
  level: "6e",
  students: [],
  classrooms: [],
  dataClassification: "SYNTHETIC_DEMO_ONLY",
};

function metricLabel(value: number): string {
  return value >= 85 ? "bon" : value >= 65 ? "à surveiller" : "à améliorer";
}

function subjectColorClass(subject: string): string {
  const norm = subject.toLowerCase();
  if (norm.includes("math")) return "math";
  if (norm.includes("français")) return "fra";
  if (norm.includes("histoire") || norm.includes("géo")) return "hg";
  if (norm.includes("physique") || norm.includes("chimie")) return "pc";
  if (norm.includes("svt")) return "svt";
  if (norm.includes("anglais")) return "ang";
  if (norm.includes("eps")) return "eps";
  return "";
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"dispatch" | "timetabling" | "compliance">("dispatch");

  // Module 1 State (Dispatch)
  const [dataset, setDataset] = useState<Dataset>(emptyDataset);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [anonymous, setAnonymous] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string>();
  const [notice, setNotice] = useState("Chargement des données de démonstration…");
  const [busy, setBusy] = useState(false);
  const [draggedStudentId, setDraggedStudentId] = useState<string | null>(null);
  const [dragOverClassId, setDragOverClassId] = useState<string | null>(null);

  // Weights slider state
  const [weights, setWeights] = useState({ genderBalance: 4, academicBalance: 4, supportBalance: 3, optionBalance: 2 });
  const [isSimulation, setIsSimulation] = useState(false);

  // SIECLE & STS-Web Import state
  const [importPreview, setImportPreview] = useState<{ id: string; expiresAt: string; preview: SIECLEImportPreview }>();
  const [importLevel, setImportLevel] = useState("");
  const [targetClassrooms, setTargetClassrooms] = useState<Classroom[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const stsFileInput = useRef<HTMLInputElement>(null);

  // Module 2 State (Timetabling)
  const [timetablingData, setTimetablingData] = useState<TimetablingDataset | null>(null);
  const [schedules, setSchedules] = useState<TimetablingSchedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>();
  const [timetablingAxisFilter, setTimetablingAxisFilter] = useState<string>("ALL");
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<"ALL" | "A" | "B">("ALL");

  // Substitutions / Remplacements
  const [absenceTeacherId, setAbsenceTeacherId] = useState<string>("");
  const [absenceTimeSlotId, setAbsenceTimeSlotId] = useState<string>("");
  const [absenceReason, setAbsenceReason] = useState<string>("Stage formation académique");
  const [substitutions, setSubstitutions] = useState<SubstitutionSuggestion[] | null>(null);

  // OCR & Voice Mistral AI state
  const ocrFileInput = useRef<HTMLInputElement>(null);
  const [ocrSummary, setOcrSummary] = useState<string | null>(null);
  const [voiceSummary, setVoiceSummary] = useState<string | null>(null);

  // Audit state
  const [audit, setAudit] = useState<AuditEvent[]>([]);

  useEffect(() => {
    api.dataset()
      .then((value) => {
        setDataset(value);
        setNotice("Données synthétiques de répartition chargées.");
      })
      .catch((error: Error) => setNotice(error.message));

    api.timetablingDataset()
      .then((data) => setTimetablingData(data))
      .catch(() => {});

    api.timetablingSchedules()
      .then((res) => {
        setSchedules(res.schedules);
        if (res.schedules.length > 0) setSelectedScheduleId(res.schedules[0].id);
      })
      .catch(() => {});
  }, []);

  const selected = scenarios.find((scenario) => scenario.id === selectedId) ?? scenarios[0];

  const studentsByClass = useMemo(
    () =>
      dataset.classrooms.map((classroom) => ({
        ...classroom,
        students: dataset.students.filter((student) => selected?.assignments[student.id] === classroom.id),
      })),
    [dataset, selected]
  );
  const selectedStudent = dataset.students.find((student) => student.id === selectedStudentId);

  async function refreshAudit(): Promise<void> {
    const response = await api.audit();
    setAudit(response.events);
  }

  async function generate(): Promise<void> {
    setBusy(true);
    try {
      const response = await api.generate(weights);
      setScenarios(response.scenarios);
      setSelectedId(response.scenarios[0]?.id);
      setNotice(`${response.scenarios.length} scénarios ont été générés sous contraintes. Aucun n'est publié automatiquement.`);
      await refreshAudit();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Génération impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function move(studentId: string, targetClassroomId: string): Promise<void> {
    if (!selected) return;
    setBusy(true);
    try {
      const response = await api.move(selected.id, studentId, targetClassroomId);
      setScenarios((current) => current.map((scenario) => (scenario.id === response.scenario.id ? response.scenario : scenario)));
      setNotice("Modification enregistrée. Les contraintes dures ont été vérifiées.");
      await refreshAudit();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Déplacement refusé.");
    } finally {
      setBusy(false);
    }
  }

  async function validate(): Promise<void> {
    if (!selected || !window.confirm("Confirmer la validation humaine de ce scénario ?")) return;
    setBusy(true);
    try {
      const response = await api.validate(selected.id);
      setScenarios((current) => current.map((scenario) => (scenario.id === response.scenario.id ? response.scenario : scenario)));
      setNotice("Scénario validé humainement et scellé dans le journal d'audit.");
      await refreshAudit();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Validation impossible.");
    } finally {
      setBusy(false);
    }
  }

  // Module 2 actions
  async function generateTimetable(): Promise<void> {
    setBusy(true);
    try {
      const response = await api.generateSchedule();
      setSchedules([response.schedule, ...schedules]);
      setSelectedScheduleId(response.schedule.id);
      setNotice("Nouvel emploi du temps généré. Diagnostic d'infaisabilité et de conflits disponible.");
      await refreshAudit();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Génération de l'emploi du temps impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function validateTimetable(): Promise<void> {
    if (!selectedScheduleId || !window.confirm("Confirmer la validation de cet emploi du temps ?")) return;
    setBusy(true);
    try {
      const res = await api.validateSchedule(selectedScheduleId);
      setSchedules((curr) => curr.map((s) => (s.id === res.schedule.id ? res.schedule : s)));
      setNotice("Emploi du temps validé et scellé.");
      await refreshAudit();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Validation impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function fetchSubstitutions(): Promise<void> {
    if (!selectedScheduleId || !absenceTeacherId || !absenceTimeSlotId) return;
    setBusy(true);
    try {
      const res = await api.suggestSubstitutions(selectedScheduleId, absenceTeacherId, absenceTimeSlotId, absenceReason);
      setSubstitutions(res.suggestions);
      setNotice(`Recherche effectuée : ${res.suggestions.length} enseignant(s) disponible(s) suggéré(s).`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Calcul des remplacements impossible.");
    } finally {
      setBusy(false);
    }
  }

  // Import SIECLE & STS-Web
  async function importSIECLE(file: File): Promise<void> {
    setBusy(true);
    try {
      const result = await api.importSIECLE(file);
      setImportPreview({ id: result.importId, expiresAt: result.expiresAt, preview: result.preview });
      setImportLevel(result.preview.level === "À configurer" ? "6e" : result.preview.level);
      setTargetClassrooms(result.preview.classrooms);
      setNotice(`Aperçu SIECLE prêt : ${result.preview.students.length} élèves pseudonymisés.`);
      await refreshAudit();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import SIECLE impossible.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function importSTSWeb(file: File): Promise<void> {
    setBusy(true);
    try {
      const res = await api.importSTSWeb(file);
      const refreshedData = await api.timetablingDataset();
      setTimetablingData(refreshedData);
      setNotice(`Import STS-Web réussi : ${res.preview.rawTeacherCount} enseignants chargés.`);
      await refreshAudit();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import STS-Web impossible.");
    } finally {
      setBusy(false);
      if (stsFileInput.current) stsFileInput.current.value = "";
    }
  }

  async function scanOCRDocument(file: File): Promise<void> {
    setBusy(true);
    try {
      const res = await api.scanDocumentOCR(file);
      setOcrSummary(`${res.ocrResult.summary} (Enseignant : ${res.ocrResult.extractedPreferences.teacherName ?? "Détecté"})`);
      setNotice("Document scanné analysé avec succès par Mistral OCR (Pixtral).");
      await refreshAudit();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Scan OCR impossible.");
    } finally {
      setBusy(false);
      if (ocrFileInput.current) ocrFileInput.current.value = "";
    }
  }

  async function triggerVoiceCommand(): Promise<void> {
    setBusy(true);
    try {
      const res = await api.sendVoiceCommand();
      setVoiceSummary(`Transcription Voxtral : "${res.voiceResult.transcription}" → ${res.voiceResult.explanation}`);
      setNotice("Instruction vocale enregistrée et convertie en contrainte pour le solveur.");
      await refreshAudit();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Commande vocale impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function activateImport(): Promise<void> {
    if (!importPreview) return;
    setBusy(true);
    try {
      await api.activateSIECLEImport(importPreview.id, importLevel, targetClassrooms);
      const refreshedDataset = await api.dataset();
      setDataset(refreshedDataset);
      setScenarios([]);
      setSelectedId(undefined);
      setSelectedStudentId(undefined);
      setImportPreview(undefined);
      setNotice("Import SIECLE activé. Les données pseudonymisées sont prêtes.");
      await refreshAudit();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Activation de l'import impossible.");
    } finally {
      setBusy(false);
    }
  }

  function updateClassroom(index: number, field: keyof Classroom, value: string): void {
    setTargetClassrooms((current) =>
      current.map((classroom, currentIndex) => {
        if (currentIndex !== index) return classroom;
        if (field === "minSize" || field === "maxSize") return { ...classroom, [field]: Number(value) };
        return { ...classroom, [field]: value };
      })
    );
  }

  const selectedSchedule = schedules.find((s) => s.id === selectedScheduleId) ?? schedules[0];

  const days: TimeSlot["day"][] = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
  const periods = [
    "08h00 - 08h55",
    "09h00 - 09h55",
    "10h05 - 11h00",
    "11h05 - 12h00",
    "12h00 - 13h00",
    "13h00 - 13h55",
    "14h00 - 14h55",
    "15h05 - 16h00",
  ];

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <p className="eyebrow">🇫🇷 RÉPUBLIQUE FRANÇAISE · ÉDUCATION NATIONALE</p>
          <h1>
            EdTemps <span>— Répartition & Emplois du Temps</span>
          </h1>
        </div>
        <div className="header-actions">
          <label className="toggle">
            <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} /> Anonymiser les noms
          </label>
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept=".zip,application/zip"
            aria-label="Archive SIECLE ZIP"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importSIECLE(file);
            }}
          />
          <input
            ref={stsFileInput}
            className="visually-hidden"
            type="file"
            accept=".xml,application/xml"
            aria-label="Fichier STS-Web XML"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importSTSWeb(file);
            }}
          />
          <input
            ref={ocrFileInput}
            className="visually-hidden"
            type="file"
            accept="image/*,application/pdf"
            aria-label="Document scanné OCR"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void scanOCRDocument(file);
            }}
          />
          <button className="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
            📦 SIECLE
          </button>
          <button className="secondary" onClick={() => stsFileInput.current?.click()} disabled={busy}>
            🏛️ STS-Web
          </button>
          <button className="secondary" onClick={() => ocrFileInput.current?.click()} disabled={busy} title="Scanner une fiche de vœux papier (Mistral OCR)">
            📷 OCR (Pixtral)
          </button>
          <button className="secondary" onClick={() => void triggerVoiceCommand()} disabled={busy} title="Dicter une contrainte à la voix (Mistral Voxtral)">
            🎙️ Voxtral
          </button>
          {activeTab === "dispatch" && (
            <button className="primary" onClick={generate} disabled={busy}>
              {busy ? "Calcul en cours…" : "✨ Générer 3 scénarios"}
            </button>
          )}
          {activeTab === "timetabling" && (
            <button className="primary" onClick={generateTimetable} disabled={busy}>
              {busy ? "Calcul en cours…" : "⚡ Générer l'Emploi du temps"}
            </button>
          )}
        </div>
      </header>

      {/* NAVIGATION PAR ONGLETS */}
      <nav className="nav-tabs" aria-label="Navigation principale">
        <button className={`tab-button ${activeTab === "dispatch" ? "active" : ""}`} onClick={() => setActiveTab("dispatch")}>
          🏫 Répartition des classes
        </button>
        <button className={`tab-button ${activeTab === "timetabling" ? "active" : ""}`} onClick={() => setActiveTab("timetabling")}>
          📅 Emplois du temps & Remplacements
        </button>
        <button
          className={`tab-button ${activeTab === "compliance" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("compliance");
            void refreshAudit();
          }}
        >
          📋 Conformité, DPO & Homologation RGS
        </button>
      </nav>

      <section className="safety-banner" aria-label="Information importante">
        <strong>Décision humaine obligatoire.</strong> Le produit formule des propositions algorithmiques explicables ; seul un professionnel habilité (chef d'établissement / adjoint) peut les valider.
      </section>

      {ocrSummary && (
        <div className="safety-banner" style={{ background: "#e8f5e9", borderColor: "#18753c" }}>
          <strong>📷 Analyse OCR Mistral Pixtral :</strong> {ocrSummary}
        </div>
      )}

      {voiceSummary && (
        <div className="safety-banner" style={{ background: "#e3f2fd", borderColor: "#0288d1" }}>
          <strong>🎙️ Dictée Vocale Mistral Voxtral :</strong> {voiceSummary}
        </div>
      )}

      <p className="status" aria-live="polite">
        {notice}
      </p>

      {/* TAB 1: RÉPARTITION DES CLASSES */}
      {activeTab === "dispatch" && (
        <>
          {importPreview && (
            <section className="import-preview" aria-labelledby="import-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Import institutionnel</p>
                  <h2 id="import-title">Vérifier puis activer l'import SIECLE</h2>
                </div>
                <p>Expire à {new Date(importPreview.expiresAt).toLocaleTimeString("fr-FR")}</p>
              </div>
              <p>
                <strong>{importPreview.preview.students.length} élèves pseudonymisés</strong> détectés dans {importPreview.preview.sourceFiles.join(", ")}. Aucun INE brut n'est conservé.
              </p>
              {importPreview.preview.warnings.length > 0 && (
                <ul className="warning-list">
                  {importPreview.preview.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
              <div className="import-config">
                <label>
                  Niveau cible
                  <input value={importLevel} onChange={(event) => setImportLevel(event.target.value)} />
                </label>
                <div className="target-classes" role="group" aria-label="Classes cibles">
                  {targetClassrooms.map((classroom, index) => (
                    <div className="target-class" key={`${classroom.id}-${index}`}>
                      <label>
                        Code
                        <input value={classroom.id} onChange={(event) => updateClassroom(index, "id", event.target.value)} />
                      </label>
                      <label>
                        Libellé
                        <input value={classroom.label} onChange={(event) => updateClassroom(index, "label", event.target.value)} />
                      </label>
                      <label>
                        Min.
                        <input type="number" min="1" value={classroom.minSize} onChange={(event) => updateClassroom(index, "minSize", event.target.value)} />
                      </label>
                      <label>
                        Max.
                        <input type="number" min="1" value={classroom.maxSize} onChange={(event) => updateClassroom(index, "maxSize", event.target.value)} />
                      </label>
                    </div>
                  ))}
                </div>
                <button className="validate import-activate" onClick={activateImport} disabled={busy || targetClassrooms.length === 0}>
                  Activer les classes configurées
                </button>
              </div>
            </section>
          )}

          {/* PARAMÉTRAGE DES PONDÉRATIONS */}
          <div className="weights-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Configuration des intentions pédagogiques</p>
                <h3>Pondération des facteurs de répartition</h3>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={isSimulation} onChange={(e) => setIsSimulation(e.target.checked)} /> Mode Simulation "Et si..."
              </label>
            </div>
            <div className="weights-grid">
              <div className="weight-slider">
                <label>
                  <span>Parité F/M</span> <span>{weights.genderBalance}/10</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={weights.genderBalance}
                  onChange={(e) => setWeights({ ...weights, genderBalance: Number(e.target.value) })}
                />
              </div>
              <div className="weight-slider">
                <label>
                  <span>Mixité des niveaux</span> <span>{weights.academicBalance}/10</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={weights.academicBalance}
                  onChange={(e) => setWeights({ ...weights, academicBalance: Number(e.target.value) })}
                />
              </div>
              <div className="weight-slider">
                <label>
                  <span>Équilibre Besoins (PAP/PPS)</span> <span>{weights.supportBalance}/10</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={weights.supportBalance}
                  onChange={(e) => setWeights({ ...weights, supportBalance: Number(e.target.value) })}
                />
              </div>
              <div className="weight-slider">
                <label>
                  <span>Répartition Options</span> <span>{weights.optionBalance}/10</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={weights.optionBalance}
                  onChange={(e) => setWeights({ ...weights, optionBalance: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          {scenarios.length > 0 && (
            <>
              <section aria-labelledby="scenarios-title">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Étape 1</p>
                    <h2 id="scenarios-title">Comparer les propositions de répartition</h2>
                  </div>
                  <p>
                    {dataset.students.length} élèves · {dataset.classrooms.length} classes · niveau {dataset.level}
                  </p>
                </div>
                <div className="scenario-grid">
                  {scenarios.map((scenario, index) => (
                    <button
                      key={scenario.id}
                      className={`scenario ${selected?.id === scenario.id ? "selected" : ""}`}
                      onClick={() => setSelectedId(scenario.id)}
                      aria-pressed={selected?.id === scenario.id}
                    >
                      <span>Scénario {String.fromCharCode(65 + index)}</span>
                      <strong>
                        {scenario.metrics.score}
                        <small>/1000</small>
                      </strong>
                      <span className={scenario.state === "APPROVED" ? "chip approved" : "chip"}>
                        {scenario.state === "APPROVED" ? "Validé humainement" : "À relire"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {selected && (
                <section className="workspace" aria-labelledby="assignment-title">
                  <aside className="inspector">
                    <p className="eyebrow">Qualité du scénario</p>
                    <h2 id="assignment-title">Scénario sélectionné</h2>
                    <dl className="metrics">
                      <Metric name="Parité" value={selected.metrics.genderBalance} />
                      <Metric name="Niveaux" value={selected.metrics.academicBalance} />
                      <Metric name="Accompagnements" value={selected.metrics.supportBalance} />
                      <Metric name="Options" value={selected.metrics.optionBalance} />
                    </dl>
                    <p className="constraint-ok">✓ Aucune contrainte dure violée</p>

                    <div className="export-actions">
                      <a href={api.exportCsvUrl(selected.id)} download={`repartition-${selected.id}.csv`}>
                        📥 Export CSV
                      </a>
                      <a href={api.exportPronoteUrl(selected.id)} download={`repartition-${selected.id}-pronote.json`}>
                        📦 Export PRONOTE
                      </a>
                    </div>

                    <hr />
                    <h3>Modifier au clavier</h3>
                    <label htmlFor="student">Élève à déplacer</label>
                    <select
                      id="student"
                      value={selectedStudentId ?? ""}
                      onChange={(event) => setSelectedStudentId(event.target.value || undefined)}
                      disabled={selected.state === "APPROVED"}
                    >
                      <option value="">Sélectionner un élève</option>
                      {dataset.students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {nameOf(student, anonymous)} — {dataset.classrooms.find((item) => item.id === selected.assignments[student.id])?.label}
                        </option>
                      ))}
                    </select>
                    {selectedStudent && <Explanation student={selectedStudent} scenario={selected} />}
                    <fieldset disabled={!selectedStudentId || busy || selected.state === "APPROVED"}>
                      <legend>Déplacer vers</legend>
                      {dataset.classrooms
                        .filter((classroom) => classroom.id !== selected.assignments[selectedStudentId ?? ""])
                        .map((classroom) => (
                          <button key={classroom.id} className="secondary move-button" onClick={() => move(selectedStudentId!, classroom.id)}>
                            {classroom.label}
                          </button>
                        ))}
                    </fieldset>
                    <button className="validate" onClick={validate} disabled={busy || selected.state === "APPROVED"}>
                      {selected.state === "APPROVED" ? "Validation enregistrée" : "Valider humainement"}
                    </button>
                    <p className="hint">La validation n'est pas une publication et ne remplace pas la relecture CPE / direction.</p>
                  </aside>

                  {/* KANBAN DES CLASSES AVEC DRAG & DROP */}
                  <div className="board" aria-label="Répartition des élèves par classe">
                    {studentsByClass.map((classroom) => (
                      <section
                        className={`class-column ${dragOverClassId === classroom.id ? "drag-over" : ""}`}
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
                            void move(draggedStudentId, classroom.id);
                          }
                        }}
                      >
                        <header>
                          <h3 id={`title-${classroom.id}`}>{classroom.label}</h3>
                          <span>
                            {classroom.students.length}/{classroom.maxSize}
                          </span>
                        </header>
                        <div className="student-list">
                          {classroom.students.map((student) => (
                            <button
                              key={student.id}
                              draggable={selected.state !== "APPROVED"}
                              onDragStart={() => setDraggedStudentId(student.id)}
                              onDragEnd={() => setDraggedStudentId(null)}
                              className={`student-card ${selectedStudentId === student.id ? "active" : ""}`}
                              onClick={() => setSelectedStudentId(student.id)}
                              aria-pressed={selectedStudentId === student.id}
                            >
                              <span>{nameOf(student, anonymous)}</span>
                              <small>
                                {student.levelAverage.toFixed(1)}/20{" "}
                                {student.supportFlags.length > 0 ? `· ${student.supportFlags.join("/")}` : ""}
                              </small>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {/* TAB 2: EMPLOIS DU TEMPS & REMPLACEMENTS */}
      {activeTab === "timetabling" && (
        <section aria-labelledby="timetabling-title">
          <div className="timetabling-header">
            <div>
              <p className="eyebrow">Module 2 — Recherche Opérationnelle</p>
              <h2 id="timetabling-title">Génération & Gestion des Emplois du Temps</h2>
            </div>
            <div className="axis-selector">
              <label htmlFor="week-select">Rythme :</label>
              <select id="week-select" value={selectedWeekFilter} onChange={(e) => setSelectedWeekFilter(e.target.value as "ALL" | "A" | "B")}>
                <option value="ALL">Toutes les semaines</option>
                <option value="A">Semaine A uniquement</option>
                <option value="B">Semaine B uniquement</option>
              </select>

              <label htmlFor="axis-select">Axe :</label>
              <select id="axis-select" value={timetablingAxisFilter} onChange={(e) => setTimetablingAxisFilter(e.target.value)}>
                <option value="ALL">Vue globale des cours</option>
                <option value="6A">Classe 6e A</option>
                <option value="6B">Classe 6e B</option>
                <option value="prof-math-1">Mme Martin (Maths)</option>
                <option value="prof-fra-1">M. Dubois (Français)</option>
                <option value="room-101">Salle 101</option>
              </select>
              <button className="validate" style={{ margin: 0, width: "auto" }} onClick={validateTimetable} disabled={!selectedSchedule || selectedSchedule.state === "APPROVED"}>
                {selectedSchedule?.state === "APPROVED" ? "Validé" : "Valider l'EDT"}
              </button>
            </div>
          </div>

          {/* PANNEAU DE GESTION DES REMPLACEMENTS */}
          <div className="substitutions-panel">
            <h3>🚨 Gestion des Absences & Remplacements d'Enseignants</h3>
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
                Trouver un remplaçant
              </button>
            </div>

            {substitutions && (
              <div className="suggestions-list">
                <p>
                  <strong>Enseignants disponibles et qualifiés pour substitution :</strong>
                </p>
                {substitutions.length === 0 ? (
                  <p style={{ color: "#d9381e" }}>Aucun enseignant disponible sur ce créneau.</p>
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
                                  <strong>
                                    {course.subject} ({course.classroomId})
                                  </strong>
                                  <small>
                                    {teacher?.displayName} · {room?.label}
                                  </small>
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
      )}

      {/* TAB 3: CONFORMITÉ, DPO & HOMOLOGATION RGS */}
      {activeTab === "compliance" && (
        <section aria-labelledby="compliance-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Cadre réglementaire & Homologation Éducation Nationale</p>
              <h2 id="compliance-title">Registre DPO, Homologation RGS (EBIOS RM) & Accessibilité RGAA</h2>
            </div>
            <button className="secondary" onClick={() => void refreshAudit()}>
              Actualiser l'audit
            </button>
          </div>

          <div className="compliance-grid">
            <div className="compliance-card">
              <h3>Dossier RGPD & Traitement des Mineurs</h3>
              <div className="aipd-item">
                <strong>Responsable de Traitement</strong>
                <span>Chef d'établissement / DASEN (l'éditeur est sous-traitant Art. 28 RGPD).</span>
              </div>
              <div className="aipd-item">
                <strong>Base légale</strong>
                <span>Mission d'intérêt public (Art. 6.1.e RGPD). Aucun consentement révocable requis pour les élèves.</span>
              </div>
              <div className="aipd-item">
                <strong>Minimisation des données</strong>
                <span>Seuls l'INE pseudonymisé, le sexe, la moyenne et les flags PAP/PPS sont traités.</span>
              </div>
              <div className="aipd-item">
                <strong>Protection des mineurs (Art. 22)</strong>
                <span>Aucune décision 100% automatisée. Seule la validation humaine officialise un scénario.</span>
              </div>
            </div>

            <div className="compliance-card">
              <h3>Homologation RGS & Accessibilité RGAA</h3>
              <div className="aipd-item">
                <strong>Homologation de Sécurité RGS</strong>
                <span>Dossier d'analyse de risques conforme à la méthode EBIOS RM (RGS v2.0). Chiffrement AES-256 et TLS 1.3.</span>
              </div>
              <div className="aipd-item">
                <strong>SecNumCloud (ANSSI)</strong>
                <span>Infrastructure cible exclusivement basée dans l'UE, garantissant l'immunité aux lois extraterritoriales.</span>
              </div>
              <div className="aipd-item">
                <strong>Déclaration d’Accessibilité RGAA</strong>
                <span>Service numérique conforme au RGAA Niveau AA (navigation au clavier, focus outlines, contrastes DSFR).</span>
              </div>
              <div className="export-actions" style={{ marginTop: "16px" }}>
                <a href={api.cnilRegisterUrl()} download="registre-cnil-demo-college.json">
                  📜 Registre CNIL (JSON)
                </a>
                <a href={api.dpiaDocumentUrl()} download="aipd-dpia-demo-college.md">
                  📄 Modèle AIPD (Markdown)
                </a>
              </div>
            </div>
          </div>

          <section className="audit-section" aria-labelledby="audit-title" style={{ marginTop: "30px" }}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Traçabilité légale</p>
                <h2 id="audit-title">Journal d'audit immuable</h2>
              </div>
            </div>
            {audit.length === 0 ? (
              <p>Aucun événement enregistré dans cette session.</p>
            ) : (
              <ul className="audit-list">
                {audit.map((event) => (
                  <li key={event.id}>
                    <time>{new Date(event.occurredAt).toLocaleTimeString("fr-FR")}</time> <strong>{event.eventType}</strong> — acteur : {event.actorId}
                    {event.scenarioId ? ` · ${event.scenarioId}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
      )}
    </main>
  );
}

function Metric({ name, value }: { name: string; value: number }) {
  return (
    <div>
      <dt>{name}</dt>
      <dd>
        <span className="metric-bar">
          <i style={{ width: `${value}%` }} />
        </span>
        <strong>{value}%</strong>
        <small>{metricLabel(value)}</small>
      </dd>
    </div>
  );
}

function Explanation({ student, scenario }: { student: Student; scenario: Scenario }) {
  const explanation = scenario.explanations[student.id];
  if (!explanation) return null;
  return (
    <div className="explanation">
      <h3>Pourquoi cette affectation ?</h3>
      <ul>
        {explanation.hardConstraints.map((value) => (
          <li key={value}>✓ {value}</li>
        ))}
      </ul>
      <ul>
        {explanation.softConsiderations.map((value) => (
          <li key={value}>↗ {value}</li>
        ))}
      </ul>
    </div>
  );
}

function nameOf(student: Student, anonymous: boolean): string {
  return anonymous ? student.initials : student.displayName;
}
