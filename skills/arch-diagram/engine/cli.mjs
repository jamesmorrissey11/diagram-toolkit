#!/usr/bin/env node
// diagram-toolkit engine CLI. Run with Node >= 22. No npm install needed (all runtime deps are vendored).
//   node cli.mjs doctor
//   node cli.mjs build <spec.json> [--out <path>] [--preset reference|concept|sketch|clean] [--publish] [--force] [--scale 2] [--json]
//   node cli.mjs render <file.excalidraw> [--out <path>] [--scale 2]
//   node cli.mjs lint <file.excalidraw> [--publish] [--json]
//   node cli.mjs spec <file.excalidraw>                 print the embedded spec (edit it, then build again)
//   node cli.mjs presets                                list graph and board presets, type defaults, board tones
//   node cli.mjs icons search <query> [--ns <namespace>] [--limit N]
//   node cli.mjs icons list [namespace]
//   node cli.mjs icons import azure <zip-or-dir>       import the official Azure icon pack you downloaded
// Exit codes: 0 ok | 1 built but lint failed | 2 invalid input | 3 refused to overwrite hand edits | 4 environment problem | 5 internal error
import { readFile, writeFile, mkdtemp, rm, access } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openStudio } from "./lib/studio.mjs";
import { buildDiagram, lintFile, specOf, HandEditError } from "./lib/build.mjs";
import { SpecError, PRESETS, TYPE_PRESET, loadPreset, CONCEPT_MAX_NODES } from "./lib/spec.mjs";
import { searchIcons, listIcons, importPack, toolkitHome } from "./lib/icons.mjs";
import { BOARD_PRESETS, BOARD_TYPE_PRESET, BOARD_TONES, BOARD_ARRANGEMENTS, BOARD_LIMITS, loadBoardPreset } from "./lib/board-spec.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flags = {}, pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const [k, v] = a.slice(2).split("=");
    if (v !== undefined) flags[k] = v;
    else if (["json", "publish", "force"].includes(k)) flags[k] = true;
    else flags[k] = argv[++i];
  } else pos.push(a);
}
const json = !!flags.json;
const print = (obj, human) => console.log(json || !human ? JSON.stringify(obj, null, 2) : human(obj));

function humanBuild(s) {
  if (s.kind === "board") return humanBoard(s);
  const L = [`${s.ok ? "PASS" : "FAIL"}  preset=${s.preset} (${s.presetSource})  mode=${s.mode}`,
    `  excalidraw: ${s.files.excalidraw}`, `  png:        ${s.files.png}   (imgcat ${s.files.png})`,
    `  readability: text ${s.readability.effMinText}px at ${s.readability.displayWidth}px wide (min ${s.readability.minText}), aspect ${s.readability.aspect} (max ${s.readability.aspectMax})`,
    `  advisory: crossings=${s.advisory.crossings} emptyArea=${s.advisory.emptyFrac} edgeLen=${s.advisory.edgeLenRatio}x labelOnLine=${s.advisory.labelOnLine}`];
  for (const h of s.hard) L.push(`  HARD: ${h}`);
  for (const w of s.warnings) L.push(`  warn: ${w}`);
  for (const i of s.issues) L.push(`  issue: ${JSON.stringify(i)}`);
  L.push(`  ${s.timings.totalMs}ms`);
  return L.join("\n");
}

function humanBoard(s) {
  const r = s.readability;
  const L = [`${s.ok ? "PASS" : "FAIL"}  board  preset=${s.preset} (${s.presetSource})  mode=${s.mode}  columns=${s.layout.columns} (fit ${s.layout.fitColumns})`,
    `  excalidraw: ${s.files.excalidraw}`, `  png:        ${s.files.png}   (imgcat ${s.files.png})`,
    `  readability: text ${r.effMinText}px at ${r.displayWidth}px wide (min ${r.minText}), max ${r.maxLines} lines per section (max ${r.maxSectionLines})`,
    `  advisory: balance=${s.advisory.balance} aspect=${s.advisory.aspect}`];
  for (const h of s.hard) L.push(`  HARD: ${h}`);
  for (const w of s.warnings) L.push(`  warn: ${w}`);
  L.push(`  ${s.timings.totalMs}ms`);
  return L.join("\n");
}

