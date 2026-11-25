// Unit tests for the concept-visual features (layouts, frame, annotations, glossary). Pure pipeline with a fake text
// measurer, so no browser is needed; e2e coverage comes from test/fixtures/layout-*.json in engine.test.mjs.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.join(HERE, "../skills/arch-diagram/engine");
const { normalizeSpec, loadPreset, SpecError } = await import(`${ENGINE}/lib/spec.mjs`);
const { buildGeometry } = await import(`${ENGINE}/lib/geometry.mjs`);
const { placeGrid } = await import(`${ENGINE}/lib/place.mjs`);
const { route } = await import(`${ENGINE}/lib/route.mjs`);
const { emitScene } = await import(`${ENGINE}/lib/emit.mjs`);
const { lintScene } = await import(`${ENGINE}/lib/lint.mjs`);

export const tw = (s, size) => Math.ceil(String(s).length * size * 0.55);

async function pipeline(raw, opts = {}) {
  const { spec } = normalizeSpec(raw, opts);
  const preset = await loadPreset(spec.preset);
  const geo = buildGeometry(spec, preset, tw);
  const placed = placeGrid(spec, geo, preset);
  const routed = route(spec, geo, placed, preset);
  const { scene } = await emitScene(spec, preset, geo, placed, routed);
  return { spec, preset, geo, scene, lint: lintScene(scene, spec, preset) };
}

const conceptPair = () => ({
  preset: "concept",
  nodes: [{ id: "a", label: "Run tools", sub: "Tests · build · lint", role: "support" }, { id: "b", label: "Observe", role: "terminal", sub: "Errors · diffs" }],
  edges: [{ id: "e1", from: "a", to: "b" }],
});

describe("concept text", () => {
  test("concept box renders sub", async () => {
    const { geo } = await pipeline(conceptPair());
    assert.equal(geo.nodes.a.showSub, true);
    assert.ok(geo.nodes.a.parts.sub, "box has a sub part");
    assert.equal(geo.nodes.b.showSub, true);
    assert.ok(geo.nodes.b.parts.sub, "pill has a sub part");
  });
  test("lint hard-fails when supplied text is missing from the scene", async () => {
    const { spec, preset, scene } = await pipeline(conceptPair());
    scene.elements = scene.elements.filter((e) => e.id !== "a_sub");
    const l = lintScene(scene, spec, preset);
    assert.ok(l.hard.includes("text-dropped:nodeSub:a"), l.hard.join(", "));
  });
  test("concept preset draws the title", async () => {
    const { scene } = await pipeline({ ...conceptPair(), title: "Loop" });
    assert.ok(scene.elements.some((e) => e.id === "title" && e.text === "Loop"));
  });
});

export { pipeline, normalizeSpec, loadPreset, SpecError, buildGeometry, emitScene, lintScene, ENGINE };

const { layoutFor } = await import(`${ENGINE}/lib/layouts/index.mjs`).catch(() => ({}));
const { readdir, readFile } = await import("node:fs/promises");
const FIX = path.join(HERE, "fixtures");
const problems = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof SpecError, e.message); return e.problems.join("\n"); } assert.fail("expected SpecError"); };

describe("layout dispatch", () => {
  test("unknown layout is rejected with the list of layouts", () => {
    assert.match(problems(() => normalizeSpec({ ...conceptPair(), layout: "spiral" })), /layout "spiral" unknown; use one of grid/);
  });
  test("grid layout via dispatch is identical to placeGrid+route", async () => {
    assert.equal(typeof layoutFor, "function", "layouts/index.mjs exports layoutFor");
    for (const f of (await readdir(FIX)).filter((x) => x.endsWith(".json") && !x.startsWith("layout-"))) {
      const { spec } = normalizeSpec(JSON.parse(await readFile(path.join(FIX, f), "utf8")));
      const preset = await loadPreset(spec.preset);
      const geo = buildGeometry(spec, preset, tw);
      const placed = placeGrid(spec, geo, preset), routed = route(spec, geo, placed, preset);
      const laid = layoutFor(spec).compose(spec, geo, preset);
      assert.deepEqual(laid.nodes, placed.nodes, f);
      assert.deepEqual(laid.routes, routed.routes, f);
      assert.deepEqual(laid.decor, [], f);
    }
  });
});
