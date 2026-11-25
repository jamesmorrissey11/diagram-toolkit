# Spec format

One JSON object. Semantics only: any coordinate, size, colour, font or style field is rejected (the preset owns them). The engine validates and reports every problem at once (exit 2).

```json
{
  "title": "RAG chatbot on Azure",
  "type": "reference-architecture",
  "preset": "reference",
  "displayWidth": 1200,
  "direction": "LR",
  "groups": [
    { "id": "sub", "label": "Azure subscription", "kind": "boundary", "row": 1, "col": 0 },
    { "id": "app", "label": "App tier", "kind": "tier", "tone": "blue", "parent": "sub", "row": 0, "col": 0 }
  ],
  "nodes": [
    { "id": "user", "label": "User", "sub": "Browser", "icon": "azure:users", "row": 0, "col": 0 },
    { "id": "web", "label": "Web app", "sub": "App Service", "group": "app", "icon": "azure:app-services" }
  ],
  "edges": [
    { "id": "e1", "from": "user", "to": "web", "label": "HTTPS", "primary": true, "step": 1 }
  ]
}
```

## Top level

| Field | Values | Notes |
|---|---|---|
| `title` | string | drawn top-left (reference, sketch) |
| `type` | `reference-architecture` `system` `deployment` `integration` `application` `devops` `data-pipeline` `ml-pipeline` `website` `concept` `agent` `pattern` `workflow` `whiteboard` `informal` `brainstorm` | picks the default preset |
| `preset` | `reference` `concept` `sketch` | omit to use the type default; persisted after the first build |
| `displayWidth` | px, default 1200 | the width the image is shown at; text must stay >= 11px there |
| `direction` | `LR` (default) `TB` | flow used when hints are missing (grid) |
| `layout` | `grid` (default) `cycle` `lanes` `hub` | composition engine; see [Layouts](#layouts) |
| `subtitle` | string, 90 chars or fewer | one-line takeaway under the title |
| `source` | string, 90 chars or fewer | footer; "Source: " is added unless present |
| `glossary` | relative path | JSON glossary; any string `"@g:<id>"` or `"@g:<id>.<field>"` resolves from it |
| `callouts` | up to 4 `{id, title, text, refs?, tone?}` | explanation cards (title 28, text 120 chars); `refs` are node ids, shown as a step chip when those nodes have badges; `tone` `neutral` `red` `yellow` `blue` `green` |
| `legend` | up to 6 `{kind, meaning}` | `kind`: `sync` `async` `optional` `loop` `gate` `human` `store` |

## Groups

`id`, `label` required. `kind`: `boundary` (dashed scope: subscription, VPC, trust boundary) or `tier` (tinted zone). `tone` for tiers: `neutral` `blue` `green` `yellow` (pick by meaning, consistently: e.g. app blue, AI green, data yellow, ops neutral). `parent`: nest inside another group (keep to 3 levels or fewer). `row`/`col`: cell in the parent's grid. `flow`: `LR`/`TB` for auto-placing its children.

## Nodes

`id`, `label` (28 chars or fewer) required. `sub`: one tech choice, 32 chars or fewer ("Container Apps", "PyTorch, GPU"). `group`: innermost group id. `icon`: a ref from `cli.mjs icons search` (reference/sketch; ignored by concept). `role`: `terminal` (inputs/outputs, drawn as pills), `core` (the main actors, e.g. LLM calls), `support` (tools, environment), `gate` (a human or automated decision, drawn as a diamond), `store` (durable memory or data, drawn as an ellipse). `badge`: step number 1..20, unique. `status`: `ga` `preview` `beta` `experimental` `deprecated` `proposed` (anything but `ga` draws a chip; inherited from a non-GA glossary entry). `lane`/`step`: lanes layout only. `row`/`col`: cell inside its group (or the root grid when ungrouped).

## Edges

`id`, `from`, `to` required. `label`: a specific verb or protocol, 24 chars or fewer ("embed chunks", "gRPC"); label one edge of a repeated pair and leave the twin bare. `kind`: `sync` (default, solid), `async` or `optional` (dashed: queues, telemetry, feedback, fallbacks), `loop` (dashed return path with a normal arrowhead; lanes routes it around the bands). `primary: true` marks the main request path. `step`: 1..n numbered badges along the request path (reference preset), each number once.

## Placement hints

Every container (the root, each group) is a grid. `row`/`col` put a child in a cell; give both or neither. Children without hints are placed by flow rank (`direction` / `flow`). The engine then aligns connected nodes so edges run straight, routes orthogonally, and keeps labels clear. Hints are where composition quality comes from: see [compositions.md](compositions.md).

## Budgets

- concept: 9 nodes or fewer (enforced).
- reference/sketch: aim for 6 to 16 nodes and about 1.2 edges per node; past ~16, split into an overview plus detail diagrams.
- One edge per node pair; request/response is one edge.

## Layouts

The `layout` field picks the composition engine; every layout shares the node, edge and annotation fields above.

- **`grid`** (default): row/col hints and the orthogonal router; see compositions.md. The concept preset caps grid diagrams at 9 nodes.
- **`cycle`**: the nodes (except `hub`) are the steps of a loop, in order, placed clockwise from 12 o'clock (3–8 steps). `hub`: optional id of the centre node. Edges between consecutive steps are implied when missing (ids `cycle-<from>-<to>`); give one to label it (e.g. `"Repeat"` on the closing arc). Edges between non-consecutive steps are rejected; edges to/from the hub are straight spokes.
- **`lanes`**: `lanes: [{id, label}]` (2–5 rows, label 24 chars) and every node has `lane` and `step` (column, 0..19; one node per lane/step cell). Nodes in different lanes may share a step: a handoff then drops vertically. Optional `phases: [{label, from, to}]` draw a band over step ranges. Forward edges route through the column gaps; `kind: "loop"` (and backward edges) return through the corridor between lanes, or outside the bands for returns longer than 3 columns. Width grows with steps: share steps across lanes to stay within `displayWidth`.
- **`hub`**: `center` names the centre node; every other node is a spoke on ring 1, or on an outer ring with `ring: 2` (at most 14 spokes). Spokes spread evenly from 12 o'clock; ring 2 starts half a step round so its nodes sit between inner spokes. Centre↔spoke edges are straight; spoke↔spoke edges bow outward. Optional `rings: [{ring, label}]` draws a dashed track through that ring with its label in the widest free arc.
