// CI helper tests: required-Chrome gating, artifact export and mismatch evidence. No browser needed.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir, mkdir } from "node:fs/promises";
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
    await exportOutputs(await built(), "boards", "cap", { DIAGRAM_ARTIFACT_DIR: art });
    assert.deepEqual((await readdir(path.join(art, "boards"))).sort(), ["cap.excalidraw", "cap.lint.json", "cap.png", "cap.svg"]);
  });
  test("exportOutputs and writeMismatch do nothing when the variable is unset", async () => {
    assert.equal(await exportOutputs(await built(), "boards", "cap", {}), null);
    assert.equal(await writeMismatch("goldens", "a.json", "{}", "{}", {}), null);
  });
  test("a golden mismatch writes actual and expected evidence, then still fails", async () => {
    const art = await tmp(), gold = await tmp();
    await mkdir(path.join(gold, "boards"), { recursive: true });
    await writeFile(path.join(gold, "boards/b.json"), JSON.stringify({ elements: [], appState: {}, files: {} }));
    const prev = process.env.DIAGRAM_ARTIFACT_DIR;
    process.env.DIAGRAM_ARTIFACT_DIR = art;
    try {
      await assert.rejects(sceneGolden("boards/b.json", { elements: [{ id: "x" }], appState: {} }, { goldDir: gold }), /scene changed/);
    } finally { if (prev === undefined) delete process.env.DIAGRAM_ARTIFACT_DIR; else process.env.DIAGRAM_ARTIFACT_DIR = prev; }
    const d = path.join(art, "mismatch/goldens/boards");
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
    assert.ok(missing.includes("boards/capability-categories.lint.json"));
    assert.ok(missing.includes("examples/arch-diagram-pipeline-ml.excalidraw"));
  });
  test("summary table shows kind, result, effective text size and warnings", () => {
    const t = summaryTable([
      { name: "boards/cap", summary: { kind: "board", preset: "clean", ok: true, readability: { effMinText: 12, displayWidth: 800 }, hard: [], warnings: [] } },
      { name: "fixtures/x", summary: { preset: "reference", ok: false, readability: { effMinText: 9, displayWidth: 1200 }, hard: ["missing-node:a"], warnings: ["a|b"] } },
    ]);
    assert.match(t, /\| boards\/cap \| board \| clean \| ✅ pass \| 12px at 800px \| none \|/);
    assert.match(t, /\| fixtures\/x \| graph \| reference \| ❌ fail \| 9px at 1200px \| HARD missing-node:a; a\\\|b \|/);
  });
});
