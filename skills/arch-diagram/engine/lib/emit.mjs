// Emits a raw Excalidraw 0.18 scene from spec + preset + shared geometry + placement + routes.
import { generateNKeysBetween } from "../vendor/fractional-indexing.mjs";
import { lineH } from "./geometry.mjs";
import { titleBox } from "./route.mjs";
import { resolveIcon, iconContrast } from "./icons.mjs";
import { placeFrame } from "./frame.mjs";

export async function emitScene(spec, preset, geo, placed, routed, frame = placeFrame(spec, geo, preset, placed, { aspectMax: preset.aspectMax })) {
  const S = preset.size, C = preset.color, F = preset.font;
  const lh = (s) => lineH(preset, s);
  let seed = 1000;
  const els = [], files = {}, byId = {};
  const issues = [];
  const base = (o) => ({
    angle: 0, strokeColor: C.text, backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid",
    roughness: preset.roughness, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: seed++, version: 1,
    versionNonce: seed++, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, ...o,
  });
  const add = (e) => { els.push(e); byId[e.id] = e; return e; };
  const text = (id, s, x, y, size, color, w, dt, extra = {}) =>
    add(base({ id, type: "text", x, y, width: w, height: lh(size), strokeColor: color, text: s, originalText: s, fontSize: size,
      fontFamily: F.family, textAlign: "center", verticalAlign: "top", containerId: null, autoResize: true, lineHeight: F.lineHeight,
      customData: { dt }, ...extra }));
  const image = async (id, nodeId, ref, x, y, size, groupIds) => {
    const icon = await resolveIcon(ref);
    if (!icon) { // visible placeholder, never another product's mark
      issues.push({ code: "unresolved-icon", node: nodeId, icon: ref });
      const P = preset.placeholder;
      add(base({ id, type: "rectangle", x, y, width: size, height: size, strokeColor: P.stroke, strokeStyle: "dashed", roughness: 0,
        roundness: { type: 3 }, groupIds, customData: { dt: { kind: "placeholder", id: nodeId, icon: ref } } }));
      const qw = Math.round(size * 0.3);
      return text(`${id}_q`, "?", x + (size - qw) / 2, y + (size - lh(S.label)) / 2, S.label, P.text, qw, { kind: "placeholderText", id: nodeId }, { groupIds });
    }
    const contrast = iconContrast(icon.svg, preset.canvas);
    if (contrast < 1.6) issues.push({ code: "low-contrast-icon", node: nodeId, icon: ref, contrast: +contrast.toFixed(2) });
    const fileId = `icon_${ref.replace(/[^a-z0-9]+/gi, "_")}`;
    files[fileId] = { mimeType: "image/svg+xml", id: fileId, dataURL: "data:image/svg+xml;base64," + Buffer.from(icon.svg).toString("base64"), created: 1, lastRetrieved: 1 };
    return add(base({ id, type: "image", x, y, width: size, height: size, strokeColor: "transparent", roughness: 0, fileId, status: "saved", scale: [1, 1], crop: null, groupIds,
      customData: { dt: { kind: "icon", id: nodeId, icon: ref } } }));
  };

  function emitFrame(fr) {
    if (fr.title) text("title", fr.title.text, fr.title.x, fr.title.y, S.title, C.title, fr.title.w, { kind: "title" }, { textAlign: "left" });
    if (fr.subtitle) text("subtitle", fr.subtitle.text, fr.subtitle.x, fr.subtitle.y, S.label, preset.frame.subtitle, fr.subtitle.w, { kind: "subtitle" }, { textAlign: "left" });
    const K = preset.callout;
    for (const c of fr.callouts) {
      add(base({ id: `callout_${c.id}`, type: "rectangle", x: c.x, y: c.y, width: c.w, height: c.h, strokeColor: c.tone.stroke, backgroundColor: c.tone.fill,
        roughness: 0, roundness: { type: 3, value: 8 }, customData: { dt: { kind: "callout", id: c.id } } }));
      add(base({ id: `callout_${c.id}_bar`, type: "rectangle", x: c.x, y: c.y + 12, width: K.accentW, height: c.h - 24, strokeColor: c.tone.accent, backgroundColor: c.tone.accent,
        roughness: 0, customData: { dt: { kind: "calloutAccent", id: c.id } } }));
      const tx = c.x + K.accentW + K.padX;
      text(`callout_${c.id}_title`, c.title, tx, c.y + K.padY, S.label, c.tone.text, c.titleW, { kind: "calloutTitle", id: c.id }, { textAlign: "left" });
      if (c.chip) {
        const cx = c.x + c.w - K.padX - c.chip.w, cy = c.y + K.padY + (lh(S.label) - c.chip.h) / 2;
        add(base({ id: `callout_${c.id}_chip`, type: "rectangle", x: cx, y: cy, width: c.chip.w, height: c.chip.h, strokeColor: c.tone.stroke, backgroundColor: preset.canvas,
          roughness: 0, roundness: { type: 3, value: c.chip.h / 2 }, customData: { dt: { kind: "calloutChip", id: c.id } } }));
        text(`callout_${c.id}_ref`, c.chip.text, cx + 8, cy + 3, S.step, c.tone.text, c.chip.tw, { kind: "calloutRef", id: c.id }, { textAlign: "left" });
      }
      const bw = Math.max(...c.lines.map((l) => l.w));
      text(`callout_${c.id}_text`, c.lines.map((l) => l.text).join("\n"), tx, c.y + K.padY + lh(S.label) + 8, S.sub, C.text, bw,
        { kind: "calloutText", id: c.id }, { textAlign: "left", height: c.lines.length * lh(S.sub) });
    }
    for (const it of fr.legend?.items || []) {
      const Lg = preset.legend, my = it.y + it.h / 2, sw = Lg.swatch, st = preset.roles?.[it.kind === "human" ? "terminal" : it.kind] || {};
      const sid = `${it.id}_swatch`, dtS = { dt: { kind: "legendSwatch", id: it.id } };
      if (["sync", "async", "optional"].includes(it.kind)) {
        add(base({ id: sid, type: "line", x: it.x, y: my, width: sw, height: 0, strokeColor: preset.edge.stroke, strokeWidth: preset.edge.width,
          strokeStyle: it.kind === "sync" ? "solid" : "dashed", points: [[0, 0], [sw, 0]], lastCommittedPoint: null, startBinding: null, endBinding: null,
          startArrowhead: null, endArrowhead: null, customData: dtS }));
      } else {
        const type = it.kind === "gate" ? "diamond" : it.kind === "store" ? "ellipse" : "rectangle";
        add(base({ id: sid, type, x: it.x + 4, y: my - 9, width: sw - 8, height: 18, strokeColor: st.stroke, backgroundColor: st.fill, roughness: 0,
          roundness: type === "rectangle" ? { type: 3, value: 9 } : null, customData: dtS }));
      }
      text(`${it.id}_text`, it.meaning, it.x + sw + 8, it.y, S.sub, preset.legend.text, it.textW, { kind: "legendText", id: it.id }, { textAlign: "left" });
    }
    if (fr.footer) text("footer", fr.footer.text, fr.footer.x, fr.footer.y, S.sub, preset.frame.footer, fr.footer.w, { kind: "footer" }, { textAlign: "left" });
  }

  // ---- groups (outer first) ----
  const groups = spec.groups || [];
  const depth = (g) => (g.parent ? 1 + depth(groups.find((x) => x.id === g.parent)) : 0);
  const gStyle = (g) => (g.kind === "boundary" ? preset.group.boundary : { ...preset.group.tierDefaults, ...preset.group.tones[g.tone || "neutral"] });
  const sortedGroups = [...groups].sort((a, b) => depth(a) - depth(b));
  for (const g of sortedGroups) {
    const b = placed.groups[g.id], s = gStyle(g);
    add(base({ id: `grp_${g.id}`, type: "rectangle", x: b.x, y: b.y, width: b.w, height: b.h, strokeColor: s.stroke, backgroundColor: s.fill,
      strokeWidth: s.strokeWidth, strokeStyle: s.strokeStyle, roundness: s.roundness ?? null, customData: { dt: { kind: "group", id: g.id } } }));
  }
  for (const g of sortedGroups) {
    const b = placed.groups[g.id], s = gStyle(g), tb = titleBox(preset, geo, g.id, b, placed.titleAlign?.[g.id]);
    text(`grpt_${g.id}`, g.label, tb.textX, tb.textY, S.group, s.titleColor, geo.groups[g.id].titleW, { kind: "groupTitle", id: g.id }, { textAlign: "left" });
  }
  // innermost non-transparent fill under a point (for label chips)
  const fillAt = (x, y) => {
    let fill = preset.canvas;
    for (const g of sortedGroups) {
      const b = placed.groups[g.id];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { const f = gStyle(g).fill; if (f && f !== "transparent") fill = f; }
    }
    return fill;
  };

  // ---- decor: layout scaffolding (lanes, bands, axes, rules, headers, tracks), styled only from preset.decor ----
  for (const d of placed.decor || []) {
    const st = preset.decor[d.style] || {};
    const dtd = { kind: d.kind === "text" ? "decorText" : "decor", id: d.id, style: d.style };
    if (d.kind === "text") {
      const size = S[d.size || "sub"];
      text(`decor_${d.id}`, d.text, d.x, d.y, size, st.text || preset.decor.text, d.w ?? geo.decorText?.[d.id] ?? 0, dtd, { textAlign: d.align || "left" });
    } else if (d.kind === "line") {
      add(base({ id: `decor_${d.id}`, type: "line", x: d.x1, y: d.y1, width: Math.abs(d.x2 - d.x1), height: Math.abs(d.y2 - d.y1),
        strokeColor: st.stroke, strokeWidth: st.strokeWidth, strokeStyle: st.strokeStyle, points: [[0, 0], [d.x2 - d.x1, d.y2 - d.y1]],
        lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: null, customData: { dt: dtd } }));
    } else {
      add(base({ id: `decor_${d.id}`, type: d.kind === "ellipse" ? "ellipse" : "rectangle", x: d.x, y: d.y, width: d.w, height: d.h,
        strokeColor: st.stroke || "transparent", backgroundColor: st.fill || "transparent", strokeWidth: st.strokeWidth ?? 1, strokeStyle: st.strokeStyle || "solid",
        roundness: d.kind === "rect" && d.rounded !== false ? { type: 3, value: 6 } : null, customData: { dt: dtd } }));
    }
  }

  // ---- nodes: compute bind targets first (arrows reference them) ----
  const bindBox = {};
  for (const n of spec.nodes) {
    const g = geo.nodes[n.id], b = placed.nodes[n.id];
    bindBox[n.id] = g.anchor ? { x: b.x + g.anchor.x, y: b.y + g.anchor.y, w: g.anchor.width, h: g.anchor.height } : { x: b.x, y: b.y, w: b.w, h: b.h };
  }

  // ---- edges ----
  const edgeEls = [], labelEls = [];
  for (const e of spec.edges) {
    const r = routed.routes[e.id];
    if (!r) continue;
    const pts = r.points;
    const ox = pts[0].x, oy = pts[0].y;
    const rel = pts.map((p) => [p.x - ox, p.y - oy]);
    const xs = rel.map((p) => p[0]), ys = rel.map((p) => p[1]);
    const dashed = e.kind === "async" || e.kind === "optional";
    const frac = (id, p) => { const bb = bindBox[id]; return [Math.min(1, Math.max(0, (p.x - bb.x) / bb.w)), Math.min(1, Math.max(0, (p.y - bb.y) / bb.h))]; };
    const E = preset.edge;
    edgeEls.push(base({ id: `edge_${e.id}`, type: "arrow", x: ox, y: oy, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
      strokeColor: e.primary && E.primaryStroke ? E.primaryStroke : E.stroke, strokeWidth: E.width, strokeStyle: dashed ? "dashed" : "solid",
      points: rel, elbowed: !r.curved, roundness: r.curved ? { type: 2 } : null, fixedSegments: null, startIsSpecial: null, endIsSpecial: null, startArrowhead: null,
      endArrowhead: dashed ? E.dashedHead : E.head, lastCommittedPoint: null,
      startBinding: { elementId: e.from, focus: 0, gap: 1, fixedPoint: frac(e.from, pts[0]) },
      endBinding: { elementId: e.to, focus: 0, gap: 1, fixedPoint: frac(e.to, pts[pts.length - 1]) },
      customData: { dt: { kind: "edge", id: e.id, from: e.from, to: e.to } } }));
    const L = r.label, ge = geo.edges[e.id];
    if (L && e.label) {
      const chipFill = preset.edge.chip === "group" ? fillAt(L.x + L.width / 2, L.y + L.height / 2) : preset.edge.chip;
      labelEls.push(base({ id: `chip_${e.id}`, type: "rectangle", x: L.x, y: L.y, width: L.width, height: L.height, strokeColor: "transparent",
        backgroundColor: chipFill, roughness: 0, customData: { dt: { kind: "chip", id: e.id } } }));
      const tx = L.x + 5 + ge.badge;
      labelEls.push({ t: [`label_${e.id}`, e.label, tx, L.y + 2, S.edge, C.edgeLabel, ge.tWidth, { kind: "edgeLabel", id: e.id }] });
      if (ge.badge) {
        const d = preset.steps.d, cx = L.x + 5 + d / 2, cy = L.y + L.height / 2;
        labelEls.push(base({ id: `step_${e.id}`, type: "ellipse", x: cx - d / 2, y: cy - d / 2, width: d, height: d, strokeColor: preset.steps.fill,
          backgroundColor: preset.steps.fill, roughness: 0, customData: { dt: { kind: "badge", id: e.id } } }));
        const sw = geo.edges[e.id].stepW ?? Math.round(S.step * 0.6);
        labelEls.push({ t: [`stept_${e.id}`, String(e.step), cx - sw / 2, cy - lh(S.step) / 2, S.step, preset.steps.text, sw, { kind: "badgeText", id: e.id }] });
      }
    }
  }
  for (const a of edgeEls) add(a);

  // ---- nodes ----
  const pillPoints = (w, h, N = 16) => {
    const r = h / 2, pts = [[r, 0], [w - r, 0]];
    for (let i = 1; i <= N; i++) { const a = -Math.PI / 2 + (Math.PI * i) / N; pts.push([w - r + r * Math.cos(a), r + r * Math.sin(a)]); }
    pts.push([r, h]);
    for (let i = 1; i <= N; i++) { const a = Math.PI / 2 + (Math.PI * i) / N; pts.push([r + r * Math.cos(a), r + r * Math.sin(a)]); }
    pts[pts.length - 1] = [r, 0];
    return pts;
  };
  for (const n of spec.nodes) {
    const g = geo.nodes[n.id], b = placed.nodes[n.id], st = g.style, gid = [`node_${n.id}`];
    const dt = { kind: "node", id: n.id, footprint: { x: b.x, y: b.y, w: b.w, h: b.h } };
    const bound = edgeEls.filter((a) => a.customData.dt.from === n.id || a.customData.dt.to === n.id).map((a) => ({ id: a.id, type: "arrow" }));
    const bb = bindBox[n.id];
    if (g.kind === "pill") {
      // Excalidraw normalizes linear elements so points[0] is [0,0]; emit them that way so a pristine file stays "clean"
      const pp = pillPoints(b.w, b.h), [px, py] = pp[0];
      add(base({ id: `${n.id}_shape`, type: "line", x: b.x + px, y: b.y + py, width: b.w, height: b.h, strokeColor: st.stroke, backgroundColor: st.fill,
        strokeWidth: st.strokeWidth, points: pp.map(([x, y]) => [x - px, y - py]), lastCommittedPoint: null, startBinding: null, endBinding: null,
        startArrowhead: null, endArrowhead: null, groupIds: gid }));
      add(base({ id: n.id, type: "rectangle", x: b.x, y: b.y, width: b.w, height: b.h, strokeColor: "transparent", roughness: 0, groupIds: gid, boundElements: bound, customData: { dt } }));
    } else if (g.kind === "icon") {
      add(base({ id: n.id, type: "rectangle", x: bb.x, y: bb.y, width: bb.w, height: bb.h, strokeColor: "transparent", roughness: 0, groupIds: gid, boundElements: bound, customData: { dt } }));
    } else if (g.kind === "diamond" || g.kind === "ellipse") {
      add(base({ id: n.id, type: g.kind, x: b.x, y: b.y, width: b.w, height: b.h, strokeColor: st.stroke, backgroundColor: st.fill,
        strokeWidth: st.strokeWidth, roundness: g.kind === "diamond" ? { type: 2 } : null, groupIds: gid, boundElements: bound, customData: { dt } }));
    } else {
      add(base({ id: n.id, type: "rectangle", x: b.x, y: b.y, width: b.w, height: b.h, strokeColor: st.stroke, backgroundColor: st.fill,
        strokeWidth: st.strokeWidth, roundness: st.roundness ?? null, groupIds: gid, boundElements: bound, customData: { dt } }));
    }
    if (g.parts.icon) await image(`${n.id}_icon`, n.id, n.icon, b.x + Math.round((b.w - g.parts.icon.size) / 2), b.y + g.parts.icon.y, g.parts.icon.size, gid);
    const tcol = st.text || C.text;
    text(`${n.id}_label`, n.label, b.x + Math.round((b.w - g.labelW) / 2), b.y + g.parts.label.y, S.label, tcol, g.labelW, { kind: "nodeLabel", id: n.id }, { groupIds: gid });
    if (g.parts.sub) text(`${n.id}_sub`, n.sub, b.x + Math.round((b.w - g.subW) / 2), b.y + g.parts.sub.y, S.sub, C.sub, g.subW, { kind: "nodeSub", id: n.id }, { groupIds: gid });
    if (n.status && n.status !== "ga") {
      const P = preset.badge.preview, sw = geo.tw(n.status, S.step), cw = sw + 14, ch = lh(S.step) + 4, cx = b.x + b.w - cw + 6, cy = b.y - ch / 2;
      add(base({ id: `${n.id}_status`, type: "rectangle", x: cx, y: cy, width: cw, height: ch, strokeColor: P.stroke, backgroundColor: P.fill, roughness: 0,
        roundness: { type: 3, value: ch / 2 }, groupIds: gid, customData: { dt: { kind: "nodeStatusChip", id: n.id } } }));
      text(`${n.id}_statust`, n.status, cx + 7, cy + 2, S.step, P.text, sw, { kind: "nodeStatus", id: n.id }, { groupIds: gid });
    }
    if (Number.isInteger(n.badge)) {
      const B = preset.badge, d = B.d, cx = b.x + 6, cy = b.y + 6, digit = String(n.badge), dw = geo.tw(digit, S.step);
      add(base({ id: `${n.id}_badge`, type: "ellipse", x: cx - d / 2, y: cy - d / 2, width: d, height: d, strokeColor: B.fill, backgroundColor: B.fill,
        roughness: 0, groupIds: gid, customData: { dt: { kind: "nodeBadge", id: n.id } } }));
      text(`${n.id}_badget`, digit, cx - dw / 2, cy - lh(S.step) / 2, S.step, B.text, dw, { kind: "nodeBadgeText", id: n.id }, { groupIds: gid });
    }
  }

  // ---- labels (chips, badges) on top ----
  for (const l of labelEls) l.t ? text(...l.t) : add(l);

  // ---- frame: title, subtitle, callouts, legend, footer ----
  emitFrame(frame);

  const idx = generateNKeysBetween(null, null, els.length);
  els.forEach((e, i) => (e.index = idx[i]));
  const scene = { type: "excalidraw", version: 2, source: "https://github.com/jamesmorrissey11/diagram-toolkit", elements: els,
    appState: { viewBackgroundColor: preset.canvas, gridSize: null }, files };
  return { scene, issues };
}
