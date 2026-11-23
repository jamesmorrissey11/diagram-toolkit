# Composition families

Pick the family whose shape matches the system, then copy its hint pattern. Each has a worked example in [examples/](examples/) that passes every gate; start from it.

The two numbers that decide readability: text must stay >= 11px at `displayWidth`, and the aspect ratio must stay at or under the preset's limit (2.2; concept 2.5). Width is the scarce resource: at 1200px a reference diagram fits about 4 card columns plus their gaps. Rows are cheap.

## Tiered (reference architectures)

Example: [examples/tiered-azure-rag.json](examples/tiered-azure-rag.json). Use for cloud/system/deployment diagrams with an entry point, an application tier, AI or compute, data and ops.

```
row 0:  [User]                                   (root grid, above the boundary: saves a column)
row 1:  [Boundary: subscription / VPC / cluster]
           row 0: [App tier] [AI tier] [Ingestion]
           row 1: [Data tier] [Monitor]
```

- Entry point (user, client) above the boundary at the column of the node it calls; the engine aligns it and the edge enters straight down.
- Inside a tier, nodes connected by labelled edges share a row (`web -> api` side by side); nodes called by the same caller stack in a column (`openai` over `search`).
- Producers face their consumers: a pipeline feeding the AI tier sits on the side of the AI tier away from the app tier, so edges arrive from both sides instead of crossing.
- Ops/observability goes in the last row; its edges are `async`.
- Number the request path with `step` (1..n) and mark it `primary`.

## Hub (agent loops, orchestration)

Example: [examples/hub-agent-loop.json](examples/hub-agent-loop.json). Use for an orchestrator or LLM with tools, memory, environment and an evaluator (concept preset).

```
row 0:            [Memory]        [Answer]
row 1:  [Task] -> [Orchestrator] <-> [Evaluator]
row 2:            [Tools]    ->   [Environment]
```

- The main path runs straight through the middle row: input terminal, core actors, output.
- Supporting nodes sit directly above or below the core node they serve.
- Put the output above or below the last core node rather than extending the row (keeps the aspect under the limit).
- Feedback edges (`observation`, `feedback`) are `optional`; one edge per direction.

## Pipeline (data / ML / CI)

Example: [examples/pipeline-ml.json](examples/pipeline-ml.json). Use for staged flows with a branch and a loop back.

```
row 0:  [Data platform: 2x2]  [Training: a -> b -> c]
row 1:                        [Serving: monitor <- online   batch]
```

- Stages are groups; a long chain inside a group runs as a row, and a 4-step chain folds into a 2x2 (`events -> lake` on row 0, `features -> store` on row 1) with the hand-off node placed next to the next stage.
- Branch outputs (deploy to batch and online) go in the row below the branching node.
- The loop back (retrain, rollback) is `optional` and runs up the side.

## Splitting

When a diagram needs more than ~16 nodes or still fails the width gate after reflowing, split it: an overview where each tier collapses to one node, plus one detail diagram per tier or per flow. Give each its own spec and title.
