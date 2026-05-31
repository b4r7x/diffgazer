# Thermo Nuclear Audit Loop

Date: 2026-05-31
Branch: `audit-2026-05-28-remediation`
Base: `main...HEAD`

## Scope

- Review target: current branch diff against `main`.
- Changed files: 711.
- Diff size: 16,878 insertions and 4,509 deletions.
- Primary packages touched: `libs/ui`, `cli/diffgazer`, `libs/core`, `cli/server`, `apps/web`, `libs/keys`, `apps/docs`, `cli/add`, `apps/landing`, `apps/hub`, `libs/registry`, and `scripts/monorepo`.

## Review Rules

- Only report issues caused by added or modified code in this branch.
- Prefer high-confidence medium/high findings over low-value nits.
- Every finding must include file and line references plus the reviewed execution path or structural reason.
- Deduplicate against the findings already listed in this file before adding a new one.
- If a later round finds no new high-confidence findings, record that round as a convergence pass.

## Findings

### F001 - High - `@diffgazer/core` dist emits extensionless ESM imports that Node cannot resolve

- Location: `libs/core/tsconfig/base.json:7`
- Related: `libs/core/dist/api/index.js:1`, `libs/core/dist/index.js:1`, `libs/core/dist/schemas/config/index.js:1`
- Category: correctness / package handoff / devex
- Evidence: this branch changes `libs/core` from `module: "NodeNext"` and `moduleResolution: "NodeNext"` to `module: "ESNext"` and `moduleResolution: "Bundler"`. After `pnpm --filter @diffgazer/core build`, `tsc` preserves extensionless relative specifiers in emitted JS. Direct Node ESM imports fail:
  - `node -e "import('./libs/core/dist/api/index.js')"` -> `ERR_MODULE_NOT_FOUND Cannot find module .../libs/core/dist/api/bound`
  - `node -e "import('./libs/core/dist/index.js')"` -> missing `dist/layout/breakpoints`
  - `node -e "import('./libs/core/dist/schemas/config/index.js')"` -> missing `dist/schemas/config/models`
- Impact: public subpaths such as `@diffgazer/core/api`, `@diffgazer/core/api/hooks`, `@diffgazer/core/navigation`, and `@diffgazer/core/theme` break for direct Node ESM consumers and unbundled server/runtime paths. The new `scripts/monorepo/benchmark-server.mjs` explicitly imports `libs/core/dist/api/index.js`, so `pnpm run bench` cannot work after this build shape. This is the exact class of issue guarded for `@diffgazer/keys` by `libs/keys/scripts/verify-dist-esm-imports.ts`, but no equivalent guard exists for core.
- Fix: either keep `libs/core` on NodeNext with explicit `.js` source specifiers, or add a core dist ESM verifier and update all relative source imports/exports so emitted dist uses `.js` specifiers before publishing or running Node direct-import scripts.

### F002 - Medium - `aria-hidden="false"` inside a hidden ancestor is incorrectly treated as focusable

- Location: `libs/keys/src/dom/focusable.ts:36`
- Related: `libs/keys/src/dom/focusable.test.ts:128`, `libs/keys/public/r/focusable.json:11`
- Category: accessibility / keyboard correctness / public registry handoff
- Evidence: the new `isAriaHidden()` logic checks only the nearest explicit `aria-hidden` ancestor. That means `<div aria-hidden="true"><div aria-hidden="false"><button /></div></div>` is treated as focusable/tabbable, and the added test locks in that behavior. In ARIA, `aria-hidden="false"` does not re-expose an element hidden by an ancestor. `getFocusableElements()` and `getTabbableElements()` feed focus trap initial focus and Tab order, so the regression can move focus into an accessibility-hidden subtree. The same logic is already present in public registry copy output.
- Fix: treat any `aria-hidden="true"` ancestor as hidden, for example `element.closest('[aria-hidden="true"]') !== null`; update the test to expect the entire hidden subtree to be excluded; regenerate keys public registry artifacts.

### F003 - High - Standalone dev review API is locked out by the new global token gate

