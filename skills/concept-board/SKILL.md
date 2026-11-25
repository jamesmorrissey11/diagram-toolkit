---
name: concept-board
description: Generate or refine simple card and concept visuals as editable Excalidraw boards from a semantic spec - capability or category cards, concept and summary cards for notes, comparisons, numbered steps, and brainstorm boards (brainwriting, affinity groups, sticky notes) - in a clean or hand-drawn look, with layout, rendering and readability lint. Use when asked for a card grid, categories visual, concept or summary card, notes visual, sticky-note or brainstorm board, or to turn a list of ideas or categories into a visual. For architecture or system diagrams with connected components, use arch-diagram instead.
---

# Concept boards

You write the **spec** (sections and what they say). The engine owns everything visual: grid, wrapping, colours, fonts, card and sticky-note styling, rendering and lint. Your leverage is content: tight wording, a sensible section order, the right number of columns.

Engine (shared with arch-diagram): `node <this skill's base directory>/../arch-diagram/engine/cli.mjs <command>`. Node >= 22 and a local Chrome/Edge/Chromium; no npm install. If a command fails with exit 4, run `cli.mjs doctor` and relay its fix to the user.

## Steps

1. **Brief.** Settle what the visual explains, who reads it, and where it is shown (`displayWidth`: 800 for the Roam main column, the default). Pick the look: `clean` for reference cards, categories and summaries; `sketch` for brainstorms and whiteboard feel. Ask only what would change the drawing, one question at a time with a recommended answer; otherwise state your assumption. Done when you can name every section.

2. **Spec.** Write `<name>.json` with `"kind": "board"` where the visual should live (the user's choice; default `docs/diagrams/`). Read [references/board-spec.md](references/board-spec.md) and start from the closest example in [references/examples/](references/examples/). Fill every section with real content: never blank "Notes" areas or space to write in. Keep text short: a one-sentence summary, ` · `-separated lists in fields, one takeaway. Done when every section has a stable id and content.

3. **Build.** `cli.mjs build <spec.json> --json`. It writes `<name>.excalidraw` (spec embedded), `.png` (2x), `.svg` and `.lint.json`. Exit 0 means every hard and readability gate passed.

4. **Fix gates.** On exit 1, edit the spec, never `displayWidth`: use fewer `columns` (the warning names how many fit), shorten or split long text, move content between sections, or split the board in two. Rebuild. Done at exit 0. If the same defect survives two different fixes, stop and report it.

5. **Visual review.** Render the review image at the real display size: `cli.mjs render <name>.excalidraw --out <tmp>/<name>.review --width <displayWidth>`. Dispatch the `diagram-toolkit:diagram-critic` agent in a fresh context with that review PNG, the spec path, the brief and `displayWidth` (and the previous review PNG when comparing). If no subagent is available, `view` the review PNG yourself against the board rubric in the critic. Apply its spec-level actions and rebuild. At most 3 rounds; keep the best version.

6. **Deliver.** Report the `.excalidraw`, `.png` and `.svg` paths, `imgcat <png>` for viewing, the look and why, assumptions, and any remaining warnings, plainly.

## Looks

| Preset | Use for |
|---|---|
| `clean` | reference cards, categories, comparisons, summaries: sans-serif, dark outlines, coloured header bars, optional numbered headers |
| `sketch` | brainstorms and informal notes: hand-drawn font and strokes, tone-underlined headings, pale sticky notes, a dotted grid when every section is sticky notes |

Precedence: the user's explicit request (`--preset clean|sketch`), then the preset stored in the spec, then the `type` default, then `clean`. The resolved preset is written into the spec, so refinements keep the same look.

## Choosing columns

- 1 column: ordered steps or rows read top to bottom.
- 2 columns: 2 or 4 parallel categories (the default for those counts).
- 3 columns: 3, 5, 6 or 9 sections of short content, or sticky-note sections.

## Refining an existing board

Edit the spec, never the `.excalidraw`. If only the `.excalidraw` exists, `cli.mjs spec <file>` prints its embedded spec. Keep ids stable. Exit 3 means the user hand-edited the file in Excalidraw since it was generated: ask whether to overwrite their edits (`--force`) or write a new file (`--out <new-name>`).
