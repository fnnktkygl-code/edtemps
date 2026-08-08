import assert from "node:assert/strict";
import test from "node:test";
import { createSyntheticDemoInput, generateScenario, moveStudent, validateAssignment, validateDispatchFeasibility } from "../src/index.js";

test("un scénario généré respecte toutes les contraintes dures", () => {
  const input = createSyntheticDemoInput();
  const scenario = generateScenario(input, 10_000);
  assert.equal(Object.keys(scenario.assignments).length, input.students.length);
  assert.equal(validateAssignment(input, scenario.assignments).length, 0);
  assert.equal(scenario.metrics.hardConstraintViolations, 0);
  for (const classroom of input.classrooms) {
    const size = Object.values(scenario.assignments).filter((assignment) => assignment === classroom.id).length;
    assert.ok(size >= classroom.minSize && size <= classroom.maxSize);
  }
});

test("un déplacement créant une incompatibilité est refusé", () => {
  const input = createSyntheticDemoInput();
  const scenario = generateScenario(input, 10_000);
  const studentSevenClass = scenario.assignments["student-7"];
  assert.throws(() => moveStudent(input, scenario, "student-42", studentSevenClass), /Séparation obligatoire/);
});

test("un scénario est rejeté lorsque la capacité totale est insuffisante", () => {
  const input = createSyntheticDemoInput();
  input.classrooms = [{ id: "too-small", label: "Trop petite", minSize: 1, maxSize: 10 }];
  assert.throws(() => generateScenario(input, 2), /Il manque \d+ place/);
});

test("validateDispatchFeasibility détecte les impossibilités mathématiques", () => {
  const input = createSyntheticDemoInput();
  input.classrooms = [
    { id: "c1", label: "6A", minSize: 10, maxSize: 30 },
    { id: "c2", label: "6B", minSize: 10, maxSize: 30 },
  ];
  // 100 élèves dans 2 classes de 30 max -> Insuffisant !
  input.students = Array.from({ length: 100 }, (_, i) => ({
    id: `student-${i}`,
    displayName: `Student ${i}`,
    initials: `S${i}`,
    gender: "F",
    levelAverage: 12,
    supportFlags: [],
    options: [],
    conflictsWith: [],
  }));

  const res = validateDispatchFeasibility(input);
  assert.equal(res.isFeasible, false);
  assert.equal(res.errors[0].code, "TOTAL_CAPACITY_EXCEEDED");
  assert.equal(res.errors[0].suggestedFix?.recommendedClassCount, 4);
});

test("autorise l'affectation d'une option sur plusieurs classes réservées lorsque la capacité cumulée est suffisante", () => {
  const input = createSyntheticDemoInput();
  for (const c of input.classrooms) c.maxSize = 28;
  const weights = {
    optionGroupingMode: "STRICT_SINGLE_CLASS" as const,
    exclusiveOptionClassrooms: {
      "class-B": "LVB_ESP",
      "class-C": "LVB_ESP",
    },
  };
  const res = validateDispatchFeasibility(input, weights as any);
  assert.equal(res.isFeasible, true);

  const scenario = generateScenario(input, 42, weights as any);
  assert.ok(scenario);
});
