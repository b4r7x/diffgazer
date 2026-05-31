# Thermo nuclear subagent handoff prompts

Date: 2026-05-31
Repo: `/Users/voitz/Projects/diffgazer-workspace`
Source audit: `audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md`
Fix spec: `audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md`

## How to use this file

Give the coordinator prompt to the main fixing agent. Use the worker prompts for parallel implementation only when their write sets do not overlap with other active workers. Use the reaudit prompts after all fixes and verification.

Do not ask two workers to regenerate public artifacts at the same time. Let implementation workers change source and tests, then have one coordinator run `pnpm run prepare:artifacts` and inspect the generated/public output.

## Coordinator prompt

```text
You are the remediation coordinator for /Users/voitz/Projects/diffgazer-workspace.

Read, in order:
1. AGENTS.md
2. audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md
3. audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md
4. audits/2026-05-31/THERMO-NUCLEAR-SUBAGENT-HANDOFF-PROMPTS.md

Start with git status --short. Do not revert unrelated worktree changes. Use rg for search and apply_patch for manual edits.

Goal: resolve every finding F001-F019 from the audit, keep fixes scoped to the repo ownership boundaries, add behavior-focused tests, regenerate required public registry artifacts once after source fixes are integrated, then run the final verification gates from the remediation spec.

Parallelization:
- Assign workers only the prompt blocks below.
- Keep write sets disjoint.
- Tell workers they are not alone in the codebase and must not revert or overwrite unrelated edits.
- Do not let multiple workers edit generated/public registry output at the same time.
- Review every worker result before integrating the next batch.

After each worker returns:
- Inspect its diff.
- Run the targeted commands listed in its prompt if the worker did not run them.
- Fix integration failures before starting the next dependent batch.
- Update a local remediation status note with resolved findings and evidence.

Final requirements:
- Run the artifact and final verification gates from THERMO-NUCLEAR-REMEDIATION-SPEC.md.
- Run the reaudit loop in this handoff file.
- Do not claim ready if any required verification failed, was skipped unexpectedly, or was not run.
- Final handoff must list changed files, resolved findings, commands run, skipped commands with reasons, remaining risks, and untracked files required for the change set.
```

## Implementation worker prompts

### Worker A: core ESM package handoff, F001

```text
You are Worker A on /Users/voitz/Projects/diffgazer-workspace.

You are not alone in the codebase. Do not revert unrelated edits. Own only the F001 fix and directly necessary tests/scripts in libs/core and scripts that validate core dist ESM imports.

Read:
- AGENTS.md
- audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md, F001
- audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md, F001

Task:
- Fix @diffgazer/core dist output so Node ESM can import public dist subpaths directly.
- Prefer a durable verifier modeled on libs/keys/scripts/verify-dist-esm-imports.ts.
- Cover dist/index.js, dist/api/index.js, and dist/schemas/config/index.js.
- Ensure scripts/monorepo/benchmark-server.mjs can import the built core API path it uses.

Do not:
- Weaken package exports.
- Hide the problem by changing the benchmark to avoid core imports unless that is the intended public contract and all package paths still work.
- Touch UI/keys/server fixes.

Run:
- pnpm --filter @diffgazer/core build
- node -e "import('./libs/core/dist/index.js')"
- node -e "import('./libs/core/dist/api/index.js')"
- node -e "import('./libs/core/dist/schemas/config/index.js')"
- pnpm --filter @diffgazer/core type-check
- pnpm --filter @diffgazer/core test
- git diff --check

Return:
- Files changed.
- Exact commands run and results.
- Whether F001 is resolved.
- Any remaining risk.
```

### Worker B: keys focusability and registry source, F002

```text
You are Worker B on /Users/voitz/Projects/diffgazer-workspace.

You are not alone in the codebase. Do not revert unrelated edits. Own only F002 and directly necessary libs/keys source/tests. Do not regenerate artifacts unless the coordinator explicitly asks you to.

Read:
- AGENTS.md
- audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md, F002
- audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md, F002

Task:
- Treat any aria-hidden="true" ancestor as hidden for focusable and tabbable queries.
- Replace the existing wrong test expectation with one that proves aria-hidden="false" cannot re-expose a hidden subtree.
- Check callers that feed focus trap/list navigation to make sure no extra fallback is needed.

Do not:
- Change public keyboard callback names.
- Collapse focusable and tabbable semantics.
- Touch generated public registry JSON unless assigned.

Run:
- pnpm --filter @diffgazer/keys test -- focusable
- pnpm --filter @diffgazer/keys type-check
- pnpm --filter @diffgazer/keys build
- git diff --check

Return:
- Files changed.
- Exact commands run and results.
- Whether F002 is resolved.
- Any remaining risk.
```

