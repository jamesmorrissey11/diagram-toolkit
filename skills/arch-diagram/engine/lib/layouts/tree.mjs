// Tree: nodes with `parent` form one rooted tree.
//   treeStyle "files":  an indented list (filesystem); nodes default to role "item" (text rows), connectors are decor.
//   treeStyle "branch": a left-to-right tidy tree (driver/KPI trees); parent→child edges are implied and orthogonal.
const INDENT = 30, ROW_GAP = 4, LEVEL_GAP = 72, LEAF_GAP = 18;

const kids = (spec, id) => spec.nodes.filter((n) => n.parent === id);
function validate(spec, bad) {
  if (!["files", "branch"].includes(spec.treeStyle ?? "branch")) bad('tree: treeStyle must be "files" or "branch"');
  const ids = new Set(spec.nodes.map((n) => n.id));
  const roots = spec.nodes.filter((n) => !n.parent);
  if (roots.length !== 1) bad(`tree: needs exactly one root (nodes without parent): ${roots.map((r) => r.id).join(", ") || "none"}`);
  for (const n of spec.nodes) if (n.parent && !ids.has(n.parent)) bad(`tree: node ${n.id} parent "${n.parent}" is not a node`);
  for (const n of spec.nodes) { const seen = new Set(); for (let x = n; x?.parent; x = spec.nodes.find((m) => m.id === x.parent)) { if (seen.has(x.id)) { bad(`tree: parent cycle at ${n.id}`); break; } seen.add(x.id); } }
  if (spec.edges.some((e) => !e.id.startsWith("tree-"))) bad("tree: edges are implied by parent; remove explicit edges");
}
function normalize(spec) {
  if ((spec.treeStyle ?? "branch") === "files") { for (const n of spec.nodes) n.role ??= "item"; return; }
  for (const n of spec.nodes) if (n.parent && !spec.edges.some((e) => e.from === n.parent && e.to === n.id)) spec.edges.push({ id: `tree-${n.parent}-${n.id}`, from: n.parent, to: n.id });
}

function compose(spec, geo, preset) {
  const root = spec.nodes.find((n) => !n.parent);
  const nodes = {}, decor = [], routes = {};
  if ((spec.treeStyle ?? "branch") === "files") {
    let y = 0;
    const walk = (n, depth) => {
      const g = geo.nodes[n.id];
      nodes[n.id] = { x: depth * INDENT, y, w: g.w, h: g.h };
      y += g.h + ROW_GAP;
      for (const c of kids(spec, n.id)) {
        walk(c, depth + 1);
        const p = nodes[n.id], q = nodes[c.id], vx = p.x + 10, cy = q.y + q.h / 2;
        decor.push({ kind: "line", id: `v_${c.id}`, x1: vx, y1: p.y + p.h, x2: vx, y2: cy, style: "line" });
        decor.push({ kind: "line", id: `h_${c.id}`, x1: vx, y1: cy, x2: q.x - 2, y2: cy, style: "line" });
      }
    };
    walk(root, 0);
    return { nodes, groups: {}, titleAlign: {}, routes, fallbacks: [], decor };
  }
  // branch: depth sets the column; leaves take consecutive slots and parents centre on their children
  const depthW = {};
  const depthOf = (n) => (n.parent ? 1 + depthOf(spec.nodes.find((m) => m.id === n.parent)) : 0);
  for (const n of spec.nodes) depthW[depthOf(n)] = Math.max(depthW[depthOf(n)] ?? 0, geo.nodes[n.id].w);
  const colX = []; let x = 0;
  for (let d = 0; depthW[d] !== undefined; d++) { colX[d] = x; x += depthW[d] + LEVEL_GAP; }
  let slot = 0;
  const place = (n, d) => {
    const g = geo.nodes[n.id], cs = kids(spec, n.id);
    let cy;
    if (!cs.length) { cy = slot + g.h / 2; slot += g.h + LEAF_GAP; }
    else { const ys = cs.map((c) => place(c, d + 1)); cy = (ys[0] + ys.at(-1)) / 2; }
    nodes[n.id] = { x: colX[d], y: Math.round(cy - g.h / 2), w: g.w, h: g.h };
    return cy;
  };
  place(root, 0);
  for (const e of spec.edges) {
    const A = nodes[e.from], B = nodes[e.to], p0 = { x: A.x + A.w, y: A.y + A.h / 2 }, p1 = { x: B.x, y: B.y + B.h / 2 };
    const xm = Math.round(A.x + A.w + LEVEL_GAP / 2);
    routes[e.id] = { points: p0.y === p1.y ? [p0, p1] : [p0, { x: xm, y: p0.y }, { x: xm, y: p1.y }, p1], curved: false, label: null };
  }
  return { nodes, groups: {}, titleAlign: {}, routes, fallbacks: [], decor };
}

export default { name: "tree", validate, normalize, compose, check: () => ({ hard: [], warnings: [] }), aspect: [0.3, 3] };
