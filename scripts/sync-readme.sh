#!/usr/bin/env bash
# Builds README.md = scripts/readme-head.md + docs/HELP.md (without its title, links fixed for the repo root).
# docs/HELP.md is the source of truth. Run: scripts/sync-readme.sh   (CI: scripts/sync-readme.sh --check)
set -euo pipefail
cd "$(dirname "$0")/.."
out=$(mktemp)
{
  cat scripts/readme-head.md
  echo
  tail -n +2 docs/HELP.md | sed -e 's#(SPEC\.md)#(docs/SPEC.md)#g' -e 's#(\.\./bot/#(bot/#g'
} > "$out"
if [ "${1:-}" = "--check" ]; then
  diff -q "$out" README.md >/dev/null || { echo "README.md is out of date: run scripts/sync-readme.sh" >&2; exit 1; }
else
  mv "$out" README.md
fi
