# Why concept, loop and workflow visuals fall short of the architecture diagrams, and what to do about it

Research date: 2026-11-25. Repository: `jamesmorrissey11/diagram-toolkit` v0.3.0 (worktree `jamesmorrissey11-codex-agent-loop`).
Companion report (external prior art, full citations): [`prior-art-concept-diagrams.md`](prior-art-concept-diagrams.md).
Spike artifacts: `research/spike/` (script, `.excalidraw`, PNG, SVG).

---

## TL;DR

- **Extend the toolkit.** Don't switch tools. The renderer, fonts, presets, lint, critic loop and editable `.excalidraw` output are all sound.
- **The gap is that it has one composition model, built for one diagram family.** Every diagram goes through a row/col grid placer and an orthogonal (elbow) router. The spec only describes boxes, groups and arrows. That fits reference architectures exactly, which is why those look top-class. Loops, workflows, surface maps and capability visuals need a different *geometry* (rings, lanes, bands, matrices) and *annotation* (title, subtitle, callouts, badges, legend, source line). The engine can't express either today.
- **Evidence the fix works:** a throwaway 119-line spike reused the toolkit's own headless renderer. It produced a real circular loop with curved arrows, a hub, numbered badges, a title and subtitle, and "why it works" callout cards. It is a step change over the engine's grid output for the same content (§3).
- **What to build:** an **archetype layer** (`cycle`, `hub`, `flow/swimlane`, `stack`, `matrix`). Each archetype is a deterministic composer that owns its geometry, and all share one **annotation vocabulary** and the existing emit, render, lint and critic. Add per-archetype lint and critic rubrics, plus a small golden gallery that sets the bar.
- **For urgent needs right now:** have Copilot write per-visual composer scripts in the spike's style (deterministic, editable, rendered by the toolkit's studio), then fold the good ones into archetypes.

---

## 1. Root causes (from the code)

### 1.1 One layout model for every diagram type
- Placement is a grid for every container. From `skills/arch-diagram/engine/lib/place.mjs:1-4`: "Template-grid placement: every container (root + groups) lays its children out on a row/col grid… A straighten pass then uses cell slack to align connected nodes."
- Routing is OpenDiagram's orthogonal router for every edge (`lib/route.mjs:2,26`). Every arrow is emitted as an elbow arrow (`lib/emit.mjs:86`, `elbowed: true`).
- **Consequence:** a 6-step loop can only become a 2×3 or 3×3 grid with right-angle arrows. This session's Codex diagram shows it (`docs/diagrams/codex-agent-loop.png`). It is correct and lint-clean, but it reads as a rectangle of boxes, not a cycle. The repo's own `docs/gallery/agent-loop.png` shows the same limit: the feedback and observation edges merge into an awkward dashed spine.
- Excalidraw does not cause this. Arrows support multi-point curved paths (`roundness`, non-elbowed). This is verified in the Excalidraw source (companion §1.7) and empirically by the spike (§3).

### 1.2 The spec vocabulary is architecture-only
`lib/spec.mjs` accepts only `groups` (boundary/tier), `nodes` (label, sub, icon, role) and `edges` (label, kind, step). It has none of the things explanatory visuals depend on:

| Needed for concept, loop and workflow visuals | Status in engine |
|---|---|
| Title + subtitle/takeaway + source footer | Concept preset has `"title": false` (`presets/concept.json:127`); no subtitle or footer fields exist |
| Annotations/callouts ("why it works", benefits, notes) | Not in the schema |
| Numbered step badges on nodes | Only `edge.step`, and only the reference preset defines `steps` (`presets/reference.json:104`) |
| Legend (what solid/dashed/colours mean) | Not in the schema |
| Ring/radial, lanes, bands, matrix cells | Not expressible; only row/col hints |
| Self-loops and "repeat" semantics | Rejected: "self-loops are not supported" (`lib/spec.mjs:86`) |
| More than 9 concept nodes | Hard cap `CONCEPT_MAX_NODES = 9` (`lib/spec.mjs:17`) |

