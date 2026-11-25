// Hub: one centre node with spokes on one or two elliptical rings (ring 2 = an outer context such as environments).
// Centre↔spoke and ring1↔ring2 edges are straight; spoke↔spoke edges on the same ring bow outward.
const RATIO = 0.72;
const gapBetween = (a, b) => Math.max(Math.abs(a.cx - b.cx) - (a.w + b.w) / 2, Math.abs(a.cy - b.cy) - (a.h + b.h) / 2);
const ringOf = (n) => n.ring ?? 1;

function validate(spec, bad) {
  if (!spec.nodes.some((n) => n.id === spec.center)) bad(`hub: center "${spec.center}" is not a node`);
  for (const n of spec.nodes) if (n.ring !== undefined && ![1, 2].includes(n.ring)) bad(`hub: node ${n.id} ring must be 1 or 2`);
  const spokes = spec.nodes.filter((n) => n.id !== spec.center);
  if (spokes.filter((n) => ringOf(n) === 1).length < 2) bad("hub: needs at least 2 ring-1 spokes");
  if (spokes.length > 14) bad(`hub: at most 14 spokes (has ${spokes.length}); split the map`);
  for (const r of spec.rings ?? []) {
    if (![1, 2].includes(r.ring) || typeof r.label !== "string" || !r.label.trim() || r.label.length > 28) bad("hub: rings entries are {ring: 1|2, label <= 28 chars}");
    else if (!spokes.some((n) => ringOf(n) === r.ring)) bad(`hub: ring ${r.ring} has no nodes, so its label "${r.label}" would not be drawn`);
  }
}

const texts = (spec, preset) => (spec.rings ?? []).map((r) => [r.label, preset.size.group]);

function compose(spec, geo, preset) {
  const G = preset.spacing.node, S = preset.size, lh = (s) => Math.ceil(s * preset.font.lineHeight);
  const centre = geo.nodes[spec.center];
  const rings = [1, 2].map((r) => spec.nodes.filter((n) => n.id !== spec.center && ringOf(n) === r));
  const labelPad = Math.max(0, ...spec.edges.map((e) => geo.edges[e.id].label?.width ?? 0));
  const place = (list, offset, inner) => {
    const th = list.map((_, i) => -Math.PI / 2 + offset + (2 * Math.PI * i) / list.length);
    for (let rx = 80; rx < 5000; rx += 8) {
      const ry = rx * RATIO;
      const bx = list.map((n, i) => ({ id: n.id, cx: rx * Math.cos(th[i]), cy: ry * Math.sin(th[i]), w: geo.nodes[n.id].w, h: geo.nodes[n.id].h }));
      const ok = bx.every((a, i) => bx.every((b, j) => j <= i || gapBetween(a, b) >= G))
        && bx.every((b) => inner.every((o) => gapBetween(b, o) >= G + (inner.length === 1 ? Math.min(labelPad, 120) : 0)));
      if (ok) return { rx, ry, boxes: bx };
    }
  };
  const core = { id: spec.center, cx: 0, cy: 0, w: centre.w, h: centre.h };
  const r1 = place(rings[0], 0, [core]);
  // ring 2 starts half a ring-1 step round so its nodes sit between the inner spokes
  const r2 = rings[1].length ? place(rings[1], Math.PI / rings[0].length, [core, ...r1.boxes]) : null;
  const nodes = {};
  for (const b of [core, ...r1.boxes, ...(r2?.boxes ?? [])]) nodes[b.id] = { x: Math.round(b.cx - b.w / 2), y: Math.round(b.cy - b.h / 2), w: b.w, h: b.h };

  const ctr = (id) => ({ x: nodes[id].x + nodes[id].w / 2, y: nodes[id].y + nodes[id].h / 2 });
  const inside = (p, b) => p.x > b.x - 2 && p.x < b.x + b.w + 2 && p.y > b.y - 2 && p.y < b.y + b.h + 2;
  const exit = (from, to, box) => { // walk from a centre toward the other centre until leaving the box
    let t = 0; const dx = to.x - from.x, dy = to.y - from.y;
    while (t < 1 && inside({ x: from.x + dx * t, y: from.y + dy * t }, box)) t += 0.002;
    return { x: from.x + dx * t, y: from.y + dy * t };
  };
  const ring = Object.fromEntries(spec.nodes.map((n) => [n.id, n.id === spec.center ? 0 : ringOf(n)]));
  const routes = {};
  for (const e of spec.edges) {
    const a = ctr(e.from), b = ctr(e.to);
    const p0 = exit(a, b, nodes[e.from]), p1 = exit(b, a, nodes[e.to]);
    const L = geo.edges[e.id].label;
    let pts = [p0, p1], mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    if (ring[e.from] === ring[e.to] && ring[e.from] > 0) {
      const len = Math.hypot(mid.x, mid.y) || 1, push = 40;
      mid = { x: mid.x + (mid.x / len) * push, y: mid.y + (mid.y / len) * push };
      pts = [p0, mid, p1];
    }
    routes[e.id] = { points: pts, curved: true, label: L ? { x: Math.round(mid.x - L.width / 2), y: Math.round(mid.y - L.height / 2), width: L.width, height: L.height } : null };
  }

  const decor = [];
  for (const r of spec.rings ?? []) {
    const R = r.ring === 1 ? r1 : r2;
    if (!R) continue;
    // the track runs through the ring's node centres (nodes are drawn over it); its label sits in the widest free arc
    const { rx, ry } = R;
    decor.push({ kind: "ellipse", id: `ring${r.ring}`, x: Math.round(-rx), y: Math.round(-ry), w: Math.round(2 * rx), h: Math.round(2 * ry), style: "track" });
    const angs = R.boxes.map((b) => Math.atan2(b.cy / ry, b.cx / rx)).sort((a, b) => a - b);
    let best = -Math.PI / 2, widest = -1;
    angs.forEach((a, i) => { const nx = i + 1 < angs.length ? angs[i + 1] : angs[0] + 2 * Math.PI; if (nx - a > widest) { widest = nx - a; best = (a + nx) / 2; } });
    if (angs.every((a) => Math.abs(((a + Math.PI / 2 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) > 0.5)) best = -Math.PI / 2;
    const tw = geo.tw(r.label, S.group), h = lh(S.group);
    const px = rx * Math.cos(best), py = ry * Math.sin(best);
    decor.push({ kind: "rect", id: `ringc${r.ring}`, x: Math.round(px - tw / 2 - 8), y: Math.round(py - h / 2 - 3), w: tw + 16, h: h + 6, style: "chip" });
    decor.push({ kind: "text", id: `ringt${r.ring}`, text: r.label, x: Math.round(px - tw / 2), y: Math.round(py - h / 2), w: tw, size: "group", style: "header" });
  }
  return { nodes, groups: {}, titleAlign: {}, routes, fallbacks: [], decor };
}

export default { name: "hub", validate, texts, compose, check: () => ({ hard: [], warnings: [] }), aspect: [0.8, 2.6], openCentre: true };
