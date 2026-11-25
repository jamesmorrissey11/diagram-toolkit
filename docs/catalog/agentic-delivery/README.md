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
| V4 | [Surface and environment map](v04-surfaces.png) | Where can I run agents, and where does the work execute? | hub (1400px) | built |
| V5 | [Customization primitives](v05-primitives.png) · [support matrix](v05b-primitive-support.png) | Which primitive do I use for what? | stack + matrix | built |
| V6 | [Repo customization filesystem](v06-repo-files.png) | Where does each file live? | tree | built |
| V7 | [Autonomy control plane](v07-autonomy.png) | How autonomous is this, and what limits it? | plot | built |
| V8 | [Defense in depth](v08-defense.png) | What stops a bad change? | stack | built |
| V9 | [Delegation: local → cloud → PR](v09-delegation.png) | What happens when I hand work to the cloud agent? | lanes | built |
| V10 | [PR convergence loop](v10-pr-loop.png) | How does a PR get from draft to merge? | cycle | built |
| V11 | [Parallel waves](v11-waves.png) | How do multiple agents work without collisions? | lanes | built |
| V12 | [Story / spec anatomy](v12-story.png) | What makes a good agent-ready work item? | card | built |
| V13 | [Template adapter layers](v13-adapter-layers.png) | How does the template plug into tools, trackers, CI and platforms? | stack | built |
| V14 | [Platform mapping matrix](v14-platform-matrix.png) | What does each generic concept become on GitHub, Databricks and Foundry? | matrix (1400px) | built |
| V15 | [Databricks promotion](v15-databricks-promotion.png) | How does a change reach prod on Databricks? | lanes | built |
| V16 | [Foundry change and release](v16-foundry-release.png) | How does a change reach prod on Foundry? | lanes | built |
| V17 | Agent tool access: [Databricks](v17a-databricks-access.png) · [Foundry](v17b-foundry-access.png) | What can the coding agent reach, and under what governance? | hub | built |
| V18 | [Metrics driver tree](v18-metrics.png) | How do we know this works? | tree | built |

Facts flagged as uncertain while building (check before publishing): V7 approval placement of cloud agent, automations and Agentic Workflows; V9 order of the workflow-approval gate and review; V11 ownership examples are illustrative; V14 Databricks/Foundry work-item cells are proposals; V6 shows the CLI's `.github/mcp.json` (VS Code uses `.vscode/mcp.json`).

The glossary was verified on 2026-11-25. Copilot, Databricks and Foundry rename products and move features in and out of preview often, so re-check `source` URLs before you publish.
