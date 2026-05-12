# Prompt 02: Code Audit SOTA 5/5

Copy this whole prompt into the implementation agent.

```text
Repo: /Users/voitz/Projects/diffgazer-workspace.

Goal: run a full code-audit hardening pass and bring the relevant codebase to 5/5 in every code-audit category. Do not change application behavior, public APIs, CLI UX, registry contracts, docs contracts, or generated artifact semantics unless a verified bug or contract violation requires it.

Required skills to load before acting:
- /Users/voitz/.agents/library/code-audit/SKILL.md
- /Users/voitz/.agents/library/sota/SKILL.md
- /Users/voitz/.agents/library/sota-verify/SKILL.md
- /Users/voitz/.agents/library/clean-code/SKILL.md
- /Users/voitz/.agents/library/code-quality/SKILL.md
- /Users/voitz/.agents/library/anti-slop/SKILL.md
- /Users/voitz/.agents/library/test-behavior-not-implementation/SKILL.md
- /Users/voitz/.agents/library/typescript-expert/SKILL.md
- /Users/voitz/.agents/library/architecture/SKILL.md
- /Users/voitz/.agents/library/improve-codebase-architecture/SKILL.md
- /Users/voitz/.agents/library/react-senior-guide/SKILL.md
- /Users/voitz/.agents/library/react-useeffect/SKILL.md
- /Users/voitz/.agents/library/react-useref/SKILL.md
- /Users/voitz/.agents/library/react-anti-patterns/SKILL.md
- /Users/voitz/.agents/library/react-design-patterns/SKILL.md
- /Users/voitz/.agents/library/react-usecallback/SKILL.md
- /Users/voitz/.agents/library/react-usememo/SKILL.md
- /Users/voitz/.agents/library/react-usecontext/SKILL.md
- /Users/voitz/.agents/library/security-review/SKILL.md when touching secrets, auth, filesystem boundaries, subprocesses, HTTP/API, package install, or CLI execution.

If named skills are supported, load: $code-audit, $sota, $sota-verify, $clean-code, $code-quality, $anti-slop, $test-behavior-not-implementation, $typescript-expert, $architecture, $improve-codebase-architecture, $react-senior-guide, $react-useeffect, $react-useref, $react-anti-patterns, $react-design-patterns, $react-usecallback, $react-usememo, $react-usecontext, and $security-review when relevant. If unavailable, read each SKILL.md path and apply manually.

Mandatory startup:
1. Run `git status --short --untracked-files=all`.
2. Read `AGENTS.md`, `package.json`, and `agent-specs/superpowers/specs/2026-05-12-ui-keys-handoff-readiness`.
3. Build context: package structure, test commands, public boundaries, registry/CLI/docs/web ownership rules.
4. Use `rg` / `rg --files`.
5. Do not revert, reset, stash, overwrite, or delete unrelated user work. Do not git add/commit.
6. Use `apply_patch` for manual edits.

Scope:
- All changed/untracked files plus directly importing/imported neighbor files.
- If an audit finding shows a repeated/cross-cutting issue outside that scope, expand scope deliberately.
- Include source, tests, docs source, scripts, smoke tests, registry source, CLI code.
- Exclude `node_modules`, `dist`, deterministic generated outputs unless source changes require artifact regeneration.

Subagent strategy:
- Use Opus 4.7 subagents if available; otherwise use the strongest available model.
- No subagent limit. Run waves until all categories score 5/5.
- Always include at least two cross-cutting read-only agents:
  - DRY/reusability cross-cutting agent
  - architecture/SRP/import-boundary cross-cutting agent
- Suggested area agents:
  - libs/ui public primitives and registry
  - libs/keys keyboard/focus architecture
  - apps/web adoption and feature code
  - apps/docs metadata/rendering/docs source
  - cli/add and registry CLI workflows
  - scripts/smoke/artifacts/monorepo invariants
  - libs/registry contracts and tests
  - libs/server/core if touched

Audit categories to score 1-5:
- DRY
- SRP
- KISS
- YAGNI
- Over-engineering
- Anti-slop
- Naming and conventions
- File organization
- Type safety
- Error handling
- Dead code and redundancy
- Patterns and best practices
- Architecture
- Reusability
- Performance

Fix rules:
- Fix every finding, including Low and Info.
- Prefer deletion and simplification over compatibility wrappers before public release.
- Do not introduce abstractions for 1-2 call sites.
- Extract only when it names a real concept, reduces meaningful duplication, and keeps call sites clearer.
- Preserve architecture boundaries:
  - libs/keys owns keyboard/focus behavior.
  - libs/ui owns reusable shadcn-like primitives and hooks.
  - apps/web owns product-specific composition and domain flows.
  - libs/registry owns registry contracts and shared CLI workflow helpers.
  - cli/add owns user-facing add/remove/list/diff.
- Public API changes require docs, examples, registry, generated bundles, app consumers, and tests to change together.
- React changes must follow the React skills: derive during render, effects only for external sync, no defensive memo/callback.
- Test changes must follow behavior-not-implementation.

Verification:
- After each batch, run focused tests/type-check for touched packages.
- When registry/CLI/docs/public handoff changes: run `pnpm run prepare:artifacts` and `pnpm run validate:artifacts:check`.
- Final gates:
  - `npm run test-ci`
  - `git diff --check`
  - `find . -type d \( -name node_modules -o -name .git -o -name .worktrees \) -prune -o \( -name '*.bak' -o -name '*.orig' -o -name '*.tmp' \) -print`

SOTA verify loop:
- Dispatch read-only completeness and code-review verifier subagents after fixes.
- They must re-score every category and check no new behavior/API regressions.
- Fix all findings, including Low/Info.
- Repeat until every category is 5/5 and both verifiers report CLEAN.

Final response:
- Full scorecard with every category at 5/5, or exact blockers.
- Summary of changed files and why each change was needed.
- Verification commands and results.
- Required untracked files.
- Explicit statement that application behavior and public contracts were preserved.
```

