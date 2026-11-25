#!/usr/bin/env bash
# Smoke test: an installed copy of the plugin can run the arch-diagram skill's engine path
# (<skill base>/engine/cli.mjs) from the skill's absolute base directory and build one of its reference examples.
#   scripts/installed-smoke.sh [<plugin root>]   default: the installed diagram-toolkit under ~/.copilot/installed-plugins
set -euo pipefail
PLUGIN="${1:-$(ls -d "$HOME"/.copilot/installed-plugins/*/*diagram-toolkit* 2>/dev/null | head -1 || true)}"
[ -d "$PLUGIN" ] || { echo "installed smoke: no diagram-toolkit plugin found (pass its root as \$1)"; exit 1; }
BASE="$(cd "$PLUGIN/skills/arch-diagram" && pwd)"
OUT="$(mktemp -d)"
cd "$OUT"   # run from an unrelated directory, as Copilot would
cp "$BASE/references/examples/hub-agent-loop.json" "$OUT/diagram.json"
node "$BASE/engine/cli.mjs" build "$OUT/diagram.json" --json > "$OUT/result.json" || true
if node -e 'const r=require(process.argv[1]); process.exit(r.ok ? 0 : 1)' "$OUT/result.json" \
  && [ -s "$OUT/diagram.png" ] && [ -s "$OUT/diagram.excalidraw" ]; then
  echo "installed smoke: PASS ($PLUGIN)"
else cat "$OUT/result.json"; echo "installed smoke: FAIL ($PLUGIN)"; exit 1; fi
