// Board layout: word-accurate wrapping in the preset's real font, then a grid of equal-width sections whose rows are as
// tall as their tallest section. Everything visual comes from the board preset; the spec only orders content.
import { SpecError } from "./spec.mjs";
import { PAD as EXPORT_PAD } from "./lint.mjs"; // studio render exportPadding, per side

// Words split on ASCII spaces only (non-breaking spaces keep "1  Title" together). A lone separator such as "·" or "→"
// is glued to its neighbour so no line starts with one.
const SEP = /^[·•→←↔–—|&+/]$/;
export const words = (para) => {
  const raw = para.split(/ +/).filter(Boolean), out = [];
  for (let i = 0; i < raw.length; i++) {
    if (SEP.test(raw[i]) && out.length) out[out.length - 1] += ` ${raw[i]}`;
    else if (SEP.test(raw[i]) && i + 1 < raw.length) { out.push(`${raw[i]} ${raw[i + 1]}`); i++; }
    else out.push(raw[i]);
  }
  return out;
};

/**
 * Wraps blocks of text to their widths. `measure(items: [text, size][]) -> Promise<tw(text, size) -> px>`.
 * Round 1 measures single words and greedily packs them; later rounds measure whole candidate lines and push the
 * last word down (overflow) or pull the next word up (under-fill) until stable. Hard newlines are honoured.
 */
export async function wrapBlocks(measure, blocks) {
  const paras = blocks.map((b) => b.text.split("\n").map(words));
  const first = [];
  blocks.forEach((b, i) => { first.push([" ", b.size]); for (const p of paras[i]) for (const w of p) first.push([w, b.size]); });
  let tw = await measure(first);
  const problems = [];
  const lines = blocks.map((b, i) => paras[i].map((ws) => {
    for (const w of ws) if (tw(w, b.size) > b.width) problems.push(`"${w}" in ${b.where} is too wide (${tw(w, b.size)}px) for its ${b.width}px box; shorten it or use fewer columns`);
    const out = [[]];
    let cur = 0;
    const sp = tw(" ", b.size);
    for (const w of ws) {
      const ww = tw(w, b.size);
      if (out.at(-1).length && cur + sp + ww > b.width) { out.push([]); cur = 0; }
      cur += (out.at(-1).length ? sp : 0) + ww;
      out.at(-1).push(w);
    }
    return out;
  }));
  if (problems.length) throw new SpecError(problems);
  for (let round = 0; round < 16; round++) {
    const cand = [];
    blocks.forEach((b, i) => lines[i].forEach((pl) => pl.forEach((ln, j) => {
      cand.push([ln.join(" "), b.size]);
      if (pl[j + 1]?.length) cand.push([`${ln.join(" ")} ${pl[j + 1][0]}`, b.size]);
    })));
    tw = await measure(cand);
    let changed = false;
    blocks.forEach((b, i) => lines[i].forEach((pl) => {
      for (let j = 0; j < pl.length; j++) {
        const s = pl[j].join(" ");
        if (pl[j].length > 1 && tw(s, b.size) > b.width) {
          const w = pl[j].pop();
          if (j + 1 < pl.length) pl[j + 1].unshift(w); else pl.push([w]);
          changed = true; return;
        }
        if (pl[j + 1]?.length && tw(`${s} ${pl[j + 1][0]}`, b.size) <= b.width) {
          pl[j].push(pl[j + 1].shift());
          if (!pl[j + 1].length) pl.splice(j + 1, 1);
          changed = true; return;
        }
      }
    }));
    if (!changed) break;
  }
  const flat = blocks.map((_, i) => lines[i].flatMap((pl) => pl.map((ln) => ln.join(" "))));
  tw = await measure(blocks.flatMap((b, i) => flat[i].map((l) => [l, b.size])));
  const res = {};
  blocks.forEach((b, i) => {
    const widths = flat[i].map((l) => tw(l, b.size));
    res[b.key] = { lines: flat[i], widths, maxW: Math.max(0, ...widths), original: b.text };
  });
  return res;
}

