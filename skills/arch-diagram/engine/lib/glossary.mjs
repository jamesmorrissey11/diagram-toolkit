// Glossary-backed labels: any spec string "@g:<id>" or "@g:<id>.<field>" resolves from a JSON glossary, so product
// renames are one glossary edit plus a rebuild. A node labelled from a non-GA entry inherits its status (drawn as a chip).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SpecError } from "./spec.mjs";

const REF = /^@g:([a-z0-9][a-z0-9._-]*?)(?:\.([a-zA-Z]+))?$/;

export async function loadGlossary(file) {
  const raw = JSON.parse(await readFile(file, "utf8"));
  const entries = Array.isArray(raw) ? raw : raw.entries;
  if (!Array.isArray(entries)) throw new SpecError([`glossary ${file} must be an array or { "entries": [...] }`]);
  return Object.fromEntries(entries.map((e) => [e.id, e]));
}

/** Returns a copy of raw with every @g reference replaced; the input is not modified. */
export async function resolveGlossary(raw, specDir) {
  if (!raw?.glossary) return raw;
  const g = await loadGlossary(path.resolve(specDir, raw.glossary));
  const problems = [];
  const lookup = (s) => {
    const m = REF.exec(s);
    if (!m) return { value: s };
    const e = g[m[1]];
    if (!e) { problems.push(`glossary id "${m[1]}" not found in ${raw.glossary}`); return { value: s }; }
    const v = e[m[2] || "label"];
    if (typeof v !== "string") { problems.push(`glossary id "${m[1]}" has no string field "${m[2]}"`); return { value: s }; }
    return { value: v, entry: e };
  };
  const walk = (o) => {
    if (typeof o === "string") return lookup(o).value;
    if (Array.isArray(o)) return o.map(walk);
    if (o && typeof o === "object") return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === "glossary" ? v : walk(v)]));
    return o;
  };
  const out = walk(structuredClone(raw));
  (raw.nodes || []).forEach((n, i) => {
    if (typeof n.label !== "string" || out.nodes[i].status) return;
    const { entry } = lookup(n.label);
    if (entry && entry.status && entry.status !== "ga") out.nodes[i].status = entry.status;
  });
  if (problems.length) throw new SpecError([...new Set(problems)]);
  return out;
}
