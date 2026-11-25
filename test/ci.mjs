// CI support for the test suites.
//   DIAGRAM_REQUIRE_CHROME=1   end-to-end suites fail instead of skipping when no Chrome-family browser is found
//   DIAGRAM_ARTIFACT_DIR=<dir> built fixture outputs are copied there, and golden/snapshot mismatches leave
//                              <name>.actual.json / <name>.expected.json evidence under <dir>/mismatch/
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** `skip` option for an end-to-end describe(): false when a browser is found, a reason when not; throws when required. */
export function e2eSkip(find, env = process.env) {
  try { find(); return false; } catch (e) {
    if (env.DIAGRAM_REQUIRE_CHROME === "1") throw new Error(`DIAGRAM_REQUIRE_CHROME=1 but the end-to-end tests cannot run: ${e.message}`);
    return "no Chrome-family browser found";
  }
}

/** Copies a build summary's .png/.svg/.excalidraw/.lint.json to <DIAGRAM_ARTIFACT_DIR>/<group>/<name>.*; null when unset. */
export async function exportOutputs(summary, group, name, env = process.env) {
  if (!env.DIAGRAM_ARTIFACT_DIR) return null;
  const dir = path.join(env.DIAGRAM_ARTIFACT_DIR, group);
  await mkdir(dir, { recursive: true });
  const base = summary.files.excalidraw.replace(/\.excalidraw$/, "");
  for (const ext of ["excalidraw", "png", "svg", "lint.json"]) await copyFile(`${base}.${ext}`, path.join(dir, `${name}.${ext}`));
  return dir;
}

/** Writes actual vs expected evidence to <DIAGRAM_ARTIFACT_DIR>/mismatch/<kind>/<name>; null when unset. */
export async function writeMismatch(kind, name, actual, expected, env = process.env) {
  if (!env.DIAGRAM_ARTIFACT_DIR) return null;
  const stem = path.join(env.DIAGRAM_ARTIFACT_DIR, "mismatch", kind, name.replace(/\.json$/, ""));
  await mkdir(path.dirname(stem), { recursive: true });
  await writeFile(`${stem}.actual.json`, actual);
  if (expected !== null) await writeFile(`${stem}.expected.json`, expected);
  return stem;
}