const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
/** Deterministic offset in [-j, j] for a given id and axis. */
export const jitter = (id, axis, j) => (j ? (hash(`${id}:${axis}`) % (2 * j + 1)) - j : 0);

export const headerText = (spec, s, i, preset) => (spec.numbered ? `${i + 1}${preset.board.numberSep}${s.title}` : s.title);
export const takeawayText = (s, preset) => `${preset.board.takeawayPrefix}${s.takeaway}`;

/** Whether a sketch board uses the dotted brainwriting frame (every section is sticky notes only). */
export const isFrame = (spec, preset) => preset.board.look === "sketch" &&
  spec.sections.every((s) => s.items?.length && s.summary === undefined && s.takeaway === undefined && !s.fields?.length);

export async function layoutBoard(spec, preset, measure) {
  const S = preset.size, B = preset.board, N = B.note;
  const lh = (size) => size * preset.font.lineHeight;
  const frame = isFrame(spec, preset);
  const P = frame ? B.cell : B.card;
  const C = spec.columns, gap = frame ? 0 : B.gap;
  const minFont = Math.min(...Object.values(S));
  const W = Math.min(spec.displayWidth - 2 * EXPORT_PAD, Math.floor((minFont * spec.displayWidth) / 11) - 2 * EXPORT_PAD);

  // ---- column width: an even share of the display, widened if the longest unbreakable word needs it ----
  const all = [];
  spec.sections.forEach((s, i) => {
    all.push([headerText(spec, s, i, preset), S.header, 0]);
    if (s.summary) all.push([s.summary, S.body, 0]);
    for (const f of s.fields || []) all.push([f.label, S.label, 0], [f.text, S.body, 0]);
    if (s.takeaway) all.push([takeawayText(s, preset), S.body, 0]);
    for (const it of s.items || []) all.push([it.text, S.item, 2 * N.pad]);
  });
  const wordItems = all.flatMap(([t, size]) => t.split("\n").flatMap(words).map((w) => [w, size]));
  const tw0 = await measure(wordItems);
  let need = 0, widest = "";
  for (const [t, size, extra] of all) for (const w of t.split("\n").flatMap(words)) {
    const n = tw0(w, size) + extra + 2 * P.padX;
    if (n > need) { need = n; widest = w; }
  }
  if (need > W) throw new SpecError([`"${widest}" is too wide for even a single full-width column at displayWidth ${spec.displayWidth}; shorten or break it`]);
  const share = Math.floor((W - (C - 1) * gap) / C);
  const colW = Math.max(share, need);
  const fitColumns = [3, 2, 1].find((c) => Math.floor((W - (c - 1) * gap) / c) >= Math.max(need, B.minColW)) || 1;
  const BW = C * colW + (C - 1) * gap;
  const IW = colW - 2 * P.padX;

  // ---- notes: per-row count from the preset's ideal width, reduced until the longest item word fits a note ----
  const itemWord = (text) => Math.max(0, ...words(text).map((w) => tw0(w, S.item)));
  const itemNeed = Math.max(0, ...spec.sections.flatMap((s) => (s.items || []).map((it) => itemWord(it.text)))) + 2 * N.pad;
  const slotOf = (k) => Math.floor((IW - (k - 1) * N.gap) / k);
  let perRow = Math.max(1, Math.min(4, Math.floor((IW + N.gap) / (N.idealW + N.gap))));
  while (perRow > 1 && slotOf(perRow) < itemNeed) perRow--;
  const slotW = slotOf(perRow);
  // shrink-fit notes wrap near the ideal width (stickies), widening only as far as their longest word needs
  const noteTextW = (text) => (N.fit === "shrink" ? Math.min(slotW, Math.max(N.idealW, itemWord(text) + 2 * N.pad)) : slotW) - 2 * N.pad;

  // ---- wrap everything in one pass ----
  const blocks = [];
  const add = (key, text, size, width, where) => blocks.push({ key, text, size, width, where });
  if (spec.title) add("title", spec.title, S.title, BW, "title");
  if (spec.subtitle) add("subtitle", spec.subtitle, S.subtitle, BW, "subtitle");
  spec.sections.forEach((s, i) => {
    const w = `section ${s.id}`;
    add(`${s.id}:header`, headerText(spec, s, i, preset), S.header, IW, `${w} title`);
    if (s.summary) add(`${s.id}:summary`, s.summary, S.body, IW, `${w} summary`);
    (s.fields || []).forEach((f, k) => { add(`${s.id}:f${k}:label`, f.label, S.label, IW, `${w} field label`); add(`${s.id}:f${k}:text`, f.text, S.body, IW, `${w} field text`); });
    if (s.takeaway) add(`${s.id}:takeaway`, takeawayText(s, preset), S.body, IW, `${w} takeaway`);
    for (const it of s.items || []) add(`item:${it.id}`, it.text, S.item, noteTextW(it.text), `item ${it.id}`);
  });
  const T = await wrapBlocks(measure, blocks);
  const H = (key, size) => T[key].lines.length * lh(size);

  // ---- title block ----
  let y = 0;
  const title = spec.title ? { x: 0, y, w: BW, size: S.title, wrap: T.title } : null;
  if (title) y += H("title", S.title);
  const subtitle = spec.subtitle ? { x: 0, y: y + (title ? B.titleGap : 0), w: BW, size: S.subtitle, wrap: T.subtitle } : null;
  if (subtitle) y = subtitle.y + H("subtitle", S.subtitle);
  if (title || subtitle) y += B.titleBottom;
  const gridTop = y;

  // ---- per-section natural content ----
  const secs = spec.sections.map((s, i) => {
    const notes = (s.items || []).map((it) => {
      const wr = T[`item:${it.id}`];
      const textH = wr.lines.length * lh(S.item);
      const w = N.fit === "shrink" ? Math.max(N.minW, Math.min(slotW, wr.maxW + 2 * N.pad)) : slotW;
      return { id: it.id, tone: it.tone || s.tone, wrap: wr, w, h: Math.max(N.minH, Math.ceil(textH + 2 * N.pad)), textH };
    });
    // pack notes into rows (left to right, wrap at IW); uniform heights per section for the tidy look
    if (N.fit !== "shrink") { const mh = Math.max(0, ...notes.map((n) => n.h)); for (const n of notes) n.h = mh; }
    const rows = [];
    for (const n of notes) {
      const r = rows.at(-1);
      if (r && r.w + N.gap + n.w <= IW && r.notes.length < perRow) { r.notes.push(n); r.w += N.gap + n.w; r.h = Math.max(r.h, n.h); }
      else rows.push({ notes: [n], w: n.w, h: n.h });
    }
    const notesH = rows.reduce((a, r) => a + r.h, 0) + Math.max(0, rows.length - 1) * N.gap + (notes.length ? 2 * N.jitter : 0);
    const fieldsH = (s.fields || []).map((_, k) => H(`${s.id}:f${k}:label`, S.label) + P.labelGap + H(`${s.id}:f${k}:text`, S.body));
    return { s, i, rows, notes, notesH, fieldsH,
      headerH: H(`${s.id}:header`, S.header), summaryH: s.summary ? H(`${s.id}:summary`, S.body) : 0, takeawayH: s.takeaway ? H(`${s.id}:takeaway`, S.body) : 0 };
  });

  // ---- grid rows: shared header height and aligned block slots ----
  const out = [];
  for (let r = 0; r * C < secs.length; r++) {
    const row = secs.slice(r * C, r * C + C);
    const headerArea = frame
      ? P.padTop + Math.max(...row.map((x) => x.headerH)) + P.headerGap
      : 2 * P.headerPadY + Math.max(...row.map((x) => x.headerH));
    const slot = {
      summary: Math.max(0, ...row.map((x) => x.summaryH)),
      fields: Array.from({ length: Math.max(0, ...row.map((x) => x.fieldsH.length)) }, (_, k) => Math.max(0, ...row.map((x) => x.fieldsH[k] || 0))),
      notes: Math.max(0, ...row.map((x) => x.notesH)),
    };
    const natural = (x) => {
      const parts = [];
      if (x.summaryH) parts.push(slot.summary);
      x.fieldsH.forEach((_, k) => parts.push(slot.fields[k]));
      if (x.notes.length) parts.push(slot.notes);
      if (x.takeawayH) parts.push(x.takeawayH);
      return headerArea + (frame ? 0 : P.padTop) + parts.reduce((a, b) => a + b, 0) + Math.max(0, parts.length - 1) * P.blockGap + P.padBottom;
    };
    const rowH = Math.ceil(Math.max(...row.map(natural)));
    row.forEach((x, c) => {
      const s = x.s, sx = c * (colW + gap), sy = y, ix = sx + P.padX;
      const blocks = [];
      let cy = sy + headerArea + (frame ? 0 : P.padTop);
      const headerY = frame ? sy + P.padTop : sy + P.headerPadY + (headerArea - 2 * P.headerPadY - x.headerH) / 2;
      if (s.summary) { blocks.push({ key: `${s.id}:summary`, role: "summary", x: ix, y: cy, w: IW, size: S.body, color: "text" }); cy += slot.summary + P.blockGap; }
      (s.fields || []).forEach((_, k) => {
        blocks.push({ key: `${s.id}:f${k}:label`, role: `field${k}Label`, x: ix, y: cy, w: IW, size: S.label, color: "label" });
        blocks.push({ key: `${s.id}:f${k}:text`, role: `field${k}`, x: ix, y: cy + H(`${s.id}:f${k}:label`, S.label) + P.labelGap, w: IW, size: S.body, color: "text" });
        cy += slot.fields[k] + P.blockGap;
      });
      const notes = [];
      if (x.notes.length) {
        let ny = cy;
        x.rows.forEach((rw, k) => {
          const free = IW - rw.w;
          // lone notes zig-zag down the cell like hand-placed stickies; fuller rows are centred or left-aligned
          let nx = ix + (N.align !== "center" ? 0 : rw.notes.length === 1 && x.rows.length > 1 ? Math.floor(free * (k % 2 ? 0.8 : 0.2)) : Math.floor(free / 2));
          for (const n of rw.notes) {
            const jx = jitter(n.id, "x", N.jitter), jy = jitter(n.id, "y", N.jitter);
            const fx = Math.min(Math.max(nx + jx, ix), ix + IW - n.w);
            notes.push({ ...n, x: fx, y: ny + jy + N.jitter });
            nx += n.w + N.gap;
          }
          ny += rw.h + N.gap;
        });
        cy += slot.notes + P.blockGap;
      }
      if (s.takeaway) blocks.push({ key: `${s.id}:takeaway`, role: "takeaway", x: ix, y: sy + rowH - P.padBottom - x.takeawayH, w: IW, size: S.body, color: "takeaway" });
      out.push({ id: s.id, tone: s.tone, row: r, col: c, x: sx, y: sy, w: colW, h: rowH, natural: Math.ceil(natural(x)), headerArea,
        header: { x: ix, y: headerY, w: IW, size: S.header, align: B.headerAlign, wrap: T[`${s.id}:header`] },
        blocks: blocks.map((b) => ({ ...b, wrap: T[b.key] })), notes });
    });
    y += rowH + gap;
  }
  const rowsN = Math.ceil(secs.length / C);
  const gridH = y - gap - gridTop;
  return { frame, BW, W, colW, gap, columns: C, rows: rowsN, fitColumns, gridTop, gridH, title, subtitle, sections: out };
}
