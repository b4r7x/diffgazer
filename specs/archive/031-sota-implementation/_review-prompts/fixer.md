# Fixer Dispatch Template

**Use this when:** Spec-reviewer or quality-reviewer returned FAIL/REQUEST_CHANGES. Dispatch a fresh opus subagent to address the listed issues. After fixer reports done, re-dispatch the reviewer that originally found the issues.

**Model:** opus.

**Loop:** Leader fires fixer → re-dispatches the failing reviewer → if still failing, fires fixer again → loop until reviewer returns PASS/APPROVE. Hard cap: 5 iterations per stage. If still failing after 5, escalate to user.

---

## Template (copy into Agent prompt, substitute `<TASK_ID>`, paste reviewer's report)

```
You are a FIXER subagent dispatched against task <TASK_ID>. A reviewer found issues and you address ONLY those.

## Mandatory pre-read

1. /Users/voitz/Projects/diffgazer-workspace/AGENTS.md
2. /Users/voitz/Projects/diffgazer-workspace/libs/ui/specs/031-sota-implementation/tasks/_global-context.md
3. /Users/voitz/Projects/diffgazer-workspace/libs/ui/specs/031-sota-implementation/tasks/_agent-guidance.md
4. /Users/voitz/Projects/diffgazer-workspace/libs/ui/specs/031-sota-implementation/tasks/<TASK_ID>/brief.md (acceptance criteria, allowlist, non-goals)

## Reviewer's report (with issues to fix)

<paste failing reviewer's report — Spec Review OR Quality Review>

## Your job

For EACH issue listed in the reviewer's "Issues to fix" or "If REQUEST_CHANGES: prioritized fix list":

1. Locate the file:line referenced
2. Apply the suggested fix (or a better one that meets the same intent)
3. Stay within the brief's file allowlist — if a fix requires touching a non-allowlisted file, STOP and report
4. Run the relevant verification command from the brief to confirm the fix

After all listed issues are addressed:

1. Run ALL verification commands from the brief again — they must still pass
2. Run the universal self-check from `_review-prompts/implementer.md`
3. Report

## Rules

- Fix ONLY what the reviewer listed. Do NOT take this as an opportunity to refactor.
- Do NOT introduce new files unless the original brief authorized them.
- Do NOT modify the brief — if the brief is wrong, report it; don't silently change scope.
- Do NOT commit/push/stage. Leader handles git.
- If a reviewer issue is incorrect (you have file:line evidence the code is already correct), say so in your report; don't apply a wrong fix.

## Report template

```markdown
## Fixer Report

**Task ID:** <TASK_ID>
**Reviewer that requested changes:** spec-compliance | quality
**Iteration:** <e.g., "Fix iteration 1 of 5">

### Issues addressed

| # | Issue | File:line | Fix applied | Verification |
|---|-------|-----------|-------------|--------------|
| 1 | <issue text> | path:N | <one-line what changed> | <command that confirmed> |
| 2 | ... | ... | ... | ... |

### Issues not applied (with reason)
- <e.g., "Issue #3 was based on misreading: actual code at field.tsx:178 already does the check. Provided counter-evidence below.">

### All brief verification commands re-run
\```
$ <command>
<output>
\```

### Self-check status (same as implementer template)
- [x] No new `as any` / `@ts-ignore` / `Math.random`
- [x] No AI voice
- [x] Allowlist still respected
- [x] Registry regenerated if needed
- [x] type-check passes
- [x] test passes (affected scope)

### Diff stat after fixes
\```
<git diff --stat output>
\```

### Next step
**Ready for re-review by:** spec-compliance | quality (whichever sent the issues)
```
```
