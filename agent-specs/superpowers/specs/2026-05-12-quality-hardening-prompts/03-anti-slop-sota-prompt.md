# Prompt 03: Anti-Slop SOTA 5/5

Copy this whole prompt into the implementation agent.

```text
Repo: /Users/voitz/Projects/diffgazer-workspace.

Goal: remove AI/slop patterns from all relevant files and reach a clean anti-slop report: 0 issues, SOTA 5/5. Do not change application behavior, public APIs, CLI UX, registry contracts, docs contracts, or generated artifact semantics.

Required skills to load before acting:
- /Users/voitz/.agents/library/anti-slop/SKILL.md
- /Users/voitz/.agents/library/anti-slop/references/slop-code-patterns.md
- /Users/voitz/.agents/library/sota/SKILL.md
- /Users/voitz/.agents/library/sota-verify/SKILL.md
- /Users/voitz/.agents/library/code-audit/SKILL.md
- /Users/voitz/.agents/library/clean-code/SKILL.md
- /Users/voitz/.agents/library/code-quality/SKILL.md
- /Users/voitz/.agents/library/test-behavior-not-implementation/SKILL.md
- /Users/voitz/.agents/library/typescript-expert/SKILL.md
- /Users/voitz/.agents/library/react-senior-guide/SKILL.md
- /Users/voitz/.agents/library/react-useeffect/SKILL.md
- /Users/voitz/.agents/library/react-useref/SKILL.md
- /Users/voitz/.agents/library/react-anti-patterns/SKILL.md
- /Users/voitz/.agents/library/react-design-patterns/SKILL.md
- /Users/voitz/.agents/library/react-usecallback/SKILL.md
- /Users/voitz/.agents/library/react-usememo/SKILL.md
- /Users/voitz/.agents/library/react-usecontext/SKILL.md

If named skills are supported, load: $anti-slop, $sota, $sota-verify, $code-audit, $clean-code, $code-quality, $test-behavior-not-implementation, $typescript-expert, $react-senior-guide, $react-useeffect, $react-useref, $react-anti-patterns, $react-design-patterns, $react-usecallback, $react-usememo, $react-usecontext. If unavailable, read each SKILL.md path and apply manually.

Mandatory startup:
1. Run `git status --short --untracked-files=all`.
2. Read `AGENTS.md`, `package.json`, and current spec context.
3. Read anti-slop pattern catalog from `/Users/voitz/.agents/library/anti-slop/references/slop-code-patterns.md`.
4. Use `rg` / `rg --files`.
5. Do not revert, reset, stash, overwrite, or delete unrelated user work. Do not git add/commit.
6. Use `apply_patch` for manual edits.

Scope:
- Changed/untracked `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.md`, `.mdx`.
- Include scripts, smoke tests, docs, registry source, CLI source, UI/keys/web/server/core if touched.
- Exclude `node_modules`, `dist`, deterministic generated files, lockfiles, built artifacts.
- For files >1000 lines, audit first 500 lines and also ask a scripts/code-audit worker whether the file should be split.

Subagent strategy:
- Use Opus 4.7 subagents if available; otherwise strongest available model.
- No subagent limit. Run waves until every anti-slop category has 0 issues.
- Suggested slices:
  - docs/README/MDX voice and repetition
  - libs/ui source/tests/docs
  - libs/keys source/tests/docs
  - apps/web React source/tests
  - cli/add and registry code/tests
  - scripts and smoke files
  - cross-cutting dead exports, duplicated helpers, AI voice search

Audit categories:
- Unnecessary comments
- Over-engineering
- Defensive over-coding
- AI voice
- Dead code
- Type workarounds
- Verbose patterns

Fix rules:
- Delete obvious comments, section dividers, "ensure/robust/seamless/leverage" narration, and comments restating code.
- Keep comments only when they explain a non-obvious constraint, external bug, or public contract.
- Remove unused helpers, dead exports, unused imports, redundant wrappers, and compatibility aliases unless required by a public contract.
- Replace defensive fallbacks that hide impossible states with direct code or explicit error boundaries where appropriate.
- Remove type workarounds by tightening types; do not replace `any` with unsafe assertions.
- Simplify verbose conditionals without changing semantics.
- In tests, keep or improve behavior coverage while removing slop.
- In docs, keep user-facing clarity; do not strip useful instructions just because text is long.

Verification:
- Run focused tests/type-check for touched packages.
- If registry/docs/artifact sources changed, run `pnpm run prepare:artifacts` and `pnpm run validate:artifacts:check`.
- Final gates:
  - `npm run test-ci`
  - `git diff --check`
  - `find . -type d \( -name node_modules -o -name .git -o -name .worktrees \) -prune -o \( -name '*.bak' -o -name '*.orig' -o -name '*.tmp' \) -print`

SOTA verify loop:
- Dispatch anti-slop re-audit subagents after fixes.
- Also dispatch one code-review verifier to catch behavior/API regressions.
- Fix every finding, including Low/Info.
- Repeat until anti-slop report says 0 issues and re-review is CLEAN.

Final response:
- `Clean. No slop detected.`
- Files changed and issue categories removed.
- Verification commands and results.
- Required untracked files.
- Explicit statement that behavior and public contracts were preserved.
```

