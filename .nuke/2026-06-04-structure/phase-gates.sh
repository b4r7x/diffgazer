#!/bin/zsh
# Phase exit gate run — usage: zsh phase-gates.sh <outdir-name>
cd /Users/voitz/Projects/diffgazer-workspace
OUT=.nuke/2026-06-04-structure/$1
mkdir -p "$OUT"

run_gate() {
  local name="$1"; shift
  echo "=== GATE: $name ==="
  "$@" > "$OUT/$name.log" 2>&1
  echo "$name EXIT=$?" | tee -a "$OUT/summary.txt"
  return 0
}

: > "$OUT/summary.txt"

run_gate "prepare-artifacts" pnpm run prepare:artifacts
run_gate "type-check" env DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check
run_gate "validate-artifacts" pnpm run validate:artifacts:check
run_gate "test" env DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test
run_gate "smoke" env DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke
run_gate "verify-monorepo" pnpm run verify:monorepo
run_gate "git-diff-check" git diff --check
git diff -M --stat > "$OUT/diff-M-stat.log" 2>&1
echo "diff-M-stat written ($(wc -l < "$OUT/diff-M-stat.log") lines)" | tee -a "$OUT/summary.txt"

echo "=== GATES COMPLETE ==="
cat "$OUT/summary.txt"
