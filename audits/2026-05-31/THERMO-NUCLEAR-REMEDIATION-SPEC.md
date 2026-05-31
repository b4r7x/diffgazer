# Thermo nuclear remediation and reaudit spec

Date: 2026-05-31
Branch under review: `audit-2026-05-28-remediation`
Source audit: `audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md`
Base comparison: `main...HEAD`

## Handoff prompt

Use this prompt for the fixing agent:

```text
You are fixing the findings in /Users/voitz/Projects/diffgazer-workspace/audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md.

Read AGENTS.md instructions first. Start with git status --short. Do not revert unrelated worktree changes. Use rg for search and apply_patch for manual edits.

Goal: resolve F001-F019, add behavior-focused tests or verification for each fix, regenerate committed public registry artifacts when required, then run the targeted and final verification gates in /Users/voitz/Projects/diffgazer-workspace/audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md.

Work in batches. Keep fixes scoped to the owning package boundaries. Do not weaken tests, hide failures, add compatibility-only aliases unless the finding explicitly needs a public compatibility wrapper, or leave generated artifacts stale.

After implementation, perform the reaudit loop described in the spec. Do not claim ready if any required verification fails, is skipped unexpectedly, or is not run.
```

## Operating rules

- [ ] Read `AGENTS.md` and the full source audit before editing.
- [ ] Run `git status --short` before the first edit and before final handoff.
- [ ] Preserve unrelated dirty files.
- [ ] Fix root causes. Do not silence symptoms with permissive fallbacks.
- [ ] Keep public contracts consistent across source, docs, examples, generated public registries, and package exports.
- [ ] Add behavior tests for logic, API, accessibility, focus, registry validation, CLI, or deployment-gate changes.
- [ ] Run the narrowest relevant tests after each batch, then broader gates at the end.
- [ ] Update this checklist or a sibling status file with pass/fail evidence for every item.
- [ ] Run `git diff --check` before final handoff.

## Recommended batch order

### Batch 1: package and registry correctness

Owns F001, F002, F005, F006, F007, F013.

Rationale: these findings affect public package/copy consumers and generated registry artifacts. Fix them before app/docs validation so downstream checks exercise the final public contract.

### Batch 2: server and review runtime correctness

Owns F003, F004, F008, F009, F010, F018.

Rationale: these findings share `cli/server` and `cli/diffgazer` runtime paths. Fix auth, session lookup, SSE replay, logging, comments, and shutdown together so tests can cover the full server lifecycle.

### Batch 3: CI, benchmark, and deploy gates

Owns F011, F012, F014, F015, F016, F019.

Rationale: these findings are about release confidence and deploy output. Fix benchmark semantics and Docker build paths before running release-style gates.

### Batch 4: docs static coverage

Owns F017 and any docs changes needed by earlier public API fixes.

Rationale: docs route generation depends on generated data and should be checked after public registry and docs source are stable.

## Remediation checklist

### F001: `@diffgazer/core` dist emits extensionless ESM imports

- [ ] Fix `libs/core` build output so Node ESM can import public dist subpaths directly.
- [ ] Prefer a durable guard modeled on `libs/keys/scripts/verify-dist-esm-imports.ts`; do not rely on one manual import check.
- [ ] Cover at least `dist/index.js`, `dist/api/index.js`, and `dist/schemas/config/index.js`.
- [ ] Ensure `scripts/monorepo/benchmark-server.mjs` can import the built core API path it uses.
- [ ] Run:
  - `pnpm --filter @diffgazer/core build`
  - `node -e "import('./libs/core/dist/index.js')"`
  - `node -e "import('./libs/core/dist/api/index.js')"`
  - `node -e "import('./libs/core/dist/schemas/config/index.js')"`
  - `pnpm --filter @diffgazer/core type-check`
  - `pnpm --filter @diffgazer/core test`

### F002: `aria-hidden="false"` inside hidden ancestor is treated as focusable

- [ ] Treat any `aria-hidden="true"` ancestor as hidden for focusable and tabbable queries.
- [ ] Update the existing test that currently locks in the wrong behavior.
- [ ] Verify focus trap/list helpers no longer receive elements hidden by an ancestor.
- [ ] Regenerate keys public registry artifacts if registry source changes.
- [ ] Run:
  - `pnpm --filter @diffgazer/keys test -- focusable`
  - `pnpm --filter @diffgazer/keys type-check`
  - `pnpm --filter @diffgazer/keys build`

### F003: standalone dev review API is locked out by global token gate

