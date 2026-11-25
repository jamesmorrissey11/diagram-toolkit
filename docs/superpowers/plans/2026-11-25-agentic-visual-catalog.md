# Agentic-delivery visual catalog: toolkit archetypes + Tier-1 visuals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `diagram-toolkit` with the layout archetypes and annotation vocabulary that the Tier-1 visual catalog needs, then build the 18 Tier-1 agentic-delivery visuals (V1, V2 and V3 first).

**Architecture:**
- **Layout dispatch.** A new `layout` field in the spec routes each diagram to a *composer*. A composer returns node boxes, edge paths and annotation boxes.
- **`grid` stays the default.** It wraps today's `placeGrid` + `route`, so reference architectures and their goldens do not change.
- **Shared pipeline.** All layouts share the same preset tokens, an extended `emit.mjs` (curved arrows, new shapes, a frame with title/subtitle/footer, badges, callouts and a legend), lint (plus a per-layout check) and the critic loop.
- **Visuals.** The visuals are specs in `docs/catalog/agentic-delivery/`. Product names come from a JSON alias glossary, so a rename means editing the glossary and rebuilding.

**Tech Stack:** Node ≥22 ESM, `node:test`, vendored Excalidraw 0.18.1 renderer via headless Chrome (`lib/studio.mjs`), and the OpenDiagram orthogonal router (`vendor/router.mjs`).

**Spec:** research findings. This plan argues from these, and executors read them:
- `~/.copilot/session-state/6c700852-…/files/research/research-this-rperesentative-set-of-docs.md`. Visual catalog §6, archetypes §7, visual vocabulary §8, future-proofing §9.
- `…/research/the-architecture-diagrams-for-this-were.md`. Engine root causes §1, archetype design §5.
- `…/research/spike/cycle-spike.mjs`. Proven cycle geometry.
- `…/research/agentic-sources/0[1-5]-*.md`. Content and citations for each visual.

When execution starts, copy this plan to `docs/superpowers/plans/2026-11-25-agentic-visual-catalog.md` in the repo and the research report to `docs/superpowers/specs/2026-11-25-agentic-delivery-research.md`, then commit both (Task 0).

**User decisions (2026-11-25):**
- **Scope:** toolkit archetypes first, then build the Tier-1 visuals with them.
- **Archetypes:** only what Tier-1 needs: cycle, hub, lanes (flow/swimlane), stack, matrix, plot (2-axis), tree (filesystem and driver), card (anatomy). The existing grid covers V3.
- **Urgency:** V1 lifecycle, V2 loop and V3 component map come first.
- **Location:** visuals live in this toolkit repo for now, because `agentic-agile-template-customization` does not exist yet.

## Global Constraints

Copied from the README, the spec and the existing engine. Every task must respect them.
- Node `>=22`. **No new runtime dependencies.** Anything new must be vendored, and dev dependencies are only allowed for vendoring.
- Specs carry semantics only. The `FORBIDDEN` keys in `lib/spec.mjs:19-20` (`x, y, width, height, w, h, color, fill, stroke, fontSize, font, points…`) stay forbidden, including in new fields. A plot uses ordinal tick *indices*, not coordinates.
- Presets own every colour, font and size. New shapes, badges, callouts and legends draw only from preset tokens, so the token-discipline lint (`lib/lint.mjs`, "off-token") must still pass.
- Readability gate stays: text **≥ 11px at `displayWidth`**, and aspect within the preset limit (concept 2.5, reference 2.2) unless a layout declares its own window.
- Existing fixture goldens (`test/goldens/*.json`) and snapshots stay byte-for-byte unchanged, **except** concept-preset fixtures in Task 1, where the change is intentional and called out.
- Output must stay "clean" in the real editor: `npm run check:editor -- <file>` (Excalidraw 0.18.1).
- Ids stay stable. The spec is embedded in every `.excalidraw` (`lib/meta.mjs embedMeta`), and the hand-edit refusal (exit 3) applies to every layout.
- Concept node cap stays at 9 for `grid`. Other layouts declare their own caps.
- Visual rules from research §9:
  - Structure carries *roles*; product names come from the glossary.
  - No model names or prices in structural visuals.
  - Preview items get a `preview` badge.
  - Every visual has a source and date footer.
- Display widths: 1200 (docs) by default; V3 and V14 may use 1400 if lint passes.

