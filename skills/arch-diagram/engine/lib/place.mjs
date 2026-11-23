// Template-grid placement: every container (root + groups) lays its children out on a row/col grid.
// Hints (row/col) come from the spec (the LLM chooses composition); missing hints fall back to
// longest-path rank along the container's flow. A straighten pass then uses cell slack to align
// connected nodes so edges run straight.
const ROOT = "__root";

export function placeGrid(spec, geo, preset) {
  const groups = spec.groups || [];
  const gById = Object.fromEntries(groups.map((g) => [g.id, g]));
  const nById = Object.fromEntries(spec.nodes.map((n) => [n.id, n]));
  const parentOf = {};
  for (const g of groups) parentOf[g.id] = g.parent || ROOT;
  for (const n of spec.nodes) parentOf[n.id] = n.group || ROOT;
  const children = { [ROOT]: [] };
  for (const g of groups) children[g.id] = [];
  for (const id of [...groups.map((g) => g.id), ...spec.nodes.map((n) => n.id)]) children[parentOf[id]].push(id);
  const isGroup = (id) => !!gById[id];
  const item = (id) => gById[id] || nById[id];
  const childUnder = (id, c) => {
    let x = id;
    while (parentOf[x] !== c) { x = parentOf[x]; if (!x || x === ROOT) return null; }
    return x;
  };
  const pad = (c) => (c === ROOT ? { top: 0, side: 0, bottom: 0 } : preset.group.pad);
  const sp = preset.spacing;

  const rel = {}; // id -> {cell:{x,y,w,h}, box:{x,y,w,h}} relative to parent's origin
  const size = {}; // id -> {w,h}
  for (const n of spec.nodes) size[n.id] = { w: geo.nodes[n.id].w, h: geo.nodes[n.id].h };

  const flowOf = (c) => (c === ROOT ? spec.direction : gById[c].flow) || "LR";

  function layoutContainer(c) {
    const kids = children[c];
    for (const k of kids) if (isGroup(k)) layoutContainer(k);
    // child-level edges
    const cEdges = [];
    for (const e of spec.edges) {
      const a = childUnder(e.from, c), b = childUnder(e.to, c);
      if (a && b && a !== b) cEdges.push({ a, b, e });
    }
    // cells: hinted or auto (longest-path rank along flow)
    const cell = {};
    const hinted = kids.filter((k) => Number.isInteger(item(k).row) && Number.isInteger(item(k).col));
    for (const k of hinted) cell[k] = { r: item(k).row, c: item(k).col };
    const auto = kids.filter((k) => !cell[k]);
    if (auto.length) {
      const rank = Object.fromEntries(auto.map((k) => [k, 0]));
      const indeg = Object.fromEntries(auto.map((k) => [k, 0]));
      const out = Object.fromEntries(auto.map((k) => [k, []]));
      for (const { a, b } of cEdges) if (a in rank && b in rank) { out[a].push(b); indeg[b]++; }
      const done = new Set();
      while (done.size < auto.length) {
        let ready = auto.filter((k) => !done.has(k) && indeg[k] === 0);
        if (!ready.length) ready = [auto.filter((k) => !done.has(k)).sort((x, y) => indeg[x] - indeg[y])[0]]; // break cycle
        for (const k of ready) {
          done.add(k);
          for (const t of out[k]) if (!done.has(t)) { rank[t] = Math.max(rank[t], rank[k] + 1); indeg[t]--; }
        }
      }
      const tb = flowOf(c) === "TB";
      for (const k of auto) {
        const major = rank[k];
        let minor = 0;
        const taken = (m) => Object.values(cell).some((p) => (tb ? p.r === major && p.c === m : p.c === major && p.r === m));
        while (taken(minor)) minor++;
        cell[k] = tb ? { r: major, c: minor } : { r: minor, c: major };
      }
    }
    // compact indices
    const rows = [...new Set(Object.values(cell).map((p) => p.r))].sort((a, b) => a - b);
    const cols = [...new Set(Object.values(cell).map((p) => p.c))].sort((a, b) => a - b);
    for (const k of kids) { cell[k] = { r: rows.indexOf(cell[k].r), c: cols.indexOf(cell[k].c) }; }
    const nR = rows.length, nC = cols.length;
    const colW = Array(nC).fill(0), rowH = Array(nR).fill(0);
    for (const k of kids) {
      colW[cell[k].c] = Math.max(colW[cell[k].c], size[k].w);
      rowH[cell[k].r] = Math.max(rowH[cell[k].r], size[k].h);
    }
    const base = kids.some(isGroup) ? sp.group : sp.node;
    const colGap = Array(Math.max(0, nC - 1)).fill(base), rowGap = Array(Math.max(0, nR - 1)).fill(base);
    for (const { a, b, e } of cEdges) {
      const L = geo.edges[e.id].label;
      if (!L) continue;
      const [pa, pb] = [cell[a], cell[b]];
      if (pa.r === pb.r && Math.abs(pa.c - pb.c) === 1) {
        const i = Math.min(pa.c, pb.c);
        colGap[i] = Math.max(colGap[i], L.width + 44);
      }
      if (pa.c === pb.c && Math.abs(pa.r - pb.r) === 1) {
        const i = Math.min(pa.r, pb.r);
        rowGap[i] = Math.max(rowGap[i], L.height + 44);
      }
    }
    const P = pad(c);
    const colX = [], rowY = [];
    let x = P.side;
    for (let i = 0; i < nC; i++) { colX.push(x); x += colW[i] + (colGap[i] || 0); }
    let y = P.top;
    for (let i = 0; i < nR; i++) { rowY.push(y); y += rowH[i] + (rowGap[i] || 0); }
    let W = x + P.side, H = y + P.bottom;
    if (c !== ROOT) {
      const tg = geo.groups[c];
      const minW = tg.titleW + 2 * preset.group.titleInset.x + 8;
      if (W < minW) { const dx = Math.round((minW - W) / 2); for (let i = 0; i < nC; i++) colX[i] += dx; W = minW; }
    }
    for (const k of kids) {
      const { r, c: cc } = cell[k];
      const cl = { x: colX[cc], y: rowY[r], w: colW[cc], h: rowH[r] };
      const s = size[k];
      rel[k] = { r, c: cc, cell: cl, box: { x: cl.x + Math.round((cl.w - s.w) / 2), y: cl.y + Math.round((cl.h - s.h) / 2), w: s.w, h: s.h } };
    }
    size[c] = { w: W, h: H };
    dims[c] = { nR, nC };
  }
  const dims = {};
  layoutContainer(ROOT);

  // absolute coordinates
  const abs = {}, absCell = {};
  const place = (c, ox, oy) => {
    for (const k of children[c]) {
      const r = rel[k];
      abs[k] = { x: ox + r.box.x, y: oy + r.box.y, w: r.box.w, h: r.box.h };
      absCell[k] = { x: ox + r.cell.x, y: oy + r.cell.y, w: r.cell.w, h: r.cell.h };
      if (isGroup(k)) place(k, abs[k].x, abs[k].y);
    }
  };
  place(ROOT, 0, 0);

  // straighten: align connected nodes using cell slack (lowest movable ancestor wins)
  const descendants = (id) => {
    const out = [id];
    if (isGroup(id)) for (const k of children[id]) out.push(...descendants(k));
    return out;
  };
  const inside = (node, X) => { for (let x = node; x && x !== ROOT; x = parentOf[x]) if (x === X) return true; return false; };
  const locked = { x: [], y: [] };
  const shift = (id, axis, d) => {
    for (const k of descendants(id)) { abs[k][axis] += d; if (k !== id) absCell[k][axis] += d; }
  };
  const center = (id, axis) => abs[id][axis] + (axis === "x" ? abs[id].w : abs[id].h) / 2;
  const anchorCenter = (id, axis) => {
    const a = geo.nodes[id].anchor;
    if (!a) return center(id, axis);
    return abs[id][axis] + (axis === "x" ? a.x + a.width / 2 : a.y + a.height / 2);
  };
  const order = [...spec.edges].sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0));
  for (const e of order) {
    const u = e.from, v = e.to;
    // axis from the grid relationship at the common container: same row -> align y, same column -> align x
    const anc = new Set(); for (let x = u; x; x = parentOf[x]) anc.add(x); anc.add(ROOT);
    let common = parentOf[v]; while (!anc.has(common)) common = parentOf[common];
    const a = childUnder(u, common), b = childUnder(v, common);
    if (!a || !b) continue;
    const axis = rel[a].r === rel[b].r ? "y" : rel[a].c === rel[b].c ? "x" : null;
    if (!axis) continue;
    const delta = anchorCenter(v, axis) - anchorCenter(u, axis);
    if (Math.abs(delta) < 1) continue;
    // movable levels per endpoint: [item, lo, hi] (slack within its cell), below the common ancestor
    const levels = (start) => {
      const out = [[null, 0, 0]];
      for (let X = start; X && X !== ROOT; X = parentOf[X]) {
        if (inside(e.from, X) && inside(e.to, X)) break;
        if (locked[axis].some(([p, q]) => inside(p, X) !== inside(q, X))) continue;
        const cl = absCell[X], b = abs[X], dim = axis === "x" ? "w" : "h";
        let lo = cl[axis] - b[axis], hi = cl[axis] + cl[dim] - (b[axis] + b[dim]);
        // root has no border: edge-of-grid items may extend outward
        if (parentOf[X] === ROOT) {
          const idx = axis === "x" ? rel[X].c : rel[X].r, last = (axis === "x" ? dims[ROOT].nC : dims[ROOT].nR) - 1;
          if (idx === 0) lo = -Infinity;
          if (idx === last) hi = Infinity;
        }
        out.push([X, lo, hi]);
      }
      return out;
    };
    // need du - dv = delta (move u's level by du, v's level by dv)
    let done = false;
    for (const [Xu, lu, hu] of levels(u)) {
      for (const [Xv, lv, hv] of levels(v)) {
        if (Xu === null && Xv === null) continue;
        const lo = Math.max(lu, lv + delta), hi = Math.min(hu, hv + delta);
        if (lo > hi + 0.5) continue;
        const du = Math.min(hi, Math.max(lo, delta)), dv = du - delta;
        if (Xu && du) shift(Xu, axis, du);
        if (Xv && dv) shift(Xv, axis, dv);
        done = true;
        break;
      }
      if (done) break;
    }
    if (done) locked[axis].push([u, v]);
  }

  // titles: a vertically-aligned edge entering through a group's top-left title flips that title right
  const titleAlign = {};
  const ins = preset.group.titleInset;
  for (const [u, v] of locked.x) {
    const x = anchorCenter(u, "x");
    const y1 = Math.min(center(u, "y"), center(v, "y")), y2 = Math.max(center(u, "y"), center(v, "y"));
    for (const g of groups) {
      const b = abs[g.id], t = geo.groups[g.id];
      const tx1 = b.x + ins.x - 6, tx2 = tx1 + t.titleW + 12, ty = b.y + ins.y;
      if (ty > y1 && ty < y2 && x > tx1 - 8 && x < tx2 + 8) titleAlign[g.id] = "right";
    }
  }
  const nodes = {}, groupsOut = {};
  for (const n of spec.nodes) nodes[n.id] = abs[n.id];
  for (const g of groups) groupsOut[g.id] = abs[g.id];
  return { nodes, groups: groupsOut, titleAlign };
}
