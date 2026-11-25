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