- Location: `cli/server/src/app.ts:91`
- Related: `cli/server/src/dev.ts:7`, `cli/server/src/http-server.ts:19`
- Category: devex / local workflow regression / API correctness
- Evidence: `pnpm --filter @diffgazer/server dev` starts `createApp()` without creating `DIFFGAZER_SHUTDOWN_TOKEN`. The new global `/api/*` middleware rejects every non-health API request when the token env var is missing. The split dev hint prints `VITE_API_URL=... pnpm --filter @diffgazer/web dev`, but the web client only sends a token when `window.__DIFFGAZER_SHUTDOWN_TOKEN__` or `VITE_DIFFGAZER_SHUTDOWN_TOKEN` exists. Result: `/api/review/*`, config, settings, and other non-health dev API calls return `401` before route/setup/trust logic.
- Impact: the documented standalone server + web development workflow is broken unless a developer manually invents and wires matching server/client token env vars.
- Fix: in server dev, mint/set a token when missing and print/export both `DIFFGAZER_SHUTDOWN_TOKEN` and `VITE_DIFFGAZER_SHUTDOWN_TOKEN` for the web dev command, or scope the shutdown-token gate to CLI-managed/packaged mode and preserve standalone dev behavior explicitly.

### F004 - Medium - Event-cap warning is removed from completed-session SSE replay

- Location: `cli/server/src/features/review/sessions.ts:87`
- Related: `cli/server/src/features/review/sessions.ts:239`, `cli/server/src/features/review/sse-replay.ts:67`
- Category: correctness / SSE replay / observability
- Evidence: after 10,000 events, the first dropped non-terminal event pushes a `chunk` cap warning into `session.events`. If the review later emits `complete` or `error`, `storeSessionEvent()` overwrites `session.events[session.events.length - 1]`, which is that warning. Late or reconnected SSE clients replay `session.events`, so they see the terminal result but not the warning that progress events were truncated.
- Impact: the branch intended to make event truncation visible to clients, but the important replay path still loses the warning for completed long reviews.
- Fix: preserve the warning in a reserved slot and overwrite an older progress event for the terminal event, or keep a separate replay-only cap warning that terminal replacement cannot replace. Add a test for overflow followed by terminal and then SSE replay.

### F005 - High - `useActiveHeading` is no longer SSR/prerender safe

- Location: `libs/ui/registry/hooks/use-active-heading.ts:111`
- Related: `libs/ui/public/r/registry.json:1994`
- Category: public UI hook correctness / SSR / registry handoff
- Evidence: this branch evaluates `ownerDocument ?? document` during render. Rendering a component that calls `useActiveHeading({ ids: ["a"] })` with `renderToString()` throws `ReferenceError: document is not defined`. The same code is shipped through the public registry item.
- Impact: docs/static prerender and package consumers using the hook in SSR contexts can crash before effects run.
- Fix: do not read browser globals during render. Resolve `doc` as `ownerDocument ?? (typeof document !== "undefined" ? document : null)`, no-op effects and `scrollTo` when `doc` is null, and keep browser global access inside effects/callbacks.

### F006 - Medium - `useActiveHeading` ownerDocument support fails for iframe/cross-realm documents

- Location: `libs/ui/registry/hooks/use-active-heading.ts:42`
- Related: `libs/ui/registry/hooks/use-active-heading.ts:122`, `libs/ui/registry/hooks/use-active-heading.ts:217`
- Category: DOM correctness / public UI hook behavior
- Evidence: the new owner-document contract claims iframe support, but the hook checks `el instanceof HTMLElement` against the host realm. In real iframe/cross-realm documents, elements from `ownerDocument.defaultView` are not instances of the host `HTMLElement`, so heading filtering and container handling can choose the wrong active heading.
- Impact: consumers passing an iframe document or cross-realm owner document get incorrect active-heading state despite the new API claiming support for that use case.
- Fix: derive constructors from `doc.defaultView`, e.g. `el instanceof doc.defaultView.HTMLElement`, and apply that owner-document guard consistently in container resolution, heading filtering, and `scrollTo`.

### F007 - Medium - Public floating-position helper signatures changed silently

- Location: `libs/ui/registry/hooks/use-floating-position.ts:12`
- Related: `libs/ui/registry/hooks/compute-floating-position.ts:9`
- Category: public API break / package and registry handoff
- Evidence: `main` exported positional helpers from `use-floating-position`; this branch re-exports object-parameter helpers. Existing JS consumers calling `computePosition(trigger, content, "bottom", "start", 6, 10)` now receive the wrong result, such as `{ x: 0, y: 0 }`, because the function interprets the first element argument as the options object.
- Impact: this silently breaks existing package/copy consumers without a type error in plain JS and without an intentional public API migration.
- Fix: preserve the exported positional helper signatures as wrappers, or stop exporting internal object-form helpers and update the public API/docs/versioning deliberately.

