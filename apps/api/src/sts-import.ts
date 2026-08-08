import { XMLParser } from "fast-xml-parser";
import type { Teacher } from "../../../packages/domain/src/index.js";

export type STSImportPreview = {
  source: "STS_WEB_XML";
  teachers: Teacher[];
  warnings: string[];
  rawTeacherCount: number;
};

type XmlNode = Record<string, unknown>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
});

function scalar(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") return String(value).trim() || undefined;
  if (value && typeof value === "object" && "#text" in value) {
    return String((value as XmlNode)["#text"]).trim() || undefined;
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
    const norm = key.toUpperCase().replace(/^.*:/, "");
    if (targetNames.includes(norm)) {
      const entries = Array.isArray(child) ? child : [child];
      entries.forEach((entry) => {
        if (entry && typeof entry === "object") found.push(entry as XmlNode);
      });
    }
    namedNodes(child, targetNames, found);
  }
  return found;
}

export function parseSTSWebXML(xmlContent: string): STSImportPreview {
  const warnings: string[] = [];
  const parsed = xmlParser.parse(xmlContent) as XmlNode;
  const teacherNodes = namedNodes(parsed, ["ENSEIGNANT", "ENSEIGNANTS", "INDIVIDU", "PERSONNEL"]);

  if (teacherNodes.length === 0) {
    throw new Error("Fichier STS-Web invalide : aucun enseignant trouvé dans l'archive XML.");
  }

  const importedTeachers: Teacher[] = [];

  teacherNodes.forEach((node, index) => {
    const id = scalar(node["ID"]) ?? scalar(node["CODE"]) ?? scalar(node["NUM_INDIVIDU"]) ?? `prof-sts-${index + 1}`;
    const lastName = scalar(node["NOM_USAGE"]) ?? scalar(node["NOM"]) ?? `Enseignant`;
    const firstName = scalar(node["PRENOM"]) ?? `${index + 1}`;
    const discipline = scalar(node["DISCIPLINE"]) ?? scalar(node["CODE_DISCIPLINE"]) ?? "Enseignement Général";

    importedTeachers.push({
      id: `prof-${id.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      displayName: `${lastName.toUpperCase()} ${firstName.slice(0, 1).toUpperCase()}. (${discipline})`,
      subjects: [discipline],
      unavailableSlotIds: [],
    });
  });

  return {
    source: "STS_WEB_XML",
    teachers: importedTeachers,
    warnings,
    rawTeacherCount: teacherNodes.length,
  };
}
