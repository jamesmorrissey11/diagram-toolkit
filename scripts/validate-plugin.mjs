#!/usr/bin/env node
// Validates the Copilot plugin manifest and everything it points to. Paths are resolved from plugin.json.
//   node scripts/validate-plugin.mjs [plugin root]     exit 1 and one line per problem (::error annotations on GitHub Actions)
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

/** Parses `key: value` lines of a leading --- front-matter block. */
export function frontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) { const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/); if (kv) out[kv[1]] = kv[2].trim(); }
  return out;
}

/** Returns [{ file, message }] (file relative to root); [] when the plugin is valid. */
export async function validatePlugin(root) {
  const problems = [];
  const bad = (file, message) => problems.push({ file: path.relative(root, file) || ".", message });
  const rel = (p) => path.resolve(root, p);
  const manifestPath = rel("plugin.json");
  let manifest;
  try { manifest = JSON.parse(await readFile(manifestPath, "utf8")); } catch (e) { bad(manifestPath, `cannot read plugin.json: ${e.message}`); return problems; }

  if (typeof manifest.name !== "string" || !manifest.name.trim()) bad(manifestPath, "name must be a non-empty string");
  if (typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(manifest.version)) bad(manifestPath, "version must be a semver string (x.y.z)");
  try {
    const pkg = JSON.parse(await readFile(rel("package.json"), "utf8"));
    if (typeof manifest.version === "string" && pkg.version !== manifest.version)
      bad(rel("package.json"), `version ${pkg.version} does not match plugin.json version ${manifest.version}`);
  } catch (e) { bad(rel("package.json"), `cannot read package.json: ${e.message}`); }

  // ---- skills ----
  const registered = new Set();
  if (!Array.isArray(manifest.skills) || !manifest.skills.every((s) => typeof s === "string")) bad(manifestPath, "skills must be an array of paths");
  else for (const s of manifest.skills) {
    const dir = rel(s), md = path.join(dir, "SKILL.md");
    registered.add(md);
    if (!(await exists(md))) { bad(dir, "registered skill has no SKILL.md"); continue; }
    const text = await readFile(md, "utf8"), fm = frontMatter(text);
    if (!fm) { bad(md, "missing --- front-matter block"); continue; }
    if (fm.name !== path.basename(dir)) bad(md, `front-matter name "${fm.name ?? ""}" must equal the directory name "${path.basename(dir)}"`);
    if (!fm.description) bad(md, "description must be non-empty");
    for (const m of text.matchAll(/`node <[^>]+>\/([^\s`]*cli\.mjs)/g))
      if (!(await exists(path.resolve(dir, m[1])))) bad(md, `engine path ${m[1]} does not exist`);
  }
  if (await exists(rel("skills"))) for (const d of await readdir(rel("skills"), { withFileTypes: true })) {
    const md = rel(path.join("skills", d.name, "SKILL.md"));
    if (d.isDirectory() && (await exists(md)) && !registered.has(md)) bad(md, "skill is not registered in plugin.json skills");
  }

  // ---- agents ----
  if (manifest.agents !== undefined) {
    if (typeof manifest.agents !== "string") bad(manifestPath, "agents must be a path string");
    else if (!(await exists(rel(manifest.agents)))) bad(manifestPath, `agents path ${manifest.agents} does not exist`);
    else for (const f of (await readdir(rel(manifest.agents))).filter((x) => x.endsWith(".agent.md")).sort()) {
      const file = path.join(rel(manifest.agents), f), fm = frontMatter(await readFile(file, "utf8"));
      if (!fm) { bad(file, "missing --- front-matter block"); continue; }
      if (!fm.name) bad(file, "name must be non-empty");
      if (!fm.description) bad(file, "description must be non-empty");
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
  const problems = await validatePlugin(root);
  const gha = process.env.GITHUB_ACTIONS === "true";
  for (const p of problems) console.log(gha ? `::error file=${p.file}::${p.message}` : `error: ${p.file}: ${p.message}`);
  console.log(problems.length ? `plugin: ${problems.length} problem(s)` : "plugin: valid");
  process.exit(problems.length ? 1 : 0);
}
