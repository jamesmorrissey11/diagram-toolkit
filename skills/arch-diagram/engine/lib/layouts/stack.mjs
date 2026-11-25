// Stack: ordered horizontal bands (the spec's groups, top to bottom), each holding its nodes as chips that wrap.
// Optional rails are side bars spanning a range of bands (cross-cutting concerns such as cost or audit).
const CHIP_GAP = 16, MAX_INNER = 880, RAIL_GAP = 20;

function validate(spec, bad) {
  const gs = spec.groups;
  if (gs.length < 2 || gs.length > 8) bad(`stack: needs 2..8 bands (groups), has ${gs.length}`);
  if (gs.some((g) => g.parent)) bad("stack: bands cannot be nested (no parent)");
  for (const n of spec.nodes) if (!n.group) bad(`stack: node ${n.id} needs a group (its band)`);
  if (spec.edges.length) bad("stack: edges are not drawn; order the bands to show the relationship");
  const ids = new Set(gs.map((g) => g.id));
  for (const [i, r] of (spec.rails ?? []).entries()) {
    if (typeof r.label !== "string" || !r.label.trim() || r.label.length > 24) bad(`stack: rail ${i} label required, <= 24 chars`);
    if (!ids.has(r.from) || !ids.has(r.to)) bad(`stack: rail "${r.label}" from/to must be band ids`);
  }
}

const texts = (spec, preset) => (spec.rails ?? []).map((r) => [r.label, preset.size.group]);

function compose(spec, geo, preset) {
  const P = preset.group.pad, S = preset.size, lh = (s) => Math.ceil(s * preset.font.lineHeight);
  const bandIds = spec.groups.map((g) => g.id);
  const kids = (g) => spec.nodes.filter((n) => n.group === g);
  // inner width: the widest band's chips on one row, capped; every band shares it
  const rowW = (list) => list.reduce((a, n) => a + geo.nodes[n.id].w, 0) + Math.max(0, list.length - 1) * CHIP_GAP;
  const inner = Math.max(...bandIds.map((g) => Math.min(MAX_INNER, rowW(kids(g)))), ...bandIds.map((g) => geo.groups[g].titleW + 8));
  const W = inner + 2 * P.side;
  const nodes = {}, groups = {};
  let y = 0;
  for (const g of bandIds) {
    let x = P.side, cy = y + P.top, rowH = 0;
    for (const n of kids(g)) {
      const b = geo.nodes[n.id];
      if (x > P.side && x + b.w > P.side + inner) { x = P.side; cy += rowH + CHIP_GAP; rowH = 0; }
      nodes[n.id] = { x, y: cy, w: b.w, h: b.h };
      x += b.w + CHIP_GAP; rowH = Math.max(rowH, b.h);
    }
    const h = Math.max(cy - y + rowH + P.bottom, P.top + P.bottom + 20);
    groups[g] = { x: 0, y, w: W, h };
    y += h + 10;
  }
  const decor = [];
  let rx = W + RAIL_GAP;
  (spec.rails ?? []).forEach((r, i) => {
    const top = groups[r.from].y, bottom = groups[r.to].y + groups[r.to].h;
    const tw = geo.tw(r.label, S.group), rw = Math.max(tw + 24, 110);
    const x = rx;
    rx += rw + 10;
    decor.push({ kind: "rect", id: `rail${i}`, x, y: top, w: rw, h: bottom - top, style: "header" });
    decor.push({ kind: "text", id: `railt${i}`, text: r.label, x: Math.round(x + (rw - tw) / 2), y: Math.round(top + (bottom - top - lh(S.group)) / 2), w: tw, size: "group", style: "header" });
  });
  return { nodes, groups, titleAlign: {}, routes: {}, fallbacks: [], decor };
}

export default { name: "stack", validate, texts, compose, check: () => ({ hard: [], warnings: [] }), aspect: [0.5, 3.0] };
