// Spec validation, normalization, and preset resolution. The spec carries semantics only: no pixels, colours or fonts.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LAYOUTS } from "./layouts/index.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PRESET_DIR = path.join(HERE, "../presets");
export const PRESETS = ["reference", "concept", "sketch"];

// Decision table: diagram type -> default preset (user request and an already-persisted preset win; see resolvePreset)
export const TYPE_PRESET = {
  "reference-architecture": "reference", system: "reference", deployment: "reference", integration: "reference",
  application: "reference", devops: "reference", "data-pipeline": "reference", "ml-pipeline": "reference", website: "reference",
  concept: "concept", agent: "concept", pattern: "concept", workflow: "concept",
  whiteboard: "sketch", informal: "sketch", brainstorm: "sketch",
};
export const CONCEPT_MAX_NODES = 9;
export const LEGEND_KINDS = ["sync", "async", "optional", "gate", "human", "store"];

const FORBIDDEN = ["x", "y", "width", "height", "w", "h", "color", "colour", "fill", "stroke", "strokeColor", "backgroundColor",
  "fontSize", "fontFamily", "font", "style", "roughness", "strokeWidth", "points"];
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const enumOf = (v, allowed) => v === undefined || allowed.includes(v);

export class SpecError extends Error {
  constructor(problems) { super(`invalid spec:\n- ${problems.join("\n- ")}`); this.problems = problems; }
}

export function validateSpec(spec) {
  const p = [];
  const bad = (m) => p.push(m);
  if (!spec || typeof spec !== "object") throw new SpecError(["spec must be a JSON object"]);
  if (spec.version !== undefined && spec.version !== 1) bad(`version must be 1 (got ${spec.version})`);
  if (spec.title !== undefined && typeof spec.title !== "string") bad("title must be a string");
  if (!enumOf(spec.preset, PRESETS)) bad(`preset must be one of ${PRESETS.join(", ")}`);
  if (spec.type !== undefined && !TYPE_PRESET[spec.type]) bad(`type "${spec.type}" unknown; use one of ${Object.keys(TYPE_PRESET).join(", ")}`);
  if (!enumOf(spec.direction, ["LR", "TB"])) bad("direction must be LR or TB");
  if (spec.layout !== undefined && !LAYOUTS[spec.layout]) bad(`layout "${spec.layout}" unknown; use one of ${Object.keys(LAYOUTS).join(", ")}`);
  if (spec.displayWidth !== undefined && !(Number.isFinite(spec.displayWidth) && spec.displayWidth >= 320)) bad("displayWidth must be a number >= 320 (the width the image will be shown at, in CSS px)");
  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) bad("nodes must be a non-empty array");
  if (!Array.isArray(spec.edges)) bad("edges must be an array (may be empty)");
  const groups = spec.groups || [];
  if (!Array.isArray(groups)) bad("groups must be an array");
  const ids = new Map();
  const claim = (id, what) => {
    if (typeof id !== "string" || !ID.test(id)) return bad(`${what} id ${JSON.stringify(id)} must match ${ID}`);
    if (ids.has(id)) bad(`duplicate id "${id}" (${ids.get(id)} and ${what}); ids must be unique and stable across edits`);
    ids.set(id, what);
  };
  const noPixels = (o, what) => { for (const k of FORBIDDEN) if (k in o) bad(`${what}: field "${k}" is not allowed; the preset owns geometry, colours and fonts`); };
  const hint = (o, what) => {
    for (const k of ["row", "col"]) if (o[k] !== undefined && !(Number.isInteger(o[k]) && o[k] >= 0 && o[k] < 20)) bad(`${what}: ${k} must be an integer 0..19`);
    if ((o.row === undefined) !== (o.col === undefined)) bad(`${what}: give both row and col, or neither`);
  };
  for (const g of groups) {
    claim(g.id, "group");
    noPixels(g, `group ${g.id}`);
    hint(g, `group ${g.id}`);
    if (typeof g.label !== "string" || !g.label.trim()) bad(`group ${g.id}: label required`);
    if (!enumOf(g.kind, ["boundary", "tier"])) bad(`group ${g.id}: kind must be boundary or tier`);
    if (!enumOf(g.tone, ["neutral", "blue", "green", "yellow"])) bad(`group ${g.id}: tone must be neutral, blue, green or yellow`);
    if (!enumOf(g.flow, ["LR", "TB"])) bad(`group ${g.id}: flow must be LR or TB`);
  }
  const gIds = new Set(groups.map((g) => g.id));
  for (const g of groups) if (g.parent !== undefined && !gIds.has(g.parent)) bad(`group ${g.id}: parent "${g.parent}" is not a group`);
  for (const g of groups) { // cycle check
    const seen = new Set();
    for (let x = g; x && x.parent; x = groups.find((y) => y.id === x.parent)) { if (seen.has(x.id)) { bad(`group ${g.id}: parent cycle`); break; } seen.add(x.id); }
  }
  for (const n of spec.nodes || []) {
    claim(n.id, "node");
    noPixels(n, `node ${n.id}`);
    hint(n, `node ${n.id}`);
    if (typeof n.label !== "string" || !n.label.trim()) bad(`node ${n.id}: label required`);
    if (n.label && n.label.length > 28) bad(`node ${n.id}: label "${n.label}" is ${n.label.length} chars; keep labels <= 28 (move detail to "sub")`);
    if (n.sub !== undefined && (typeof n.sub !== "string" || n.sub.length > 32)) bad(`node ${n.id}: sub must be a string <= 32 chars`);
    if (n.group !== undefined && !gIds.has(n.group)) bad(`node ${n.id}: group "${n.group}" does not exist`);
    if (!enumOf(n.role, ["terminal", "core", "support", "gate", "store"])) bad(`node ${n.id}: role must be terminal, core, support, gate or store`);
    if (n.icon !== undefined && !/^[a-z0-9-]+:[a-z0-9._-]+$/.test(n.icon)) bad(`node ${n.id}: icon must be "namespace:name" from \`icons search\``);
  }
  const nIds = new Set((spec.nodes || []).map((n) => n.id));
  const badges = new Set();
  for (const n of spec.nodes || []) if (n.badge !== undefined) {
    if (!(Number.isInteger(n.badge) && n.badge >= 1 && n.badge <= 20)) bad(`node ${n.id}: badge must be an integer 1..20`);
    else if (badges.has(n.badge)) bad(`node ${n.id}: badge ${n.badge} used twice`);
    badges.add(n.badge);
  }
  for (const k of ["subtitle", "source"]) if (spec[k] !== undefined && (typeof spec[k] !== "string" || spec[k].length > 90)) bad(`${k} must be a string <= 90 chars`);
  const callouts = spec.callouts ?? [];
  if (!Array.isArray(callouts) || callouts.length > 4) bad("callouts must be an array of at most 4");
  else for (const c of callouts) {
    claim(c.id, "callout");
    noPixels(c, `callout ${c.id}`);
    if (typeof c.title !== "string" || !c.title.trim() || c.title.length > 28) bad(`callout ${c.id}: title required, <= 28 chars`);
    if (typeof c.text !== "string" || !c.text.trim() || c.text.length > 120) bad(`callout ${c.id}: text required, <= 120 chars`);
    if (!enumOf(c.tone, ["neutral", "red", "yellow", "blue", "green"])) bad(`callout ${c.id}: tone must be neutral, red, yellow, blue or green`);
    for (const r of c.refs ?? []) if (!nIds.has(r)) bad(`callout ${c.id}: ref "${r}" is not a node`);
  }
  const legend = spec.legend ?? [];
  if (!Array.isArray(legend) || legend.length > 6) bad("legend must be an array of at most 6");
  else for (const l of legend) {
    if (!enumOf(l.kind, LEGEND_KINDS) || l.kind === undefined) bad(`legend kind must be one of ${LEGEND_KINDS.join(", ")}`);
    if (typeof l.meaning !== "string" || !l.meaning.trim() || l.meaning.length > 32) bad("legend meaning required, <= 32 chars");
  }
  const steps = new Set();
  for (const e of spec.edges || []) {
    claim(e.id, "edge");
    noPixels(e, `edge ${e.id}`);
    if (!nIds.has(e.from)) bad(`edge ${e.id}: from "${e.from}" is not a node`);
    if (!nIds.has(e.to)) bad(`edge ${e.id}: to "${e.to}" is not a node`);
    if (e.from === e.to) bad(`edge ${e.id}: self-loops are not supported`);
    if (e.label !== undefined && (typeof e.label !== "string" || e.label.length > 24)) bad(`edge ${e.id}: label must be a short verb/protocol (<= 24 chars)`);
    if (!enumOf(e.kind, ["sync", "async", "optional"])) bad(`edge ${e.id}: kind must be sync, async or optional`);
    if (e.step !== undefined) {
      if (!(Number.isInteger(e.step) && e.step >= 1 && e.step <= 20)) bad(`edge ${e.id}: step must be an integer 1..20`);
      else if (steps.has(e.step)) bad(`edge ${e.id}: step ${e.step} used twice`);
      steps.add(e.step);
    }
  }
  if (p.length) throw new SpecError(p);
  LAYOUTS[spec.layout || "grid"].validate(spec, bad);
  if (p.length) throw new SpecError(p);
  return spec;
}

