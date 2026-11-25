// Board diagrams (kind: "board"). Unit tests run everywhere; end-to-end tests need a local Chrome-family browser.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.join(HERE, "../skills/arch-diagram/engine");

const { SpecError, normalizeSpec, loadPreset, PRESETS } = await import(`${ENGINE}/lib/spec.mjs`);
const { validateBoardSpec, normalizeBoardSpec, loadBoardPreset, BOARD_TONES } = await import(`${ENGINE}/lib/board-spec.mjs`);
const { lintScene } = await import(`${ENGINE}/lib/lint.mjs`);

const board = (extra = {}) => ({
  kind: "board", title: "Capabilities",
  sections: [
    { id: "a", title: "Assistive", summary: "Copilot responds while you work.", fields: [{ label: "Includes", text: "Code suggestions" }], takeaway: "You review each suggestion." },
    { id: "b", title: "Ideas", items: [{ id: "b1", text: "dark mode" }, { id: "b2", text: "offline mode" }] },
  ],
  ...extra,
});
const problems = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof SpecError, e.message); return e.problems.join("\n"); } assert.fail("expected SpecError"); };

describe("board spec", () => {
  test("a valid board normalises with board defaults", () => {
    const { spec, presetSource } = normalizeBoardSpec(board(), { idHint: "caps" });
    assert.equal(spec.kind, "board");
    assert.equal(spec.id, "caps");
    assert.equal(spec.displayWidth, 800);
    assert.equal(spec.arrangement, "grid");
    assert.equal(spec.columns, 2);
    assert.equal(spec.numbered, false);
    assert.equal(spec.preset, "clean");
    assert.equal(presetSource, "default");
    assert.deepEqual(spec.sections.map((s) => s.tone), ["blue", "green"]);
  });

  test("rejects pixels, colours and fonts on board, sections, fields and items", () => {
    const s = board({ fontSize: 20 });
    s.sections[0].fill = "#f00";
    s.sections[0].fields[0].color = "red";
    s.sections[1].items[0].x = 3;
    const p = problems(() => validateBoardSpec(s));
    for (const f of ['"fontSize"', '"fill"', '"color"', '"x"']) assert.match(p, new RegExp(f));
  });

  test("enforces text budgets with the limit in the message", () => {
    const s = board({ title: "T".repeat(41), subtitle: "S".repeat(81) });
    s.sections[0].title = "x".repeat(33);
    s.sections[0].summary = "y".repeat(121);
    s.sections[0].fields[0].label = "z".repeat(25);
    s.sections[1].items[0].text = "w".repeat(41);
    const p = problems(() => validateBoardSpec(s));
    for (const m of [/title .*<= 40/, /subtitle .*<= 80/, /section a: title .*<= 32/, /section a: summary .*<= 120/, /field label .*<= 24/, /item b1: text .*<= 40/]) assert.match(p, m);
  });

  test("enforces section and item counts", () => {
    const many = board({ sections: Array.from({ length: 13 }, (_, i) => ({ id: `s${i}`, title: `S${i}`, summary: "x" })) });
    assert.match(problems(() => validateBoardSpec(many)), /at most 12 sections/);
    const s = board();
    s.sections[1].items = Array.from({ length: 9 }, (_, i) => ({ id: `i${i}`, text: "x" }));
    assert.match(problems(() => validateBoardSpec(s)), /at most 8 items/);
  });

  test("a section needs real content (no blank note areas)", () => {
    const s = board();
    s.sections.push({ id: "c", title: "Notes" });
    assert.match(problems(() => validateBoardSpec(s)), /section c: needs at least one of summary, fields, takeaway or items/);
  });

  test("deferred features are rejected as not supported yet", () => {
    for (const extra of [{ arrangement: "radial" }, { arrangement: "rows" }, { links: [] }, { center: { id: "q", text: "Q" } }]) {
      assert.match(problems(() => validateBoardSpec(board(extra))), /not supported yet/);
    }
    const s = board();
    s.sections[0].rank = 1;
    s.sections[1].icon = "generic:user";
    const p = problems(() => validateBoardSpec(s));
    assert.match(p, /section a: rank is not supported yet/);
    assert.match(p, /section b: icon is not supported yet/);
  });

  test("rejects emoji, bad columns, bad tones, duplicate ids and graph fields", () => {
    const s = board({ columns: 4, nodes: [] });
    s.sections[0].tone = "magenta";
    s.sections[1].items[1].id = "a";
    s.sections[1].items[0].text = "ship it 🚀";
    const p = problems(() => validateBoardSpec(s));
    assert.match(p, /columns must be an integer 1\.\.3/);
    assert.match(p, new RegExp(`tone must be one of ${BOARD_TONES.join(", ")}`));
    assert.match(p, /duplicate id "a"/);
    assert.match(p, /emoji/);
    assert.match(p, /boards use sections, not nodes or edges/);
  });

  test("columns default from the section count", () => {
    const n = (k) => normalizeBoardSpec(board({ sections: Array.from({ length: k }, (_, i) => ({ id: `s${i}`, title: `S${i}`, summary: "x" })) })).spec.columns;
    assert.deepEqual([1, 2, 3, 4, 5, 6].map(n), [1, 2, 3, 2, 3, 3]);
  });

  test("preset precedence: request > spec > type > clean; concept aliases clean; reference rejected", () => {
    assert.equal(normalizeBoardSpec(board({ type: "brainstorm" })).spec.preset, "sketch");
    assert.equal(normalizeBoardSpec(board({ type: "brainstorm" })).presetSource, "type:brainstorm");
    assert.equal(normalizeBoardSpec(board({ type: "brainstorm", preset: "clean" })).spec.preset, "clean");
    assert.equal(normalizeBoardSpec(board({ preset: "clean" }), { requestedPreset: "sketch" }).spec.preset, "sketch");
    assert.equal(normalizeBoardSpec(board(), { requestedPreset: "concept" }).spec.preset, "clean");
    assert.equal(normalizeBoardSpec(board({ preset: "concept" })).spec.preset, "clean");
    assert.match(problems(() => normalizeBoardSpec(board(), { requestedPreset: "reference" })), /boards use the clean or sketch preset/);
  });

  test("graph specs are not rewritten with a kind", () => {
    const { spec } = normalizeSpec({ nodes: [{ id: "a", label: "A" }], edges: [] });
    assert.equal("kind" in spec, false);
  });
});

