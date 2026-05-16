# SOTA Implementation Plan

Date: 2026-05-16

Status: implementation plan. Source of truth is `030-sota-audit-master-index/spec.md`. Companion files:
- `INDEX.md` — finding → task mapping
- `LEADER_WORKFLOW.md` — main-context-as-validator workflow
- `tasks/README.md` — implementer instructions
- `tasks/_global-context.md` — required pre-read (AGENTS.md highlights, conventions)
- `tasks/T-<name>/brief.md` — 42 self-contained briefs
- `_review-prompts/{implementer,spec-reviewer,quality-reviewer,fixer,final-sota-verify}.md` — dispatch templates

## Goal

Execute the 44 active findings from spec 030 via 42 task briefs. Each task is implemented by a fresh opus subagent, then passes through a 3-stage review loop (spec → quality → mark complete), then the entire repo passes a final SOTA-verify loop until CLEAN.

**Critical: the main session is the LEADER (thin validator).** Implementation happens in fresh opus subagents per task. The main context never reads source code; it tracks task status and dispatches subagents per `LEADER_WORKFLOW.md`.

## Execution Pattern (Per Task)

```
        ┌──────────────────────────────────┐
        │  Leader picks next pending task  │
        └─────────────────┬────────────────┘
                          │
              ┌───────────▼────────────┐
              │ Dispatch IMPLEMENTER   │  (fresh opus subagent)
              │ (implementer.md)       │
              └───────────┬────────────┘
                          │
            ┌─────────────▼─────────────┐
            │  Implementer reports DONE │
            └─────────────┬─────────────┘
                          │
              ┌───────────▼────────────┐
              │ Dispatch SPEC REVIEWER │  (fresh opus subagent, read-only)
              │ (spec-reviewer.md)     │
              └───────────┬────────────┘
                          │
                  ┌───────▼────────┐
                  │  PASS or FAIL? │
                  └─┬────────────┬─┘
              FAIL  │            │  PASS
                    │            │
        ┌───────────▼──────┐     │
        │ Dispatch FIXER   │     │
        │ (fixer.md)       │     │
        └─────┬────────────┘     │
              │                  │
              │ Re-dispatch       │
              │ spec reviewer     │
              │ (cap: 5 loops)    │
              └──────────►        │
                                  │
                  ┌───────────────▼─────────────┐
                  │ Dispatch QUALITY REVIEWER   │
                  │ (quality-reviewer.md)       │
                  └───────────────┬─────────────┘
                                  │
                ┌─────────────────▼──────────────────┐
                │ APPROVE or REQUEST_CHANGES?        │
                └─┬───────────────────────────────┬──┘
                  │ REQUEST_CHANGES                │ APPROVE
                  │                                │
        ┌─────────▼───────┐                        │
        │ Dispatch FIXER  │                        │
        └─────────┬───────┘                        │
                  │ Re-dispatch quality            │
                  │ reviewer (cap: 5 loops)        │
                  └────────►                       │
                                                   │
                                          ┌────────▼─────────┐
                                          │ Mark COMPLETE    │
                                          │ in TodoWrite     │
                                          └────────┬─────────┘
                                                   │
                                          ┌────────▼─────────┐
                                          │ Pick next task   │
                                          └──────────────────┘
```

## Final SOTA-Verify Loop (after all 42 tasks complete)

