import { generateScenario } from "@edtemps/domain";
import type { Dataset } from "../types";
import { nameOf, getAvatarColor } from "./format";

export type RebalanceStep = {
  id: string;
  studentId: string;
  studentName: string;
  studentInitials: string;
  avatarColor: string;
  fromClassId: string;
  fromClassLabel: string;
  toClassId: string;
  toClassLabel: string;
  priority: "HIGH" | "MEDIUM" | "NORMAL";
  title: string;
  reasoning: string;
  supportFlags: string[];
  options: string[];
};

export function computeRebalanceSteps(
  input: Dataset,
  currentAssignments: Record<string, string>,
  weights: { genderBalance: number; academicBalance: number; supportBalance: number; optionBalance: number },
  anonymous: boolean
): { steps: RebalanceStep[]; issuesCount: number } {
  const steps: RebalanceStep[] = [];
  const classroomsById = new Map(input.classrooms.map((c) => [c.id, c]));

  // Calculate current counts per class
  const classCounts = new Map<string, number>();
  for (const c of input.classrooms) classCounts.set(c.id, 0);
  for (const sId of Object.keys(currentAssignments)) {
    const cId = currentAssignments[sId];
    if (cId) classCounts.set(cId, (classCounts.get(cId) ?? 0) + 1);
  }

  // Find overcrowded classes (> maxSize) and under-capacity classes (< minSize)
  const overcrowded = input.classrooms.filter((c) => (classCounts.get(c.id) ?? 0) > c.maxSize);
  const undercapacity = input.classrooms.filter((c) => (classCounts.get(c.id) ?? 0) < c.minSize);

  // Ideal target scenario computed by solver
  let targetAssignments = currentAssignments;
  try {
    const optScenario = generateScenario(input as any, 42, weights);
    targetAssignments = optScenario.assignments;
  } catch { }

  // 1. Priority 1: Resolve Capacity Overcrowding / Undercapacity
  for (const overClass of overcrowded) {
    const overCount = (classCounts.get(overClass.id) ?? 0) - overClass.maxSize;
    const assignedStudents = input.students.filter((s) => currentAssignments[s.id] === overClass.id);

    for (let i = 0; i < overCount && i < assignedStudents.length; i++) {
      const student = assignedStudents[i];
      const targetClass = undercapacity[0] ?? input.classrooms.find((c) => c.id !== overClass.id && (classCounts.get(c.id) ?? 0) < c.maxSize);
      if (targetClass) {
        steps.push({
          id: `step-cap-${student.id}`,
          studentId: student.id,
          studentName: nameOf(student, anonymous),
          studentInitials: student.initials,
          avatarColor: getAvatarColor(student.id),
          fromClassId: overClass.id,
          fromClassLabel: overClass.label,
          toClassId: targetClass.id,
          toClassLabel: targetClass.label,
          priority: "HIGH",
          title: `Résoudre le sur-effectif de ${overClass.label}`,
          reasoning: `Transfert de ${nameOf(student, anonymous)} (${student.levelAverage.toFixed(1)}/20) vers ${targetClass.label} pour ramener ${overClass.label} à son effectif maximal autorisé (${overClass.maxSize} élèves).`,
          supportFlags: student.supportFlags,
          options: student.options,
        });
      }
    }
  }

  // 2. Priority 2: Fix differences with optimal solver solution
  for (const student of input.students) {
    const currentClassId = currentAssignments[student.id];
    const idealClassId = targetAssignments[student.id];

    if (currentClassId && idealClassId && currentClassId !== idealClassId) {
      if (!steps.some((st) => st.studentId === student.id)) {
        const fromClass = classroomsById.get(currentClassId);
        const toClass = classroomsById.get(idealClassId);
        if (fromClass && toClass) {
          steps.push({
            id: `step-opt-${student.id}`,
            studentId: student.id,
            studentName: nameOf(student, anonymous),
            studentInitials: student.initials,
            avatarColor: getAvatarColor(student.id),
            fromClassId: fromClass.id,
            fromClassLabel: fromClass.label,
            toClassId: toClass.id,
            toClassLabel: toClass.label,
            priority: steps.length === 0 ? "HIGH" : "MEDIUM",
            title: `Harmoniser les niveaux & la parité`,
            reasoning: `Transfert de ${nameOf(student, anonymous)} (${student.levelAverage.toFixed(1)}/20) de ${fromClass.label} vers ${toClass.label} pour réduire l'écart de moyenne générale et rééquilibrer la parité F/G selon les exigences réglementaires.`,
            supportFlags: student.supportFlags,
            options: student.options,
          });
        }
      }
    }
  }

  return { steps, issuesCount: overcrowded.length + undercapacity.length };
}
