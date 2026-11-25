// Frame: the annotation layer around a laid-out body. Title + subtitle above, numbered-step reference chips and
// callout cards beside (or below, when beside would break readability), legend and source footer underneath.
// Pure geometry; emit.mjs draws it from preset tokens only.
import { lineH } from "./geometry.mjs";

const PAD = 48; // render export padding (matches lint.mjs)

/** "step 3", "steps 3–5" or "steps 1, 4, 6" from the badges of the referenced nodes; null when none are badged. */
export function refsLabel(spec, refs = []) {
  const nums = refs.map((r) => spec.nodes.find((n) => n.id === r)?.badge).filter(Number.isInteger).sort((a, b) => a - b);
  if (!nums.length) return null;
  if (nums.length === 1) return `step ${nums[0]}`;
  const contiguous = nums.every((v, i) => i === 0 || v === nums[i - 1] + 1);
  return contiguous ? `steps ${nums[0]}–${nums.at(-1)}` : `steps ${nums.join(", ")}`;
}

export const footerText = (spec) => (spec.source ? (/^source/i.test(spec.source) ? spec.source : `Source: ${spec.source}`) : null);

/** Every [text, size] the frame will measure (studio measures up-front). Callout text is measured word by word. */
export function frameTexts(spec, preset) {
  const S = preset.size, out = [];
  if (spec.subtitle) out.push([spec.subtitle, S.label]);
  const f = footerText(spec);
  if (f) out.push([f, S.sub]);
  for (const n of spec.nodes || []) if (Number.isInteger(n.badge)) out.push([String(n.badge), S.step]);
  for (const n of spec.nodes || []) if (n.status && n.status !== "ga") out.push([n.status, S.step]);
  for (const c of spec.callouts || []) {
    out.push([c.title, S.label], [" ", S.sub]);
    for (const w of c.text.split(/\s+/)) out.push([w, S.sub]);
    const r = refsLabel(spec, c.refs);
    if (r) out.push([r, S.step]);
  }
  for (const l of spec.legend || []) out.push([l.meaning, S.sub]);
  return out;
}

export function wrapWords(text, maxW, size, tw) {
  const space = tw(" ", size), lines = [];
  let cur = [], w = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const ww = tw(word, size);
    if (cur.length && w + space + ww > maxW) { lines.push({ text: cur.join(" "), w }); cur = []; w = 0; }
    w += (cur.length ? space : 0) + ww;
    cur.push(word);
  }
  if (cur.length) lines.push({ text: cur.join(" "), w });
  return lines;
}

