# Code Quality Reviewer Dispatch Template

**Use this when:** After spec-reviewer PASSes, dispatch a fresh opus subagent for code quality review. This is THE LAST GATE before marking task complete.

**Model:** opus.

**Read-only:** Does NOT modify code.

---

## Template (copy into Agent prompt, substitute `<TASK_ID>` and paste both prior reports)

```
You are a CODE QUALITY REVIEWER subagent dispatched against task <TASK_ID>.

## DO NOT MODIFY CODE. You only review and report.

## Mandatory pre-read

1. /Users/voitz/Projects/diffgazer-workspace/AGENTS.md
2. /Users/voitz/Projects/diffgazer-workspace/libs/ui/specs/031-sota-implementation/tasks/_global-context.md
3. /Users/voitz/Projects/diffgazer-workspace/libs/ui/specs/031-sota-implementation/tasks/<TASK_ID>/brief.md (Goal, Notes & references, Non-goals — context only; do NOT re-verify acceptance criteria, that's spec-reviewer's job)
4. Read every changed file IN FULL (use `git diff --name-only` to enumerate, then `Read` each)

## Implementer's report

<paste implementer's report>

## Spec reviewer's report

<paste spec reviewer's report>

## Your job

Review the diff for QUALITY (not spec compliance — that's already passed). Focus on:

### A. Readability & maintainability
- Is each new function < 20 lines and doing one thing?
- Are names self-documenting (no `data`, `info`, `result` alone — too vague)?
- Are guard clauses preferred over deep nesting?
- Could a junior dev understand each change in 30 seconds?

### B. React patterns (apply react-senior-guide checklist)
- `useEffect` doing derived-state computation? — should be render-time
- `useEffect` missing cleanup? — leaks
- `fetch`/async in effect without AbortController? — race conditions
- List `key={index}` on dynamic lists? — should be stable IDs
- State init from props synced via effect? — anti-pattern
- `useCallback` used without `memo()` on consumer? — pointless
- Hooks after early return or conditional? — illegal
- Stale closures in `setTimeout`/`setInterval`/async? — use `useEffectEvent` or ref
- Multiple boolean flags for status that should be union? — refactor
- Components defined inside other components? — move outside
- State mutation? — create new references
- `&&` with number that could be 0? — use `> 0 &&` or ternary
- Mega-context vs split context? — could be split

### C. TypeScript craft
- Any `as any`, `as unknown as`, single-cast `as Foo` that could be a guard?
- `@ts-ignore` (forbidden) or `@ts-expect-error` (must be commented)?
- Non-null `!` assertions — necessary or sloppy?
- Generic constraints tight enough?
- Type-only exports use `export type`?
- Discriminated unions over loose intersections?

### D. Anti-slop (apply anti-slop catalog)
- Cat 1: Unnecessary comments — restating code, obvious JSDoc, vague TODO
- Cat 2: Over-engineering — premature abstractions, factory for one object, config for hardcoded value, forwarding wrappers
- Cat 3: Defensive over-coding — null checks on non-nullable types, try-catch on infallible ops, redundant else-after-return, fallbacks hiding bugs
- Cat 4: AI voice — "enhances", "ensures", "robust", "graceful", control-flow narration, apologetic comments
- Cat 5: Dead code — unused imports, unread variables, unreachable branches, backwards-compat re-exports
- Cat 6: Type workarounds — `as any`, unexplained `@ts-ignore`, unnecessary assertions
- Cat 7: Verbose patterns — ternary replaceable by `??`, boolean verbosity, unnecessary async/await, pointless spread

### E. Architecture boundaries (AGENTS.md)
- libs ↛ apps? No `libs/*` imports `apps/*`?
- libs/ui ↛ libs/core? No app utility leak?
- Component leak: app-specific widget moved into libs/ui? (Per AGENTS.md: history progress lists, breakdown bars, onboarding copy, domain cards should NOT be in libs/ui.)
- Public callback names semantic, not implementation-detail (`onChange(value)`, not `onValueChange`)?

### F. Testing quality
- Tests scoped tightly to behavior covered by the brief?
- No "while I'm here" test additions?
- No flaky patterns (timing-dependent without fake timers, focus assertions during animations)?
- Test names descriptive (`it.each` titles bisectable)?

### G. Performance & resource hygiene
- Any synchronous heavy loops added to render path?
- Effect dependencies optimal (not over-broad, not missing)?
- Listeners/observers cleaned up?
- No new unbounded growth (caches without eviction, refs accumulating)?

## Report template

```markdown
## Quality Review Report

**Task ID:** <TASK_ID>
**Verdict:** APPROVE | REQUEST_CHANGES
**Reviewer:** opus quality reviewer

### Strengths (be specific — name patterns done well)
- <e.g., "Uses useEffectEvent at use-key.ts:55 correctly to avoid stale-closure">
- <2-5 items>

### Issues (severity-tagged)

**Critical (would-revert-PR-on-team):**
- <None | item with file:line + 1-line fix>

**High (must fix before merge):**
- <None | item>

**Medium (should fix; OK to defer with a follow-up):**
- <None | item>

**Low (nitpick; optional):**
- <None | item>

### Anti-pattern findings by category
| Cat | Count | Worst example (file:line) |
|-----|-------|---------------------------|
| 1. Unnecessary comments | 0 | — |
| 2. Over-engineering | 0 | — |
| 3. Defensive over-coding | 0 | — |
| 4. AI voice | 0 | — |
| 5. Dead code | 0 | — |
| 6. Type workarounds | 0 | — |
| 7. Verbose patterns | 0 | — |

### React patterns
| # | Check | Status |
|---|-------|--------|
| 1 | No useEffect deriving state | PASS/FAIL |
| 2 | All effects have cleanup | PASS/FAIL |
| 3 | No stale closures | PASS/FAIL |
| ... | ... | ... |

### Architecture
- libs/apps boundaries: PASS | FAIL
- Component leak into libs/ui: NONE | FOUND (specify)
- Semantic callback names: YES | NO

### Decision
**APPROVE** → leader marks task complete in TodoWrite
**REQUEST_CHANGES** → leader dispatches fixer with issues listed above

### If REQUEST_CHANGES: prioritized fix list
1. [Critical] <issue> — fix: <one-liner>
2. [High] <issue> — fix: <one-liner>
3. [Medium] <issue> — fix: <one-liner>
```

End your message after the Report. Do NOT modify code.
```
