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
| `direction` | `LR` (default) `TB` | flow used when hints are missing |

## Groups

`id`, `label` required. `kind`: `boundary` (dashed scope: subscription, VPC, trust boundary) or `tier` (tinted zone). `tone` for tiers: `neutral` `blue` `green` `yellow` (pick by meaning, consistently: e.g. app blue, AI green, data yellow, ops neutral). `parent`: nest inside another group (keep to 3 levels or fewer). `row`/`col`: cell in the parent's grid. `flow`: `LR`/`TB` for auto-placing its children.

## Nodes

`id`, `label` (28 chars or fewer) required. `sub`: one tech choice, 32 chars or fewer ("Container Apps", "PyTorch, GPU"). `group`: innermost group id. `icon`: a ref from `cli.mjs icons search` (reference/sketch; ignored by concept). `role` (concept preset): `terminal` (inputs/outputs, drawn as pills), `core` (the main actors, e.g. LLM calls), `support` (tools, stores, environment). `row`/`col`: cell inside its group (or the root grid when ungrouped).

## Edges

`id`, `from`, `to` required. `label`: a specific verb or protocol, 24 chars or fewer ("embed chunks", "gRPC"); label one edge of a repeated pair and leave the twin bare. `kind`: `sync` (default, solid), `async` or `optional` (dashed: queues, telemetry, feedback, fallbacks). `primary: true` marks the main request path. `step`: 1..n numbered badges along the request path (reference preset), each number once.

## Placement hints

Every container (the root, each group) is a grid. `row`/`col` put a child in a cell; give both or neither. Children without hints are placed by flow rank (`direction` / `flow`). The engine then aligns connected nodes so edges run straight, routes orthogonally, and keeps labels clear. Hints are where composition quality comes from: see [compositions.md](compositions.md).

## Budgets

- concept: 9 nodes or fewer (enforced).
- reference/sketch: aim for 6 to 16 nodes and about 1.2 edges per node; past ~16, split into an overview plus detail diagrams.
- One edge per node pair; request/response is one edge.
