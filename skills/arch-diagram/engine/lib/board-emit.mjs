// Emits a raw Excalidraw 0.18 scene for a board layout. Cards are grouped (body, header bar, fixed-width text) so they
// move as one; sticky notes are rectangles with bound text so they reflow natively when edited.
import { generateNKeysBetween } from "../vendor/fractional-indexing.mjs";

export function emitBoard(spec, preset, L) {
  const C = preset.color, B = preset.board, F = preset.font, N = B.note;
  const lh = (size) => size * F.lineHeight;
  let seed = 1000;
  const els = [];
  const base = (o) => ({
    angle: 0, strokeColor: C.stroke, backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid",
    roughness: preset.roughness, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: seed++, version: 1,
    versionNonce: seed++, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, ...o,
  });
  const add = (e) => { els.push(e); return e; };
  const text = (id, wrap, x, y, w, size, color, align, dt, extra = {}) => add(base({
    id, type: "text", x, y, width: w, height: wrap.lines.length * lh(size), strokeColor: color, text: wrap.lines.join("\n"),
    originalText: wrap.original, fontSize: size, fontFamily: F.family, textAlign: align, verticalAlign: "top", containerId: null,
    autoResize: false, lineHeight: F.lineHeight, customData: { dt }, ...extra,
  }));
  const line = (id, x, y, len, color, width, dt, extra = {}) => add(base({
    id, type: "line", x, y, width: len, height: 0, strokeColor: color, strokeWidth: width, points: [[0, 0], [len, 0]],
    lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: null, customData: { dt }, ...extra,
  }));
  // hand-drawn underline under each line of centered text
  const underline = (idp, t, x, w, color, size, dt, groupIds = []) => {
    const U = B.underline;
    if (!U) return;
    t.wrap.widths.forEach((lw, k) => {
      const len = lw + 2 * U.overhang;
      line(`${idp}_u${k}`, x + (w - len) / 2, t.y + (k + 1) * lh(size) + U.gap, len, color, U.strokeWidth, dt, { groupIds });
    });
  };

  // ---- frame (sketch, notes-only boards): dotted outline and dividers ----
  const top = L.gridTop, H = L.gridH;
  if (L.frame) {
    const st = { strokeColor: C.frame, strokeWidth: B.frameStrokeWidth, strokeStyle: "dotted" };
    add(base({ id: "board_frame", type: "rectangle", x: 0, y: top, width: L.BW, height: H, roundness: { type: 3 }, ...st, customData: { dt: { kind: "frame" } } }));
    for (let c = 1; c < L.columns; c++) line(`board_vdiv_${c}`, c * L.colW, top, 0, C.frame, B.frameStrokeWidth, { kind: "divider" },
      { ...st, width: 0, height: H, points: [[0, 0], [0, H]] });
    for (let r = 1; r < L.rows; r++) {
      const y = L.sections.find((s) => s.row === r).y;
      line(`board_hdiv_${r}`, 0, y, L.BW, C.frame, B.frameStrokeWidth, { kind: "divider" }, st);
    }
  }

  // ---- sections ----
  for (const s of L.sections) {
    const tone = preset.tones[s.tone], g = [`${L.frame ? "cell" : "card"}_${s.id}`];
    const footprint = { x: s.x, y: s.y, w: s.w, h: s.h };
    if (!L.frame) {
      add(base({ id: `sec_${s.id}`, type: "rectangle", x: s.x, y: s.y, width: s.w, height: s.h, backgroundColor: tone.body,
        strokeWidth: B.card.strokeWidth, roundness: B.card.roundness, groupIds: g, customData: { dt: { kind: "card", id: s.id } } }));
      if (B.look === "cards") add(base({ id: `sech_${s.id}`, type: "rectangle", x: s.x, y: s.y, width: s.w, height: s.headerArea, backgroundColor: tone.header,
        strokeWidth: B.card.strokeWidth, roundness: B.card.roundness, groupIds: g, customData: { dt: { kind: "headerBar", id: s.id } } }));
    }
    const h = s.header;
    text(`sect_${s.id}`, h.wrap, h.x, h.y, h.w, h.size, C.text, h.align,
      { kind: "sectionTitle", id: s.id, footprint, natural: s.natural, row: s.row }, { groupIds: g });
    if (h.align === "center") underline(`sect_${s.id}`, h, h.x, h.w, tone.line, h.size, { kind: "underline", id: s.id }, g);
    for (const b of s.blocks)
      text(`${s.id}_${b.role}`, b.wrap, b.x, b.y, b.w, b.size, C[b.color], "left", { kind: "text", section: s.id, role: b.role }, { groupIds: g });
    for (const n of s.notes) {
      const tid = `${n.id}_text`;
      add(base({ id: n.id, type: "rectangle", x: n.x, y: n.y, width: n.w, height: n.h, backgroundColor: preset.tones[n.tone][L.frame ? "note" : N.cardFill || "note"],
        strokeColor: C.noteStroke, strokeWidth: N.strokeWidth, roundness: N.roundness, groupIds: g, boundElements: [{ type: "text", id: tid }],
        customData: { dt: { kind: "item", id: n.id, section: s.id } } }));
      add(base({ id: tid, type: "text", x: n.x + (n.w - n.wrap.maxW) / 2, y: n.y + (n.h - n.textH) / 2, width: n.wrap.maxW, height: n.textH,
        strokeColor: C.text, text: n.wrap.lines.join("\n"), originalText: n.wrap.original, fontSize: preset.size.item, fontFamily: F.family,
        textAlign: "center", verticalAlign: "middle", containerId: n.id, autoResize: true, lineHeight: F.lineHeight, groupIds: g,
        customData: { dt: { kind: "itemText", id: n.id, section: s.id } } }));
    }
  }

  // ---- title ----
  const align = B.titleAlign;
  if (L.title) {
    const t = L.title;
    text("title", t.wrap, t.x, t.y, t.w, t.size, C.title, align, { kind: "title" });
    if (align === "center" && C.titleLine) underline("title", t, t.x, t.w, C.titleLine, t.size, { kind: "underline" });
  }
  if (L.subtitle) { const t = L.subtitle; text("subtitle", t.wrap, t.x, t.y, t.w, t.size, C.subtitle, align, { kind: "subtitle" }); }

  const idx = generateNKeysBetween(null, null, els.length);
  els.forEach((e, i) => (e.index = idx[i]));
  return { type: "excalidraw", version: 2, source: "https://github.com/jamesmorrissey11/diagram-toolkit", elements: els,
    appState: { viewBackgroundColor: preset.canvas, gridSize: null }, files: {} };
}
