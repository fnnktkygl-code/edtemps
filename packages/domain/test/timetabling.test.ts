import test from "node:test";
import assert from "node:assert/strict";
import {
  createSyntheticTimetablingDemoInput,
  generateSchedule,
  validateSchedule,
  moveCourseSlot,
  exportDispatchCSV,
  exportDispatchPRONOTE,
  createSyntheticDemoInput,
  generateScenario,
} from "../src/index.js";

test("génère un emploi du temps synthétique sans collision d'enseignants", () => {
  const input = createSyntheticTimetablingDemoInput();
  const schedule = generateSchedule(input, 42);

  assert.ok(schedule.placements.length > 0, "Au moins un cours doit être placé.");
  assert.equal(schedule.conflicts.length, 0, "Le planning initial généré ne doit comporter aucun conflit dur.");
  assert.ok(schedule.metrics.score > 500, "Le score de qualité doit être élevé.");
});

test("détecte une collision d'enseignant lorsqu'un cours est déplacé sur un créneau occupé", () => {
  const input = createSyntheticTimetablingDemoInput();
  const schedule = generateSchedule(input, 42);

  const placement1 = schedule.placements[0];
  const placement2 = schedule.placements[1];

  assert.ok(placement1 && placement2, "Au moins deux placements requis pour le test.");

  // Forcer le 2e cours sur le même créneau que le 1er cours
  const updated = moveCourseSlot(input, schedule, placement2.courseId, placement1.timeSlotId, placement2.roomId);
  const conflicts = validateSchedule(input, updated.placements);

  assert.ok(conflicts.length > 0, "Une collision doit être détectée.");
});

test("exporte la répartition au format CSV et au format PRONOTE JSON", () => {
  const input = createSyntheticDemoInput();
  const scenario = generateScenario(input, 101);

  const csv = exportDispatchCSV(input, scenario);
  assert.ok(csv.includes("id_eleve,nom_affiche"), "Le CSV doit contenir l'en-tête.");
  assert.ok(csv.includes("student-1"), "Le CSV doit contenir les identifiants d'élèves.");

  const pronote = exportDispatchPRONOTE(input, scenario);
  assert.ok(pronote.includes("EDTEMPS_PRONOTE_EXCHANGE_V1"), "L'export PRONOTE doit inclure le marqueur de format.");
});
