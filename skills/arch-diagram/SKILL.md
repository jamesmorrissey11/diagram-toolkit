---
name: arch-diagram
description: Generate or refine professional Excalidraw architecture diagrams (system, cloud, AI/ML, agent, RAG, pipeline, deployment) from a semantic spec, with automatic layout, official icons, rendering and lint. Use when asked to draw, create, update or polish an architecture/system diagram or an .excalidraw file, or to turn a description of a system into a diagram.
---

# Architecture diagrams

You write the **spec** (what exists and how it connects). The engine owns everything visual: layout, colours, fonts, sizes, icons, routing, rendering and lint. Your leverage is composition: which nodes exist, how they group, and the row/col hints that place them.

Engine: `node <this skill's base directory>/engine/cli.mjs <command>`. Node >= 22 and a local Chrome/Edge/Chromium; no npm install. `cli.mjs help` lists every command and exit code. If a command fails with exit 4, run `cli.mjs doctor` and relay its fix to the user.

## Steps

1. **Brief.** Settle the diagram's purpose and audience, where it will be shown (`displayWidth`: 1200 for a docs page or slide, ~900 for a blog column), and whether it is a draft or for publication. Ask only what would change the drawing, one question at a time with a recommended answer; state any assumption you made instead of asking. Done when you can name the diagram `type` and every node.

2. **Spec.** Write `<name>.json` where the diagram should live (default `docs/diagrams/`). Read [references/spec.md](references/spec.md) for the format and [references/compositions.md](references/compositions.md) for the composition family that fits, and copy its hint pattern. For every node that should carry an icon (reference and sketch presets), run `cli.mjs icons search "<product or concept>"` and use a returned ref; a vendor product with no vendor icon gets no icon or a generic concept icon, never another product's mark. Done when every node, group and edge has a stable id and every `icon` came from a search result.

3. **Build.** `cli.mjs build <spec.json> --json` (add `--publish` for publication output). It writes `<name>.excalidraw`, `.png` (2x), `.svg` and `.lint.json`, and prints the lint result. Exit 0 means every hard and readability gate passed.

4. **Fix gates.** On exit 1, act on `hard` and `warnings` by editing the spec: move nodes with row/col hints, regroup, shorten labels, or split one dense diagram into an overview plus a detail diagram. Rebuild. Done at exit 0. If the same defect survives two different fixes, stop and report it.

5. **Visual review.** Dispatch the `diagram-toolkit:diagram-critic` agent in a fresh context with the PNG path, the spec path, the brief and `displayWidth` (and the previous PNG when comparing). If no subagent is available, `view` the PNG yourself against the same rubric. Apply the critic's spec-level actions and rebuild. At most 3 review rounds; keep the best version (restore its spec if a round made things worse).

6. **Deliver.** Report the `.excalidraw`, `.png` and `.svg` paths, `imgcat <png>` for viewing, the preset and why, assumptions, and any remaining warnings or placeholder icons, plainly.

## Presets

Three frozen presets; you choose one, never individual styling. `cli.mjs presets` prints the decision table.

| Preset | Use for |
|---|---|
| `reference` | formal reference architectures with official icons, tinted tiers, numbered request steps |
| `concept` | simple concept or pattern diagrams of 9 nodes or fewer, role-coloured, no icons |
| `sketch` | informal whiteboard look, hand-drawn font, icon-only nodes |

Precedence: the user's explicit request (pass `--preset`), then the preset already stored in the spec, then the `type` default. The resolved preset is written into the spec, so refinements keep the same look. Switch presets only when the user asks.

## Refining an existing diagram

Edit the spec, never the `.excalidraw`. If only the `.excalidraw` exists, `cli.mjs spec <file>` prints its embedded spec. Keep ids stable so unchanged parts stay put. Exit 3 means the user hand-edited the file in Excalidraw since it was generated: ask whether to overwrite their edits (`--force`) or write a new file (`--out <new-name>`).
