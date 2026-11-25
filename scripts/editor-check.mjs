// Dev-only check: generated files survive open+save in the real Excalidraw 0.18.1 editor.
// node scripts/editor-check.mjs <file.excalidraw>...
import { build } from "esbuild";
import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchChrome } from "../skills/arch-diagram/engine/lib/chrome.mjs";
import { editState, readMeta } from "../skills/arch-diagram/engine/lib/meta.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".cache/editor");
await mkdir(OUT, { recursive: true });
await build({ entryPoints: [path.join(ROOT, "scripts/editor-entry.jsx")], bundle: true, format: "iife", outfile: path.join(OUT, "editor.js"),
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" }, loader: { ".woff2": "file", ".js": "jsx" }, logLevel: "error", minify: true });
const assets = path.join(ROOT, "skills/arch-diagram/engine/vendor");
const server = http.createServer(async (req, res) => {
  const u = req.url.split("?")[0];
  try {
    if (u === "/") return res.end(`<!doctype html><body><div id="app" style="width:1400px;height:900px"></div><script>window.EXCALIDRAW_ASSET_PATH="/assets/"</script><script src="/editor.js"></script>`);
    const f = u.startsWith("/assets/") ? path.join(assets, u.slice(8)) : path.join(OUT, u);
    res.end(await readFile(f));
  } catch { res.statusCode = 404; res.end(); }
}).listen(0, "127.0.0.1");
await new Promise((r) => server.on("listening", r));
const browser = await launchChrome();
const page = await browser.newPage({ width: 1400, height: 900 });
await page.goto(`http://127.0.0.1:${server.address().port}/`, "window.__ready === true");
let failed = 0;
for (const file of process.argv.slice(2)) {
  const scene = JSON.parse(await readFile(file, "utf8"));
  const saved = JSON.parse(await page.evaluate(`window.__roundTrip(${JSON.stringify(scene)})`));
  const meta = readMeta(saved), es = editState(saved);
  const before = Object.fromEntries(scene.elements.map((e) => [e.id, e]));
  const arrowsBound = saved.elements.filter((e) => e.type === "arrow").every((a) => a.startBinding?.elementId && a.endBinding?.elementId);
  const pills = saved.elements.filter((e) => e.type === "line" && e.id.endsWith("_shape")).length === scene.elements.filter((e) => e.type === "line" && e.id.endsWith("_shape")).length;
  const sameCount = saved.elements.length === scene.elements.length;
  const moved = saved.elements.filter((e) => { const b = before[e.id]; return !b || Math.round(b.x) !== Math.round(e.x) || Math.round(b.y) !== Math.round(e.y) || Math.round(b.width) !== Math.round(e.width); }).map((e) => `${e.type}:${e.id}`);
  const ok = !!meta && es.state === "clean" && arrowsBound && pills && sameCount;
  if (!ok) failed++;
  console.log(JSON.stringify({ file: path.basename(file), ok, metaSurvives: !!meta, editState: es.state, arrowsBound, pillsKept: pills, sameCount, changedOnLoad: moved.slice(0, 8) }));
  await writeFile(path.join(OUT, path.basename(file)), JSON.stringify(saved));
}
await browser.close(); server.close();
process.exit(failed ? 1 : 0);
