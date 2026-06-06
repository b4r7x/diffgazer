#!/bin/zsh
cd /Users/voitz/Projects/diffgazer-workspace
OUT=.nuke/2026-06-04-structure/phase6-gates
mkdir -p "$OUT"
: > "$OUT/summary.txt"
run_gate() {
  local name="$1"; shift
  echo "=== GATE: $name ==="
  "$@" > "$OUT/$name.log" 2>&1
  echo "$name EXIT=$?" | tee -a "$OUT/summary.txt"
  return 0
}
run_gate "pnpm-install" pnpm install
run_gate "prepare-artifacts" pnpm run prepare:artifacts
run_gate "type-check" env DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check
run_gate "validate-artifacts" pnpm run validate:artifacts:check
run_gate "test" env DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test
run_gate "smoke" env DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke
run_gate "verify-monorepo" pnpm run verify:monorepo
run_gate "git-diff-check" git diff --check
# F-213: keys tarball must NOT contain internal-docs-manifest.json
pnpm --filter @diffgazer/keys pack --dry-run > "$OUT/keys-pack.log" 2>&1
if grep -q 'internal-docs-manifest.json' "$OUT/keys-pack.log"; then
  echo "keys-pack-manifest-ban EXIT=1 (manifest FOUND in tarball)" | tee -a "$OUT/summary.txt"
else
  echo "keys-pack-manifest-ban EXIT=0" | tee -a "$OUT/summary.txt"
fi
# lockfile sanity: diff is manifest/config/markdown + lockfile only
git diff --name-only | grep -E '\.(ts|tsx)$' | grep -v '.nuke/' > "$OUT/source-files-in-diff.txt" || true
echo "source-ts-files-changed: $(wc -l < "$OUT/source-files-in-diff.txt" | tr -d ' ') (expected: only prior-phase files, no NEW ones from phase 6)" | tee -a "$OUT/summary.txt"
cat "$OUT/summary.txt"
