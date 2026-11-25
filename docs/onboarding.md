# diagram-toolkit v0.2: onboarding

diagram-toolkit turns a plain-language request into a polished, **editable** Excalidraw diagram. Copilot writes a small JSON "spec" describing what's in the diagram. The engine owns everything visual: layout, colours, fonts, wrapping, rendering, and the quality checks.

**Install:**

```bash
copilot plugin install jamesmorrissey11/diagram-toolkit
copilot plugin list     # shows diagram-toolkit (v0.2.0); if it's marked [disabled], run: copilot plugin enable diagram-toolkit
```

New Copilot sessions load both skills automatically. You need Node.js 22 or newer and a local Chrome, Edge, Chromium or Brave (see the [README](../README.md#install)).

---

## 1. Pick the skill (or just ask, and Copilot picks)

| You want… | Skill | Example request |
|---|---|---|
| Boxes and arrows: system, cloud, RAG, agent loop, pipeline, deployment | **`arch-diagram`** | "Draw the architecture of our RAG service on Azure, reference preset." |
| Cards, categories, summaries, comparisons, numbered steps, sticky-note brainstorms | **`concept-board`** (new in v0.2) | "Make a clean card board of the 4 Copilot capability categories." |

Rule of thumb: **if the arrows matter, use `arch-diagram`. If the text matters, use `concept-board`.**

To force one, name it: "Use concept-board to…" or "Use arch-diagram to…".

## 2. Pick the look

**arch-diagram presets**

| Preset | Looks like | Use for |
|---|---|---|
| `reference` | White cards, official cloud icons, tinted tiers, numbered request steps | Formal reference architectures |
| `concept` | Pastel role-coloured shapes, pills for inputs/outputs, no icons | Simple patterns, 9 nodes or fewer (enforced) |
| `sketch` | Hand-drawn font, icon-only nodes, pale zones | Informal whiteboard look |

**concept-board looks**

| Look | Looks like | Use for |
|---|---|---|
| `clean` (default) | Sans-serif, dark outlines, coloured header bars, optional numbered headers | Reference cards, categories, summaries, comparisons |
| `sketch` | Hand-drawn font and strokes, pale sticky notes, and a dotted grid when every section is sticky notes | Brainstorms, brainwriting, informal notes |

Once a diagram is built, its look is saved in the spec, so refinements never restyle it unless you ask.

## 3. What to say in a request

A good request names three things. Copilot asks only if something would change the drawing.

1. **What it explains:** the actual content, pasted or summarised.
2. **The look:** clean or sketch for boards; reference, concept or sketch for architecture.
3. **Where it's shown.** Boards default to **800px**, the Roam main column. Architecture diagrams default to 1200px (docs page or slide). Say "for a blog column" (~900px) if that's where it goes.

Optional extras:
- the column count for boards: 1 gives stacked rows, 2 suits 2 or 4 categories, and 3 suits 3, 5, 6 or 9 sections or sticky notes (these are also the defaults for those section counts);
- numbered headers;
- where to save it.

**Example prompts**

- "concept-board, clean, 2 columns, numbered: the four Copilot capability categories from this screenshot."
- "Sketch brainwriting board: ideas from Alex, Sam and Priya (3 sticky notes each) on what to build next."
- "Stacked rows, clean: the 4 steps of our release process with an owner field on each."
- "arch-diagram, concept preset: an agent loop with an orchestrator, tools, memory and an evaluator."

## 4. What you get

Every build writes four files next to the spec, or at the `--out` path:

- `<name>.excalidraw`: **editable** in Excalidraw or on excalidraw.com, with the spec embedded inside it.
- `<name>.png` (2×) and `<name>.svg`: for notes, docs and slides.
- `<name>.lint.json`: the quality-check results.

**Checks on every build:**

- **Both kinds:**
  - nothing dropped;
  - no overlapping text;
  - only the preset's colours, fonts and sizes;
  - **text renders at 11px or larger at the display width**.
- **Architecture diagrams:**
  - no overlapping nodes;
  - no edges through nodes and no detached arrows;
  - an aspect-ratio limit once there are 5 nodes or more;
  - in `--publish` builds, no unresolved icons.
- **Boards:**
  - no overlapping sections or sticky notes;
  - text stays inside its card or note;
  - at most 14 lines per section.

When a build fails a check, Copilot edits the spec and rebuilds. It might use fewer columns, shorter text, moved nodes, or a split into two diagrams. If the same defect survives two different fixes, it stops and tells you. Copilot then has the `diagram-critic` agent review the rendered image as it will look at its display width, for up to 3 rounds.

## 5. Refining

- Ask in chat, for example "use 3 columns", "shorten card 2" or "drop the telemetry edge".
- Copilot edits the spec, never the drawing, and rebuilds. Ids stay stable, so unchanged parts stay put. If only the `.excalidraw` file is left, Copilot recovers the spec from inside it.
- **Hand edits are protected.** If you edit a generated file in Excalidraw, the next rebuild stops (exit code 3) and asks whether to overwrite your edits or write a new file.

> Optional, in the GitHub Copilot app: if your workspace has an Excalidraw canvas such as the Excalidraw Workbench, you can open the `.excalidraw` file there and leave comments on the drawing for Copilot to act on.

## 6. Limits in v0.2 (boards)

- Boards are **grid only**: 1 to 3 columns, 12 sections or fewer, and 8 sticky notes or fewer per section.
- Not supported yet, and rejected with a clear error: radial (hub) and ranked-row arrangements, links between cards, icons, rank badges, and emoji in board text. Ordinary symbols such as `→`, `·` and `©` are fine.
- Board text budgets:
  - title: 40 characters or fewer; subtitle: 80 or fewer;
  - section title: 32 or fewer;
  - summary, field text and takeaway: 120 or fewer each, with up to 4 fields per section (field labels 24 or fewer);
  - sticky notes: 40 or fewer.
- The engine never shrinks text to make content fit. If a board needs smaller text than 11px or more than 14 lines in a section, the readability check fails and names the fix: fewer columns, shorter text, or splitting into two boards.

## 7. Where files go

- By default, Copilot saves diagrams in `docs/diagrams/` of the current repository, or wherever you tell it to.
- No blank "Notes" areas: diagrams sit alongside your separate notes and carry real content.

## 8. Running the engine by hand (optional)

The engine lives at `skills/arch-diagram/engine/cli.mjs`, inside the installed plugin or in a checkout of this repo. Both skills use it.

```bash
# installed plugin (works for direct and marketplace installs):
E=$(ls ~/.copilot/installed-plugins/*/*diagram-toolkit*/skills/arch-diagram/engine/cli.mjs | head -1)
# or, from a checkout of this repo:
E=skills/arch-diagram/engine/cli.mjs

node "$E" doctor                       # check Node, Chrome, vendored assets, icons and a test render
node "$E" build my-board.json --json   # spec -> .excalidraw/.png/.svg/.lint.json
node "$E" spec my-board.excalidraw     # recover the embedded spec
node "$E" presets                      # list presets, type defaults, board tones
node "$E" help                         # every command, including lint, render and icons
```

Exit codes:

| Code | Meaning |
|---|---|
| 0 | ok |
| 1 | built, but a quality gate failed |
| 2 | invalid spec |
| 3 | hand edits detected |
| 4 | environment problem; run `doctor` |
| 5 | internal error |

Minimal board spec to start from:

```json
{
  "kind": "board",
  "title": "My topic",
  "preset": "clean",
  "columns": 2,
  "sections": [
    { "id": "a", "title": "First idea", "summary": "One sentence.", "takeaway": "What it means." },
    { "id": "b", "title": "Ideas", "items": [{ "id": "b1", "text": "sticky note" }] }
  ]
}
```

More examples: [`skills/concept-board/references/examples/`](../skills/concept-board/references/examples/) and [`skills/arch-diagram/references/examples/`](../skills/arch-diagram/references/examples/). The full formats are in [`board-spec.md`](../skills/concept-board/references/board-spec.md) and [`spec.md`](../skills/arch-diagram/references/spec.md).

## 9. Behind the scenes

- **Repo:** [jamesmorrissey11/diagram-toolkit](https://github.com/jamesmorrissey11/diagram-toolkit). Boards landed in [PR #1](https://github.com/jamesmorrissey11/diagram-toolkit/pull/1) and CI in [PR #2](https://github.com/jamesmorrissey11/diagram-toolkit/pull/2).
- **CI:** every PR runs, in headless Chrome:
  - the full test suite;
  - plugin and skill validation;
  - an installed-path smoke test.

  It uploads a `rendered-diagrams` artifact. `main` requires the `test` check, and branches are deleted on merge. See [CI](../README.md#ci).
- **Updating:** run `copilot plugin update diagram-toolkit` after new versions merge.