- [ ] Restore the documented split dev workflow for `pnpm --filter @diffgazer/server dev` plus web dev.
- [ ] Keep packaged/CLI-managed API protection intact.
- [ ] Make the server and web dev client agree on the token automatically, or explicitly scope the token gate to modes that can provide it.
- [ ] Add tests for missing-token standalone dev behavior and protected packaged behavior.
- [ ] Run:
  - `pnpm --filter @diffgazer/server test`
  - `pnpm --filter @diffgazer/server type-check`
  - `pnpm --filter diffgazer test`
  - `pnpm --filter diffgazer type-check`

### F004: event-cap warning is removed from completed-session SSE replay

- [ ] Preserve the event-cap warning after a terminal `complete` or `error` event.
- [ ] Add a replay test for overflow followed by terminal event and late SSE subscription.
- [ ] Ensure terminal events still appear exactly once and complete the replay stream.
- [ ] Run:
  - `pnpm --filter @diffgazer/server test`
  - `pnpm --filter @diffgazer/server type-check`

### F005: `useActiveHeading` is not SSR safe

- [ ] Remove render-time reads of `document` or `window`.
- [ ] Use `ownerDocument ?? (typeof document !== "undefined" ? document : null)` or an equivalent SSR-safe resolution.
- [ ] Make effects and callbacks no-op when no document is available.
- [ ] Add an SSR test using `renderToString()` or the repo's existing SSR test pattern.
- [ ] Regenerate UI public registry output.
- [ ] Run:
  - `pnpm --filter @diffgazer/ui test -- use-active-heading`
  - `pnpm --filter @diffgazer/ui type-check`
  - `pnpm --filter @diffgazer/ui validate:registry`

### F006: `useActiveHeading` fails for iframe or cross-realm documents

- [ ] Use constructors from `ownerDocument.defaultView` instead of the host realm.
- [ ] Apply the same owner-document logic to heading filtering, container resolution, and `scrollTo`.
- [ ] Add a cross-document test if jsdom supports it in the existing setup; otherwise add the closest behavior test plus a short code comment only where needed.
- [ ] Regenerate UI public registry output.
- [ ] Run the same UI commands listed for F005.

### F007: public floating-position helper signatures changed silently

- [ ] Preserve the old positional helper signatures for exported public helpers, or intentionally update every public consumer, docs page, example, registry file, and package contract.
- [ ] Preferred fix: keep exported wrappers for the old positional signature and use object-form helpers internally.
- [ ] Add tests for the old JS call shape, not only TypeScript usage.
- [ ] Run:
  - `pnpm --filter @diffgazer/ui test -- floating`
  - `pnpm --filter @diffgazer/ui type-check`
  - `pnpm --filter @diffgazer/ui validate:registry`

### F008: packaged web mode logs every request by default

- [ ] Make request logging quiet by default in user-facing packaged CLI web mode.
- [ ] Keep diagnostic request logging available through an explicit env var or dev mode.
- [ ] Add or update tests around logger default level and packaged server mode.
- [ ] Run:
  - `pnpm --filter @diffgazer/server test`
  - `pnpm --filter diffgazer test`
  - `pnpm --filter diffgazer type-check`

### F009: audit-ticket comments leaked into runtime source

- [ ] Remove comments that reference audit IDs or historical remediation tickets from runtime source.
- [ ] Keep only durable rationale that helps future maintainers understand the code.
- [ ] Run:
  - `pnpm --filter @diffgazer/server type-check`
  - `pnpm run check`

### F010: active-session lookup cannot find scoped reviews

- [ ] Decide the intended public contract: active lookup by exact scope, or active lookup by mode regardless of scope.
- [ ] Implement that contract consistently in schemas, route handling, service logic, and `libs/core` API helpers.
- [ ] Add tests for scoped create-review followed by active-session lookup.
- [ ] If query shape changes, update public API types and app consumers together.
- [ ] Run:
  - `pnpm --filter @diffgazer/server test`
  - `pnpm --filter @diffgazer/core test`
  - `pnpm --filter @diffgazer/web test`
  - `pnpm --filter @diffgazer/server type-check`
  - `pnpm --filter @diffgazer/core type-check`
  - `pnpm --filter @diffgazer/web type-check`

### F011: Dependabot npm security coverage narrowed to direct dependencies

- [ ] Remove the npm `allow` stanza unless the project intentionally accepts losing transitive lockfile security updates.
- [ ] Keep any intended grouping or scheduling behavior intact.
- [ ] Run:
  - `pnpm run verify:monorepo`
  - `git diff --check`

### F012: `test-ci` and `release-check` do not enforce benchmark latency SLOs

