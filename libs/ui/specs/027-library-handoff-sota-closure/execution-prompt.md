# Execution Prompt For Opus 4.7

You are Opus 4.7 executing the library handoff SOTA closure spec in:

`/Users/voitz/Projects/diffgazer-workspace/libs/ui/specs/027-library-handoff-sota-closure`

## Mandatory Skills

Load and follow these before changing code:

- `$sota`
- `$code-audit`
- `superpowers:executing-plans`
- `superpowers:dispatching-parallel-agents`
- `superpowers:subagent-driven-development`
- `superpowers:test-driven-development`
- `superpowers:verification-before-completion`
- `clean-code`
- `code-quality`
- `anti-slop`
- `test-behavior-not-implementation`
- `architecture`
- `typescript-expert`

At the end, load and run:

- `$sota-verify`

## Operating Rules

- You are not alone in the codebase. Do not revert user edits or edits from other agents.
- Use the spec's agent briefs as ownership boundaries.
- Do not add deprecated aliases before first public customer-facing release.
- Update code, tests, docs, registry source, public registry artifacts, generated bundles, and app consumers together for every public API change.
- Do not move product workflows into libraries.
- Keep changes scoped and behavior-tested.
- Use TDD for every behavior bug.
- Use `apply_patch` or normal editor operations; do not use destructive git commands.
- Do not claim completion without fresh verification output.

## Execution Strategy

1. Read `spec.md`.
2. Read all files in `issues/`.
3. Read all files in `agents/`.
4. Create a task list from Batches A-D.
5. Dispatch Opus 4.7 subagents for Batch A tasks using the exact agent briefs.
6. Integrate Batch A, run Batch A verification commands, and fix failures.
7. Dispatch Batch B subagents, integrate, run Batch B verification commands, and fix failures.
8. Dispatch Batch C subagents, integrate, run Batch C verification commands, and fix failures.
9. Run Agent 10 as final verifier.
10. Run `$sota-verify` against this spec. Treat every finding, including Low/Info, as actionable unless the spec explicitly documents the exception.
11. Run final gates:

```bash
pnpm run prepare:artifacts
pnpm --filter @diffgazer/keys validate:registry
pnpm --filter @diffgazer/ui validate:registry
pnpm run validate:artifacts:check
pnpm --filter @diffgazer/keys test
pnpm --filter @diffgazer/keys type-check
pnpm --filter @diffgazer/ui test
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/add test
pnpm --filter @diffgazer/add type-check
pnpm --filter @diffgazer/web test
pnpm --filter @diffgazer/web type-check
pnpm run verify
git diff --check
```

## Parallelization

Safe parallel work:

- Agent 01, 02, 03 can run together if Agent 03 does not regenerate artifacts until Agent 01/02 source changes land.
- Agent 04, 05, 06 can run together if they stay within ownership and coordinate shared Select/Listbox types.
- Agent 07, 08, 09 should run after A/B because they depend on public API and runtime decisions.

Avoid parallel edits to the same files. If conflict risk appears, serialize that task.

## Final Answer Requirements

Your final response must include:

- Whether the spec is fully complete.
- Exact verification commands run and their result.
- Any remaining caveats, including optional smoke skips.
- Confirmation that `$sota-verify` was run after implementation.
- A concise list of public API changes that downstream users must know.

Do not say "SOTA 5/5" unless Agent 10 and `$sota-verify` both return clean and root verification passes.
