# Final SOTA-Verify Loop Dispatch Template

**Use this when:** All 42 tasks have passed implementer + spec-review + quality-review. The leader now runs a `/sota-verify`-style end-to-end loop until the entire repo is clean.

**Model:** opus.

**Loop:** The verify pass dispatches a verifier subagent. If it finds issues, leader dispatches a fixer per issue. Re-run verifier. Loop until verifier returns CLEAN. Hard cap: 10 iterations. If still dirty, escalate.

---

## Phase A — Dispatch sota-verifier subagent

```
You are the FINAL SOTA VERIFIER subagent. All 42 tasks from spec 031 have been implemented and reviewed. Your job is to run the full release-readiness gauntlet, identify ANY remaining issues, and report them prioritized for fix.

## DO NOT modify code. Verify only.

## Mandatory pre-read

1. /Users/voitz/Projects/diffgazer-workspace/AGENTS.md
2. /Users/voitz/Projects/diffgazer-workspace/PACKAGE_GOVERNANCE.md
3. /Users/voitz/Projects/diffgazer-workspace/libs/ui/specs/030-sota-audit-master-index/spec.md (the original master finding index — verify each Active finding is genuinely closed)

## Verification commands (run ALL, in order)

```bash
cd /Users/voitz/Projects/diffgazer-workspace
git status --short
pnpm install --frozen-lockfile

# Per-package gates
pnpm --filter @diffgazer/keys test 2>&1 | tee /tmp/sv-keys-test.log
pnpm --filter @diffgazer/keys type-check 2>&1 | tee /tmp/sv-keys-tc.log
pnpm --filter @diffgazer/keys validate:registry 2>&1 | tee /tmp/sv-keys-vr.log
pnpm --filter @diffgazer/ui test 2>&1 | tee /tmp/sv-ui-test.log
pnpm --filter @diffgazer/ui type-check 2>&1 | tee /tmp/sv-ui-tc.log
pnpm --filter @diffgazer/ui validate:registry 2>&1 | tee /tmp/sv-ui-vr.log
pnpm --filter @diffgazer/add test 2>&1 | tee /tmp/sv-add-test.log
pnpm --filter @diffgazer/add type-check 2>&1 | tee /tmp/sv-add-tc.log
pnpm --filter @diffgazer/registry test 2>&1 | tee /tmp/sv-registry-test.log
pnpm --filter @diffgazer/registry type-check 2>&1 | tee /tmp/sv-registry-tc.log

# Docs
pnpm --filter @diffgazer/docs build:prerender 2>&1 | tee /tmp/sv-docs-build.log
pnpm --filter @diffgazer/docs test 2>&1 | tee /tmp/sv-docs-test.log

# Web (smoke)
pnpm --filter @diffgazer/web type-check 2>&1 | tee /tmp/sv-web-tc.log
pnpm --filter @diffgazer/web test 2>&1 | tee /tmp/sv-web-test.log

# Monorepo gates
pnpm run prepare:artifacts 2>&1 | tee /tmp/sv-prep.log
pnpm run validate:artifacts:check 2>&1 | tee /tmp/sv-val.log
pnpm run verify:monorepo 2>&1 | tee /tmp/sv-mono.log
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check 2>&1 | tee /tmp/sv-turbo-tc.log
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test 2>&1 | tee /tmp/sv-turbo-test.log
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test:types 2>&1 | tee /tmp/sv-turbo-tt.log
DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke 2>&1 | tee /tmp/sv-smoke.log
pnpm run smoke:packages 2>&1 | tee /tmp/sv-smoke-pkg.log

# Security + dep governance
pnpm audit --prod --audit-level=moderate 2>&1 | tee /tmp/sv-audit.log
pnpm dedupe --check 2>&1 | tee /tmp/sv-dedupe.log

# Pack checks
pnpm --filter @diffgazer/keys pack --dry-run --json 2>&1 | tee /tmp/sv-keys-pack.json
pnpm --filter @diffgazer/ui pack --dry-run --json 2>&1 | tee /tmp/sv-ui-pack.json
pnpm --filter @diffgazer/add pack --dry-run --json 2>&1 | tee /tmp/sv-add-pack.json
pnpm --filter diffgazer pack --dry-run --json 2>&1 | tee /tmp/sv-diffgazer-pack.json

# Final gates
pnpm run release-check 2>&1 | tee /tmp/sv-release.log
git diff --check 2>&1 | tee /tmp/sv-diff.log
```

## Live repros from spec 030 (consumer-safety smokes)

```bash
# CLI-001 repro
rm -rf /tmp/sv-cli-001 && mkdir /tmp/sv-cli-001 && cd /tmp/sv-cli-001
pnpm init -y && pnpm add -D vite @vitejs/plugin-react react react-dom typescript
pnpm add /Users/voitz/Projects/diffgazer-workspace/cli/add
mkdir -p src/components src/lib
echo '{"$schema":"https://diffgazer.com/schema/diffgazer.json","components":"src/components/ui","aliases":{"components":"@/components","utils":"@/lib/utils"}}' > diffgazer.json
pnpm exec dgadd add ui/dialog --yes
EXPECTED_RETAIN=$(pnpm exec dgadd remove ui/button --yes 2>&1)
echo "$EXPECTED_RETAIN" | grep -q "Keeping ui/button" && echo "CLI-001 PASS" || echo "CLI-001 FAIL"

