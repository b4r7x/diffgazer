#!/bin/zsh
# Baseline gate run for nuke-fix — captures each gate's output + exit code.
cd /Users/voitz/Projects/diffgazer-workspace
OUT=.nuke/2026-06-04-structure/baseline
mkdir -p "$OUT"

run_gate() {
  local name="$1"; shift
  echo "=== GATE: $name ==="
  "$@" > "$OUT/$name.log" 2>&1
  local code=$?
  echo "$name EXIT=$code" | tee -a "$OUT/summary.txt"
  return 0
}

: > "$OUT/summary.txt"

# prepare artifacts first (generated dirs are not committed; root type-check/test need them)
run_gate "prepare-artifacts" pnpm run prepare:artifacts

run_gate "type-check" env DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check
run_gate "test" env DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test
run_gate "validate-artifacts" pnpm run validate:artifacts:check
run_gate "smoke" env DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke
run_gate "verify-monorepo" pnpm run verify:monorepo
run_gate "git-diff-check" git diff --check

echo "=== BASELINE COMPLETE ==="
cat "$OUT/summary.txt"
