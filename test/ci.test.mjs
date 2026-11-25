// CI helper tests: required-Chrome gating, artifact export and mismatch evidence. No browser needed.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const { e2eSkip, exportOutputs, writeMismatch } = await import("./ci.mjs");
const { sceneGolden } = await import("./golden.mjs");
const tmp = () => mkdtemp(path.join(os.tmpdir(), "dt-ci-"));
const missing = () => { throw new Error("no browser"); };

describe("DIAGRAM_REQUIRE_CHROME", () => {
  test("no browser: end-to-end suites skip locally", () => {
    assert.equal(e2eSkip(missing, {}), "no Chrome-family browser found");
  });
  test("no browser: DIAGRAM_REQUIRE_CHROME=1 turns the skip into a failure", () => {
    assert.throws(() => e2eSkip(missing, { DIAGRAM_REQUIRE_CHROME: "1" }), /DIAGRAM_REQUIRE_CHROME=1.*no browser/);
  });
  test("browser found: never skips", () => {
    assert.equal(e2eSkip(() => "/usr/bin/google-chrome", { DIAGRAM_REQUIRE_CHROME: "1" }), false);
  });
});

describe("DIAGRAM_ARTIFACT_DIR", () => {
  const built = async () => {
    const dir = await tmp();
    const files = {};
    for (const ext of ["excalidraw", "png", "svg"]) { files[ext] = path.join(dir, `x.${ext}`); await writeFile(files[ext], ext); }
    await writeFile(path.join(dir, "x.lint.json"), "{}");
    return { files };
  };
  test("exportOutputs copies .png .svg .excalidraw .lint.json into <dir>/<group>/", async () => {
    const art = await tmp();
    await exportOutputs(await built(), "fixtures", "cap", { DIAGRAM_ARTIFACT_DIR: art });
    assert.deepEqual((await readdir(path.join(art, "fixtures"))).sort(), ["cap.excalidraw", "cap.lint.json", "cap.png", "cap.svg"]);
  });
  test("exportOutputs and writeMismatch do nothing when the variable is unset", async () => {
    assert.equal(await exportOutputs(await built(), "fixtures", "cap", {}), null);
    assert.equal(await writeMismatch("goldens", "a.json", "{}", "{}", {}), null);
  });
  test("a golden mismatch writes actual and expected evidence, then still fails", async () => {
    const art = await tmp(), gold = await tmp();
    await writeFile(path.join(gold, "b.json"), JSON.stringify({ elements: [], appState: {}, files: {} }));
    const prev = process.env.DIAGRAM_ARTIFACT_DIR;
    process.env.DIAGRAM_ARTIFACT_DIR = art;
    try {
      await assert.rejects(sceneGolden("b.json", { elements: [{ id: "x" }], appState: {} }, { goldDir: gold }), /scene changed/);
    } finally { if (prev === undefined) delete process.env.DIAGRAM_ARTIFACT_DIR; else process.env.DIAGRAM_ARTIFACT_DIR = prev; }
    const d = path.join(art, "mismatch/goldens");
    assert.deepEqual((await readdir(d)).sort(), ["b.actual.json", "b.expected.json"]);
    assert.equal(JSON.parse(await readFile(path.join(d, "b.actual.json"), "utf8")).elements[0].id, "x");
  });
});

describe("render-examples", async () => {
  const { pickExamples, missingOutputs, summaryTable } = await import("../scripts/render-examples.mjs");
  test("builds only skill examples that are not identical to a test fixture", async () => {
    const names = (await pickExamples()).map((e) => e.name);
    assert.deepEqual(names, ["arch-diagram-hub-agent-loop", "arch-diagram-pipeline-ml", "arch-diagram-tiered-azure-rag"]);
  });
  test("--check lists every expected output that is missing", async () => {
    const missing = await missingOutputs(await tmp());
    assert.ok(missing.includes("fixtures/agent-loop.png"));
    assert.ok(missing.includes("fixtures/simple-rag-sketch.lint.json"));
    assert.ok(missing.includes("examples/arch-diagram-pipeline-ml.excalidraw"));
  });
  test("summary table shows preset, result, effective text size and warnings", () => {
    const t = summaryTable([
      { name: "examples/cap", summary: { preset: "sketch", ok: true, readability: { effMinText: 12, displayWidth: 800 }, hard: [], warnings: [] } },
      { name: "fixtures/x", summary: { preset: "reference", ok: false, readability: { effMinText: 9, displayWidth: 1200 }, hard: ["missing-node:a"], warnings: ["a|b"] } },
    ]);
    assert.match(t, /\| examples\/cap \| sketch \| ✅ pass \| 12px at 800px \| none \|/);
    assert.match(t, /\| fixtures\/x \| reference \| ❌ fail \| 9px at 1200px \| HARD missing-node:a; a\\\|b \|/);
  });
});

describe("golden comparison tolerance", async () => {
  const { compareScenes } = await import("./golden.mjs");
  const base = () => ({
    elements: [
      { id: "a", type: "rectangle", x: 10, y: 20, width: 100, height: 60, strokeColor: "#1e1e1e", backgroundColor: "#e7f5ff", fontSize: undefined,
        customData: { dt: { kind: "node", footprint: { x: 10, y: 20, w: 100, h: 60 } }, diagramToolkit: { sceneHash: "aaaa", spec: { title: "T" } } } },
      { id: "t", type: "text", x: 12, y: 22, width: 58, height: 20, text: "retrain", fontSize: 14, strokeColor: "#1e1e1e", containerId: null },
      { id: "p", type: "line", x: 0, y: 0, width: 30, height: 14, points: [[0, 0], [30, 14.198281055602939]], strokeColor: "#1e1e1e" },
    ],
    appState: { viewBackgroundColor: "#ffffff" }, files: {},
  });
  const edit = (f) => { const s = base(); f(s.elements); return s; };
  test("identical scenes match", () => assert.deepEqual(compareScenes(base(), base()), []));
  test("observed platform drift passes: 1-ulp floats, 1px text width and x, derived sceneHash", () => {
    const s = edit((e) => { e[2].points[1][1] = 14.198281055602937; e[1].width = 59; e[1].x = 11; e[0].customData.diagramToolkit.sceneHash = "bbbb"; e[0].customData.dt.footprint.w = 101; });
    assert.deepEqual(compareScenes(s, base()), []);
  });
  test("a 2px geometry shift fails (x, width, points, footprint)", () => {
    for (const f of [(e) => { e[0].x += 2; }, (e) => { e[1].width += 2; }, (e) => { e[2].points[1][0] += 2; }, (e) => { e[0].customData.dt.footprint.h -= 2; }])
      assert.notDeepEqual(compareScenes(edit(f), base()), []);
  });
  test("any text, style, structure or spec change fails", () => {
    for (const f of [
      (e) => { e[1].text = "retrain!"; }, (e) => { e[1].text = "re\ntrain"; }, (e) => { e[0].strokeColor = "#000000"; }, (e) => { e[0].backgroundColor = "#ebfbee"; },
      (e) => { e[1].fontSize = 15; }, (e) => { e[1].containerId = "a"; }, (e) => { e[0].customData.diagramToolkit.spec.title = "U"; },
      (e) => { e.reverse(); }, (e) => { e.pop(); }, (e) => { e[0].id = "b"; }, (e) => { e[2].points.push([1, 1]); },
    ]) assert.notDeepEqual(compareScenes(edit(f), base()), [], f.toString());
  });
});
