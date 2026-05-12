# Prompt 01: Test Behavior SOTA 5/5

Copy this whole prompt into the implementation agent.

```text
Repo: /Users/voitz/Projects/diffgazer-workspace.

Goal: make the entire test suite SOTA 5/5 according to behavior-first testing principles. Do not change application behavior, public APIs, CLI UX, registry contracts, docs contracts, or generated artifact semantics. If a test exposes a real bug, prove the bug first, then fix it with the smallest behavior-preserving source change and add behavior coverage.

Required skills to load before acting:
- /Users/voitz/.agents/library/test-behavior-not-implementation/SKILL.md
- /Users/voitz/.agents/library/sota/SKILL.md
- /Users/voitz/.agents/library/sota-verify/SKILL.md
- /Users/voitz/.agents/library/code-audit/SKILL.md
- /Users/voitz/.agents/library/clean-code/SKILL.md
- /Users/voitz/.agents/library/code-quality/SKILL.md
- /Users/voitz/.agents/library/anti-slop/SKILL.md
- /Users/voitz/.agents/library/typescript-expert/SKILL.md
- /Users/voitz/.agents/library/testing-patterns/SKILL.md
- /Users/voitz/.agents/library/react-senior-guide/SKILL.md
- /Users/voitz/.agents/library/react-useeffect/SKILL.md
- /Users/voitz/.agents/library/react-useref/SKILL.md
- /Users/voitz/.agents/library/react-anti-patterns/SKILL.md
- /Users/voitz/.agents/library/react-design-patterns/SKILL.md
- /Users/voitz/.agents/library/react-usecallback/SKILL.md
- /Users/voitz/.agents/library/react-usememo/SKILL.md
- /Users/voitz/.agents/library/react-usecontext/SKILL.md

If the environment supports named skills, load the named skills too: $test-behavior-not-implementation, $sota, $sota-verify, $code-audit, $clean-code, $code-quality, $anti-slop, $typescript-expert, $testing-patterns, $react-senior-guide, $react-useeffect, $react-useref, $react-anti-patterns, $react-design-patterns, $react-usecallback, $react-usememo, $react-usecontext. If a skill is unavailable, read the SKILL.md path manually and apply the checklist anyway.

Mandatory startup:
1. Run `git status --short --untracked-files=all`.
2. Read `AGENTS.md`, `package.json`, and the current project/spec context under `agent-specs/superpowers/specs/2026-05-12-ui-keys-handoff-readiness`.
3. Use `rg` / `rg --files` for discovery.
4. Do not revert, reset, stash, overwrite, or delete unrelated user work. Do not git add/commit.
5. Use `apply_patch` for manual edits.

Scope:
- All tests in changed/untracked files.
- All repo test files: `*.test.ts`, `*.test.tsx`, Node `--test` files, smoke scripts, CLI tests, registry tests, docs tests, UI/keys/web tests.
- Include tests for generated/public registry contracts, shadcn/direct copy flows, dgadd flows, package install smoke, keyboard/focus behavior, accessibility, and docs metadata.
- Exclude `node_modules`, `dist`, generated deterministic outputs unless a source test requires them.

Subagent strategy:
- Use Opus 4.7 subagents if available. If not, use the strongest available model.
- There is no fixed subagent limit. Run as many waves as needed until every test area is clean.
- First wave: read-only audit subagents.
- Second and later waves: worker subagents with disjoint ownership. Tell every worker: "You are not alone in the codebase; do not revert edits by others; do not git add/commit/stash/reset."
- Suggested audit/fix slices:
  - libs/ui component and hook tests
  - libs/keys hook/focus/navigation tests
  - apps/web React feature tests
  - apps/docs docs/MDX/metadata tests
  - cli/add and cli/diffgazer tests
  - libs/registry artifact/shadcn/docs-sync tests
  - libs/server and libs/core tests
  - smoke scripts and package/direct-install tests
  - cross-cutting duplicate/implementation-detail test audit

Audit checklist:
- Tests assert user/consumer-visible behavior, not implementation details.
- Prefer `getByRole`, `getByLabelText`, `getByText`, etc. over test ids.
- Prefer `userEvent` over `fireEvent` except where lower-level events are the public behavior.
- Remove/merge duplicate tests that cover the same behavior.
- Remove tests that only prove React/framework/third-party behavior.
- Avoid `vi.mock()` / internal module mocks unless testing a real system boundary.
- No assertions on private state, internal helper calls, hook internals consumers cannot observe, or call counts unless the count is the public contract.
- Add missing edge coverage only when it is real behavior: empty state, invalid state, cleanup, keyboard boundary, disabled/skipped items, focus movement, ARIA relationships, ownership/removal safety.
- Preserve coverage while reducing maintenance burden.

Fix rules:
- Do not rewrite tests just for style. Every edit needs a specific finding.
- If deleting a test, state which remaining or new behavior test covers that contract.
- Do not change source behavior to satisfy an implementation-detail test. Rewrite the test.
- If a source bug is found, fix source minimally and prove the user-visible behavior.
- Keep test helpers small and local unless 3+ files share the same stable contract.

Verification:
- After each worker batch, run focused tests/type-check for touched packages.
- Before final readiness, run:
  - `npm run test-ci`
  - `git diff --check`
  - `find . -type d \( -name node_modules -o -name .git -o -name .worktrees \) -prune -o \( -name '*.bak' -o -name '*.orig' -o -name '*.tmp' \) -print`
- If generated artifacts are missing/stale, run `pnpm run prepare:artifacts` before artifact validation.

SOTA verify loop:
- Dispatch at least two read-only verifier subagents:
  - Completeness verifier: checks every test area and runs/validates the required gates.
  - Code-review verifier: applies test-behavior, code-audit, anti-slop, React, TypeScript, clean-code checklists to the changed tests and adjacent source.
- Fix every finding, including Low and Info.
- Re-run verification until both verifiers report CLEAN.

Final response:
- Score: Test quality 5/5, or list exact remaining blockers.
- Summarize changed test strategy and files.
- Report all verification commands and results.
- List required untracked files.
- Explicitly state that application behavior and public contracts were not changed, or list the minimal source bug fixes made with tests.
```

