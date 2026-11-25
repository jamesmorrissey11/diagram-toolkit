// Board spec (kind: "board"): validation, normalization and preset resolution. Semantics only: no pixels, colours or fonts.
// Boards are text-rich, edge-free visuals made of sections (cards and/or sticky-note items) arranged in a grid.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SpecError, FORBIDDEN, ID, PRESET_DIR } from "./spec.mjs";

export const BOARD_PRESETS = ["clean", "sketch"];
export const BOARD_ARRANGEMENTS = ["grid"];
export const BOARD_TONES = ["neutral", "blue", "green", "yellow", "orange", "purple", "pink", "teal"];
export const BOARD_TONE_CYCLE = ["blue", "green", "orange", "purple", "pink", "teal", "yellow", "neutral"];
// diagram type -> default board look (an explicit request and a persisted preset win)
export const BOARD_TYPE_PRESET = {
  board: "clean", concept: "clean", categories: "clean", comparison: "clean", summary: "clean", pattern: "clean",
  brainstorm: "sketch", brainwriting: "sketch", whiteboard: "sketch", informal: "sketch",
};
export const BOARD_LIMITS = { title: 40, subtitle: 80, sectionTitle: 32, text: 120, fieldLabel: 24, item: 40, fields: 4, sections: 12, items: 8, columns: 3 };
const PRESET_ALIAS = { clean: "clean", concept: "clean", sketch: "sketch" };

const TOP = ["kind", "version", "id", "title", "subtitle", "type", "preset", "displayWidth", "arrangement", "columns", "numbered", "sections"];
const SECTION = ["id", "title", "tone", "summary", "fields", "takeaway", "items"];
const DEFERRED_TOP = { links: "links", center: "center" };
const DEFERRED_SECTION = { rank: "rank", icon: "icon", emoji: "emoji" };
const EMOJI = /\p{Extended_Pictographic}/u;

export const isBoard = (raw) => !!raw && typeof raw === "object" && raw.kind === "board";