/** Precedence: explicit request (CLI --preset) > preset persisted in the spec > decision-table default for spec.type > reference. */
export function resolvePreset(spec, requested) {
  if (requested && !PRESETS.includes(requested)) throw new SpecError([`--preset must be one of ${PRESETS.join(", ")}`]);
  const name = requested || spec.preset || TYPE_PRESET[spec.type] || "reference";
  const source = requested ? "request" : spec.preset ? "spec" : spec.type ? `type:${spec.type}` : "default";
  if (name === "concept" && spec.nodes.length > CONCEPT_MAX_NODES)
    throw new SpecError([`concept preset is for <= ${CONCEPT_MAX_NODES} nodes (this spec has ${spec.nodes.length}); split the diagram or use reference/sketch`]);
  return { name, source };
}

export async function loadPreset(name) {
  return JSON.parse(await readFile(path.join(PRESET_DIR, `${name}.json`), "utf8"));
}

/** Validated spec with defaults filled and the resolved preset persisted (so refinements never restyle unexpectedly). */
export function normalizeSpec(raw, { requestedPreset, idHint } = {}) {
  const spec = validateSpec(structuredClone(raw));
  const { name, source } = resolvePreset(spec, requestedPreset);
  return {
    spec: {
      version: 1, id: spec.id || idHint || "diagram", direction: "LR", displayWidth: 1200, ...spec, preset: name,
      groups: spec.groups || [], edges: spec.edges || [],
    },
    presetSource: source,
  };
}