### F008 - Medium - Default packaged web mode prints a JSON log line for every request

- Location: `cli/server/src/app.ts:59`
- Related: `cli/server/src/shared/lib/log.ts:10`, `cli/diffgazer/src/lib/servers/embedded-server.ts:101`
- Category: user-facing devex / CLI output regression
- Evidence: `createApp()` installs `requestLogger` globally. The structured logger defaults to `info` when `DIFFGAZER_LOG_LEVEL` is unset. The embedded packaged CLI web server runs the same app in the user-facing `diffgazer` process, so health, SPA, asset, and API requests emit JSON log lines to stdout by default.
- Impact: ordinary `diffgazer` web mode pollutes the terminal with per-request JSON logs unless the user knows to set a log-level env var.
- Fix: default packaged CLI logging to `warn` or off, and make info request logs opt-in via `DIFFGAZER_LOG_LEVEL=info`; alternatively skip request logging by default outside dev/diagnostic mode.

### F009 - Low - Audit-ticket comments leaked into runtime source

- Location: `cli/server/src/app.ts:129`
- Related: `cli/server/src/shared/lib/config/store.ts:79`
- Category: anti-slop / maintainability
- Evidence: runtime source comments reference remediation IDs (`F148`, `F100`, `STRUCTURE.md §6`) instead of durable code rationale. These IDs make sense in the audit trail, but future readers of runtime code cannot resolve them without historical context.
- Impact: small but real reader-load regression in shared server code.
- Fix: remove ticket IDs and keep only the short architectural reason, or move the remediation note to the audit docs.

### F010 - Medium - Active-session lookup cannot find scoped reviews started through the public API

- Location: `cli/server/src/features/review/review-routes.ts:109`
- Related: `cli/server/src/features/review/schemas.ts:21`, `cli/server/src/features/review/service.ts:122`, `libs/core/src/api/review.ts:20`
- Category: API correctness / resume workflow
- Evidence: this branch adds `scopeKey` to session creation/deduplication using explicit `files`, `lenses`, and `profile`. `getActiveSessionForProject()` now requires the same `scopeKey` to find a session. However `/api/review/sessions/active` still accepts only `mode` and calls `getActiveSessionForProject()` without `scopeKey`, so it only finds sessions whose scope key is empty. The public `createReview()` API still exposes `profile`, `lenses`, and `files`, so clients can create sessions that active-session lookup can no longer discover.
- Impact: a client that starts a scoped review can receive a `reviewId`, but later "active review" resume discovery returns `null` for the same repository state and mode.
- Fix: either expose the same scope inputs on `ActiveSessionQuerySchema` and pass `buildScopeKey()` into the lookup, or intentionally redefine active-session lookup to return any active session for the mode and update dedupe semantics/tests accordingly.

### F011 - Medium - Dependabot npm security coverage is narrowed to direct dependencies

- Location: `.github/dependabot.yml:46`
- Category: security maintenance / supply-chain devex
- Evidence: this branch adds `allow: - dependency-type: "direct"` under the npm updater. `allow` constrains the dependencies Dependabot is allowed to maintain, and `direct` means explicitly declared dependencies only. Transitive-only vulnerable packages in `pnpm-lock.yaml` can therefore stop receiving Dependabot security PRs.
- Impact: lockfile vulnerabilities in transitive packages may be missed even though the repo previously relied on Dependabot to surface them.
- Fix: remove the `allow` stanza unless the repo intentionally accepts losing transitive lockfile security update coverage.

### F012 - Medium - `test-ci` and `release-check` do not enforce benchmark latency SLOs

- Location: `package.json:24`
- Related: `package.json:25`, `scripts/monorepo/benchmark-server.mjs:249`
- Category: CI/release gate correctness
- Evidence: `DIFFGAZER_SMOKE_STRICT_SKIPS=1` is scoped only to `pnpm run smoke`; the following `pnpm run bench` runs without the strict env var. The benchmark gates latency and throughput breaches only when `DIFFGAZER_SMOKE_STRICT_SKIPS=1`; otherwise it warns and exits 0.
- Impact: `pnpm run test-ci` and `pnpm run release-check` can pass despite p95/p99/throughput benchmark breaches. Functional benchmark failures still fail.
- Fix: set strict for the bench step too, for example `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run bench`, or export it for the whole `sh -c` chain.

