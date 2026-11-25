// Default layout: the template grid placer plus the orthogonal router (reference architectures).
import { placeGrid } from "../place.mjs";
import { route } from "../route.mjs";

export default {
  name: "grid",
  validate() {},
  compose(spec, geo, preset) {
    const placed = placeGrid(spec, geo, preset);
    const routed = route(spec, geo, placed, preset);
    return { ...placed, ...routed, decor: [] };
  },
  check() { return { hard: [], warnings: [] }; },
};