### Worker C: UI hooks and floating-position public API, F005-F007

```text
You are Worker C on /Users/voitz/Projects/diffgazer-workspace.

You are not alone in the codebase. Do not revert unrelated edits. Own F005, F006, and F007 in libs/ui hook source/tests/docs examples that directly consume these APIs. Do not regenerate public registry artifacts unless the coordinator explicitly asks you to.

Read:
- AGENTS.md
- audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md, F005-F007
- audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md, F005-F007

Task:
- Make useActiveHeading SSR-safe by removing render-time document/window reads.
- Make ownerDocument support work for iframe/cross-realm documents by using constructors from ownerDocument.defaultView.
- Preserve the old exported positional helper signatures for floating-position helpers, preferably as wrappers around object-form internals.
- Add behavior tests for SSR, ownerDocument behavior, and the old JS call shape.
- Update direct docs/examples only if needed by the public API contract.

Do not:
- Add defensive memoization or broad refactors.
- Replace public APIs with undocumented aliases.
- Touch unrelated UI primitives.

Run:
- pnpm --filter @diffgazer/ui test -- use-active-heading
- pnpm --filter @diffgazer/ui test -- floating
- pnpm --filter @diffgazer/ui type-check
- pnpm --filter @diffgazer/ui validate:registry
- git diff --check

Return:
- Files changed.
- Exact commands run and results.
- Whether F005, F006, and F007 are resolved.
- Any remaining risk.
```

### Worker D: registry path safety, F013

```text
You are Worker D on /Users/voitz/Projects/diffgazer-workspace.

You are not alone in the codebase. Do not revert unrelated edits. Own F013 in libs/registry and directly related validation tests. Do not edit generated/public registry output unless the coordinator explicitly asks you to.

Read:
- AGENTS.md
- audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md, F013
- audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md, F013

Task:
- Reject absolute and parent-escaping files[].path values in the public/source registry validation path.
- Replace tests that accept /etc/passwd and ../escape.tsx with rejection expectations for the public contract.
- Keep valid relative registry paths accepted for direct copy/shadcn consumers.

Do not:
- Loosen schema types with z.any or broad string fallbacks.
- Break source registry transforms that feed public registries.
- Touch UI/keys component source unless the validation fix proves it is required.

Run:
- pnpm --filter @diffgazer/registry test
- pnpm --filter @diffgazer/registry type-check
- pnpm --filter @diffgazer/ui validate:registry
- pnpm --filter @diffgazer/keys validate:registry
- git diff --check

Return:
- Files changed.
- Exact commands run and results.
- Whether F013 is resolved.
- Any remaining risk.
```

### Worker E: server auth, sessions, logging, and shutdown, F003-F004-F008-F010-F018

```text
You are Worker E on /Users/voitz/Projects/diffgazer-workspace.

You are not alone in the codebase. Do not revert unrelated edits. Own F003, F004, F008, F010, and F018 in cli/server, cli/diffgazer server integration, libs/core API helpers only where needed, and focused server/web tests that exercise these paths.

Read:
- AGENTS.md
- audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md, F003, F004, F008, F010, F018
- audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md, matching sections

Task:
- Restore standalone server plus web dev API behavior without weakening packaged CLI protection.
- Preserve event-cap warnings in completed SSE replay.
- Make packaged web mode quiet by default while keeping explicit diagnostic request logging.
- Make active-session lookup work for scoped reviews, or deliberately redefine and test the intended contract.
- Make SIGTERM/SIGINT shutdown abort or complete active sessions and close subscribers before process exit.
- Add behavior tests for each path.

Do not:
- Add broad compatibility shims.
- Hide auth failures with permissive fallback tokens.
- Change public API query shape without updating libs/core API helpers and app consumers together.
- Touch benchmark/deploy fixes.

Run:
- pnpm --filter @diffgazer/server test
- pnpm --filter @diffgazer/server type-check
- pnpm --filter diffgazer test
- pnpm --filter diffgazer type-check
- pnpm --filter @diffgazer/core test, if libs/core API helpers changed
- pnpm --filter @diffgazer/core type-check, if libs/core API helpers changed
- pnpm --filter @diffgazer/web test, if app consumers changed
- pnpm --filter @diffgazer/web type-check, if app consumers changed
- git diff --check

Return:
- Files changed.
- Exact commands run and results.
- Whether F003, F004, F008, F010, and F018 are resolved.
- Any remaining risk.
```

### Worker F: runtime comment cleanup, F009

