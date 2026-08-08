import assert from "node:assert/strict";
import test from "node:test";
import { createSyntheticDemoInputCustom, generateScenario } from "../src/index.js";

test("moteur de répartition : performance & robustesse de 80 à 1,200 élèves", () => {
  const benchmarks = [
    { count: 80, classes: 4, maxMs: 1000 },
    { count: 300, classes: 10, maxMs: 3000 },
    { count: 600, classes: 20, maxMs: 8000 },
    { count: 1200, classes: 40, maxMs: 15000 },
  ];

  for (const b of benchmarks) {
    const start = Date.now();
    const input = createSyntheticDemoInputCustom(b.count, b.classes, 30, 20, 42);
    const scenario = generateScenario(input, 42);

    const elapsed = Date.now() - start;
    assert.ok(scenario, `Le scénario doit être généré pour ${b.count} élèves`);
    assert.equal(Object.keys(scenario.assignments).length, b.count);
    assert.ok(elapsed <= b.maxMs, `La génération de ${b.count} élèves doit s'exécuter en moins de ${b.maxMs} ms (actuel: ${elapsed} ms)`);
  }
});