/** Bounding box of everything a layout placed: nodes, groups, decor, edge routes and their labels. */
export function bodyBounds(laid, geo, preset) {
  const xs = [], ys = [];
  const box = (b) => { xs.push(b.x, b.x + b.w); ys.push(b.y, b.y + b.h); };
  for (const b of Object.values(laid.nodes)) box(b);
  for (const b of Object.values(laid.groups || {})) box(b);
  for (const d of laid.decor || []) {
    if (d.kind === "line") { xs.push(d.x1, d.x2); ys.push(d.y1, d.y2); }
    else if (d.kind === "text") box({ x: d.x, y: d.y, w: d.w ?? 0, h: lineH(preset, preset.size[d.size || "sub"]) });
    else box(d);
  }
  for (const r of Object.values(laid.routes || {})) {
    for (const p of r.points || []) { xs.push(p.x); ys.push(p.y); }
    if (r.label) box({ x: r.label.x, y: r.label.y, w: r.label.width, h: r.label.height });
  }
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export function placeFrame(spec, geo, preset, laid, { aspectMax } = {}) {
  const S = preset.size, tw = geo.tw, lh = (s) => lineH(preset, s);
  const F = preset.frame, C = preset.callout, L = preset.legend;
  const anchorBoxes = [...Object.values(laid.nodes), ...Object.values(laid.groups || {}),
    ...(laid.decor || []).filter((d) => d.kind === "rect" || d.kind === "ellipse")];
  const anchor = { minX: Math.min(...anchorBoxes.map((b) => b.x)), minY: Math.min(...anchorBoxes.map((b) => b.y)) };
  const ext = bodyBounds(laid, geo, preset);
  const out = { callouts: [], placement: "none" };

  // above: subtitle sits just over the body, the title over it (title-only keeps the historical offset)
  let top = anchor.minY - F.gap;
  if (spec.subtitle) {
    const h = lh(S.label);
    out.subtitle = { text: spec.subtitle, x: anchor.minX, y: top - h, w: tw(spec.subtitle, S.label), h };
    top = out.subtitle.y - 6;
  } else top = anchor.minY - 28;
  if (geo.title) out.title = { text: spec.title, x: anchor.minX, y: top - geo.title.h, w: geo.title.w, h: geo.title.h };

  // callout cards
  const cards = (spec.callouts || []).map((c) => {
    const tone = C.tones[c.tone || "neutral"];
    const ref = refsLabel(spec, c.refs);
    const chip = ref ? { text: ref, tw: tw(ref, S.step), w: tw(ref, S.step) + 16, h: lh(S.step) + 6 } : null;
    const titleW = tw(c.title, S.label);
    const w = Math.max(C.w, titleW + (chip ? chip.w + 12 : 0) + 2 * C.padX + C.accentW);
    const lines = wrapWords(c.text, w - 2 * C.padX - C.accentW, S.sub, tw);
    const h = C.padY + lh(S.label) + 8 + lines.length * lh(S.sub) + C.padY;
    return { id: c.id, tone, title: c.title, titleW, chip, lines, w, h };
  });
  let right = ext.maxX, bottom = ext.maxY;
  if (cards.length) {
    const cw = Math.max(...cards.map((c) => c.w));
    const stackH = cards.reduce((a, c) => a + c.h, 0) + (cards.length - 1) * 16;
    const sideW = ext.maxX - Math.min(ext.minX, anchor.minX) + C.gap + cw + 2 * PAD;
    const scale = Math.min(1, spec.displayWidth / sideW);
    const sideH = Math.max(ext.maxY, anchor.minY + stackH) - Math.min(ext.minY, out.title?.y ?? ext.minY);
    const fits = Math.min(S.sub, S.step) * scale >= 11 && (!aspectMax || (sideW - 2 * PAD) / sideH <= aspectMax);
    out.placement = fits ? "side" : "below";
    if (fits) {
      let y = anchor.minY;
      for (const c of cards) { out.callouts.push({ ...c, w: cw, x: ext.maxX + C.gap, y }); y += c.h + 16; }
      right = ext.maxX + C.gap + cw;
      bottom = Math.max(bottom, y - 16);
    } else {
      const bodyW = ext.maxX - ext.minX;
      const cols = Math.max(1, Math.min(cards.length, Math.floor((bodyW + C.gap) / (cw + C.gap))));
      let y = ext.maxY + C.gap;
      for (let i = 0; i < cards.length; i += cols) {
        const row = cards.slice(i, i + cols), rowH = Math.max(...row.map((c) => c.h));
        row.forEach((c, k) => out.callouts.push({ ...c, w: cw, h: rowH, x: ext.minX + k * (cw + C.gap), y }));
        y += rowH + 16;
      }
      bottom = y - 16;
    }
  }

  // legend row(s)
  if ((spec.legend || []).length) {
    let x = ext.minX, y = bottom + F.gap;
    const maxX = Math.max(right, ext.minX + 600), rowH = Math.max(lh(S.sub), 18);
    const items = [];
    spec.legend.forEach((l, i) => {
      const w = L.swatch + 8 + tw(l.meaning, S.sub);
      if (x > ext.minX && x + w > maxX) { x = ext.minX; y += rowH + 10; }
      items.push({ id: `legend_${i}`, kind: l.kind, meaning: l.meaning, x, y, w, h: rowH, textW: tw(l.meaning, S.sub) });
      x += w + L.gap;
    });
    out.legend = { items };
    bottom = y + rowH;
  }

  const f = footerText(spec);
  if (f) out.footer = { text: f, x: ext.minX, y: bottom + F.gap, w: tw(f, S.sub), h: lh(S.sub) };
  return out;
}