- [ ] Ensure benchmark strictness applies to `pnpm run bench` inside `test-ci` and `release-check`.
- [ ] Prefer exporting `DIFFGAZER_SMOKE_STRICT_SKIPS=1` for the whole relevant command chain or setting it directly on the bench command.
- [ ] Add a scripts test if the repo has command-contract tests for package scripts.
- [ ] Run:
  - `pnpm run test:scripts`
  - `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run bench`

### F013: registry test locks in unsafe base/public path contract

- [ ] Reject absolute and parent-escaping `files[].path` values in the public/source registry validation path.
- [ ] Replace the compatibility test that accepts `/etc/passwd` and `../escape.tsx` with rejection expectations for the public contract.
- [ ] Ensure direct shadcn/copy consumers still receive valid relative paths.
- [ ] Run:
  - `pnpm --filter @diffgazer/registry test`
  - `pnpm --filter @diffgazer/registry type-check`
  - `pnpm --filter @diffgazer/ui validate:registry`
  - `pnpm --filter @diffgazer/keys validate:registry`

### F014: benchmark hides non-200 responses unless final request fails

- [ ] Track every non-200 response per scenario, not only the last status.
- [ ] Fail functional benchmark checks when any request returns a non-200 status.
- [ ] Preserve useful failure output, including first failing status and count by status.
- [ ] Add or update unit tests for benchmark scenario result aggregation if feasible.
- [ ] Run:
  - `pnpm run test:scripts`
  - `pnpm run bench`

### F015: benchmark exposes review opt-in env var that only fails

- [ ] Either implement the review benchmark fully or remove the unusable `DIFFGAZER_BENCH_REVIEW` contract and skip message.
- [ ] Preferred fix unless implementation is ready: remove the env var from `scripts/monorepo/artifacts/env.mjs`, benchmark prose, and skip output.
- [ ] Keep benchmark documentation limited to behavior that exists.
- [ ] Run:
  - `pnpm run test:scripts`
  - `pnpm run verify:monorepo`

### F016: Hub Docker image no longer ships the app shell

- [ ] Update `deploy/hub.Dockerfile` to build `@diffgazer/hub` and copy `apps/hub/dist` into nginx.
- [ ] Remove stale comments saying no build step is needed.
- [ ] Keep the nginx SPA fallback behavior intact.
- [ ] Run:
  - `pnpm --filter @diffgazer/hub build`
  - `pnpm --filter @diffgazer/hub type-check`
  - If Docker is available: `docker build -f deploy/hub.Dockerfile .`
  - If Docker is unavailable: document the skip and verify the Dockerfile copies `apps/hub/dist`.

### F017: docs breadcrumb hook index routes missing from sitemap/prerender

- [ ] Include `/ui/hooks` and `/keys/hooks` when their `hooks/index.mdx` pages exist.
- [ ] Keep generated hook item pages in the sitemap.
- [ ] Add sitemap tests for both hook index routes and at least one hook item route.
- [ ] Run:
  - `pnpm --filter @diffgazer/docs test -- generate-sitemap`
  - `pnpm --filter @diffgazer/docs type-check`
  - `pnpm --filter @diffgazer/docs build`

### F018: server SIGTERM no longer stops active review work

- [ ] Make shutdown abort or complete active sessions and close subscribers before or while closing the HTTP server.
- [ ] Ensure the parent process grace timeout is longer than the child force-kill delay, or remove the race another way.
- [ ] Add tests for `shutdownSessions()` with an active session and subscriber.
- [ ] Run:
  - `pnpm --filter @diffgazer/server test`
  - `pnpm --filter @diffgazer/server type-check`
  - `pnpm --filter diffgazer test`

### F019: Landing Docker deploy no longer type-checks the app

- [ ] Restore type-checking in the landing deploy path.
- [ ] Preferred fix: either restore `apps/landing` build to `tsc -b && vite build`, or add `pnpm --filter @diffgazer/landing type-check` before the Dockerfile build command.
- [ ] Keep local build/dev scripts consistent with sibling app conventions.
- [ ] Run:
  - `pnpm --filter @diffgazer/landing type-check`
  - `pnpm --filter @diffgazer/landing build`
  - If Docker is available: `docker build -f deploy/landing.Dockerfile .`
  - If Docker is unavailable: document the skip and verify the Dockerfile runs the type-check path or the build script includes it.

## Artifact and public handoff checklist

Run this after fixes that touch `libs/ui`, `libs/keys`, `libs/registry`, `cli/add`, docs generated data, or public registry files:

- [ ] `pnpm run prepare:artifacts`
- [ ] `pnpm run validate:artifacts:check`
- [ ] `git status --short` and inspect generated/public changes.
- [ ] Ensure deterministic generated data under `libs/ui/docs/generated`, `libs/keys/docs/generated`, or `cli/add/src/generated` is not committed unless repo rules explicitly allow it.
- [ ] Ensure committed public registries under `libs/ui/public/r` and `libs/keys/public/r` are updated when their source contract changes.
- [ ] Run package copy/package/direct smoke checks if registry paths or package exports changed:
  - `pnpm run smoke:packages`
  - `pnpm run smoke:shadcn`
  - `pnpm run smoke:cli`

## Final verification gates

Run narrow checks first. Then run the broader gates below before claiming ready:

- [ ] `git diff --check`
- [ ] `pnpm run prepare:artifacts`
- [ ] `pnpm run validate:artifacts:check`
- [ ] `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check`
- [ ] `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test`
- [ ] `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test:types`
- [ ] `pnpm run test:scripts`
- [ ] `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke`
- [ ] `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run bench`
- [ ] `pnpm run verify:monorepo`
- [ ] Package dry runs if public package handoff changed:
  - `pnpm --filter @diffgazer/add pack --dry-run`
  - `pnpm --filter @diffgazer/ui pack --dry-run`
  - `pnpm --filter @diffgazer/keys pack --dry-run`
  - `pnpm --filter diffgazer pack --dry-run`

Record any skip with the exact reason. "Took too long" is not a valid ready-state skip.

## Reaudit loop

After all fixes and final verification, run a reaudit loop. Use the fixed branch diff against `main`, not only the files that changed during remediation.

### Local reaudit pass

- [ ] Re-read `audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md`.
- [ ] For each F001-F019, verify the evidence path no longer reproduces.
- [ ] Add a `Reaudit results` section to this file or a sibling file with:
  - finding id
  - status: `resolved`, `still failing`, or `superseded`
  - command or inspection evidence
  - remaining risk
- [ ] Search for new issues introduced by the fixes with `git diff main...HEAD` and `rg` rather than checking only touched lines.

### Subagent reaudit prompts

Spawn independent reauditors after the local pass. Give each one the source audit, this spec, and the current diff. Require dedupe against already reported findings.

Use these prompts:

```text
Reaudit pass A: CLI, server, deploy, CI, and scripts.

Repo: /Users/voitz/Projects/diffgazer-workspace.
Read audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md and audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md first.

Verify F003, F004, F008, F009, F010, F011, F012, F014, F015, F016, F018, and F019 are fixed. Then audit the current branch diff main...HEAD for new regressions in cli/server, cli/diffgazer, deploy, scripts/monorepo, root package scripts, and CI config.

Report only unresolved findings or new high-confidence regressions with file:line, evidence, impact, and fix. If clean, answer exactly: No unresolved or new findings.
```

```text
Reaudit pass B: public libraries, registry, package exports, and copy handoff.

Repo: /Users/voitz/Projects/diffgazer-workspace.
Read audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md and audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md first.

Verify F001, F002, F005, F006, F007, and F013 are fixed. Then audit the current branch diff main...HEAD for new regressions in libs/core, libs/keys, libs/ui, libs/registry, public registry JSON, docs examples, package exports, and shadcn/copy consumption paths.

Report only unresolved findings or new high-confidence regressions with file:line, evidence, impact, and fix. If clean, answer exactly: No unresolved or new findings.
```

```text
Reaudit pass C: apps, docs routes, React behavior, tests, and generated artifacts.

Repo: /Users/voitz/Projects/diffgazer-workspace.
Read audits/2026-05-31/THERMO-NUCLEAR-AUDIT.md and audits/2026-05-31/THERMO-NUCLEAR-REMEDIATION-SPEC.md first.

Verify F017 and any app-facing fixes for F003, F005, F006, F007, F010, F016, and F019. Then audit the current branch diff main...HEAD for new regressions in apps/web, apps/docs, apps/landing, apps/hub, cli/add, React behavior, accessibility, generated artifact boundaries, and user-facing workflows.

Report only unresolved findings or new high-confidence regressions with file:line, evidence, impact, and fix. If clean, answer exactly: No unresolved or new findings.
```

### Reaudit convergence rule

- [ ] If any reaudit pass reports an unresolved or new finding, fix it and run another full reaudit round with the updated findings list.
- [ ] Do not keep rediscovering the same issue. Add every accepted unresolved/new finding to the reaudit status file before spawning the next round.
- [ ] Stop only after one complete deduplicated round returns no unresolved or new findings from all reauditors.
- [ ] Final handoff must list:
  - all files changed
  - findings resolved
  - commands run and their result
  - commands skipped and why
  - remaining risks
  - untracked files required for the change set

