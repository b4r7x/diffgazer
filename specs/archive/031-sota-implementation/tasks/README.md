# How to Use These Briefs (For Subagents AND for the Leader)

This directory contains 42 task briefs. The execution model is:

- **Leader** (main context) dispatches subagents per `../LEADER_WORKFLOW.md`. Main context stays small — never reads source code.
- **Implementer subagents** read this README, `_global-context.md`, and their `<TASK_ID>/brief.md`, then implement.
- **Reviewer subagents** verify spec compliance, then code quality. Fix-loops re-dispatch fixer until pass.
- **Final SOTA verifier subagent** runs the whole-repo gauntlet at the end. Loop continues until CLEAN.

This document is read BY THE IMPLEMENTER. For the leader's workflow, see `../LEADER_WORKFLOW.md`.

## Mandatory Pre-Read (do this FIRST, no exceptions)

Read these in order before touching any code:

1. `tasks/_global-context.md` — repo conventions, AGENTS.md highlights, anti-patterns, verification gates.
2. `tasks/_agent-guidance.md` — pre-flight, common pitfalls, self-check, when to flag BLOCKED, command cheatsheet.
3. `tasks/<your-task-id>/brief.md` — your specific task. Scope is allowlisted; do not touch files outside the allowlist.
4. `../030-sota-audit-master-index/spec.md` IF your brief cites a finding ID — only the section for that finding (don't re-read the whole audit).
5. Source files explicitly named in your brief.

If your brief contradicts AGENTS.md, AGENTS.md wins. Stop and report.

## You Are One of Three Possible Roles

Read the dispatch prompt you received. It will tell you which role:

| Prompt template path | Role |
|---|---|
| `_review-prompts/implementer.md` | Implementer — write code |
| `_review-prompts/spec-reviewer.md` | Spec reviewer — read-only |
| `_review-prompts/quality-reviewer.md` | Quality reviewer — read-only |
| `_review-prompts/fixer.md` | Fixer — address listed issues only |
| `_review-prompts/final-sota-verify.md` | Final verifier — read-only, whole repo |

Follow the role's template instructions strictly. Each has its own report format.

## Implementer Workflow

```
1. Read mandatory pre-read.
2. Run "Pre-flight" commands BEFORE touching code:
   - confirm bug repros
   - confirm verification commands run today
   - confirm build infrastructure works
   If pre-flight fails for reasons UNRELATED to your task: REPORT BLOCKED.
3. Implement. Strictly within file allowlist.
4. Run verification commands. All must exit 0 (or match expected-failure criteria).
5. Run universal self-check (see _review-prompts/implementer.md).
6. Report per template. Stop.
```

## When You Have Questions

Ask BEFORE implementing. Each brief has "Open questions" pattern — list yours under that heading and STOP. The leader will answer and re-dispatch you.

Do NOT silently make architectural decisions. If two reasonable interpretations exist, ask.

## When You Find Adjacent Issues

If while doing your task you spot a bug that's clearly outside your scope:
- Do NOT fix it.
- Note it in your `## Report` under `Follow-up tasks needed:`.
- The leader files a new brief.

## Anti-Patterns (DO NOT DO THESE)

- Do not refactor code that isn't named in your file allowlist.
- Do not "while I'm here" rename variables, reformat imports, or restructure modules.
- Do not change public API names beyond what the brief explicitly authorizes.
- Do not add new dependencies unless the brief lists them in scope.
- Do not skip verification commands. If a command fails, debug it, don't bypass it.
- Do not commit `node_modules`, `dist/`, or generated files unless the brief explicitly says so.
- Do not introduce new tests that don't relate to your acceptance criteria — keep test additions tight and behavior-focused.
- Do not use `as any`, `@ts-ignore`, `@ts-nocheck`, `Math.random` (use `useId` or `crypto.randomUUID`), `eval`.
- Do not write comments explaining WHAT the code does. Only comment WHY when non-obvious.
- Do not narrate in code: no "// First, we...", "// Now we...", "// This ensures..."
- Do not commit/push/stage/stash — leader handles git.
- Do not bypass with `--no-verify`, `--no-gpg-sign`.
- Do not invoke `Agent`/`Task` from inside an implementer — you ARE the implementer.

## Universal Self-Check (run before submitting report)

```
1. git diff --stat       — only allowlisted files?
2. All verification commands exit 0 (or expected-failure)?
3. New tests behavior-focused (queryByRole/Text, focus, ARIA), not implementation (refs, state, call counts)?
4. No `as any` / `@ts-ignore` / `Math.random` introduced?
5. No "Here we...", "Let's...", "ensures", "robust", "enhances", "graceful" in code or comments?
6. No console.log / debug statements left?
7. Public registry regenerated if registry source touched?
   pnpm --filter @diffgazer/ui build:shadcn (for UI registry items)
   pnpm --filter @diffgazer/keys build:shadcn (for keys registry items)
8. pnpm --filter @diffgazer/<package> type-check passes?
9. pnpm --filter @diffgazer/<package> test (scoped) passes?
10. If you added vi.mock: has `// Boundary mock: <why>` annotation?
11. If you added fireEvent: has `// fireEvent retained: <why>` annotation?
```

## Tools Available

- `Read`, `Edit`, `Write` for code changes (implementer only).
- `Bash` for verification commands, `pnpm`, `node`, `find`, `grep`.
- `Glob`, `Grep` for searching the codebase.
- Do NOT use `Agent` / `Task` to dispatch your own subagents — you ARE the worker.

## When You're Stuck

After 30 minutes of unsuccessful debugging:
- Report `Status: blocked`
- Describe what you tried, what failed, what you'd try next
- The leader will dispatch a debugger agent or reassign

Don't ship broken code to hit a checklist.

## Three-Stage Review Loop (after implementer reports DONE)

The leader will dispatch:

1. **Spec reviewer** — confirms code matches brief.
   - If PASS → quality reviewer
   - If FAIL → fixer addresses listed issues → re-dispatch spec reviewer (loop, cap 5 iterations)
2. **Quality reviewer** — confirms code quality (anti-slop, React rules, architecture).
   - If APPROVE → mark task complete
   - If REQUEST_CHANGES → fixer addresses listed issues → re-dispatch quality reviewer (loop, cap 5 iterations)

You (implementer) don't run this loop — the leader does. You just report DONE.

## Final SOTA-Verify Loop (after all 42 tasks complete)

The leader runs `final-sota-verify.md` template:

1. Verifier subagent runs full release-readiness gauntlet (test, type-check, audit, dedupe, smoke, pack, live CLI repros, spec 030 closure check).
2. Returns CLEAN or DIRTY.
3. If DIRTY: leader dispatches fixers per issue, re-runs verifier. Loop cap: 10 iterations.
4. If CLEAN: SOTA-ready announcement.

Reference: `../_review-prompts/final-sota-verify.md` and `../LEADER_WORKFLOW.md`.