async function main() {
  const [cmd, ...rest] = pos;
  if (!cmd || cmd === "help") { console.log((await readFile(fileURLToPath(import.meta.url), "utf8")).split("\n").slice(1, 13).map((l) => l.replace(/^\/\/ ?/, "")).join("\n")); return 0; }
  if (cmd === "presets") {
    const presets = await Promise.all(PRESETS.map(async (n) => { const p = await loadPreset(n); return { name: n, description: p.description }; }));
    const boardPresets = await Promise.all(BOARD_PRESETS.map(async (n) => ({ name: n, description: (await loadBoardPreset(n)).description })));
    const boards = { presets: boardPresets, typeDefaults: BOARD_TYPE_PRESET, arrangements: BOARD_ARRANGEMENTS, tones: BOARD_TONES, limits: BOARD_LIMITS,
      precedence: "explicit --preset (concept = clean) > spec.preset > type default > clean" };
    print({ presets, typeDefaults: TYPE_PRESET, conceptMaxNodes: CONCEPT_MAX_NODES, precedence: "explicit --preset > spec.preset > type default > reference", boards },
      (o) => [...o.presets.map((p) => `${p.name.padEnd(10)} ${p.description}`), "", "type -> default preset:",
        ...Object.entries(o.typeDefaults).map(([t, p]) => `  ${t.padEnd(24)} ${p}`), "", `precedence: ${o.precedence}`, "",
        'boards (kind: "board"):', ...o.boards.presets.map((p) => `${p.name.padEnd(10)} ${p.description}`), "", "board type -> default preset:",
        ...Object.entries(o.boards.typeDefaults).map(([t, p]) => `  ${t.padEnd(24)} ${p}`),
        `arrangements: ${o.boards.arrangements.join(", ")} (columns 1..${o.boards.limits.columns})`, `tones: ${o.boards.tones.join(", ")}`,
        `precedence: ${o.boards.precedence}`].join("\n"));
    return 0;
  }
  if (cmd === "icons") {
    const [sub, ...a] = rest;
    if (sub === "search") {
      const hits = await searchIcons(a.join(" "), { limit: Number(flags.limit || 8), ns: flags.ns });
      print(hits, (h) => (h.length ? h.map((x) => `${x.ref.padEnd(36)} ${x.title}${x.category ? `  [${x.category}]` : ""}  (${x.origin})`).join("\n") : "no icons found; use a generic concept (icons search server/database/...) or omit the icon"));
      return 0;
    }
    if (sub === "list") { print(await listIcons(a[0]), (o) => Object.entries(o).map(([ns, refs]) => `${ns} (${refs.length}): ${refs.slice(0, 60).join(" ")}${refs.length > 60 ? " ..." : ""}`).join("\n")); return 0; }
    if (sub === "import") { const r = await importPack(a[0], a[1]); print(r, (x) => `imported ${x.count} ${x.vendor} icons into ${x.dir}`); return 0; }
    throw new SpecError(["usage: icons search <query> | icons list [ns] | icons import azure <zip-or-dir>"]);
  }
  if (cmd === "spec") { console.log(JSON.stringify(await specOf(rest[0]), null, 2)); return 0; }
  if (cmd === "lint") {
    const r = await lintFile(rest[0], { publish: !!flags.publish });
    print(r, (x) => [`${x.ok ? "PASS" : "FAIL"} (scene ${x.edit})`, ...x.hard.map((h) => `  HARD: ${h}`), ...x.warnings.map((w) => `  warn: ${w}`)].join("\n"));
    return r.ok ? 0 : 1;
  }
  if (cmd === "doctor") return doctor();
  if (cmd === "build" || cmd === "render") {
    if (!rest[0]) throw new SpecError([`usage: ${cmd} <file>`]);
    let studio;
    try { studio = await openStudio(); } catch (e) { const err = new Error(e.message); err.env = true; throw err; }
    try {
      if (cmd === "build") {
        const s = await buildDiagram(studio, { specPath: rest[0], out: flags.out, preset: flags.preset, publish: !!flags.publish, force: !!flags.force, scale: Number(flags.scale || 2) });
        print(s, humanBuild);
        return s.ok ? 0 : 1;
      }
      const scene = JSON.parse(await readFile(rest[0], "utf8"));
      const r = await studio.render(scene, (flags.out || rest[0]).replace(/\.(excalidraw|png|svg)$/i, ""), { scale: Number(flags.scale || 2) });
      print(r, (x) => `png: ${x.png}\nsvg: ${x.svg}`);
      return 0;
    } finally { await studio.close(); }
  }
  throw new SpecError([`unknown command "${cmd}"; run: node cli.mjs help`]);
}

