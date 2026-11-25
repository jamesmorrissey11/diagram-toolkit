// Lanes: a swimlane flow. Rows are lanes (actors), columns are global steps; nodes sit in (lane, step) cells.
// Forward edges are routed orthogonally through the inter-column gaps (node-free by construction); edges of
// kind "loop" (and accidental backward edges) return through a channel above or below the lane bands.
const PADX = 24, PADY = 22, HEADER_PAD = 16, CH_GAP = 16, BAND_GAP = 14;

function validate(spec, bad) {
  const lanes = spec.lanes;
  if (!Array.isArray(lanes) || lanes.length < 2 || lanes.length > 5) { bad("lanes: needs 2..5 lanes [{id, label}]"); return; }
  const ids = new Set();
  for (const l of lanes) {
    if (typeof l.id !== "string" || ids.has(l.id)) bad(`lanes: lane id ${JSON.stringify(l.id)} missing or duplicate`);
    ids.add(l.id);
    if (typeof l.label !== "string" || !l.label.trim() || l.label.length > 24) bad(`lanes: lane ${l.id} label required, <= 24 chars`);
  }
  const cell = {};
  for (const n of spec.nodes) {
    if (!ids.has(n.lane)) bad(`lanes: node ${n.id} needs lane (one of ${[...ids].join(", ")})`);
    if (!(Number.isInteger(n.step) && n.step >= 0 && n.step < 20)) bad(`lanes: node ${n.id} needs step (integer 0..19)`);
    const k = `${n.lane}/${n.step}`;
    if (cell[k]) bad(`lanes: "${n.id}" and "${cell[k]}" share lane ${n.lane}, step ${n.step}`);
    else cell[k] = n.id;
  }
  for (const p of spec.phases ?? []) {
    if (typeof p.label !== "string" || !p.label.trim() || p.label.length > 24) bad("lanes: phase label required, <= 24 chars");
    if (!(Number.isInteger(p.from) && Number.isInteger(p.to) && p.from <= p.to)) bad(`lanes: phase "${p.label}" needs integer from <= to`);
  }
}

const texts = (spec, preset) => [...spec.lanes.map((l) => [l.label, preset.size.group]), ...(spec.phases ?? []).map((p) => [p.label, preset.size.group])];

