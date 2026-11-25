// Shared geometry: the ONE place node footprints, attachment anchors, and label/title/badge boxes are computed.
// Placement, routing, emit and metrics all consume this.
import { frameTexts } from "./frame.mjs";
import { layoutFor } from "./layouts/index.mjs";

export const lineH = (preset, size) => Math.ceil(size * preset.font.lineHeight);

/** Resolved node style = preset.node + preset.roles[role]; icon kinds fall back to box when no icon is given. */
export function nodeStyle(preset, n) {
  const s = { ...preset.node, ...(preset.roles?.[n.role] || {}) };
  if (s.kind === "card" && (!preset.icons || !n.icon)) s.kind = "cardNoIcon";
  if (!preset.icons) s.kind = s.kind === "icon" ? "box" : s.kind;
  if (s.kind === "icon" && !n.icon) s.kind = "box";
  return s;
}

export function textsNeeded(spec, preset) {
  const S = preset.size;
  const out = [];
  for (const n of spec.nodes) {
    out.push([n.label, S.label]);
    if (n.sub) out.push([n.sub, S.sub]);
  }
  for (const g of spec.groups || []) out.push([g.label, S.group]);
  for (const e of spec.edges) if (e.label) out.push([e.label, S.edge]);
  for (const e of spec.edges) if (e.step) out.push([String(e.step), S.step]);
  if (spec.title) out.push([spec.title, S.title]);
  out.push(["?", S.label]);
  out.push(...frameTexts(spec, preset));
  out.push(...(layoutFor(spec).texts?.(spec, preset) ?? []));
  return out;
}

export function buildGeometry(spec, preset, tw) {
  const S = preset.size;
  const lh = (size) => lineH(preset, size);
  const nodes = {};
  for (const n of spec.nodes) {
    const st = nodeStyle(preset, n);
    const labelW = tw(n.label, S.label);
    const subW = n.sub ? tw(n.sub, S.sub) : 0;
    const showSub = !!n.sub;
    let w, h, anchor = null;
    const parts = {};
    if (st.kind === "card" || st.kind === "cardNoIcon") {
      const I = st.kind === "card" ? st.iconSize : 0;
      w = Math.max(st.minW, labelW + 2 * st.padX, (showSub ? subW : 0) + 2 * st.padX);
      let y = 14;
      if (I) { parts.icon = { y, size: I }; y += I + 10; }
      parts.label = { y, h: lh(S.label) }; y += lh(S.label);
      if (showSub) { y += 2; parts.sub = { y, h: lh(S.sub) }; y += lh(S.sub); }
      h = Math.max(y + 12, I ? 0 : 60);
      if (!I) { // vertically center text block
        const block = lh(S.label) + (showSub ? 2 + lh(S.sub) : 0);
        const top = Math.round((h - block) / 2);
        parts.label.y = top;
        if (showSub) parts.sub.y = top + lh(S.label) + 2;
      }
    } else if (st.kind === "box" || st.kind === "pill") {
      w = Math.max(st.minW, labelW + 2 * st.padX, showSub ? subW + 2 * st.padX : 0);
      const block = lh(S.label) + (showSub ? 2 + lh(S.sub) : 0);
      h = Math.max(st.h, block + 28);
      parts.label = { y: Math.round((h - block) / 2), h: lh(S.label) };
      if (showSub) parts.sub = { y: parts.label.y + lh(S.label) + 2, h: lh(S.sub) };
    } else if (st.kind === "diamond" || st.kind === "ellipse") {
      // the text block must fit the shape's inscribed area, so the footprint grows by a shape factor
      const inner = Math.max(labelW, showSub ? subW : 0) + 16;
      const block = lh(S.label) + (showSub ? 2 + lh(S.sub) : 0);
      const [kx, ky] = st.kind === "diamond" ? [1.9, 2.0] : [1.4, 1.6];
      w = Math.max(st.minW, inner * kx);
      h = Math.max(st.h, block * ky + 12);
      parts.label = { y: Math.round((h - block) / 2), h: lh(S.label) };
      if (showSub) parts.sub = { y: parts.label.y + lh(S.label) + 2, h: lh(S.sub) };
    } else if (st.kind === "icon") {
      const I = st.iconSize;
      w = Math.max(I, labelW, showSub ? subW : 0) + 8;
      let y = 0;
      parts.icon = { y, size: I }; y += I + st.gap;
      parts.label = { y, h: lh(S.label) }; y += lh(S.label);
      if (showSub) { y += 2; parts.sub = { y, h: lh(S.sub) }; y += lh(S.sub); }
      h = y;
      anchor = { x: Math.round((w - I) / 2), y: 0, width: I, height: I };
    } else throw new Error(`unknown node kind ${st.kind}`);
    nodes[n.id] = { id: n.id, kind: st.kind, style: st, w: Math.ceil(w), h: Math.ceil(h), anchor, parts, labelW, subW, showSub };
  }
  // consistent card widths (Microsoft: "consistent icon sizes"/tiles)
  if (preset.node.uniformWidth) {
    const cards = Object.values(nodes).filter((g) => g.kind === "card" || g.kind === "cardNoIcon");
    const W = Math.max(0, ...cards.map((g) => g.w));
    const H = Math.max(0, ...cards.map((g) => g.h));
    for (const g of cards) { g.w = W; g.h = H; }
  }
  const edges = {};
  for (const e of spec.edges) {
    if (!e.label) { edges[e.id] = { label: null }; continue; }
    const tWidth = tw(e.label, S.edge);
    const badge = e.step && preset.steps ? preset.steps.d + 4 : 0;
    edges[e.id] = { tWidth, badge, stepW: e.step ? tw(String(e.step), S.step) : 0, label: { width: tWidth + badge + 10, height: lh(S.edge) + 4 } };
  }
  const groups = {};
  for (const g of spec.groups || []) groups[g.id] = { titleW: tw(g.label, S.group), titleH: lh(S.group) };
  const title = spec.title && preset.title ? { w: tw(spec.title, S.title), h: lh(S.title) } : null;
  return { nodes, edges, groups, title, tw };
}
