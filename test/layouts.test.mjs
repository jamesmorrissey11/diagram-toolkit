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

describe("shapes, curves, decor", () => {
  const gated = () => ({
    preset: "concept",
    nodes: [{ id: "a", label: "Plan", role: "support" }, { id: "g", label: "Approve?", role: "gate" }, { id: "m", label: "Memory", role: "store" }],
    edges: [{ id: "e1", from: "a", to: "g" }, { id: "e2", from: "g", to: "m" }],
  });
  test("gate role emits a diamond bound to its edges", async () => {
    const { scene, lint } = await pipeline(gated());
    const d = scene.elements.find((e) => e.id === "g");
    assert.equal(d.type, "diamond");
    assert.ok(d.boundElements.some((b) => b.id === "edge_e1"));
    assert.equal(scene.elements.find((e) => e.id === "m").type, "ellipse");
    assert.deepEqual(lint.hard, []);
  });
  test("curved route emits a non-elbowed rounded arrow", async () => {
    const { spec } = normalizeSpec(gated());
    const preset = await loadPreset(spec.preset);
    const geo = buildGeometry(spec, preset, tw);
    const laid = layoutFor(spec).compose(spec, geo, preset);
    laid.routes.e1.curved = true;
    const { scene } = await emitScene(spec, preset, geo, laid, laid);
    const a = scene.elements.find((e) => e.id === "edge_e1");
    assert.equal(a.elbowed, false);
    assert.deepEqual(a.roundness, { type: 2 });
    assert.equal(scene.elements.find((e) => e.id === "edge_e2").elbowed, true);
  });
  test("decor elements pass token lint", async () => {
    const { spec } = normalizeSpec(gated());
    const preset = await loadPreset(spec.preset);
    const geo = buildGeometry(spec, preset, tw);
    const laid = layoutFor(spec).compose(spec, geo, preset);
    laid.decor = [
      { kind: "line", id: "axis", x1: -40, y1: -40, x2: 400, y2: -40, style: "line" },
      { kind: "rect", id: "lane", x: -60, y: -60, w: 20, h: 20, style: "lane" },
      { kind: "ellipse", id: "ring", x: -60, y: 300, w: 20, h: 20, style: "track" },
      { kind: "text", id: "hdr", x: -60, y: -100, text: "Header", style: "header" },
    ];
    const { scene } = await emitScene(spec, preset, geo, laid, laid);
    for (const id of ["axis", "lane", "ring", "hdr"]) assert.ok(scene.elements.some((e) => e.customData?.dt?.kind?.startsWith("decor") && e.customData.dt.id === id), id);
    const l = lintScene(scene, spec, preset);
    assert.deepEqual(l.hard.filter((h) => h.startsWith("off-token")), []);
  });
});

describe("frame and annotations", () => {
  const annotated = () => ({
    preset: "concept", displayWidth: 1200, title: "Why the loop works", subtitle: "Long-running work is a loop, not one giant prompt.",
    source: "OpenAI, Run long horizon tasks with Codex (2026)",
    nodes: [{ id: "plan", label: "Plan", badge: 1, row: 0, col: 0 }, { id: "edit", label: "Edit code", badge: 2, row: 0, col: 1 },
      { id: "test", label: "Run tools", badge: 3, row: 1, col: 1 }, { id: "fix", label: "Repair", badge: 4, row: 1, col: 0 }],
    edges: [{ id: "e1", from: "plan", to: "edit" }, { id: "e2", from: "edit", to: "test" }, { id: "e3", from: "test", to: "fix" }, { id: "e4", from: "fix", to: "plan", kind: "optional" }],
    callouts: [
      { id: "fb", title: "Real feedback", text: "Errors, diffs and logs tell the agent what actually happened.", refs: ["test", "fix"], tone: "red" },
      { id: "st", title: "Externalized state", text: "Repo, files and docs hold memory outside the prompt.", refs: ["plan"], tone: "yellow" },
      { id: "sr", title: "Steerability", text: "Humans course-correct from real outcomes.", tone: "blue" },
    ],
    legend: [{ kind: "sync", meaning: "main loop" }, { kind: "optional", meaning: "repeat" }],
  });
  const frameFor = async (bodyW) => {
    const { placeFrame } = await import(`${ENGINE}/lib/frame.mjs`);
    const { spec } = normalizeSpec(annotated());
    const preset = await loadPreset(spec.preset);
    const geo = buildGeometry(spec, preset, tw);
    const laid = { nodes: { plan: { x: 0, y: 0, w: bodyW, h: 300 } }, groups: {}, routes: {}, decor: [] };
    return placeFrame(spec, geo, preset, laid);
  };
  test("frame places callouts beside the body when they fit", async () => {
    assert.equal((await frameFor(600)).placement, "side");
  });
  test("frame moves callouts below when side placement breaks readability", async () => {
    assert.equal((await frameFor(1100)).placement, "below");
  });
  test("badges must be unique integers", () => {
    const s = annotated(); s.nodes[1].badge = 1;
    assert.match(problems(() => normalizeSpec(s)), /badge 1 used twice/);
  });
  test("callout refs must name nodes", () => {
    const s = annotated(); s.callouts[0].refs = ["zzz"];
    assert.match(problems(() => normalizeSpec(s)), /callout fb: ref "zzz" is not a node/);
  });
  test("annotated diagram passes hard lint and keeps every annotation string", async () => {
    const { scene, lint } = await pipeline(annotated());
    assert.deepEqual(lint.hard, []);
    const texts = scene.elements.filter((e) => e.type === "text").map((e) => e.text).join("\n");
    for (const s of ["Why the loop works", "Long-running work", "Source: OpenAI", "Real feedback", "Steerability", "main loop", "repeat"]) assert.ok(texts.includes(s), s);
    assert.equal(scene.elements.filter((e) => e.customData?.dt?.kind === "nodeBadge").length, 4);
    assert.ok(scene.elements.some((e) => e.customData?.dt?.kind === "calloutRef" && /steps 3–4/.test(e.text ?? "")), "ref chip names the referenced steps");
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

describe("glossary", () => {
  const GL = path.join(HERE, "fixtures-glossary");
  const load = async () => JSON.parse(await readFile(path.join(GL, "spec.json"), "utf8"));
  test("resolves @g labels and @g fields from the glossary", async () => {
    const { resolveGlossary } = await import(`${ENGINE}/lib/glossary.mjs`);
    const r = await resolveGlossary(await load(), GL);
    assert.equal(r.nodes[0].label, "Copilot cloud agent");
    assert.equal(r.nodes[0].sub, "Asynchronous coding agent");
  });
  test("unknown glossary id is a spec error naming the id", async () => {
    const { resolveGlossary } = await import(`${ENGINE}/lib/glossary.mjs`);
    const s = await load(); s.nodes[0].label = "@g:clud-agent";
    await assert.rejects(resolveGlossary(s, GL), (e) => e instanceof SpecError && /glossary id "clud-agent" not found/.test(e.problems.join()));
  });
  test("a non-GA glossary status draws a status chip on the node", async () => {
    const { resolveGlossary } = await import(`${ENGINE}/lib/glossary.mjs`);
    const { scene, lint } = await pipeline(await resolveGlossary(await load(), GL));
    const chip = scene.elements.find((e) => e.customData?.dt?.kind === "nodeStatus" && e.customData.dt.id === "b");
    assert.equal(chip?.text, "preview");
    assert.ok(!scene.elements.some((e) => e.customData?.dt?.kind === "nodeStatus" && e.customData.dt.id === "a"));
    assert.deepEqual(lint.hard, []);
  });
});