function compose(spec, geo, preset) {
  const S = preset.size, tw = geo.tw, lh = (s) => Math.ceil(s * preset.font.lineHeight);
  const steps = [...new Set(spec.nodes.map((n) => n.step))].sort((a, b) => a - b);
  const col = Object.fromEntries(steps.map((s, i) => [s, i]));
  const laneIdx = Object.fromEntries(spec.lanes.map((l, i) => [l.id, i]));
  const byId = Object.fromEntries(spec.nodes.map((n) => [n.id, n]));
  const G = Math.round(preset.spacing.node * 0.75);

  // column widths and gaps (a gap widens to fit the labels of edges that cross it)
  const colW = steps.map((s) => Math.max(...spec.nodes.filter((n) => n.step === s).map((n) => geo.nodes[n.id].w)));
  const gapW = steps.map(() => G);
  for (const e of spec.edges) {
    const L = geo.edges[e.id].label;
    if (!L) continue;
    const a = col[byId[e.from].step], b = col[byId[e.to].step];
    if (b === a + 1) gapW[a] = Math.max(gapW[a], L.width + 32);
  }
  const headerW = Math.max(...spec.lanes.map((l) => tw(l.label, S.group))) + 2 * HEADER_PAD;
  const colX = [];
  let x = headerW + PADX;
  steps.forEach((_, i) => { colX.push(x); x += colW[i] + (i < steps.length - 1 ? gapW[i] : 0); });
  const lanesW = x + PADX;

  // lane bands; vertical-edge labels need room between lanes
  const laneH = spec.lanes.map((l) => Math.max(60, ...spec.nodes.filter((n) => n.lane === l.id).map((n) => geo.nodes[n.id].h)) + 2 * PADY);
  const laneY = [];
  let y = 0;
  laneH.forEach((h) => { laneY.push(y); y += h + BAND_GAP; });
  const lanesH = y - BAND_GAP;

  const nodes = {};
  for (const n of spec.nodes) {
    const g = geo.nodes[n.id], c = col[n.step], l = laneIdx[n.lane];
    nodes[n.id] = { x: Math.round(colX[c] + (colW[c] - g.w) / 2), y: Math.round(laneY[l] + (laneH[l] - g.h) / 2), w: g.w, h: g.h };
  }
  const centre = (id) => ({ x: nodes[id].x + nodes[id].w / 2, y: nodes[id].y + nodes[id].h / 2 });
  const occupied = (lane, c) => spec.nodes.some((n) => n.lane === lane && col[n.step] === c);
  const gapUse = {};
  const gapMid = (i) => colX[i] + colW[i] + gapW[i] / 2; // gap after column i
  const gapLeg = (i) => { const k = (gapUse[i] = (gapUse[i] ?? -1) + 1); return gapMid(i) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 12; };

  // ---- routing ----
  // left/right ports are spread when several forward edges share a side; vertical and corridor edges choose x explicitly
  const portUse = {};
  const sidePort = (id, side, eid) => {
    const list = portUse[`${id}/${side}`], b = nodes[id], k = list.indexOf(eid);
    return { x: side === "left" ? b.x : b.x + b.w, y: Math.round(b.y + (b.h * (k + 1)) / (list.length + 1)) };
  };
  const colCentre = (c) => colX[c] + colW[c] / 2;
  const blocked = (c, l0, l1, skip) => spec.nodes.some((n) => col[n.step] === c && !skip.includes(n.id) && laneIdx[n.lane] > Math.min(l0, l1) && laneIdx[n.lane] < Math.max(l0, l1));
  const crossesNode = (px, y0, y1, skip) => spec.nodes.some((n) => {
    const r = nodes[n.id];
    return !skip.includes(n.id) && px > r.x - 4 && px < r.x + r.w + 4 && Math.max(r.y, Math.min(y0, y1)) < Math.min(r.y + r.h, Math.max(y0, y1));
  });
  const plan = [];
  for (const e of spec.edges) {
    const a = byId[e.from], b = byId[e.to], ca = col[a.step], cb = col[b.step];
    const la = laneIdx[a.lane], lb = laneIdx[b.lane];
    const between = (lane) => { for (let c = ca + 1; c < cb; c++) if (occupied(lane, c)) return true; return false; };
    let kind;
    if (ca === cb && la !== lb && !blocked(ca, la, lb, [e.from, e.to])) kind = "vertical";
    else if (e.kind === "loop" || cb <= ca) kind = "corridor";
    else if (la === lb) kind = between(a.lane) ? "corridor" : "straight";
    else kind = !between(b.lane) ? "afterSource" : !between(a.lane) ? "beforeTarget" : "corridor";
    plan.push({ e, kind, ca, cb, la, lb });
    if (["straight", "afterSource", "beforeTarget"].includes(kind)) for (const [id, side] of [[e.from, "right"], [e.to, "left"]]) (portUse[`${id}/${side}`] ??= []).push(e.id);
  }
  const edgeOf = Object.fromEntries(spec.edges.map((e) => [e.id, e]));
  for (const [k, list] of Object.entries(portUse)) {
    const id = k.split("/")[0];
    const other = (eid) => { const e = edgeOf[eid]; return centre(e.from === id ? e.to : e.from); };
    list.sort((a, b) => other(a).y - other(b).y);
  }
  // two vertical edges between the same pair (a step and its loop back) run side by side
  const pairs = {};
  for (const p of plan) if (p.kind === "vertical") (pairs[[p.e.from, p.e.to].sort().join("|")] ??= []).push(p.e.id);
  const pairOffset = (eid, a, b) => {
    const list = pairs[[a, b].sort().join("|")];
    if (list.length < 2) return 0;
    const fwd = [...list].sort((x, y) => (edgeOf[x].kind === "loop") - (edgeOf[y].kind === "loop"));
    return (fwd.indexOf(eid) - (list.length - 1) / 2) * 28;
  };

  const routes = {}, fallbacks = [];
  const labelBox = (eid, p, beside = false) => {
    const L = geo.edges[eid].label;
    if (!L) return null;
    return beside ? { x: Math.round(p.x + 8), y: Math.round(p.y - L.height / 2), width: L.width, height: L.height }
      : { x: Math.round(p.x - L.width / 2), y: Math.round(p.y - L.height / 2), width: L.width, height: L.height };
  };
  const corridorUse = {};
  let nTop = 0, nBottom = 0;
  const cornerUse = {};
  const cornerX = (id, toward) => { // a top/bottom attachment left or right of centre, spread when reused
    const b = nodes[id], k = (cornerUse[`${id}/${toward}`] = (cornerUse[`${id}/${toward}`] ?? -1) + 1);
    return Math.round(b.x + b.w / 2 + (toward === "left" ? -1 : 1) * (b.w / 4 + k * 10));
  };
  for (const { e, kind, ca, cb, la, lb } of plan) {
    const A = nodes[e.from], B = nodes[e.to];
    let pts, label;
    if (kind === "straight") {
      const p0 = sidePort(e.from, "right", e.id), p1 = sidePort(e.to, "left", e.id);
      const y = Math.min(Math.max(p1.y, A.y + 6), A.y + A.h - 6);
      pts = [{ x: p0.x, y }, { x: p1.x, y }];
      label = labelBox(e.id, { x: (p0.x + p1.x) / 2, y });
    } else if (kind === "vertical") {
      const x = Math.round(colCentre(ca) + pairOffset(e.id, e.from, e.to));
      const down = la < lb;
      pts = [{ x, y: down ? A.y + A.h : A.y }, { x, y: down ? B.y : B.y + B.h }];
      label = labelBox(e.id, { x, y: (pts[0].y + pts[1].y) / 2 }, true);
    } else if (kind === "afterSource" || kind === "beforeTarget") {
      const p0 = sidePort(e.from, "right", e.id), p1 = sidePort(e.to, "left", e.id);
      const xm = kind === "afterSource" ? gapLeg(ca) : gapLeg(cb - 1);
      pts = [p0, { x: xm, y: p0.y }, { x: xm, y: p1.y }, p1];
      const stub = kind === "afterSource" ? Math.abs(p1.x - xm) : Math.abs(xm - p0.x);
      label = stub >= (geo.edges[e.id].label?.width ?? 0) + 24
        ? (kind === "afterSource" ? labelBox(e.id, { x: (xm + p1.x) / 2, y: p1.y }) : labelBox(e.id, { x: (p0.x + xm) / 2, y: p0.y }))
        : labelBox(e.id, { x: xm, y: (p0.y + p1.y) / 2 }, true);
    } else {
      // corridor: the node-free strip between two lane bands next to the target (or outside the bands)
      const targetLeft = centre(e.to).x <= centre(e.from).x;
      const up = lb < la || (lb === la);
      const lane = lb;
      let yc = up ? (lane === 0 ? null : laneY[lane] - BAND_GAP / 2) : laneY[lane] - BAND_GAP / 2;
      if (lb < la) yc = laneY[lb] + laneH[lb] + BAND_GAP / 2; // arrive from below
      const ck = `${yc}`;
      const x0 = cornerX(e.from, targetLeft ? "left" : "right"), x1 = cornerX(e.to, targetLeft ? "right" : "left");
      const y0 = lb < la || lb === la ? A.y : A.y + A.h, y1 = lb < la ? B.y + B.h : B.y;
      const inBands = yc !== null && !crossesNode(x0, y0, yc, [e.from, e.to]) && !crossesNode(x1, y1, yc, [e.from, e.to]);
      if (inBands) {
        const k = (corridorUse[ck] = (corridorUse[ck] ?? -1) + 1);
        const y = yc + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 8;
        if (ca !== cb && lb !== la) {
          // arrive on the target's near side through the node-free column gap, keeping its top/bottom free
          const xs = targetLeft ? B.x + B.w + 20 : B.x - 20, ym = Math.round(B.y + B.h / 2);
          pts = [{ x: x0, y: y0 }, { x: x0, y }, { x: xs, y }, { x: xs, y: ym }, { x: targetLeft ? B.x + B.w : B.x, y: ym }];
          label = labelBox(e.id, { x: (x0 + xs) / 2, y });
        } else {
          pts = [{ x: x0, y: y0 }, { x: x0, y }, { x: x1, y }, { x: x1, y: y1 }];
          label = labelBox(e.id, { x: (x0 + x1) / 2, y });
        }
      } else {
        // outside the bands, through the column gaps
        const top = (la + lb) / 2 <= (spec.lanes.length - 1) / 2;
        const k = top ? nTop++ : nBottom++;
        const yo = top ? -CH_GAP - k * CH_GAP : lanesH + CH_GAP + k * CH_GAP;
        const s0 = { x: A.x + A.w, y: A.y + A.h / 2 }, s1 = { x: B.x, y: B.y + B.h / 2 };
        const xa = ca < steps.length - 1 ? gapLeg(ca) : colX[ca] + colW[ca] + PADX / 2;
        const xb = cb > 0 ? gapLeg(cb - 1) : colX[0] - PADX / 2;
        pts = [s0, { x: xa, y: s0.y }, { x: xa, y: yo }, { x: xb, y: yo }, { x: xb, y: s1.y }, s1];
        label = labelBox(e.id, { x: (xa + xb) / 2, y: yo });
        fallbacks.push(e.id);
      }
    }
    routes[e.id] = { points: pts, label, curved: false };
  }
  fallbacks.length = 0; // outside-the-bands routes are valid, not router failures

  // decor: lane bands with headers, optional phase band above the top channel
  const decor = [];
  spec.lanes.forEach((l, i) => {
    decor.push({ kind: "rect", id: `lane_${l.id}`, x: 0, y: laneY[i], w: lanesW, h: laneH[i], style: "lane" });
    decor.push({ kind: "rect", id: `laneh_${l.id}`, x: 0, y: laneY[i], w: headerW, h: laneH[i], style: "header" });
    const t = tw(l.label, S.group);
    decor.push({ kind: "text", id: `lanet_${l.id}`, text: l.label, x: Math.round((headerW - t) / 2), y: Math.round(laneY[i] + (laneH[i] - lh(S.group)) / 2), w: t, size: "group", style: "header" });
  });
  if (spec.phases?.length) {
    const ph = lh(S.group) + 12, py = -(nTop ? CH_GAP * (nTop + 1) : 0) - ph - 10;
    for (const [i, p] of spec.phases.entries()) {
      const c0 = col[steps.find((s) => s >= p.from)], c1 = col[[...steps].reverse().find((s) => s <= p.to)];
      if (c0 === undefined || c1 === undefined) continue;
      const x0 = colX[c0] - (c0 > 0 ? gapW[c0 - 1] / 2 : PADX / 2) + 3, x1 = colX[c1] + colW[c1] + (c1 < steps.length - 1 ? gapW[c1] / 2 : PADX / 2) - 3;
      decor.push({ kind: "rect", id: `phase_${i}`, x: Math.round(x0), y: py, w: Math.round(x1 - x0), h: ph, style: "band" });
      const t = tw(p.label, S.group);
      decor.push({ kind: "text", id: `phaset_${i}`, text: p.label, x: Math.round((x0 + x1 - t) / 2), y: py + 6, w: t, size: "group", style: "header" });
    }
  }
  return { nodes, groups: {}, titleAlign: {}, routes, fallbacks, decor };
}

function check(spec, scene) {
  const warnings = [];
  const step = Object.fromEntries(spec.nodes.map((n) => [n.id, n.step]));
  for (const e of spec.edges) if (step[e.to] < step[e.from] && e.kind !== "loop") warnings.push(`edge ${e.id} goes backward: mark it kind "loop"`);
  return { hard: [], warnings };
}

export default { name: "lanes", validate, texts, compose, check, aspect: [0.8, 3.2] };
