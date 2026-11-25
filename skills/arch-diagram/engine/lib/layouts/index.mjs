// Layout registry. A layout owns placement and edge paths for one composition family:
//   validate(spec, bad)          extra spec rules (call bad(msg) per problem)
//   compose(spec, geo, preset)   -> { nodes, groups, titleAlign, routes, fallbacks, decor }
//   check(spec, laid, scene)     -> { hard: [], warnings: [] } layout-intent lint
//   aspect?: [min, max]          readability window overriding the preset's aspectMax
//   maxNodes?: number            node cap (grid keeps the concept preset's cap)
import grid from "./grid.mjs";

export const LAYOUTS = { grid };
export const LAYOUT_NAMES = () => Object.keys(LAYOUTS);
export const layoutFor = (spec) => LAYOUTS[spec.layout || "grid"];
