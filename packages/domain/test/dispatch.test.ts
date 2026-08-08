import assert from "node:assert/strict";
import test from "node:test";
import { createSyntheticDemoInput, generateScenario, moveStudent, validateAssignment } from "../src/index.js";

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
  assert.throws(() => generateScenario(input, 2), /capacité totale/);
});
