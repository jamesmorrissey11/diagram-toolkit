// Scene metadata: the resolved spec is embedded in the scene so a .excalidraw file is self-describing, and a
// scene hash detects hand edits made in the Excalidraw editor before the toolkit regenerates over them.
import { createHash } from "node:crypto";

export const META_KEY = "diagramToolkit";
const r = (v) => (typeof v === "number" ? Math.round(v) : v);

export function sceneHash(elements) {
  const canon = elements
    .filter((e) => !e.isDeleted)
    .map((e) => [e.id, e.type, r(e.x), r(e.y), r(e.width), r(e.height), e.text ?? null, e.strokeColor, e.backgroundColor, e.fileId ?? null,
      e.points ? e.points.map((p) => p.map(r)) : null])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return createHash("sha256").update(JSON.stringify(canon)).digest("hex").slice(0, 16);
}

export const specHash = (spec) => createHash("sha256").update(JSON.stringify(spec)).digest("hex").slice(0, 16);

export function embedMeta(scene, spec, extra = {}) {
  const meta = { version: 1, spec, specHash: specHash(spec), sceneHash: sceneHash(scene.elements), ...extra };
  scene.elements[0].customData = { ...(scene.elements[0].customData || {}), [META_KEY]: meta };
  return meta;
}

export function readMeta(scene) {
  for (const e of scene.elements || []) if (e.customData?.[META_KEY]) return e.customData[META_KEY];
  return null;
}

/** "clean" | "edited" | "foreign" (not made by the toolkit) for an existing scene on disk. */
export function editState(scene) {
  const meta = readMeta(scene);
  if (!meta) return { state: "foreign" };
  const now = sceneHash(scene.elements);
  return { state: now === meta.sceneHash ? "clean" : "edited", meta };
}
