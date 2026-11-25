// Cycle: steps on an ellipse, clockwise from 12 o'clock, joined by curved arcs; an optional hub node sits in the
// centre (edges to/from it are straight spokes). Consecutive step edges are implied when the spec omits them.
const ring = (spec) => spec.nodes.filter((n) => n.id !== spec.hub);
const key = (a, b) => `${a}>${b}`;

function validate(spec, bad) {
  const steps = ring(spec);
  if (spec.hub !== undefined && !spec.nodes.some((n) => n.id === spec.hub)) bad(`cycle: hub "${spec.hub}" is not a node`);
  if (steps.length < 3 || steps.length > 8) bad(`cycle: needs 3..8 steps (has ${steps.length}); split the loop or use lanes`);
  const idx = Object.fromEntries(steps.map((n, i) => [n.id, i]));
  for (const e of spec.edges) {
    if (e.from === spec.hub || e.to === spec.hub) continue;
    const i = idx[e.from], j = idx[e.to];
    if (i === undefined || j === undefined) continue;
    if (j !== (i + 1) % steps.length) bad(`edge ${e.id}: cycle edges must join consecutive steps (${steps[i].id}→${steps[(i + 1) % steps.length].id}), in node order`);
  }
}

function normalize(spec) {
  const steps = ring(spec), have = new Set(spec.edges.map((e) => key(e.from, e.to)));
  steps.forEach((n, i) => {
    const to = steps[(i + 1) % steps.length].id;
    if (!have.has(key(n.id, to))) spec.edges.push({ id: `cycle-${n.id}-${to}`, from: n.id, to });
  });
}

// distance between two boxes along the separating axis (negative when they overlap)
const gapBetween = (a, b) => Math.max(Math.abs(a.cx - b.cx) - (a.w + b.w) / 2, Math.abs(a.cy - b.cy) - (a.h + b.h) / 2);

function compose(spec, geo, preset) {
  const steps = ring(spec), n = steps.length, G = preset.spacing.node;
  const theta = steps.map((_, i) => -Math.PI / 2 + (2 * Math.PI * i) / n);
  const hub = spec.hub ? geo.nodes[spec.hub] : null;
  const sized = steps.map((s) => geo.nodes[s.id]);
  const labelPad = Math.max(0, ...spec.edges.map((e) => geo.edges[e.id].label?.height ?? 0));
  // widest box sets the horizontal spread; try a few ellipse proportions and keep the narrowest valid one
  const fit = (ratio) => {
    for (let rx = 120; rx < 4000; rx += 8) {
      const ry = rx * ratio;
      const bx = sized.map((g, i) => ({ cx: rx * Math.cos(theta[i]), cy: ry * Math.sin(theta[i]), w: g.w, h: g.h }));
      const pairsOk = bx.every((a, i) => bx.every((b, j) => j <= i || gapBetween(a, b) >= G + (j === i + 1 || (i === 0 && j === n - 1) ? labelPad : 0)));
      const hubOk = !hub || bx.every((b) => gapBetween(b, { cx: 0, cy: 0, w: hub.w, h: hub.h }) >= G);
      if (pairsOk && hubOk) {
        const W = Math.max(...bx.map((b) => b.cx + b.w / 2)) - Math.min(...bx.map((b) => b.cx - b.w / 2));
        const H = Math.max(...bx.map((b) => b.cy + b.h / 2)) - Math.min(...bx.map((b) => b.cy - b.h / 2));
        return { rx, ry, boxes: bx, W, H };
      }
    }
  };
  const fits = [0.72, 0.9, 1.1, 1.35].map(fit).filter((f) => f && f.W / f.H >= 1.05);
  const best = fits.length ? fits.reduce((a, b) => (b.W < a.W ? b : a)) : fit(0.72);
  const { rx, ry, boxes } = best;
  const nodes = {};
  steps.forEach((s, i) => { const b = boxes[i]; nodes[s.id] = { x: Math.round(b.cx - b.w / 2), y: Math.round(b.cy - b.h / 2), w: b.w, h: b.h }; });
  if (hub) nodes[spec.hub] = { x: Math.round(-hub.w / 2), y: Math.round(-hub.h / 2), w: hub.w, h: hub.h };

  const at = (a) => ({ x: rx * Math.cos(a), y: ry * Math.sin(a) });
  const inside = (p, b, m = 6) => p.x > b.x - m && p.x < b.x + b.w + m && p.y > b.y - m && p.y < b.y + b.h + m;
  const pos = Object.fromEntries(steps.map((s, i) => [s.id, i]));
  const routes = {};
  const labelAt = (e, p) => {
    const L = geo.edges[e.id].label;
    return L ? { x: Math.round(p.x - L.width / 2), y: Math.round(p.y - L.height / 2), width: L.width, height: L.height } : null;
  };
  for (const e of spec.edges) {
    if (e.from === spec.hub || e.to === spec.hub) {
      // straight spoke between the two box borders along the centre line
      const A = nodes[e.from], B = nodes[e.to];
      const ca = { x: A.x + A.w / 2, y: A.y + A.h / 2 }, cb = { x: B.x + B.w / 2, y: B.y + B.h / 2 };
      const along = (from, box, toward) => {
        let t = 0; const dx = toward.x - from.x, dy = toward.y - from.y;
        while (t < 1 && inside({ x: from.x + dx * t, y: from.y + dy * t }, box, 2)) t += 0.002;
        return { x: from.x + dx * t, y: from.y + dy * t };
      };
      const p0 = along(ca, A, cb), p1 = along(cb, B, ca);
      routes[e.id] = { points: [p0, p1], curved: true, label: labelAt(e, { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }) };
      continue;
    }
    const i = pos[e.from];
    let s = theta[i], t = theta[i] + (2 * Math.PI) / n;
    while (inside(at(s), nodes[e.from], 2)) s += 0.002;
    while (inside(at(t), nodes[e.to], 2)) t -= 0.002;
    const mid = at((s + t) / 2);
    routes[e.id] = { points: [at(s), mid, at(t)], curved: true, label: labelAt(e, mid) };
  }
  return { nodes, groups: {}, titleAlign: {}, routes, fallbacks: [], decor: [] };
}

function check(spec, scene) {
  const hard = [];
  const steps = ring(spec);
  const arrows = new Set(scene.elements.filter((e) => e.type === "arrow").map((e) => `${e.customData?.dt?.from}>${e.customData?.dt?.to}`));
  steps.forEach((s, i) => { const to = steps[(i + 1) % steps.length].id; if (!arrows.has(key(s.id, to))) hard.push(`cycle-gap:${s.id}>${to}`); });
  return { hard, warnings: [] };
}

export default { name: "cycle", validate, normalize, compose, check, aspect: [0.8, 2.4], openCentre: true };
