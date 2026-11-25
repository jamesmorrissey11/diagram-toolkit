// Layout registry. A layout owns placement and edge paths for one composition family:
//   validate(spec, bad)          extra spec rules (call bad(msg) per problem)
//   compose(spec, geo, preset)   -> { nodes, groups, titleAlign, routes, fallbacks, decor }
//   texts?(spec, preset)        extra [text, size] pairs the layout draws (lane headers, axis ticks...)
//   normalize?(spec)             fill implied structure (e.g. a cycle's consecutive edges) after validation
//   check(spec, scene)           -> { hard: [], warnings: [] } layout-intent lint on the emitted scene
//   aspect?: [min, max]          readability window overriding the preset's aspectMax
//   maxNodes?: number            node cap (grid keeps the concept preset's cap)
import grid from "./grid.mjs";
import cycle from "./cycle.mjs";
import lanes from "./lanes.mjs";
import hub from "./hub.mjs";

export const LAYOUTS = { grid, cycle, lanes, hub };
export const LAYOUT_NAMES = () => Object.keys(LAYOUTS);
export const layoutFor = (spec) => LAYOUTS[spec.layout || "grid"];