## Review Focus

Most likely failures, each pinned by a test in the owning task:
1. **Existing reference diagrams change.** Adding the dispatch must not move a pixel of any `grid` fixture. Pinned by Task 2: every existing golden and snapshot passes unchanged.
2. **Long labels or many steps break a layout.** A cycle with 8 steps or 28-char labels, or a hub with 10 spokes, must not overlap text or arcs. Pinned by Task 5 and Task 8, which add a max-size fixture and assert lint `hard` is empty.
3. **Callouts push the width past `displayWidth`.** When the side column would make text drop below 11px, callouts must move below the diagram instead. Pinned by Task 4 (`frame` flips to the `below` placement).
4. **Supplied text disappears silently,** as with `sub` today. Every non-empty spec string must appear in the scene. Pinned by Task 1 (`text-dropped` hard lint).
5. **A glossary id is missing or misspelled.** The build must fail with exit 2 and a message naming the id, not ship a literal `@g:` label. Pinned by Task 11.

---

## File structure

```
skills/arch-diagram/engine/
  lib/spec.mjs            MODIFY  layout field, annotation fields, per-layout validation, new roles
  lib/geometry.mjs        MODIFY  render sub in box/pill; diamond/ellipse node kinds; annotation text measures
  lib/build.mjs           MODIFY  call layoutFor(spec).compose(...) instead of placeGrid+route
  lib/emit.mjs            MODIFY  curved arrows, diamond/ellipse nodes, badges, frame, callouts, legend, lines/ticks
  lib/lint.mjs            MODIFY  text-conservation hard check; per-layout aspect window; call layout.check()
  lib/frame.mjs           CREATE  title/subtitle/footer/callouts/legend placement around a laid-out body
  lib/glossary.mjs        CREATE  resolve "@g:<id>" labels from a JSON glossary
  lib/layouts/index.mjs   CREATE  LAYOUTS registry + layoutFor(spec)
  lib/layouts/grid.mjs    CREATE  wraps placeGrid + route (no behaviour change)
  lib/layouts/cycle.mjs   CREATE  ring placement, curved arcs, hub
  lib/layouts/lanes.mjs   CREATE  swimlane/flow with columns, gates, loop-backs (orthogonal router)
  lib/layouts/hub.mjs     CREATE  centre + spoke ring (+ optional outer ring)
  lib/layouts/stack.mjs   CREATE  ordered bands with chip items + side rails
  lib/layouts/matrix.mjs  CREATE  rows × cols table with glyph cells
  lib/layouts/plot.mjs    CREATE  2-axis ordinal plot with labelled points
  lib/layouts/tree.mjs    CREATE  indented (filesystem) and branching (driver) trees
  lib/layouts/card.mjs    CREATE  anatomy card: ordered fields with callouts
  presets/concept.json    MODIFY  title on; tokens for gate/store roles, badge, callout, legend, frame, matrix glyphs
  presets/sketch.json     MODIFY  same token blocks (sketch look)
  presets/reference.json  MODIFY  frame/legend/callout tokens only (no change to existing tokens)
skills/arch-diagram/
  SKILL.md                MODIFY  step 1 picks a layout; layout table
  references/spec.md      MODIFY  document layout + annotation fields
  references/compositions.md MODIFY add one section per layout
  references/examples/*.json  CREATE one example per new layout
agents/diagram-critic.agent.md MODIFY per-layout rubric lines; actions change-layout, add-callout, add-legend
test/
  engine.test.mjs         MODIFY  unit tests per task (spec/geometry/frame/layouts/glossary)
  fixtures/layout-*.json  CREATE  one e2e fixture per layout (+ max-size stress fixtures)
  goldens/, snapshots/    CREATE  for new fixtures only (UPDATE_GOLDENS=1 / UPDATE_SNAPSHOTS=1 on new names only)
docs/catalog/agentic-delivery/
  README.md               CREATE  catalog index: V-id, title, reader question, layout, sources, status
  glossary.json           CREATE  role/label/aliases/status/source/verified per term
  v01-lifecycle.json …    CREATE  one spec per visual (+ built .excalidraw/.png/.svg/.lint.json)
```

---

## Part A — Toolkit

### Task 0: Housekeeping

