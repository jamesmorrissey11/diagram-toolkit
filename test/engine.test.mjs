// node --test test/  (e2e tests need a local Chrome-family browser; they are skipped when none is found)
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir, stat, cp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.join(HERE, "../skills/arch-diagram/engine");
const FIX = path.join(HERE, "fixtures");
process.env.DIAGRAM_TOOLKIT_HOME = await mkdtemp(path.join(os.tmpdir(), "dt-home-"));

const { validateSpec, normalizeSpec, SpecError } = await import(`${ENGINE}/lib/spec.mjs`);
const { importPack, searchIcons, iconContrast } = await import(`${ENGINE}/lib/icons.mjs`);
const { buildDiagram, lintFile, specOf, HandEditError } = await import(`${ENGINE}/lib/build.mjs`);
const { findChrome } = await import(`${ENGINE}/lib/chrome.mjs`);
const { openStudio } = await import(`${ENGINE}/lib/studio.mjs`);

const minimal = () => ({ nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [{ id: "e1", from: "a", to: "b" }] });
const problems = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof SpecError, e.message); return e.problems.join("\n"); } assert.fail("expected SpecError"); };

describe("spec", () => {
  test("rejects pixels, colours and fonts", () => {
    const s = minimal();
    s.nodes[0].x = 10; s.nodes[1].fill = "#f00"; s.edges[0].fontSize = 12;
    const p = problems(() => validateSpec(s));
    for (const f of ["\"x\"", "\"fill\"", "\"fontSize\""]) assert.match(p, new RegExp(f));
  });
  test("rejects duplicate ids, dangling edges, half hints", () => {
    const s = minimal();
    s.nodes.push({ id: "a", label: "dup" });
    s.edges.push({ id: "e2", from: "a", to: "zzz" });
    s.nodes[1].row = 1;
    const p = problems(() => validateSpec(s));
    assert.match(p, /duplicate id "a"/);
    assert.match(p, /to "zzz" is not a node/);
    assert.match(p, /give both row and col/);
  });
  test("preset precedence: request > spec > type > default, persisted", () => {
    const s = { ...minimal(), type: "agent" };
    assert.equal(normalizeSpec(s).spec.preset, "concept");
    assert.equal(normalizeSpec({ ...s, preset: "sketch" }).spec.preset, "sketch");
    assert.equal(normalizeSpec({ ...s, preset: "sketch" }, { requestedPreset: "reference" }).spec.preset, "reference");
    assert.equal(normalizeSpec(minimal()).spec.preset, "reference");
    assert.equal(normalizeSpec(minimal()).presetSource, "default");
  });
  test("concept preset refuses > 9 nodes", () => {
    const s = { nodes: Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, label: `N${i}` })), edges: [] };
    assert.match(problems(() => normalizeSpec(s, { requestedPreset: "concept" })), /concept preset is for <= 9 nodes/);
  });
});

describe("icons", () => {
  before(async () => { await importPack("azure", path.join(FIX, "azure-pack")); });
  test("official pack names are normalized and searchable", async () => {
    const hits = await searchIcons("azure openai");
    assert.equal(hits[0].ref, "azure:openai");
    assert.equal((await searchIcons("cosmos db"))[0].ref, "azure:cosmos-db");
    assert.equal((await searchIcons("vector search"))[0].ref, "generic:scan-search");
  });
  test("contrast check flags marks that vanish on the canvas", () => {
    assert.ok(iconContrast('<svg><path fill="#ffffff"/></svg>', "#FFFFFF") < 1.6);
    assert.ok(iconContrast('<svg><path fill="#000000"/></svg>', "#FFFFFF") > 10);
  });
});

const FIXTURES = (await readdir(FIX)).filter((f) => f.endsWith(".json"));

