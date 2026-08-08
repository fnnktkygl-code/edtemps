import { createHmac } from "node:crypto";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import type { Classroom, DispatchInput, Gender, Student } from "../../../packages/domain/src/index.js";

export type SIECLEImportPreview = {
  source: "SIECLE_ZIP";
  level: string;
  students: Student[];
  classrooms: Classroom[];
  warnings: string[];
  sourceFiles: string[];
};

type XmlNode = Record<string, unknown>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
});

function normalized(value: string): string {
  return value.replace(/^.*:/, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function scalar(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") return String(value).trim() || undefined;
  if (value && typeof value === "object" && "#text" in value && typeof (value as XmlNode)["#text"] === "string") {
    return String((value as XmlNode)["#text"]).trim() || undefined;
  }
  return undefined;
}

function valueOf(node: XmlNode, fieldNames: string[]): string | undefined {
  const wanted = new Set(fieldNames.map(normalized));
  for (const [key, value] of Object.entries(node)) {
    if (wanted.has(normalized(key))) {
      const result = scalar(value);
      if (result) return result;
    }
  }
  return undefined;
}

function namedNodes(value: unknown, targetNames: string[], found: XmlNode[] = []): XmlNode[] {
  if (Array.isArray(value)) {
    value.forEach((item) => namedNodes(item, targetNames, found));
    return found;
  }
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value as XmlNode)) {
    if (targetNames.includes(normalized(key))) {
      const entries = Array.isArray(child) ? child : [child];
      entries.forEach((entry) => {
        if (entry && typeof entry === "object") found.push(entry as XmlNode);
      });
    }
    namedNodes(child, targetNames, found);
  }
  return found;
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.slice(0, 1).toUpperCase() || "É"}.${lastName.slice(0, 1).toUpperCase() || "?"}.`;
}

function safeDisplayName(firstName: string, lastName: string, sequence: number): string {
  const first = firstName.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g, "").trim();
  const initial = lastName.trim().slice(0, 1).toUpperCase();
  return first ? `${first} ${initial || "?"}.` : `Élève ${sequence}`;
}

function asGender(value: string | undefined): Gender {
  if (value?.toUpperCase().startsWith("M")) return "M";
  if (value?.toUpperCase().startsWith("F")) return "F";
  return "X";
}

function pseudonymize(sourceIdentifier: string, tenantSecret: string): string {
  return `student-${createHmac("sha256", tenantSecret).update(sourceIdentifier).digest("base64url").slice(0, 24)}`;
}

function optionsOf(node: XmlNode): string[] {
  const candidates = ["LV1", "LV2", "OPTION", "SPECIALITE", "CODEOPTION", "CODEENSEIGNEMENT"];
  return [...new Set(candidates.map((field) => valueOf(node, [field])).filter((value): value is string => Boolean(value)))];
}

function textFromZip(zip: AdmZip, expectedFileName: string): string | undefined {
  const entry = zip.getEntries().find((item) => item.entryName.split("/").pop()?.toLowerCase() === expectedFileName.toLowerCase());
  return entry && !entry.isDirectory ? entry.getData().toString("utf8") : undefined;
}

/**
 * Lit le sous-ensemble d'un export SIECLE utilisable sans adresse.
 * Les schémas peuvent différer selon l'académie et le millésime : les attributs
 * et les balises usuels sont volontairement acceptés, les inconnus deviennent
 * des avertissements plutôt que des hypothèses silencieuses.
 */
export function parseSIECLEArchive(archive: Buffer, tenantSecret: string, establishmentId: string): SIECLEImportPreview {
  if (tenantSecret.length < 16) throw new Error("Le secret de pseudonymisation doit contenir au moins 16 caractères.");
  const zip = new AdmZip(archive);
  const sourceFiles = zip.getEntries().filter((entry) => !entry.isDirectory).map((entry) => entry.entryName);
  const warnings: string[] = [];
  const studentsXml = textFromZip(zip, "ElevesSansAdresses.xml");
  const structuresXml = textFromZip(zip, "Structures.xml");
  const nomenclatureXml = textFromZip(zip, "Nomenclature.xml");
  if (!studentsXml) throw new Error("Archive SIECLE invalide : ElevesSansAdresses.xml est introuvable.");
  if (!structuresXml) warnings.push("Structures.xml est absent : les libellés de classes sont déduits des élèves.");
  if (!nomenclatureXml) warnings.push("Nomenclature.xml est absent : les options sont importées seulement lorsqu'elles figurent sur l'élève.");

  const parsedStudents = xmlParser.parse(studentsXml) as XmlNode;
  const studentNodes = namedNodes(parsedStudents, ["ELEVE", "ELEVES", "INDIVIDU"]);
  if (studentNodes.length === 0) throw new Error("Aucun élève n'a été trouvé dans ElevesSansAdresses.xml.");

  const importedStudents: Student[] = [];
  const seen = new Set<string>();
  const divisionsByCode = new Map<string, string>();
  if (structuresXml) {
    const parsedStructures = xmlParser.parse(structuresXml) as XmlNode;
    namedNodes(parsedStructures, ["DIVISION", "CLASSE"]).forEach((node) => {
      const code = valueOf(node, ["CODE", "CODEDIVISION", "ID", "CODECLASSE"]);
      const label = valueOf(node, ["LIBELLE", "LIBELLELONG", "NOM", "LIBELLEDIVISION"]);
      if (code) divisionsByCode.set(code, label ?? code);
    });
  }

  studentNodes.forEach((node, index) => {
    const sourceIdentifier = valueOf(node, ["INE", "IDNATIONAL", "ID_ELEVE", "IDELEVE", "ELEVE_ID", "IDENTIFIANT"]);
    if (!sourceIdentifier) {
      warnings.push(`Élève ${index + 1} ignoré : aucun identifiant technique n'a été trouvé.`);
      return;
    }
    const id = pseudonymize(sourceIdentifier, tenantSecret);
    if (seen.has(id)) {
      warnings.push(`Doublon d'identifiant ignoré pour l'élève ${index + 1}.`);
      return;
    }
    seen.add(id);
    const firstName = valueOf(node, ["PRENOM", "PRENOMUSUEL", "FIRSTNAME"]) ?? "";
    const lastName = valueOf(node, ["NOM", "NOMDEFAMILLE", "NOMFAMILLE", "LASTNAME"]) ?? "";
    importedStudents.push({
      id,
      displayName: safeDisplayName(firstName, lastName, index + 1),
      initials: initials(firstName, lastName),
      gender: asGender(valueOf(node, ["SEXE", "GENRE"])),
      // Les évaluations ne font pas partie de l'export SIECLE de référence.
      // La valeur neutre évite d'inférer un niveau scolaire absent.
      levelAverage: 10,
      options: optionsOf(node),
      supportFlags: [],
      conflictsWith: [],
    });
  });
  if (importedStudents.length === 0) throw new Error("L'archive ne contient aucun élève importable.");

  const classCodes = new Set<string>();
  studentNodes.forEach((node) => {
    const code = valueOf(node, ["CODEDIVISION", "DIVISION", "CODECLASSE", "CLASSE"]);
    if (code) classCodes.add(code);
  });
  const classrooms = [...classCodes].sort().map((code) => ({
    id: code.replace(/[^A-Za-z0-9_-]/g, "-") || `classe-${classCodes.size}`,
    label: divisionsByCode.get(code) ?? code,
    // Valeurs de travail explicites : l'administrateur doit les confirmer avant calcul.
    minSize: 1,
    maxSize: 35,
  }));
  if (classrooms.length === 0) warnings.push("Aucune structure de classe n'a été détectée ; créez les classes cibles avant d'activer l'import.");

  return {
    source: "SIECLE_ZIP",
    level: "À configurer",
    students: importedStudents,
    classrooms,
    warnings,
    sourceFiles,
  };
}

export function inputFromSIECLEPreview(preview: SIECLEImportPreview, targetClassrooms: Classroom[], level: string): DispatchInput {
  if (targetClassrooms.length === 0) throw new Error("Au moins une classe cible doit être configurée.");
  const capacity = targetClassrooms.reduce((total, classroom) => total + classroom.maxSize, 0);
  if (capacity < preview.students.length) throw new Error("La capacité des classes cibles est insuffisante pour cet import.");
  return { establishmentId: "imported-establishment", level, students: preview.students, classrooms: targetClassrooms, dataClassification: "PSEUDONYMIZED_IMPORT" as const };
}
