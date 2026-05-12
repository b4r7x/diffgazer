# Prompt 04: Scripts Cleanup SOTA 5/5

Copy this whole prompt into the implementation agent.

```text
Repo: /Users/voitz/Projects/diffgazer-workspace.

Goal: clean up and modularize large scripts, especially files over 500 LOC, to SOTA 5/5 without changing behavior. Preserve smoke output semantics, CLI UX, registry artifacts, docs sync behavior, package install behavior, and public handoff contracts.

Required skills to load before acting:
- /Users/voitz/.agents/library/sota/SKILL.md
- /Users/voitz/.agents/library/sota-verify/SKILL.md
- /Users/voitz/.agents/library/code-audit/SKILL.md
- /Users/voitz/.agents/library/clean-code/SKILL.md
- /Users/voitz/.agents/library/code-quality/SKILL.md
- /Users/voitz/.agents/library/anti-slop/SKILL.md
- /Users/voitz/.agents/library/test-behavior-not-implementation/SKILL.md
- /Users/voitz/.agents/library/typescript-expert/SKILL.md
- /Users/voitz/.agents/library/architecture/SKILL.md
- /Users/voitz/.agents/library/improve-codebase-architecture/SKILL.md
- /Users/voitz/.agents/library/security-review/SKILL.md

If named skills are supported, load: $sota, $sota-verify, $code-audit, $clean-code, $code-quality, $anti-slop, $test-behavior-not-implementation, $typescript-expert, $architecture, $improve-codebase-architecture, $security-review. If unavailable, read each SKILL.md path and apply manually.

Mandatory startup:
1. Run `git status --short --untracked-files=all`.
2. Read `AGENTS.md`, `package.json`, and current handoff spec.
3. Inventory script sizes with a safe command, for example:
   - `rg --files scripts cli libs apps -g '*.mjs' -g '*.js' -g '*.ts' -g '*.tsx' | xargs wc -l | sort -nr | sed -n '1,80p'`
4. Identify files over 500 LOC and scripts with repeated fixture/process/filesystem/registry logic.
5. Do not revert, reset, stash, overwrite, or delete unrelated user work. Do not git add/commit.
6. Use `apply_patch` for manual edits.

Primary scope:
- `scripts/monorepo/*.mjs`
- `cli/add/scripts/*`
- `libs/ui/scripts/*`
- `libs/keys/scripts/*`
- `apps/docs/scripts/*`
- registry/artifact/smoke helper code touched by those scripts
- tests covering these scripts

Subagent strategy:
- Use Opus 4.7 subagents if available; otherwise strongest available model.
- No subagent limit. Run waves until scripts score 5/5.
- First wave: read-only audit/inventory.
- Later waves: workers with disjoint ownership.
- Suggested slices:
  - smoke CLI/package/shadcn scripts
  - local registry server and namespace dependency normalization
  - artifact validation/build/publish scripts
  - docs sync/generated scripts
  - CLI bundle/generation scripts
  - monorepo invariant checks
  - cross-cutting reusable process/fs/fixture helpers

Refactor rules:
- Behavior must stay equivalent. Before editing a script, identify its tests/smoke command and expected output contract.
- Do not split a script just because it is long. Split when it separates real responsibilities or removes meaningful duplication.
- Good extraction candidates:
  - process runner helpers
  - temp fixture setup/cleanup
  - package manager command wrappers
  - local HTTP registry server
  - registry dependency URL normalization
  - artifact assertion helpers
  - JSON/package file read/write helpers
  - repeated path safety helpers
- Bad extraction candidates:
  - one-off helpers used once
  - generic `utils` with unrelated functions
  - abstractions hiding simple sequential smoke flow
  - config-driven behavior with one caller
- Keep functions boring and small. Prefer explicit flow in top-level smoke scripts and focused helper modules below it.
- Preserve stdout/stderr lines that tests or users rely on. If output changes, prove it is not a public/tested contract.
- When moving helpers, update imports with repo ESM conventions.
- Add or update behavior tests for extracted helpers where the helper owns non-trivial behavior.

Verification:
- After each batch, run the script-specific command:
  - `pnpm run smoke:cli` for CLI smoke changes
  - `pnpm run smoke:shadcn` for shadcn/direct registry changes
  - `pnpm run smoke:packages` for package fixture changes
  - `pnpm run validate:artifacts:check` for artifact validation changes
  - relevant package tests/type-check for script helper changes
- If artifact/build scripts changed, run `pnpm run prepare:artifacts`.
- Final gates:
  - `npm run test-ci`
  - `pnpm run smoke:cli`
  - `pnpm run smoke:shadcn`
  - `pnpm run validate:artifacts:check`
  - `git diff --check`
  - `find . -type d \( -name node_modules -o -name .git -o -name .worktrees \) -prune -o \( -name '*.bak' -o -name '*.orig' -o -name '*.tmp' \) -print`

SOTA verify loop:
- Dispatch read-only completeness and code-review verifier subagents after refactors.
- They must check behavior equivalence, output contracts, public registry/direct install paths, and no over-abstracted helper design.
- Fix every finding, including Low/Info.
- Repeat until both verifiers report CLEAN and script quality is 5/5.

Final response:
- Before/after LOC list for every script over 500 LOC that was touched.
- What was extracted and why.
- Which behaviors were proven equivalent.
- Verification commands and results.
- Required untracked files.
- Explicit statement that application behavior, CLI UX, smoke semantics, and public contracts were preserved.
```

