import test from "node:test";
import assert from "node:assert/strict";
import {
  createSyntheticTimetablingDemoInput,
  generateSchedule,
  suggestTeacherSubstitutions,
  type TeacherAbsence,
} from "../src/index.js";
import { parseSTSWebXML } from "../../../apps/api/src/sts-import.js";

test("suggère des enseignants remplaçants pertinents en cas d'absence", () => {
  const input = createSyntheticTimetablingDemoInput();
  const schedule = generateSchedule(input, 42);

  const absence: TeacherAbsence = {
    id: "abs-1",
    teacherId: "prof-math-1",
    timeSlotId: "slot-lun-2",
    reason: "Stage de formation académique",
  };

  const suggestions = suggestTeacherSubstitutions(input, schedule, absence);

  assert.ok(Array.isArray(suggestions), "Le résultat doit être une liste de suggestions.");
  if (suggestions.length > 0) {
    const topSuggestion = suggestions[0];
    assert.ok(topSuggestion.matchScore >= 50, "Le score de pertinence doit être au moins de 50.");
    assert.notEqual(topSuggestion.substituteTeacherId, absence.teacherId, "L'enseignant absent ne peut pas être son propre remplaçant.");
  }
});

test("parse un extrait XML STS-Web d'enseignants", () => {
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
  <STS_EMP>
    <ENSEIGNANT>
      <ID>12345</ID>
      <NOM_USAGE>DupONT</NOM_USAGE>
      <PRENOM>Jean</PRENOM>
      <DISCIPLINE>Mathématiques</DISCIPLINE>
    </ENSEIGNANT>
  </STS_EMP>`;

  const preview = parseSTSWebXML(sampleXml);

  assert.equal(preview.source, "STS_WEB_XML");
  assert.equal(preview.rawTeacherCount, 1);
  assert.equal(preview.teachers[0].displayName, "DUPONT J. (Mathématiques)");
});