### F013 - Medium - Registry test locks in an unsafe base/public path contract

- Location: `libs/registry/src/testing/registry.test.ts:130`
- Related: `libs/registry/src/registry-types.ts:3`, `libs/registry/src/shadcn/validate.ts:89`, `libs/registry/src/shadcn/validate.ts:154`
- Category: registry validation / path safety / public handoff
- Evidence: the new compatibility test asserts that the base `RegistryItemSchema` accepts file paths like `/etc/passwd` and `../escape.tsx`. The same base schema defines `files[].path` as a plain `z.string()` and is used by public registry freshness validation. That validation later resolves registry file paths directly with `resolve(rootDir, expectedFile.path)`, so an absolute or escaping path can pass schema parsing before file existence/content checks.
- Impact: public registry/handoff validation can accept unsafe or escaping `files[].path`, while the new test makes hardening the shared/base contract a CI-breaking change.
- Fix: move the relative/no-`..` path refinement into the shared public registry schema, or add a public/source registry validator that rejects those paths and replace this test with rejection expectations for base/public validation.

### F014 - Medium - Benchmark hides non-200 responses unless the final request fails

- Location: `scripts/monorepo/benchmark-server.mjs:116`
- Related: `scripts/monorepo/benchmark-server.mjs:124`, `scripts/monorepo/benchmark-server.mjs:142`
- Category: benchmark correctness / CI gate reliability
- Evidence: `runScenario()` stores only `lastStatus`, overwriting it on every request, and `checkSlo()` treats the whole scenario as functionally failed only when that final status is not 200. Any earlier 401/500 in the 1000-2000 request run is hidden if the final request succeeds.
- Impact: `pnpm run bench`, `test-ci`, and `release-check` can pass despite real API errors under load. This is distinct from F012: even if strict latency gating is fixed, functional failures can still be masked.
- Fix: track every non-200 response in `runScenario()` via counts or first failure, return that summary, and make `checkSlo()` fail if any response status is not 200.

### F015 - Medium - Benchmark exposes a review opt-in env var that only fails

- Location: `scripts/monorepo/benchmark-server.mjs:232`
- Related: `scripts/monorepo/artifacts/env.mjs:10`
- Category: benchmark design / dead surface area / maintainability
- Evidence: `DIFFGAZER_BENCH_REVIEW` is exposed as a benchmark env contract and the skip path tells users to set it. When set, the script only appends a functional failure because the review benchmark is not implemented. The long file header also documents deferred benchmark scenarios instead of executable behavior.
- Impact: the benchmark has a public-looking opt-in path that cannot work, creating dead surface area and reviewer burden around non-existent coverage.
- Fix: remove the `DIFFGAZER_BENCH_REVIEW` env contract, skip message, and deferral prose until the scenario exists, or implement the authenticated `POST /api/review` benchmark and keep only concise run prerequisites.

### F016 - High - Hub Docker image no longer ships the app shell

- Location: `deploy/hub.Dockerfile:4`
- Related: `apps/hub/package.json:9`, `apps/hub/index.html:23`, `deploy/spa-nginx.conf`
- Category: deployment correctness
- Evidence: the Dockerfile still says no build step is needed and copies only `apps/hub/public/` into nginx. This branch deleted `apps/hub/public/index.html` and made Hub a Vite app whose entry is `apps/hub/index.html` and whose build output is `apps/hub/dist`. `apps/hub/public` now contains only `robots.txt` and `sitemap.xml`, while nginx falls back root requests to `/index.html`.
- Impact: the production hub container ships without the app shell, so root requests fail.
- Fix: make `deploy/hub.Dockerfile` mirror landing: build `@diffgazer/hub`, copy `apps/hub/dist` into nginx, and remove the stale no-build-step assumption.

### F017 - Medium - Docs breadcrumb links point to hook index routes missing from sitemap/prerender

