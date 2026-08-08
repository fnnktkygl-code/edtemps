import assert from "node:assert/strict";
import test from "node:test";
import AdmZip from "adm-zip";
import { parseSIECLEArchive } from "../src/siecle-import.js";

function archiveWith(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  Object.entries(files).forEach(([name, content]) => zip.addFile(name, Buffer.from(content)));
  return zip.toBuffer();
}

test("importe les élèves SIECLE sans exposer leur INE", () => {
  const archive = archiveWith({
    "ElevesSansAdresses.xml": `<ELEVES><ELEVE INE="123456789AB" NOM="Martin" PRENOM="Lina" SEXE="F" CODE_DIVISION="6A" LV1="ANGLAIS" /></ELEVES>`,
    "Structures.xml": `<STRUCTURES><DIVISION CODE="6A" LIBELLE="6e A" /></STRUCTURES>`,
    "Nomenclature.xml": "<NOMENCLATURE />",
  });
  const preview = parseSIECLEArchive(archive, "secret-de-test-suffisamment-long", "demo-college");
  assert.equal(preview.students.length, 1);
  assert.match(preview.students[0].id, /^student-/);
  assert.doesNotMatch(preview.students[0].id, /123456789AB/);
  assert.equal(preview.students[0].displayName, "Lina M.");
  assert.deepEqual(preview.students[0].options, ["ANGLAIS"]);
  assert.deepEqual(preview.classrooms, [{ id: "6A", label: "6e A", minSize: 1, maxSize: 35 }]);
});

test("refuse une archive sans fichier élèves", () => {
  const archive = archiveWith({ "Structures.xml": "<STRUCTURES />" });
  assert.throws(() => parseSIECLEArchive(archive, "secret-de-test-suffisamment-long", "demo-college"), /ElevesSansAdresses/);
});
