#!/bin/zsh
cd /Users/voitz/Projects/diffgazer-workspace
OUT=.nuke/2026-06-04-structure/phase7-gates-final
mkdir -p "$OUT"
: > "$OUT/summary.txt"
run_gate() {
  local name="$1"; shift
  echo "=== GATE: $name ==="
  "$@" > "$OUT/$name.log" 2>&1
  echo "$name EXIT=$?" | tee -a "$OUT/summary.txt"
  return 0
}
run_gate "prepare-artifacts" pnpm run prepare:artifacts
run_gate "type-check" env DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check
run_gate "validate-artifacts" pnpm run validate:artifacts:check
run_gate "test" env DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test
run_gate "test-scripts" pnpm run test:scripts
run_gate "check" pnpm run check
run_gate "knip-report" pnpm run knip
echo "(knip staged non-blocking per spec)" >> "$OUT/summary.txt"
run_gate "smoke" env DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke
run_gate "verify-monorepo" pnpm run verify:monorepo
run_gate "git-diff-check" git diff --check
cat "$OUT/summary.txt"
