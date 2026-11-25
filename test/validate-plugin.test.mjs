// Plugin manifest validation (scripts/validate-plugin.mjs). No browser needed.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { validatePlugin } = await import("../scripts/validate-plugin.mjs");

async function plugin() {
  const root = await mkdtemp(path.join(os.tmpdir(), "dt-plugin-"));
  const put = async (rel, text) => { await mkdir(path.dirname(path.join(root, rel)), { recursive: true }); await writeFile(path.join(root, rel), text); };
  await put("plugin.json", JSON.stringify({ name: "p", version: "1.2.0", skills: ["./skills/a", "./skills/b"], agents: "./agents/" }));
  await put("package.json", JSON.stringify({ name: "p", version: "1.2.0" }));
  await put("skills/a/SKILL.md", "---\nname: a\ndescription: Does a.\n---\n# A\nEngine: `node <base>/engine/cli.mjs`\n");
  await put("skills/a/engine/cli.mjs", "");
  await put("skills/b/SKILL.md", "---\nname: b\ndescription: Does b.\n---\nEngine: `node <this skill's base directory>/../a/engine/cli.mjs`\n");
  await put("agents/critic.agent.md", "---\nname: critic\ndescription: Reviews.\ntools: [\"view\"]\n---\nBody\n");
  return { root, put, json: async (rel, f) => { const p = path.join(root, rel); const o = JSON.parse(await readFile(p, "utf8")); f(o); await writeFile(p, JSON.stringify(o)); } };
}
const messages = (ps) => ps.map((p) => `${p.file}: ${p.message}`).join("\n");

describe("validate-plugin", () => {
  test("this repository's plugin is valid", async () => {
    assert.deepEqual(await validatePlugin(path.join(HERE, "..")), []);
  });
  test("a well-formed plugin has no problems", async () => {
    assert.deepEqual(await validatePlugin((await plugin()).root), []);
  });
  test("manifest field types and version mismatch", async () => {
    const p = await plugin();
    await p.json("plugin.json", (o) => { o.name = ""; o.version = 3; o.skills = "./skills/a"; o.agents = ["x"]; });
    const m = messages(await validatePlugin(p.root));
    for (const r of [/name must be a non-empty string/, /version must be a semver string/, /skills must be an array/, /agents must be a path string/]) assert.match(m, r);
    const q = await plugin();
    await q.json("package.json", (o) => { o.version = "1.3.0"; });
    assert.match(messages(await validatePlugin(q.root)), /package\.json: version 1\.3\.0 does not match plugin\.json version 1\.2\.0/);
  });
  test("skill problems: missing SKILL.md, name mismatch, empty description, unregistered skill", async () => {
    const p = await plugin();
    await p.put("skills/a/SKILL.md", "---\nname: alpha\ndescription:\n---\n");
    await rm(path.join(p.root, "skills/b/SKILL.md"));
    await p.put("skills/c/SKILL.md", "---\nname: c\ndescription: Orphan.\n---\n");
    const m = messages(await validatePlugin(p.root));
    assert.match(m, /skills\/a\/SKILL\.md: front-matter name "alpha" must equal the directory name "a"/);
    assert.match(m, /skills\/a\/SKILL\.md: description must be non-empty/);
    assert.match(m, /skills\/b: registered skill has no SKILL\.md/);
    assert.match(m, /skills\/c\/SKILL\.md: skill is not registered in plugin\.json skills/);
  });
  test("agent and shared-engine problems", async () => {
    const p = await plugin();
    await p.put("agents/bad.agent.md", "---\nname: bad\n---\n");
    await rm(path.join(p.root, "skills/a/engine/cli.mjs"));
    const m = messages(await validatePlugin(p.root));
    assert.match(m, /agents\/bad\.agent\.md: description must be non-empty/);
    assert.match(m, /skills\/b\/SKILL\.md: engine path \.\.\/a\/engine\/cli\.mjs does not exist/);
    const q = await plugin();
    await q.json("plugin.json", (o) => { o.agents = "./nope/"; });
    assert.match(messages(await validatePlugin(q.root)), /plugin\.json: agents path \.\/nope\/ does not exist/);
  });
});
