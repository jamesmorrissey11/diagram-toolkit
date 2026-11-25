# Agentic-delivery visual catalog

These are the Tier-1 visuals for explaining agentic software delivery: GitHub Copilot surfaces and customization, multi-agent patterns, and the `agentic-agile-template` with its Databricks and Palantir Foundry variants. Each visual is a toolkit spec (`vNN-*.json`), built into `.excalidraw`, `.png` and `.svg` files that you can edit:

```bash
node skills/arch-diagram/engine/cli.mjs build docs/catalog/agentic-delivery/<spec>.json --publish
```

- **Where the list comes from:** [`docs/superpowers/specs/2026-11-25-agentic-delivery-research.md`](../../superpowers/specs/2026-11-25-agentic-delivery-research.md), sections 6 to 9.
- **Product names** are not typed into the specs. They come from [`glossary.json`](glossary.json) through `@g:<id>` references. To rename a product, change its glossary entry and rebuild. Any entry whose status is not `ga` gets a status chip on its node.
- **Every visual** has a title, a one-line takeaway as the subtitle, and a source footer.

| ID | Visual | Reader question | Layout | Status |
|---|---|---|---|---|
| V1 | [Agentic delivery lifecycle](v01-lifecycle.png) | What happens from idea to production, and where do humans decide? | lanes (1400px) | built |
| V2 | [Inner build loop + durable memory](v02-inner-loop.png) | Why can agents stay coherent on long tasks? | cycle | built |
| V3 | [The parts of agentic software delivery](v03-component-map.png) | What are all the pieces and how do they group? | grid (reference) | built |
| V4 | Surface and environment map | Where can I run agents, and where does the work execute? | hub | planned |
| V5 | Customization primitives | Which primitive do I use for what? | stack + matrix | planned |
| V6 | Repo customization filesystem | Where does each file live? | tree | planned |
| V7 | Autonomy control plane | How autonomous is this, and what limits it? | plot | planned |
| V8 | Defense in depth | What stops a bad change? | stack | planned |
| V9 | Delegation: local → cloud → PR | What happens when I hand work to the cloud agent? | lanes | planned |
| V10 | PR convergence loop | How does a PR get from draft to merge? | cycle | planned |
| V11 | Parallel waves | How do multiple agents work without collisions? | lanes | planned |
| V12 | Story / spec anatomy | What makes a good agent-ready work item? | card | planned |
| V13 | Template adapter layers | How does the template plug into tools, trackers, CI and platforms? | stack | planned |
| V14 | Platform mapping matrix | What does each generic concept become on GitHub, Databricks and Foundry? | matrix | planned |
| V15 | Databricks promotion | How does a change reach prod on Databricks? | lanes | planned |
| V16 | Foundry change and release | How does a change reach prod on Foundry? | lanes | planned |
| V17 | Agent tool access per platform | What can the coding agent reach, and under what governance? | hub | planned |
| V18 | Metrics driver tree | How do we know this works? | tree | planned |

The glossary was verified on 2026-11-25. Copilot, Databricks and Foundry rename products and move features in and out of preview often, so re-check `source` URLs before you publish.
