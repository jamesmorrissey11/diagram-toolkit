# Agentic software delivery: components, workflows and relationships, and the visual set that must cover them

Research date: 2026-11-25.

**Project context:** `agentic-agile-template-customization`. The goal is to add **Databricks** and **Palantir Foundry** support to [microsoft/agentic-agile-template](https://github.com/microsoft/agentic-agile-template). The user also owns an Excalidraw diagram toolkit (`jamesmorrissey11/diagram-toolkit`) that is gaining layout archetypes.

**Method:** five parallel primary-source extractions of the ~95 links the user supplied, plus the template repo and Databricks and Foundry docs. Each extraction uses the same schema: components, workflows, typed relationships, guardrails, state, metrics, best visual. This report is the cross-source synthesis.

**Evidence files.** Every claim below traces to one of these. They hold per-source records, exact names, paths and line refs.

| # | Group | File (under this `research/` folder) | Sources |
|---|---|---|---|
| 01 | Copilot CLI, app and extensibility references | `agentic-sources/01-copilot-cli.md` | 27 (all fetched) |
| 02 | Cloud agent, Agentic Workflows, automations, code review, autonomy, responsible use | `agentic-sources/02-copilot-cloud-workflows.md` | 20 + 5 bonus |
| 03 | Tutorials, customization library, MCP, security cookbook, roll-out at scale | `agentic-sources/03-copilot-tutorials-rollout.md` | 20 (all fetched) |
| 04 | mattpocock/skills, obra/superpowers, OKF, Codex | `agentic-sources/04-skills-okf-codex.md` | ~20 + repo skill files |
| 05 | agentic-agile-template + Databricks + Foundry primary docs | `agentic-sources/05-agentic-agile-template-platforms.md` | template @ `49dcea9`, about 40 platform pages |
| — | Visual-tooling prior art (earlier in session) | `prior-art-concept-diagrams.md`, `the-architecture-diagrams-for-this-were.md` | — |

In this report, `[0N §x]` cites a section of evidence file 0N. URLs are the primary sources.

---

## TL;DR

1. **Every source describes the same system, at different zoom levels.** It is a gated, looping delivery pipeline. A human sets intent and owns approval and merge. Agents run in isolated environments with scoped tools. Durable files carry memory and policy. Deterministic checks and independent reviewers close each loop.
2. **There are 14 component families** (§2), which make up the "periodic table" every diagram draws from: actors, surfaces, agents, runtime environments, triggers, work artifacts, durable memory, customization primitives, tool access, guardrails, gates, delivery and promotion, knowledge and observability, and metrics.
3. **There are 14 canonical workflows** (§4). Seven are structural and must be drawn no matter how the products change:
   - the gated lifecycle
   - the inner build loop
   - the PR/review convergence loop
   - delegation (local → cloud → PR)
   - parallel fan-out/fan-in (waves, fleet, frontier)
   - event-driven automation
   - the improvement loop
4. **Autonomy is several independent axes, not one ladder** [02 §e; 01 §a]: continuation, approval, questions, blast radius and merge authority. This changes how "autonomy" visuals must be drawn: a 2-D matrix plus levers, not a staircase.
5. **The same four-part "memory spine" (spec → plan → runbook → log) recurs under three names** in Codex, Superpowers and Matt Pocock's skills [04 §c]. OKF is a candidate portable *format* for it. This is the most important new concept for the template's Databricks and Foundry docs.
6. **Must-have visual set:** 18 Tier-1 diagrams, 16 Tier-2 and a data-driven Tier-3 reference set (§6). They need **14 archetypes**, not 5. Beyond cycle, hub, flow/swimlane, stack and matrix, the toolkit also needs:
   - state machine
   - sequence
   - tree/filesystem
   - precedence cascade
   - trust-boundary
   - 2-axis plot
   - timeline
   - decision tree
   - DAG
   - driver tree, plus anatomy cards
7. **Future-proofing rule:** draw *roles and capabilities* as structure and put *product names, commands and models* in swappable labels backed by an alias glossary. Generate matrices from a data file, and badge anything in preview (§9). The sources churn weekly: renames, preview flags, billing units, model IDs and OKF v0.3 breaking changes.
8. **For the template:** there is no data-platform extension point today. Add a 4th `data-platforms/` adapter layer plus pinned skills. "File ownership" must become **resource ownership**: bundle resources, Unity Catalog objects, ontology types [05 §0, §B]. §10 lists the diagrams that change.

---

## 1. Cross-source invariants (what every source agrees on)

These hold across Copilot docs, Codex, skill libraries and the template. They drive diagram *structure*.

| # | Invariant | Evidence |
|---|---|---|
| I1 | **Humans design, agents execute, both review.** Humans own intent, approval and merge. Agents never self-merge. | Template `MANIFESTO.md:46-47`, `AGENTS.md:68` [05 §A.2]. The cloud agent cannot mark ready, approve or merge [02 §b W3]. "No self-merge" [03 §d]. |
| I2 | **Work is spec-first and issue-first.** A frozen target with done-when criteria precedes code. | Story template (Scope, File Ownership, AC, Negative Constraints) [05 §A.2]. Codex `Prompt.md` [04 §c]. Superpowers HARD-GATE on design approval [04 §b]. "Well-scoped issue with acceptance criteria" [02 §b W3]. |
| I3 | **Plan, then execute, with a human plan gate.** | CLI `/plan` → approve → autopilot [01 §b W1–W2]. Research → Plan → Iterate [02 §b W2]. MCP research loop checkpoints [03 §b W2]. `writing-plans` / `to-tickets` [04 §b]. |
| I4 | **The inner loop is edit → run deterministic checks → observe → repair → record.** Stop-and-fix before advancing. | Codex long-horizon loop ([blog](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex)). Autopilot "code → test → evaluate" [02 §b W1]. Guardrail feedback cycle [03 §f D19]. Superpowers "fresh evidence before claims" [04 §b]. |
| I5 | **Isolation for every unit of agent work:** branch, worktree, sandbox or ephemeral env. | `copilot/…` single branch, firewalled env [02 §d]. Worktrees and local/cloud sandbox [01 §d]. `using-git-worktrees` [04]. One branch per story [05 §A.3]. |
| I6 | **Parallelism needs disjoint ownership plus fan-in gates.** | Waves with disjoint file ownership and a wave review gate [05 §A.3]. `/fleet` orchestrator with depth and concurrency limits [01 §b W5]. Ticket frontier with a merger [04 §f D5]. |
| I7 | **An independent reviewer comes before the human reviewer.** | Copilot code review as a second opinion [02]. Rubber-duck uses a different model family [01]. Standards∥Spec two-axis review [04]. The template's required Copilot review on the exact head SHA [05 §A.1]. |
| I8 | **Durable files are memory and policy.** Prompts are not. | Instructions, AGENTS.md, skills and agents [01–03]. The Codex four-file spine and OKF bundles [04 §c]. The template's Review-Cycle Log [05]. |
| I9 | **Customization is layered with explicit precedence.** | Enterprise → org → repo → path → user → session; managed floors; deny > allow; "add to, never override" [01 §c; 02 §a; 03 §d]. |
| I10 | **Defense in depth wraps every loop:** steer → contain → verify → gate → recover, plus cost brakes. | Three independent taxonomies converge [01 §d; 02 §d; 03 §d]. |
| I11 | **Learning loops back into the environment:** retro, `/chronicle improve` and skill refinement update instructions and checks. | [01 §b W6; 03 §b W1; 04 §b step 11; 05 §A.3 step 12]. |
| I12 | **Measure outcomes, not activity.** Measure usage, then engineering outcomes, then company goals. LOC is not a KPI. | ESSP driver tree [03 §e]. The template's eight dimensions [05 §A.2]. |

---

## 2. Canonical component model: the "periodic table"

Each family is a **visual role**. Its shape, colour and badge stay fixed across all diagrams (see §8). The product names on the right are *labels*, not structure.

| # | Family | Canonical components | GitHub Copilot instances | Codex / skill libraries | agentic-agile-template | Databricks | Foundry |
|---|---|---|---|---|---|---|---|
| F1 | **Actors and roles** | Requester, Designer/Owner, Reviewer, Approver/Merger, Admin (repo/org/enterprise), Security owner, Rollout owner, Champion | Task author/co-author; write-access reviewer; org/enterprise owner [02 §a; 03 §a] | Human partner; Controller | Human (design/review/merge); contributor [05 §A.2] | Workspace/account admin; SP owner | Project/space owner; ontology proposal reviewer |
| F2 | **Surfaces / clients** | Terminal, desktop app, IDE, web, mobile, chat integrations, SDK/API | Copilot CLI, Copilot app, VS Code/IDEs, GitHub.com, Mobile, Slack/Teams/Jira, SDK/ACP [01 §a; 02 §a] | Codex app/CLI/Cloud | 5 agent surfaces: CLI, IDE, chat, API, cloud [05 §A.2] | Workspace UI, Genie Code, VS Code ext | Workspace, VS Code workspaces, AIP |
| F3 | **Agents** | Main/orchestrator; subagent; specialist (explore, task, research, review, security-review, critic); custom agent; background/sidekick; cloud agent; review agent; in-platform agent | Built-ins: `explore`, `task`, `general-purpose`, `code-review`, `security-review`, `research`, `rubber-duck`; `*.agent.md`; cloud agent; Copilot code review; Agent Merge [01 §a; 02 §a] | Implementer, Reviewer, Fixer, Merger, Builder-check; status contract `DONE \| DONE_WITH_CONCERNS \| BLOCKED \| NEEDS_CONTEXT` [04 §a] | Agent per story; Reviewer (Copilot/Claude/CodeRabbit/human); Orchestrator (future) | Agent Bricks, Genie agents (runtime) | AI FDE, AIP Logic, Chatbot Studio |
| F4 | **Runtime environments** | Local machine, local sandbox, git worktree, cloud sandbox, CI runner, remote env, firewall | Local / sandbox / worktree / `--cloud`; Actions runner; ephemeral firewalled env; AWF for gh-aw [01 §a; 02 §a] | Worktree, integration branch, Codex Cloud | Branch per story | Workspace + serverless compute; per-env catalog | Spaces (dev/test/prod); Global Branch |
| F5 | **Triggers** | Human prompt, issue assignment, @-mention, PR event, schedule, API, alert | Assign issue; `@copilot`; PR open/push; schedule (hourly/daily/weekly); `gh agent-task create`; `on:` in gh-aw [02 §a] | `/goal`; automations | Issue capture; wave launch | Job triggers; CI on merge | Schedules; build triggers |
| F6 | **Work artifacts** | Issue/story, epic, spec, plan, tickets with blocking edges, branch, PR, review comments, fix plan, session log, diff, release | Issue + sub-issues; `copilot/*` branch; draft PR `[WIP]`; signed commits; session log; review overview; stacked PRs [02 §a] | Design doc, plan, tickets, review package, PR body [04 §a] | Story (Originating Prompt…), epic, wave plan, PR + **Review-Cycle Log**, fix plan, retro [05 §A.2] | Bundle (`databricks.yml`), job run | Product, release channel, PR in Code Repos |
| F7 | **Durable memory** (spine) | **Spec → Plan → Runbook → Log**, plus Glossary, ADR, Handoff, Goal contract | `plan.md`, `session-state/`, `/chronicle`, Copilot Memory [01 §a] | `Prompt.md`, `Plan.md`, `Implement.md`, `Documentation.md`; ledger; GLOSSARY/ADR; `/goal` [04 §c] | Story + Review-Cycle Log + retro (no ADRs) | (proposed) OKF bundle from UC metadata | (proposed) OKF bundle from Ontology |
| F8 | **Customization primitives** | Instructions (always-on, path-scoped), prompt files, custom agents, skills, hooks, subagents, tools, MCP servers, extensions, plugins/marketplaces, canvases, connectors | 9 primitives per [Comparing customizations](https://docs.github.com/en/copilot/concepts/customizations/comparing-customizations); paths `.github/copilot-instructions.md`, `*.instructions.md` (`applyTo`), `AGENTS.md`, `.github/skills/*/SKILL.md`, `.github/agents/*.agent.md`, hooks, `plugin.json` [01–03] | `SKILL.md` folder (description = trigger; user- vs model-invoked) [04 §a] | `copilot-instructions.md` stub, one path-scoped instruction, one skill, `mcp.json`; **no** agents/prompts/hooks [05 §A.1] | `databricks aitools` skills | Repo-aware context via Palantir MCP |
| F9 | **Tool access** | Shell/file tools, MCP servers, CLIs, SDKs, REST, connectors | GitHub/Playwright/Figma MCP; `gh`; tool allow/deny patterns [01 §d; 03 §a] | Agent-friendly CLI + companion skill [04 §f D25] | `mcp.json` (`github`, `filesystem`, `memory`) | Managed MCP `system.ai.*` via Unity Gateway; CLI; SDK | `palantir-mcp`; OSDK; REST; Foundry CLI (beta) |
| F10 | **Guardrails** (controls) | Trust, permissions, rules, isolation, credential scoping, write containment, output validation, supply chain, cost caps, policy | 12-category taxonomy [02 §d]; managed settings; firewall; safe-outputs [01 §d; 02 §d] | Iron Laws, HARD-GATE, budgets [04] | Adapter independence; never self-merge; exact-head review | UC grants; `run_as` SP; OIDC federation | Markings; agents "do not expand permissions"; proposals |
| F11 | **Gates** (decision points) | Plan approval, permission prompt, diff review, CI required checks, independent review, human approval, merge queue, environment approval, wave gate | "Approve and run workflows"; Ready-for-review; required approvals; rulesets [02 §d] | Design approval; fix-loop ≤5; final review [04 §b] | G0 onboarding confirm; review-cycle stop condition; wave gate [05 §A.3] | GitHub Environment `prod`; `mode: production` | Ontology proposal review; release channel |
| F12 | **Delivery and promotion** | Deployable unit, environment/target, promotion path, rollback | Merge → main; auto-merge/merge queue | — | Merge only (ci-cd is a v2 placeholder) | Bundle → `targets: dev/staging/prod` | Product → Marketplace channels → spaces |
| F13 | **Knowledge and observability** | Catalog/semantic layer, lineage, audit logs, session logs, traces | Audit log, session logs, `gh aw logs/audit`, OTel [01; 02] | OKF bundle (index/log, trust fields) [04] | Review-Cycle Log, retros | Unity Catalog, lineage/audit system tables, MLflow tracing | Ontology, Data Lineage, health checks |
| F14 | **Metrics and evaluation** | Usage → outcome → goal; cost; agent evals | Usage metrics API/dashboard; impact dashboard; AI credits [03 §e] | Eval loop with thresholds [04 §c] | 8 evaluation dimensions [05 §A.2] | MLflow evaluation | AIP Evals |

**Two semantic traps to draw carefully:**
- "Ontology" means different things in Databricks ("Genie Ontology") and Palantir Foundry [05 §e].
- "Agent" means an *agent that writes code* (Copilot, Codex) in one sense and an *agent that runs in production* (Agent Bricks, AIP) in the other. Keep them in separate families: F3-dev versus F3-runtime.

---

## 3. Canonical relationship vocabulary (typed edges)

Normalized from ~150 typed edges across the five reports [01 §c; 02 §c; 03 §c; 04 §d; 05 §D.a]. Each verb maps to **one** line style, so readers learn the language once.

| Verb class | Canonical verbs (aliases) | Line style | Example |
|---|---|---|---|
| **Control flow** | precedes, then, loops-until | solid arrow | Plan —precedes→ Implement |
| **Delegation** | delegates-to, dispatches, hands-off-to, orchestrates | solid arrow + small "agent" marker | Main agent —delegates-to→ subagent; CLI —hands-off-to→ cloud agent |
| **Trigger** | triggers, starts, fires | dashed arrow + lightning badge | Issue assignment —triggers→ cloud agent session |
| **Produces / writes** | produces, opens, pushes-to, writes | solid arrow to an artifact shape | Cloud agent —produces→ draft PR |
| **Reads / consumes** | reads, loads, injects-into | dotted arrow | Agent —reads→ `AGENTS.md` / OKF bundle |
| **Configures** | configures, declares, scopes, pins | thin line with a ⚙ end | Custom agent —declares→ tools + MCP; `applyTo` —scopes→ glob |
| **Gates** | gates, blocks, approves, requires | line ending in a gate diamond | Ruleset —requires→ approval; HARD-GATE —blocks→ build |
| **Contains / bundles** | contains, bundles, runs-in | nesting (no line) | Plugin ⊃ {skills, agents, hooks, MCP}; session runs-in env |
| **Feedback** | feeds-back-to, reports, observes | curved return arrow | Tests —feed back to→ agent; `/chronicle` → instructions |
| **Precedence** | overrides, floors, merges-with | stacked bands + "wins" chevrons | Managed settings —floor→ all; deny > allow |
| **Sync** | syncs-with, steers, mirrors | double-headed thin arrow | CLI —syncs-with→ VS Code; Mobile —steers→ session |
| **Knowledge** | links-to (untyped in OKF), cites, verified-by, superseded-by | grey thin line | Concept —verified-by→ human |
| **Billing / ownership** | bills-to, owned-by | dotted line with a $ or owner chip | Shared automation —bills→ org |

**Rule:** OKF v0.3 links are **untyped**, and typed relationships are deferred to a later version [04 §g]. Any typed knowledge edge is therefore a local convention, and diagrams must not present it as spec.

---

## 4. Canonical workflows (with gates and loops)

`◆` marks a human gate, `⟲` a loop and `⚙` a deterministic check. Each workflow cites its evidence.

**W1. Gated agentic delivery lifecycle (the master flow)** [04 §b; 05 §A.3; 03 §b W1]
0. Bootstrap/onboard: load instructions and skills, choose adapters. ◆ G0 confirm before modifying files.
1. Intake/triage: issue with Originating Prompt; verify and reproduce.
2. Explore/align: research, grill or brainstorm, prototype; update the glossary.
3. Specify: spec or story with Scope, Ownership, AC, Negative Constraints. ◆ design approval (HARD-GATE).
4. Decompose/plan: epic → stories/tickets with blocking edges → waves. ◆ plan approval.
5. Isolate: branch or worktree per unit; green baseline.
6. Execute: inline, subagent-per-task or goal-driven long run (TDD inside).
7. Verify ⚙: tests, lint, typecheck, scans. Fresh evidence before any claim.
8. Review ⟲: independent agent review → fix classes → re-review on the exact head. Exits on the stop condition.
9. Ship: PR ready → required checks → ◆ human approval → ◆ human merge.
10. Promote (data platforms): dev → staging/test → ◆ prod.
11. Document: update docs, the log, the knowledge bundle and the ADR.
12. Retro and measure → improve the environment (instructions, checks, skills) → back to step 0.

**W2. Inner build loop (long-horizon)** [[Codex blog](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex); 02 §b W1]
Plan → Edit → Run tools ⚙ → Observe → Repair ⟲ → Update docs/status → Repeat. The loop is bounded by a **Goal contract**: Outcome, Verification surface, Constraints, Boundaries, Iteration policy, Blocked stop. Goal states are active ⇄ paused → complete | budget-limited | blocked [04 §c].

**W3. Plan → Autopilot run** [[Autopilot ⭐](https://docs.github.com/en/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/autopilot); 01 §b W2]
1. Describe the goal, constraints and validation.
2. `/plan` ◆ accept.
3. Pick a permission mode: Manual, Assisted or Allow-all.
4. Set caps: `--max-autopilot-continues`, `--max-ai-credits`.
5. The agent loops until `task_complete`, an error, interrupt or a cap.
6. ◆ Human reviews `/diff`, tests and scans, then commits.

**W4. Delegate local → cloud → PR** [01 §b W3; 02 §b W3]
1. `/delegate` or `&`. The CLI checkpoint-commits.
2. Cloud agent on a `copilot/*` branch in a firewalled env, with `copilot-setup-steps.yml` run first.
3. Code, build and test ⚙, plus CodeQL, secret scanning, the advisory DB and a Copilot review.
4. Draft PR, then a review request.
5. ◆ "Approve and run workflows".
6. `@copilot` feedback ⟲.
7. ◆ Ready, then approval, then ◆ merge.

**W5. PR convergence loop** [01 §b W4; 02 §b W5; 05 §A.3 step 9]
1. Create PR.
2. Copilot review, on draft or on push.
3. Fix feedback, conflicts and CI ⟲, until green.
4. Template rule: whole-class fixes, one exact-head re-review per round, Review-Cycle Log, warning at ≥4 rounds.
5. Approval assessment, then auto-merge or merge queue ◆.

**W6. Parallel fan-out / fan-in** [01 §b W5; 04 §f D4–D5; 05 §A.3]
1. Plan, then decompose with disjoint ownership.
2. Orchestrator dispatches N subagents (`/fleet`, waves, frontier), each in a fresh context and worktree.
3. Status contract per subagent.
4. Merger or integration branch.
5. ◆ Wave/final review gate, then the next wave.

**W7. Event-driven automation** [02 §b W7]
1. Create the automation and choose Personal or Shared (immutable).
2. Set triggers and filters, the prompt, least-privilege tools, write scope ("Only this issue") and limits.
3. Test-run.
4. Runs create visible sessions.
5. Review proposed improvements, then the revision history.

**W8. Agentic Workflow (as code) pipeline** [02 §b W6; [gh-aw docs](https://docs.github.com/en/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/about-github-agentic-workflows)]
1. Author `.md` (frontmatter `on`, `permissions`, `network`, `tools`, `safe-outputs`, `engine`).
2. `gh aw compile` → `.lock.yml`.
3. A trigger fires, then pre-activation, then activation (sanitize).
4. Agent runs **read-only** in the firewall.
5. Threat detection, then scoped **safe-output** jobs write.
6. ◆ Human review/merge, then `gh aw logs/audit`.

**W9. Research → report** [01 S4/S24; 03 §b W2]
`/research` or a research agent → primary sources → cited Markdown report → plan or issue creation.

**W10. Customization authoring and distribution** [01 §b W7; 03 §b W10]
1. Choose a primitive.
2. Write the file and pick its scope: user, repo or org.
3. Package it as a plugin with `plugin.json` and `marketplace.json`.
4. Install, enable and pin (SHA).
5. Govern it with managed settings.

**W11. Improvement loop** [01 §b W6; 04 §b step 11; 05 step 12]
Sessions → `/chronicle improve`, retro or `diagnosing-*` → recommendations → instructions, checks and skills → better sessions.

**W12. Security remediation** [03 §b W4]
1. Enable the essentials: secret scanning, push protection, Dependabot, branch protection.
2. An alert is raised, then Autofix or an agent fix.
3. Branch, test, PR, merge.
4. Rescan; the alert auto-closes.
5. Track debt ratio and time to remediate.

**W13. Rollout and governance** [03 §b W6, W9]
- **Two-week adoption sprint:** Before → Week 1 → Week 2 → After. ◆ repeat / expand / redesign / pause / stop.
- **Governance setup:** custom property → enterprise ruleset → required CI and code scanning → instructions → champions → incident plan.

**W14. Data-platform promotion** [05 §C, §D.c]
- **Databricks:**
  1. `bundle init`, develop, `validate`.
  2. `deploy -t dev` (`mode: development`), then PR.
  3. CI `validate` + pytest, then merge.
  4. `deploy -t staging` + tests.
  5. ◆ `deploy -t prod` (`mode: production`, `run_as` SP), then monitor or roll back.
- **Foundry:** Global Branch → PR/approval → merge to the dev space → Marketplace release channel → test space → ◆ prod space (auto-upgrade, rollback). Ontology edits go through a ◆ proposal review.

---

## 5. Guardrail and autonomy model

### 5.1 Defense in depth: one unified stack (merges [01 §d], [02 §d] and [03 §d])

| Layer | What it does | Representative controls |
|---|---|---|
| L0 Policy and governance | Org/enterprise floor | Managed settings, rulesets (enterprise → org → repo, additive), MCP/plugin allowlists, preview opt-ins, budgets |
| L1 Admission and identity | Who may start agent work | Write-access-only triggers, trusted folders, role checks, loop prevention |
| L2 Steer (pre-generation) | What the agent knows and may use | Instructions, skills, agent tool allowlists, model and Fusion choice |
| L3 Contain (in-flight) | Where it runs and what it can touch | Sandbox or firewall, worktrees, single-branch push, credential scoping (`COPILOT_MCP_*`), safe-outputs, permission prompts, deny > allow |
| L4 Verify (post-generation) | Is the output correct and safe | Tests/lint/typecheck, CodeQL, secret scanning, advisory DB, threat detection, independent review agent, critic |
| L5 Gate (merge/promote) | Who decides | Plan approval, "Approve and run workflows", ready-for-review, required approvals, CODEOWNERS, merge queue, environment approval, ontology proposal review |
| L6 Recover and audit | Detect and roll back | Signed commits + session-log link, audit logs, revision history, revert/rollback, post-mortem |
| Rail: Cost and runaway | Bound spend and loops | `--max-autopilot-continues`, `--max-ai-credits`, per-run/daily caps, subagent depth/concurrency, 59-min Actions cap, Goal budget |
| Rail: Responsible use | Known limitations | Hallucination, bias, public-code match, overreliance: "supplement, not replace" ([agents card](https://docs.github.com/en/enterprise-cloud@latest/copilot/responsible-use/agents)) |

### 5.2 Autonomy is a control plane of axes, not a ladder [02 §e]

| Axis | Low → high |
|---|---|
| A Continuation | Interactive → Plan → Autopilot → Cloud task → Automation → Agentic Workflow |
| B Approval | Manual → Assisted → Allow-all (± sandbox) |
| C Questions | ask-user → `--no-ask-user` |
| D Blast radius | read-only → single branch → safe-outputs → "only this issue" → repo → cross-repo |
| E Merge authority | never (cloud agent) → Copilot approval counts → Agent Merge (opt-in per PR) |

The template adds a sixth, organizational axis: **"autonomy is earned through evidence"**, raised only after retros and measurement (`MANIFESTO.md:64-65`) [05 §A.2].

---

## 6. The visual catalog: what must be covered

~110 diagram proposals came from the five groups: 01 D1–D18, 02 D1–D20, 03 D1–D19, 04 D1–D25, 05 1–19. They are deduplicated here into one catalog. Each entry has a **reader question**, an **archetype** and its **sources**. Priority: **Tier 1** is the minimum complete set for the template + Databricks/Foundry docs; **Tier 2** is for deeper docs and training; **Tier 3** is reference, generated from data.

### Tier 1: must have (18)

| ID | Title | Reader question | Archetype | Key nodes / content | Sources |
|---|---|---|---|---|---|
| V1 | **Agentic delivery lifecycle** (master) | "What happens from idea to production, and where do humans decide?" | Swimlane flow with gate diamonds and loop-backs (lanes: Human · Agent · Reviewer/CI · Repo/Platform) | W1 steps 0–12; back-edges 8→6, 7→6, 12→0 | 04 D1; 05 #1; 03 D1 |
| V2 | **Inner build loop + durable memory** | "Why can agents stay coherent on long tasks?" | Cycle with a memory hub at the centre | W2 ring; centre: Spec / Plan / Runbook / Log | 04 D13+D14; Codex blog |
| V3 | **Component map ("periodic table")** | "What are all the pieces and how do they group?" | Grouped grid (families as tiles) | F1–F14 with icons/badges and 3–4 exemplars each | §2 |
| V4 | **Surface and environment map** | "Where can I run agents, and where does the work execute?" | Hub (session at the centre) + environment ring | Surfaces F2; environments F4; edges syncs-with / delegates-to / runs-in | 01 D1; 02 D1 |
| V5 | **Customization primitives: anatomy and when-to-use** | "Which primitive do I use for what?" | Layer stack (plugin ⊃ …) + comparison matrix | Instructions, prompt files, agents, skills, hooks, subagents, tools/MCP, plugins, canvases × purpose / trigger / scope / determinism / surface support | 01 D7; 02 D8; 03 D2; [cheat sheet](https://docs.github.com/en/copilot/reference/customization-cheat-sheet) |
| V6 | **Repo customization filesystem map** | "Where does each file live?" | Tree/filesystem | `.github/{copilot-instructions.md, instructions/, agents/, skills/, prompts/, hooks/, workflows/, ISSUE_TEMPLATE/}`, `AGENTS.md`, `mcp.json`, `~/.copilot/**` | 01 D9; 03 D3; 05 #10 |
| V7 | **Autonomy control plane** | "How autonomous is this, and what limits it?" | 2-axis plot (Continuation × Approval) + levers and breakers panel | Points: CLI interactive, Plan→Autopilot+Assisted, Allow-all+sandbox, cloud agent, automation, gh-aw; caps | 02 D2; 01 D2 |
| V8 | **Defense-in-depth guardrails** | "What stops a bad change?" | Layer stack with side rails | L0–L6 + cost + responsible-use rails (§5.1) | 01 D10; 02 §d; 03 D7 |
| V9 | **Delegation swimlane: local → cloud → PR** | "What happens when I hand work to the cloud agent?" | Swimlane / sequence | W4; gates "Approve and run workflows", Ready, Merge | 01 D5; 02 D5; 03 D5 |
| V10 | **PR / review convergence cycle** | "How does a PR get from draft to merge?" | Cycle with gated exit | W5 + the template's exact-head rule and Review-Cycle Log | 01 D4; 02 D10; 05 #3 |
| V11 | **Parallel waves / fan-out–fan-in** | "How do multiple agents work without collisions?" | Flow with parallel lanes and gate bars | Waves 1–4; ownership chips per story; "interface contract at gate" | 05 #2; 01 D6; 04 D5 |
| V12 | **Story / spec anatomy** | "What makes a good agent-ready work item?" | Anatomy card (form) | Summary, Originating Prompt, Context, Scope, **Ownership** (files *or resources*), AC, Negative Constraints, Dependencies, Review Cycle | 05 #9; 02 W3 |
| V13 | **Template adapter layer stack** | "How does the template plug into tools, trackers, CI and platforms?" | Stack + hub | Combo on top; agent-tools, issue-trackers, ci-cd (planned), **data-platforms (proposed, dashed)**; status tiers | 05 #5 |
| V14 | **Platform mapping matrix** | "What does each generic concept become on GitHub, Databricks and Foundry?" | Matrix (generic component × platform) | 15 rows from [05 §D.c] | 05 #17 |
| V15 | **Databricks promotion flow** | "How does a change reach prod on Databricks?" | Flow with environment columns | W14 Databricks; `targets`, `mode`, `run_as`, CI | 05 #11 |
| V16 | **Foundry change and release path** | "How does a change reach prod on Foundry?" | Flow with environment columns | W14 Foundry; Global Branch, proposals, release channels | 05 #15 |
| V17 | **Agent tool access per platform** | "What can the coding agent reach, and under what governance?" | Hub, one per platform (or 2-up) | Databricks: skills, managed MCP, CLI, SDK, Genie Code, all governed by UC + Unity Gateway. Foundry: palantir-mcp, OSDK/REST, Continue, AI FDE, proposals | 05 #13, #16 |
| V18 | **Metrics driver tree** | "How do we know this works?" | Driver tree (usage → outcomes → goals) + the template's 8 dimensions | ESSP goals; velocity, quality, security, happiness; cost | 03 D12; 05 #8 |

### Tier 2: should have (16)

| ID | Title | Archetype | Sources |
|---|---|---|---|
| V19 | Mode and permission state machine (interactive ⇄ plan ⇄ autopilot; manual / assisted / allow-all) | State machine | 01 D2 |
| V20 | Tool-call permission sequence (preToolUse → permissionRequest → rules → prompt → tool → postToolUse) | Sequence | 01 D11, D18 |
| V21 | Precedence cascades (agents, skills, MCP, instructions, settings, hooks) | Precedence cascade (multi-panel) | 01 D8; 02 D7 |
| V22 | Cloud-agent trust boundary (requester → sanitizer → firewalled env → single branch → gates; secrets lane) | Trust-boundary diagram | 02 D6 |
| V23 | Agentic Workflow anatomy + security pipeline (`.md` → `.lock.yml` → read-only agent → detection → safe outputs) | File anatomy + flow with trust layers | 02 D12, D13 |
| V24 | Automations vs Agentic Workflows vs cloud tasks | Comparison matrix | 02 D15 |
| V25 | Per-task subagent loop (Controller / Implementer / Reviewer / Fixer + ledger; status contract) | Swimlane | 04 D4 |
| V26 | Goal contract and lifecycle | Anatomy card + state machine | 04 D15 |
| V27 | TDD and debug loops (red → green → refactor; reproduce → hypothesise → fix at seam) | Cycle (2-up) | 04 D6, D7 |
| V28 | Skill taxonomy × lifecycle stage (MP / SP / Codex) | Matrix | 04 §e |
| V29 | Skill anatomy + invocation (user- vs model-invoked) | Tree + 2×N matrix | 04 D21 |
| V30 | OKF bundle anatomy + concept schema + trust tiers | Tree + ER + state machine (3-panel) | 04 D17–D19 |
| V31 | Onboarding dialogue + two-commit provenance | Flow | 05 #4 |
| V32 | Agent-surface selection (task × surface; decision tree) | Matrix + decision tree | 05 #7 |
| V33 | Security remediation pipeline | Flow | 03 D6 |
| V34 | Adoption sprint timeline + barrier → response tree | Timeline + decision tree | 03 D9, D10 |

### Tier 3: reference / generated from data

Drawn from structured data (YAML/CSV) so they can be regenerated when docs change:
- Surface × feature support matrix ([cheat sheet](https://docs.github.com/en/copilot/reference/customization-cheat-sheet))
- Hook lifecycle table
- Plugin packaging tree
- Session status board
- Review-effort precedence
- Model tier × task matrix
- Stacked-PR layers
- Phase-boundary decision tree
- Wayfinder map
- Software-factory slots
- Data-platform reference architecture (Ingest / Transform / Govern / Serve / Observe × Databricks, Foundry)
- Responsible-use surface × control matrix

Sources: 01 D12–D17; 02 D11, D14, D16–D20; 03 D8, D11, D13–D18; 04 D8–D12, D16, D20, D22–D25; 05 #12, #14, #18, #19.

### Coverage check

Every component family F1–F14 appears in at least one Tier-1 diagram:

| Family | Diagrams |
|---|---|
| F1 Actors | V1, V9 |
| F2 Surfaces | V4 |
| F3 Agents | V4, V11, V17 |
| F4 Environments | V4, V15, V16 |
| F5 Triggers | V9, V7 |
| F6 Artifacts | V1, V10, V12 |
| F7 Memory | V2 |
| F8 Customization | V5, V6 |
| F9 Tools | V17 |
| F10 Guardrails | V8 |
| F11 Gates | V1, V10, V11 |
| F12 Delivery | V15, V16 |
| F13 Knowledge | V2, V14 |
| F14 Metrics | V18 |

Workflows: W1 → V1; W2 → V2; W3 → V7; W4 → V9; W5 → V10; W6 → V11. W7–W14 are covered in Tier 2/3.

---

## 7. Archetypes required, and what the diagram toolkit must support

Count of Tier-1 and Tier-2 diagrams per archetype (V-numbers):

| Archetype | Used by | Toolkit status (from the earlier gap report) |
|---|---|---|
| Swimlane / flow with gates | V1, V9, V11, V15, V16, V25, V31, V33 (8) | Planned `flow/lanes`. Needs **gate diamonds, gate bars, loop-back arcs and environment columns**. |
| Cycle | V2, V10, V27 (+V3 sub-loops) | Planned `cycle`. Spike proven (`spike/codex-loop-cycle.png`). Needs **gated exit** and **centre hub as a store**. |
| Hub-and-spoke | V4, V13, V17 | Planned `hub`. Needs **outer ring** (environments) and **governance ring**. |
| Layer stack | V5, V8, V13 | Planned `stack`. Needs **side rails** and **nesting (⊃)**. |
| Matrix | V5, V14, V24, V28, V32 | Planned `matrix`. Needs **glyph cells ✓/P/✗** and a **data-file source**. |
| 2-axis plot | V7 | **New.** Quadrant/scatter with labelled points and lever panel. |
| State machine | V19, V26, V30 | **New.** States, guarded transitions, terminal states. |
| Sequence | V20, (V9 alt) | **New.** Lifelines, activation, hook interception. |
| Precedence cascade | V21 | **New** (stack variant). "Wins" direction plus merge vs first-wins semantics. |
| Trust boundary | V22, V23 | **New** (grid variant). Dashed zones, sanitizer chokepoints, secrets lane. |
| Tree / filesystem | V6, V29, V30 | **New.** Indented tree with file-type glyphs and annotations. |
| Anatomy card / form | V12, V26, V23 (frontmatter) | **New.** Labelled fields with callouts. |
| Driver tree | V18 | **New.** Left-to-right tree with KPI chips. |
| Timeline / decision tree | V34, V32 | **New.** |
| Grouped grid (component map) | V3 | Existing grid placer, with tile styling |
| Grid reference architecture | Tier 3 data-platform ref arch | **Existing** (top quality today) |

**Implication:** extending the toolkit with only the 5 planned archetypes covers roughly 60% of Tier 1. Full Tier-1+2 coverage also needs **state machine, sequence, tree, anatomy card, 2-axis plot, trust boundary and driver tree**. All of them are deterministic composers that fit the archetype dispatch design proposed earlier (`the-architecture-diagrams-for-this-were.md` §5). **(Inference: effort for each roughly matches the `cycle` spike, 1–2 days.)**

---

## 8. Visual component library: shapes, edges, annotations, styles

### 8.1 Node vocabulary (one shape per family; never reuse a shape for another meaning)

| Family | Shape | Notes |
|---|---|---|
| Human / role (F1) | Pill with person glyph | Matches Anthropic's convention of pills for external actors ([prior-art §2.1](prior-art-concept-diagrams.md)) |
| Surface (F2) | Rounded rectangle with a device glyph | |
| Agent (F3) | Rounded rectangle, **filled** role colour; robot glyph. Subagent = smaller, same hue. Custom = dashed inner border. Runtime agent = different hue | |
| Environment (F4) | Dashed container | Sandbox or firewall shown as a thicker dashed outline |
| Trigger (F5) | Small circle with ⚡ | |
| Work artifact (F6) | Document shape (folded corner) | PR and issue use GitHub glyphs as optional icons |
| Durable memory (F7) | Stacked pages or cylinder-doc | Always the same colour across diagrams |
| Config / customization file (F8) | Document with ⚙ and monospace path label | |
| Tool / MCP / CLI (F9) | Hexagon (tool) | MCP = hexagon with plug glyph |
| Guardrail (F10) | Shield badge attached to the node or edge it protects | |
| Gate (F11) | **Diamond**: human gate filled (◆), automated gate outlined (◇); gate bar across lanes for wave/merge gates | |
| Deployable / environment target (F12) | Environment column header (dev / staging / prod) | |
| Knowledge store (F13) | Cylinder | |
| Metric (F14) | KPI chip, e.g. `PR lead time ↓`, with optional target (`−30–50%`) | Format from 03 §f |

### 8.2 Edge vocabulary
Use the line styles in §3. Always include a **legend** when more than two edge styles appear (C4 notation guidance, [prior-art §3](prior-art-concept-diagrams.md)). Keep solid vs dotted meaningful: OpenAI uses solid for the inner loop and dotted for cross-turn loops.

### 8.3 Annotation primitives (required by Tier 1)
- **Numbered step badges.** Needed for V1, V9, V15 and V16.
- **Callout cards.** "Why it works" and "rules", as in the V2 spike.
- **Ownership chips** (`files:` / `resources:`).
- **Status tier badges** (Maintained / Community / Stub).
- **Preview/Beta badge** and **"volatile" tag** (03 §f style notes).
- **Scope chip** (`user` / `repo` / `org` / `enterprise` / `managed`).
- **Glob chip** (`applyTo: **/*.py`).
- **Title, subtitle (takeaway), legend and source/date footer.** Azure Well-Architected guidance says to include metadata ([prior-art §3](prior-art-concept-diagrams.md)).

### 8.4 Styles and presets
- **Concept preset** (clean, role-coloured) for V1–V12 and V18–V34.
- **Reference preset** (official icons, tinted tiers) for V15–V17 and the Tier-3 data-platform reference architecture. Use Databricks and Palantir logos only where official marks are available. The toolkit rule is never to use another product's mark.
- **Sketch preset** for workshop and brainstorm versions. The user values "rough and simple style… and clarity" in Excalidraw (session `46ac6c0f`).
- **Colour semantics, fixed across all diagrams:**
  - human = warm salmon
  - agent = green
  - artifact/memory = lilac
  - tools = blue
  - gates/guardrails = amber
  - platform/environment = neutral grey

  This follows Anthropic-style role colouring and is limited to ≤6 hues. This palette is my recommendation, not taken from a source.

---

## 9. Future-proofing rules (from the volatility evidence)

The sources show heavy churn in a single month:
- Renames: Copilot coding agent → cloud agent → "Copilot in the cloud" (Oct 28, 2026) [02 §g]. DABs → Declarative Automation Bundles, DLT → Spark Declarative Pipelines on Lakeflow, Assistant → Genie Code, AI Gateway → Unity Gateway [05 §e]. Foundry Branching → Global Branching; AIP Agent Studio → Chatbot Studio [05 §e].
- Format changes: OKF v0.3 breaking changes (Nov 18, 2026) [04 §g]. `CONTEXT.md` → `GLOSSARY.md` in mattpocock [04 §g].
- Command changes: `/worktree new` → `/new worktree`; `/plugins` split; `config.json` → `settings.json` [01 §f].
- Preview features: dynamic workflows, gh-aw, automations, connectors, `gh agent-task`, `gh skill`, `gh stack` [01 §f; 02 §g].
- Billing and models: AI-credit billing; model IDs differ between pages [01 §f].

**Rules:**
1. **Structure = roles and capabilities; labels = products.** Every node has `role` (stable) and `label` (product, swappable). Example: "Independent reviewer agent" with the caption "Copilot code review".
2. **One alias glossary** (`glossary.yml`: canonical term → current product name → former names → status → source URL → last verified). Diagrams reference glossary IDs, and a rename becomes a one-line change plus a rebuild.
3. **Data-driven matrices.** Surface × feature, platform mapping and precedence tables are generated from YAML or CSV, never hand-drawn. The docs themselves warn that the capability-by-surface matrix changes [02 §g].
4. **Never hard-code model names, prices or limits** in structural diagrams. Use role labels ("fast explorer model", "critic model from a different family") [01 §f].
5. **Badge volatility.** Preview, Beta, Experimental and Enrollment-specific items carry a badge and a verification date in the footer.
6. **Draw precedence as a rule, not a list.** "First wins", "last wins" and "all merge; deny wins" survive new tiers being added [01 §f].
7. **Draw environment as a variable** (cloud sandbox | Actions runner | remote env; dev/staging/prod) [02 §g].
8. **Draw autonomy as axes** (§5.2). New modes then become points, not a redesign.
9. **Draw OKF links as untyped.** Typed edges are local `x-` conventions [04 §g].
10. **Pin and date sources.** Every diagram footer carries the source URLs (or commit SHA for repos such as MP v1.3.2, SP, template `49dcea9`) and the retrieval date.
11. **Version the catalog.** Keep each diagram spec in git next to the docs (the toolkit already embeds the spec in the `.excalidraw`). Re-verify on a schedule; a monthly Copilot automation could re-fetch sources and diff the glossary. **This is a suggestion and not implemented.**

---

## 10. Application to agentic-agile-template + Databricks / Foundry

**Where the diagrams land** (follows the file-level plan in [05 §B.2]; not implemented):

| Template location (proposed) | Diagrams |
|---|---|
| `README.md` / `MANIFESTO.md` | V1 lifecycle, V3 component map, V8 guardrails |
| `docs/agentic-review-cycle.md` | V10 |
| `docs/epic-decomposition-example.md` | V11, V12 (with a resource-ownership variant) |
| `docs/agent-surface-selection.md` | V4, V7, V32 |
| `platform-adapters/README.md` | V13 (with the `data-platforms/` layer dashed until it ships) |
| `docs/data-platform-delivery.md` (new, Wave 3) | V14, V15, V16, V17, V2 (memory spine with OKF from UC / Ontology), Tier-3 data-platform reference architecture |
| `docs/evaluation-framework.md` | V18 with platform signal overlays (UC audit/lineage; Foundry health checks/build history) |
| Contributor docs | V5, V6, V21 (where a Databricks/Foundry skill, MCP entry or instruction file goes, and what overrides what) |

**Platform-specific must-cover points:**
- **Resource ownership** replaces file ownership as the collision primitive: bundle resource keys and UC objects for Databricks; ontology object/link/action types, datasets and Spaces for Foundry. Show it in V11/V12 without renaming the story's three stable core sections (template invariant #5) [05 §A.4].
- **Two human gates differ by platform:** GitHub Environment `prod` approval versus Foundry **ontology proposal review**. Draw both in V15/V16 and V14.
- **Agent tool governance is in-platform:** Unity Catalog grants plus Unity Gateway; Foundry permissions where "agents do not expand permissions". Show it as the governance ring in V17.
- **Delivery mode split for Foundry:** native Code Repositories versus GitHub-hosted SuperRepo (beta). The latter fits the template's GitHub-centric review loop. Show it as alternate lanes in V16 [05 §B.2].
- **Avoid the "Ontology" collision** between Databricks Genie Ontology and Palantir Ontology [05 §e].

---

## 11. Must-have checklist

- [ ] All 14 component families have a fixed shape, colour and legend entry (§2, §8.1).
- [ ] One master lifecycle (V1) with every human gate drawn as ◆ and every loop drawn.
- [ ] Inner loop + memory spine (V2), naming all four memory roles with aliases (Codex, Superpowers, Matt Pocock's skills, OKF).
- [ ] Autonomy drawn as axes (V7), never as a single ladder.
- [ ] Guardrails drawn as defense in depth with cost and responsible-use rails (V8).
- [ ] Delegation, review convergence and parallel waves (V9–V11) for the three core multi-agent patterns.
- [ ] Customization primitives drawn three ways: purpose (V5), location (V6), precedence (V21).
- [ ] Platform mapping matrix (V14) plus one promotion flow and one tool-access hub per platform (V15–V17).
- [ ] Metrics driver tree with the template's 8 dimensions (V18).
- [ ] Every diagram: role-based structure, product labels from the glossary, preview badges, source + date footer.
- [ ] Toolkit supports the 14 archetypes in §7, or the gaps are explicitly deferred.

---

## 12. Gaps and uncertainties

- **Not read or partially read:**
  - Group 01: linked sub-pages (`allowing-tools`, `/fleet`, OTel, ACP, Fusion) [01 Gaps].
  - Group 02: the gh-aw architecture tail, the firewall defaults page, and the "older experience" table [02 §g].
  - Group 03: no formal maturity model exists, so the adoption ladder is a synthesis [03 §g].
  - Group 04: upstream OKF `SPEC.md` (v0.3 details come via okf.md and the official skills; check section numbers before quoting), and not every MP/SP skill body [04 §H].
  - Group 05: Foundry Code Repositories PR and CI-check pages returned 404; Foundry Platform SDK not found; Palantir MCP tool catalog only partly read [05 §E].
- **okf.md is a community-annotated guide.** Treat the upstream repo spec as normative [04 §g].
- **Inferred, not from sources:**
  - the unified 14-family model (§2) and verb normalization (§3) are my synthesis across sources
  - the colour semantics in §8.4
  - the toolkit effort estimates in §7
  - the "Ontology" disambiguation guidance
  - the OKF-for-UC/Ontology idea (OKF lists Unity Catalog only as a *possible* source; the official producer is BigQuery only [04 §g])
- **Doc inconsistencies left unresolved:** compaction thresholds; custom-agent precedence differs by surface; `*-instructions.md` vs `*.instructions.md` (treat `*.instructions.md` as canonical) [01 §f; 02 §g].
- **Template fork not checked.** I read upstream `microsoft/agentic-agile-template` @ `49dcea9`. Whether the user's customization repo has diverged was not checked [05 §E].
- **No diagrams were built for this report.** The catalog is a specification. The earlier cycle spike (`spike/codex-loop-cycle.png`) is the only rendered proof of a new archetype.

---

## Appendix A: Source index (the user's representative set)

- **Agent Skills:** [mattpocock/skills](https://github.com/mattpocock/skills), [obra/superpowers](https://github.com/obra/superpowers) → 04.
- **GitHub Copilot.** Per-URL records are in the group reports:
  - CLI how-tos, references, plugin/marketplace, config dir, hooks, custom agents, cheat sheets, delegation/fleet, rubber duck, research, canvases, dynamic workflows, custom-agents blog → 01.
  - Autopilot ⭐, Agentic Workflows (concept, quickstart, creating), code review (concept, lifecycle, customize), cloud agent (best results, research-plan-iterate, improve a project, resources, CLI, automations, secrets, skills), comparing customizations, application cards, stacked PRs, review AI code → 02.
  - AI SME, onboarding plan, explore a codebase, cleanup specialist, review code, accessibility auditor, concept explainer, Actions helper, MCP agent mode, optimize AI usage, tech debt, security cookbook ×3, roll-out at scale ×6 → 03.
- **OKF:** okf.md (home, spec, quickstart, tools, skill, validator, examples, FAQ), [open-knowledge-format/open-knowledge-format](https://github.com/open-knowledge-format/open-knowledge-format) → 04.
- **Codex:** iterate on difficult problems, update documentation, AI tour guide, reusable skills, Goals cookbook, long-horizon blog, working with agents, follow goals, agent-friendly CLIs → 04.
- **Target:** [microsoft/agentic-agile-template](https://github.com/microsoft/agentic-agile-template), Databricks docs (bundles, deployment modes, CI/CD, agent skills, managed MCP, Unity Catalog), Foundry docs (Ontology, Pipeline Builder, Global Branching, DevOps/Marketplace, Palantir MCP, VS Code workspaces, AI FDE) → 05.
