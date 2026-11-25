#!/usr/bin/env bash
# Smoke test: the diagram-critic agent must SEE the PNG and report the planted defects.
#   graph: isolated "obs" node -> balanced fail; "e5" crossing the serving tier -> routing fail.
#   board: "ops" card far denser than its row neighbour -> balanced fail; "Agnetic" typo in section "agentic".
# Uses the installed plugin (copilot plugin install jamesmorrissey11/diagram-toolkit) and Copilot auth.
# Set DIAGRAM_TOOLKIT_PLUGIN_DIR=<plugin root> to test an uninstalled checkout via copilot --plugin-dir instead.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)"
CLI="$ROOT/skills/arch-diagram/engine/cli.mjs"
COPILOT=(copilot)
[ -n "${DIAGRAM_TOOLKIT_PLUGIN_DIR:-}" ] && COPILOT+=(--plugin-dir "$DIAGRAM_TOOLKIT_PLUGIN_DIR")
critic() { "${COPILOT[@]}" -p "$1" --agent diagram-toolkit:diagram-critic --allow-all-tools --allow-all-paths 2>&1; }
fail=0

node "$CLI" build "$ROOT/test/critic/defect.json" --out "$OUT/defect" >/dev/null || true
REPLY="$(critic "Review this diagram. PNG: $OUT/defect.png  Spec: $ROOT/test/critic/defect.json  Brief: RAG overview for a docs page. displayWidth: 1200. No previous PNG.")"
if echo "$REPLY" | grep -q '"balanced": "fail"' && echo "$REPLY" | grep -q '"obs"' && echo "$REPLY" | grep -q '"e5"'; then echo "critic smoke (graph): PASS"
else echo "$REPLY"; echo "critic smoke (graph): FAIL"; fail=1; fi

node "$CLI" build "$ROOT/test/critic/board-defect.json" --out "$OUT/board-defect" >/dev/null || true
node "$CLI" render "$OUT/board-defect.excalidraw" --out "$OUT/board-defect.review" --width 800 >/dev/null
REPLY="$(critic "Review this board. Review PNG (already at display size): $OUT/board-defect.review.png  Spec: $ROOT/test/critic/board-defect.json  Brief: the 4 Copilot capability categories as a card visual for research notes. displayWidth: 800. No previous PNG.")"
if echo "$REPLY" | grep -q '"balanced": "fail"' && echo "$REPLY" | grep -q '"ops"' && echo "$REPLY" | grep -q '"agentic"'; then echo "critic smoke (board): PASS"
else echo "$REPLY"; echo "critic smoke (board): FAIL"; fail=1; fi
exit $fail
