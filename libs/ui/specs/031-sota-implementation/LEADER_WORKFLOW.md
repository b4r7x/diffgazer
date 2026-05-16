# Leader Workflow — Main Context as Thin Validator

The MAIN context is the LEADER. The leader's job is to dispatch subagents and validate their reports. The leader does NOT read source code, does NOT touch files, does NOT bloat context with implementation details. Everything heavy is delegated to fresh opus subagents.

## Why this matters

- Each subagent has a fresh context window — no history bloat
- Leader holds only: task plan, dispatch reports, decision state
- Tens of thousands of LOC can move through the leader with hundreds of LOC of context

## Roles

| Agent | Read-only? | Modifies code? | What it does |
|-------|------------|----------------|--------------|
| **Leader** (main context) | reads task lists + reports only | NO | Dispatches subagents, tracks state, decides PASS/FAIL forwarding |
| **Implementer** | reads code + brief | YES | Implements one task end-to-end, reports |
| **Spec Reviewer** | reads brief + diff | NO | Verifies code matches brief, reports PASS/FAIL |
| **Quality Reviewer** | reads diff + AGENTS.md | NO | Verifies code quality (anti-slop, React rules, etc.), reports APPROVE/REQUEST_CHANGES |
| **Fixer** | reads brief + reviewer report | YES (limited) | Addresses listed issues only, reports |
| **Final SOTA Verifier** | runs whole-repo gauntlet | NO | End-to-end verify against spec 030 closure, reports CLEAN/DIRTY |

## Per-Task Loop (run for each of 42 tasks)

```
LEADER STATE: pending tasks = [T-...]

Pick next task T:
  Dispatch IMPLEMENTER subagent
    (template: _review-prompts/implementer.md)
    (substitute <TASK_ID>=T)
  Wait for report.

  If implementer status == BLOCKED:
    Read the blocker reason.
    If leader can answer a clarifying question, respond and re-dispatch implementer.
    Else: mark task BLOCKED in TodoWrite, surface to user, continue to next task.
    SKIP the rest of this task's loop.

  If implementer status == DONE:
    Dispatch SPEC REVIEWER subagent
      (template: _review-prompts/spec-reviewer.md)
      Pass implementer's report inline.
    Wait.

    LOOP A (spec review fix loop):
      Iteration count = 0
      While spec-review verdict == FAIL:
        Iteration count++
        If iteration > 5:
          mark task BLOCKED (stuck in spec-review loop), surface to user.
          SKIP rest of this task.
        Dispatch FIXER subagent
          (template: _review-prompts/fixer.md)
          Pass spec-reviewer's "Issues to fix" list.
        Wait for fixer report.
        Re-dispatch SPEC REVIEWER with new diff state.

    Spec review PASS:
    Dispatch QUALITY REVIEWER subagent
      (template: _review-prompts/quality-reviewer.md)
      Pass implementer + spec-reviewer reports inline.
    Wait.

    LOOP B (quality review fix loop):
      Iteration count = 0
      While quality verdict == REQUEST_CHANGES:
        Iteration count++
        If iteration > 5:
          Surface to user (cap reached).
        Dispatch FIXER subagent (template: fixer.md) with quality issues list.
        Re-dispatch QUALITY REVIEWER.

    Quality APPROVE:
    Mark task COMPLETE in TodoWrite.

End loop (next task).
```

## Phase-Gate Checkpoint (run between phases)

After all tasks in a Phase are COMPLETE:

```
Dispatch a fresh PHASE-GATE VERIFIER subagent.
(reuse final-sota-verify.md template but scope verification to phase-specific commands from spec.md)

If PASS: advance to next phase, repeat per-task loop for that phase.
If FAIL: dispatch fixers for issues, re-verify phase gate, loop.

Hard cap: 5 phase-gate iterations.
```

## Final SOTA-Verify Loop (after Phase 5)

After all 42 tasks COMPLETE and all phase gates PASSED:

```
Dispatch FINAL SOTA VERIFIER subagent
  (template: _review-prompts/final-sota-verify.md)

LOOP F (final verify fix loop):
  Iteration count = 0
  While verdict == DIRTY:
    Iteration count++
    If iteration > 10:
      Surface concise summary to user (max 200 words):
        - What's stuck
        - What was attempted
        - Recommended human action
      End loop, await user decision.

    For each Critical / High issue in verifier report:
      Determine source task from INDEX.md
      Dispatch FIXER subagent referencing that task's brief
      Wait for fixer
      Re-dispatch original task's SPEC REVIEWER (confirm spec still holds)
      Re-dispatch original task's QUALITY REVIEWER
      Move to next issue.

    For Medium / Low issues:
      Batch into one "polish fixer" agent
      Re-dispatch quality reviewer after the batch

    Re-dispatch FINAL SOTA VERIFIER (next iteration of LOOP F).

  Verdict == CLEAN:
    Run final local smoke: `pnpm run release-check`
    If exit 0: announce SOTA-ready, surface git diff summary to user, ask whether to create changeset and trigger publish.
    If exit != 0: dispatch verifier to capture the new failure, loop.
```

## Leader Bookkeeping (TodoWrite)

Maintain one TodoWrite item per task:
- subject: T-XXX (brief one-line)
- status: pending → in_progress → completed | blocked
- description: brief path
- metadata: phase, blocks, blocked-by

Maintain a separate TodoWrite for phase gates and final verify loop.

## Dispatch examples (concrete)

### Dispatching the implementer for T-VITE-ALIAS

```typescript
Agent({
  description: "Implement T-VITE-ALIAS",
  subagent_type: "general-purpose",
  model: "opus",
  prompt: `<contents of _review-prompts/implementer.md with <TASK_ID> = T-VITE-ALIAS>`
})
```

### Dispatching the spec reviewer after implementer reports

```typescript
Agent({
  description: "Spec review T-VITE-ALIAS",
  subagent_type: "general-purpose",
  model: "opus",
  prompt: `<contents of _review-prompts/spec-reviewer.md with <TASK_ID>=T-VITE-ALIAS, plus the implementer's full Report block pasted inline>`
})
```

### Parallel dispatch (independent tasks in same phase)

Use a single message with multiple Agent tool calls:

```typescript
[
  Agent({description: "Implement T-VITE-ALIAS", ...}),
  Agent({description: "Implement T-FIELD-EMPTY", ...}),
  Agent({description: "Implement T-TABS-ZERO", ...}),
  Agent({description: "Implement T-PKG-EXPORTS", ...}),
  Agent({description: "Implement T-PKG-ENGINES", ...}),
  Agent({description: "Implement T-LICENSES", ...}),
]
```

When parallel implementers return, leader processes their reviews sequentially (or in batches of independent ones — but if two tasks touch overlapping files, sequence them).

## Anti-pattern guard for the leader

- The leader does NOT use `Read`, `Edit`, `Write`, or `Bash` on source files. Only on the spec/brief files and reports.
- The leader does NOT debate technical decisions; the brief or AGENTS.md authorizes them.
- The leader does NOT auto-approve quality issues; if a quality reviewer flags Critical, fixer must run.
- The leader DOES escalate to user when hard caps hit (5 fix loops per stage, 10 final-verify loops, blocked tasks).
- The leader DOES run TodoWrite updates so the user can see progress.

## When to involve the user

- Hard cap reached (5 fix iterations or 10 final-verify iterations)
- Task BLOCKED with no obvious next step
- Brief contradicts AGENTS.md and reviewer flags it
- Two reviewers disagree (spec PASS but quality REQUEST_CHANGES on an issue spec missed, or vice versa — escalate so user decides whether to update the brief)
- After CLEAN final verify, before publish (user approves changeset + publish trigger)

Otherwise, the leader runs autonomously through the loop.

## Iteration caps (summary)

| Loop | Cap | Action on cap |
|------|-----|---------------|
| Spec-review fix loop (per task) | 5 | Mark task BLOCKED, surface |
| Quality-review fix loop (per task) | 5 | Mark task BLOCKED, surface |
| Phase-gate verification | 5 | Surface phase regression |
| Final SOTA-verify loop | 10 | Concise summary, await user |

These caps prevent infinite loops on broken briefs or environmental issues.