```
┌────────────────────────────────────────────┐
│ All 42 tasks COMPLETE + phase gates PASS   │
└────────────────────┬───────────────────────┘
                     │
        ┌────────────▼────────────┐
        │ Dispatch FINAL VERIFIER │  (fresh opus subagent, read-only)
        │ (final-sota-verify.md)  │
        └────────────┬────────────┘
                     │
              ┌──────▼─────┐
              │ CLEAN/DIRTY│
              └─┬────────┬─┘
       DIRTY    │        │  CLEAN
                │        │
   ┌────────────▼──┐     │
   │ For each       │     │
   │ Critical/High  │     │
   │ issue:         │     │
   │   - Dispatch   │     │
   │     fixer per  │     │
   │     source task│     │
   │   - Re-run     │     │
   │     spec+      │     │
   │     quality    │     │
   │     reviewers  │     │
   │ Batch          │     │
   │ Medium/Low     │     │
   │ into one fixer │     │
   └───────┬────────┘     │
           │              │
           │ Re-dispatch  │
           │ FINAL        │
           │ VERIFIER     │
           │ (cap: 10     │
           │  loops)      │
           └──────►       │
                          │
              ┌───────────▼────────────┐
              │ Run pnpm run release-  │
              │ check locally          │
              └───────────┬────────────┘
                          │
                  ┌───────▼────────┐
                  │ Exit 0?        │
                  └─┬────────────┬─┘
              NO    │            │  YES
                    │            │
        ┌───────────▼──┐  ┌──────▼──────────────┐
        │ Re-loop      │  │ Announce SOTA-ready │
        └──────────────┘  │ Surface git diff    │
                          │ Await user approval │
                          │ for changeset+      │
                          │ publish             │
                          └─────────────────────┘
```

## How Agents Use This Plan

Every subagent dispatched against this plan reads ONLY:

1. `AGENTS.md` at repo root (project contract)
2. `tasks/README.md` (universal subagent instructions)
3. `tasks/_global-context.md` (curated conventions + anti-patterns)
4. The role-specific prompt template from `_review-prompts/`
5. Their assigned `tasks/<task-id>/brief.md`
6. Source files explicitly named in the brief

Subagents do NOT read other tasks' briefs, the master index 030, or the audit specs 028/029 (unless the brief explicitly cites a finding ID for context — then ONLY that section).

The leader (main context) does NOT read source code. It reads task lists, INDEX.md, and subagent reports.

## Phase Dependency Graph

```
Phase 0 (Stop-the-bleeding, fully parallel batches)
  Batch 0a (truly independent — dispatch all 6 in one message):
  ├── T-VITE-ALIAS
  ├── T-FIELD-EMPTY
  ├── T-TABS-ZERO
  ├── T-PKG-EXPORTS
  ├── T-PKG-ENGINES
  └── T-LICENSES

  Batch 0b (heavier — dispatch in parallel after 0a or alongside):
  ├── T-CLI-REMOVE
  ├── T-SEC-HONO
  └── T-MOBILE-CRITICAL

Phase 1 (Handoff blockers, after Phase 0 gate passes)
  ├── T-PUBLISH-WF        (needs T-LICENSES + T-BUNDLE-SLIM + T-SEC-HONO)
  ├── T-DOCS-SITE         (needs T-VITE-ALIAS)
  ├── T-DOCS-PROPS
  ├── T-TOAST-OVER-DIALOG
  ├── T-THEME-CONTRACT
  ├── T-BUNDLE-SLIM
  └── T-DIST-DEPLOY       (needs T-DOCS-SITE)

Phase 2 (Library correctness, mostly parallel)
  ├── T-FOCUS-TRAP
  ├── T-OWNER-DOC
  ├── T-DIALOG-HYDRATE
  ├── T-FLOAT-THROTTLE
  ├── T-REDUCED-MOTION
  ├── T-SCROLL-LOCK
  └── T-DIALOG-SCROLL

Phase 3 (Tooling)
  ├── T-DEP-OVERRIDES     (after T-SEC-HONO)
  ├── T-TS-ALIGN
  ├── T-CI-HARDEN         (after T-PUBLISH-WF)
  ├── T-BROWSER-DOCS
  └── T-DOCS-VALIDATE     (after T-DOCS-PROPS)

Phase 4 (Polish + DX)
  ├── T-WEB-CLEANUP       (after T-GENERICS if benefit needed)
  ├── T-TYPOGRAPHY-HEADINGS
  ├── T-ACCORDION-DOCS
  ├── T-EXAMPLES-JSDOC
  ├── T-GENERICS
  ├── T-BUTTON-LAZY
  ├── T-PERF-PALETTE
  ├── T-FORM-RESET
  ├── T-LOCALE-SEARCH
  ├── T-FLOAT-PARENTS     (after T-OWNER-DOC, T-FLOAT-THROTTLE)
  ├── T-LAYERS-Z
  ├── T-LOW-HYGIENE
  └── T-FIELD-CTL

Phase 5 (Verification / E2E)
  └── T-VISUAL-E2E        (after T-DOCS-SITE)

Then: FINAL SOTA-VERIFY LOOP (cap 10) → release-check → announce ready.
```

