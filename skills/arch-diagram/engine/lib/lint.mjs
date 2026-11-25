// Lint: hard defects (block delivery), readability at the intended display width, advisory composition scores,
// and token discipline (every colour/font/size must come from the active preset). Computed on the emitted scene.
export const PAD = 48; // render.mjs exportPadding

const segs = (a) => {
  const out = [];
  for (let i = 0; i < a.points.length - 1; i++) {
    const p = a.points[i], q = a.points[i + 1];
    out.push({ x1: a.x + p[0], y1: a.y + p[1], x2: a.x + q[0], y2: a.y + q[1] });
  }
  return out;
};
export const boxOf = (e) => {
  if (e.points) {
    const xs = e.points.map((p) => e.x + p[0]), ys = e.points.map((p) => e.y + p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  return { x: e.x, y: e.y, w: e.width, h: e.height };
};
export const shrink = (b, d) => ({ x: b.x + d, y: b.y + d, w: Math.max(0, b.w - 2 * d), h: Math.max(0, b.h - 2 * d) });
export const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const segBox = (s) => ({ x: Math.min(s.x1, s.x2), y: Math.min(s.y1, s.y2), w: Math.abs(s.x1 - s.x2) || 0.01, h: Math.abs(s.y1 - s.y2) || 0.01 });
const near = (p, b, d) => p.x >= b.x - d && p.x <= b.x + b.w + d && p.y >= b.y - d && p.y <= b.y + b.h + d;
const len = (s) => Math.abs(s.x1 - s.x2) + Math.abs(s.y1 - s.y2);
function properCross(a, b) {
  const ah = a.y1 === a.y2, bh = b.y1 === b.y2;
  if (ah === bh) return false;
  const [h, v] = ah ? [a, b] : [b, a];
  const hx1 = Math.min(h.x1, h.x2), hx2 = Math.max(h.x1, h.x2), vy1 = Math.min(v.y1, v.y2), vy2 = Math.max(v.y1, v.y2);
  return v.x1 > hx1 + 1 && v.x1 < hx2 - 1 && h.y1 > vy1 + 1 && h.y1 < vy2 - 1;
}

export function hexes(o, out = new Set()) {
  if (typeof o === "string" && /^#[0-9a-f]{3,8}$/i.test(o)) out.add(o.toLowerCase());
  else if (o && typeof o === "object") for (const v of Object.values(o)) hexes(v, out);
  return out;
}

// largest empty axis-aligned rectangle (in cells) of a boolean occupancy grid
function largestEmpty(grid) {
  const R = grid.length, C = grid[0]?.length || 0, h = Array(C).fill(0);
  let best = 0;
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) h[c] = grid[r][c] ? 0 : h[c] + 1;
    const st = [];
    for (let c = 0; c <= C; c++) {
      const cur = c === C ? 0 : h[c];
      while (st.length && h[st.at(-1)] >= cur) { const top = st.pop(); const w = st.length ? c - st.at(-1) - 1 : c; best = Math.max(best, h[top] * w); }
      st.push(c);
    }
  }
  return best;
}

export function lintScene(scene, spec, preset, { publish = false, minText = 11 } = {}) {
  const displayWidth = spec.displayWidth, aspectMax = preset.aspectMax;
  const els = scene.elements.filter((e) => !e.isDeleted);
  const dt = (e) => e.customData?.dt || {};
  const all = els.map(boxOf);
  const minX = Math.min(...all.map((b) => b.x)), minY = Math.min(...all.map((b) => b.y));
  const maxX = Math.max(...all.map((b) => b.x + b.w)), maxY = Math.max(...all.map((b) => b.y + b.h));
  const contentW = maxX - minX, contentH = maxY - minY;
  const exportW = contentW + 2 * PAD;
  const scale = Math.min(1, displayWidth / exportW);
  const texts = els.filter((e) => e.type === "text");
  const minFont = Math.min(...texts.map((t) => t.fontSize));
  const effMinText = +(minFont * scale).toFixed(1);
  const aspect = +(contentW / contentH).toFixed(2);

  const hard = [];
  const nodes = Object.fromEntries(els.filter((e) => dt(e).kind === "node").map((e) => [dt(e).id, dt(e).footprint]));
  const arrows = els.filter((e) => e.type === "arrow" && dt(e).kind === "edge");
  for (const n of spec.nodes) if (!nodes[n.id]) hard.push(`missing-node:${n.id}`);
  for (const e of spec.edges) if (!arrows.some((a) => dt(a).id === e.id)) hard.push(`missing-edge:${e.id}`);

  const ids = Object.keys(nodes);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
    if (hit(shrink(nodes[ids[i]], 1), shrink(nodes[ids[j]], 1))) hard.push(`node-overlap:${ids[i]}/${ids[j]}`);
  const tb = texts.map((t) => ({ t, b: shrink(boxOf(t), 1), d: dt(t) }));
  const ownNode = (d) => (["nodeLabel", "nodeSub", "placeholderText"].includes(d.kind) ? d.id : null);
  for (const { b, d } of tb) for (const id of ids) if (ownNode(d) !== id && hit(b, shrink(nodes[id], 1))) hard.push(`text-on-node:${d.kind}:${d.id ?? "title"}/${id}`);
  for (let i = 0; i < tb.length; i++) for (let j = i + 1; j < tb.length; j++) {
    const A = tb[i], B = tb[j];
    if (ownNode(A.d) && ownNode(A.d) === ownNode(B.d)) continue;
    if ((A.d.kind === "badgeText" || B.d.kind === "badgeText") && A.d.id === B.d.id) continue;
    if (hit(A.b, B.b)) hard.push(`text-overlap:${A.d.kind}:${A.d.id}/${B.d.kind}:${B.d.id}`);
  }
  let crossings = 0, labelOnLine = 0, shared = 0;
  const detours = [], bends = [];
  const S = arrows.map((a) => ({ a, s: segs(a), d: dt(a) }));
  for (const { s, d } of S) {
    for (const seg of s) for (const id of ids) if (id !== d.from && id !== d.to && hit(segBox(seg), shrink(nodes[id], 3))) hard.push(`edge-through-node:${d.id}/${id}`);
    const p0 = { x: s[0].x1, y: s[0].y1 }, p1 = { x: s.at(-1).x2, y: s.at(-1).y2 };
    if (nodes[d.from] && !near(p0, nodes[d.from], 4)) hard.push(`detached-start:${d.id}`);
    if (nodes[d.to] && !near(p1, nodes[d.to], 4)) hard.push(`detached-end:${d.id}`);
    const L = s.reduce((acc, x) => acc + len(x), 0), M = Math.abs(p0.x - p1.x) + Math.abs(p0.y - p1.y);
    detours.push(M > 0 ? L / M : 1);
    bends.push(s.length - 1);
  }
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++)
    for (const x of S[i].s) for (const y of S[j].s) {
      if (properCross(x, y)) crossings++;
      const hx = x.y1 === x.y2 && y.y1 === y.y2 && Math.abs(x.y1 - y.y1) < 2, vx = x.x1 === x.x2 && y.x1 === y.x2 && Math.abs(x.x1 - y.x1) < 2;
      if (hx || vx) {
        const [a1, a2] = hx ? [Math.min(x.x1, x.x2), Math.max(x.x1, x.x2)] : [Math.min(x.y1, x.y2), Math.max(x.y1, x.y2)];
        const [b1, b2] = hx ? [Math.min(y.x1, y.x2), Math.max(y.x1, y.x2)] : [Math.min(y.y1, y.y2), Math.max(y.y1, y.y2)];
        if (Math.min(a2, b2) - Math.max(a1, b1) > 20) shared++;
      }
    }
  for (const { b, d } of tb.filter((x) => x.d.kind === "edgeLabel"))
    for (const { s, d: ed } of S) if (ed.id !== d.id && s.some((seg) => hit(segBox(seg), b))) labelOnLine++;
  // token discipline
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
    if (["rectangle", "ellipse", "line", "arrow"].includes(e.type) && e.roughness !== preset.roughness && e.roughness !== 0) tokens.push(`roughness:${e.roughness}@${e.id}`);
  }
  if (tokens.length) hard.push(...tokens.slice(0, 10).map((t) => `off-token:${t}`));
  const placeholders = els.filter((e) => dt(e).kind === "placeholder").map((e) => dt(e).id);
  if (publish) for (const id of placeholders) hard.push(`unresolved-icon:${id}`);
  // composition: largest empty rectangle (nodes, texts, arrows occupy; 20px cells) and edge length vs node size
  const cell = 20, R = Math.ceil(contentH / cell), Cn = Math.ceil(contentW / cell);
  const grid = Array.from({ length: R }, () => Array(Cn).fill(false));
  const mark = (b, pad = 0) => {
    for (let r = Math.max(0, Math.floor((b.y - pad - minY) / cell)); r < Math.min(R, Math.ceil((b.y + b.h + pad - minY) / cell)); r++)
      for (let c = Math.max(0, Math.floor((b.x - pad - minX) / cell)); c < Math.min(Cn, Math.ceil((b.x + b.w + pad - minX) / cell)); c++) grid[r][c] = true;
  };
  for (const id of ids) mark(nodes[id], 10);
  for (const t of texts) mark(boxOf(t), 6);
  for (const { s } of S) for (const seg of s) mark(segBox(seg), 6);
  const emptyFrac = +(largestEmpty(grid) / Math.max(1, R * Cn)).toFixed(2);
  const meanNode = ids.reduce((a, id) => a + (nodes[id].w + nodes[id].h) / 2, 0) / Math.max(1, ids.length);
  const meanEdge = S.reduce((a, { s }) => a + s.reduce((x, y) => x + len(y), 0), 0) / Math.max(1, S.length);
  const edgeLenRatio = +(meanEdge / meanNode).toFixed(2);
  const warnings = [];
  if (emptyFrac > 0.18) warnings.push(`large empty area (${Math.round(emptyFrac * 100)}% of the canvas): pull groups together or move a node into the gap`);
  if (edgeLenRatio > 3.5) warnings.push(`edges are long relative to node size (${edgeLenRatio}x): tighten the composition`);
  if (crossings > 2) warnings.push(`${crossings} edge crossings: reorder row/col hints`);
  if (Math.max(...detours) > 2) warnings.push("an edge detours more than 2x its direct distance");
  if (labelOnLine) warnings.push(`${labelOnLine} edge label(s) sit on another edge`);
  if (placeholders.length && !publish) warnings.push(`placeholder icons for: ${placeholders.join(", ")} (blocked in --publish)`);
  const readability = { effMinText, minText, aspect, aspectMax, exportW: Math.round(exportW), displayWidth,
    aspectGated: spec.nodes.length >= 5,
    pass: effMinText >= minText && (spec.nodes.length < 5 || (aspect <= aspectMax && aspect >= 0.45)) };
  const advisory = { crossings, sharedRuns: shared, labelOnLine, maxDetour: +Math.max(...detours).toFixed(2),
    meanDetour: +(detours.reduce((a, b) => a + b, 0) / detours.length).toFixed(2), meanBends: +(bends.reduce((a, b) => a + b, 0) / bends.length).toFixed(2) };
  if (!readability.pass) {
    if (effMinText < minText) warnings.unshift(`text renders at ${effMinText}px at ${displayWidth}px wide (min ${minText}): make the diagram narrower (fewer columns, split it) or raise displayWidth`);
  }
  if (aspect > aspectMax) warnings.unshift(`aspect ${aspect} exceeds ${aspectMax}: wrap columns into more rows${readability.aspectGated ? "" : " (advisory below 5 nodes)"}`);
  if (aspect < 0.45) warnings.unshift(`aspect ${aspect} is too tall: use more columns${readability.aspectGated ? "" : " (advisory below 5 nodes)"}`);
  advisory.emptyFrac = emptyFrac;
  advisory.edgeLenRatio = edgeLenRatio;
  return { pass: hard.length === 0 && readability.pass, hard: [...new Set(hard)], readability, advisory, warnings, placeholders };
}
