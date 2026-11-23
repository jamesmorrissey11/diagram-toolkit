// Icon catalog: bundled redistributable sets (engine/icons/<ns>) + user-imported vendor packs
// ($DIAGRAM_TOOLKIT_HOME/icons/<ns>, default ~/.diagram-toolkit). Vendor packs are never committed to this repo.
import { readFile, readdir, writeFile, mkdir, stat, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED = path.join(HERE, "../icons");
export const toolkitHome = () => process.env.DIAGRAM_TOOLKIT_HOME || path.join(os.homedir(), ".diagram-toolkit");
const USER = () => path.join(toolkitHome(), "icons");

export const VENDOR_TERMS = {
  azure: "https://learn.microsoft.com/azure/architecture/icons/ (use in architecture diagrams/docs; do not modify or redistribute the pack)",
  aws: "https://aws.amazon.com/architecture/icons/",
  gcp: "https://cloud.google.com/icons",
};

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

let cache = null;
export async function loadCatalog() {
  if (cache) return cache;
  const out = new Map(); // ref -> {ns, name, title, tags, file, source, license, origin}
  for (const [origin, root] of [["bundled", BUNDLED], ["user", USER()]]) {
    if (!(await exists(root))) continue;
    for (const ns of await readdir(root)) {
      const idxFile = path.join(root, ns, "index.json");
      if (!(await exists(idxFile))) continue;
      const idx = JSON.parse(await readFile(idxFile, "utf8"));
      for (const [name, meta] of Object.entries(idx)) out.set(`${ns}:${name}`, { ns, name, ...meta, file: path.join(root, ns, meta.file || `${name}.svg`), origin });
    }
  }
  return (cache = out);
}

const words = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);

export async function searchIcons(query, { limit = 8, ns } = {}) {
  const cat = await loadCatalog();
  const q = words(query);
  const qs = q.join(" ");
  const hits = [];
  for (const [ref, m] of cat) {
    if (ns && m.ns !== ns) continue;
    const nameW = words(m.name), hay = new Set([...nameW, ...words(m.title || ""), ...(m.tags || []).flatMap(words), ...words(m.category || "")]);
    const phrases = [m.name.replace(/-/g, " "), (m.title || "").toLowerCase(), ...(m.tags || []).map((t) => t.toLowerCase())];
    let score = 0;
    if (phrases.includes(qs)) score += 100;
    const matched = q.filter((t) => hay.has(t) || [...hay].some((h) => h.startsWith(t) && t.length >= 3));
    score += matched.length * 20;
    if (matched.length === q.length) score += 30;
    if (score === 0) continue;
    if (m.origin === "user") score += 5; // official vendor packs beat generic look-alikes
    score -= nameW.length; // prefer concise names
    hits.push({ ref, title: m.title, tags: m.tags, category: m.category, origin: m.origin, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function listIcons(ns) {
  const cat = await loadCatalog();
  const byNs = {};
  for (const [ref, m] of cat) if (!ns || m.ns === ns) (byNs[m.ns] ||= []).push(ref);
  return byNs;
}

/** -> {ref, svg, meta} or null when unknown. */
export async function resolveIcon(ref) {
  const m = (await loadCatalog()).get(ref);
  if (!m) return null;
  return { ref, svg: await readFile(m.file, "utf8"), meta: m };
}

// relative luminance contrast of the icon's darkest/most-visible colour vs the canvas
const lum = (hex) => {
  const h = hex.replace("#", ""), f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function iconContrast(svg, canvas) {
  const cols = [...svg.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*"?\s*(#[0-9a-fA-F]{3,8})/g)].map((m) => m[1]);
  if (!cols.length) cols.push("#000000"); // SVG default fill is black
  const L = lum(canvas);
  return Math.max(...cols.map((c) => { const l = lum(c); return (Math.max(l, L) + 0.05) / (Math.min(l, L) + 0.05); }));
}

/** Import a vendor icon pack (zip or extracted dir) the user downloaded under the vendor's terms. */
export async function importPack(vendor, src) {
  if (!VENDOR_TERMS[vendor]) throw new Error(`unknown vendor "${vendor}"; supported: ${Object.keys(VENDOR_TERMS).join(", ")}`);
  if (vendor !== "azure") throw new Error(`${vendor} import is not implemented yet (MVP supports azure)`);
  let dir = src, tmp = null;
  if (/\.zip$/i.test(src)) {
    tmp = await mkdtemp(path.join(os.tmpdir(), "dt-icons-"));
    try { execFileSync("unzip", ["-q", "-o", src, "-d", tmp]); } catch { execFileSync("tar", ["-xf", src, "-C", tmp]); }
    dir = tmp;
  }
  const svgs = [];
  const walk = async (d) => { for (const e of await readdir(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) await walk(p); else if (/\.svg$/i.test(e.name)) svgs.push(p); } };
  await walk(dir);
  if (!svgs.length) throw new Error(`no .svg files found in ${src}`);
  const outDir = path.join(USER(), vendor);
  await mkdir(outDir, { recursive: true });
  const index = {};
  for (const f of svgs) {
    // official: ".../ai + machine learning/10162-icon-service-Cognitive-Services.svg"; mirrors: "Azure-Cosmos-DB.svg"
    const base = path.basename(f, ".svg").replace(/^\d+-icon-service-/i, "").replace(/^\d+-/, "");
    const slug = words(base).join("-").replace(/^azure-/, "");
    if (!slug || index[slug]) continue;
    const category = path.basename(path.dirname(f)).toLowerCase();
    const svg = await readFile(f, "utf8");
    if (!svg.includes("<svg")) continue;
    await writeFile(path.join(outDir, `${slug}.svg`), svg);
    index[slug] = { title: base.replace(/[-_]+/g, " "), tags: [vendor, ...words(base)], category: /icons?$|^\.$/.test(category) ? undefined : category,
      source: `user-supplied ${vendor} pack: ${path.relative(dir, f)}`, license: `vendor terms: ${VENDOR_TERMS[vendor]}` };
  }
  await writeFile(path.join(outDir, "index.json"), JSON.stringify(index, null, 1));
  if (tmp) await rm(tmp, { recursive: true, force: true });
  cache = null;
  return { vendor, dir: outDir, count: Object.keys(index).length };
}