export function validateBoardSpec(spec) {
  const p = [];
  const bad = (m) => p.push(m);
  if (!spec || typeof spec !== "object") throw new SpecError(["spec must be a JSON object"]);
  if (spec.kind !== "board") bad('kind must be "board"');
  const noPixels = (o, what) => { for (const k of FORBIDDEN) if (k in o) bad(`${what}: field "${k}" is not allowed; the preset owns geometry, colours and fonts`); };
  const known = (o, allowed, deferred, what) => {
    for (const k of Object.keys(o)) {
      if (allowed.includes(k) || FORBIDDEN.includes(k)) continue;
      if (deferred[k]) bad(`${what}${deferred[k]} is not supported yet (boards are grid-only in this version)`);
      else if (["nodes", "edges", "groups"].includes(k)) bad(`${what}boards use sections, not nodes or edges (drop "${k}")`);
      else bad(`${what}unknown field "${k}"`);
    }
  };
  const str = (v, max, what, required = false) => {
    if (v === undefined) { if (required) bad(`${what} required`); return; }
    if (typeof v !== "string" || !v.trim()) return bad(`${what} must be a non-empty string`);
    if (v.length > max) bad(`${what} is ${v.length} chars; keep it <= ${max} (shorten it or split the content)`);
    if (EMOJI.test(v)) bad(`${what} contains an emoji; emoji are not supported in boards (the vendored fonts can't draw them)`);
  };
  const ids = new Map();
  const claim = (id, what) => {
    if (typeof id !== "string" || !ID.test(id)) return bad(`${what} id ${JSON.stringify(id)} must match ${ID}`);
    if (ids.has(id)) bad(`duplicate id "${id}" (${ids.get(id)} and ${what}); ids must be unique and stable across edits`);
    ids.set(id, what);
  };
  const tone = (v, what) => { if (v !== undefined && !BOARD_TONES.includes(v)) bad(`${what}: tone must be one of ${BOARD_TONES.join(", ")}`); };
  const L = BOARD_LIMITS;

  noPixels(spec, "board");
  known(spec, TOP, DEFERRED_TOP, "");
  if (spec.version !== undefined && spec.version !== 1) bad(`version must be 1 (got ${spec.version})`);
  str(spec.title, L.title, "title");
  str(spec.subtitle, L.subtitle, "subtitle");
  if (spec.type !== undefined && !BOARD_TYPE_PRESET[spec.type]) bad(`type "${spec.type}" unknown for boards; use one of ${Object.keys(BOARD_TYPE_PRESET).join(", ")}`);
  if (spec.preset !== undefined && !PRESET_ALIAS[spec.preset]) bad(`preset must be one of ${BOARD_PRESETS.join(", ")} (boards use the clean or sketch preset)`);
  if (spec.displayWidth !== undefined && !(Number.isFinite(spec.displayWidth) && spec.displayWidth >= 320)) bad("displayWidth must be a number >= 320 (the width the image will be shown at, in CSS px)");
  if (spec.arrangement !== undefined && !BOARD_ARRANGEMENTS.includes(spec.arrangement))
    bad(`arrangement "${spec.arrangement}" is not supported yet; use "grid" (columns: 1 gives stacked rows)`);
  if (spec.columns !== undefined && !(Number.isInteger(spec.columns) && spec.columns >= 1 && spec.columns <= L.columns)) bad(`columns must be an integer 1..${L.columns}`);
  if (spec.numbered !== undefined && typeof spec.numbered !== "boolean") bad("numbered must be true or false");
  if (!Array.isArray(spec.sections) || spec.sections.length === 0) bad("sections must be a non-empty array");
  else if (spec.sections.length > L.sections) bad(`a board holds at most ${L.sections} sections (got ${spec.sections.length}); split it into two boards`);

  for (const s of Array.isArray(spec.sections) ? spec.sections : []) {
    if (!s || typeof s !== "object") { bad("each section must be an object"); continue; }
    claim(s.id, "section");
    const w = `section ${s.id}`;
    noPixels(s, w);
    known(s, SECTION, DEFERRED_SECTION, `${w}: `);
    str(s.title, L.sectionTitle, `${w}: title`, true);
    tone(s.tone, w);
    str(s.summary, L.text, `${w}: summary`);
    str(s.takeaway, L.text, `${w}: takeaway`);
    if (s.fields !== undefined) {
      if (!Array.isArray(s.fields)) bad(`${w}: fields must be an array of { label, text }`);
      else {
        if (s.fields.length > L.fields) bad(`${w}: at most ${L.fields} fields (got ${s.fields.length})`);
        s.fields.forEach((f, i) => {
          if (!f || typeof f !== "object") return bad(`${w}: field ${i + 1} must be an object`);
          noPixels(f, `${w} field ${i + 1}`);
          known(f, ["label", "text"], {}, `${w} field ${i + 1}: `);
          str(f.label, L.fieldLabel, `${w}: field label`, true);
          str(f.text, L.text, `${w}: field text`, true);
        });
      }
    }
    if (s.items !== undefined) {
      if (!Array.isArray(s.items)) bad(`${w}: items must be an array of { id, text }`);
      else {
        if (s.items.length > L.items) bad(`${w}: at most ${L.items} items per section (got ${s.items.length}); split the section`);
        for (const it of s.items) {
          if (!it || typeof it !== "object") { bad(`${w}: each item must be an object`); continue; }
          claim(it.id, "item");
          noPixels(it, `item ${it.id}`);
          known(it, ["id", "text", "tone"], {}, `item ${it.id}: `);
          str(it.text, L.item, `item ${it.id}: text`, true);
          tone(it.tone, `item ${it.id}`);
        }
      }
    }
    const has = s.summary !== undefined || s.takeaway !== undefined || (Array.isArray(s.fields) && s.fields.length) || (Array.isArray(s.items) && s.items.length);
    if (!has) bad(`${w}: needs at least one of summary, fields, takeaway or items (boards carry real content, never blank note areas)`);
  }
  if (p.length) throw new SpecError(p);
  return spec;
}

/** Precedence: explicit request > preset persisted in the spec > board type default > clean. "concept" is an alias of clean. */
export function resolveBoardPreset(spec, requested) {
  if (requested !== undefined && !PRESET_ALIAS[requested])
    throw new SpecError([`--preset ${requested}: boards use the clean or sketch preset (concept is accepted as clean)`]);
  const name = PRESET_ALIAS[requested] || PRESET_ALIAS[spec.preset] || BOARD_TYPE_PRESET[spec.type] || "clean";
  const source = requested ? "request" : spec.preset ? "spec" : spec.type ? `type:${spec.type}` : "default";
  return { name, source };
}

export const defaultColumns = (n) => (n <= 1 ? 1 : n === 2 || n === 4 ? 2 : 3);

export async function loadBoardPreset(name) {
  return JSON.parse(await readFile(path.join(PRESET_DIR, `board-${name}.json`), "utf8"));
}

/** Validated board spec with defaults filled and the resolved preset persisted. */
export function normalizeBoardSpec(raw, { requestedPreset, idHint } = {}) {
  const spec = validateBoardSpec(structuredClone(raw));
  const { name, source } = resolveBoardPreset(spec, requestedPreset);
  const sections = spec.sections.map((s, i) => ({ ...s, tone: s.tone || BOARD_TONE_CYCLE[i % BOARD_TONE_CYCLE.length] }));
  return {
    spec: {
      version: 1, id: spec.id || idHint || "board", arrangement: "grid", displayWidth: 800, numbered: false,
      columns: defaultColumns(sections.length), ...spec, preset: name, sections,
    },
    presetSource: source,
  };
}
