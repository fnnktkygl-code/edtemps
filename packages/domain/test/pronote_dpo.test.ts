import test from "node:test";
import assert from "node:assert/strict";
import {
  exportDispatchPRONOTE,
  parsePronoteExchangeJSON,
  generateCNILRegisterJSON,
  generateDPIAMarkdown,
  createSyntheticDemoInput,
  generateScenario,
} from "../src/index.js";

test("importe un fichier d'échange PRONOTE JSON valide", () => {
  const input = createSyntheticDemoInput();
  const scenario = generateScenario(input, 42);
  const jsonExport = exportDispatchPRONOTE(input, scenario);

  const parsed = parsePronoteExchangeJSON(jsonExport);
  assert.equal(parsed.establishmentId, "demo-college");
  assert.ok(parsed.assignmentsCount > 0);
});

test("génère le registre CNIL et le modèle AIPD en Markdown", () => {
  const registerJson = generateCNILRegisterJSON("demo-college");
  assert.ok(registerJson.includes("EdTemps SaaS Platform"));
  assert.ok(registerJson.includes("Chef d'Établissement"));

  const dpiaMd = generateDPIAMarkdown("demo-college");
  assert.ok(dpiaMd.includes("Analyse d'Impact relative à la Protection des Données"));
  assert.ok(dpiaMd.includes("Article 35 du RGPD"));
});