**Files:**
- Create: `docs/superpowers/plans/2026-11-25-agentic-visual-catalog.md`, `docs/superpowers/specs/2026-11-25-agentic-delivery-research.md`
- Commit: `docs/diagrams/codex-agent-loop.{json,excalidraw,png,svg,lint.json}` (currently untracked, from this session)

- [ ] **Step 1:** Copy the plan and research report into the repo at the paths above.
- [ ] **Step 2:** Run `npm test`. Expected: all pass. Record the count as the baseline.
- [ ] **Step 3:** Commit: `docs: research spec, implementation plan, codex loop grid baseline`.

### Task 1: Concept preset quick wins (sub text, title, text conservation)

**Files:**
- Modify: `lib/geometry.mjs:38`, `presets/concept.json` (`"title": false` → `true`), `lib/lint.mjs`
- Test: `test/engine.test.mjs`; goldens for `agent-loop`, `simple-rag-concept`

**Interfaces:**
- Produces: box/pill nodes render `sub`. Node height grows to fit label + sub, and pills keep a radius of h/2. Lint hard code `text-dropped:<kind>:<id>`.

- [ ] **Step 1: Failing tests**
  - `test("concept box renders sub")`: `buildGeometry` on a concept spec where node `a` has `sub: "Tests · build · lint"` → `geo.nodes.a.showSub === true` and `geo.nodes.a.parts.sub` is defined.
  - `test("lint hard-fails when supplied text is missing from the scene")`: take a built scene, delete the `${id}_sub` element, run `lintScene` → `hard` contains `text-dropped:nodeSub:a`.
- [ ] **Step 2:** Run `npm test`. Expected: both FAIL.
- [ ] **Step 3: Implement**
  - `showSub = !!n.sub` for box and pill. Box/pill height = `max(st.h, padY*2 + lh(label) + 2 + lh(sub))`, with the text block centred vertically.
  - In `lintScene`, collect expected strings from spec (node label/sub, edge label, group label, title and the new annotation fields) and check each against the `customData.dt` of text elements.
- [ ] **Step 4:** Run `npm test`. Expected: the new tests PASS, and only the `agent-loop` and `simple-rag-concept` goldens fail. Inspect both PNGs, then refresh only those: `UPDATE_GOLDENS=1 UPDATE_SNAPSHOTS=1 node --test --test-name-pattern="agent-loop|simple-rag-concept" test/engine.test.mjs`. All other goldens must be unchanged.
- [ ] **Step 5:** Commit: `fix(concept): render sub lines and titles; lint hard-fails dropped text`.

### Task 2: Layout dispatch with `grid` as a no-op wrapper

**Files:**
- Create: `lib/layouts/index.mjs`, `lib/layouts/grid.mjs`
- Modify: `lib/build.mjs:42-44`, `lib/spec.mjs`

**Interfaces:**
- Produces:
  - `LAYOUTS = { grid, cycle, lanes, hub, stack, matrix, plot, tree, card }`. Only `grid` exists after this task; the rest register as their tasks land.
  - `layoutFor(spec) → Layout`.
  - `Layout = { name, validate(spec, bad): void, compose(spec, geo, preset): Laid, check(spec, laid, scene): {hard: string[], warnings: string[]}, aspect?: [min, max], maxNodes?: number }`.
  - `Laid = { nodes: {[id]: {x,y,w,h}}, groups: {[id]: {x,y,w,h}}, titleAlign, routes: {[edgeId]: {points:[{x,y}], label:{x,y,width,height}|null, curved?: boolean}}, fallbacks: string[], decor: Decor[] }`.
  - `Decor = {kind: "line"|"rect"|"ellipse"|"text", id, …}`, used for axes, ticks, lane headers and matrix rules.
  - Spec `layout` enum (default `"grid"`). Unknown layout → SpecError listing valid names.
- [ ] **Step 1: Failing tests**
  - `test("unknown layout is rejected with the list of layouts")` → message matches `/layout "spiral" unknown; use one of grid/`.
  - `test("grid layout via dispatch is identical to placeGrid+route")`: for each fixture, deep-equal of `layoutFor(spec).compose(...)` nodes and routes vs the direct calls.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `grid.compose` as `{...placeGrid(), ...route(), decor: []}`. In `build.mjs`, `const laid = layoutFor(spec).compose(spec, geo, preset)`, then pass `laid` to `emitScene(spec, preset, geo, laid, laid)`.