- Location: `apps/docs/src/components/breadcrumbs.tsx:17`
- Related: `apps/docs/src/components/breadcrumbs.tsx:27`, `apps/docs/scripts/generate-sitemap.mjs:32`, `apps/docs/scripts/generate-sitemap.mjs:51`
- Category: docs routing / SEO / static coverage
- Evidence: the branch makes `/ui/hooks` and `/keys/hooks` breadcrumb parents linkable by adding them to `SECTIONS_WITH_INDEX`. However `getPreRenderPages()` still skips `hooks` directories entirely and only re-adds generated hook item pages from `hook-list.json`, not the `hooks/index.mdx` pages.
- Impact: public breadcrumb links drift from sitemap/prerender/static coverage, so those new index routes can miss prerender/Lighthouse/static validation.
- Fix: include `hooks/index.mdx` before skipping generated hook item directories, or explicitly add `/${lib.id}/hooks` when that index exists; add sitemap tests for both routes.

### F018 - Medium - Server SIGTERM no longer stops active review work

- Location: `cli/server/src/dev.ts:15`
- Related: `cli/server/src/features/review/sessions.ts:177`, `cli/diffgazer/src/lib/servers/create-process-server.ts:130`
- Category: shutdown correctness / local workflow reliability
- Evidence: `createProcessServer.stop()` sends `SIGTERM` to the child process and waits for it to exit, but the standalone server's `SIGTERM` and `SIGINT` handler now only calls `shutdownSessions()` and `server.close()`. `shutdownSessions()` only clears the cleanup interval and leaves active sessions, subscribers, and in-flight review work alive. A session created through `createSession()` remains present and not aborted after `shutdownSessions()`.
- Impact: active reviews or SSE clients can keep the standalone server alive after Ctrl-C, and CLI dev mode can wait until its force-kill path instead of shutting down cleanly.
- Fix: make shutdown abort or complete active sessions and close subscribers before or while closing the HTTP server, then exit after `server.close()` completes. Keep the parent grace timeout longer than the child force-kill delay.

### F019 - Medium - Landing Docker deploy no longer type-checks the app

- Location: `apps/landing/package.json:7`
- Related: `deploy/landing.Dockerfile:20`
- Category: deployment gate / type-safety regression
- Evidence: `main` had `build: "tsc -b && vite build"` for `@diffgazer/landing`; this branch changes it to `build: "vite build"` and moves TypeScript checking to a separate `type-check` script. The landing Dockerfile deploy path still runs only `pnpm --filter @diffgazer/landing build` after dependency package builds, so the image build no longer runs the landing TypeScript check.
- Impact: landing type regressions can produce and ship a Docker image even though the previous deploy build failed before image output.
- Fix: either restore type-checking in the landing `build` script, or make `deploy/landing.Dockerfile` run `pnpm --filter @diffgazer/landing type-check` before `pnpm --filter @diffgazer/landing build`.

## Candidate Findings Under Review

None.

## Round Log

- Round 0: audit file created as shared state for subagent review loops.
- Round 1 local: accepted F001 after rebuilding `@diffgazer/core` and proving direct Node ESM import failures.
- Round 1 Agent H: accepted F002 after focused `libs/keys` review.
- Round 1 Agent G: confirmed F001 and expanded impact to public core subpaths; severity raised to High.
- Round 1 Agent C: accepted F003 and F004 from cli/server review/session audit.
- Round 1 Agent I: accepted F005, F006, and F007 from libs/ui hook/public API audit.
- Round 1 Agent D: accepted F008 and F009 from server startup/web launcher audit; duplicate confirmation of F001 from TUI audit recorded but not duplicated.
- Round 1 local: accepted F010 after tracing scoped create-review public API to active-session lookup.
- Round 1 Agent K: no new registry/validation findings; duplicate confirmation of F005/F006 recorded but not duplicated.
- Round 1 Agent L: accepted F011 and F012 from scripts/CI/dependabot audit; duplicate F001 bench import impact was not duplicated.
- Round 2 Agent tests/gaps: accepted F013 from registry schema/test audit.
- Round 2 Agent scripts/CI: accepted F014 from benchmark functional-status audit.
- Round 2 Agent code-quality: accepted F015 from benchmark dead opt-in audit.
- Round 2 Agent apps/docs/landing/hub: accepted F016 and F017 from deploy/docs prerender audit.
- Round 2 Agent server/runtime: accepted F018 from SIGTERM/session-shutdown audit.
- Round 3 Agent apps/docs/web/cli-add: accepted F019 from landing Docker deploy/type-check audit.
- Round 4 convergence: three deduplicated passes over CLI/deploy/CI, public libraries/registry, and apps/React/tests returned no new findings beyond F001-F019.