### 1.3 The concept preset silently drops explanatory text
`lib/geometry.mjs:38`: `showSub = !!n.sub && st.kind !== "box" && st.kind !== "pill"`. Concept nodes are boxes or pills, so **every `sub` line is discarded**. This session's Codex diagram supplied subtitles ("Repo, docs, worktrees", "Tests / build / lint"). None rendered, and neither the lint nor the critic flagged it. Concept diagrams have no way to carry explanation, which is the point of a concept visual. This is a straightforward bug to fix, or at minimum it should produce a lint warning.

### 1.4 Quality gates are tuned to architecture
- `lib/lint.mjs` checks overlaps, detached arrows, crossings, aspect and empty area. All are graph-hygiene metrics. Nothing checks archetype intent: does the loop read as a cycle, is the order clockwise, is there a takeaway, did all supplied text render?
- The critic is framed as "a design reviewer for architecture diagrams" (`agents/diagram-critic.agent.md:7`). Its actions are limited to spec edits (`move`, `regroup`, `relabel`…), so it cannot ask for "make this a ring" or "add a callout".

### 1.5 The reference preset's quality comes from architecture-specific assets
Official icons, tinted tiers, uniform cards, numbered request steps and a title (`presets/reference.json`; gallery `docs/gallery/azure-rag.png`). Concept visuals have no equivalent assets: no shape vocabulary per role beyond pill or box, no badges, no callouts. So "top class" is reachable for one family only.

### 1.6 History: what was already tried
- **v0.2 concept boards** (commits `66b0177`, `bcdd647`, `9d7a8bd`) were card and sticky-note grids. The user rejected them ("I hate how this looks", session `31327693`) and they were removed in `7b488dc` (v0.3.0). Recovered renders: `research/old-gallery/capability-categories.png`. These are text-heavy cards in a 2×2 grid, the same "grid of boxes" problem in a different style.
- **User preference on record** (session `46ac6c0f`): "for excalidraw drawings, the rough and simple style of them and their clarity are their benefits."
- **Obsidian templates** (`~/Documents/Obsidian Vault/Drawings/Templates/*.excalidraw`, rendered to `research/templates/`) are placeholder layouts. `copilot-cli-feature-map` renders with a fallback serif font under the toolkit's renderer, so these are not a quality baseline either.

**Takeaway:** each attempt changed *style*. None changed *composition*. The architecture diagrams succeed because their composition, a grid with tiers plus a request path, matches the content's shape.

---

## 2. What the best concept visuals do (external evidence)

Full citations are in the companion report. Highlights:

- **Anthropic, "Building effective agents"**: a loop drawn as two opposing curved arcs ("Action"/"Feedback") between an LLM box and an Environment pill. Shape signals role (pill = external, rectangle = LLM), with tint fills, same-hue strokes, neutral grey arrows and lots of whitespace (companion §2.1).
- **OpenAI, "Unrolling the Codex agent loop"**: a vertical flowchart with a flowchart shape vocabulary (stadium, predefined-process), **solid vs dotted lines for inner vs cross-turn loops**, a restrained palette, and a title block. It is boxy, but publication-grade, because shapes and line styles carry meaning (companion §2.1).
- **Guidance:** self-describing diagrams (title, legend, labelled relationships) per the C4 notation; Azure Well-Architected diagramming (directional arrows, "label everything", consistent line types, metadata); Gestalt proximity for surface and capability groupings (NN/g); progressive disclosure, meaning a hero diagram plus drill-downs (companion §3).
- **AI diagram research (2024–2026):** the consistent pattern is *plan → deterministic layout → render → check agent*, with editable output (DiagramAgent, DiagrammerGPT, SciFig). In-context examples measurably improve quality, which supports a golden exemplar gallery (companion §4).

---

## 3. Spike: same renderer, archetype geometry

`research/spike/cycle-spike.mjs` (119 lines; throwaway) emits an Excalidraw scene directly and renders it with the toolkit's `openStudio()` (`lib/studio.mjs`). It uses the Nunito font, so the measurement is the same as production.