// Layout regression: structural snapshot of node/group boxes and edge routes, compared with a 2px tolerance.
// Refresh intentionally with: UPDATE_SNAPSHOTS=1 npm test
const SNAP = path.join(HERE, "snapshots");
async function layoutSnapshot(name, scene) {
  const snap = {};
  for (const e of scene.elements) {
    const k = e.customData?.dt?.kind;
    if (k === "node") snap[`node:${e.customData.dt.id}`] = [e.x, e.y, e.width, e.height].map(Math.round);
    if (k === "group") snap[`group:${e.customData.dt.id}`] = [e.x, e.y, e.width, e.height].map(Math.round);
    if (k === "edge") snap[`edge:${e.customData.dt.id}`] = [Math.round(e.x), Math.round(e.y), ...e.points.flat().map(Math.round)];
  }
  const file = path.join(SNAP, name);
  let golden = null;
  try { golden = JSON.parse(await readFile(file, "utf8")); } catch {}
  if (!golden || process.env.UPDATE_SNAPSHOTS) {
    await import("node:fs/promises").then((m) => m.mkdir(SNAP, { recursive: true }));
    await writeFile(file, JSON.stringify(snap, null, 1));
    return;
  }
  const diffs = [];
  for (const k of new Set([...Object.keys(golden), ...Object.keys(snap)])) {
    const a = golden[k], b = snap[k];
    if (!a || !b || a.length !== b.length || a.some((v, i) => Math.abs(v - b[i]) > 2)) diffs.push(k);
  }
  assert.deepEqual(diffs, [], `layout changed for ${name} (refresh with UPDATE_SNAPSHOTS=1 if intended)`);
}
const chrome = (() => { try { return findChrome(); } catch { return null; } })();
describe("end-to-end", { skip: !chrome && "no Chrome-family browser found" }, () => {
  let studio, out;
  before(async () => {
    studio = await openStudio();
    out = await mkdtemp(path.join(os.tmpdir(), "dt-e2e-"));
    await importPack("azure", path.join(FIX, "azure-pack"));
  });
  after(async () => { await studio?.close(); });

  for (const f of FIXTURES) {
    test(`acceptance fixture ${f} passes hard + readability gates and conserves elements`, async () => {
      const s = await buildDiagram(studio, { specPath: path.join(FIX, f), out: path.join(out, f.replace(".json", "")), publish: true });
      assert.deepEqual(s.hard, [], `hard defects: ${s.hard.join(", ")}`);
      assert.ok(s.readability.pass, JSON.stringify(s.readability));
      assert.ok((await stat(s.files.png)).size > 5000);
      const spec = JSON.parse(await readFile(path.join(FIX, f), "utf8"));
      const scene = JSON.parse(await readFile(s.files.excalidraw, "utf8"));
      const tagged = (kind) => new Set(scene.elements.filter((e) => e.customData?.dt?.kind === kind).map((e) => e.customData.dt.id));
      assert.deepEqual([...tagged("node")].sort(), spec.nodes.map((n) => n.id).sort());
      assert.deepEqual([...tagged("edge")].sort(), spec.edges.map((e) => e.id).sort());
      // Excalidraw re-anchors linear elements to points[0] = [0,0] on load; emitting otherwise makes a pristine file look hand-edited
      for (const e of scene.elements.filter((x) => x.points)) assert.deepEqual(e.points[0], [0, 0], `${e.id} first point`);
      await layoutSnapshot(f, scene);
    });
  }

  test("embedded spec round-trips and lint re-runs on the file", async () => {
    const base = path.join(out, "roundtrip");
    await buildDiagram(studio, { specPath: path.join(FIX, "agent-loop.json"), out: base });
    const spec = await specOf(`${base}.excalidraw`);
    assert.equal(spec.preset, "concept");
    assert.equal(spec.nodes.length, 7);
    const l = await lintFile(`${base}.excalidraw`);
    assert.equal(l.edit, "clean");
    assert.deepEqual(l.hard, []);
  });

  test("refuses to overwrite hand edits unless forced", async () => {
    const base = path.join(out, "edited");
    const specPath = path.join(FIX, "simple-rag-concept.json");
    await buildDiagram(studio, { specPath, out: base });
    await buildDiagram(studio, { specPath, out: base }); // unchanged file: regenerating is fine
    const scene = JSON.parse(await readFile(`${base}.excalidraw`, "utf8"));
    scene.elements.find((e) => e.id === "llm").x += 40; // user drags a node in Excalidraw
    await writeFile(`${base}.excalidraw`, JSON.stringify(scene));
    await assert.rejects(buildDiagram(studio, { specPath, out: base }), HandEditError);
    assert.equal((await lintFile(`${base}.excalidraw`)).edit, "edited");
    await buildDiagram(studio, { specPath, out: base, force: true });
  });

  test("unknown icon: placeholder in draft, hard defect in publish", async () => {
    const dir = await mkdtemp(path.join(out, "ph-"));
    const specPath = path.join(dir, "s.json");
    await writeFile(specPath, JSON.stringify({ nodes: [{ id: "a", label: "Thing", icon: "azure:does-not-exist" }, { id: "b", label: "Other", icon: "generic:server" }], edges: [{ id: "e", from: "a", to: "b" }] }));
    const draft = await buildDiagram(studio, { specPath });
    assert.deepEqual(draft.hard, []);
    assert.ok(draft.issues.some((i) => i.code === "unresolved-icon" && i.node === "a"));
    const pub = await buildDiagram(studio, { specPath, publish: true, force: true });
    assert.ok(pub.hard.includes("unresolved-icon:a"));
  });

  test("a ribbon of 8 nodes in one row fails readability (deliberate failure)", async () => {
    const dir = await mkdtemp(path.join(out, "ribbon-"));
    const specPath = path.join(dir, "s.json");
    const nodes = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, label: `Service ${i}`, icon: "generic:server", row: 0, col: i }));
    const edges = nodes.slice(1).map((n, i) => ({ id: `e${i}`, from: `n${i}`, to: n.id, label: "calls" }));
    const s = await buildDiagram(studio, { specPath: await writeFile(specPath, JSON.stringify({ nodes, edges })).then(() => specPath) });
    assert.equal(s.ok, false);
    assert.equal(s.readability.pass, false);
    assert.ok(s.warnings.some((w) => /narrower|aspect/.test(w)));
  });

  test("lint flags off-token styling injected by hand", async () => {
    const base = path.join(out, "token");
    await buildDiagram(studio, { specPath: path.join(FIX, "simple-rag-reference.json"), out: base });
    const scene = JSON.parse(await readFile(`${base}.excalidraw`, "utf8"));
    scene.elements.find((e) => e.id === "app").backgroundColor = "#ff00ff";
    await writeFile(`${base}.excalidraw`, JSON.stringify(scene));
    const l = await lintFile(`${base}.excalidraw`);
    assert.ok(l.hard.some((h) => h.startsWith("off-token:backgroundColor:#ff00ff")));
  });
});
