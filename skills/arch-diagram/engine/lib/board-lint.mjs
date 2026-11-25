// Board lint, computed on the emitted scene: hard defects (dropped content, overlaps, overflow, off-token styling),
// readability at the intended display width (text >= 11px, line budget per section) and advisory balance.
import { PAD, boxOf, hit, shrink, hexes } from "./lint.mjs";

const inside = (a, b, tol = 1) => a.x >= b.x - tol && a.y >= b.y - tol && a.x + a.w <= b.x + b.w + tol && a.y + a.h <= b.y + b.h + tol;

export function lintBoard(scene, spec, preset, { minText = 11, fitColumns } = {}) {
  const els = scene.elements.filter((e) => !e.isDeleted);
  const dt = (e) => e.customData?.dt || {};
  const all = els.map(boxOf);
  const minX = Math.min(...all.map((b) => b.x)), minY = Math.min(...all.map((b) => b.y));
  const contentW = Math.max(...all.map((b) => b.x + b.w)) - minX, contentH = Math.max(...all.map((b) => b.y + b.h)) - minY;
  const exportW = contentW + 2 * PAD;
  const scale = Math.min(1, spec.displayWidth / exportW);
  const texts = els.filter((e) => e.type === "text");
  const effMinText = +(Math.min(...texts.map((t) => t.fontSize)) * scale).toFixed(1);

  const hard = [];
  const sections = Object.fromEntries(els.filter((e) => dt(e).kind === "sectionTitle").map((e) => [dt(e).id, dt(e)]));
  const items = Object.fromEntries(els.filter((e) => dt(e).kind === "item").map((e) => [dt(e).id, { box: boxOf(e), section: dt(e).section }]));
  for (const s of spec.sections) {
    if (!sections[s.id]) hard.push(`missing-section:${s.id}`);
    for (const it of s.items || []) if (!items[it.id]) hard.push(`missing-item:${it.id}`);
  }
  // a hand-moved card body is caught too: the body must still sit on its section footprint
  for (const e of els.filter((x) => dt(x).kind === "card")) {
    const f = sections[dt(e).id]?.footprint;
    if (f && (Math.abs(e.x - f.x) > 1 || Math.abs(e.y - f.y) > 1)) hard.push(`section-overlap:${dt(e).id}/moved`);
  }
  const sids = Object.keys(sections);
  for (let i = 0; i < sids.length; i++) for (let j = i + 1; j < sids.length; j++)
    if (hit(shrink(sections[sids[i]].footprint, 1), shrink(sections[sids[j]].footprint, 1))) hard.push(`section-overlap:${sids[i]}/${sids[j]}`);
  const iids = Object.keys(items);
  for (let i = 0; i < iids.length; i++) for (let j = i + 1; j < iids.length; j++)
    if (hit(shrink(items[iids[i]].box, 1), shrink(items[iids[j]].box, 1))) hard.push(`item-overlap:${iids[i]}/${iids[j]}`);
  for (const [id, it] of Object.entries(items)) {
    const f = sections[it.section]?.footprint;
    if (f && !inside(it.box, f)) hard.push(`text-overflow:item:${id}`);
  }
  for (const t of texts) {
    const d = dt(t), b = boxOf(t);
    if (d.kind === "itemText") { const c = items[d.id]; if (c && !inside(b, c.box)) hard.push(`text-overflow:itemText:${d.id}`); continue; }
    const sid = d.kind === "sectionTitle" ? d.id : d.section;
    const f = sections[sid]?.footprint;
    if (f && !inside(b, f)) hard.push(`text-overflow:${d.kind}:${sid}`);
  }
  const tb = texts.map((t) => ({ b: shrink(boxOf(t), 1), d: dt(t), id: t.id, c: t.containerId }));
  for (let i = 0; i < tb.length; i++) for (let j = i + 1; j < tb.length; j++)
    if (hit(tb[i].b, tb[j].b)) hard.push(`text-overlap:${tb[i].id}/${tb[j].id}`);
  for (const { b, id, c } of tb) if (!c) for (const [iid, it] of Object.entries(items)) if (hit(b, shrink(it.box, 1))) hard.push(`text-on-item:${id}/${iid}`);

  // token discipline against the board preset only
  const palette = hexes(preset);
  palette.add("transparent");
  const sizes = new Set(Object.values(preset.size));
  const tokens = [];
  for (const e of els) {
    for (const k of ["strokeColor", "backgroundColor"]) {
      const v = (e[k] || "").toLowerCase();
      if (v && !palette.has(v)) tokens.push(`${k}:${e[k]}@${e.id}`);
    }
    if (e.type === "text") {
      if (e.fontFamily !== preset.font.family) tokens.push(`fontFamily:${e.fontFamily}@${e.id}`);
      if (!sizes.has(e.fontSize)) tokens.push(`fontSize:${e.fontSize}@${e.id}`);
    }
    if (["rectangle", "ellipse", "line"].includes(e.type) && e.roughness !== preset.roughness && e.roughness !== 0) tokens.push(`roughness:${e.roughness}@${e.id}`);
  }
  if (tokens.length) hard.push(...tokens.slice(0, 10).map((t) => `off-token:${t}`));

  // readability: font size at display width, and a line budget per section
  const linesOf = (t) => t.text.split("\n").length;
  const sectionLines = {};
  for (const t of texts) {
    const d = dt(t), sid = d.kind === "sectionTitle" ? d.id : d.kind === "text" ? d.section : null;
    if (sid) sectionLines[sid] = (sectionLines[sid] || 0) + linesOf(t);
  }
  const maxLines = Math.max(0, ...Object.values(sectionLines));
  const maxSectionLines = preset.board.maxSectionLines;
  const aspect = +(contentW / contentH).toFixed(2);
  const readability = { effMinText, minText, exportW: Math.round(exportW), displayWidth: spec.displayWidth, maxLines, maxSectionLines,
    sections: spec.sections.length, aspect, pass: effMinText >= minText && maxLines <= maxSectionLines };
  const warnings = [];
  if (effMinText < minText) {
    const cols = spec.columns;
    warnings.push(`text renders at ${effMinText}px at ${spec.displayWidth}px wide (min ${minText}): ` +
      (cols > 1 ? `use fewer columns (columns ${cols} -> ${Math.min(cols - 1, fitColumns ?? cols - 1)}), shorten the longest words, or split the board` : "shorten the longest words or split the board"));
  }
  for (const [sid, n] of Object.entries(sectionLines)) if (n > maxSectionLines)
    warnings.push(`section ${sid} wraps to ${n} lines (max ${maxSectionLines}): shorten its text, use fewer columns, or split the section`);

  // advisory: balance within each grid row
  const byRow = {};
  for (const [id, s] of Object.entries(sections)) (byRow[s.row] ||= []).push({ id, natural: s.natural });
  let imbalance = 1;
  for (const row of Object.values(byRow)) {
    if (row.length < 2) continue;
    const hi = row.reduce((a, b) => (b.natural > a.natural ? b : a)), lo = row.reduce((a, b) => (b.natural < a.natural ? b : a));
    const r = lo.natural / hi.natural;
    imbalance = Math.min(imbalance, r);
    if (r < 0.5) warnings.push(`section ${hi.id} is ${(hi.natural / lo.natural).toFixed(1)}x taller than ${lo.id} in the same row: move content or reorder sections`);
  }
  const advisory = { balance: +imbalance.toFixed(2), aspect };
  return { pass: hard.length === 0 && readability.pass, hard: [...new Set(hard)], readability, advisory, warnings };
}