- Places 6 steps on an ellipse (`x = cx + rx·cosθ`), each with a numbered badge, label and sub-line.
- Draws curved arrows between consecutive steps as 3-point non-elbowed arrows with `roundness: {type: 2}`, clipped to node boxes. They rendered smoothly, which resolves the companion report's open question about Excalidraw curve fidelity.
- Adds a hub ellipse ("Codex agent: model + harness, drives every turn"), a title and subtitle, a "WHY THE LOOP WORKS" callout column (Real feedback / Externalized state / Steerability) with step-reference chips, and a source footer.

Result: `research/spike/codex-loop-cycle.png`. It reads as a loop at a glance, carries the explanation, and stays editable. Compare it with `docs/diagrams/codex-agent-loop.png` from the current engine.

Spike limitations that the production version would fix:
- Arrows aren't bound to nodes.
- Text centring is approximate.
- Callout cards have uneven bottom padding.
- It has no lint.

---

## 4. Options assessed

| Option | Fit for loops, workflows, surface maps, capabilities | Editable `.excalidraw` | Verdict |
|---|---|---|---|
| **Extend toolkit with archetypes + annotation layer** | High: geometry chosen per content shape | Yes | **Recommended** |
| elkjs (layered, SPLINES, ports) inside the toolkit | Good for swimlanes and port-heavy flows; radial needs a tree, so not loops | Yes (you map output) | Optional later, for `flow`/`swimlane` only; EPL-2.0 review |
| Graphviz circo/twopi via WASM | Ring and radial placement only | No (own conversion) | Not worth it; the trigonometry is trivial |
| Mermaid/Pele → `mermaid-to-excalidraw` | Flowchart, swimlane and sequence editable; mindmap, architecture and block come back as **images** | Partial | Drafts only |
| D2 | Grids, legends via `near`; TALA archived | No | No |
| Napkin.ai / Eraser | Fast and attractive, but not reproducible or precise | No | Ideation only |
| FigJam plugin | Curved connectors native | In Figma only | Only if Figma becomes the target |

---

## 5. Recommendation: what to build

