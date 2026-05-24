# Agent Guidance (Mandatory Pre-Read for IMPLEMENTERS)

This file applies to every implementer subagent dispatched against any brief in this directory. Read after `_global-context.md` and before your `<TASK_ID>/brief.md`.

The brief contains task-specific scope (allowlist, acceptance criteria, verification commands). This file contains the universal craftsmanship rules — what to do before you start, common pitfalls, self-check, and when to stop.

## Pre-flight (run BEFORE touching code)

If any of these fail for reasons unrelated to your task, REPORT BLOCKED — don't try to fix infra problems silently.

1. `cd /Users/voitz/Projects/diffgazer-workspace` then `pnpm install --frozen-lockfile` succeeds.
2. `git status --short` shows a clean (or expected) working tree. If random unrelated changes appear, REPORT BLOCKED so leader investigates.
3. Run ALL verification commands from the brief BEFORE making changes — establish baseline. Some commands will fail (the bug exists!); some will pass (build infra OK). Note both for your report.
4. If the brief cites `file:line` refs, open those files first and confirm the lines still match the brief's description. If the file has drifted significantly, STOP and report — your brief may be stale.
5. If your brief depends on another task (per "Blocked by"), confirm that task's effects are present before starting. E.g., if you're doing T-DOCS-SITE which is "Blocked by: T-VITE-ALIAS", confirm `pnpm --filter @diffgazer/docs build` works first.

## Common pitfalls (avoid these)

- **Allowlist creep:** A file you "need to" touch isn't in the allowlist. Stop. Report. Do not silently expand scope. 95% of "I need to touch X" cases are solvable within the allowlist; the other 5% mean the brief is wrong and needs amendment.
- **Forgot to regenerate public registry:** If you modified a file under `libs/ui/registry/**` or `libs/keys/src/**` that contributes to the public handoff, run `pnpm --filter @diffgazer/<pkg> build:shadcn` BEFORE running `validate:registry`. Otherwise validate mysteriously fails.
- **Adding tests that test mocks:** If your test uses `vi.mock` and asserts on the mock's call count or method invocation, you're testing the mock, not the code. Re-read TESTING.md rule 1 and rewrite to assert on user-visible behavior (rendered output, focus, ARIA, returned values).
- **AI-voice in comments:** Generated comments slip in "ensures", "robust", "graceful", "enhances", "comprehensive", "Here we", "Let's", "First we", "Now we". Re-read every comment you wrote. Delete or rewrite.
- **`as` casts for convenience:** If `as Foo` was your fix to a TS error, the type is wrong somewhere. Fix the type. `as` is only acceptable when you have runtime knowledge TS cannot derive (rare; document why with a comment).
- **`useEffect` syncing derived state:** If `setX` follows directly from a prop or other state, compute X during render. Per AGENTS.md React rules.
- **Forgot `await` on async test setup:** Flaky tests are usually missing awaits on `user.click()`, `findBy*`, or React Testing Library `act()`.
- **TypeScript `noUncheckedIndexedAccess`:** If libs/ui's tsconfig adopts this (per T-TS-ALIGN), `array[0]` becomes `T | undefined`. Don't `array[0]!` — use a guard: `const x = array[0]; if (!x) continue;`.
- **Side-effect changes to other packages:** If your fix in libs/ui breaks libs/keys (or vice versa), STOP. The fix is in the wrong place. Re-read the brief's allowlist.
- **Running `pnpm install` mid-task and seeing lockfile drift:** Lockfile changes belong to T-DEP-OVERRIDES or T-SEC-HONO. If your task isn't one of those and you see lockfile changes, revert them with `git checkout pnpm-lock.yaml` and investigate WHY pnpm wants to change it (likely you accidentally bumped a dep).

## Self-check before reporting

Run this on your final diff. Each `□` must be true:

