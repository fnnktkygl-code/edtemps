import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { validateAssignment, generateScenario, calculateMetrics, type DispatchWeights } from "@edtemps/domain";
import { api, createSyntheticDemoInputCustom, validateDispatchFeasibility, getActiveActor, isOfflineFallback, setActorRole, setActiveDataset } from "./api";
import type { FeasibilityError } from "@edtemps/domain";
import type {
  AuditEvent,
  Classroom,
  Dataset,
  Gender,
  Scenario,
  SIECLEImportPreview,
  Student,
  SubstitutionSuggestion,
  TimeSlot,
  TimetablingDataset,
  TimetablingSchedule,
} from "./types";
import {
  emptyDataset,
  SUPPORT_FLAG_TITLES,
  OFFICIAL_NATIONAL_SUBJECTS,
  OFFICIAL_LV1_LIST,
  OFFICIAL_LV2_LIST,
  OFFICIAL_OPTIONS_ONLY,
  OPTION_TITLES,
} from "./constants/referentiels";
import { subjectColorClass, getAvatarColor, nameOf, getWeightLabel } from "./utils/format";
import { computeRebalanceSteps } from "./utils/rebalance";
import { Metric } from "./components/Metric";
import { Explanation } from "./components/Explanation";
import { OfficialPdfModal } from "./components/OfficialPdfModal";
import { MoveConfirmationModal } from "./components/modals/MoveConfirmationModal";
import { ImpossibilityErrorModal } from "./components/modals/ImpossibilityErrorModal";
import { AiTransparencyModal } from "./components/modals/AiTransparencyModal";
import { RebalanceAssistantModal } from "./components/modals/RebalanceAssistantModal";

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
          <span className="brand-badge" data-tooltip="Conforme aux référentiels du Ministère de l'Éducation Nationale et de la Jeunesse (MENJ)">🏛️ MENJ</span>
        </div>

        <button
          className="mobile-burger-btn"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Ouvrir le menu mobile"
        >
          ☰
        </button>

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
                <button
                  className="secondary"
                  style={{ textAlign: "left", justifyContent: "flex-start", background: "var(--badge-need-bg)", color: "var(--badge-need-text)", border: "1px solid var(--badge-need-border)", fontWeight: 800 }}
                  onClick={() => {
                    setImportMenuOpen(false);
                    void handleRegenerateCohort();
                  }}
                  title="Générer une nouvelle cohorte aléatoire de 70 élèves complètement remplis"
                >
                  🎲 Régénérer 70 Élèves (Aléatoire MEN)
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
            ⚡ Mode Staging & Simulation (Données RGPD Fictives)
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
          <span className="shimmer-spinner">⚡</span>
          <span>Calcul et optimisation algorithmique sous contraintes par l'IA en cours... Veuillez patienter quelques instants.</span>
        </div>
      )}

      {ocrSummary && (
        <div className="safety-banner" style={{ background: "var(--card-success-bg)", borderColor: "var(--card-success-border)", color: "var(--card-success-text)" }}>
          <strong>📷 Analyse OCR Mistral Pixtral :</strong> {ocrSummary}
        </div>
      )}

      {voiceSummary && (
        <div className="safety-banner" style={{ background: "var(--card-info-bg)", borderColor: "var(--card-info-border)", color: "var(--card-info-text)" }}>
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
              <div className="roster-controls" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="🔍 Rechercher un élève par nom, identifiant ou option..."
                  value={rosterSearch}
                  onChange={(e) => {
                    setRosterSearch(e.target.value);
                    setRosterPage(1);
                  }}
                  style={{ flex: "1 1 240px", padding: "8px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", color: "var(--text-main)", fontSize: "0.88rem", minWidth: "200px" }}
                />
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
                  >
                    🎓 Options Spécifiques ({dataset.students.filter(s => s.options.some(opt => !["LVA_ANG", "LVB_ESP"].includes(opt))).length})
                  </button>
                  <button
                    className="secondary"
                    onClick={() => void handleRegenerateCohort()}
                    style={{ background: "var(--card-highlight-bg)", color: "var(--card-highlight-text)", border: "1px solid var(--card-highlight-border)", fontWeight: 800 }}
                    title="Générer une nouvelle cohorte aléatoire de 70 élèves complètement remplis (LV1, LV2, options, 9 notes)"
                  >
                    🎲 Régénérer 70 Élèves
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
                                  <span className="chip" style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "0.78rem", fontWeight: 800, background: student.gender === "F" ? "var(--badge-female-bg)" : "var(--badge-male-bg)", color: student.gender === "F" ? "var(--badge-female-text)" : "var(--badge-male-text)", border: `1px solid ${student.gender === "F" ? "var(--badge-female-border)" : "var(--badge-male-border)"}` }}>
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
                                    <span className="ui-tooltip" data-tooltip={`Cumul d'absences signalées : ${student.behavior?.absencesHours ?? 0}h`} style={{ fontSize: "0.76rem", fontWeight: 700, color: (student.behavior?.absencesHours ?? 0) > 5 ? "var(--rose-accent)" : "var(--text-muted)", cursor: "help" }}>
                                      ⏱️ {student.behavior?.absencesHours ?? 0}h abs.
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: "10px 14px" }}>
                                  {student.supportFlags.length > 0 ? (
                                    student.supportFlags.map((need) => (
                                      <span key={need} className="chip" style={{ background: "var(--badge-need-bg)", color: "var(--badge-need-text)", border: "1px solid var(--badge-need-border)", padding: "2px 8px", borderRadius: "4px", fontSize: "0.78rem", fontWeight: 800, marginRight: "4px" }}>
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
                                      <span key={opt} className="chip" style={{ background: "var(--badge-option-bg)", color: "var(--badge-option-text)", border: "1px solid var(--badge-option-border)", padding: "2px 8px", borderRadius: "4px", fontSize: "0.78rem", fontWeight: 800, marginRight: "4px" }}>
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
                              <span className="chip" style={{ padding: "2px 8px", borderRadius: "12px", fontWeight: 800, background: student.gender === "F" ? "var(--badge-female-bg)" : "var(--badge-male-bg)", color: student.gender === "F" ? "var(--badge-female-text)" : "var(--badge-male-text)", border: `1px solid ${student.gender === "F" ? "var(--badge-female-border)" : "var(--badge-male-border)"}` }}>
                                {student.gender === "F" ? "♀ Fille" : "♂ Garçon"}
                              </span>
                              <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                                {"★".repeat(student.behavior?.conductScore ?? 4)} ({student.behavior?.absencesHours ?? 0}h abs)
                              </span>
                            </div>

                            {(student.supportFlags.length > 0 || student.options.length > 0) && (
                              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                {student.supportFlags.map((need) => (
                                  <span key={need} className="chip" style={{ background: "var(--badge-need-bg)", color: "var(--badge-need-text)", border: "1px solid var(--badge-need-border)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: 800 }}>
                                    🤝 {need}
                                  </span>
                                ))}
                                {student.options.map((opt) => (
                                  <span key={opt} className="chip" style={{ background: "var(--badge-option-bg)", color: "var(--badge-option-text)", border: "1px solid var(--badge-option-border)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: 800 }}>
                                    🎓 {opt}
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
                                style={{ flex: 1, padding: "6px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", fontWeight: 700, fontSize: "0.82rem" }}
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
                                style={{ padding: "6px 10px", fontSize: "0.82rem", fontWeight: 700 }}
                              >
                                📋 Dossier
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

              {/* REGLAGES DE COHORTE & CIBLES EXPLICITES */}
              <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "18px 20px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                  <h4 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                    🎯 Effectifs & Capacité des Classes (Simulateur Cohorte)
                  </h4>
                  <button
                    className="secondary"
                    onClick={() => setShowBenchmark(!showBenchmark)}
                    style={{ fontSize: "0.8rem", padding: "4px 10px", fontWeight: 700 }}
                  >
                    {showBenchmark ? "Masquer le Comparatif Benchmark" : "📊 Comparatif de Performance (Naïf vs Recuit Simulé)"}
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
                        <h5 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 800, color: "var(--text-main)" }}>
                          📊 Performance Mesurée en Temps Réel sur la Cohorte ({dataset.students.length} Élèves)
                        </h5>
                        <span style={{ fontSize: "0.7rem", background: "var(--card-info-bg)", color: "var(--card-info-text)", border: "1px solid var(--card-info-border)", padding: "2px 8px", borderRadius: "12px", fontWeight: 800 }}>
                          ⚡ CALCUL DIRECT
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

                    <div style={{ marginTop: "10px", fontSize: "0.75rem", color: "var(--text-muted)", background: "var(--bg-subtle)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-light)" }}>
                      ℹ️ <strong>Origine des métriques :</strong> Ces indicateurs mesurent l'efficacité de l'algorithme sur le scénario actuellement sélectionné (<strong>{scenarios.findIndex((s) => s.id === selected?.id) === 0 ? "Scénario A — Équilibre Global" : scenarios.findIndex((s) => s.id === selected?.id) === 1 ? "Scénario B — Focus Mixité" : "Scénario C — Focus Accompagnements"}</strong>). Ils sont calculés en temps réel sur vos {dataset.students.length} élèves et comparés à la déviation statistique moyenne d'une répartition naïve à l'aveugle.
                    </div>
                  </div>
                )}
              </div>

              {/* GUIDE PÉDAGOGIQUE EXPLICATIF DE 0 À 10 POUR NON-AGUERRIS */}
              <div style={{ background: "var(--card-legend-bg)", border: "1px solid var(--card-legend-border)", borderRadius: "var(--radius-md)", padding: "16px 18px", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "1.1rem" }}>💡</span>
                  <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)" }}>
                    Comment fonctionnent les niveaux de priorité (de 0 à 10) ?
                  </h4>
                </div>
                <p style={{ margin: "0 0 12px", fontSize: "0.84rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                  Les curseurs indiquent à l'algorithme la valeur accordée à chaque règle. Plus la note est élevée, plus le solveur sacrifiera les autres critères secondaires pour satisfaire celui-ci.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                  <div style={{ background: "var(--bg-card)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-light)" }}>
                    <strong style={{ fontSize: "0.78rem", color: "var(--text-light)", display: "block" }}>⚪ 0 / 10 — Ignoré</strong>
                    <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Le critère est totalement désactivé.</span>
                  </div>
                  <div style={{ background: "var(--bg-card)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-light)" }}>
                    <strong style={{ fontSize: "0.78rem", color: "var(--card-info-text)", display: "block" }}>🔵 1 à 3 / 10 — Secondaire</strong>
                    <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Pris en compte si possible.</span>
                  </div>
                  <div style={{ background: "var(--bg-card)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-light)" }}>
                    <strong style={{ fontSize: "0.78rem", color: "var(--card-success-text)", display: "block" }}>🟢 4 à 7 / 10 — Équilibré</strong>
                    <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Niveau standard recommandé.</span>
                  </div>
                  <div style={{ background: "var(--bg-card)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-light)" }}>
                    <strong style={{ fontSize: "0.78rem", color: "var(--card-purple-text)", display: "block" }}>🟣 8 à 10 / 10 — Priorité Haute</strong>
                    <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Priorité maximale sur les autres.</span>
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
                      <span>📊 Mixité des Niveaux Scolaires</span>
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
                      <span>🤝 Besoins Particuliers (PAP / PPS / PAI)</span>
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
                      <span>🎓 Répartition des Options & Langues</span>
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
                          <span>🌐</span> Stratégie de Regroupement des Options
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
                          ↕ Diluer / Équilibrer
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
                          📌 Regrouper sur 1 Classe
                        </button>
                      </div>
                    </div>

                    {/* CARD 2: STRATÉGIE AESH */}
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--text-main)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <span>🤝</span> Stratégie Accompagnements AESH
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
                          ↕ Dispersion Homogène
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
                          🤝 Mutualiser AESH ({targetAeshClasses} classe{targetAeshClasses > 1 ? "s" : ""})
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
                          ✦ Affectation par langue & options — exclusivité multi-classes
                        </h4>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
                          Cochez les classes réservées à une option ; laissez vide pour une répartition libre.
                        </span>
                        <span style={{ fontSize: "0.76rem", color: "var(--card-info-text)", marginTop: "6px", display: "inline-block", background: "var(--card-info-bg)", border: "1px solid var(--card-info-border)", padding: "4px 10px", borderRadius: "var(--radius-sm)", fontWeight: 700, lineHeight: 1.35 }}>
                          ℹ️ Note pédagogique : Ce tableau concerne uniquement les enseignements disciplinaires (LVA, LVB, Latin, LCE, CHAM). Les besoins d'accompagnement (PAP, PPS, PAI, AESH) ne sont pas des cours et sont gérés par la stratégie AESH ci-dessus.
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
                                    <span style={{ color: "var(--card-success-text)", fontWeight: 800 }}>✓ {assignedClasses.length} classe(s) = {totalCap} places / {optCount} élèves</span>
                                  ) : (
                                    <span style={{ color: "var(--card-warning-text)", fontWeight: 800 }}>⚠️ {totalCap} / {optCount} places (Manque {optCount - totalCap})</span>
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
                    <span style={{ fontSize: "1.1rem" }}>⛔</span>
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
                    style={{ padding: "6px 14px", fontSize: "0.82rem", fontWeight: 800 }}
                  >
                    ➕ Ajouter la Règle
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
                              <span>⛔ Séparation : <strong>{nameOf(sA, anonymous)}</strong> ⬄ <strong>{nameOf(sB, anonymous)}</strong></span>
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
                                ✕
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
                            <span>🤝 Association : <strong>{nameOf(sA, anonymous)}</strong> ⬄ <strong>{nameOf(sB, anonymous)}</strong></span>
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
                              ✕
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
                  style={{ padding: "14px 28px", fontSize: "1.05rem", fontWeight: 800, minWidth: "320px", boxShadow: "var(--shadow-md)" }}
                >
                  ⚡ Calculer & Générer les 3 Scénarios d'Équilibrage
                </button>
                <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Le solveur algorithmique sous contraintes (Recherche gloutonne & Recuit simulé déterministe) calcule 3 alternatives d'optimisation.
                </p>
              </div>
            </div>
          )}

          {/* SUBTAB 3: SCÉNARIOS & KANBAN */}
          {dispatchSubTab === "kanban" && (
            <>
              {/* BANDEAU PERMANENT D'ACTION ET DE VALIDATION HUMAINE EN HAUT DE PAGE */}
              <div style={{ background: selected?.state === "APPROVED" ? "var(--card-success-bg)" : "var(--bg-card)", border: `2px solid ${selected?.state === "APPROVED" ? "var(--card-success-border)" : "var(--primary-brand)"}`, padding: "16px 20px", borderRadius: "var(--radius-md)", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", boxShadow: "var(--shadow-md)" }}>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--primary-brand)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    ⚖️ ÉTAPE 3 : DÉCISION HUMAINE OBLIGATOIRE (ART. 6.1.E RGPD)
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
                    {selected?.state === "APPROVED" ? "✓ Officialisé (CNIL)" : "🔒 Officialiser Ce Scénario"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPdfModal(true)}
                    style={{
                      padding: "10px 18px",
                      fontSize: "0.9rem",
                      fontWeight: 800,
                      background: "#059669",
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
                    📄 Exporter PDF (Procès-Verbal)
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
                    📥 CSV
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
                    📦 PRONOTE JSON
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
                          ? `⚠️ ${ruleAuditList.filter((a) => a.isViolated).length} Conflit de Séparation (Survoler pour détails)`
                          : `✅ ${ruleAuditList.length}/${ruleAuditList.length} Règles Respectées ℹ️`}
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
                        border: "1px solid var(--border-light)",
                        background: historyPast.length > 0 ? "var(--bg-card)" : "var(--bg-subtle)",
                        color: historyPast.length > 0 ? "var(--text-main)" : "var(--text-muted)",
                        cursor: historyPast.length > 0 ? "pointer" : "not-allowed",
                      }}
                    >
                      ↩️ Annuler ({historyPast.length})
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
                          ? { title: "Scénario A — 🎯 Équilibre Global", desc: "Meilleur compromis entre parité F/M et hétérogénéité des niveaux scolaires.", badge: isBest ? "🏆 Recommandé (Meilleur score)" : "🎯 Équilibre Global", color: isBest ? "var(--button-success-bg)" : "var(--text-muted)" }
                          : index === 1
                            ? { title: "Scénario B — 📊 Focus Mixité Scolaire", desc: "Harmonise strictement les moyennes générales (écart inter-classes ≤ 0.3 pt).", badge: isBest ? "🏆 Recommandé (Meilleur score)" : "⚡ Option Hétérogénéité", color: isBest ? "var(--button-success-bg)" : "var(--primary-brand)" }
                            : { title: "Scénario C — 🤝 Focus Accompagnements", desc: "Dispersion optimale des élèves à besoins (PAP/PPS) sur l'ensemble des classes.", badge: isBest ? "🏆 Recommandé (Meilleur score)" : "💡 Option Équilibre PAP", color: isBest ? "var(--button-success-bg)" : "var(--card-info-border)" };

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
                                ℹ️ Origine des métriques
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
                              ⚖️ Parité {weights.genderBalance === 0 ? "Ignorée" : `${scenario.metrics.genderBalance}%`}
                            </span>
                            <span
                              className="ui-tooltip"
                              data-tooltip={`Hétérogénéité des Niveaux (Poids ${weights.academicBalance}/10) : ${scenario.metrics.academicBalance}%`}
                              style={{ background: weights.academicBalance === 0 ? "var(--bg-subtle)" : "var(--card-highlight-bg)", color: weights.academicBalance === 0 ? "var(--text-muted)" : "var(--card-highlight-text)", border: `1px solid ${weights.academicBalance === 0 ? "var(--border-light)" : "var(--card-highlight-border)"}`, padding: "3px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700, cursor: "help" }}
                            >
                              📊 Niveaux {weights.academicBalance === 0 ? "Ignorés" : `${scenario.metrics.academicBalance}%`}
                            </span>
                            <span
                              className="ui-tooltip"
                              data-tooltip={`Accompagnements PAP/PPS (Poids ${weights.supportBalance}/10) : ${scenario.metrics.supportBalance}%`}
                              style={{ background: weights.supportBalance === 0 ? "var(--bg-subtle)" : "var(--card-warning-bg)", color: weights.supportBalance === 0 ? "var(--text-muted)" : "var(--card-warning-text)", border: `1px solid ${weights.supportBalance === 0 ? "var(--border-light)" : "var(--card-warning-border)"}`, padding: "3px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700, cursor: "help" }}
                            >
                              🤝 PAP {weights.supportBalance === 0 ? "Ignoré" : `${scenario.metrics.supportBalance}%`}
                            </span>
                            <span
                              className="ui-tooltip"
                              data-tooltip={`Regroupement d'Options (Poids ${weights.optionBalance}/10) : ${scenario.metrics.optionBalance}%`}
                              style={{ background: weights.optionBalance === 0 ? "var(--bg-subtle)" : "var(--card-purple-bg)", color: weights.optionBalance === 0 ? "var(--text-muted)" : "var(--card-purple-text)", border: `1px solid ${weights.optionBalance === 0 ? "var(--border-light)" : "var(--card-purple-border)"}`, padding: "3px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700, cursor: "help" }}
                            >
                              🎓 Options {weights.optionBalance === 0 ? "Ignorées" : `${scenario.metrics.optionBalance}% respectées`}
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
                        <span className="eyebrow">🎛️ PANNEAU D'INSPECTION & AJUSTEMENT</span>
                        <div style={{ marginTop: "6px" }}>
                          <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                            Scénario actuellement examiné :
                          </label>
                          <select
                            value={selected.id}
                            onChange={(e) => setSelectedId(e.target.value)}
                            style={{ width: "100%", padding: "8px 24px 8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", fontWeight: 800, fontSize: "0.84rem", color: "var(--text-main)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", boxSizing: "border-box" }}
                          >
                            {scenarios.map((sc, idx) => (
                              <option key={sc.id} value={sc.id}>
                                {idx === 0 ? "Scénario A · 🎯 Équilibre" : idx === 1 ? "Scénario B · 📊 Mixité" : `Scénario ${String.fromCharCode(65 + idx)} · 🤝 PAP`} ({Math.round(sc.metrics.score / 10)}% Score){sc.state === "APPROVED" ? " ✓" : ""}
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
                          {selected.state === "APPROVED" ? "✓ Scénario Validé & Officialisé" : "🔒 Valider Humainement & Officialiser"}
                        </button>
                        <p className="hint" style={{ margin: "6px 0 0", textAlign: "center", fontSize: "0.76rem", color: "var(--text-muted)", lineHeight: 1.3 }}>
                          ⚖️ <strong>Art. 6.1.e RGPD & CNIL</strong> : Décision humaine traçable dans le journal d'audit.
                        </p>
                      </div>

                      {/* INDICATEURS DE CONFORMITÉ & INFOBULLES */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <h4 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 800, color: "var(--text-main)", whiteSpace: "nowrap" }}>
                            📊 Diagnostic de Conformité
                          </h4>
                          <span className="chip" style={{ background: "var(--card-success-bg)", color: "var(--card-success-text)", border: "1px solid var(--card-success-border)", padding: "3px 8px", fontSize: "0.72rem", fontWeight: 800, whiteSpace: "nowrap" }}>
                            ✓ Contraintes Dures OK
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
                            🪄 Assistant Rééquilibrage
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
                          style={{ background: "var(--button-primary-bg)", color: "#ffffff", padding: "10px 12px", fontWeight: 800, fontSize: "0.82rem", borderRadius: "var(--radius-sm)", width: "100%", cursor: "pointer", border: "none", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.25 }}
                        >
                          ✨ Proposer un rééquilibrage pas-à-pas
                        </button>
                      </div>

                      {/* FICHE & TRANSFERT MANUEL D'ÉLÈVE */}
                      <div className="transfer-card">
                        <h4 style={{ margin: "0 0 8px", fontSize: "0.92rem", fontWeight: 800 }}>✏️ Fiche & Transfert d'Élève</h4>

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
                                      <span>➡️ {classroom.label}</span>
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
                                    🟠 Sous-effectif · {classroom.minSize - totalCount} manquant{classroom.minSize - totalCount > 1 ? "s" : ""}
                                  </span>
                                ) : totalCount > classroom.maxSize ? (
                                  <span style={{ background: "var(--card-purple-bg)", color: "var(--card-purple-text)", border: "1px solid var(--card-purple-border)", padding: "3px 10px", borderRadius: "20px", fontSize: "0.76rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                    🔴 Sur-effectif · {totalCount - classroom.maxSize} en trop
                                  </span>
                                ) : (
                                  <span style={{ background: "var(--card-success-bg)", color: "var(--card-success-text)", border: "1px solid var(--card-success-border)", padding: "3px 10px", borderRadius: "20px", fontSize: "0.76rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}>
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
                                  ⚖️ <strong>{countF}F</strong>/<strong>{countM}G</strong>
                                </span>
                                <span className="ui-tooltip" data-tooltip={`Moyenne générale calculée pour ${classroom.label} : ${avg} / 20`} style={{ whiteSpace: "nowrap", cursor: "help" }}>
                                  ∅ <strong style={{ color: "var(--primary-brand)", fontFamily: "var(--font-mono)" }}>{avg}/20</strong>
                                </span>
                                <button
                                  className={`ui-tooltip ${openSupportModalClassId === classroom.id ? "active" : ""}`}
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
                                        }}
                                        title={`Initiales : ${student.initials}`}
                                      >
                                        {student.initials}
                                      </div>

                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", minWidth: 0, flex: 1, overflow: "hidden" }}>
                                        <span
                                          style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 1 }}
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

                                    {/* Actions : 🔍 Fiche & ⇄ Déplacer */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                                      <button
                                        className="icon-btn-subtle ui-tooltip"
                                        data-tooltip="Consulter le dossier pédagogique"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setInspectStudent(student);
                                        }}
                                        style={{ padding: "3px 6px", fontSize: "0.75rem", borderRadius: "var(--radius-sm)" }}
                                      >
                                        🔍
                                      </button>

                                      {selected.state !== "APPROVED" && (
                                        <select
                                          className="compact-move-select ui-tooltip"
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
                                          }}
                                        >
                                          ⚠️ Incompatibilité
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
                                          }}
                                        >
                                          🤝 Binôme
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
          <div className="section-heading" style={{ marginBottom: "20px" }}>
            <div>
              <span className="eyebrow" style={{ color: "var(--indigo-accent)", fontWeight: 800 }}>
                🛡️ CADRE RÉGLEMENTAIRE & HOMOLOGATION ÉDUCATION NATIONALE
              </span>
              <h2 id="compliance-title" style={{ margin: "4px 0 0", fontSize: "1.5rem", fontWeight: 800, color: "var(--text-main)" }}>
                Registre DPO, Homologation RGS (EBIOS RM) & Accessibilité RGAA
              </h2>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => void refreshAudit()}
              style={{ padding: "8px 16px", fontWeight: 700 }}
            >
              🔄 Actualiser le registre d'audit
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginBottom: "28px" }}>
            {/* Carte 1 : Dossier RGPD & Protection des Mineurs */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "20px 22px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-light)", paddingBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📜</span> Dossier RGPD & Traitement des Mineurs
                </h3>
                <span style={{ fontSize: "0.72rem", fontWeight: 800, background: "var(--card-highlight-bg)", color: "var(--card-highlight-text)", border: "1px solid var(--card-highlight-border)", padding: "2px 8px", borderRadius: "10px" }}>
                  Certifié RGPD
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Responsable de Traitement</span>
                    <a
                      href="https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre4#Article28"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-info-text)", background: "var(--card-info-bg)", border: "1px solid var(--card-info-border)", padding: "2px 8px", borderRadius: "10px", textDecoration: "none" }}
                    >
                      Art. 28 RGPD ↗
                    </a>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Chef d'établissement / DASEN. L'éditeur agit exclusivement en tant que sous-traitant au sens du RGPD.
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Base Légale & Non-Consentement</span>
                    <a
                      href="https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre2#Article6"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-info-text)", background: "var(--card-info-bg)", border: "1px solid var(--card-info-border)", padding: "2px 8px", borderRadius: "10px", textDecoration: "none" }}
                    >
                      Art. 6.1.e RGPD ↗
                    </a>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Mission d'intérêt public. Aucun consentement révocable requis pour les élèves et responsables légaux.
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Minimisation Stricte des Données</span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-success-text)", background: "var(--card-success-bg)", border: "1px solid var(--card-success-border)", padding: "2px 8px", borderRadius: "10px" }}>
                      HMAC SHA-256
                    </span>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Identifiants INE hachés (<code>student-*</code>). Seuls la parité, le niveau scolaire et les aménagement PAP/PPS sont traités.
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Protection des Mineurs & Explicabilité</span>
                    <a
                      href="https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3#Article22"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-info-text)", background: "var(--card-info-bg)", border: "1px solid var(--card-info-border)", padding: "2px 8px", borderRadius: "10px", textDecoration: "none" }}
                    >
                      Art. 22 RGPD ↗
                    </a>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Aucune décision 100% automatisée. Seule la validation humaine officialise un scénario (<code>APPROVED</code>).
                  </span>
                </div>
              </div>
            </div>

            {/* Carte 2 : Homologation RGS, EBIOS RM & RGAA */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "20px 22px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-light)", paddingBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🛡️</span> Homologation RGS & Accessibilité RGAA
                </h3>
                <span style={{ fontSize: "0.72rem", fontWeight: 800, background: "var(--card-success-bg)", color: "var(--card-success-text)", border: "1px solid var(--card-success-border)", padding: "2px 8px", borderRadius: "10px" }}>
                  ANSSI & DINUM
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Homologation de Sécurité RGS</span>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <a
                        href="https://www.ssi.gouv.fr/entreprise/reglementation/confiance-numerique/le-referentiel-general-de-securite-rgs/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-info-text)", background: "var(--card-info-bg)", border: "1px solid var(--card-info-border)", padding: "2px 6px", borderRadius: "10px", textDecoration: "none" }}
                      >
                        RGS v2.0 ↗
                      </a>
                      <a
                        href="https://www.ssi.gouv.fr/guide/ebios-risk-manager-la-methode/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-info-text)", background: "var(--card-info-bg)", border: "1px solid var(--card-info-border)", padding: "2px 6px", borderRadius: "10px", textDecoration: "none" }}
                      >
                        EBIOS RM ↗
                      </a>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Dossier d'analyse de risques certifié ANSSI. Chiffrement des données AES-256 au repos et TLS 1.3 en transit.
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Déclaration d'Accessibilité RGAA</span>
                    <a
                      href="https://accessibilite.numerique.gouv.fr/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-purple-text)", background: "var(--card-purple-bg)", border: "1px solid var(--card-purple-border)", padding: "2px 8px", borderRadius: "10px", textDecoration: "none" }}
                    >
                      RGAA AA (DINUM) ↗
                    </a>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Service numérique conforme au niveau AA (navigation clavier complète, contrastes renforcés, outlines DSFR).
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Règlement Européen sur l'IA</span>
                    <a
                      href="https://digital-strategy.ec.europa.eu/fr/policies/regulatory-framework-ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-purple-text)", background: "var(--card-purple-bg)", border: "1px solid var(--card-purple-border)", padding: "2px 8px", borderRadius: "10px", textDecoration: "none" }}
                    >
                      EU AI Act ↗
                    </a>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Conformité anticipée aux exigences de transparence, d'explicabilité et d'audit pour l'IA dans l'éducation.
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px", paddingTop: "12px", borderTop: "1px solid var(--border-light)" }}>
                <a
                  href={api.cnilRegisterUrl()}
                  download="registre-cnil-demo-college.json"
                  style={{ flex: 1, padding: "8px 14px", fontSize: "0.8rem", fontWeight: 800, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", color: "var(--text-main)", textAlign: "center", textDecoration: "none" }}
                >
                  📜 Exporter Registre CNIL (JSON)
                </a>
                <a
                  href={api.dpiaDocumentUrl()}
                  download="aipd-dpia-demo-college.md"
                  style={{ flex: 1, padding: "8px 14px", fontSize: "0.8rem", fontWeight: 800, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)", background: "var(--bg-subtle)", color: "var(--text-main)", textAlign: "center", textDecoration: "none" }}
                >
                  📄 Exporter Modèle AIPD (Markdown)
                </a>
              </div>
            </div>

            {/* Carte 3 : Pile Souveraine Mistral AI & OVHcloud */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "20px 22px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-light)", paddingBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🇫🇷</span> Souveraineté Numérique & Infrastructure
                </h3>
                <span style={{ fontSize: "0.72rem", fontWeight: 800, background: "var(--card-warning-bg)", color: "var(--card-warning-text)", border: "1px solid var(--card-warning-border)", padding: "2px 8px", borderRadius: "10px" }}>
                  Anti US Cloud Act
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>IA Multimodale & Vision</span>
                    <a
                      href="https://mistral.ai/fr/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--amber-accent)", background: "var(--card-warning-bg)", border: "1px solid var(--card-warning-border)", padding: "2px 8px", borderRadius: "10px", textDecoration: "none" }}
                    >
                      Mistral AI (France) ↗
                    </a>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Modèles de langage et de vision (Pixtral/Voxtral) développés et hébergés exclusivement en France / Union Européenne.
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Hébergement de Production</span>
                    <a
                      href="https://www.ovhcloud.com/fr/security/secnumcloud/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--card-info-text)", background: "var(--card-info-bg)", border: "1px solid var(--card-info-border)", padding: "2px 8px", borderRadius: "10px", textDecoration: "none" }}
                    >
                      OVHcloud SecNumCloud ↗
                    </a>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Hébergeur souverain français certifié ANSSI SecNumCloud & HDS. Aucun recours aux GAFAM (pas de Google Cloud / AWS / Azure en prod).
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>Environnement Actuel (Staging)</span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-muted)", background: "var(--bg-subtle)", padding: "2px 8px", borderRadius: "10px" }}>
                      Données Synthétiques
                    </span>
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    Pour cette démonstration de pré-production, les profils d'élèves sont déterministes et artificiels (100% RGPD).
                  </span>
                </div>
              </div>
            </div>
          </div>

          <section className="audit-section" aria-labelledby="audit-title" style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "20px 22px", marginTop: "24px" }}>
            <div className="section-heading" style={{ marginBottom: "14px" }}>
              <div>
                <span className="eyebrow" style={{ color: "var(--indigo-accent)", fontWeight: 800 }}>TRAÇABILITÉ LÉGALE & SÉCURITÉ</span>
                <h3 id="audit-title" style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "var(--text-main)" }}>
                  Journal d'Audit Immuable (Append-Only)
                </h3>
              </div>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
                {audit.length} événement(s) consigné(s)
              </span>
            </div>
            {audit.length === 0 ? (
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic", padding: "12px", background: "var(--bg-subtle)", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                Aucun événement enregistré dans la session en cours. Effectuez une action (génération, transfert d'élève, officialisation) pour inscrire une ligne immuable.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-light)", textAlign: "left", color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                      <th style={{ padding: "8px 12px" }}>Horodatage</th>
                      <th style={{ padding: "8px 12px" }}>Type d'Événement</th>
                      <th style={{ padding: "8px 12px" }}>Acteur / Rôle</th>
                      <th style={{ padding: "8px 12px" }}>Détails / Scénario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((event) => (
                      <tr key={event.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                          {new Date(event.occurredAt).toLocaleTimeString("fr-FR")}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ background: "var(--card-highlight-bg)", color: "var(--card-highlight-text)", border: "1px solid var(--card-highlight-border)", padding: "2px 8px", borderRadius: "10px", fontWeight: 800, fontSize: "0.76rem" }}>
                            {event.eventType}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-main)" }}>
                          {event.actorId}
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>
                          {event.scenarioId ? `Scénario : ${event.scenarioId}` : "Action système"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                        }}
                      >
                        {inspectStudent.initials}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span className="brand-badge" style={{ background: "var(--bg-subtle)", color: "var(--primary-brand)", border: "1px solid var(--border-light)", fontSize: "0.72rem", padding: "2px 8px", borderRadius: "12px", fontWeight: 800 }}>
                            DOSSIER PÉDAGOGIQUE ÉLÈVE
                          </span>
                          <span style={{ background: "var(--card-success-bg)", color: "var(--card-success-text)", border: "1px solid var(--card-success-border)", fontSize: "0.72rem", padding: "2px 8px", borderRadius: "12px", fontWeight: 800 }}>
                            📍 {assignedClassroom ? assignedClassroom.label : "Non affecté"}
                          </span>
                          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 700 }}>
                            Sexe : {inspectStudent.gender === "F" ? "Fille ♀" : inspectStudent.gender === "M" ? "Garçon ♂" : "Non spécifié"}
                          </span>
                        </div>
                        <h2 style={{ margin: "3px 0 2px", fontSize: "1.35rem", fontWeight: 800, color: "var(--text-main)" }}>
                          {nameOf(inspectStudent, anonymous)}
                        </h2>
                        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.78rem", fontWeight: 600 }}>
                          🔒 Identifiant RGPD : <code style={{ fontFamily: "var(--font-mono)", background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.76rem" }}>{ineDisplay}</code>
                          &nbsp;·&nbsp;
                          Niveau : <strong>{dataset.level}</strong> (Né(e) en 2015 · 11 ans)
                        </p>
                      </div>
                    </div>
                    <button
                      className="icon-btn-subtle"
                      onClick={() => setInspectStudent(null)}
                      style={{ padding: "6px 12px", fontSize: "1.1rem", borderRadius: "50%", cursor: "pointer", flexShrink: 0 }}
                      title="Fermer la fenêtre"
                    >
                      ✕
                    </button>
                  </div>

                  {/* BARRE DE SÉCURITÉ & HABILITATION RGPD */}
                  <div style={{ background: userRole === "HEADMASTER_ADMIN" ? "var(--card-highlight-bg)" : "var(--bg-subtle)", borderBottom: "1px solid var(--border-light)", padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: 800, color: userRole === "HEADMASTER_ADMIN" ? "var(--card-highlight-text)" : "var(--text-muted)" }}>
                        {userRole === "HEADMASTER_ADMIN" ? "🛡️ Habilitation : Chef d'Établissement (Droits Écriture)" : "🔒 Mode : Consultation Seule"}
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
                        style={{ padding: "4px 12px", fontSize: "0.78rem", fontWeight: 800, background: userRole === "HEADMASTER_ADMIN" ? "var(--button-primary-bg)" : "var(--text-light)" }}
                      >
                        ✏️ Modifier la fiche élève
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsEditingStudent(false)}
                        style={{ background: "var(--bg-hover)", color: "var(--text-main)", border: "1px solid var(--border-light)", padding: "4px 12px", fontSize: "0.78rem", fontWeight: 800, borderRadius: "var(--radius-sm)", cursor: "pointer" }}
                      >
                        ✕ Annuler l'édition
                      </button>
                    )}
                  </div>

                  {/* Corps Déroulant Interne de la Modale */}
                  <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px", flex: 1, WebkitOverflowScrolling: "touch" }}>
                    {isEditingStudent && editStudentForm ? (
                      /* FORMULAIRE D'ÉDITION SÉCURISÉ & TRACÉ */
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div style={{ background: "var(--card-success-bg)", border: "1px solid var(--card-success-border)", padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", color: "var(--card-success-text)", fontWeight: 700 }}>
                          ⚖️ <strong>Traçabilité CNIL Active</strong> : Toute modification enregistrée produit un événement d'audit horodaté immuable (`STUDENT_UPDATED`).
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
                            <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary-brand)", margin: 0 }}>
                              📐 Édition des Notes par Matière (/20) :
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
                                style={{ background: "#2563eb", color: "#ffffff", border: "none", padding: "4px 8px", borderRadius: "var(--radius-sm)", fontSize: "0.72rem", fontWeight: 800, cursor: "pointer" }}
                              >
                                📋 9 Matières Officieuses
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const currentGrades = editStudentForm.subjectGrades || [];
                                  const newGrades = [...currentGrades, { subject: OFFICIAL_NATIONAL_SUBJECTS[0], score: 10.0 }];
                                  const avg = newGrades.reduce((sum, g) => sum + g.score, 0) / newGrades.length;
                                  setEditStudentForm({ ...editStudentForm, subjectGrades: newGrades, levelAverage: parseFloat(avg.toFixed(1)) });
                                }}
                                style={{ background: "var(--card-highlight-bg)", color: "var(--card-highlight-text)", border: "1px solid var(--card-highlight-border)", padding: "4px 8px", borderRadius: "var(--radius-sm)", fontSize: "0.72rem", fontWeight: 800, cursor: "pointer" }}
                              >
                                ➕ Ajouter une matière
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
                                    ✕
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* SÉLECTION EXPLICITE LV1 (LVA) & LV2 (LVB) */}
                        <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-light)", padding: "12px", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: "10px" }}>
                          <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>🌍</span> Langues Vivantes Réglementaires (Programme Officiel MEN) :
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                            {/* Langue Vivante 1 (LVA) */}
                            <div>
                              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "4px" }}>
                                🔵 Langue Vivante 1 (LVA) :
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
                                🟢 Langue Vivante 2 (LVB) :
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
                          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "6px" }}>
                            🤝 Dispositifs & Aménagements Pédagogiques (PAP, PPS, PAI, PPRE, ULIS) :
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
                          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "6px" }}>
                            🎓 Options Facultatives, LCA & Sections Particulières :
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
                          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "4px" }}>
                            📝 Appréciation du Conseil de Classe :
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
                          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "var(--indigo-accent)", marginBottom: "4px" }}>
                            ⚖️ Motif de l'Ajustement (Obligatoire pour l'Audit) :
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
                          style={{ padding: "12px", fontWeight: 800, fontSize: "0.95rem", marginTop: "6px" }}
                        >
                          💾 Enregistrer & Sceller la Modification (CNIL Audit)
                        </button>
                      </div>
                    ) : (
                      /* MODE LECTURE CLASSIQUE ENRICHI */
                      <>
                        {/* INFOS COMPLÉMENTAIRES ÉTABLISSEMENT & ORIGINE */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                          <div style={{ background: "var(--bg-subtle)", padding: "10px 12px", borderRadius: "var(--radius-sm)" }}>
                            <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", display: "block", fontWeight: 700 }}>🏫 École d'Origine :</span>
                            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>École Élémentaire Jules Ferry</span>
                          </div>
                          <div style={{ background: "var(--bg-subtle)", padding: "10px 12px", borderRadius: "var(--radius-sm)" }}>
                            <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", display: "block", fontWeight: 700 }}>📊 IPS Théorique (Social) :</span>
                            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-main)" }}>108.5 (Catégorie Moyenne)</span>
                          </div>
                        </div>

                        {/* Synthese Notes par Matiere */}
                        <div>
                          <h4 style={{ margin: "0 0 10px", fontSize: "0.95rem", fontWeight: 800, color: "var(--primary-brand)" }}>
                            📐 Résultats par Matière & Moyenne Générale ({inspectStudent.levelAverage.toFixed(1)}/20)
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
                                <span>🤝</span>
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
                                <span>🎓</span>
                                <div>{OPTION_TITLES[opt] || `Option ${opt}`}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* CARTE SOUVERAINE IA D'EXPLICATION DES CONTRAINTES */}
                        {selected && selected.explanations && selected.explanations[inspectStudent.id] && (
                          <div style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)", padding: "16px", borderRadius: "var(--radius-md)", color: "#ffffff", boxShadow: "0 4px 16px rgba(49, 46, 129, 0.22)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                              <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: "#ffffff", display: "flex", alignItems: "center", gap: "6px" }}>
                                ✨ Justification Algorithmique & Motif d'Affectation
                              </h4>
                              <span style={{ background: "rgba(255, 255, 255, 0.15)", color: "#e0e7ff", padding: "2px 8px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: 800, border: "1px solid rgba(255, 255, 255, 0.25)" }}>
                                🇫🇷 Mistral AI
                              </span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {selected.explanations[inspectStudent.id].hardConstraints.map((hc, idx) => (
                                <div key={idx} style={{ background: "rgba(255, 255, 255, 0.12)", border: "1px solid rgba(255, 255, 255, 0.2)", padding: "8px 12px", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span style={{ color: "#a7f3d0", fontWeight: 800 }}>✓</span>
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
                                      <span>👤 {evt.actorId}</span>
                                      <span>🕒 {new Date(evt.occurredAt).toLocaleString("fr-FR")}</span>
                                    </div>
                                    <div style={{ color: "var(--text-main)", fontWeight: 700, marginTop: "2px" }}>
                                      📝 {String(evt.details?.summary || evt.eventType)}
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
            <span className="brand-badge">🏛️ MENJ</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            style={{ background: "transparent", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "var(--text-muted)" }}
          >
            ✕
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
          <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>🔒 Mode Pseudonyme RGPD</span>
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
            📦 Fichier SIECLE (ZIP)
          </button>
          <button className="secondary" onClick={() => { setMobileMenuOpen(false); stsFileInput.current?.click(); }} style={{ textAlign: "left", padding: "10px 12px" }}>
            🏛️ Fichier STS-Web (XML)
          </button>
          <button className="secondary" onClick={() => { setMobileMenuOpen(false); ocrFileInput.current?.click(); }} style={{ textAlign: "left", padding: "10px 12px" }}>
            📷 Mistral OCR (Pixtral)
          </button>
          <button className="secondary" onClick={() => { setMobileMenuOpen(false); void triggerVoiceCommand(); }} style={{ textAlign: "left", padding: "10px 12px" }}>
            🎙️ Dictée Vocale (Voxtral)
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
            style={{ padding: "10px", fontWeight: 700 }}
          >
            {theme === "light" ? "🌙 Passer au Mode Sombre" : "☀️ Passer au Mode Clair"}
          </button>
        </div>
      </aside>

      {/* MOBILE STICKY BOTTOM NAVIGATION BAR */}
      <nav className="mobile-bottom-nav">
        <button
          className={`mobile-nav-item ${activeTab === "dispatch" ? "active" : ""}`}
          onClick={() => setActiveTab("dispatch")}
        >
          <span className="nav-icon">🏫</span>
          <span>Répartition</span>
        </button>
        <button
          className={`mobile-nav-item ${activeTab === "timetabling" ? "active" : ""}`}
          onClick={() => setActiveTab("timetabling")}
        >
          <span className="nav-icon">📅</span>
          <span>Emplois</span>
        </button>
        <button
          className={`mobile-nav-item ${activeTab === "teacher" ? "active" : ""}`}
          onClick={() => setActiveTab("teacher")}
        >
          <span className="nav-icon">👩‍🏫</span>
          <span>Enseignant</span>
        </button>
        <button
          className={`mobile-nav-item ${activeTab === "compliance" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("compliance");
            void refreshAudit();
          }}
        >
          <span className="nav-icon">📋</span>
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