- [ ] **Step 4:** Run `npm test`. Expected: all PASS, with **zero** golden or snapshot diffs.
- [ ] **Step 5:** Commit: `refactor: layout dispatch; grid wraps existing placer and router`.

### Task 3: New node shapes, curved edges and roles in emit

**Files:**
- Modify: `lib/spec.mjs` (role enum), `lib/geometry.mjs` (`nodeStyle`), `lib/emit.mjs`, all three presets (`roles.gate`, `roles.store`, `edge.curved`)

**Interfaces:**
- Produces:
  - Roles `gate` (diamond, amber tokens) and `store` (ellipse, lilac tokens), in addition to `terminal`, `core` and `support`.
  - When `routes[id].curved === true`, emit writes `elbowed: false, roundness: {type: 2}` and sets bindings with the existing `frac()`.
  - `Decor` elements are emitted between groups and edges, using only preset tokens (`preset.decor.{line,rule,header}`).
- [ ] **Step 1: Failing tests**
  - `test("gate role emits a diamond bound to its edges")`: the scene has a `type:"diamond"` element with `id === nodeId` whose `boundElements` include the edge.
  - `test("curved route emits a non-elbowed rounded arrow")`.
  - `test("decor elements pass token lint")`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the diamond and ellipse branches next to the pill/box branches in `emit.mjs` (~L132-147), the curved-arrow fields in the edge loop (~L86), and the decor loop. The diamond footprint is `w = max(minW, labelW·1.5)`, `h = max(st.h, w·0.55)`.
- [ ] **Step 4:** Run. Expected: PASS, and existing goldens unchanged.
- [ ] **Step 5:** Commit: `feat(emit): gate/store shapes, curved edges, decor primitives`.

### Task 4: Frame and annotations (title, subtitle, source footer, badges, callouts, legend)

**Files:**
- Create: `lib/frame.mjs`
- Modify: `lib/spec.mjs`, `lib/geometry.mjs` (`textsNeeded`), `lib/emit.mjs`, `lib/lint.mjs`, presets (`frame`, `badge`, `callout`, `legend` token blocks)

**Interfaces:**
- Spec fields (all optional; strings only):
  - `subtitle` (≤ 90 chars), `source` (≤ 90 chars)
  - node `badge` (integer 1..20, unique)
  - `callouts: [{id, title ≤ 28, text ≤ 120, refs?: [nodeId], tone?: "neutral|blue|green|yellow|red"}]` (≤ 4)
  - `legend: [{kind: "sync|async|optional|gate|human|store", meaning ≤ 32}]` (≤ 6)
- Produces: `placeFrame(spec, geo, preset, laid, tw) → { title?, subtitle?, footer?, callouts: [{id, x, y, w, h, lines: string[]}], legend?: {x, y, w, h, items}, placement: "side"|"below" }`.
  - Callouts go to the right of the body when `bodyW + calloutW + gap` keeps text ≥ 11px at `displayWidth`, otherwise below.
  - Callout text wraps at word boundaries to the preset's callout width.
  - Wrapping needs measured words: `textsNeeded` adds each callout word plus `" "` at the callout size.
  - `build.mjs` calls `placeFrame` after `compose`, and `emitScene` gains a 6th parameter: `emitScene(spec, preset, geo, laid, laid, frame)`.
