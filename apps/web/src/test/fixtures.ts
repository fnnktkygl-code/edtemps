import type { DispatchWeights } from "@edtemps/domain";
import type { Classroom, Dataset, Scenario, Student } from "../types";

export function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: "stu-1",
    displayName: "Camille Dubois",
    initials: "CD",
    gender: "F",
    levelAverage: 14.5,
    options: [],
    supportFlags: [],
    conflictsWith: [],
    ...overrides,
  };
}

export function makeClassroom(overrides: Partial<Classroom> = {}): Classroom {
  return {
    id: "cls-a",
    label: "6e A",
    minSize: 20,
    maxSize: 28,
    ...overrides,
  };
}

export function makeDataset(overrides: Partial<Dataset> = {}): Dataset {
  const classrooms = overrides.classrooms ?? [
    makeClassroom({ id: "cls-a", label: "6e A" }),
    makeClassroom({ id: "cls-b", label: "6e B" }),
  ];
  const students = overrides.students ?? [
    makeStudent({ id: "stu-1", displayName: "Camille Dubois", initials: "CD", gender: "F" }),
    makeStudent({ id: "stu-2", displayName: "Lucas Martin", initials: "LM", gender: "M", supportFlags: ["PAP"] }),
    makeStudent({ id: "stu-3", displayName: "Inès Bernard", initials: "IB", gender: "F", options: ["LATIN"] }),
    makeStudent({ id: "stu-4", displayName: "Noah Petit", initials: "NP", gender: "M" }),
  ];
  return {
    establishmentId: "college-test",
    level: "6e",
    students,
    classrooms,
    dataClassification: "SYNTHETIC_DEMO_ONLY",
    ...overrides,
  };
}

export function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: "scenario-1",
    assignments: {
      "stu-1": "cls-a",
      "stu-2": "cls-a",
      "stu-3": "cls-b",
      "stu-4": "cls-b",
    },
    explanations: {},
    metrics: {
      score: 88,
      genderBalance: 90,
      academicBalance: 85,
      supportBalance: 80,
      optionBalance: 92,
      hardConstraintViolations: 0,
    },
    state: "DRAFT",
    generatedAt: new Date("2026-01-01").toISOString(),
    ...overrides,
  };
}

export function makeWeights(overrides: Partial<DispatchWeights> = {}): DispatchWeights {
  return {
    genderBalance: 5,
    academicBalance: 5,
    supportBalance: 5,
    optionBalance: 5,
    ...overrides,
  };
}

/** studentsByClass tel que produit par le useMemo de App.tsx */
export function makeStudentsByClass(dataset: Dataset, scenario: Scenario) {
  return dataset.classrooms.map((classroom) => ({
    ...classroom,
    students: dataset.students.filter((s) => scenario.assignments[s.id] === classroom.id),
  }));
}