describe("board presets", () => {
  test("each board preset defines every tone and its own sizes", async () => {
    for (const name of ["clean", "sketch"]) {
      const p = await loadBoardPreset(name);
      assert.equal(p.name, `board-${name}`);
      for (const t of BOARD_TONES) for (const k of ["header", "body", "note", "line"]) assert.match(p.tones[t][k], /^#[0-9a-f]{6}$/i, `${name}.${t}.${k}`);
      for (const k of ["title", "subtitle", "header", "body", "label", "item"]) assert.ok(p.size[k] >= 11, `${name}.size.${k}`);
    }
  });

  test("token isolation: a board-only colour is still off-token in a graph diagram", async () => {
    const onlyBoard = "#d0bfff";
    for (const n of PRESETS) assert.equal(JSON.stringify(await loadPreset(n)).toLowerCase().includes(onlyBoard), false, `${n} leaks ${onlyBoard}`);
    assert.ok(JSON.stringify(await loadBoardPreset("clean")).toLowerCase().includes(onlyBoard));
    const preset = await loadPreset("concept");
    const spec = { nodes: [{ id: "a", label: "A" }], edges: [], displayWidth: 1200 };
    const scene = { elements: [
      { id: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 60, strokeColor: "#9D96E0", backgroundColor: onlyBoard, roughness: 0, customData: { dt: { kind: "node", id: "a", footprint: { x: 0, y: 0, w: 100, h: 60 } } } },
      { id: "t", type: "text", x: 10, y: 20, width: 20, height: 22, strokeColor: "#665FB2", backgroundColor: "transparent", fontSize: 18, fontFamily: 6, customData: { dt: { kind: "nodeLabel", id: "a" } } },
    ] };
    assert.ok(lintScene(scene, spec, preset).hard.some((h) => h === `off-token:backgroundColor:${onlyBoard}@a`));
  });
});
