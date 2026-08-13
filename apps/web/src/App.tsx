import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { School, CalendarDays, GraduationCap, ShieldCheck, Moon, Sun, Landmark, Menu, Download, Package, Camera, Mic, Dices, User, Zap, Loader2, X, Lock } from "lucide-react";
import { calculateMetrics, type DispatchWeights } from "@edtemps/domain";
import { api, createSyntheticDemoInputCustom, getActiveActor, isOfflineFallback, setActorRole, setActiveDataset } from "./api";
import type { FeasibilityError } from "@edtemps/domain";
import type {
  AuditEvent,
  Classroom,
  Dataset,
  Scenario,
  SIECLEImportPreview,
  Student,
  SubstitutionSuggestion,
  TimetablingDataset,
  TimetablingSchedule,
} from "./types";
import { emptyDataset } from "./constants/referentiels";
import { nameOf } from "./utils/format";
import { OfficialPdfModal } from "./components/OfficialPdfModal";
import { MoveConfirmationModal } from "./components/modals/MoveConfirmationModal";
import { StudentDetailModal } from "./components/modals/StudentDetailModal";
import { ImpossibilityErrorModal } from "./components/modals/ImpossibilityErrorModal";
import { AiTransparencyModal } from "./components/modals/AiTransparencyModal";
import { RebalanceAssistantModal } from "./components/modals/RebalanceAssistantModal";
import { TeacherTab } from "./components/tabs/TeacherTab";
import { ComplianceTab } from "./components/tabs/ComplianceTab";
import { TimetablingTab } from "./components/tabs/TimetablingTab";
import { RosterTab } from "./components/dispatch/RosterTab";
import { WeightsTab } from "./components/dispatch/WeightsTab";
import { KanbanTab } from "./components/dispatch/KanbanTab";

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

  const [simMinSize, setSimMinSizeState] = useState<number>(() => {
    const saved = localStorage.getItem("edtemps_simMinSize");
    return saved ? Number(saved) : 18;
  });
  const setSimMinSize = (val: number) => {
    setSimMinSizeState(val);
    localStorage.setItem("edtemps_simMinSize", String(val));
  };

  const [simMaxSize, setSimMaxSizeState] = useState<number>(() => {
    const saved = localStorage.getItem("edtemps_simMaxSize");
    return saved ? Number(saved) : 28;
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
    } catch { }
  };

  const setScenarios = (scens: Scenario[] | ((prev: Scenario[]) => Scenario[])) => {
    setScenariosState((prev) => {
      const next = typeof scens === "function" ? scens(prev) : scens;
      try {
        localStorage.setItem("edtemps_savedScenarios", JSON.stringify(next));
      } catch { }
      return next;
    });
  };

  function getBestScenarioId(scens: Scenario[]): string | undefined {
    if (!scens || scens.length === 0) return undefined;
    return scens.reduce((best, curr) => (curr.metrics.score > best.metrics.score ? curr : best), scens[0])?.id;
  }

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
  const [showRebalanceModal, setShowRebalanceModal] = useState<boolean>(false);
  const [ruleStudentAId, setRuleStudentAId] = useState<string>("");
  const [ruleStudentBId, setRuleStudentBId] = useState<string>("");
  const [ruleType, setRuleType] = useState<"CONFLICT" | "COLOCATION">("CONFLICT");
  const [impossibilityErrors, setImpossibilityErrors] = useState<FeasibilityError[]>([]);
  const [showAiTransparencyModal, setShowAiTransparencyModal] = useState<boolean>(false);
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);

  // Weights slider state
  const [weights, setWeightsState] = useState<DispatchWeights>(() => {
    const saved = localStorage.getItem("edtemps_weights");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch { }
    }
    return {
      genderBalance: 4,
      academicBalance: 4,
      supportBalance: 3,
      optionBalance: 2,
      optionGroupingMode: "BALANCED_DISPERSION",
      supportGroupingMode: "BALANCED_DISPERSION",
    };
  });

  const setWeights = (
    newWeights: DispatchWeights | ((prev: DispatchWeights) => DispatchWeights)
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
    const cacheVersion = localStorage.getItem("edtemps_cacheVersion");
    if (cacheVersion !== "v5") {
      localStorage.clear();
      localStorage.setItem("edtemps_cacheVersion", "v5");
    }

    const savedDatasetStr = localStorage.getItem("edtemps_savedDataset");
    const savedScenariosStr = localStorage.getItem("edtemps_savedScenarios");
    const savedSelectedId = localStorage.getItem("edtemps_selectedScenarioId");

    if (savedDatasetStr && savedScenariosStr) {
      try {
        const parsedDs = JSON.parse(savedDatasetStr) as Dataset;
        const parsedScens = JSON.parse(savedScenariosStr) as Scenario[];
        const isStale = parsedDs?.students?.some((s) => s.displayName && /\s[A-Z]\.$/.test(s.displayName));
        if (isStale) {
          localStorage.removeItem("edtemps_savedDataset");
          localStorage.removeItem("edtemps_savedScenarios");
          localStorage.removeItem("edtemps_selectedScenarioId");
        } else if (parsedDs && parsedDs.students && parsedDs.students.length > 0 && parsedScens && parsedScens.length > 0) {
          setDatasetState(parsedDs);
          setActiveDataset(parsedDs);
          setScenariosState(parsedScens);
          setSelectedIdState(savedSelectedId || getBestScenarioId(parsedScens) || parsedScens[0].id);
          setNotice(`Session et scénarios restaurés (${parsedDs.students.length} élèves, ${parsedDs.classrooms.length} classes).`);

          api.timetablingDataset().then((data) => setTimetablingData(data)).catch(() => { });
          api.timetablingSchedules().then((res) => {
            setSchedules(res.schedules);
            if (res.schedules.length > 0) setSelectedScheduleId(res.schedules[0].id);
          }).catch(() => { });
          return;
        }
      } catch { }
    }

    api.dataset()
      .then((value) => {
        setDataset(value);
        setNotice("Données synthétiques de répartition chargées.");
        api.generate({ genderBalance: 4, academicBalance: 4, supportBalance: 3, optionBalance: 2 }, value)
          .then((res) => {
            setScenarios(res.scenarios);
            const bestId = getBestScenarioId(res.scenarios);
            if (bestId) setSelectedId(bestId);
          })
          .catch(() => { });
      })
      .catch((error: Error) => setNotice(error.message));

    api.timetablingDataset().then((data) => setTimetablingData(data)).catch(() => { });
    api.timetablingSchedules().then((res) => {
      setSchedules(res.schedules);
      if (res.schedules.length > 0) setSelectedScheduleId(res.schedules[0].id);
    }).catch(() => { });
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

  const ruleAuditList = useMemo(() => {
    if (!selected) return [];
    const audits: {
      id: string;
      type: "CONFLICT" | "COLOCATION";
      studentAName: string;
      studentBName: string;
      classALabel: string;
      classBLabel: string;
      isViolated: boolean;
    }[] = [];

    const processedPairs = new Set<string>();

    for (const studentA of dataset.students) {
      const classIdA = selected.assignments[studentA.id];
      const classroomA = dataset.classrooms.find((c) => c.id === classIdA);

      for (const conflictId of studentA.conflictsWith) {
        const pairKey = [studentA.id, conflictId].sort().join(":");
        if (!processedPairs.has(`conflict:${pairKey}`)) {
          processedPairs.add(`conflict:${pairKey}`);
          const studentB = dataset.students.find((s) => s.id === conflictId);
          if (studentB) {
            const classIdB = selected.assignments[studentB.id];
            const classroomB = dataset.classrooms.find((c) => c.id === classIdB);
            const isViolated = classIdA === classIdB && Boolean(classIdA);
            audits.push({
              id: `conflict:${pairKey}`,
              type: "CONFLICT",
              studentAName: nameOf(studentA, anonymous),
              studentBName: nameOf(studentB, anonymous),
              classALabel: classroomA?.label ?? classIdA ?? "Non affecté",
              classBLabel: classroomB?.label ?? classIdB ?? "Non affecté",
              isViolated,
            });
          }
        }
      }

      if (studentA.coLocateGroupId) {
        const gKey = studentA.coLocateGroupId;
        if (!processedPairs.has(`coloc:${gKey}`)) {
          processedPairs.add(`coloc:${gKey}`);
          const groupMembers = dataset.students.filter((s) => s.coLocateGroupId === gKey);
          if (groupMembers.length >= 2) {
            const sA = groupMembers[0];
            const sB = groupMembers[1];
            const cA = selected.assignments[sA.id];
            const cB = selected.assignments[sB.id];
            const roomA = dataset.classrooms.find((c) => c.id === cA);
            const roomB = dataset.classrooms.find((c) => c.id === cB);
            const isViolated = cA !== cB;
            audits.push({
              id: `coloc:${gKey}`,
              type: "COLOCATION",
              studentAName: nameOf(sA, anonymous),
              studentBName: nameOf(sB, anonymous),
              classALabel: roomA?.label ?? cA ?? "Non affecté",
              classBLabel: roomB?.label ?? cB ?? "Non affecté",
              isViolated,
            });
          }
        }
      }
    }

    return audits;
  }, [dataset, selected, anonymous]);

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
    const fromClassId = selected.assignments[studentId];
    if (fromClassId === targetClassroomId) return;

    const toClass = dataset.classrooms.find((c) => c.id === targetClassroomId);
    const currentCount = dataset.students.filter((s) => selected.assignments[s.id] === targetClassroomId).length;

    // Si la classe cible risque de dépasser la capacité max autorisée, demander confirmation explicite
    if (toClass && currentCount >= toClass.maxSize) {
      const student = dataset.students.find((s) => s.id === studentId);
      const studentName = student ? nameOf(student, anonymous) : studentId;
      const fromClass = dataset.classrooms.find((c) => c.id === fromClassId);

      setPendingMove({
        studentId,
        studentName,
        fromClassLabel: fromClass?.label ?? "Classe actuelle",
        toClassId: targetClassroomId,
        toClassLabel: toClass.label,
        currentCount,
        maxSize: toClass.maxSize,
      });
    } else {
      // Transfert instantané direct sans bloquer l'UI
      move(studentId, targetClassroomId);
    }
  }

  async function confirmMove(): Promise<void> {
    if (!pendingMove || !selected) return;
    const { studentId, toClassId } = pendingMove;
    setPendingMove(null);
    await move(studentId, toClassId);
  }

  async function move(studentId: string, targetClassroomId: string): Promise<void> {
    if (!selected) return;
    const fromClassId = selected.assignments[studentId];
    if (fromClassId === targetClassroomId) return;

    const student = dataset.students.find((s) => s.id === studentId);
    const studentName = student ? nameOf(student, anonymous) : studentId;

    // Enregistrer l'état courant dans l'historique avant modification
    setHistoryPast((prev) => [...prev, selected]);
    setHistoryFuture([]);

    // ⚡ Mise à jour hyper-réactive et instantanée (< 1ms) des affectations et des métriques de score
    const updatedAssignments = {
      ...selected.assignments,
      [studentId]: targetClassroomId,
    };
    const updatedMetrics = calculateMetrics(dataset as any, updatedAssignments, weights);
    const updatedScenario: Scenario = {
      ...selected,
      assignments: updatedAssignments,
      metrics: updatedMetrics,
    };

    setScenarios((current) =>
      current.map((scenario) => (scenario.id === selected.id ? updatedScenario : scenario))
    );

    if (fromClassId) {
      setLastMove({ studentId, studentName, fromClassId, toClassId: targetClassroomId });
    }
    const targetLabel = dataset.classrooms.find((c) => c.id === targetClassroomId)?.label ?? targetClassroomId;
    setNotice(`Élève ${studentName} transféré immédiatement en ${targetLabel}.`);

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
      refreshAudit().catch(() => { });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Déplacement refusé par l'API.");
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

  // Créneaux d'emploi du temps (jours/périodes) : voir constants/schedule.ts

  // Thème adaptatif (Clair / Sombre)
  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("theme") as "light" | "dark") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterPageSize, setRosterPageSize] = useState(25);
  const [inspectStudent, setInspectStudent] = useState<Student | null>(null);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editStudentForm, setEditStudentForm] = useState<Student | null>(null);
  const [userRole, setUserRole] = useState<"HEADMASTER_ADMIN" | "READONLY_TEACHER">("HEADMASTER_ADMIN");
  const [editReason, setEditReason] = useState("");

  const handleSaveStudentEdit = async () => {
    if (!inspectStudent || !editStudentForm) return;

    const diffs: string[] = [];
    if (inspectStudent.gender !== editStudentForm.gender) {
      diffs.push(`Sexe: ${inspectStudent.gender} → ${editStudentForm.gender}`);
    }
    if (inspectStudent.levelAverage !== editStudentForm.levelAverage) {
      diffs.push(`Moyenne: ${inspectStudent.levelAverage.toFixed(1)} → ${editStudentForm.levelAverage.toFixed(1)}/20`);
    }
    if (JSON.stringify(inspectStudent.supportFlags.slice().sort()) !== JSON.stringify(editStudentForm.supportFlags.slice().sort())) {
      diffs.push(`Dispositifs: [${inspectStudent.supportFlags.join(",")}] → [${editStudentForm.supportFlags.join(",")}]`);
    }
    if (JSON.stringify(inspectStudent.options.slice().sort()) !== JSON.stringify(editStudentForm.options.slice().sort())) {
      diffs.push(`Options: [${inspectStudent.options.join(",")}] → [${editStudentForm.options.join(",")}]`);
    }
    if (inspectStudent.teacherComments !== editStudentForm.teacherComments) {
      diffs.push(`Appréciation mise à jour`);
    }
    if (JSON.stringify(inspectStudent.subjectGrades) !== JSON.stringify(editStudentForm.subjectGrades)) {
      diffs.push(`Notes par matière modifiées`);
    }

    const summary = diffs.length > 0 ? diffs.join(" | ") : "Mise à jour des informations de l'élève";
    const now = new Date();

    const auditEvent: AuditEvent = {
      id: `audit-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
      occurredAt: now.toISOString(),
      actorId: userRole === "HEADMASTER_ADMIN" ? "M. Le Principal (Chef d'Établissement)" : "Enseignant / Observateur",
      eventType: "STUDENT_UPDATED",
      scenarioId: selected?.id,
      details: {
        studentId: inspectStudent.id,
        displayName: nameOf(inspectStudent, anonymous),
        summary,
        reason: editReason || "Ajustement du dossier au conseil de classe",
        timestamp: now.toLocaleString("fr-FR"),
        establishmentId: dataset.establishmentId || "demo-college",
      },
    };

    const updatedStudents = dataset.students.map((s) => (s.id === editStudentForm.id ? editStudentForm : s));
    const updatedDataset = { ...dataset, students: updatedStudents };
    setDataset(updatedDataset);

    setAudit([auditEvent, ...audit]);
    setIsEditingStudent(false);
    setEditReason("");
    setNotice(`✓ Modifications de ${nameOf(editStudentForm, anonymous)} enregistrées et horodatées (${now.toLocaleTimeString("fr-FR")}). Scénarios actualisés.`);
  };

  const handleRegenerateCohort = async () => {
    setBusy(true);
    try {
      const seed = Date.now();
      const freshInput = createSyntheticDemoInputCustom(70, 3, 25, 20, seed);
      const newDataset: Dataset = {
        establishmentId: dataset.establishmentId || "demo-college",
        level: "6e (Cohorte Complète)",
        students: freshInput.students,
        classrooms: dataset.classrooms.length > 0 ? dataset.classrooms : freshInput.classrooms,
        dataClassification: "SYNTHETIC_DEMO_ONLY",
      };
      setDataset(newDataset);
      setActiveDataset(newDataset);

      const res = await api.generate(weights, newDataset);
      setScenarios(res.scenarios);
      const bestId = getBestScenarioId(res.scenarios);
      if (bestId) setSelectedId(bestId);
      setNotice("🎲 Cohorte de 70 élèves régénérée aléatoirement ! Dossiers 100% complets (LV1, LV2, Options, 9 Notes) et scénarios recalculés.");
    } catch (err: any) {
      setNotice(`Erreur lors de la génération : ${err?.message || "Impossible de régénérer"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <main className="page">
      <header className="masthead">
        <div className="brand-section" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h1>EdTemps</h1>
          <span className="brand-badge" data-tooltip="Conforme aux référentiels du Ministère de l'Éducation Nationale et de la Jeunesse (MENJ)" style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><Landmark size={13} aria-hidden="true" /> MENJ</span>
        </div>

        <button
          className="mobile-burger-btn"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Ouvrir le menu mobile"
        >
          <Menu size={22} aria-hidden="true" />
        </button>

        {/* NAVIGATION PAR ONGLETS INTÉGRÉE */}
        <nav className="nav-tabs" aria-label="Navigation principale">
          <button
            className={`tab-button ${activeTab === "dispatch" ? "active" : ""}`}
            onClick={() => setActiveTab("dispatch")}
            data-tooltip="Module 1 : Répartition équilibrée des élèves"
          >
            <School size={17} aria-hidden="true" /> Répartition des Élèves
          </button>
          <button
            className={`tab-button ${activeTab === "timetabling" ? "active" : ""}`}
            onClick={() => setActiveTab("timetabling")}
            data-tooltip="Module 2 : Emplois du temps & Remplacements"
          >
            <CalendarDays size={17} aria-hidden="true" /> Emplois du Temps
          </button>
          <button
            className={`tab-button ${activeTab === "teacher" ? "active" : ""}`}
            onClick={() => setActiveTab("teacher")}
            data-tooltip="Espace Enseignant personnel"
          >
            <GraduationCap size={17} aria-hidden="true" /> Espace Enseignant
          </button>
          <button
            className={`tab-button ${activeTab === "compliance" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("compliance");
              void refreshAudit();
            }}
            data-tooltip="Module 3 : Conformité CNIL/RGPD & RGS"
          >
            <ShieldCheck size={17} aria-hidden="true" /> Conformité DPO
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
              <Download size={13} aria-hidden="true" style={{ marginRight: "4px", verticalAlign: "-2px" }} />Importer ▾
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
                  <Package size={13} aria-hidden="true" style={{ marginRight: "5px", verticalAlign: "-2px" }} />SIECLE (Élèves)
                </button>
                <button
                  className="secondary"
                  style={{ textAlign: "left", justifyContent: "flex-start" }}
                  onClick={() => {
                    setImportMenuOpen(false);
                    stsFileInput.current?.click();
                  }}
                >
                  <Landmark size={13} aria-hidden="true" style={{ marginRight: "5px", verticalAlign: "-2px" }} />STS-Web (Profs & Services)
                </button>
                <button
                  className="secondary"
                  style={{ textAlign: "left", justifyContent: "flex-start" }}
                  onClick={() => {
                    setImportMenuOpen(false);
                    ocrFileInput.current?.click();
                  }}
                >
                  <Camera size={13} aria-hidden="true" style={{ marginRight: "5px", verticalAlign: "-2px" }} />Mistral OCR (Pixtral)
                </button>
                <button
                  className="secondary"
                  style={{ textAlign: "left", justifyContent: "flex-start" }}
                  onClick={() => {
                    setImportMenuOpen(false);
                    void triggerVoiceCommand();
                  }}
                >
                  <Mic size={13} aria-hidden="true" style={{ marginRight: "5px", verticalAlign: "-2px" }} />Dictée Vocale (Voxtral)
                </button>
                <button
                  className="secondary"
                  style={{ textAlign: "left", justifyContent: "flex-start", background: "var(--badge-need-bg)", color: "var(--badge-need-text)", border: "1px solid var(--badge-need-border)", fontWeight: 800 }}
                  onClick={() => {
                    setImportMenuOpen(false);
                    void handleRegenerateCohort();
                  }}
                  title="Générer une nouvelle cohorte aléatoire de 70 élèves complètement remplis"
                >
                  <Dices size={13} aria-hidden="true" style={{ marginRight: "5px", verticalAlign: "-2px" }} />Régénérer 70 Élèves (Aléatoire MEN)
                </button>
              </div>
            )}
          </div>

          <button
            className="theme-toggle-btn"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            data-tooltip="Basculez entre le mode clair et le mode sombre"
          >
            {theme === "light" ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
          </button>
        </div>
      </header>

      {/* BANDEAU DE STATUT COMPACT ET UNIFIÉ */}
      <div className="compact-status-bar">
        <span className="status-tag" style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
          <User size={12} aria-hidden="true" /> {actorRole === "SCHOOL_ADMIN" ? "Chef d'Établissement" : actorRole === "TEACHER" ? "Enseignant" : actorRole === "CPE" ? "CPE / Vie Scolaire" : actorRole === "DPO" ? "DPO / RSSI" : "Adjoint"}
        </span>
        <span className="status-text" style={{ display: "inline-flex", alignItems: "flex-start", gap: "5px" }}>
          <ShieldCheck size={13} aria-hidden="true" style={{ marginTop: "1px", flexShrink: 0 }} /> <span><strong>Décision humaine obligatoire :</strong> Les propositions IA sont explicables et à titre d'aide au pilotage. Seule la direction valide les décisions finales.</span>
        </span>
        {isOfflineFallback && (
          <span className="offline-tag" style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <Zap size={12} aria-hidden="true" /> Mode Staging & Simulation (Données RGPD Fictives)
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowAiTransparencyModal(true)}
          style={{
            background: "var(--card-highlight-bg)",
            border: "1px solid var(--card-highlight-border)",
            color: "var(--card-highlight-text)",
            padding: "3px 10px",
            borderRadius: "12px",
            fontSize: "0.76rem",
            fontWeight: 800,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            marginLeft: "auto",
          }}
          title="Consulter la notice claire de transparence IA, RGPD et d'hébergement souverain Mistral AI / OVHcloud"
        >
          🇪🇺 IA Souveraine Mistral AI (France) & OVHcloud ℹ️
        </button>
      </div>

      {/* SHIMMER BANNER PENDANT LA GÉNÉRATION OU LE CALCUL */}
      {busy && (
        <div className="shimmer-banner">
          <span className="shimmer-spinner"><Loader2 size={17} aria-hidden="true" /></span>
          <span>Calcul et optimisation algorithmique sous contraintes par l'IA en cours... Veuillez patienter quelques instants.</span>
        </div>
      )}

      {ocrSummary && (
        <div className="safety-banner" style={{ background: "var(--card-success-bg)", borderColor: "var(--card-success-border)", color: "var(--card-success-text)" }}>
          <strong style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><Camera size={13} aria-hidden="true" /> Analyse OCR Mistral Pixtral :</strong> {ocrSummary}
        </div>
      )}

      {voiceSummary && (
        <div className="safety-banner" style={{ background: "var(--card-info-bg)", borderColor: "var(--card-info-border)", color: "var(--card-info-text)" }}>
          <strong style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><Mic size={12} aria-hidden="true" /> Dictée Vocale Mistral Voxtral :</strong> {voiceSummary}
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
          {/* COMBINED INTERACTIVE STEPPER NAVIGATION */}
          <div
            className="workflow-stepper"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-md)",
              padding: "10px 16px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              boxShadow: "var(--shadow-sm)",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => setDispatchSubTab("roster")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flex: 1,
                minWidth: "220px",
                background: dispatchSubTab === "roster" ? "var(--bg-subtle)" : "transparent",
                border: `1px solid ${dispatchSubTab === "roster" ? "var(--primary-brand)" : "transparent"}`,
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span className={`step-pill ${dispatchSubTab === "roster" ? "active-step" : "done-step"}`}>1</span>
              <div>
                <strong style={{ fontSize: "0.88rem", display: "block", color: "var(--text-main)" }}>1. Profils Élèves ({dataset.students.length})</strong>
                <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>Vérification des dossiers & effectifs</small>
              </div>
            </button>

            <div style={{ height: "24px", width: "1px", background: "var(--border-light)" }} />

            <button
              type="button"
              onClick={() => setDispatchSubTab("weights")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flex: 1,
                minWidth: "220px",
                background: dispatchSubTab === "weights" ? "var(--bg-subtle)" : "transparent",
                border: `1px solid ${dispatchSubTab === "weights" ? "var(--primary-brand)" : "transparent"}`,
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span className={`step-pill ${dispatchSubTab === "weights" ? "active-step" : scenarios.length > 0 ? "done-step" : ""}`}>2</span>
              <div>
                <strong style={{ fontSize: "0.88rem", display: "block", color: "var(--text-main)" }}>2. Critères IA & Options</strong>
                <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>Ajuster les priorités de mixité</small>
              </div>
            </button>

            <div style={{ height: "24px", width: "1px", background: "var(--border-light)" }} />

            <button
              type="button"
              onClick={() => setDispatchSubTab("kanban")}
              disabled={scenarios.length === 0}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flex: 1,
                minWidth: "220px",
                background: dispatchSubTab === "kanban" ? "var(--bg-subtle)" : "transparent",
                border: `1px solid ${dispatchSubTab === "kanban" ? "var(--primary-brand)" : "transparent"}`,
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                cursor: scenarios.length === 0 ? "not-allowed" : "pointer",
                opacity: scenarios.length === 0 ? 0.6 : 1,
                textAlign: "left",
              }}
            >
              <span className={`step-pill ${dispatchSubTab === "kanban" ? "active-step" : scenarios.length > 0 ? "done-step" : ""}`}>3</span>
              <div>
                <strong style={{ fontSize: "0.88rem", display: "block", color: "var(--text-main)" }}>3. Scénarios & Classes ({scenarios.length})</strong>
                <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{scenarios.length > 0 ? "Variantes prêtes" : "À générer en Étape 2"}</small>
              </div>
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
            <RosterTab
              dataset={dataset}
              anonymous={anonymous}
              selected={selected}
              rosterSearch={rosterSearch}
              setRosterSearch={setRosterSearch}
              rosterFilter={rosterFilter}
              setRosterFilter={setRosterFilter}
              rosterPage={rosterPage}
              setRosterPage={setRosterPage}
              rosterPageSize={rosterPageSize}
              setRosterPageSize={setRosterPageSize}
              setInspectStudent={setInspectStudent}
              move={move}
              handleRegenerateCohort={handleRegenerateCohort}
            />
          )}

          {dispatchSubTab === "weights" && (
            <WeightsTab
              anonymous={anonymous}
              dataset={dataset}
              setDataset={setDataset}
              weights={weights}
              setWeights={setWeights}
              busy={busy}
              setBusy={setBusy}
              scenarios={scenarios}
              setScenarios={setScenarios}
              selected={selected}
              ruleStudentAId={ruleStudentAId}
              setRuleStudentAId={setRuleStudentAId}
              ruleStudentBId={ruleStudentBId}
              setRuleStudentBId={setRuleStudentBId}
              ruleType={ruleType}
              setRuleType={setRuleType}
              showBenchmark={showBenchmark}
              setShowBenchmark={setShowBenchmark}
              simStudentCount={simStudentCount}
              setSimStudentCount={setSimStudentCount}
              simClassCount={simClassCount}
              setSimClassCount={setSimClassCount}
              simMaxSize={simMaxSize}
              setSimMaxSize={setSimMaxSize}
              simMinSize={simMinSize}
              setSimMinSize={setSimMinSize}
              setImpossibilityErrors={setImpossibilityErrors}
              getBestScenarioId={getBestScenarioId}
              setSelectedId={setSelectedId}
              setNotice={setNotice}
              setDispatchSubTab={setDispatchSubTab}
            />
          )}

          {/* SUBTAB 3: SCÉNARIOS & KANBAN */}
          {dispatchSubTab === "kanban" && selected && (
            <KanbanTab
              dataset={dataset}
              weights={weights}
              anonymous={anonymous}
              busy={busy}
              scenarios={scenarios}
              selected={selected}
              selectedStudentId={selectedStudentId}
              setSelectedStudentId={setSelectedStudentId}
              selectedStudent={selectedStudent}
              dragOverClassId={dragOverClassId}
              setDragOverClassId={setDragOverClassId}
              draggedStudentId={draggedStudentId}
              setDraggedStudentId={setDraggedStudentId}
              openSupportModalClassId={openSupportModalClassId}
              setOpenSupportModalClassId={setOpenSupportModalClassId}
              lastMove={lastMove}
              historyPast={historyPast}
              historyFuture={historyFuture}
              studentsByClass={studentsByClass}
              ruleAuditList={ruleAuditList}
              setInspectStudent={setInspectStudent}
              setSelectedId={setSelectedId}
              setShowPdfModal={setShowPdfModal}
              setShowRebalanceModal={setShowRebalanceModal}
              getBestScenarioId={getBestScenarioId}
              requestMove={requestMove}
              undoLastMove={undoLastMove}
              handleUndo={handleUndo}
              handleRedo={handleRedo}
              validate={validate}
            />
          )}
        </>
      )}

      {/* TAB 2: EMPLOIS DU TEMPS & REMPLACEMENTS */}
      {activeTab === "timetabling" && (
        <TimetablingTab
          selectedWeekFilter={selectedWeekFilter}
          setSelectedWeekFilter={setSelectedWeekFilter}
          timetablingAxisFilter={timetablingAxisFilter}
          setTimetablingAxisFilter={setTimetablingAxisFilter}
          generateTimetable={generateTimetable}
          validateTimetable={validateTimetable}
          busy={busy}
          selectedSchedule={selectedSchedule}
          timetablingData={timetablingData}
          absenceTeacherId={absenceTeacherId}
          setAbsenceTeacherId={setAbsenceTeacherId}
          absenceTimeSlotId={absenceTimeSlotId}
          setAbsenceTimeSlotId={setAbsenceTimeSlotId}
          absenceReason={absenceReason}
          setAbsenceReason={setAbsenceReason}
          fetchSubstitutions={fetchSubstitutions}
          substitutions={substitutions}
        />
      )}

      {activeTab === "teacher" && (
        <TeacherTab
          timetablingData={timetablingData}
          selectedTeacherId={selectedTeacherId}
          setSelectedTeacherId={setSelectedTeacherId}
          selectedSchedule={selectedSchedule}
          dataset={dataset}
          absenceTimeSlotId={absenceTimeSlotId}
          setAbsenceTimeSlotId={setAbsenceTimeSlotId}
          setAbsenceTeacherId={setAbsenceTeacherId}
          busy={busy}
          fetchSubstitutions={fetchSubstitutions}
          setNotice={setNotice}
        />
      )}

      {/* TAB 3: CONFORMITÉ, DPO & HOMOLOGATION RGS */}
      {activeTab === "compliance" && (
        <ComplianceTab audit={audit} refreshAudit={refreshAudit} />
      )}

      {/* MODAL FICHE ÉLÈVE COMPLÈTE */}
      {inspectStudent && (
        <StudentDetailModal
          inspectStudent={inspectStudent}
          setInspectStudent={setInspectStudent}
          selected={selected}
          dataset={dataset}
          anonymous={anonymous}
          isEditingStudent={isEditingStudent}
          setIsEditingStudent={setIsEditingStudent}
          editStudentForm={editStudentForm}
          setEditStudentForm={setEditStudentForm}
          editReason={editReason}
          setEditReason={setEditReason}
          userRole={userRole}
          setUserRole={setUserRole}
          handleSaveStudentEdit={handleSaveStudentEdit}
          audit={audit}
        />
      )}

      {/* MODAL ALERTE IMPOSSIBILITÉ MATHÉMATIQUE */}
      {impossibilityErrors.length > 0 && (
        <ImpossibilityErrorModal
          impossibilityErrors={impossibilityErrors}
          onClose={() => setImpossibilityErrors([])}
          simStudentCount={simStudentCount}
          simClassCount={simClassCount}
          simMaxSize={simMaxSize}
          simMinSize={simMinSize}
          setSimClassCount={setSimClassCount}
          setSimMaxSize={setSimMaxSize}
          setSimMinSize={setSimMinSize}
          weights={weights}
          setWeights={setWeights}
          setDataset={setDataset}
          setNotice={setNotice}
        />
      )}

      {/* MODALE TRANSPARENCE IA, RGPD & SOUVERAINETÉ EUROPÉENNE (MISTRAL AI & OVHCLOUD) */}
      {showAiTransparencyModal && (
        <AiTransparencyModal onClose={() => setShowAiTransparencyModal(false)} />
      )}

      {/* MODALE DE CONFIRMATION DE DÉPLACEMENT (VALIDATION CHECK ANTI ERREUR) */}
      {pendingMove && (
        <MoveConfirmationModal
          pendingMove={pendingMove}
          onCancel={() => setPendingMove(null)}
          onConfirm={confirmMove}
        />
      )}

      {/* MODALE D'ASSISTANCE AU RÉÉQUILIBRAGE INTELLIGENT (IA & ALGO) */}
      {showRebalanceModal && selected && (
        <RebalanceAssistantModal
          dataset={dataset}
          selected={selected}
          weights={weights}
          anonymous={anonymous}
          scenarios={scenarios}
          setScenarios={setScenarios}
          move={move}
          onClose={() => setShowRebalanceModal(false)}
        />
      )}

      {/* MOBILE DRAWER OVERLAY & PANEL */}
      <div
        className={`mobile-drawer-overlay ${mobileMenuOpen ? "open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />
      <aside className={`mobile-drawer ${mobileMenuOpen ? "open" : ""}`}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>EdTemps</span>
            <span className="brand-badge" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><Landmark size={12} aria-hidden="true" /> MENJ</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            aria-label="Fermer le menu"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        {/* Section Rôle RBAC */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Rôle & Permissions (RBAC)</label>
          <select
            value={actorRole}
            onChange={(e) => {
              const newRole = e.target.value;
              setActorRole(newRole);
              setActorRoleState(newRole);
              if (newRole === "TEACHER") setActiveTab("teacher");
              else if (newRole === "DPO") setActiveTab("compliance");
              else setActiveTab("dispatch");
              setMobileMenuOpen(false);
            }}
            style={{ padding: "10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", fontWeight: 700, width: "100%" }}
          >
            <option value="SCHOOL_ADMIN">👨‍💼 Direction</option>
            <option value="DISPATCH_EDITOR">⚙️ Adjoint</option>
            <option value="TEACHER">👩‍🏫 Enseignant</option>
            <option value="CPE">📋 CPE</option>
            <option value="DPO">🔒 DPO</option>
          </select>
        </div>

        {/* Section Protection RGPD */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-subtle)", padding: "12px", borderRadius: "var(--radius-sm)" }}>
          <span style={{ fontWeight: 700, fontSize: "0.88rem", display: "inline-flex", alignItems: "center", gap: "5px" }}><Lock size={13} aria-hidden="true" /> Mode Pseudonyme RGPD</span>
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            style={{ width: "20px", height: "20px" }}
          />
        </div>

        {/* Section Outillage & Importation */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Importations & IA</label>
          <button className="secondary" onClick={() => { setMobileMenuOpen(false); fileInput.current?.click(); }} style={{ textAlign: "left", padding: "10px 12px" }}>
            <Package size={14} aria-hidden="true" style={{ marginRight: "5px", verticalAlign: "-2px" }} />Fichier SIECLE (ZIP)
          </button>
          <button className="secondary" onClick={() => { setMobileMenuOpen(false); stsFileInput.current?.click(); }} style={{ textAlign: "left", padding: "10px 12px" }}>
            <Landmark size={14} aria-hidden="true" style={{ marginRight: "5px", verticalAlign: "-2px" }} />Fichier STS-Web (XML)
          </button>
          <button className="secondary" onClick={() => { setMobileMenuOpen(false); ocrFileInput.current?.click(); }} style={{ textAlign: "left", padding: "10px 12px" }}>
            <Camera size={14} aria-hidden="true" style={{ marginRight: "5px", verticalAlign: "-2px" }} />Mistral OCR (Pixtral)
          </button>
          <button className="secondary" onClick={() => { setMobileMenuOpen(false); void triggerVoiceCommand(); }} style={{ textAlign: "left", padding: "10px 12px" }}>
            <Mic size={14} aria-hidden="true" style={{ marginRight: "5px", verticalAlign: "-2px" }} />Dictée Vocale (Voxtral)
          </button>
        </div>

        {/* Section IA Souveraine & Thème */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "auto" }}>
          <button
            className="secondary"
            onClick={() => { setMobileMenuOpen(false); setShowAiTransparencyModal(true); }}
            style={{ padding: "10px", fontSize: "0.82rem", fontWeight: 700, textAlign: "center" }}
          >
            🇪🇺 IA Souveraine Mistral & OVHcloud ℹ️
          </button>
          <button
            className="secondary"
            onClick={() => { setTheme((t) => (t === "light" ? "dark" : "light")); }}
            style={{ padding: "10px", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            {theme === "light" ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
            {theme === "light" ? "Passer au Mode Sombre" : "Passer au Mode Clair"}
          </button>
        </div>
      </aside>

      {/* MOBILE STICKY BOTTOM NAVIGATION BAR */}
      <nav className="mobile-bottom-nav">
        <button
          className={`mobile-nav-item ${activeTab === "dispatch" ? "active" : ""}`}
          onClick={() => setActiveTab("dispatch")}
        >
          <School className="nav-icon" size={19} aria-hidden="true" />
          <span>Répartition</span>
        </button>
        <button
          className={`mobile-nav-item ${activeTab === "timetabling" ? "active" : ""}`}
          onClick={() => setActiveTab("timetabling")}
        >
          <CalendarDays className="nav-icon" size={19} aria-hidden="true" />
          <span>Emplois</span>
        </button>
        <button
          className={`mobile-nav-item ${activeTab === "teacher" ? "active" : ""}`}
          onClick={() => setActiveTab("teacher")}
        >
          <GraduationCap className="nav-icon" size={19} aria-hidden="true" />
          <span>Enseignant</span>
        </button>
        <button
          className={`mobile-nav-item ${activeTab === "compliance" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("compliance");
            void refreshAudit();
          }}
        >
          <ShieldCheck className="nav-icon" size={19} aria-hidden="true" />
          <span>DPO</span>
        </button>
      </nav>
    </main>
      {showPdfModal && selected && (
        <OfficialPdfModal
          scenario={selected}
          dataset={dataset}
          anonymous={anonymous}
          onClose={() => setShowPdfModal(false)}
        />
      )}
    </>
  );
}
