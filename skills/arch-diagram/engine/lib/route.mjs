// Routes every edge over placed geometry with OpenDiagram's orthogonal router (Apache-2.0 @ 6cf306a).
import { routeEdges } from "../vendor/router.mjs";

export function titleBox(preset, geo, gid, box, align = "left") {
  const t = geo.groups[gid], ins = preset.group.titleInset;
  const x = align === "right" ? box.x + box.w - ins.x - t.titleW : box.x + ins.x;
  return { x: x - 6, y: box.y + ins.y - 4, width: t.titleW + 12, height: t.titleH + 8, textX: x, textY: box.y + ins.y };
}

export function route(spec, geo, placed, preset) {
  const input = {
    nodes: spec.nodes.map((n) => {
      const b = placed.nodes[n.id], a = geo.nodes[n.id].anchor;
      return {
        id: n.id, x: Math.round(b.x), y: Math.round(b.y), width: b.w, height: b.h, parent: n.group,
        anchor: a ? { x: Math.round(b.x + a.x), y: Math.round(b.y + a.y), width: a.width, height: a.height } : undefined,
      };
    }),
    containers: (spec.groups || []).map((g) => {
      const b = placed.groups[g.id];
      return { id: g.id, x: Math.round(b.x), y: Math.round(b.y), width: b.w, height: b.h, parent: g.parent, title: titleBox(preset, geo, g.id, b, placed.titleAlign?.[g.id]) };
    }),
    edges: spec.edges.map((e) => ({ id: e.id, from: e.from, to: e.to, label: geo.edges[e.id].label || undefined })),
    direction: spec.direction || "LR",
  };
  const { routes, fallbacks } = routeEdges(input);
  return { routes, fallbacks };
}