## Per-Phase Gate Verification (run after each Phase before advancing)

Dispatch a fresh phase-gate verifier subagent (use `_review-prompts/final-sota-verify.md` scoped to the relevant commands):

```bash
# After Phase 0
pnpm install
pnpm --filter @diffgazer/docs build       # NEW-021/NEW-001 must pass
pnpm --filter @diffgazer/ui test
pnpm --filter @diffgazer/keys test
pnpm --filter @diffgazer/add test
# Live repro for CLI-001 (full sequence in final-sota-verify.md)
pnpm audit --prod --audit-level=moderate   # consumer-facing CVEs must be zero

# After Phase 1
pnpm --filter @diffgazer/docs build:prerender   # must exit zero
pnpm --filter @diffgazer/docs preview            # spot-check pages render content
pnpm pack --dry-run                               # both libs <5 MB unpacked
# .github/workflows/release.yml exists and lints

# After Phase 2
pnpm --filter @diffgazer/ui test
pnpm --filter @diffgazer/keys test
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check

# After Phase 3
pnpm dedupe --check                              # must exit zero

# After Phase 4 + 5: enter FINAL SOTA-VERIFY LOOP (see _review-prompts/final-sota-verify.md)
```

If a phase gate fails, dispatch fixers per the failing checks before advancing.

## Agent Brief Contract (every brief.md follows this)

```markdown
# Task <task-id> — <one-line title>

**Source findings:** <NEW-XXX, REL-001, ...>
**Severity:** Critical | High | Medium | Low
**Phase:** 0..5
**Blocks:** <other tasks that depend on this>
**Blocked by:** <prereq tasks>

## Goal
<one paragraph>

## Files to touch (allowlist)
- <path:line>
- <path>

## Files NOT to touch
- <out-of-scope>

## Acceptance criteria
- [ ] <observable check>
- [ ] <verification command exits zero>

## Verification commands
\```bash
<exact commands>
\```

## Notes & references
- AGENTS.md sections that apply
- Reference impls
- Failure modes seen in audit

## Non-goals
<things to NOT do — keep scope tight>

## (Optional) Implementation hints
<design snippets, references>

## (Optional, appended) Agent Guidance
### Pre-flight
### Common pitfalls
### Self-check before reporting
### When to flag BLOCKED
```

## Output Reporting

See `_review-prompts/implementer.md`, `spec-reviewer.md`, `quality-reviewer.md`, `fixer.md`, `final-sota-verify.md` for exact report templates per role.

## Iteration caps (summary)

| Loop | Cap | Action on cap |
|------|-----|---------------|
| Spec-review fix loop (per task) | 5 | Mark task BLOCKED, surface |
| Quality-review fix loop (per task) | 5 | Mark task BLOCKED, surface |
| Phase-gate verification | 5 | Surface phase regression |
| Final SOTA-verify loop | 10 | Concise summary, await user |

These caps prevent infinite loops on broken briefs or environmental issues.

## When the Leader Involves the User

- Hard cap reached on any loop
- Task BLOCKED with no obvious next step
- Brief contradicts AGENTS.md and reviewer flags it
- Two reviewers disagree (escalate so user decides whether to update the brief)
- After CLEAN final verify, before publish (user approves changeset + publish trigger)

Otherwise, the leader runs autonomously through the loop.
