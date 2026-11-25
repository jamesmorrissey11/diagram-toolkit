#!/usr/bin/env bash
# Smoke test: the installed diagram-critic agent must SEE the PNG and report the planted defects
# (isolated "obs" node -> balanced fail; "e5" crossing the serving tier -> routing fail).
# Needs the plugin installed (copilot plugin install jamesmorrissey11/diagram-toolkit) and Copilot auth.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)"
node "$ROOT/skills/arch-diagram/engine/cli.mjs" build "$ROOT/test/critic/defect.json" --out "$OUT/defect" >/dev/null || true
REPLY="$(copilot -p "Review this diagram. PNG: $OUT/defect.png  Spec: $ROOT/test/critic/defect.json  Brief: RAG overview for a docs page. displayWidth: 1200. No previous PNG." \
  --agent diagram-toolkit:diagram-critic --allow-all-tools --allow-all-paths 2>&1)"
echo "$REPLY" | grep -q '"balanced": "fail"' && echo "$REPLY" | grep -q '"obs"' && echo "$REPLY" | grep -q '"e5"' \
  && echo "critic smoke: PASS" || { echo "$REPLY"; echo "critic smoke: FAIL"; exit 1; }
