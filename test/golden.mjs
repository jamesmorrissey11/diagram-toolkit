// Exact scene goldens: every deterministic byte of an emitted scene (elements incl. embedded meta, appState, file hashes).
// A missing golden fails; write intentionally with: UPDATE_GOLDENS=1 npm test
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GOLD = path.join(path.dirname(fileURLToPath(import.meta.url)), "goldens");

export async function sceneGolden(name, scene) {
  const files = Object.fromEntries(Object.entries(scene.files || {}).map(([id, f]) => [id, createHash("sha256").update(f.dataURL).digest("hex")]));
  const canon = JSON.stringify({ elements: scene.elements, appState: scene.appState, files }, null, 1);
  const file = path.join(GOLD, name);
  if (process.env.UPDATE_GOLDENS) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, canon);
    return;
  }
  let golden;
  try { golden = await readFile(file, "utf8"); } catch { assert.fail(`missing golden test/goldens/${name}; create it intentionally with UPDATE_GOLDENS=1 npm test`); }
  assert.deepEqual(JSON.parse(canon), JSON.parse(golden), `scene changed for ${name} (refresh with UPDATE_GOLDENS=1 only if intended)`);
}