async function doctor() {
  const checks = [];
  const ok = (name, pass, detail) => checks.push({ name, pass, detail });
  const major = Number(process.versions.node.split(".")[0]);
  ok("node >= 22", major >= 22, process.version);
  ok("global WebSocket", typeof WebSocket !== "undefined", typeof WebSocket);
  for (const f of ["vendor/excalidraw-render.js", "vendor/router.mjs", "vendor/fonts/Liberation/LiberationSans-Regular.woff2"]) {
    try { await access(path.join(HERE, f), constants.R_OK); ok(`asset ${f}`, true, ""); } catch { ok(`asset ${f}`, false, "missing: reinstall the plugin"); }
  }
  try {
    const home = toolkitHome();
    await import("node:fs/promises").then((m) => m.mkdir(home, { recursive: true }));
    await access(home, constants.W_OK);
    ok("writable toolkit home", true, home);
  } catch (e) { ok("writable toolkit home", false, e.message); }
  const icons = await listIcons();
  ok("icon catalog", Object.keys(icons).length > 0, Object.entries(icons).map(([n, r]) => `${n}:${r.length}`).join(" ") + (icons.azure ? "" : "  (no azure pack: node cli.mjs icons import azure <zip>)"));
  let studio;
  try {
    const t = Date.now();
    studio = await openStudio();
    ok("browser", true, studio.browserPath);
    const tmp = await mkdtemp(path.join(os.tmpdir(), "dt-doctor-"));
    const spec = { title: "Doctor", nodes: [{ id: "a", label: "Client", icon: "generic:user" }, { id: "b", label: "Service", icon: "generic:server" }], edges: [{ id: "e1", from: "a", to: "b", label: "HTTPS" }] };
    await writeFile(path.join(tmp, "doctor.json"), JSON.stringify(spec));
    const s = await buildDiagram(studio, { specPath: path.join(tmp, "doctor.json"), force: true });
    ok("test render", s.hard.length === 0 && !!s.files.png, `${s.files.png} in ${Date.now() - t}ms`);
    await rm(tmp, { recursive: true, force: true });
  } catch (e) { ok("browser + test render", false, e.message); }
  finally { if (studio) await studio.close(); }
  const all = checks.every((c) => c.pass);
  print({ ok: all, checks }, (o) => [...o.checks.map((c) => `${c.pass ? "✓" : "✗"} ${c.name}  ${c.detail || ""}`), o.ok ? "ready" : "NOT READY"].join("\n"));
  return all ? 0 : 4;
}

main().then((code) => process.exit(code ?? 0)).catch((e) => {
  const code = e instanceof SpecError ? 2 : e instanceof HandEditError ? 3 : e.env ? 4 : 5;
  if (code === 5 && !json) console.error(e.stack);
  if (json) console.log(JSON.stringify({ ok: false, error: e.message, problems: e.problems, code }, null, 2));
  else console.error(`error: ${e.message}`);
  process.exit(code);
});