```text
You are Worker F on /Users/voitz/Projects/diffgazer-workspace.

You are not alone in the codebase. Do not revert unrelated edits. Own F009 only.

Read:
- AGENTS.md
- audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md, F009
- audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md, F009

Task:
- Remove audit-ticket and historical remediation IDs from runtime source comments.
- Keep only durable rationale that helps a future reader understand the code.
- Do not change runtime behavior.

Run:
- pnpm --filter @diffgazer/server type-check
- pnpm run check
- git diff --check

Return:
- Files changed.
- Exact commands run and results.
- Whether F009 is resolved.
- Any remaining risk.
```

### Worker G: CI, benchmark, Dependabot, and Docker deploy, F011-F012-F014-F016-F019

```text
You are Worker G on /Users/voitz/Projects/diffgazer-workspace.

You are not alone in the codebase. Do not revert unrelated edits. Own F011, F012, F014, F016, and F019 in .github, root package scripts, scripts/monorepo, deploy Dockerfiles, apps/hub package/build path, and apps/landing deploy/build path.

Read:
- AGENTS.md
- audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md, F011, F012, F014, F016, F019
- audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md, matching sections

Task:
- Restore Dependabot npm coverage for transitive lockfile security updates.
- Make test-ci and release-check enforce benchmark latency SLOs.
- Make benchmark functional checks fail on any non-200 response, not only final status.
- Update hub Docker deploy so it builds @diffgazer/hub and copies apps/hub/dist.
- Restore landing type-checking in the Docker deploy path.
- Add or update script tests where the repo has command-contract coverage.

Do not:
- Remove benchmark checks to make CI pass.
- Make Dockerfiles depend on unbuilt source directories.
- Change unrelated app behavior.

Run:
- pnpm run test:scripts
- DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run bench
- pnpm run verify:monorepo
- pnpm --filter @diffgazer/hub type-check
- pnpm --filter @diffgazer/hub build
- pnpm --filter @diffgazer/landing type-check
- pnpm --filter @diffgazer/landing build
- docker build -f deploy/hub.Dockerfile ., if Docker is available
- docker build -f deploy/landing.Dockerfile ., if Docker is available
- git diff --check

Return:
- Files changed.
- Exact commands run and results.
- Any Docker skips with the exact reason.
- Whether F011, F012, F014, F016, and F019 are resolved.
- Any remaining risk.
```

### Worker H: benchmark dead opt-in cleanup, F015

```text
You are Worker H on /Users/voitz/Projects/diffgazer-workspace.

You are not alone in the codebase. Do not revert unrelated edits. Own F015 in scripts/monorepo benchmark code and artifact env definitions.

Read:
- AGENTS.md
- audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md, F015
- audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md, F015

Task:
- Either implement the review benchmark fully or remove the unusable DIFFGAZER_BENCH_REVIEW contract.
- Preferred fix: remove the env var from scripts/monorepo/artifacts/env.mjs, benchmark comments/prose, skip output, and tests that mention the dead opt-in.
- Keep benchmark docs limited to behavior that exists now.

Do not:
- Leave a documented opt-in path that only fails.
- Add placeholder tests for future behavior.
- Change unrelated benchmark SLOs.

Run:
- pnpm run test:scripts
- pnpm run bench
- pnpm run verify:monorepo
- git diff --check

Return:
- Files changed.
- Exact commands run and results.
- Whether F015 is resolved.
- Any remaining risk.
```

### Worker I: docs static routes, F017

```text
You are Worker I on /Users/voitz/Projects/diffgazer-workspace.

You are not alone in the codebase. Do not revert unrelated edits. Own F017 in apps/docs route/sitemap generation and focused docs tests.

Read:
- AGENTS.md
- audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md, F017
- audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md, F017

Task:
- Include /ui/hooks and /keys/hooks in sitemap/prerender when hooks/index.mdx exists.
- Keep generated hook item pages in the sitemap.
- Add tests for both hook index routes and at least one generated hook item route.

Do not:
- Mirror UI or keys implementation inside docs.
- Delete generated hook item coverage.
- Touch unrelated docs layout.

Run:
- pnpm --filter @diffgazer/docs test -- generate-sitemap
- pnpm --filter @diffgazer/docs type-check
- pnpm --filter @diffgazer/docs build
- git diff --check

Return:
- Files changed.
- Exact commands run and results.
- Whether F017 is resolved.
- Any remaining risk.
```

### Worker J: artifact integration after source fixes