```
□ git diff --stat shows ONLY allowlisted files
□ ALL brief verification commands exit 0 (or match expected-failure pattern)
□ Each `- [ ]` acceptance criterion has file:line OR test name as evidence
□ Zero `as any`, `@ts-ignore`, `@ts-nocheck`, `Math.random()` introduced
□ Zero "Here we...", "Let's...", "ensures", "robust", "enhances", "graceful", "comprehensive" in code or comments
□ Zero console.log / debug statements remaining
□ Public registry regenerated if registry source touched:
    pnpm --filter @diffgazer/ui build:shadcn      (UI registry items)
    pnpm --filter @diffgazer/keys build:shadcn    (keys registry items)
□ pnpm --filter @diffgazer/<package> type-check passes
□ pnpm --filter @diffgazer/<package> test (scoped to affected) passes
□ vi.mock additions carry `// Boundary mock: <why>` annotation
□ fireEvent additions carry `// fireEvent retained: <why>` annotation
□ querySelector additions (rare; allowed in keys focus tests + structural a11y) carry `// querySelector: <why>` annotation
□ Comments restate WHY (non-obvious), not WHAT (the code already says)
□ No new dependency added unless brief authorizes
□ No public API name change unless brief authorizes
□ No `forwardRef` added (React 19 — ref is regular prop)
□ No defensive useMemo/useCallback/memo added without measured perf reason
□ Hooks called unconditionally before any early return
```

## When to flag BLOCKED (do not ship broken code to clear a checkbox)

STOP and report BLOCKED if:

- The bug doesn't repro per the brief → the brief may be stale or the bug already fixed.
- A verification command fails for a reason inside the allowlist that you cannot debug after 30 minutes.
- The brief's acceptance criteria requires touching a file outside the allowlist.
- Two reasonable interpretations of the brief exist and you cannot decide.
- An adjacent bug in a non-allowlisted file blocks your task (note it for leader follow-up; don't fix it).
- You've spent more than 90 minutes total and made no measurable progress.
- A required external resource is unavailable (DNS, npm registry, network).
- A peer dependency upgrade required by your fix conflicts with another package's pin.

Report blocking reasons concisely (3-5 sentences) so the leader can either answer your question or amend the brief.

## After you report

STOP. Do NOT continue working past the Report. The leader will:

1. Read your report
2. Either dispatch a spec-reviewer (if status=done) or address your BLOCKED reason
3. If reviewers find issues, leader dispatches a FIXER subagent — a fresh new agent with a new context. You (original implementer) are NOT re-asked to fix.
4. After all reviewers PASS, leader marks the task complete.

You do not wait or check back. Your job ends at the Report.

## Universal command reference (cheatsheet)

```bash
# From repo root
cd /Users/voitz/Projects/diffgazer-workspace

# Common verification gates
pnpm --filter @diffgazer/keys test               # keys unit tests
pnpm --filter @diffgazer/keys type-check         # keys TS check
pnpm --filter @diffgazer/keys validate:registry-cleanup  # keys public registry check
pnpm --filter @diffgazer/keys build:shadcn       # regenerate keys public registry

pnpm --filter @diffgazer/ui test                 # UI unit tests
pnpm --filter @diffgazer/ui type-check           # UI TS check
pnpm --filter @diffgazer/ui validate:registry    # UI public registry check
pnpm --filter @diffgazer/ui build:shadcn         # regenerate UI public registry
pnpm --filter @diffgazer/ui build:docs-data      # regenerate UI docs metadata

pnpm --filter @diffgazer/add test                # dgadd CLI tests
pnpm --filter @diffgazer/add type-check
pnpm --filter @diffgazer/registry build          # build the registry engine
pnpm --filter @diffgazer/registry test

pnpm --filter @diffgazer/docs build              # docs site build (default)
pnpm --filter @diffgazer/docs build:prerender    # with prerender
pnpm --filter @diffgazer/docs type-check
pnpm --filter @diffgazer/docs test

pnpm --filter @diffgazer/web test
pnpm --filter @diffgazer/web type-check

# Monorepo gates
pnpm run prepare:artifacts                       # regenerate all generated docs/CLI data
pnpm run validate:artifacts:check                # non-mutating validation
pnpm run verify:monorepo                         # monorepo invariant check
pnpm run smoke                                   # full smoke: cli + packages + shadcn
pnpm run smoke:cli
pnpm run smoke:packages
pnpm run smoke:shadcn
pnpm audit --prod --audit-level=moderate         # CVE audit
pnpm dedupe --check                              # lock-dedupe drift check

# Per-task scoped test runs
pnpm --filter @diffgazer/ui test -- field        # only field tests
pnpm --filter @diffgazer/ui test -- "popover|tooltip|select"  # regex
pnpm --filter @diffgazer/keys test -- focus-trap
```

## Standard scoped report shape (for your final message)

(Full template in `_review-prompts/implementer.md` — this is the abbreviated reference.)

```markdown
## Report

**Status:** done | partial | blocked
**Task ID:** T-XXX
**Allowlist compliance:** confirmed via `git diff --stat`

**Changed files:**
- path:N — what changed

**Pre-flight:**
- baseline commands + results

**Implementation summary:**
- 3-6 bullets

**Verification output:**
- each command's output

**Acceptance criteria status:**
- [x] / [ ] each with evidence

**Self-check status:**
- [x] each line of the self-check above

**Deferred / open questions:**
- punted items

**Follow-up tasks needed:**
- adjacent bugs spotted

**git diff --stat:**
- output
```