- [ ] **Step 1: Failing tests**
  - `test("frame places callouts beside the body when they fit")` → `placement === "side"` for a 600px body at `displayWidth` 1200.
  - `test("frame moves callouts below when side placement breaks readability")` → `placement === "below"` for a 1100px body at 1200. (Review Focus #3.)
  - `test("badges must be unique integers")` → SpecError `/badge 2 used twice/`.
  - `test("callout refs must name nodes")` → SpecError.
  - e2e: a concept fixture with title, subtitle, source, badges, 3 callouts and a legend. Lint hard is empty and every annotation string is present (Task 1 conservation).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `placeFrame`, emit (text, callout rect + accent bar + ref chip, badge ellipse + digit at the node's top-left, legend swatches) and lint inclusion.
- [ ] **Step 4:** Run. Expected: PASS, with goldens unchanged for specs without annotation fields.
- [ ] **Step 5:** Commit: `feat: frame with title/subtitle/source, badges, callouts, legend`.

### Task 5: `cycle` layout

**Files:**
- Create: `lib/layouts/cycle.mjs`, `test/fixtures/layout-cycle.json` (the Codex loop: 6 steps + hub + 3 callouts), `test/fixtures/layout-cycle-max.json` (8 steps, 28-char labels)

**Interfaces:**
- Spec:
  - `layout: "cycle"`.
  - Nodes in order are the steps (3..8).
  - Optional `hub: {label ≤ 28, sub ≤ 32}`.
  - Edges are optional: missing consecutive edges are implied in order, and an explicit edge may carry a `label` (e.g. "Repeat" on the closing arc).
  - Non-consecutive edges are rejected.
  - `aspect: [1.1, 2.2]` (with a callout column).
- Algorithm (from `spike/cycle-spike.mjs`):
  - Place steps on an ellipse clockwise from 12 o'clock. `rx`/`ry` are chosen so the chord between adjacent boxes is at least `max(w) + spacing.node`.
  - Arcs are 3-point curved routes clipped to the node boxes.
  - The hub is an ellipse at the centre.
- `check()`: hard if any arc segment intersects a non-endpoint node box; warning if steps are not in clockwise order.
- [ ] **Step 1: Failing tests**
  - Unit: `compose` returns nodes with angle increasing clockwise.
  - Unit: the arcs' first and last points sit on the box edges (±4px).
  - e2e: both fixtures pass the hard and readability gates (Review Focus #2).
  - `check:editor` reports clean.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `compose`, `validate` and `check`, then register in `LAYOUTS`.
- [ ] **Step 4:** Run, then create goldens and snapshots for the 2 new fixtures only. Run the `diagram-critic` agent on the PNG. Expected verdict: `ship`.
- [ ] **Step 5:** Commit: `feat(layout): cycle`.

### Task 6: `lanes` layout (flow / swimlane with gates and loop-backs)

**Files:**
- Create: `lib/layouts/lanes.mjs`, `test/fixtures/layout-lanes.json` (4 lanes × 9 steps, 3 gates, 2 loop-backs)

**Interfaces:**
- Spec:
  - `layout: "lanes"`, `lanes: [{id, label ≤ 24}]` (2..5).
  - Each node has `lane` (a lane id) and `step` (integer column ≥ 0). Nodes may share a step across lanes.
  - Optional `phases: [{label ≤ 24, from: step, to: step}]` header band.
  - Edge `kind: "loop"` is drawn as a return path outside the lanes.
- Algorithm:
  - Lanes are horizontal bands emitted as `Decor` rects with left headers.
  - Columns are global, sized to the widest node in each step.
  - Nodes are centred in their (lane, step) cell.
  - Forward and cross-lane edges use the existing orthogonal router (`routeEdges`) with the lanes passed as containers.
  - `loop` edges route above the top lane or below the bottom lane via a dedicated channel.
- `check()`:
  - hard: two nodes in one cell.
  - warning: an edge goes backward without `kind: "loop"`.
- [ ] **Step 1: Failing tests**
  - Unit: nodes in the same step share a centre x.
  - Unit: a loop edge's points lie outside the lane rects except at its endpoints.
  - e2e: the fixture passes; `check:editor` clean.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement and register.
- [ ] **Step 4:** Run. Create the golden and snapshot for the new fixture. Critic verdict: `ship`.
- [ ] **Step 5:** Commit: `feat(layout): lanes`.

### Task 7: Skill, references and critic for layouts

**Files:**
- Modify: `skills/arch-diagram/SKILL.md`, `references/spec.md`, `references/compositions.md`, `agents/diagram-critic.agent.md`
- Create: `references/examples/cycle-agent-loop.json`, `references/examples/lanes-delivery.json`

This task is repeated as a one-line addition in each later layout task.

- [ ] **Step 1:**
  - SKILL.md step 1 gains "pick the layout by the content's shape" with a table: loop → cycle; process with actors/gates → lanes; one centre with many relations → hub; ordered layers → stack; X × Y comparison → matrix; two orthogonal dimensions → plot; hierarchy/files → tree; anatomy of one artifact → card; architecture → grid.
  - `references/spec.md` documents the `layout`, frame and annotation fields.
- [ ] **Step 2:** Critic:
  - Replace "architecture diagrams" with "diagrams".
  - Add `layoutFit` to the rubric (the shape matches the content: a cycle reads as a loop at a glance, lanes show where the gates are).
  - Add the actions `change-layout`, `add-callout` and `add-legend`.
- [ ] **Step 3:** Run `node scripts/validate-plugin.mjs && scripts/critic-smoke.sh`. Expected: OK. Then `node scripts/render-examples.mjs` builds the new examples with exit 0.
- [ ] **Step 4:** Commit: `docs(skill): layout selection, annotation fields, critic layout-fit`.

### Task 8: `hub` layout

**Files:** Create `lib/layouts/hub.mjs` and `test/fixtures/layout-hub.json`, plus `layout-hub-max.json` (10 spokes).

**Interfaces:**
- Spec:
  - `layout: "hub"`, `center: nodeId`.
  - Other nodes are spokes, optionally with `ring: 1|2` (2 = outer ring, e.g. environments).
  - Edges between the centre and spokes are straight radial routes, with labels at the midpoint.
  - Spoke-to-spoke edges are allowed and curved.
  - Groups of `kind: "boundary"` may wrap ring 2 as a "governance ring".
- `check()`: hard on spoke-label overlap. Spokes spread evenly; spokes with an edge label get extra radius.
- [ ] **Step 1:** Failing tests:
  - Unit: spokes are equiangular (±1°).
  - Unit: ring 2 radius > ring 1 radius + max node size.
  - e2e: both fixtures pass.
- [ ] **Step 2:** Run (FAIL), then implement and register.
- [ ] **Step 3:** Run (PASS), create goldens, critic `ship`, add a hub example and a compositions section.
- [ ] **Step 4:** Commit: `feat(layout): hub`.

### Task 9: `stack` and `matrix` layouts

**Files:** Create `lib/layouts/stack.mjs`, `lib/layouts/matrix.mjs` and fixtures `layout-stack.json`, `layout-matrix.json`.

**Interfaces:**
- **stack:**
  - `layout: "stack"`; groups in order are the bands (2..8), top to bottom.
  - Nodes in a band render as chips left to right and wrap.
  - Optional `rails: [{label ≤ 24, from: groupId, to: groupId}]` render as vertical side bars.
  - Nesting is shown by `parent` groups drawn as inset bands.
- **matrix:**
  - `layout: "matrix"`, `rows: [{id, label}]`, `cols: [{id, label}]` (≤ 12 × 10).
  - `cells: {"rowId/colId": "yes"|"no"|"preview"|"partial"|string ≤ 24}`.
  - Glyphs come from preset tokens (`matrix.glyphs`), and a legend is generated automatically for the glyphs used.
  - Nodes and edges are not used.
- `check()`:
  - stack: hard on chip overflow beyond the band.
  - matrix: hard on a cell key naming an unknown row or col; warning on an empty row.
- [ ] **Step 1:** Failing tests:
  - stack: bands are ordered and the same width; rails span exactly from..to.
  - matrix: an unknown cell key → SpecError; a 12×10 fixture keeps text ≥ 11px at 1400.
- [ ] **Step 2–4:** FAIL → implement and register → PASS → goldens, critic `ship`, examples, compositions.
- [ ] **Step 5:** Commit: `feat(layout): stack and matrix`.

### Task 10: `plot`, `tree` and `card` layouts

**Files:** Create `lib/layouts/{plot,tree,card}.mjs` and fixtures `layout-plot.json`, `layout-tree-files.json`, `layout-tree-driver.json`, `layout-card.json`.

**Interfaces:**
- **plot:**
  - `layout: "plot"`, `axes: {x: {label, ticks: [≤ 6 strings]}, y: {label, ticks: [...]}}`.
  - Each node has `at: [xTickIndex, yTickIndex]`.
  - Nodes sharing a cell are offset in a small grid.
  - The optional `callouts` hold the "levers and breakers" panel.
- **tree:**
  - `layout: "tree"`, `treeStyle: "files"|"branch"`.
  - Nodes carry `parent?: nodeId` (exactly one root, no cycles).
  - `files`: indented list with connector lines, and `sub` as the right-aligned annotation.
  - `branch`: left-to-right tidy tree with orthogonal edges (for the driver tree), with node `sub` used as the KPI chip.
- **card:**
  - `layout: "card"`; a single group is the card, and its nodes are the ordered fields.
  - Node `sub` is the field description.
  - `callouts` with `refs` point at fields.
- `check()`:
  - tree: hard on multiple roots or a cycle.
  - plot: hard on a tick index out of range.
- [ ] **Step 1:** Failing tests: plot out-of-range index → SpecError; tree two roots → SpecError; files-tree children indented exactly one step from their parent; card fields stacked in spec order.
- [ ] **Step 2–4:** FAIL → implement and register → PASS → goldens, critic `ship`, examples, compositions.
- [ ] **Step 5:** Commit: `feat(layout): plot, tree, card`.

### Task 11: Glossary-backed labels

**Files:** Create `lib/glossary.mjs`. Modify `lib/spec.mjs` (resolve before validation) and `lib/build.mjs`.

**Interfaces:**
- Spec `glossary: "<relative path to .json>"`. Any string field equal to `"@g:<id>"` or `"@g:<id>.<field>"` resolves from the glossary.
- Glossary entry: `{ id, role, label, short?, aliases: string[], status: "ga"|"preview"|"beta"|"experimental"|"deprecated", source: url, verified: "YYYY-MM-DD" }`.
- A node whose resolved entry has a `status` other than `ga` gets an automatic `preview` badge from preset tokens.
- `resolveGlossary(raw, specDir) → raw'`, called by `buildDiagram` before `normalizeSpec`. The **embedded** spec keeps the unresolved `@g:` form, so a rebuild picks up renames.
- [ ] **Step 1:** Failing tests:
  - Resolves `@g:cloud-agent` to `"Copilot cloud agent"`.
  - An unknown id → SpecError `/glossary id "clud-agent" not found/` and exit 2 (Review Focus #5).
  - The embedded spec keeps `@g:`.
  - A preview status adds a badge element.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit: `feat: glossary-backed labels with status badges`.

---

## Part B — Tier-1 visuals (`docs/catalog/agentic-delivery/`)

**Shared procedure for every visual task** (the steps below are not repeated per task):
1. Write `vNN-<slug>.json` using the content and nodes listed in the research report (§6 table row, plus the cited evidence sections). Use `glossary: "./glossary.json"` and `@g:` labels for every product term. Every visual has `title`, a `subtitle` that states the takeaway, and a `source` footer naming the URLs and "verified 2026-11".
2. Build with `node skills/arch-diagram/engine/cli.mjs build docs/catalog/agentic-delivery/vNN-<slug>.json --publish --json`. Expected: exit 0.
3. Run the critic (≤ 3 rounds; keep the best version). Expected verdict: `ship`.
4. `npm run check:editor -- docs/catalog/agentic-delivery/vNN-<slug>.excalidraw`. Expected: clean.
5. Add or refresh the row in `README.md` (V-id, title, reader question, layout, sources, status, PNG link).
6. Commit: `docs(catalog): VNN <title>`.

### Task 12: Catalog scaffold, glossary and V3 component map  *(urgent; needs Tasks 1–4, 11)*
- Create `README.md` and `glossary.json`. The glossary holds every product term in research §2 (F1–F14 columns) and the §9 renames, with `status`, `source` and `verified`.
- **V3 "Agentic delivery component map":** `layout: grid`. There are 14 groups (F1–F14, `kind: tier`, tones by family) with 3–4 exemplar nodes each, no edges, and a legend of the family shapes. If 14 tiles exceed the readability gate, split it into V3a (actors, agents, runtime: F1–F5) and V3b (artifacts, controls, delivery: F6–F14), and record the split in the README.

### Task 13: V2 "Inner build loop + durable memory"  *(urgent; needs Task 5)*
- `layout: cycle`. Steps: Plan, Edit code, Run tools, Observe results, Repair failures, Update docs/status. The closing arc is labelled "Repeat".
- Hub "Durable memory", sub "Spec · Plan · Runbook · Log".
- Callouts: Real feedback, Externalized state, Steerability. Each has `refs` to its steps, plus a fourth callout "Goal contract" (Outcome · Verification · Budget · Blocked stop).
- Sources: the Codex long-horizon blog and research §4 W2.
- This replaces `docs/diagrams/codex-agent-loop.*` as the canonical version. Keep the old file as the "before" sample.

### Task 14: V1 "Agentic delivery lifecycle"  *(urgent; needs Task 6)*
- `layout: lanes`, with lanes Human · Agent · Reviewer/CI · Repo/Platform.
- Steps follow W1 (0–12), with `gate` nodes for G0 confirm, design approval, plan approval, human approval/merge and prod promotion.
- `loop` edges: Review→Execute, Verify→Execute, Retro→Bootstrap.
- Phases band: Align · Specify/Plan · Build · Ship · Learn.
- Legend: sync, loop, gate, human.

### Task 15: Copilot visuals V4–V8  *(needs Tasks 8–10)*
- **V4** surface and environment map (hub, ring 2 = environments).
- **V5** customization primitives (stack: Plugin ⊃ skills/agents/hooks/MCP, plus the instruction layers) and its companion **V5b** matrix (primitive × purpose/trigger/scope/surfaces, from the cheat sheet).
- **V6** repo customization filesystem (tree `files`).
- **V7** autonomy control plane (plot: x = Continuation ticks, y = Approval ticks, the six plotted modes, and a levers/breakers callout).
- **V8** defense in depth (stack L0–L6, with rails Cost and Responsible use).
- One commit per visual.

### Task 16: Multi-agent pattern visuals V9–V12  *(needs Tasks 5, 6, 10)*
- **V9** delegation swimlane (lanes Developer · Local CLI · Cloud agent · GitHub; gates "Approve and run workflows", Ready, Merge).
- **V10** PR convergence (cycle with a gated exit and the exact-head rule callout).
- **V11** parallel waves (lanes = waves, gate nodes between waves, ownership `sub` chips).
- **V12** story/spec anatomy (card; the Ownership field reads "files or resources").

### Task 17: Template and platform visuals V13–V18  *(needs Tasks 8–10)*
- **V13** adapter layer stack (`data-platforms` band shows a `preview` badge, labelled "proposed").
- **V14** platform mapping matrix (15 rows × GitHub/Databricks/Foundry, from research report 05 §D.c, at `displayWidth` 1400).
- **V15** Databricks promotion (lanes with phases dev/staging/prod).
- **V16** Foundry release path (lanes; the alternate SuperRepo lane is tagged beta).
- **V17** agent tool access, 2 hubs: Databricks and Foundry, each with a governance boundary.
- **V18** metrics driver tree (tree `branch`: usage → outcomes → ESSP goals, with the template's 8 dimensions as a callout).
- Watch the "Ontology" naming trap: labels say "Genie Ontology" vs "Foundry Ontology".

### Task 18: Final verification
- [ ] Run `DIAGRAM_REQUIRE_CHROME=1 npm test && node scripts/validate-plugin.mjs && node scripts/render-examples.mjs && node scripts/render-examples.mjs --check`. Expected: all exit 0.
- [ ] Rebuild every catalog spec. Expected: all exit 0 and every `lint.json` `ok: true`.
- [ ] Run a whole-branch review (`code-review` agent) and resolve its findings.
- [ ] Bump `plugin.json` and `package.json` to `0.4.0`. Update the README gallery with V1, V2 and V3 and a layouts table.

---

## Notes and considerations
- **Order and urgency:** 0 → 1 → 2 → 3 → 4 → 11 → **12 (V3)** → 5 → **13 (V2)** → 6 → **14 (V1)** → 7 → 8 → 9 → 10 → 15 → 16 → 17 → 18. V3 ships after the foundations, before any new layout exists.
- **Interim option for urgency:** if V1 or V2 are needed before Tasks 5–6 land, render them with a one-off spike script like `spike/cycle-spike.mjs`, and mark them "interim" in the README. They are replaced in Tasks 13–14.
- **Risk: lanes routing.** This is the riskiest composer. If the orthogonal router misbehaves with lane containers, fall back to emitting straight segments for same-lane edges and routing only cross-lane edges.
- **Risk: concept golden churn** in Task 1 is intentional. Show James the before/after PNGs in the PR description.
- **Out of scope (Tier 2/3):** state machine, sequence, trust boundary, timeline and decision tree layouts, Tier-2 visuals, and the template adapter itself (`data-platforms/` layer). The archetype interface leaves room to add them.
- **Future-proofing:** glossary `verified` dates and statuses drive badges. A later monthly re-verification automation is possible but not planned here.
