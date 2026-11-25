// Card: the anatomy of one artifact. The single group is the card; its nodes are the fields, stacked in spec order
// at one width. Callouts with refs explain fields (badges on fields make the refs readable as "step n").
const GAP = 10;

function validate(spec, bad) {
  if (spec.groups.length !== 1) bad(`card: needs exactly one group (the card), has ${spec.groups.length}`);
  for (const n of spec.nodes) if (n.group !== spec.groups[0]?.id) bad(`card: node ${n.id} must be in group ${spec.groups[0]?.id}`);
  if (spec.edges.length) bad("card: edges are not drawn; fields are listed in order");
  if (spec.nodes.length > 12) bad(`card: at most 12 fields (has ${spec.nodes.length})`);
}

function compose(spec, geo, preset) {
  const P = preset.group.pad, g = spec.groups[0];
  const W = Math.max(...spec.nodes.map((n) => geo.nodes[n.id].w), geo.groups[g.id].titleW + 8);
  const nodes = {};
  let y = P.top;
  for (const n of spec.nodes) {
    const b = geo.nodes[n.id];
    nodes[n.id] = { x: P.side, y, w: W, h: b.h };
    y += b.h + GAP;
  }
  return { nodes, groups: { [g.id]: { x: 0, y: 0, w: W + 2 * P.side, h: y - GAP + P.bottom } }, titleAlign: {}, routes: {}, fallbacks: [], decor: [] };
}

export default { name: "card", groups: true, validate, compose, check: () => ({ hard: [], warnings: [] }), aspect: [0.25, 3] };
