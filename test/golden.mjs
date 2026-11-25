// Scene goldens for every deterministic part of an emitted scene (elements incl. embedded meta, appState, file hashes).
// Structure, ids and order, text and wrapping, styles, bindings and the embedded spec must match exactly. Two allowances
// absorb measured macOS-vs-Linux drift (see compareScenes); everything else is exact.
// A missing golden fails; write intentionally with: UPDATE_GOLDENS=1 npm test
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeMismatch } from "./ci.mjs";

const GOLD = path.join(path.dirname(fileURLToPath(import.meta.url)), "goldens");

// Geometry keys compared within GEOMETRY_TOLERANCE px: Chrome's text measurement differs by up to 1px across platforms and
// versions (e.g. an edge label 58 vs 59px wide), which moves the boxes sized from it. sceneHash is a hash of that geometry.
export const GEOMETRY_TOLERANCE = 1;
const GEOMETRY = new Set(["x", "y", "width", "height", "w", "h"]);
const DERIVED = new Set(["sceneHash"]);
// Non-geometry floats are rounded to 9 decimals: libm differs in the last bit across platforms (e.g. pill outline points).
const round9 = (v) => Math.round(v * 1e9) / 1e9;

/** Differences between an actual and expected scene as path strings; [] when they match under the rules above. */
export function compareScenes(actual, expected) {
  const out = [];
  const walk = (a, e, p, geom) => {
    if (out.length >= 20) return;
    if (typeof a === "number" && typeof e === "number") {
      const ok = geom ? Math.abs(a - e) <= GEOMETRY_TOLERANCE + 1e-9 : round9(a) === round9(e);
      if (!ok) out.push(`${p}: ${e} -> ${a}`);
      return;
    }
    if (Array.isArray(a) && Array.isArray(e)) {
      if (a.length !== e.length) return out.push(`${p}: length ${e.length} -> ${a.length}`);
      a.forEach((x, i) => walk(x, e[i], `${p}[${i}]`, geom));
      return;
    }
    if (a && e && typeof a === "object" && typeof e === "object" && !Array.isArray(a) && !Array.isArray(e)) {
      for (const k of new Set([...Object.keys(a), ...Object.keys(e)])) {
        if (!(k in a) || !(k in e)) { out.push(`${p}.${k}: ${k in e ? "removed" : "added"}`); continue; }
        if (DERIVED.has(k)) continue;
        walk(a[k], e[k], `${p}.${k}`, geom || k === "points" || (GEOMETRY.has(k) && typeof a[k] === "number"));
      }
      return;
    }
    if (a !== e) out.push(`${p}: ${JSON.stringify(e)?.slice(0, 60)} -> ${JSON.stringify(a)?.slice(0, 60)}`);
  };
  walk(actual, expected, "scene", false);
  return out;
}

export async function sceneGolden(name, scene, { goldDir = GOLD } = {}) {
  const files = Object.fromEntries(Object.entries(scene.files || {}).map(([id, f]) => [id, createHash("sha256").update(f.dataURL).digest("hex")]));
  const canon = JSON.stringify({ elements: scene.elements, appState: scene.appState, files }, null, 1);
  const file = path.join(goldDir, name);
  if (process.env.UPDATE_GOLDENS) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, canon);
    return;
  }
  let golden;
  try { golden = await readFile(file, "utf8"); } catch {
    await writeMismatch("goldens", name, canon, null);
    assert.fail(`missing golden test/goldens/${name}; create it intentionally with UPDATE_GOLDENS=1 npm test`);
  }
  const diffs = compareScenes(JSON.parse(canon), JSON.parse(golden));
  if (diffs.length) {
    await writeMismatch("goldens", name, canon, golden);
    assert.fail(`scene changed for ${name} (refresh with UPDATE_GOLDENS=1 only if intended):\n  ${diffs.join("\n  ")}`);
  }
}
