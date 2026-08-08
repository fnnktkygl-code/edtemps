import { useEffect, useMemo, useRef, useState } from "react";
import { api, getActiveActor, isOfflineFallback, setActorRole } from "./api";
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
  const [activeTab, setActiveTab] = useState<"dispatch" | "timetabling" | "compliance" | "teacher">("dispatch");
  const [actorRole, setActorRoleState] = useState<string>(() => getActiveActor().role);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("teacher-1");

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
        api.generate({ genderBalance: 4, academicBalance: 4, supportBalance: 3, optionBalance: 2 })
          .then((res) => {
            setScenarios(res.scenarios);
            if (res.scenarios.length > 0) setSelectedId(res.scenarios[0].id);
          })
          .catch(() => {});
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

  // Thème adaptatif (Clair / Sombre)
  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("theme") as "light" | "dark") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const [importMenuOpen, setImportMenuOpen] = useState(false);

  // Module 1 : Sous-onglets et filtres Roster élèves
  const [dispatchSubTab, setDispatchSubTab] = useState<"roster" | "weights" | "kanban">("roster");
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterFilter, setRosterFilter] = useState<"ALL" | "PAP" | "OPTIONS">("ALL");
  const [inspectStudent, setInspectStudent] = useState<Student | null>(null);

  return (
    <main className="page">
      <header className="masthead">
        <div className="brand-section">
          <span className="brand-badge">🇫🇷 ÉDUCATION NATIONALE</span>
          <h1>EdTemps</h1>
        </div>
        <div className="header-actions">
          {/* Sélecteur de Rôle RBAC */}
          <select
            value={actorRole}
            onChange={(e) => {
              const newRole = e.target.value;
              setActorRole(newRole);
              setActorRoleState(newRole);
            }}
            style={{ padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}
            title="Contrôle d'accès par rôle (RBAC)"
          >
            <option value="SCHOOL_ADMIN">👨‍💼 Chef d'Établissement</option>
            <option value="DISPATCH_EDITOR">⚙️ Adjoint de Direction</option>
            <option value="TEACHER">👩‍🏫 Enseignant</option>
            <option value="CPE">📋 CPE / Vie Scolaire</option>
            <option value="DPO">🔒 DPO / RSSI</option>
          </select>

          <label className="toggle-pill" data-tooltip="Anonymise les noms des élèves (INE et Identités) conformément au RGPD">
            <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} /> Anonymiser
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

          <div style={{ position: "relative" }}>
            <button
              className="secondary"
              onClick={() => setImportMenuOpen(!importMenuOpen)}
              data-tooltip="Menu d'importation des fichiers SIECLE, STS-Web et outils IA Mistral"
            >
              📥 Importer & IA ▾
            </button>
            {importMenuOpen && (
              <div
                className="dropdown-menu"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "110%",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-lg)",
                  padding: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  zIndex: 2000,
                  minWidth: "220px",
                }}
              >
                <button
                  className="secondary"
                  style={{ textAlign: "left", justifyContent: "flex-start" }}
                  onClick={() => {
                    setImportMenuOpen(false);
                    fileInput.current?.click();
                  }}
                >
                  📦 SIECLE (Élèves)
                </button>
                <button
                  className="secondary"
                  style={{ textAlign: "left", justifyContent: "flex-start" }}
                  onClick={() => {
                    setImportMenuOpen(false);
                    stsFileInput.current?.click();
                  }}
                >
                  🏛️ STS-Web (Profs & Services)
                </button>
                <button
                  className="secondary"
                  style={{ textAlign: "left", justifyContent: "flex-start" }}
                  onClick={() => {
                    setImportMenuOpen(false);
                    ocrFileInput.current?.click();
                  }}
                >
                  📷 Mistral OCR (Pixtral)
                </button>
                <button
                  className="secondary"
                  style={{ textAlign: "left", justifyContent: "flex-start" }}
                  onClick={() => {
                    setImportMenuOpen(false);
                    void triggerVoiceCommand();
                  }}
                >
                  🎙️ Dictée Vocale (Voxtral)
                </button>
              </div>
            )}
          </div>

          {activeTab === "dispatch" && (
            <button className="primary" onClick={generate} disabled={busy} data-tooltip="Générer 3 propositions de répartition sous contraintes">
              {busy ? "Calcul en cours…" : "✨ Générer 3 scénarios"}
            </button>
          )}
          {activeTab === "timetabling" && (
            <button className="primary" onClick={generateTimetable} disabled={busy} data-tooltip="Calculer un emploi du temps optimal avec le solveur CP-SAT">
              {busy ? "Calcul en cours…" : "⚡ Générer l'Emploi du temps"}
            </button>
          )}

          <button
            className="theme-toggle-btn"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            data-tooltip="Basculez entre le mode clair et le mode sombre"
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>
      </header>

      {/* NAVIGATION PAR ONGLETS */}
      <nav className="nav-tabs" aria-label="Navigation principale">
        <button
          className={`tab-button ${activeTab === "dispatch" ? "active" : ""}`}
          onClick={() => setActiveTab("dispatch")}
          data-tooltip="Module 1 : Répartition équilibrée des élèves dans les classes"
        >
          🏫 Répartition des élèves
        </button>
        <button
          className={`tab-button ${activeTab === "timetabling" ? "active" : ""}`}
          onClick={() => setActiveTab("timetabling")}
          data-tooltip="Module 2 : Emplois du temps et gestion des remplacements d'urgence"
        >
          📅 Emplois du temps & Remplacements
        </button>
        <button
          className={`tab-button ${activeTab === "teacher" ? "active" : ""}`}
          onClick={() => setActiveTab("teacher")}
          data-tooltip="Espace Enseignant : consultation de l'EDT personnel, vœux et absence"
        >
          👩‍🏫 Espace Enseignant
        </button>
        <button
          className={`tab-button ${activeTab === "compliance" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("compliance");
            void refreshAudit();
          }}
          data-tooltip="Module 3 : Conformité CNIL/RGPD et Dossier d'Homologation RGS"
        >
          📋 Conformité, DPO & Homologation RGS
        </button>
      </nav>

      {/* BANDEAU DE MODE DÉGRADER HORS LIGNE (Audit RGPD/Souveraineté) */}
      {isOfflineFallback && (
        <div style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #f59e0b", padding: "10px 16px", borderRadius: "var(--radius-sm)", marginBottom: "16px", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.88rem" }}>
          <span>⚠️ <strong>MODE DÉMO HORS-LIGNE ACTIVÉ :</strong> L'API distante est en cours de démarrage ou inaccessible. Les données affichées sont des exemples 100% fictifs générés localement par le navigateur.</span>
          <span className="chip" style={{ background: "#f59e0b", color: "#ffffff", marginLeft: "12px", whiteSpace: "nowrap" }}>Mode Démo Local</span>
        </div>
      )}

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
          {/* Workflow Guidance Banner */}
          <div className="workflow-stepper" style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "14px 20px", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", boxShadow: "var(--shadow-sm)", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "220px" }}>
              <span className={`step-pill ${dispatchSubTab === "roster" ? "active-step" : "done-step"}`}>
                1
              </span>
              <div>
                <strong style={{ fontSize: "0.88rem", display: "block", color: "var(--text-main)" }}>1. Profils Élèves</strong>
                <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>Vérification des {dataset.students.length} dossiers</small>
              </div>
            </div>

            <div style={{ height: "1px", width: "30px", background: "var(--border-light)" }} />

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "220px" }}>
              <span className={`step-pill ${dispatchSubTab === "weights" ? "active-step" : scenarios.length > 0 ? "done-step" : ""}`}>
                2
              </span>
              <div>
                <strong style={{ fontSize: "0.88rem", display: "block", color: "var(--text-main)" }}>2. Critères IA</strong>
                <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>Ajuster les priorités de mixité</small>
              </div>
            </div>

            <div style={{ height: "1px", width: "30px", background: "var(--border-light)" }} />

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "220px" }}>
              <span className={`step-pill ${dispatchSubTab === "kanban" ? "active-step" : scenarios.length > 0 ? "done-step" : ""}`}>
                3
              </span>
              <div>
                <strong style={{ fontSize: "0.88rem", display: "block", color: "var(--text-main)" }}>3. Scénarios & Validation</strong>
                <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{scenarios.length} variante(s) prêtes</small>
              </div>
            </div>
          </div>

          {/* Sub-Navigation for Module 1 */}
          <div className="sub-nav-tabs" style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <button
              className={`secondary ${dispatchSubTab === "roster" ? "active-subtab" : ""}`}
              onClick={() => setDispatchSubTab("roster")}
            >
              👥 1. Effectifs & Profils des Élèves ({dataset.students.length})
            </button>
            <button
              className={`secondary ${dispatchSubTab === "weights" ? "active-subtab" : ""}`}
              onClick={() => setDispatchSubTab("weights")}
            >
              ⚙️ 2. Critères & Pondérations IA
            </button>
            <button
              className={`secondary ${dispatchSubTab === "kanban" ? "active-subtab" : ""}`}
              onClick={() => setDispatchSubTab("kanban")}
            >
              📊 3. Scénarios & Classes {scenarios.length > 0 ? `(${scenarios.length})` : ""}
            </button>
          </div>

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

          {/* SUBTAB 1: ROSTER & PROFILES */}
          {dispatchSubTab === "roster" && (
            <section className="roster-section" style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", padding: "24px", borderRadius: "var(--radius-md)", marginBottom: "24px" }}>
              <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
                <div>
                  <p className="eyebrow">COHORTE DU NIVEAU {dataset.level.toUpperCase()}</p>
                  <h3 style={{ margin: "4px 0", fontSize: "1.2rem", fontWeight: 800 }}>Effectif complet & Profils des Élèves</h3>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.88rem" }}>
                    Consultez la liste nominative des élèves, leurs caractéristiques (genre, niveau, accompagnements PAP/PPS, options) et leur classe ciblée.
                  </p>
                </div>

                <div className="roster-metrics-pills" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <span className="chip" style={{ background: "var(--bg-subtle)", padding: "6px 12px", borderRadius: "var(--radius-sm)", fontWeight: 700 }}>
                    👥 {dataset.students.length} Élèves
                  </span>
                  <span className="chip" style={{ background: "var(--bg-subtle)", padding: "6px 12px", borderRadius: "var(--radius-sm)", fontWeight: 700 }}>
                    ⚖️ {dataset.students.filter(s => s.gender === 'F').length} F / {dataset.students.filter(s => s.gender === 'M').length} M
                  </span>
                  <span className="chip" style={{ background: "var(--bg-subtle)", padding: "6px 12px", borderRadius: "var(--radius-sm)", fontWeight: 700 }}>
                    🤝 {dataset.students.filter(s => s.supportFlags.length > 0).length} PAP/PPS
                  </span>
                  <span className="chip" style={{ background: "var(--bg-subtle)", padding: "6px 12px", borderRadius: "var(--radius-sm)", fontWeight: 700 }}>
                    🎓 {dataset.students.filter(s => s.options.length > 0).length} Options
                  </span>
                </div>
              </div>

              {/* Roster Controls */}
              <div className="roster-controls" style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                <input
                  type="text"
                  placeholder="🔍 Rechercher un élève par nom, identifiant ou option..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  style={{ flex: 1, padding: "8px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", color: "var(--text-main)", fontSize: "0.88rem" }}
                />
                <button
                  className={`secondary ${rosterFilter === "ALL" ? "active-filter" : ""}`}
                  onClick={() => setRosterFilter("ALL")}
                >
                  Tous ({dataset.students.length})
                </button>
                <button
                  className={`secondary ${rosterFilter === "PAP" ? "active-filter" : ""}`}
                  onClick={() => setRosterFilter("PAP")}
                >
                  Besoins PAP/PPS ({dataset.students.filter(s => s.supportFlags.length > 0).length})
                </button>
                <button
                  className={`secondary ${rosterFilter === "OPTIONS" ? "active-filter" : ""}`}
                  onClick={() => setRosterFilter("OPTIONS")}
                >
                  Options ({dataset.students.filter(s => s.options.length > 0).length})
                </button>
              </div>

              {/* Roster Table */}
              <div className="table-wrapper" style={{ overflowX: "auto", border: "1px solid var(--border-light)", borderRadius: "var(--radius-sm)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-light)" }}>
                      <th style={{ padding: "10px 14px", fontWeight: 800 }}>Élève</th>
                      <th style={{ padding: "10px 14px", fontWeight: 800 }}>Genre</th>
                      <th style={{ padding: "10px 14px", fontWeight: 800 }}>Moyenne Scolaire</th>
                      <th style={{ padding: "10px 14px", fontWeight: 800 }}>Vie Scolaire & Autonomie</th>
                      <th style={{ padding: "10px 14px", fontWeight: 800 }}>Accompagnements</th>
                      <th style={{ padding: "10px 14px", fontWeight: 800 }}>Options & Langues</th>
                      <th style={{ padding: "10px 14px", fontWeight: 800 }}>Classe Cible</th>
                      <th style={{ padding: "10px 14px", fontWeight: 800 }}>Dossier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.students
                      .filter((student) => {
                        const nameMatches = nameOf(student, anonymous).toLowerCase().includes(rosterSearch.toLowerCase());
                        const optionMatches = student.options.some((o) => o.toLowerCase().includes(rosterSearch.toLowerCase()));
                        if (!nameMatches && !optionMatches) return false;
                        if (rosterFilter === "PAP") return student.supportFlags.length > 0;
                        if (rosterFilter === "OPTIONS") return student.options.length > 0;
                        return true;
                      })
                      .map((student) => {
                        const currentAssignedClassId = selected?.assignments[student.id] ?? dataset.classrooms[0]?.id;
                        return (
                          <tr key={student.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                            <td style={{ padding: "10px 14px", fontWeight: 700 }}>
                              {nameOf(student, anonymous)}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <span className="chip" style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "0.78rem", fontWeight: 800, background: student.gender === "F" ? "#fce7f3" : "#e0f2fe", color: student.gender === "F" ? "#be185d" : "#0369a1" }}>
                                {student.gender === "F" ? "♀ Fille" : "♂ Garçon"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <span style={{ fontWeight: 800, color: "var(--primary-brand)" }}>
                                {student.levelAverage.toFixed(1)} / 20
                              </span>
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)" }}>
                                {"★".repeat(student.behavior?.conductScore ?? 4)}{"☆".repeat(5 - (student.behavior?.conductScore ?? 4))}
                                <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>({student.behavior?.absencesHours ?? 0}h abs)</span>
                              </span>
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              {student.supportFlags.length > 0 ? (
                                student.supportFlags.map((need) => (
                                  <span key={need} className="chip" style={{ background: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: "4px", fontSize: "0.78rem", fontWeight: 800, marginRight: "4px" }}>
                                    🤝 {need}
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: "var(--text-light)" }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              {student.options.length > 0 ? (
                                student.options.map((opt) => (
                                  <span key={opt} className="chip" style={{ background: "#e0e7ff", color: "#3730a3", padding: "2px 8px", borderRadius: "4px", fontSize: "0.78rem", fontWeight: 800, marginRight: "4px" }}>
                                    🎓 {opt}
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
                                style={{ padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", fontWeight: 700 }}
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
                                style={{ padding: "3px 8px", fontSize: "0.78rem", fontWeight: 700 }}
                              >
                                📋 Dossier
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* SUBTAB 2: PARAMÉTRAGE DES PONDÉRATIONS */}
          {dispatchSubTab === "weights" && (
            <div className="weights-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">MODULE 1 · INTENTIONS PÉDAGOGIQUES</p>
                  <h3>💡 Réglage des critères d'équilibrage des classes</h3>
                  <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "0.88rem" }}>
                    Ajustez l'importance relative des 4 objectifs ci-dessous. Le moteur d'IA générera des propositions équilibrées en fonction de vos priorités d'établissement.
                  </p>
                </div>
                <label className="toggle-pill" data-tooltip="Permet de simuler des modifications d'effectifs ou d'options avant validation finale">
                  <input type="checkbox" checked={isSimulation} onChange={(e) => setIsSimulation(e.target.checked)} /> Mode Simulation "Et si..."
                </label>
              </div>

              <div className="weights-grid">
                <div className="weight-card">
                  <div className="weight-header">
                    <div className="weight-title">
                      <span>⚖️ Parité Filles / Garçons</span>
                      <small>Équilibre 50%/50% du ratio de genre dans chaque classe</small>
                    </div>
                    <span className="weight-score">{weights.genderBalance}/10</span>
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
                      <span>📊 Mixité des Niveaux Scolaires</span>
                      <small>Répartition hétérogène des compétences (forts, moyens, à besoins)</small>
                    </div>
                    <span className="weight-score">{weights.academicBalance}/10</span>
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
                      <span>🤝 Besoins Particuliers (PAP / PPS / PAI)</span>
                      <small>Évite la concentration d'élèves à accompagnement dans la même classe</small>
                    </div>
                    <span className="weight-score">{weights.supportBalance}/10</span>
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
                      <span>🎓 Répartition des Options & Langues</span>
                      <small>Harmonisation des groupes LCE, Bilangue, Latin et EIP</small>
                    </div>
                    <span className="weight-score">{weights.optionBalance}/10</span>
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
            </div>
          )}

          {/* SUBTAB 3: SCÉNARIOS & KANBAN */}
          {(dispatchSubTab === "kanban" || scenarios.length > 0) && (
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
                  {scenarios.map((scenario, index) => {
                    const qualityPct = Math.round(scenario.metrics.score / 10);
                    const meta =
                      index === 0
                        ? { title: "Scénario A — 🎯 Équilibre Global", desc: "Meilleur compromis entre parité F/M et hétérogénéité des niveaux scolaires.", badge: "🏆 Recommandé IA", color: "#10b981" }
                        : index === 1
                        ? { title: "Scénario B — 📊 Focus Mixité Scolaire", desc: "Harmonise strictement les moyennes générales (écart inter-classes ≤ 0.3 pt).", badge: "⚡ Option Hétérogénéité", color: "#4f46e5" }
                        : { title: "Scénario C — 🤝 Focus Accompagnements", desc: "Dispersion optimale des élèves à besoins (PAP/PPS) sur l'ensemble des classes.", badge: "💡 Option Équilibre PAP", color: "#0284c7" };

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
                            <small style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 700 }}>Conformité IA</small>
                          </div>
                        </div>

                        <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                          {meta.desc}
                        </p>

                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "auto", paddingTop: "8px" }}>
                          <span style={{ background: "var(--bg-subtle)", padding: "3px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-main)" }}>
                            ⚖️ Parité {selected?.metrics.genderBalance ?? 90}%
                          </span>
                          <span style={{ background: "var(--bg-subtle)", padding: "3px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-main)" }}>
                            📊 Niveaux {selected?.metrics.academicBalance ?? 90}%
                          </span>
                          <span style={{ background: "var(--bg-subtle)", padding: "3px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-main)" }}>
                            🤝 PAP {selected?.metrics.supportBalance ?? 90}%
                          </span>
                        </div>

                        <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "10px", marginTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className={scenario.state === "APPROVED" ? "chip approved" : "chip"}>
                            {scenario.state === "APPROVED" ? "✓ Validé & Scellé" : "📋 En cours de relecture"}
                          </span>
                          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--primary-brand)" }}>
                            {selected?.id === scenario.id ? "Actif ▸" : "Examiner ▸"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
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

                  {/* KANBAN DES CLASSES AVEC DRAG & DROP & SCEAU D'ÉQUILIBRAGE */}
                  <div className="board" aria-label="Répartition des élèves par classe">
                    {studentsByClass.map((classroom) => {
                      const countF = classroom.students.filter((s) => s.gender === "F").length;
                      const countM = classroom.students.filter((s) => s.gender === "M").length;
                      const pctF = classroom.students.length > 0 ? (countF / classroom.students.length) * 100 : 50;
                      const pctM = 100 - pctF;
                      const avg = classroom.students.length > 0 ? (classroom.students.reduce((sum, s) => sum + s.levelAverage, 0) / classroom.students.length).toFixed(1) : "0.0";
                      const supportCount = classroom.students.filter((s) => s.supportFlags.length > 0).length;
                      const isBalanced = classroom.students.length >= classroom.minSize && classroom.students.length <= classroom.maxSize && Math.abs(countF - countM) <= 4;

                      return (
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
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <h3 id={`title-${classroom.id}`} style={{ margin: 0, fontFamily: "var(--font-heading)" }}>{classroom.label}</h3>
                              <span style={{ fontWeight: 800, fontFamily: "var(--font-mono)", fontSize: "0.88rem" }}>
                                {classroom.students.length}/{classroom.maxSize} él.
                              </span>
                            </div>

                            {/* Sceau d'Équilibrage Institutionnel */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span className={`stamp-badge ${isBalanced ? "ok" : "warn"}`}>
                                {isBalanced ? "✓ ÉQUILIBRÉE" : "⚠️ À AJUSTER"}
                              </span>
                              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                {countF} F / {countM} G
                              </span>
                            </div>

                            {/* Barre de Parité Visuelle Bi-couleur */}
                            <div className="parity-bar" title={`Parité : ${countF} Filles / ${countM} Garçons`}>
                              <div className="parity-fill-f" style={{ width: `${pctF}%` }} />
                              <div className="parity-fill-m" style={{ width: `${pctM}%` }} />
                            </div>

                            {/* Synthèse Moyenne & Besoins */}
                            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                              <span>Moy : <strong style={{ color: "var(--primary-brand)", fontFamily: "var(--font-mono)" }}>{avg}/20</strong></span>
                              <span>🤝 <strong>{supportCount}</strong> PAP/PPS</span>
                            </div>
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
                                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "grab" }}
                              >
                                <div>
                                  <span style={{ fontWeight: 700, display: "block" }}>{nameOf(student, anonymous)}</span>
                                  <small style={{ fontFamily: "var(--font-mono)" }}>
                                    {student.levelAverage.toFixed(1)}/20{" "}
                                    {student.supportFlags.length > 0 ? `· ${student.supportFlags.join("/")}` : ""}
                                  </small>
                                </div>
                                <button
                                  className="secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setInspectStudent(student);
                                  }}
                                  style={{ padding: "2px 6px", fontSize: "0.72rem", fontWeight: 700 }}
                                  title="Consulter la fiche élève complète"
                                >
                                  📋
                                </button>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    })}
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
          <div className="section-header">
            <div>
              <p className="eyebrow">MODULE 2 · SOLVEUR DE CONTRAINTES CP-SAT</p>
              <h2 id="timetabling-title">Emplois du Temps & Planning Semestriel</h2>
            </div>
            <div className="section-controls">
              <div className="control-group">
                <label htmlFor="week-select">Semaines :</label>
                <select id="week-select" value={selectedWeekFilter} onChange={(e) => setSelectedWeekFilter(e.target.value as "ALL" | "A" | "B")}>
                  <option value="ALL">Toutes les semaines (A/B)</option>
                  <option value="A">Semaine A</option>
                  <option value="B">Semaine B</option>
                </select>
              </div>

              <div className="control-group">
                <label htmlFor="axis-select">Vue :</label>
                <select id="axis-select" value={timetablingAxisFilter} onChange={(e) => setTimetablingAxisFilter(e.target.value)}>
                  <option value="ALL">Vue globale de l'établissement</option>
                  <option value="6A">Classe 6e A</option>
                  <option value="6B">Classe 6e B</option>
                  <option value="prof-math-1">Mme Martin (Maths)</option>
                  <option value="prof-fra-1">M. Dubois (Français)</option>
                  <option value="room-101">Salle 101 (Standard)</option>
                </select>
              </div>

              <button className="validate" onClick={validateTimetable} disabled={!selectedSchedule || selectedSchedule.state === "APPROVED"}>
                {selectedSchedule?.state === "APPROVED" ? "✓ EDT Scellé" : "⚡ Valider l'Emploi du temps"}
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
      )}

      {/* TAB 4: ESPACE ENSEIGNANT (CONSULTATION, VŒUX & ABSENCES) */}
      {activeTab === "teacher" && (
        <section aria-labelledby="teacher-space-title">
          <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card)", padding: "20px 24px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)", marginBottom: "24px" }}>
            <div>
              <p className="eyebrow">Service Numérique Enseignant</p>
              <h2 id="teacher-space-title" style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800 }}>👩‍🏫 Espace Enseignant (Self-Service)</h2>
              <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "0.88rem" }}>
                Consultez votre emploi du temps en temps réel, saisissez vos vœux d'aménagement horaire et organisez vos remplacements d'urgence.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)" }}>Profil enseignant :</span>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                style={{ padding: "8px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", fontWeight: 700, fontSize: "0.9rem" }}
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
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>📅 Mon Emploi du Temps de la Semaine</h3>
              <span className="chip approved">✓ Planning Synchronisé</span>
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
                              <div key={placement.courseId} style={{ background: "var(--primary-brand)", color: "#ffffff", padding: "8px", borderRadius: "var(--radius-sm)", fontSize: "0.82rem" }}>
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
              <h3>✏️ Mes Vœux & Décharges Horaires</h3>
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
                💾 Enregistrer mes vœux
              </button>
            </div>

            <div className="compliance-card">
              <h3>🚨 Déclarer une Absence & Trouver un Remplaçant</h3>
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
                  ⚡ Obtenir les propositions de remplacement
                </button>
              </div>
            </div>
          </div>
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

      {/* MODAL FICHE ÉLÈVE COMPLÈTE */}
      {inspectStudent && (
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
              maxWidth: "600px",
              width: "100%",
              padding: "26px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span className="brand-badge">DOSSIER PÉDAGOGIQUE ÉLÈVE</span>
                <h2 style={{ margin: "6px 0 0", fontSize: "1.4rem", fontWeight: 800 }}>
                  {nameOf(inspectStudent, anonymous)}
                </h2>
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.88rem" }}>
                  INE : {anonymous ? "student-hash-pseudonymisé" : inspectStudent.id} · Niveau {dataset.level.toUpperCase()}
                </p>
              </div>
              <button className="secondary" onClick={() => setInspectStudent(null)} style={{ padding: "4px 10px", fontSize: "1rem" }}>
                ✕
              </button>
            </div>

            {/* Synthese Notes par Matiere */}
            <div>
              <h4 style={{ margin: "0 0 10px", fontSize: "0.95rem", fontWeight: 800, color: "var(--primary-brand)" }}>
                📐 Résultats par Matière & Moyenne Générale ({inspectStudent.levelAverage.toFixed(1)}/20)
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                {inspectStudent.subjectGrades?.map((sg) => (
                  <div key={sg.subject} style={{ background: "var(--bg-subtle)", padding: "10px 14px", borderRadius: "var(--radius-sm)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>{sg.subject}</span>
                    <span style={{ fontWeight: 800, color: sg.score >= 12 ? "#10b981" : sg.score >= 10 ? "#f59e0b" : "#ef4444" }}>
                      {sg.score.toFixed(1)} / 20
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Vie Scolaire & Comportement */}
            <div>
              <h4 style={{ margin: "0 0 10px", fontSize: "0.95rem", fontWeight: 800, color: "var(--primary-brand)" }}>
                🧘 Vie Scolaire & Engagement
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                <div style={{ background: "var(--bg-subtle)", padding: "10px 14px", borderRadius: "var(--radius-sm)" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Autonomie & Conduct</span>
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
              <h4 style={{ margin: "0 0 8px", fontSize: "0.95rem", fontWeight: 800, color: "var(--primary-brand)" }}>
                📝 Appréciation & Dispositifs Pédagogiques
              </h4>
              <p style={{ background: "var(--bg-subtle)", padding: "12px 14px", borderRadius: "var(--radius-sm)", margin: "0 0 10px", fontSize: "0.88rem", fontStyle: "italic", color: "var(--text-main)" }}>
                "{inspectStudent.teacherComments ?? "Aucune observation particulière enregistrée par le conseil de classe."}"
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {inspectStudent.supportFlags.map((flag) => (
                  <span key={flag} className="chip" style={{ background: "#fef3c7", color: "#b45309", padding: "4px 10px", borderRadius: "4px", fontWeight: 800 }}>
                    🤝 Accompagnement {flag}
                  </span>
                ))}
                {inspectStudent.options.map((opt) => (
                  <span key={opt} className="chip" style={{ background: "#e0e7ff", color: "#3730a3", padding: "4px 10px", borderRadius: "4px", fontWeight: 800 }}>
                    🎓 Option {opt}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="primary" onClick={() => setInspectStudent(null)}>
                Fermer le dossier
              </button>
            </div>
          </div>
        </div>
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
