// Plot: a 2-axis ordinal chart. Each node sits in the cell of its [xTick, yTick]; several nodes in one cell stack.
// Axis lines, tick labels and a faint cell grid are decor; edges (if any) are straight arrows between points.
const GAP = 28, PAD = 18;

function validate(spec, bad) {
  const ax = spec.axes;
  const okAxis = (a) => a && typeof a.label === "string" && a.label.trim() && a.label.length <= 28 && Array.isArray(a.ticks) && a.ticks.length >= 2 && a.ticks.length <= 6 && a.ticks.every((t) => typeof t === "string" && t.length <= 20);
  if (!okAxis(ax?.x) || !okAxis(ax?.y)) { bad("plot: axes.x and axes.y need {label <= 28, ticks: 2..6 strings <= 20}"); return; }
  for (const n of spec.nodes) {
    const ok = Array.isArray(n.at) && n.at.length === 2 && Number.isInteger(n.at[0]) && Number.isInteger(n.at[1]);
    if (!ok) bad(`plot: node ${n.id} needs at: [xTick, yTick]`);
    else if (n.at[0] < 0 || n.at[0] >= ax.x.ticks.length || n.at[1] < 0 || n.at[1] >= ax.y.ticks.length) bad(`plot: node ${n.id} at [${n.at}] is outside the axes`);
  }
}

const texts = (spec, preset) => {
  const S = preset.size;
  return [[spec.axes.x.label, S.group], [spec.axes.y.label, S.group], ...spec.axes.x.ticks.map((t) => [t, S.sub]), ...spec.axes.y.ticks.map((t) => [t, S.sub])];
};

function compose(spec, geo, preset) {
  const S = preset.size, tw = geo.tw, lh = (s) => Math.ceil(s * preset.font.lineHeight);
  const X = spec.axes.x.ticks, Y = spec.axes.y.ticks;
  const inCell = (i, j) => spec.nodes.filter((n) => n.at[0] === i && n.at[1] === j);
  const colW = X.map((t, i) => Math.max(tw(t, S.sub), ...spec.nodes.filter((n) => n.at[0] === i).map((n) => geo.nodes[n.id].w), 90) + 2 * PAD);
  const rowH = Y.map((_, j) => Math.max(70, ...X.map((_, i) => inCell(i, j).reduce((a, n) => a + geo.nodes[n.id].h + 10, -10))) + 2 * PAD);
  const yLabW = Math.max(...Y.map((t) => tw(t, S.sub))) + 16;
  const x0 = yLabW + 10;
  const colX = []; let x = x0; for (const w of colW) { colX.push(x); x += w; }
  const plotW = x - x0;
  // y grows upward: the last tick is the top row
  const rowY = []; let y = 0; for (let j = Y.length - 1; j >= 0; j--) { rowY[j] = y; y += rowH[j]; }
  const plotH = y;
  const nodes = {};
  X.forEach((_, i) => Y.forEach((_, j) => {
    const list = inCell(i, j);
    const total = list.reduce((a, n) => a + geo.nodes[n.id].h + 10, -10);
    let cy = rowY[j] + (rowH[j] - total) / 2;
    for (const n of list) {
      const g = geo.nodes[n.id];
      nodes[n.id] = { x: Math.round(colX[i] + (colW[i] - g.w) / 2), y: Math.round(cy), w: g.w, h: g.h };
      cy += g.h + 10;
    }
  }));
  const decor = [];
  colX.slice(1).forEach((cx, i) => decor.push({ kind: "line", id: `vgrid${i}`, x1: cx, y1: 0, x2: cx, y2: plotH, style: "track" }));
  rowY.forEach((ry, j) => { if (ry > 0) decor.push({ kind: "line", id: `hgrid${j}`, x1: x0, y1: ry, x2: x0 + plotW, y2: ry, style: "track" }); });
  decor.push({ kind: "line", id: "xaxis", x1: x0, y1: plotH, x2: x0 + plotW, y2: plotH, style: "line" });
  decor.push({ kind: "line", id: "yaxis", x1: x0, y1: 0, x2: x0, y2: plotH, style: "line" });
  X.forEach((t, i) => { const w = tw(t, S.sub); decor.push({ kind: "text", id: `xt${i}`, text: t, x: Math.round(colX[i] + (colW[i] - w) / 2), y: plotH + 8, w, size: "sub", style: "header" }); });
  Y.forEach((t, j) => { const w = tw(t, S.sub); decor.push({ kind: "text", id: `yt${j}`, text: t, x: Math.round(x0 - 12 - w), y: Math.round(rowY[j] + (rowH[j] - lh(S.sub)) / 2), w, size: "sub", style: "header" }); });
  const xl = tw(spec.axes.x.label, S.group);
  decor.push({ kind: "text", id: "xlabel", text: spec.axes.x.label, x: Math.round(x0 + (plotW - xl) / 2), y: plotH + 8 + lh(S.sub) + 10, w: xl, size: "group", style: "header" });
  const yl = tw(spec.axes.y.label, S.group);
  decor.push({ kind: "text", id: "ylabel", text: spec.axes.y.label, x: x0 - Math.round(yl / 2), y: -lh(S.group) - 12, w: yl, size: "group", style: "header" });
  const ctr = (id) => ({ x: nodes[id].x + nodes[id].w / 2, y: nodes[id].y + nodes[id].h / 2 });
  const routes = {};
  for (const e of spec.edges) {
    const a = ctr(e.from), b = ctr(e.to), A = nodes[e.from], B = nodes[e.to];
    const clip = (p, q, box) => { let t = 0; while (t < 1 && p.x + (q.x - p.x) * t > box.x - 2 && p.x + (q.x - p.x) * t < box.x + box.w + 2 && p.y + (q.y - p.y) * t > box.y - 2 && p.y + (q.y - p.y) * t < box.y + box.h + 2) t += 0.002; return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }; };
    const p0 = clip(a, b, A), p1 = clip(b, a, B), L = geo.edges[e.id].label;
    routes[e.id] = { points: [p0, p1], curved: true, label: L ? { x: Math.round((p0.x + p1.x - L.width) / 2), y: Math.round((p0.y + p1.y - L.height) / 2), width: L.width, height: L.height } : null };
  }
  return { nodes, groups: {}, titleAlign: {}, routes, fallbacks: [], decor };
}

export default { name: "plot", validate, texts, compose, check: () => ({ hard: [], warnings: [] }), aspect: [0.6, 2.6] };
