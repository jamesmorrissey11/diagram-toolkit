#!/usr/bin/env node
// CI: renders the skill reference examples that the test suites don't already build, then summarises every
// .lint.json in DIAGRAM_ARTIFACT_DIR. One browser for all builds. Graph examples build with --publish.
//   node scripts/render-examples.mjs            build examples into $DIAGRAM_ARTIFACT_DIR/examples, write the summary
//   node scripts/render-examples.mjs --check    fail if $DIAGRAM_ARTIFACT_DIR is missing any expected output
import { readFile, readdir, writeFile, appendFile, mkdtemp, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_EXTS = ["excalidraw", "png", "svg", "lint.json"];
const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };
const jsonFiles = async (dir) => ((await exists(dir)) ? (await readdir(dir)).filter((f) => f.endsWith(".json")).sort().map((f) => path.join(dir, f)) : []);
const canon = async (p) => JSON.stringify(JSON.parse(await readFile(p, "utf8")));

/** Test fixtures the suites build, as { group, name, path }: group is the artifact sub-directory the tests export to. */
export async function testFixtures(root = ROOT) {
  return [
    ...(await jsonFiles(path.join(root, "test/fixtures"))).map((p) => ({ group: "fixtures", name: path.basename(p, ".json"), path: p })),
    ...(await jsonFiles(path.join(root, "test/fixtures/boards"))).map((p) => ({ group: "boards", name: path.basename(p, ".json"), path: p })),
  ];
}

/** Skill reference examples whose content is not identical to a test fixture, as { name: "<skill>-<example>", path }. */
export async function pickExamples(root = ROOT) {
  const built = new Set(await Promise.all((await testFixtures(root)).map((f) => canon(f.path))));
  const out = [];
  for (const skill of (await readdir(path.join(root, "skills"))).sort())
    for (const p of await jsonFiles(path.join(root, "skills", skill, "references/examples")))
      if (!built.has(await canon(p))) out.push({ name: `${skill}-${path.basename(p, ".json")}`, path: p });
  return out;
}

/** Expected artifact files (relative to the artifact dir) that are absent. */
export async function missingOutputs(dir, root = ROOT) {
  const want = [...(await testFixtures(root)).map((f) => `${f.group}/${f.name}`), ...(await pickExamples(root)).map((e) => `examples/${e.name}`)];
  const missing = [];
  for (const w of want) for (const ext of OUTPUT_EXTS) if (!(await exists(path.join(dir, `${w}.${ext}`)))) missing.push(`${w}.${ext}`);
  return missing;
}

/** Markdown table of lint summaries: [{ name, summary }] where summary is a build .lint.json. */
export function summaryTable(rows) {
  const esc = (s) => String(s).replace(/\|/g, "\\|");
  const lines = ["| Diagram | Kind | Preset | Result | Min text | Warnings |", "|---|---|---|---|---|---|"];
  for (const { name, summary: s } of rows) {
    const r = s.readability || {};
    lines.push(`| ${esc(name)} | ${s.kind || "graph"} | ${s.preset} | ${s.ok ? "✅ pass" : "❌ fail"} | ${r.effMinText}px at ${r.displayWidth}px | ${esc([...(s.hard || []).map((h) => `HARD ${h}`), ...(s.warnings || [])].join("; ") || "none")} |`);
  }
  return lines.join("\n");
}

async function lintRows(dir) {
  const rows = [];
  for (const group of (await readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory() && d.name !== "mismatch").map((d) => d.name).sort())
    for (const f of (await readdir(path.join(dir, group))).filter((x) => x.endsWith(".lint.json")).sort())
      rows.push({ name: `${group}/${f.replace(/\.lint\.json$/, "")}`, summary: JSON.parse(await readFile(path.join(dir, group, f), "utf8")) });
  return rows;
}

async function main() {
  const dir = process.env.DIAGRAM_ARTIFACT_DIR || (await mkdtemp(path.join(os.tmpdir(), "dt-examples-")));
  if (process.argv.includes("--check")) {
    const missing = await missingOutputs(dir);
    for (const m of missing) console.log(`missing artifact: ${m}`);
    console.log(missing.length ? `${missing.length} expected artifact(s) missing from ${dir}` : `all expected artifacts present in ${dir}`);
    return missing.length ? 1 : 0;
  }
  const { openStudio } = await import("../skills/arch-diagram/engine/lib/studio.mjs");
  const { buildDiagram } = await import("../skills/arch-diagram/engine/lib/build.mjs");
  const studio = await openStudio();
  let failed = 0;
  try {
    for (const ex of await pickExamples()) {
      const board = JSON.parse(await readFile(ex.path, "utf8")).kind === "board";
      try {
        const s = await buildDiagram(studio, { specPath: ex.path, out: path.join(dir, "examples", ex.name), publish: !board, force: true });
        console.log(`${s.ok ? "PASS" : "FAIL"}  ${ex.name}${board ? "" : " (--publish)"}${s.hard.length ? `  ${s.hard.join(", ")}` : ""}`);
        if (!s.ok) failed++;
      } catch (e) { failed++; console.log(`FAIL  ${ex.name}  ${e.message}`); }
    }
  } finally { await studio.close(); }
  const table = `### Rendered diagrams\n\n${summaryTable(await lintRows(dir))}\n`;
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, table);
  else console.log(`\n${table}`);
  await writeFile(path.join(dir, "summary.md"), table);
  return failed ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
