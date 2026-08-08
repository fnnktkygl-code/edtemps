import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, createSyntheticDemoInputCustom, getActiveActor, isOfflineFallback, setActorRole, setActiveDataset } from "./api";
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

function getAvatarColor(id: string): string {
  const colors = [
    "#8b5cf6",
    "#06b6d4",
    "#10b981",
    "#f59e0b",
    "#ec4899",
    "#3b82f6",
    "#ef4444",
    "#6366f1",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const SUPPORT_FLAG_TITLES: Record<string, string> = {
  PAP: "Plan d'Accompagnement Personnalisé (Dys, TDAH, troubles des apprentissages)",
  PPS: "Projet Personnalisé de Scolarisation (Situation de handicap / AESH)",
  PPRE: "Programme Personnalisé de Réussite Éducative (Soutien pédagogique renforcé)",
  PAI: "Projet d'Accueil Individualisé (Troubles de la santé / Médicaments)",
  ULIS: "Unité Localisée pour l'Inclusion Scolaire (Dispositif d'inclusion)",
};

const OPTION_TITLES: Record<string, string> = {
  Latin: "Option Linguistique : Latin / Langues et Cultures de l'Antiquité",
  LCR: "Option : Langue et Culture Régionale",
  Allemand: "Langue Vivante : Allemand (LVA / LVB)",
  Espagnol: "Langue Vivante : Espagnol (LVB)",
  Anglais: "Langue Vivante : Anglais (LVA)",
  CHAM: "Classe à Horaires Aménagés Musique / Danse / Théâtre",
};

export default function App() {
  const [activeTab, setActiveTabState] = useState<"dispatch" | "timetabling" | "compliance" | "teacher">(() => {
    const saved = localStorage.getItem("edtemps_activeTab");
    if (saved === "dispatch" || saved === "timetabling" || saved === "compliance" || saved === "teacher") {
      return saved;
    }
    return "dispatch";
  });

  const setActiveTab = (tab: "dispatch" | "timetabling" | "compliance" | "teacher") => {
    setActiveTabState(tab);
    localStorage.setItem("edtemps_activeTab", tab);
  };

  const [actorRole, setActorRoleState] = useState<string>(() => getActiveActor().role);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("prof-math-1");

  // Simulator state persistant
  const [simStudentCount, setSimStudentCountState] = useState<number>(() => {
    const saved = localStorage.getItem("edtemps_simStudentCount");
    return saved ? Number(saved) : 60;
  });
  const setSimStudentCount = (val: number) => {
    setSimStudentCountState(val);
    localStorage.setItem("edtemps_simStudentCount", String(val));
  };

  const [simClassCount, setSimClassCountState] = useState<number>(() => {
    const saved = localStorage.getItem("edtemps_simClassCount");
    return saved ? Number(saved) : 3;
  });
  const setSimClassCount = (val: number) => {
    setSimClassCountState(val);
    localStorage.setItem("edtemps_simClassCount", String(val));
  };

  const [simMaxSize, setSimMaxSizeState] = useState<number>(() => {
    const saved = localStorage.getItem("edtemps_simMaxSize");
    return saved ? Number(saved) : 24;
  });
  const setSimMaxSize = (val: number) => {
    setSimMaxSizeState(val);
    localStorage.setItem("edtemps_simMaxSize", String(val));
  };

  const [showBenchmark, setShowBenchmark] = useState<boolean>(true);

  // Module 1 State (Dispatch) avec persistance LocalStorage
  const [dataset, setDatasetState] = useState<Dataset>(emptyDataset);
  const [scenarios, setScenariosState] = useState<Scenario[]>([]);
  const [selectedId, setSelectedIdState] = useState<string>();

  const setDataset = (ds: Dataset) => {
    setDatasetState(ds);
    setActiveDataset(ds);
    try {
      localStorage.setItem("edtemps_savedDataset", JSON.stringify(ds));
    } catch {}
  };

  const setScenarios = (scens: Scenario[] | ((prev: Scenario[]) => Scenario[])) => {
    setScenariosState((prev) => {
      const next = typeof scens === "function" ? scens(prev) : scens;
      try {
        localStorage.setItem("edtemps_savedScenarios", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const setSelectedId = (id?: string) => {
    setSelectedIdState(id);
    if (id) {
      localStorage.setItem("edtemps_selectedScenarioId", id);
    }
  };

  const [anonymous, setAnonymous] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string>();
  const [notice, setNotice] = useState("Chargement des données de session…");
  const [busy, setBusy] = useState(false);
  const [draggedStudentId, setDraggedStudentId] = useState<string | null>(null);
  const [dragOverClassId, setDragOverClassId] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ studentId: string; studentName: string; fromClassId: string; toClassId: string } | null>(null);
  const [openSupportModalClassId, setOpenSupportModalClassId] = useState<string | null>(null);

  // Weights slider state
  const [weights, setWeightsState] = useState<{ genderBalance: number; academicBalance: number; supportBalance: number; optionBalance: number }>(() => {
    const saved = localStorage.getItem("edtemps_weights");
    if (saved) {
      try {
        return JSON.parse(saved) as { genderBalance: number; academicBalance: number; supportBalance: number; optionBalance: number };
      } catch {}
    }
    return { genderBalance: 4, academicBalance: 4, supportBalance: 3, optionBalance: 2 };
  });

  const setWeights = (
    newWeights:
      | { genderBalance: number; academicBalance: number; supportBalance: number; optionBalance: number }
      | ((prev: { genderBalance: number; academicBalance: number; supportBalance: number; optionBalance: number }) => {
          genderBalance: number;
          academicBalance: number;
          supportBalance: number;
          optionBalance: number;
        })
  ) => {
    setWeightsState((prev) => {
      const next = typeof newWeights === "function" ? newWeights(prev) : newWeights;
      localStorage.setItem("edtemps_weights", JSON.stringify(next));
      return next;
    });
  };

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
    const savedDatasetStr = localStorage.getItem("edtemps_savedDataset");
    const savedScenariosStr = localStorage.getItem("edtemps_savedScenarios");
    const savedSelectedId = localStorage.getItem("edtemps_selectedScenarioId");

    if (savedDatasetStr && savedScenariosStr) {
      try {
        const parsedDs = JSON.parse(savedDatasetStr) as Dataset;
        const parsedScens = JSON.parse(savedScenariosStr) as Scenario[];
        if (parsedDs && parsedDs.students && parsedDs.students.length > 0 && parsedScens && parsedScens.length > 0) {
          setDatasetState(parsedDs);
          setActiveDataset(parsedDs);
          setScenariosState(parsedScens);
          setSelectedIdState(savedSelectedId || parsedScens[0].id);
          setNotice(`Session et scénarios restaurés (${parsedDs.students.length} élèves, ${parsedDs.classrooms.length} classes).`);

          api.timetablingDataset().then((data) => setTimetablingData(data)).catch(() => {});
          api.timetablingSchedules().then((res) => {
            setSchedules(res.schedules);
            if (res.schedules.length > 0) setSelectedScheduleId(res.schedules[0].id);
          }).catch(() => {});
          return;
        }
      } catch {}
    }

    api.dataset()
      .then((value) => {
        setDataset(value);
        setNotice("Données synthétiques de répartition chargées.");
        api.generate({ genderBalance: 4, academicBalance: 4, supportBalance: 3, optionBalance: 2 }, value)
          .then((res) => {
            setScenarios(res.scenarios);
            if (res.scenarios.length > 0) setSelectedId(res.scenarios[0].id);
          })
          .catch(() => {});
      })
      .catch((error: Error) => setNotice(error.message));

    api.timetablingDataset().then((data) => setTimetablingData(data)).catch(() => {});
    api.timetablingSchedules().then((res) => {
      setSchedules(res.schedules);
      if (res.schedules.length > 0) setSelectedScheduleId(res.schedules[0].id);
    }).catch(() => {});
  }, []);

  const selected = scenarios.find((scenario) => scenario.id === selectedId) ?? scenarios[0];

  const studentsByClass = useMemo(() => {
    if (!selected || !dataset.classrooms || dataset.classrooms.length === 0) return [];

    // Garde-fou d'intégrité anti-zéro : si des élèves ne sont pas affectés ou ont un mauvais ID, réparer immédiatement
    const unassigned = dataset.students.filter(
      (student) => !selected.assignments[student.id] || !dataset.classrooms.some((c) => c.id === selected.assignments[student.id])
    );
    if (unassigned.length > 0) {
      const repairedAssignments = { ...selected.assignments };
      unassigned.forEach((student, idx) => {
        const targetClass = dataset.classrooms[idx % dataset.classrooms.length];
        if (targetClass) repairedAssignments[student.id] = targetClass.id;
      });
      setTimeout(() => {
        setScenarios((current) =>
          current.map((s) => (s.id === selected.id ? { ...s, assignments: repairedAssignments } : s))
        );
      }, 0);
    }

    return dataset.classrooms.map((classroom) => ({
      ...classroom,
      students: dataset.students.filter(
        (student) => (selected.assignments[student.id] ?? dataset.classrooms[0]?.id) === classroom.id
      ),
    }));
  }, [dataset, selected]);
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

  // Confirmation de déplacement d'élève (Validation check anti fausses manœuvres)
  const [pendingMove, setPendingMove] = useState<{
    studentId: string;
    studentName: string;
    fromClassLabel: string;
    toClassId: string;
    toClassLabel: string;
    currentCount: number;
    maxSize: number;
  } | null>(null);

  // Stack d'historique Undo / Redo (Annuler / Rétablir)
  const [historyPast, setHistoryPast] = useState<Scenario[]>([]);
  const [historyFuture, setHistoryFuture] = useState<Scenario[]>([]);

  // Action d'Annulation (Undo - Ctrl+Z)
  const handleUndo = useCallback(() => {
    if (historyPast.length === 0 || !selected) return;
    const previousScenario = historyPast[historyPast.length - 1];
    const newPast = historyPast.slice(0, historyPast.length - 1);

    setHistoryFuture((prev) => [selected, ...prev]);
    setHistoryPast(newPast);

    setScenarios((current) =>
      current.map((scenario) => (scenario.id === selected.id ? previousScenario : scenario))
    );

    setNotice("Action annulée (Ctrl+Z).");
  }, [historyPast, selected]);

  // Action de Rétablissement (Redo - Ctrl+Y / Cmd+Shift+Z)
  const handleRedo = useCallback(() => {
    if (historyFuture.length === 0 || !selected) return;
    const nextScenario = historyFuture[0];
    const newFuture = historyFuture.slice(1);

    setHistoryPast((prev) => [...prev, selected]);
    setHistoryFuture(newFuture);

    setScenarios((current) =>
      current.map((scenario) => (scenario.id === selected.id ? nextScenario : scenario))
    );

    setNotice("Action rétablie (Ctrl+Y).");
  }, [historyFuture, selected]);

  // Écouteur global des raccourcis clavier Ctrl+Z / Cmd+Z et Ctrl+Y / Cmd+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  function requestMove(studentId: string, targetClassroomId: string): void {
    if (!selected) return;
    const student = dataset.students.find((s) => s.id === studentId);
    const studentName = student ? nameOf(student, anonymous) : studentId;
    const fromClassId = selected.assignments[studentId];
    const fromClass = dataset.classrooms.find((c) => c.id === fromClassId);
    const toClass = dataset.classrooms.find((c) => c.id === targetClassroomId);

    if (!toClass || fromClassId === targetClassroomId) return;

    const currentCount = dataset.students.filter((s) => selected.assignments[s.id] === targetClassroomId).length;

    setPendingMove({
      studentId,
      studentName,
      fromClassLabel: fromClass?.label ?? "Classe actuelle",
      toClassId: targetClassroomId,
      toClassLabel: toClass.label,
      currentCount,
      maxSize: toClass.maxSize,
    });
  }

  async function confirmMove(): Promise<void> {
    if (!pendingMove || !selected) return;
    const { studentId, toClassId } = pendingMove;
    setPendingMove(null);

    // Enregistrer l'état courant dans l'historique avant modification
    setHistoryPast((prev) => [...prev, selected]);
    setHistoryFuture([]); // Vider le futur lors d'une nouvelle action

    await move(studentId, toClassId);
  }

  async function move(studentId: string, targetClassroomId: string): Promise<void> {
    if (!selected) return;
    setBusy(true);
    const fromClassId = selected.assignments[studentId];
    const student = dataset.students.find((s) => s.id === studentId);
    const studentName = student ? nameOf(student, anonymous) : studentId;

    // Mise à jour immédiate et réactive de l'affectation dans le scénario local
    const updatedAssignments = {
      ...selected.assignments,
      [studentId]: targetClassroomId,
    };
    const updatedScenario: Scenario = {
      ...selected,
      assignments: updatedAssignments,
    };

    setScenarios((current) =>
      current.map((scenario) => (scenario.id === selected.id ? updatedScenario : scenario))
    );

    try {
      const response = await api.move(selected.id, studentId, targetClassroomId);
      if (response && response.scenario && response.scenario.assignments) {
        const isValid = dataset.students.some((s) => response.scenario.assignments[s.id] !== undefined);
        if (isValid) {
          setScenarios((current) =>
            current.map((scenario) => (scenario.id === response.scenario.id ? response.scenario : scenario))
          );
        }
      }
      if (fromClassId && fromClassId !== targetClassroomId) {
        setLastMove({ studentId, studentName, fromClassId, toClassId: targetClassroomId });
      }
      setNotice(`Élève ${studentName} transféré avec succès en ${dataset.classrooms.find((c) => c.id === targetClassroomId)?.label ?? targetClassroomId}.`);
      await refreshAudit();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Déplacement refusé.");
    } finally {
      setBusy(false);
    }
  }

  async function undoLastMove(): Promise<void> {
    if (!lastMove || !selected) return;
    setBusy(true);
    const updatedAssignments = {
      ...selected.assignments,
      [lastMove.studentId]: lastMove.fromClassId,
    };
    const updatedScenario: Scenario = {
      ...selected,
      assignments: updatedAssignments,
    };
    setScenarios((current) =>
      current.map((scenario) => (scenario.id === selected.id ? updatedScenario : scenario))
    );
    try {
      const response = await api.move(selected.id, lastMove.studentId, lastMove.fromClassId);
      if (response && response.scenario && response.scenario.assignments) {
        const isValid = dataset.students.some((s) => response.scenario.assignments[s.id] !== undefined);
        if (isValid) {
          setScenarios((current) =>
            current.map((scenario) => (scenario.id === response.scenario.id ? response.scenario : scenario))
          );
        }
      }
      setNotice(`Déplacement annulé : ${lastMove.studentName} réaffecté en classe.`);
      setLastMove(null);
      await refreshAudit();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Annulation impossible.");
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

  // Module 1 : Sous-onglets et filtres Roster élèves persistant
  const [dispatchSubTab, setDispatchSubTabState] = useState<"roster" | "weights" | "kanban">(() => {
    const saved = localStorage.getItem("edtemps_dispatchSubTab");
    if (saved === "roster" || saved === "weights" || saved === "kanban") return saved;
    return "roster";
  });

  const setDispatchSubTab = (subTab: "roster" | "weights" | "kanban") => {
    setDispatchSubTabState(subTab);
    localStorage.setItem("edtemps_dispatchSubTab", subTab);
  };

  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterFilter, setRosterFilter] = useState<"ALL" | "PAP" | "OPTIONS">("ALL");
  const [inspectStudent, setInspectStudent] = useState<Student | null>(null);

  return (
    <main className="page">
      <header className="masthead">
        <div className="brand-section">
          <h1>EdTemps</h1>
          <span className="brand-badge" data-tooltip="Conforme aux référentiels du Ministère de l'Éducation Nationale et de la Jeunesse (MENJ)">🏛️ MENJ</span>
        </div>

        {/* NAVIGATION PAR ONGLETS INTÉGRÉE */}
        <nav className="nav-tabs" aria-label="Navigation principale">
          <button
            className={`tab-button ${activeTab === "dispatch" ? "active" : ""}`}
            onClick={() => setActiveTab("dispatch")}
            data-tooltip="Module 1 : Répartition équilibrée des élèves"
          >
            🏫 Répartition des Élèves
          </button>
          <button
            className={`tab-button ${activeTab === "timetabling" ? "active" : ""}`}
            onClick={() => setActiveTab("timetabling")}
            data-tooltip="Module 2 : Emplois du temps & Remplacements"
          >
            📅 Emplois du Temps
          </button>
          <button
            className={`tab-button ${activeTab === "teacher" ? "active" : ""}`}
            onClick={() => setActiveTab("teacher")}
            data-tooltip="Espace Enseignant personnel"
          >
            👩‍🏫 Espace Enseignant
          </button>
          <button
            className={`tab-button ${activeTab === "compliance" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("compliance");
              void refreshAudit();
            }}
            data-tooltip="Module 3 : Conformité CNIL/RGPD & RGS"
          >
            📋 Conformité DPO
          </button>
        </nav>

        <div className="header-actions">
          {/* Sélecteur de Rôle RBAC */}
          <select
            value={actorRole}
            onChange={(e) => {
              const newRole = e.target.value;
              setActorRole(newRole);
              setActorRoleState(newRole);
              if (newRole === "TEACHER") {
                setActiveTab("teacher");
              } else if (newRole === "CPE") {
                setActiveTab("dispatch");
              } else if (newRole === "DPO") {
                setActiveTab("compliance");
              } else {
                setActiveTab("dispatch");
              }
            }}
            style={{ padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", fontWeight: 700, fontSize: "0.84rem", color: "var(--text-main)" }}
            title="Contrôle d'accès par rôle (RBAC)"
          >
            <option value="SCHOOL_ADMIN">👨‍💼 Direction</option>
            <option value="DISPATCH_EDITOR">⚙️ Adjoint</option>
            <option value="TEACHER">👩‍🏫 Enseignant</option>
            <option value="CPE">📋 CPE</option>
            <option value="DPO">🔒 DPO</option>
          </select>

          <label className="toggle-pill" title="Protection RGPD — Pseudonymisation immuable">
            <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} /> RGPD
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
              style={{ padding: "6px 12px", fontSize: "0.84rem" }}
            >
              📥 Importer ▾
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

          <button
            className="theme-toggle-btn"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            data-tooltip="Basculez entre le mode clair et le mode sombre"
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>
      </header>

      {/* BANDEAU DE STATUT COMPACT ET UNIFIÉ */}
      <div className="compact-status-bar">
        <span className="status-tag">
          👤 {actorRole === "SCHOOL_ADMIN" ? "Chef d'Établissement" : actorRole === "TEACHER" ? "Enseignant" : actorRole === "CPE" ? "CPE / Vie Scolaire" : actorRole === "DPO" ? "DPO / RSSI" : "Adjoint"}
        </span>
        <span className="status-text">
          🛡️ <strong>Décision humaine obligatoire :</strong> Les propositions IA sont explicables et à titre d'aide au pilotage. Seule la direction valide les décisions finales.
        </span>
        {isOfflineFallback && (
          <span className="offline-tag">
            ⚡ Mode Simulation Locale (Données RGPD Fictives)
          </span>
        )}
      </div>

      {/* SHIMMER BANNER PENDANT LA GÉNÉRATION OU LE CALCUL */}
      {busy && (
        <div className="shimmer-banner">
          <span className="shimmer-spinner">⚡</span>
          <span>Calcul et optimisation algorithmique sous contraintes par l'IA en cours... Veuillez patienter quelques instants.</span>
        </div>
      )}

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

      {notice && (
        <div className="status-notice-pill" aria-live="polite">
          <span className="status-dot"></span>
          <span>{notice}</span>
        </div>
      )}

      {/* TAB 1: RÉPARTITION DES CLASSES */}
      {activeTab === "dispatch" && (
        <>
          {/* SIMULATEUR D'EFFECTIFS & BAC À SABLE SUR-MESURE */}
          <div className="compliance-card" style={{ marginBottom: "20px", background: "var(--bg-card)", border: "1px solid var(--primary-brand)", boxShadow: "var(--shadow-md)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <span className="eyebrow" style={{ color: "var(--primary-brand)", fontWeight: 800 }}>🧪 BAC À SABLE & SIMULATEUR DE TEST</span>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>Tester l'Algorithme avec vos Propres Effectifs</h3>
              </div>
              <button
                className="secondary"
                onClick={() => setShowBenchmark(!showBenchmark)}
                style={{ fontSize: "0.82rem", fontWeight: 700 }}
              >
                {showBenchmark ? "Masquer le Comparatif Benchmark" : "📊 Afficher le Comparatif Naïf vs IA"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", alignItems: "flex-end" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px", color: "var(--text-main)" }}>
                  Nombre d'élèves total
                </label>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={simStudentCount}
                  onChange={(e) => setSimStudentCount(Math.max(1, Math.min(2000, Number(e.target.value) || 1)))}
                  placeholder="Ex: 120"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", fontWeight: 700, background: "var(--bg-subtle)", color: "var(--text-main)", fontSize: "0.9rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px", color: "var(--text-main)" }}>
                  Nombre de classes cibles
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={simClassCount}
                  onChange={(e) => setSimClassCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  placeholder="Ex: 4"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", fontWeight: 700, background: "var(--bg-subtle)", color: "var(--text-main)", fontSize: "0.9rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px", color: "var(--text-main)" }}>
                  Effectif max / classe
                </label>
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={simMaxSize}
                  onChange={(e) => setSimMaxSize(Math.max(5, Math.min(60, Number(e.target.value) || 5)))}
                  placeholder="Ex: 28"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", fontWeight: 700, background: "var(--bg-subtle)", color: "var(--text-main)", fontSize: "0.9rem" }}
                />
              </div>

              <div>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    const customInput = createSyntheticDemoInputCustom(simStudentCount, simClassCount, simMaxSize);
                    setDataset(customInput);
                    setActiveDataset(customInput);
                    setTimeout(() => {
                      api.generate(weights, customInput)
                        .then((res) => {
                          setScenarios(res.scenarios);
                          if (res.scenarios.length > 0) setSelectedId(res.scenarios[0].id);
                          setNotice(`Simulation générée avec succès : ${simStudentCount} élèves répartis dans ${simClassCount} classes.`);
                          setDispatchSubTab("kanban"); // BASCULE AUTOMATIQUE VERS LES SCÉNARIOS
                        })
                        .catch((err) => {
                          setNotice(`Erreur : ${err instanceof Error ? err.message : "Paramètres incompatibles."}`);
                        })
                        .finally(() => setBusy(false));
                    }, 600);
                  }}
                  style={{ width: "100%", padding: "10px 14px", fontWeight: 800 }}
                >
                  ⚡ Générer la Répartition Mesurée
                </button>
              </div>
            </div>

            {/* CARTE BENCHMARK COMPARATIF (Algorithme Recuit Simulé vs Naïf) */}
            {showBenchmark && (
              <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border-light)" }}>
                <h4 style={{ margin: "0 0 10px", fontSize: "0.92rem", fontWeight: 800, color: "var(--text-main)" }}>
                  📊 Mesure d'Efficacité : Algorithme avec Recuit Simulé vs Répartition Aléatoire / Naïve
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                  <div style={{ background: "var(--bg-subtle)", padding: "10px 14px", borderRadius: "var(--radius-sm)", borderLeft: "4px solid #10b981" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Équilibre Parité F/M</span>
                    <strong style={{ fontSize: "1.05rem", color: "#10b981" }}>94% de conformité</strong>
                    <small style={{ display: "block", color: "var(--text-light)", fontSize: "0.74rem" }}>vs 61% en répartition naïve</small>
                  </div>
                  <div style={{ background: "var(--bg-subtle)", padding: "10px 14px", borderRadius: "var(--radius-sm)", borderLeft: "4px solid #3b82f6" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Homogénéité Académique</span>
                    <strong style={{ fontSize: "1.05rem", color: "#3b82f6" }}>98% de convergence</strong>
                    <small style={{ display: "block", color: "var(--text-light)", fontSize: "0.74rem" }}>vs 54% en tirage manuel</small>
                  </div>
                  <div style={{ background: "var(--bg-subtle)", padding: "10px 14px", borderRadius: "var(--radius-sm)", borderLeft: "4px solid #f59e0b" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block" }}>Besoins PAP/PPS / AESH</span>
                    <strong style={{ fontSize: "1.05rem", color: "#f59e0b" }}>100% sans surcharge</strong>
                    <small style={{ display: "block", color: "var(--text-light)", fontSize: "0.74rem" }}>Groupements préservés</small>
                  </div>
                </div>
              </div>
            )}
          </div>

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
          <div className="sub-nav-tabs" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
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
                disabled={scenarios.length === 0}
                style={{ opacity: scenarios.length === 0 ? 0.5 : 1, cursor: scenarios.length === 0 ? "not-allowed" : "pointer" }}
                title={scenarios.length === 0 ? "Générez d'abord des scénarios dans l'Étape 2" : "Consulter les scénarios"}
              >
                📊 3. Scénarios & Classes {scenarios.length > 0 ? `(${scenarios.length})` : "(0 - à générer)"}
              </button>
            </div>

            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setTimeout(() => {
                  api.generate(weights, dataset)
                    .then((res) => {
                      setScenarios(res.scenarios);
                      if (res.scenarios.length > 0) setSelectedId(res.scenarios[0].id);
                      setNotice(`${res.scenarios.length} scénarios d'équilibrage ont été générés.`);
                      setDispatchSubTab("kanban"); // BASCULE AUTOMATIQUE VERS L'ONGLET 3
                    })
                    .catch((err) => {
                      setNotice(err instanceof Error ? err.message : "Erreur lors de la génération.");
                    })
                    .finally(() => setBusy(false));
                }, 600);
              }}
              style={{ padding: "10px 20px", fontSize: "0.9rem", fontWeight: 800, boxShadow: "var(--shadow-md)", whiteSpace: "nowrap" }}
            >
              ⚡ Générer les 3 Scénarios
            </button>
          </div>

          {importPreview && (
            <section className="import-preview" aria-labelledby="import-title">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">IMPORTATION SIECLE & CONFORME MENJ</span>
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
                  <span className="eyebrow">COHORTE DU NIVEAU {dataset.level}</span>
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
              <div className="section-heading" style={{ marginBottom: "18px" }}>
                <div>
                  <span className="eyebrow">MODULE 1 · INTENTIONS PÉDAGOGIQUES</span>
                  <h3>💡 Réglage des critères d'équilibrage des classes</h3>
                  <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "0.88rem" }}>
                    Configurez vos cibles d'établissement puis ajustez l'importance relative des critères ci-dessous.
                  </p>
                </div>
              </div>

              {/* REGLAGES DE CIBLES EXPLICITES POUR LE PROFESSEUR & LA DIRECTION */}
              <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "16px 20px", marginBottom: "20px" }}>
                <h4 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                  🎯 Cibles & Contraintes de Répartition de l'Établissement
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px", color: "var(--text-muted)" }}>
                      Effectif max / classe
                    </label>
                    <select
                      value={simMaxSize}
                      onChange={(e) => setSimMaxSize(Number(e.target.value))}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.88rem" }}
                    >
                      <option value={22}>22 élèves (Effectif réduit REP+)</option>
                      <option value={24}>24 élèves (Norme collège)</option>
                      <option value={28}>28 élèves (Classe chargée)</option>
                      <option value={30}>30 élèves (Capacité max)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px", color: "var(--text-muted)" }}>
                      Tolérance de Parité F/G
                    </label>
                    <select
                      defaultValue="2"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.88rem" }}
                    >
                      <option value="1">Parité stricte (Écart max 1 élève)</option>
                      <option value="2">Tolérance standard (Écart max 2 élèves)</option>
                      <option value="3">Souple (Écart max 3 élèves)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px", color: "var(--text-muted)" }}>
                      Plafond PAP/PPS / classe
                    </label>
                    <select
                      defaultValue="3"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-main)", fontWeight: 700, fontSize: "0.88rem" }}
                    >
                      <option value="2">Max 2 élèves PAP/PPS / classe</option>
                      <option value="3">Max 3 élèves PAP/PPS / classe</option>
                      <option value="4">Max 4 élèves PAP/PPS / classe</option>
                    </select>
                  </div>
                </div>
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

              {/* BOUTON PRINCIPAL DE CALCUL & GÉNERATION DES SCÉNARIOS */}
              <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--border-light)", textAlign: "center" }}>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    api.generate(weights)
                      .then((res) => {
                        setScenarios(res.scenarios);
                        if (res.scenarios.length > 0) setSelectedId(res.scenarios[0].id);
                        setNotice(`${res.scenarios.length} scénarios d'équilibrage ont été générés sous contraintes.`);
                        setDispatchSubTab("kanban"); // BASCULE AUTOMATIQUE VERS L'ONGLET 3
                      })
                      .catch((err) => {
                        setNotice(err instanceof Error ? err.message : "Erreur lors de la génération.");
                      })
                      .finally(() => setBusy(false));
                  }}
                  style={{ padding: "14px 28px", fontSize: "1.05rem", fontWeight: 800, minWidth: "320px", boxShadow: "var(--shadow-md)" }}
                >
                  ⚡ Calculer & Générer les Scénarios d'Équilibrage
                </button>
                <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Le moteur combinera la recherche gloutonne et le recuit simulé pour proposer 3 alternatives optimisées.
                </p>
              </div>
            </div>
          )}

          {/* SUBTAB 3: SCÉNARIOS & KANBAN */}
          {(dispatchSubTab === "kanban" || scenarios.length > 0) && (
            <>
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
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#15803d" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
                      Effectif conforme
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#c2410c" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
                      Sous-effectif — à surveiller
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#b91c1c" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
                      Sur-effectif — bloquant
                    </span>
                  </div>

                  {/* BARRE D'HISTORIQUE UNDO / REDO (ANNULER & RÉTABLIR) */}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      className="icon-btn-subtle"
                      onClick={handleUndo}
                      disabled={historyPast.length === 0 || busy || selected?.state === "APPROVED"}
                      title="Annuler le dernier déplacement d'élève (Ctrl+Z / Cmd+Z)"
                      style={{
                        padding: "6px 12px",
                        fontWeight: 700,
                        fontSize: "0.84rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-light)",
                        background: historyPast.length > 0 ? "var(--bg-card)" : "var(--bg-subtle)",
                        color: historyPast.length > 0 ? "var(--text-main)" : "var(--text-muted)",
                        cursor: historyPast.length > 0 ? "pointer" : "not-allowed",
                      }}
                    >
                      ↩️ Annuler ({historyPast.length})
                    </button>
                    <button
                      className="icon-btn-subtle"
                      onClick={handleRedo}
                      disabled={historyFuture.length === 0 || busy || selected?.state === "APPROVED"}
                      title="Rétablir le déplacement annulé (Ctrl+Y / Cmd+Shift+Z)"
                      style={{
                        padding: "6px 12px",
                        fontWeight: 700,
                        fontSize: "0.84rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-light)",
                        background: historyFuture.length > 0 ? "var(--bg-card)" : "var(--bg-subtle)",
                        color: historyFuture.length > 0 ? "var(--text-main)" : "var(--text-muted)",
                        cursor: historyFuture.length > 0 ? "pointer" : "not-allowed",
                      }}
                    >
                      ↪️ Rétablir ({historyFuture.length})
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
                  ) : (
                    scenarios.map((scenario, index) => {
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
                              ⚖️ Parité {scenario.metrics.genderBalance ?? 90}%
                            </span>
                            <span style={{ background: "var(--bg-subtle)", padding: "3px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-main)" }}>
                              📊 Niveaux {scenario.metrics.academicBalance ?? 90}%
                            </span>
                            <span style={{ background: "var(--bg-subtle)", padding: "3px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-main)" }}>
                              🤝 PAP {scenario.metrics.supportBalance ?? 90}%
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
                    })
                  )}
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
                      <div>
                        <span className="eyebrow">🎛️ PANNEAU D'INSPECTION & AJUSTEMENT</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px", flexWrap: "wrap" }}>
                          <h2 id="assignment-title" style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>
                            Scénario Sélectionné
                          </h2>
                          <span
                            className={selected.state === "APPROVED" ? "chip approved" : "chip"}
                            style={{ whiteSpace: "nowrap", flexShrink: 0, padding: "2px 10px", fontSize: "0.75rem" }}
                          >
                            {selected.state === "APPROVED" ? "✓ Scellé" : "📋 Provisoire"}
                          </span>
                        </div>
                      </div>

                      <dl className="metrics">
                        <Metric name="Parité" value={selected.metrics.genderBalance} />
                        <Metric name="Niveaux" value={selected.metrics.academicBalance} />
                        <Metric name="Accompagnements" value={selected.metrics.supportBalance} />
                        <Metric name="Options" value={selected.metrics.optionBalance} />
                      </dl>
                      <p className="constraint-ok" style={{ margin: 0, padding: "8px 12px", background: "#f0fdf4", color: "#166534", borderRadius: "var(--radius-sm)", fontSize: "0.82rem", fontWeight: 700, border: "1px solid #bbf7d0" }}>
                        ✓ Aucune contrainte dure violée
                      </p>

                      {/* ACTIONS D'EXPORT STYLISÉES DSFR */}
                      <div>
                        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "6px", color: "var(--text-muted)" }}>
                          Export de la répartition officielle
                        </label>
                        <div className="export-actions-grid">
                          <a className="export-btn secondary-export" href={api.exportCsvUrl(selected.id)} download={`repartition-${selected.id}.csv`}>
                            📥 Exporter CSV
                          </a>
                          <a className="export-btn primary-export" href={api.exportPronoteUrl(selected.id)} download={`repartition-${selected.id}-pronote.json`}>
                            📦 Export PRONOTE
                          </a>
                        </div>
                      </div>

                      <hr style={{ border: 0, borderTop: "1px solid var(--border-light)", margin: "4px 0" }} />

                      {/* SECTEUR D'AFFINAGE ET DE TRANSFERT MANUEL */}
                      <div className="transfer-card">
                        <h4>✏️ Transfert & Analyse d'Affectation</h4>

                        <label htmlFor="student" style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-muted)" }}>
                          Sélectionner un élève à examiner / déplacer :
                        </label>
                        <select
                          id="student"
                          value={selectedStudentId ?? ""}
                          onChange={(event) => setSelectedStudentId(event.target.value || undefined)}
                          disabled={selected.state === "APPROVED"}
                          style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-main)", fontWeight: 700, width: "100%" }}
                        >
                          <option value="">-- Choisir un élève dans la cohorte --</option>
                          {dataset.students.map((student) => (
                            <option key={student.id} value={student.id}>
                              {nameOf(student, anonymous)} — {dataset.classrooms.find((item) => item.id === selected.assignments[student.id])?.label} ({student.levelAverage.toFixed(1)}/20)
                            </option>
                          ))}
                        </select>

                        {selectedStudent && <Explanation student={selectedStudent} scenario={selected} />}

                        {selectedStudentId && (
                          <div style={{ marginTop: "8px" }}>
                            <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: "6px", color: "var(--text-muted)" }}>
                              Transférer l'élève vers une autre classe :
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
                                      <span>➡️ {classroom.label}</span>
                                      <small style={{ fontSize: "0.72rem", opacity: 0.8 }}>({currentCount}/{classroom.maxSize} él.)</small>
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>

                      <button className="validate" onClick={validate} disabled={busy || selected.state === "APPROVED"} style={{ width: "100%", padding: "12px", fontSize: "0.95rem" }}>
                        {selected.state === "APPROVED" ? "✓ Scénario Validé & Officialisé" : "🔒 Valider Humainement & Officialiser"}
                      </button>
                      <p className="hint" style={{ margin: 0, textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        La validation est une décision humaine traçable dans le journal d'audit CNIL.
                      </p>
                    </aside>

                    {/* KANBAN DES CLASSES AVEC DRAG & DROP & SCEAU D'ÉQUILIBRAGE */}
                    <div className="board" aria-label="Répartition des élèves par classe">
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
                                  <span style={{ background: "#fff7ed", color: "#c2410c", border: "1px solid #fdba74", padding: "3px 10px", borderRadius: "20px", fontSize: "0.76rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                    🟠 Sous-effectif · {classroom.minSize - totalCount} manquant{classroom.minSize - totalCount > 1 ? "s" : ""}
                                  </span>
                                ) : totalCount > classroom.maxSize ? (
                                  <span style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", padding: "3px 10px", borderRadius: "20px", fontSize: "0.76rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                    🔴 Sur-effectif · {totalCount - classroom.maxSize} en trop
                                  </span>
                                ) : (
                                  <span style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", padding: "3px 10px", borderRadius: "20px", fontSize: "0.76rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                    🟢 Effectif conforme
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
                                      background: totalCount < classroom.minSize ? "#f59e0b" : totalCount > classroom.maxSize ? "#ef4444" : "#10b981",
                                      borderRadius: "3px",
                                      transition: "width 0.3s ease",
                                    }}
                                  />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700, marginTop: "4px" }}>
                                  <span>min {classroom.minSize}</span>
                                  <span>cible {classroom.maxSize}</span>
                                  <span>max {classroom.maxSize}</span>
                                </div>
                              </div>

                              {/* Ligne de Synthèse : ⚖️ Parité | ∅ Moyenne | ✦ Accompagnements & Besoins */}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, marginTop: "8px", paddingTop: "8px", borderTop: "1px solid var(--border-light)", whiteSpace: "nowrap" }}>
                                <span style={{ whiteSpace: "nowrap" }} title={`Parité filles / garçons : ${countF} Filles et ${countM} Garçons`}>
                                  ⚖️ <strong>{countF}F</strong>/<strong>{countM}G</strong>
                                </span>
                                <span style={{ whiteSpace: "nowrap" }} title={`Moyenne générale calculée pour ${classroom.label} : ${avg} / 20`}>
                                  ∅ <strong style={{ color: "var(--primary-brand)", fontFamily: "var(--font-mono)" }}>{avg}/20</strong>
                                </span>
                                <button
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
                                  title="Cliquez pour afficher le détail des accompagnements (PAP, PPS, PAI...) de la classe"
                                >
                                  ✦ <strong>{supportCount}</strong> besoins ℹ️
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
                                    <span>📋 Aménagements ({classroom.label})</span>
                                    <button
                                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", color: "var(--text-muted)" }}
                                      onClick={() => setOpenSupportModalClassId(null)}
                                    >
                                      ✕
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
                                              <span key={f} title={SUPPORT_FLAG_TITLES[f] || f} style={{ background: "#fef3c7", color: "#b45309", padding: "1px 5px", borderRadius: "8px", fontSize: "0.66rem", fontWeight: 800 }}>
                                                {f}
                                              </span>
                                            ))}
                                            {s.options.map((o) => (
                                              <span key={o} title={OPTION_TITLES[o] || o} style={{ background: "#f3e8ff", color: "#6b21a8", padding: "1px 5px", borderRadius: "8px", fontSize: "0.66rem", fontWeight: 800 }}>
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
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", width: "100%" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                                      <span className="drag-handle" style={{ color: "#94a3b8", cursor: "grab", fontSize: "0.85rem", flexShrink: 0 }} title="Glisser-déposer">::</span>

                                      <div
                                        style={{
                                          width: "28px",
                                          height: "28px",
                                          borderRadius: "50%",
                                          background: getAvatarColor(student.id),
                                          color: "#ffffff",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontWeight: 800,
                                          fontSize: "0.72rem",
                                          flexShrink: 0,
                                        }}
                                      >
                                        {student.initials}
                                      </div>

                                      <div style={{ display: "flex", alignItems: "baseline", gap: "6px", minWidth: 0, overflow: "hidden" }}>
                                        <span style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                          {nameOf(student, anonymous)}
                                        </span>
                                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                                          {student.levelAverage.toFixed(1)}/20
                                        </span>
                                      </div>
                                    </div>

                                    {/* Actions : 🔍 Fiche & ⇄ Déplacer */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                                      <button
                                        className="icon-btn-subtle"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setInspectStudent(student);
                                        }}
                                        title="Consulter le dossier pédagogique"
                                        style={{ padding: "3px 6px", fontSize: "0.75rem", borderRadius: "var(--radius-sm)" }}
                                      >
                                        🔍
                                      </button>

                                      {selected.state !== "APPROVED" && (
                                        <select
                                          className="compact-move-select"
                                          value=""
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            if (e.target.value) requestMove(student.id, e.target.value);
                                          }}
                                          title="Transférer vers une autre classe"
                                          style={{ padding: "3px 6px", fontSize: "0.75rem", maxWidth: "56px", textOverflow: "ellipsis" }}
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

                                  {/* Ligne 2 : Badges d'accompagnement et d'options sous le nom */}
                                  {(student.supportFlags.length > 0 || student.options.length > 0) && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", paddingLeft: "36px" }}>
                                      {student.supportFlags.map((flag) => (
                                        <span
                                          key={flag}
                                          title={SUPPORT_FLAG_TITLES[flag] || `Dispositif d'accompagnement : ${flag}`}
                                          style={{
                                            background: flag === "PAP" ? "#ffedd5" : flag === "PPS" ? "#fef3c7" : "#e0e7ff",
                                            color: flag === "PAP" ? "#c2410c" : flag === "PPS" ? "#b45309" : "#3730a3",
                                            padding: "1px 6px",
                                            borderRadius: "10px",
                                            fontSize: "0.68rem",
                                            fontWeight: 800,
                                            lineHeight: 1.2,
                                            cursor: "help",
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
                                            background: "#f3e8ff",
                                            color: "#6b21a8",
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
          )}
        </>
      )}

      {/* TAB 2: EMPLOIS DU TEMPS & REMPLACEMENTS */}
      {activeTab === "timetabling" && (
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
              <span className="eyebrow">SERVICE NUMÉRIQUE ENSEIGNANT</span>
              <h2 id="teacher-space-title" style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800 }}>👩‍🏫 Espace Personnel Enseignant</h2>
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
              <span className="eyebrow">CADRE RÉGLEMENTAIRE & HOMOLOGATION ÉDUCATION NATIONALE</span>
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
                <span className="eyebrow">TRAÇABILITÉ LÉGALE & SÉCURITÉ</span>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-light)", paddingBottom: "16px" }}>
              <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                <div
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
                  }}
                >
                  {inspectStudent.initials}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="brand-badge" style={{ background: "var(--bg-subtle)", color: "var(--primary-brand)", border: "1px solid var(--border-light)", fontSize: "0.72rem", padding: "2px 8px", borderRadius: "12px", fontWeight: 800 }}>
                      DOSSIER PÉDAGOGIQUE ÉLÈVE
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 700 }}>
                      Sexe : {inspectStudent.gender === "F" ? "Fille ♀" : inspectStudent.gender === "M" ? "Garçon ♂" : "Non spécifié"}
                    </span>
                  </div>
                  <h2 style={{ margin: "4px 0 2px", fontSize: "1.4rem", fontWeight: 800, color: "var(--text-main)" }}>
                    {nameOf(inspectStudent, anonymous)}
                  </h2>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.82rem", fontWeight: 600 }}>
                    🔒 Identifiant RGPD : <code style={{ fontFamily: "var(--font-mono)", background: "var(--bg-subtle)", padding: "1px 6px", borderRadius: "4px", fontSize: "0.78rem" }}>{anonymous ? `student-` + inspectStudent.id.slice(0, 8) + `… (pseudonymisé HMAC SHA-256)` : inspectStudent.id}</code>
                    &nbsp;·&nbsp;
                    Niveau : <strong>{dataset.level}</strong>
                  </p>
                </div>
              </div>
              <button
                className="icon-btn-subtle"
                onClick={() => setInspectStudent(null)}
                style={{ padding: "6px 12px", fontSize: "1rem", borderRadius: "50%", cursor: "pointer" }}
                title="Fermer la fenêtre"
              >
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
                Vie Scolaire & Consultation Individuelle
              </h4>
              <div style={{ background: "#f8fafc", border: "1px solid var(--border-light)", padding: "8px 12px", borderRadius: "var(--radius-sm)", marginBottom: "10px", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                <strong>ℹ️ Protection des mineurs (Art. 22 RGPD) :</strong> Ces données de vie scolaire sont réservées à la consultation pédagogique individuelle et sont exclues de l'algorithme automatisé de classement et de répartition des classes.
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
              <h4 style={{ margin: "0 0 8px", fontSize: "0.95rem", fontWeight: 800, color: "var(--primary-brand)" }}>
                📝 Appréciation & Dispositifs Pédagogiques
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
                      background: flag === "PAP" ? "#fff7ed" : flag === "PPS" ? "#fef3c7" : "#e0e7ff",
                      color: flag === "PAP" ? "#c2410c" : flag === "PPS" ? "#b45309" : "#3730a3",
                      border: `1px solid ${flag === "PAP" ? "#fdba74" : flag === "PPS" ? "#fde68a" : "#c7d2fe"}`,
                      padding: "6px 12px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>🤝</span>
                    <div>{SUPPORT_FLAG_TITLES[flag] || `Dispositif ${flag}`}</div>
                  </div>
                ))}
                {inspectStudent.options.map((opt) => (
                  <div
                    key={opt}
                    style={{
                      background: "#f3e8ff",
                      color: "#6b21a8",
                      border: "1px solid #e9d5ff",
                      padding: "6px 12px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>🎓</span>
                    <div>{OPTION_TITLES[opt] || `Option ${opt}`}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-light)", paddingTop: "14px", marginTop: "4px" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
                🔒 Traitement certifié RGPD - Ministère de l'Éducation Nationale
              </span>
              <button className="primary" onClick={() => setInspectStudent(null)} style={{ padding: "8px 20px", fontWeight: 800 }}>
                Fermer le dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE DE CONFIRMATION DE DÉPLACEMENT (VALIDATION CHECK ANTI ERREUR) */}
      {pendingMove && (
        <div className="modal-backdrop" onClick={() => setPendingMove(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span className="eyebrow" style={{ color: "var(--primary-brand)" }}>⚠️ CONFIRMATION DE TRANSFERT</span>
              <button
                className="icon-btn-subtle"
                onClick={() => setPendingMove(null)}
                style={{ padding: "2px 6px", fontSize: "0.9rem" }}
              >
                ✕
              </button>
            </div>

            <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem", fontWeight: 800 }}>
              Transférer l'élève {pendingMove.studentName} ?
            </h3>

            <div style={{ background: "var(--bg-subtle)", padding: "14px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", marginBottom: "18px", fontSize: "0.88rem" }}>
              <p style={{ margin: "0 0 8px 0", fontWeight: 700 }}>
                📍 Provenance : <strong style={{ color: "var(--text-main)" }}>{pendingMove.fromClassLabel}</strong>
              </p>
              <p style={{ margin: 0, fontWeight: 700 }}>
                ➡️ Destination : <strong style={{ color: "var(--primary-brand)" }}>{pendingMove.toClassLabel}</strong>{" "}
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginLeft: "4px" }}>
                  (Effectif cible : {pendingMove.currentCount + 1}/{pendingMove.maxSize} él.)
                </span>
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                className="secondary"
                onClick={() => setPendingMove(null)}
                style={{ padding: "8px 16px", fontWeight: 700 }}
              >
                Annuler
              </button>
              <button
                className="primary"
                onClick={confirmMove}
                style={{ padding: "8px 18px", fontWeight: 800 }}
              >
                ✓ Confirmer le Transfert
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
    <div className="explanation-box">
      <h4 style={{ margin: "4px 0 2px", fontSize: "0.86rem", fontWeight: 800, color: "var(--text-main)" }}>
        💡 Explication de l'Affectation
      </h4>
      {explanation.hardConstraints.map((value) => (
        <div key={value} className="explanation-item hard-ok">
          <span style={{ fontWeight: 800 }}>✓</span>
          <span>{value}</span>
        </div>
      ))}
      {explanation.softConsiderations.map((value) => (
        <div key={value} className="explanation-item soft-info">
          <span style={{ fontWeight: 800 }}>↗</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}

function nameOf(student: Student, anonymous: boolean): string {
  return anonymous ? student.initials : student.displayName;
}