### 5.1 Architecture of the change
Keep `spec → measure → place → route → emit → lint → render`. Add a **layout dispatch** keyed by a new `layout` field (default `grid`, today's behaviour):

```
spec.layout = grid | cycle | hub | flow | stack | matrix
         └─> composer(spec, geo, preset) -> { nodes, groups, edges(with explicit points/curved), annotations }
```

- `grid` keeps the existing placer and router untouched, so reference architectures and their goldens don't change.
- New composers return node boxes plus **explicit edge paths** (curved or straight), bypassing the orthogonal router where the archetype owns routing.
- `emit.mjs` gains: non-elbowed curved arrows bound to nodes; badges on nodes; callout cards; legend; title, subtitle and footer for every preset.

### 5.2 Archetypes mapped to the stated needs

| Need | Archetype | Composition rules (deterministic) |
|---|---|---|
| Loops (agent loop, OODA, build/test/repair) | **`cycle`** | N steps on an ellipse, clockwise from 12 o'clock, curved arcs, optional hub at the centre, a "repeat" label on the closing arc, callout column on the side with the most room. 3–8 steps |
| Workflows | **`flow`** (+ `lanes`) | Phases as columns, actors as swimlanes, decision diamonds, solid = main path, dashed = exception/retry (OpenAI convention). Optional elkjs later |
| Copilot surface relationships | **`hub`** | Centre = platform/agent; ring or top band = surfaces (app, CLI, IDEs, GitHub.com/cloud, code review); bottom band = shared capabilities (instructions, skills, MCP, custom agents, memory, Spaces); containment edge "app built on CLI" |
| Capabilities | **`stack`** and **`matrix`** | Stack: layered bands (e.g. assistive → agentic → customizations → external). Matrix: surface × capability cells with ✓ / P / ✗ glyphs, from the docs cheat sheet (companion §5.3) |

### 5.3 Shared annotation vocabulary (spec fields; preset owns the styling)

```json
{
  "title": "Why Codex can stay coherent on long tasks",
  "subtitle": "Long-running work is a loop, not one giant prompt.",
  "source": "OpenAI, “Run long horizon tasks with Codex”",
  "layout": "cycle",
  "hub": { "label": "Codex agent", "sub": "model + harness" },
  "nodes": [{ "id": "plan", "label": "Plan", "sub": "Pick the next milestone", "badge": 1 }],
  "callouts": [{ "id": "fb", "title": "Real feedback", "text": "Errors, diffs and logs…", "refs": ["tools", "observe"], "tone": "red" }],
  "legend": [{ "kind": "optional", "meaning": "human steering" }]
}
```

### 5.4 Quality gates per archetype
- **Lint (hard):** every supplied text renders (catches the `sub` drop in §1.3); no arc crosses a node; badges are in sequence order; callout refs resolve; title present when `publish`.
- **Lint (readability):** existing ≥11px at `displayWidth` and an aspect check, plus a per-archetype aspect window (a cycle wants about 1.3–1.8).
- **Critic:** add archetype-specific rubric items, e.g. "cycle: reads as a loop at a glance; start is obvious; direction is consistent". Add actions `change-layout`, `add-callout` and `promote-to-hub`, and drop the "architecture diagrams" framing.
- **Golden gallery:** one exemplar per archetype × preset, used both as test goldens and as in-context examples for the authoring skill (supported by the in-context-learning finding, companion §4).

### 5.5 Quick wins (hours, not days)
1. Render `sub` in concept boxes/pills, or warn when it is dropped (`geometry.mjs:38`).
2. Enable title, subtitle and footer in the concept preset.
3. Add node badges (`badge: n`) to the concept and sketch presets.
4. Fix the font fallback when rendering non-toolkit `.excalidraw` files (seen with `copilot-cli-feature-map`). **(Assumption:** it uses an Excalidraw font family that isn't vendored.)

### 5.6 Sequencing for an urgent need
1. **Now:** for each urgent visual, have Copilot write a spike-style composer (like `cycle-spike.mjs`), render it with the studio, and run the critic. This is acceptable as throwaway, and the output stays editable Excalidraw.
2. **Next (≈1–2 days):** add `cycle` + `hub` archetypes and the annotation vocabulary, with tests and goldens. These cover loops and Copilot surface maps.
3. **Then:** add `stack`, `matrix` and `flow/lanes`, archetype critic rubrics, and gallery exemplars. Consider elkjs only if swimlane flows outgrow a fixed lane composer.
4. **Skill:** extend `arch-diagram` with a "pick the archetype" step, or add a sibling `concept-diagram` skill on the same engine. Content should choose the archetype, not the preset.

---

## 6. Assumptions and uncertainties
- "Top class" is judged by this session's renders (`azure-rag.png` vs `agent-loop.png`, `codex-agent-loop.png`) and the user's earlier rejection of boards. No formal user study.
- The spike is one archetype. `hub`, `stack`, `matrix` and `flow` were not prototyped. Their cost estimates are inference from the spike's size.
- External claims (ELK radial bundling in elkjs, mermaid-to-excalidraw coverage of Gantt/timeline, Copilot docs churn) carry the uncertainties listed in companion §7.
- Copilot surface and capability facts change quickly (Oct 2026 "Copilot in the cloud" transition). Re-check docs.github.com before publishing a surface map.

## 7. Key sources
- Local: `skills/arch-diagram/engine/lib/{place,route,emit,geometry,spec,lint}.mjs`, `presets/*.json`, `agents/diagram-critic.agent.md`, git commits `66b0177`, `7b488dc`; sessions `31327693`, `46ac6c0f`, `38feb48d` (local session store).
- External (see companion for the full list): https://www.anthropic.com/research/building-effective-agents · https://openai.com/index/unrolling-the-codex-agent-loop/ · https://developers.openai.com/blog/run-long-horizon-tasks-with-codex · https://plus.excalidraw.com/docs/mermaid-to-excalidraw/supported-diagrams · https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-radial.html · https://graphviz.org/docs/layouts/circo/ · https://c4model.com/diagrams/notation · https://learn.microsoft.com/en-us/azure/well-architected/architect-role/design-diagrams · https://www.nngroup.com/articles/gestalt-proximity/ · https://arxiv.org/abs/2411.11916 · https://docs.github.com/en/copilot/reference/customization-cheat-sheet