# CLI-003 repro
echo "// drift" >> src/components/ui/shared/portal.tsx 2>/dev/null
DIFF_RESULT=$(pnpm exec dgadd diff 2>&1)
echo "$DIFF_RESULT" | grep -q "portal" && echo "CLI-003 PASS" || echo "CLI-003 FAIL"

# DIST-001 repro (must still be NXDOMAIN OR resolve correctly — depends on T-DIST-DEPLOY decision)
host diffgazer.com 2>&1 | grep -E "NXDOMAIN|has address" || echo "DIST-001 inconclusive"
```

## Cross-reference against spec 030 master index

For each Active finding in 030 (REL-001, CLI-001..003, DIST-001, etc.), verify it is genuinely closed by checking:
- The corresponding task brief's acceptance criteria (file:line evidence)
- Verification commands above (relevant ones exit 0)

If a finding looks "fixed" but the verification command fails, it's not actually closed.

## Report template

```markdown
## Final SOTA Verify Report

**Iteration:** <e.g., "Round 1 of up to 10">
**Verdict:** CLEAN | DIRTY
**Date:** <ISO date>

### Command exit codes (summary)
| Command | Exit | Status |
|---------|------|--------|
| pnpm install --frozen-lockfile | 0 | PASS |
| pnpm --filter @diffgazer/keys test | 0 | PASS |
| ... | ... | ... |
| pnpm run release-check | 0/N | PASS/FAIL |
| git diff --check | 0 | PASS |

### Live repro results
- CLI-001: PASS | FAIL (output: ...)
- CLI-003: PASS | FAIL
- DIST-001: PASS | FAIL | inconclusive

### Spec 030 finding closure status
| Finding | Task | Closed | Evidence |
|---------|------|--------|----------|
| REL-001 | T-PUBLISH-WF | YES | `.github/workflows/release.yml:N` exists, uses changesets/action |
| CLI-001 | T-CLI-REMOVE | YES | Live repro printed "Keeping ui/button..." |
| ... | ... | ... | ... |

### Remaining issues (sorted by severity)

**Critical (blocks publish):**
- <issue> at <file:line> — recommended task: T-<existing-or-NEW>

**High:**
- <issue>

**Medium:**
- <issue>

**Low:**
- <issue>

### New issues discovered during verify (not in spec 030)
- <issue> — recommend filing as NEW-XXX in a follow-up audit, or open a fix brief inline

### Decision
**CLEAN** → SOTA handoff-ready. Leader can mark spec 031 complete, run T-DIST-DEPLOY if not done, then publish.
**DIRTY** → For each issue, leader dispatches a fixer subagent (see `_review-prompts/fixer.md`) referencing the source task brief. After fixers report, re-run THIS verifier (next iteration).

### Logs
- All command output captured at `/tmp/sv-*.log` and `/tmp/sv-*.json` — preserved for leader inspection if needed.
```

End your message after the Report. Do NOT modify code.
```

---

## Phase B — Leader loop logic

After Phase A returns DIRTY:

```
For each Critical / High issue in the report:
  1. Determine which spec 031 task it belongs to (lookup in INDEX.md)
  2. Dispatch a fixer subagent with:
     - The original task brief (path)
     - The verifier's specific issue text
     - Reference to fixer.md template
  3. After fixer reports done, dispatch the original task's spec-reviewer to confirm spec compliance still holds
  4. After spec-review PASS, dispatch quality-reviewer
  5. After quality APPROVE, move to next issue

For Medium / Low issues:
  - Batch them into a single "polish fixer" agent that addresses many small items at once
  - Same review chain

After all issues from THIS verify round are addressed:
  6. Re-dispatch Phase A verifier (next iteration)
  7. Loop until CLEAN or hit iteration cap

Iteration cap: 10 rounds. If still DIRTY at round 10:
  - Surface a concise summary to the user (max 200 words):
    * Which findings are stuck
    * What was attempted
    * What blocks closure
  - Recommend either (a) extending the cap with reason, (b) deferring specific items to follow-up, (c) human intervention
```

## Phase C — Final declaration

When Phase A returns CLEAN:

```
Mark all 42 tasks complete in TodoWrite.
Run a final smoke locally:
  pnpm run release-check

Report to user:
- All 42 tasks closed
- spec 030 active findings: all verified closed (link evidence)
- Repo state: clean working tree, all tests pass, audit clean, dedupe clean
- Ready for: human review of git diff, changeset creation, publish workflow trigger

Recommend user reviews the cumulative git diff (`git diff main`) before approving merge/publish.
```