```text
You are Worker J on /Users/voitz/Projects/diffgazer-workspace.

You are not alone in the codebase. Do not revert unrelated edits. Own artifact regeneration only after the coordinator confirms source fixes for public registries and docs are integrated.

Read:
- AGENTS.md
- audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md
- audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md, artifact and public handoff checklist

Task:
- Run artifact preparation once.
- Inspect generated/public changes.
- Keep committed public registries under libs/ui/public/r and libs/keys/public/r when source contracts changed.
- Do not commit deterministic generated data under libs/ui/docs/generated, libs/keys/docs/generated, or cli/add/src/generated unless repo rules explicitly allow it.
- Validate copy/package/direct consumption paths.

Run:
- pnpm run prepare:artifacts
- pnpm run validate:artifacts:check
- pnpm run smoke:packages
- pnpm run smoke:shadcn
- pnpm run smoke:cli
- git status --short
- git diff --check

Return:
- Files changed or generated.
- Which generated changes should be kept.
- Which generated changes should not be committed.
- Exact commands run and results.
- Any remaining risk.
```

## Reaudit subagent prompts

Run these only after implementation, targeted tests, artifact preparation, and final verification gates have been attempted. Pass the current remediation status file if one exists.

### Reaudit A: CLI, server, deploy, CI, and scripts

```text
You are Reauditor A on /Users/voitz/Projects/diffgazer-workspace.

Read:
- AGENTS.md
- audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md
- audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md
- audits/2026-05-31/THERMO-NUCLEAR-SUBAGENT-HANDOFF-PROMPTS.md
- the current remediation status file, if present

Scope:
- Verify F003, F004, F008, F009, F010, F011, F012, F014, F015, F016, F018, and F019 are fixed.
- Audit the current branch diff main...HEAD for new regressions in cli/server, cli/diffgazer, deploy, scripts/monorepo, root package scripts, and CI config.

Rules:
- Do not edit files.
- Deduplicate against the original audit and the remediation status file.
- Report only unresolved findings or new high-confidence regressions caused by the current branch.

Return:
- If clean, answer exactly: No unresolved or new findings.
- Otherwise include finding id, file:line, evidence path, impact, suggested fix, and whether it is unresolved or newly introduced.
```

### Reaudit B: public libraries, registry, package exports, and copy handoff

```text
You are Reauditor B on /Users/voitz/Projects/diffgazer-workspace.

Read:
- AGENTS.md
- audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md
- audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md
- audits/2026-05-31/THERMO-NUCLEAR-SUBAGENT-HANDOFF-PROMPTS.md
- the current remediation status file, if present

Scope:
- Verify F001, F002, F005, F006, F007, and F013 are fixed.
- Audit the current branch diff main...HEAD for new regressions in libs/core, libs/keys, libs/ui, libs/registry, public registry JSON, docs examples, package exports, and shadcn/copy consumption paths.

Rules:
- Do not edit files.
- Deduplicate against the original audit and the remediation status file.
- Report only unresolved findings or new high-confidence regressions caused by the current branch.

Return:
- If clean, answer exactly: No unresolved or new findings.
- Otherwise include finding id, file:line, evidence path, impact, suggested fix, and whether it is unresolved or newly introduced.
```

### Reaudit C: apps, docs routes, React behavior, tests, and generated artifacts

```text
You are Reauditor C on /Users/voitz/Projects/diffgazer-workspace.

Read:
- AGENTS.md
- audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md
- audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md
- audits/2026-05-31/THERMO-NUCLEAR-SUBAGENT-HANDOFF-PROMPTS.md
- the current remediation status file, if present

Scope:
- Verify F017 and app-facing fixes for F003, F005, F006, F007, F010, F016, and F019.
- Audit the current branch diff main...HEAD for new regressions in apps/web, apps/docs, apps/landing, apps/hub, cli/add, React behavior, accessibility, generated artifact boundaries, and user-facing workflows.

Rules:
- Do not edit files.
- Deduplicate against the original audit and the remediation status file.
- Report only unresolved findings or new high-confidence regressions caused by the current branch.

Return:
- If clean, answer exactly: No unresolved or new findings.
- Otherwise include finding id, file:line, evidence path, impact, suggested fix, and whether it is unresolved or newly introduced.
```

## Convergence prompt

Use this after any reaudit finds unresolved or new issues.

```text
You are continuing the remediation loop for /Users/voitz/Projects/diffgazer-workspace.

Read the original audit, remediation spec, subagent prompt file, and current remediation status. The last reaudit found unresolved or new issues. Fix only those accepted issues, update tests and verification evidence, then rerun all three reaudit prompts.

Do not rediscover or re-report the same issue without adding new evidence. Stop only after one full deduplicated reaudit round returns no unresolved or new findings from all reauditors.
```

