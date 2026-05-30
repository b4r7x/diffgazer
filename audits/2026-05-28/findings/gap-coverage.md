# Findings: gap-coverage

## Summary

| Severity | Count | STILL-OPEN | NEW | REGRESSION |
| --- | --- | --- | --- | --- |
| Critical | 0 | 0 | 0 | 0 |
| High | 6 | 0 | 6 | 0 |
| Medium | 18 | 0 | 18 | 0 |
| Low | 24 | 0 | 24 | 0 |
| **Total** | **48** | **0** | **48** | **0** |

---

## Critical

_No critical findings._

---

## High

### F363 — [NEW] [security] AI provider API key env vars not mentioned in .env.example

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/.env.example`
- **What** — .env.example contains no mention of the AI provider API key environment variables (GOOGLE_API_KEY, ZAI_API_KEY, OPENROUTER_API_KEY) that the CLI server accepts, even though these are security-critical and documented in libs/core/src/schemas/config/providers.ts.
- **Why** — Omitting security-critical provider keys from the template leaves users unable to discover what credentials the CLI needs.
- **How** — Add a new section '# AI Provider Credentials (required to use the CLI)' with entries: GOOGLE_API_KEY (Google Gemini), ZAI_API_KEY (Zhipu), OPENROUTER_API_KEY (OpenRouter). Document that at least one is needed for the CLI to function. Link to the docs for obtaining keys.
- **Effort** — low

### F384 — [NEW] [performance] Missing performance metrics instrumentation on HTTP endpoints

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/cli/server/src/features/git/router.ts`
- **What** — Git status and diff endpoints lack request timing instrumentation and do not expose performance metrics (response time, operation duration).
- **Why** — Without request timing, git endpoint regressions and slow operations cannot be observed or measured.
- **How** — Add middleware to capture request start time and append timing headers or context; wrap service calls with performance.now() measurements; expose metrics endpoint or structured logging with durationMs, operationName.
- **Effort** — medium

### F391 — [NEW] [performance] No load testing or performance benchmark suite

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/root`
- **What** — Codebase has 344 unit tests but zero performance/load tests. No benchmarks for review pipeline, git operations, or API response times under concurrent load.
- **Why** — Without load or benchmark tests, performance regressions in the pipeline and git/API paths can ship undetected.
- **How** — Add a load test suite (e.g., k6, autocannon, or built-in benchmark tests). Define SLOs: review latency p95, git diff parsing time, concurrent session limits. Test with realistic payloads (large diffs, 1000+ file projects). Run in CI to catch regressions.
- **Effort** — high

### F393 — [NEW] [architecture] No centralized metrics/tracing infrastructure or observability sinks

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/cli/server/src`
- **What** — Logging is ad-hoc console.error/warn calls without structured format, no correlation IDs, no trace spans, no metrics export (prometheus, otel, etc.). Each log is isolated.
- **Why** — Ad-hoc isolated logs without correlation IDs, traces, or metrics make production behavior hard to observe.
- **How** — Implement structured logging with pino/winston; add request correlation ID middleware; consider OpenTelemetry SDK for spans/metrics; export to local agent or cloud backend (e.g., datadog, honeycomb).
- **Effort** — high

### F394 — [NEW] [performance] No response time or throughput tracking on review endpoints

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/cli/server/src/features/review`
- **What** — Review service captures durationMs only at end-of-review (pipeline.ts:165, service.ts:181); no per-step timing, no request queue depth, no rejection rate metrics.
- **Why** — End-of-review-only timing hides per-step cost, queue depth, and rejection rates needed to reason about throughput.
- **How** — Add per-step timing: git diff, context build, orchestration, enrichment, storage. Emit step metrics (duration, error rate). Track concurrent session count and queue depth. Add request metrics middleware.
- **Effort** — high

### F403 — [NEW] [docs] @diffgazer/web incorrectly labeled 'public' in README.md

- **file:line** — `README.md:15`
- **What** — README.md claims `apps/web` is a 'public `@diffgazer/web` product frontend', contradicting PACKAGE_GOVERNANCE.md which lists it as 'app/runtime internals' (private).
- **Why** — Mislabeling a private app as public contradicts governance and risks treating an internal app as a published artifact.
- **How** — Change README.md line 15 from `apps/web` - public `@diffgazer/web` product frontend to `apps/web` - private `@diffgazer/web` product frontend. Update all package.json references and release-check scripts to match governance intent (web used only for smoke test dependency resolution, not as a published artifact).
- **Effort** — low

---

## Medium

### F346 — [NEW] [public-api] PR template and CONTRIBUTING.md checklist items have inconsistent wording

- **file:line** — `.github/PULL_REQUEST_TEMPLATE.md`
- **What** — The PR template checklist uses different wording than CONTRIBUTING.md for 4 of 6 shared items. PR template: 'Tests cover the new behavior' vs CONTRIBUTING: 'Tests cover the new behavior (unit, integration, or accessibility as appropriate)'. PR template: 'Changeset added if this changes...' vs CONTRIBUTING: 'Changeset added when shipping...'. PR template: 'Docs, public registry, and examples' vs CO…
- **Why** — Drift between the PR template and CONTRIBUTING.md checklists means contributors get conflicting instructions for the same gate.
- **How** — Make .github/PULL_REQUEST_TEMPLATE.md verbatim copy the 6 checklist items from CONTRIBUTING.md lines 9-14. Remove the redundant 'if this changes' conditional in the Changeset item and use 'when shipping' instead. Keep both files synchronized by design—either version CONTRIBUTING.md items once per release or add a comment in the template noting it mirrors CONTRIBUTING.md.
- **Effort** — low

### F347 — [NEW] [architecture] Dependabot npm group does not include major version updates

- **file:line** — `.github/dependabot.yml`
- **What** — The npm package-ecosystem grouping only captures 'minor' and 'patch' update-types (lines 30-33), silently excluding 'major' updates. Major-version PRs are thus created individually, not grouped, causing N separate PRs for major dependency bumps.
- **Why** — Ungrouped major updates produce a separate PR per dependency, adding review noise and obscuring the intended update strategy.
- **How** — Clarify intent: (1) If majors should be grouped separately, add a second group 'major' with update-types: ['major'] and document why (e.g., 'majors require deliberate testing, kept separate to prevent bulk merges'). (2) If all updates should be grouped into one 'dependencies' group, change the group name to reflect 'all-updates' or 'any-updates' and add 'major' to update-types. (3) Add a comment e…
- **Effort** — low

### F356 — [NEW] [dry] Duplicated artifact preparation logic across 9 root scripts creates synchronization fragility

- **file:line** — `package.json`
- **What** — Root scripts type-check, test, test:types, verify, test-ci, release-check, and docs:prepare all invoke pnpm run prepare:artifacts at the start, followed by DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 for downstream turbo/pnpm commands. This pattern is repeated 9 times across 7 scripts (lines 17–27, plus docs:prepare). The verify/test-ci/release-check scripts are 313–581 characters each and share 70% of thei…
- **Why** — Repeating the artifact-prep prelude across many scripts invites the variants to drift apart and become inconsistent.
- **How** — Extract artifact preparation as a standalone turbo task (e.g., 'prepare' in turbo.json) that all other tasks depend on, and remove prepare:artifacts calls from root scripts. Alternatively, create a shared shell script (scripts/monorepo/prepare.sh) that wraps the logic and is sourced by all 9 scripts. For the three large CI scripts (verify/test-ci/release-check), extract a reusable 'check:all' turb…
- **Effort** — medium

### F360 — [NEW] [docs] Missing VITE_DIFFGAZER_SHUTDOWN_TOKEN in .env.example

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/.env.example`
- **What** — .env.example does not document VITE_DIFFGAZER_SHUTDOWN_TOKEN, which is injected into the Vite client bundle and used by the SPA to authenticate API requests in packaged mode.
- **Why** — An undocumented client-injected token leaves packaged-mode auth opaque to anyone setting up the environment.
- **How** — Add VITE_DIFFGAZER_SHUTDOWN_TOKEN to .env.example with a comment explaining it's automatically injected by the server in packaged mode. Add it as an optional variable since it's only set when DIFFGAZER_PACKAGED=1.
- **Effort** — low

### F361 — [NEW] [docs] VITE_API_URL commented out but is required for web dev

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/.env.example`
- **What** — VITE_API_URL is documented as optional (commented) but is actively used by apps/web/vite.config.ts (line 6) and explicitly mentioned in dev error messages (cli/server/src/dev-server.ts line 36).
- **Why** — Marking a variable that the build actively reads as optional misleads developers into omitting required configuration.
- **How** — Uncomment VITE_API_URL in .env.example and change it from optional to recommended (not commented). Update the comment to mention it's needed when the API server runs on a non-default port.
- **Effort** — low

### F364 — [NEW] [docs] Incomplete documentation of deployment environment variables

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/.env.example`
- **What** — .env.example documents COOLIFY_WEBHOOK_URL and COOLIFY_TOKEN but the docker-compose.yml (lines 7-9, 20-21) also uses REGISTRY_ORIGIN, VITE_PUBLIC_ORIGIN, and VITE_REGISTRY_ORIGIN as build args, which are missing from the template.
- **Why** — Build args used by docker-compose but absent from the template cause incomplete or failing deployment configuration.
- **How** — Add REGISTRY_ORIGIN, VITE_PUBLIC_ORIGIN, and VITE_REGISTRY_ORIGIN to the .env.example with their default values as comments. Move COOLIFY vars to a separate 'Deployment' section for clarity.
- **Effort** — low

### F366 — [NEW] [dry] Duplicate dependency resolution logic across scripts (DRY violation)

- **file:line** — `scripts/monorepo/smoke-cli.mjs, scripts/monorepo/smoke-package-runner.mjs`
- **What** — missingLocalDeps (line 47-57 in smoke-cli.mjs) and missingLocalInstallDeps (line 90-110 in smoke-package-runner.mjs) implement nearly identical logic: loop through deps, call a resolve function with try/catch, collect failures into a missing array.
- **Why** — Two near-identical dependency-resolution implementations can diverge, weakening smoke coverage on one path.
- **How** — Extract shared logic: create a single resolveAndCollectMissing(deps, resolveFn) helper in smoke-shared.mjs. Update both callers to use it. Preserves per-caller difference in how deps are specified vs. how resolution helpers are sourced.
- **Effort** — low

### F368 — [NEW] [error-handling] Unsafe exception handling in runFailure() catches structural changes without validation

- **file:line** — `scripts/monorepo/smoke-cli.mjs`
- **What** — runFailure() (lines 30-41) catches Error and checks for typeof err.status === 'number' to distinguish ExecException from other thrown errors. If err.status is not a number, it re-throws. However, this leaves messages/logs that may mislead about what command was expected to fail vs. what error actually occurred.
- **Why** — Inspecting errors only by a numeric status can misreport which command failed and mask unexpected failure modes.
- **How** — Make error contract explicit: catch and inspect error types; distinguish execSync failure (status != 0, stdout/stderr available) from unexpected errors (e.g., ENOENT, permission). Return { failed: true, output } on success-failure, or throw a custom error class that includes context: class CommandFailedError extends Error { constructor(cmd, exitCode, stdout, stderr) { super(...); this.exitCode = e…
- **Effort** — medium

### F376 — [NEW] [dry] Duplicate parsePortEnv implementation across packages

- **file:line** — `cli/server/src/dev-server.ts and cli/diffgazer/src/lib/servers/server-factories.ts`
- **What** — Two separate implementations of parsePortEnv with nearly identical logic. The server version (lines 7-17 in dev-server.ts) and the CLI version (lines 51-71 in server-factories.ts) parse PORT env vars with identical validation rules but slightly different parameter names and error message formatting.
- **Why** — Two copies of port parsing can diverge in validation and error wording across the server and CLI.
- **How** — Extract parsePortEnv to a shared @diffgazer/core utility module (e.g., @diffgazer/core/env or @diffgazer/core/ports). Both packages should import from the shared location. Update both test files to import from the shared location.
- **Effort** — medium

### F381 — [NEW] [error-handling] Missing health check validation for API server readiness

- **file:line** — `cli/diffgazer/src/lib/servers/api-server.ts`
- **What** — createApiServer (lines 11-27) spawns the API server and relies solely on matching 'Server running' pattern in stdout (line 25: readyPattern) to detect when it's ready. No validation that the server actually started on the expected port or is accepting requests.
- **Why** — Treating a stdout pattern as readiness can signal ready before the server accepts requests, causing flaky startup.
- **How** — After readyPattern fires, perform a simple health check request to GET /api/health before invoking onReady. Add a timeout for this check. If the healthcheck fails, treat it as a startup failure.
- **Effort** — medium

### F385 — [NEW] [error-handling] Unhandled error in onError middleware lacks structured error context

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/cli/server/src/app.ts`
- **What** — Global error handler at line 123-126 logs bare error object without request context (method, path, duration, status code).
- **Why** — Bare error logging without request context makes failures hard to correlate and diagnose in the server.
- **How** — Wrap error logs in structured format: {level, timestamp, error, request: {method, path, url}, response: {status}, durationMs}. Consider adding request tracing ID for cross-request correlation.
- **Effort** — low

### F386 — [NEW] [performance] No request-response duration tracking in context refresh endpoint

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/cli/server/src/features/review/context-routes.ts`
- **What** — refreshContextHandler (lines 31-54) calls buildProjectContextSnapshot without timing. Errors at line 51 lack request duration metrics.
- **Why** — Untimed context refreshes leave latency invisible, so slow snapshot builds go unnoticed.
- **How** — Capture startTime before buildProjectContextSnapshot(); log duration in error and success responses; expose histogram metric (e.g., otel span or prometheus metric).
- **Effort** — low

### F395 — [NEW] [performance] Docs app has no build-time or runtime bundle size monitoring

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/apps/docs`
- **What** — Docs app (42,603 LOC) uses TanStack Start + Fumadocs but no bundle size limits, no code-split analysis, no lazy-load metrics. MDX rendering has no performance markers.
- **Why** — No bundle-size or load monitoring lets the docs app regress in size and performance without warning.
- **How** — Add bundle size check in CI (e.g., bundlesize, size-limit); add Lighthouse CI; measure MDX page load time; consider splitting demos into lazy-loaded modules; add Web Vitals tracking to production.
- **Effort** — medium

### F396 — [NEW] [architecture] No request middleware for tracking API latency or error rates

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/cli/server/src/app.ts`
- **What** — Hono app has CORS, security, and hostname validation middleware but no timing or metrics middleware. No per-route latency tracking or error rate aggregation.
- **Why** — Missing timing and metrics middleware leaves per-route latency and error rates untracked.
- **How** — Add middleware: (1) capture start time; (2) log/emit response time; (3) categorize errors by endpoint; (4) track 4xx vs 5xx rates. Use prom-client or custom metric emitter.
- **Effort** — low

### F397 — [NEW] [other] Lint/format coverage limited to docs only, no repo-wide linting configuration

- **file:line** — `biome.json (only in apps/docs); root package.json`
- **What** — Only `apps/docs/biome.json` defines linting/formatting rules with Biome 2.3.14. The root `package.json` defines `check: 'turbo run check'` which depends on `^check` (expects each package to define check), but only `apps/docs` provides a check script (`biome check`). Nine other packages (landing, web, hub, core, keys, registry, ui, add, diffgazer, server) have no lint/format enforcement. Root has n…
- **Why** — Linting that covers only the docs app leaves most packages without style or quality enforcement, and the gate passes vacuously.
- **How** — Add a root biome.json with workspace-appropriate rules, or configure ESLint with workspace support. Create `check` scripts in each package (or define in turbo.json overrides) that enforce linting. Either extend the root config or create package-specific configs that align on major style decisions. Integrate into the release-readiness CI pipeline to make linting a hard gate.
- **Effort** — medium

### F401 — [NEW] [other] No ESLint, Prettier, or StyleLint configuration across 10 non-docs packages

- **file:line** — `root and all packages except apps/docs`
- **What** — Root package.json has no eslint, prettier, or stylelint dependency. No .eslintrc*, .prettierrc*, or .stylelintrc* files exist in root or any app/cli/lib package (except apps/docs which uses Biome). The `turbo check` task is defined but has no implementation for 90% of the codebase.
- **Why** — With no lint config outside the docs app, the repo-wide check task enforces nothing for most of the codebase.
- **How** — Choose a repo-wide linting tool (Biome, ESLint, or equivalent) and configure it once at the root with package-level overrides as needed. Add linting to the release-readiness CI pipeline. Update each package's `check` script to run the linter. Document the linting rules and make them non-optional for contribution.
- **Effort** — high

### F402 — [NEW] [other] Turbo check task has no meaningful implementation, defeating release quality gate

- **file:line** — `turbo.json:37-39, package.json:21`
- **What** — turbo.json defines a `check` task with `dependsOn: ['^check']`, meaning each package must have a check script. Root package.json line 21 includes `check` in the verify pipeline. However, only apps/docs provides a check script; the other 10 packages have none. The turbo task exists but has no effective implementation—running `pnpm check` succeeds vacuously because the transitive `^check` dependency…
- **Why** — A check task with no real per-package implementation passes vacuously, giving false confidence as a release gate.
- **How** — Either add check scripts to all packages (point to a root linter or package-specific linters), or remove the check task from turbo.json and verify scripts if linting will not be enforced. Document the decision clearly. If linting is intended, wire it into the release-readiness CI and make it fail-closed.
- **Effort** — medium

### F406 — [NEW] [docs] DEPLOYMENT_PLAN.md Section 2.1-2.5 describes completed setup steps as future work

- **file:line** — `DEPLOYMENT_PLAN.md:102-170`
- **What** — DEPLOYMENT_PLAN.md Step 2 contains detailed instructions for creating apps/landing, apps/hub, and modifying registry constants—all of which have already been completed (REGISTRY_ORIGIN is already 'https://r.b4r7.dev' in libs/registry/src/constants.ts, apps/landing exists with App.tsx, apps/hub exists with public/index.html, Dockerfiles exist in deploy/).
- **Why** — Documenting already-completed setup as future work misleads readers about the project's actual state.
- **How** — Restructure DEPLOYMENT_PLAN.md Step 2 into three sections: (1) 'Completed Configuration' (lines 102-170 referencing actual current files as source of truth), (2) 'Remaining Configuration' (listing only what still needs to be done, e.g., Coolify dashboard setup), (3) 'Verification Checklist' (lines 515-542 moved to top). Mark sections as 'COMPLETED' or 'PENDING' based on actual state as of May 28.
- **Effort** — medium

---

## Low

### F348 — [NEW] [architecture] Dependabot docker ecosystem lacks explicit configuration for updates

- **file:line** — `.github/dependabot.yml`
- **What** — The docker package-ecosystem (lines 13-18) specifies weekly updates across two directories but has no open-pull-requests-limit, grouping, or update-type filtering. It will create uncapped individual PRs for each docker dependency (one per Dockerfile per directory).
- **Why** — Without a PR limit or grouping, the docker ecosystem can flood the queue with one uncapped PR per image per directory.
- **How** — Add explicit docker configuration: (1) Set open-pull-requests-limit: 5 (or 3 for stricter control). (2) Optionally add a group 'docker-updates' with patterns ['*'] to collect all docker updates into one PR per week. (3) Add a comment explaining the strategy (e.g., '# Docker images: weekly scan, grouped for fewer PRs').
- **Effort** — low

### F350 — [NEW] [docs] Issue templates do not cross-reference contributing guidelines or architecture rules

- **file:line** — `.github/ISSUE_TEMPLATE/bug_report.yml`
- **What** — The bug_report.yml and feature_request.yml templates (27 and 26 lines respectively) do not mention or link to CONTRIBUTING.md or AGENTS.md, which define the project rules and expectations. A contributor filing an issue sees only the template fields, not the architectural context.
- **Why** — Issue authors never see the project rules that govern contributions, so reports arrive missing the expected architectural context.
- **How** — Add a description field to each issue template directing contributors to CONTRIBUTING.md and AGENTS.md. Example: (1) In bug_report.yml, after the name/description, add a body field with a note type: 'Before reporting, check [CONTRIBUTING.md](../../CONTRIBUTING.md) and [AGENTS.md](../../AGENTS.md) for project rules.' (2) Optionally add a link field in feature_request.yml too.
- **Effort** — low

### F351 — [NEW] [architecture] Dependabot has no configuration for semantic commit prefix enforcement

- **file:line** — `.github/dependabot.yml`
- **What** — The dependabot.yml file does not specify a commit-message configuration (prefix, body, or include field). Dependabot PR titles and commit messages are generated with default formatting (e.g., 'Bump @diffgazer/ui from 0.1.0 to 0.2.0'), which does not match the repo's semantic commit convention implied by the release process (changesets/action creates 'chore: version packages' commits).
- **Why** — Dependabot commits ignore the repo's semantic commit convention, leaving the history inconsistent with release-generated commits.
- **How** — Add a commit-message configuration to dependabot.yml for npm (and optionally github-actions and docker). Example: under the npm ecosystem, add: 'commit-message: { include: 'scope', prefix: 'chore(deps)', prefix-development: 'chore(deps-dev)' }' to generate commits like 'chore(deps): bump @diffgazer/ui from 0.1.0 to 0.2.0'. Alternatively, use 'prefix: chore' and 'include: scope' for consistency wit…
- **Effort** — medium

### F352 — [NEW] [docs] PR template missing guidance for Summary section content

- **file:line** — `.github/PULL_REQUEST_TEMPLATE.md`
- **What** — The PR template has a '## Summary' section (line 1-3) with only a comment 'Short description of what changed and why.' but no guidance on what depth is expected. The checklist is detailed (6 items) but the summary instructions are minimal.
- **Why** — Sparse Summary guidance lets PR descriptions vary widely in depth, weakening the review record.
- **How** — Expand the Summary section with one-sentence guidance. Example: 'Briefly describe what changed and why (reference an issue if applicable).' or 'Explain the change and the problem it solves in 2-3 sentences.'
- **Effort** — low

### F353 — [NEW] [architecture] Dependabot npm configuration lacks monorepo workspace awareness

- **file:line** — `.github/dependabot.yml`
- **What** — The npm package-ecosystem scans /apps/*, /cli/*, and /libs/* directories (lines 21-25) as separate monorepo workspaces, but does not specify 'versioning-strategy' or 'allow' for workspace dependency protocols (e.g., 'workspace:*'). This can lead to Dependabot PRs that update peer versions without respecting workspace links.
- **Why** — Without workspace-aware versioning, Dependabot can bump linked workspace dependencies without respecting their protocol.
- **How** — Add versioning-strategy and allow configuration to the npm ecosystem. Example: 'versioning-strategy: auto' (default behavior) or explicitly set to handle workspaces. Alternatively, add a comment documenting that Dependabot treats workspace workspaces independently and that linked-version bumps should be reviewed as a group. Consider using Renovate (GitHub Action alternative) for better monorepo su…
- **Effort** — medium

### F355 — [NEW] [yagni] Unused stub package @diffgazer/hub creates maintenance burden with zero functionality

- **file:line** — `apps/hub/package.json`
- **What** — @diffgazer/hub is a package with only name, private flag, version 0.0.0, and description. It has no scripts, dependencies, or source code. It is referenced in .changeset/config.json ignore list but never imported or used anywhere else in the monorepo.
- **Why** — A source-less stub package is dead weight that must still be tracked in changeset config while delivering nothing.
- **How** — Remove apps/hub directory entirely and remove the @diffgazer/hub entry from .changeset/config.json ignore list. If a portfolio hub is planned for future, create it when actual content/functionality is ready, not as a pre-declared stub.
- **Effort** — low

### F362 — [NEW] [docs] Missing documentation of internal dev/test environment variables

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/.env.example`
- **What** — .env.example does not document several important internal environment variables: DIFFGAZER_DEV, DIFFGAZER_SKIP_ARTIFACT_PREPARE, DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT, PLAYWRIGHT_PORT, and DOCS_PRERENDER.
- **Why** — Undocumented internal flags force contributors to read source to discover how dev and test builds are configured.
- **How** — Add a new section in .env.example labeled '# Development and Build Flags (optional)' with entries for: DIFFGAZER_DEV (artifact sync mode), DIFFGAZER_SKIP_ARTIFACT_PREPARE (skip prep in test), PLAYWRIGHT_PORT (E2E testing), DOCS_PRERENDER (static build mode). Document DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT as internal test-only.
- **Effort** — low

### F365 — [NEW] [docs] No documentation of PORT environment variable scope

- **file:line** — `/Users/voitz/Projects/diffgazer-workspace/.env.example`
- **What** — .env.example does not document PORT, which is used by cli/server/src/dev-server.ts to configure the API server port and is passed to the build scripts.
- **Why** — An undocumented PORT variable leaves its scope across the API server, web dev, and docker unclear to operators.
- **How** — Add PORT=3000 to .env.example in a section for 'Development Server Configuration'. Document that it controls both the API server port and the docker-compose service port. Note that VITE_API_URL should match this value when running web dev against a custom port.
- **Effort** — low

### F367 — [NEW] [error-handling] Inconsistent error-exit contract: console.error + throw used redundantly

- **file:line** — `scripts/monorepo/check-invariants.mjs`
- **What** — Lines 356-358 call console.error('Invariant checks failed') immediately before throwing new Error('Invariant checks failed'). The console.error is redundant because Node.js will print the thrown Error's message to stderr on uncaught exception.
- **Why** — Logging then throwing the same message duplicates stderr output and muddies the script's exit contract.
- **How** — Remove the console.error call (line 356) and rely on the thrown Error. If explicit stderr output is desired before exit, document why and keep only the appropriate mechanism. Most shell callers (pnpm scripts, CI) already capture stderr from thrown errors.
- **Effort** — low

### F370 — [NEW] [naming] Magic env var names scattered across multiple files without single source of truth

- **file:line** — `scripts/monorepo/smoke-shared.mjs, smoke-cli.mjs, smoke-package-runner.mjs, smoke-shadcn-install.mjs, validate-artifacts.mjs`
- **What** — Environment variables DIFFGAZER_SMOKE_ALLOW_NETWORK, DIFFGAZER_SMOKE_STRICT_SKIPS, DIFFGAZER_REQUIRE_TRACKED_POLICY, and CI are referenced directly as string literals in multiple files (smoke-shared.mjs:20, smoke-shared.mjs:244, validate-artifacts.mjs:159). No centralized constant definitions.
- **Why** — Env var names duplicated as string literals across files drift on rename and have no single source of truth.
- **How** — Create constants in artifacts/config.mjs or a new artifacts/env.mjs: export const ENV = { SMOKE_ALLOW_NETWORK: 'DIFFGAZER_SMOKE_ALLOW_NETWORK', SMOKE_STRICT_SKIPS: 'DIFFGAZER_SMOKE_STRICT_SKIPS', REQUIRE_TRACKED_POLICY: 'DIFFGAZER_REQUIRE_TRACKED_POLICY' }. Replace all usages: process.env[ENV.SMOKE_ALLOW_NETWORK] instead of process.env.DIFFGAZER_SMOKE_ALLOW_NETWORK.
- **Effort** — low

### F371 — [NEW] [architecture] startRegistryServer callback nesting creates closure risk and reduces testability

- **file:line** — `scripts/monorepo/smoke-shadcn-install.mjs`
- **What** — startRegistryServer (line 287-355) is an async function that returns a Promise resolving to { baseUrl, close }. The baseUrl is captured in the rewriteRegistryUrls closure (lines 294-308). Server handlers (line 310) close over registryDirs and call rewriteRegistryUrls. If rewriteRegistryUrls is removed or changed, multiple inline handlers break.
- **Why** — Closure-coupled handlers make the registry server hard to test and brittle when the rewrite helper changes.
- **How** — Refactor: extract rewriteRegistryUrls as a standalone function that takes baseUrl as a parameter. Pass it to a request-handler factory function. Define request handler separately from server setup. Untangles closure chain and allows testing each piece independently. Example: function createRegistryHandler(registryDirs, rewriteRegistryUrls) { return (request, response) => { ... } }.
- **Effort** — medium

### F372 — [NEW] [dry] Array-to-multiline-string template pattern used 10+ times with no abstraction

- **file:line** — `scripts/monorepo/smoke-cli.mjs, smoke-shadcn-install.mjs, smoke-package-fixtures.mjs, validate-artifacts.mjs`
- **What** — Code frequently builds multiline strings by declaring an array of strings and calling .join('\n') at the end: [...lines...].join('\n'). This pattern appears in 10+ places (smoke-cli.mjs:67-104, smoke-shadcn-install.mjs:200-257, smoke-package-fixtures.mjs lines 25-47, etc.). Each occurrence is similar enough to extract.
- **Why** — The repeated array-join idiom is unnamed duplication that obscures intent at each call site.
- **How** — Create a helper: function joinLines(...lines) { return lines.flat().join('\n'); } in smoke-shared.mjs. Replace [...array].join('\n') calls with joinLines(...array). For multiline strings that need trailing newline, define a variant: function toSourceFile(...lines) { return joinLines(...lines) + '\n'; }
- **Effort** — low

### F374 — [NEW] [dry] Check-invariants and validate-artifacts share similar JSON read/parse + error collection patterns

- **file:line** — `scripts/monorepo/check-invariants.mjs, validate-artifacts.mjs`
- **What** — Both scripts read package.json files, validate metadata, collect errors, and throw if any fail. check-invariants (lines 221-223) builds parsedPackages map. validate-artifacts (lines 209-263) loads artifacts, reads manifests, validates structure. Both iterate collections, check properties, accumulate errors into an array, then throw if any exist.
- **Why** — Parallel read-validate-collect-throw flows in two scripts duplicate structure that could be expressed once.
- **How** — Extract a shared validation runner: function runValidationChecks(checks) { const errors = []; for (const check of checks) { errors.push(...check()); } if (errors.length > 0) { throw new Error(errors.join('\n')); } return true; }. Both scripts can compose their checks array and call runValidationChecks. Not high-priority since both scripts are independent, but improves consistency.
- **Effort** — low

### F375 — [NEW] [error-handling] Implicit exit code contract: scripts rely on uncaught errors to exit 1, no explicit exit()

- **file:line** — `scripts/monorepo/check-invariants.mjs, validate-artifacts.mjs, smoke-cli.mjs, smoke-package-install.mjs, smoke-shadcn-install.mjs`
- **What** — All monorepo scripts rely on throwing an uncaught Error at the top level to exit with code 1. None call process.exit(1) explicitly. Node.js implicitly treats uncaught Error as exit(1). This contract is not documented in any script header or README.
- **Why** — An undocumented reliance on uncaught errors for exit code 1 makes the failure contract implicit and easy to break during cleanup.
- **How** — For scripts that need cleanup (rmSync in finally blocks, server.close), use explicit try/finally + process.exit(1) in catch. For simple validation, throw is fine, but add a script header comment: // Exit code: 0 on success, 1 on validation failure. Or wrap main logic: (async () => { try { await main(); } catch (err) { console.error(err.message); process.exit(1); } })().catch(() => process.exit(1))…
- **Effort** — low

### F378 — [NEW] [performance] Runtime version parsing called only for --version flag

- **file:line** — `cli/diffgazer/src/index.tsx`
- **What** — readVersion() (lines 13-34) is a 22-line function that reads and validates package.json to extract the version string. It's only called in one place (line 45) when action.type === 'version'. The function reads the file at runtime, parses JSON, and validates the structure.
- **Why** — Reading and validating package.json at runtime for a single flag is avoidable work that a build-time constant removes.
- **How** — At build time, extract the version from package.json and either: (A) Use a tsup/esbuild plugin to replace version strings with a constant, or (B) Generate a version.ts file during build that exports the version constant. Update index.tsx to import and use that constant instead of readVersion().
- **Effort** — medium

### F379 — [NEW] [error-handling] Inconsistent error handling between dev entry points

- **file:line** — `cli/server/src/dev.ts and cli/diffgazer/src/index.tsx`
- **What** — Error handling differs: server/dev.ts (lines 11-14) uses synchronous try/catch with process.exitCode=1. CLI index.tsx (lines 61-64) uses void main().catch() pattern with process.exit(1). The server wraps the whole entry point; the CLI delegates to async error handler.
- **Why** — Divergent entry-point error handling makes failure behavior inconsistent and harder to reason about across binaries.
- **How** — Standardize on a single error handling pattern: (A) Align both to use identical try/catch-in-main approach, or (B) ensure both explicitly test error recovery paths. Consider creating a shared CLI error handler utility in @diffgazer/core to centralize error formatting.
- **Effort** — low

### F380 — [NEW] [naming] Misleading file naming suggests dev-only utilities for production code

- **file:line** — `cli/server/src/dev-server.ts`
- **What** — File is named dev-server.ts and exports DEFAULT_DEV_SERVER_* constants, but it provides the HTTP server abstraction used in production (dev.ts is the actual entry point referenced in package.json 'dev' script). New readers may misclassify this as test/dev infrastructure.
- **Why** — A dev-implying filename for production server logic misleads readers about what the module actually does.
- **How** — Rename dev-server.ts to http-server.ts or server.ts to clarify it's core application logic. Or reorganize: move DEFAULT_* constants to a separate config.ts file to distinguish infrastructure from the HTTP layer.
- **Effort** — low

### F382 — [NEW] [kiss] Hardcoded shutdown timeout lacks documentation and configurability

- **file:line** — `cli/diffgazer/src/lib/servers/create-process-server.ts`
- **What** — FORCE_KILL_DELAY_MS = 2000 (line 8) is a hardcoded timeout for graceful SIGTERM before forcing SIGKILL. It's not configurable, not documented, and buried in the middle of the file.
- **Why** — A buried, undocumented kill timeout is hard to find and tune when shutdown behavior needs adjustment.
- **How** — Extract to a named constant in config or make it configurable. Add a comment explaining why 2 seconds was chosen and when it might need adjustment. Consider exposing as environment variable for advanced users.
- **Effort** — low

### F383 — [NEW] [anti-slop] parsePortEnv has inconsistent error message formatting between implementations

- **file:line** — `cli/server/src/dev-server.ts and cli/diffgazer/src/lib/servers/server-factories.ts`
- **What** — Both parsePortEnv implementations throw errors with slightly different formats. Server version (dev-server.ts:13) uses fixed 'PORT' string in error. CLI version (server-factories.ts:63,66) uses configurable variableName parameter, allowing 'VITE_WEB_PORT' or other names, but that parameter defaults to 'PORT'.
- **Why** — Inconsistent error wording between the two port parsers gives users different messages for the same failure.
- **How** — When consolidating to shared implementation, support the configurable variableName parameter (defaults to 'PORT'). Update server/dev.ts to use standard PORT error message.
- **Effort** — low

### F398 — [NEW] [other] Biome schema version mismatch (2.2.4 in config vs 2.3.14 installed)

- **file:line** — `apps/docs/biome.json:2`
- **What** — The `$schema` URL in biome.json references Biome 2.2.4 (`https://biomejs.dev/schemas/2.2.4/schema.json`) but the installed version in package.json (line 50) is 2.3.14 (`@biomejs/biome: 2.3.14`). This version mismatch means IDE/editor schema validation and the config validator are checking against an older schema.
- **Why** — A stale schema URL validates the config against an older Biome version than the one installed.
- **How** — Update the $schema URL from `https://biomejs.dev/schemas/2.2.4/schema.json` to `https://biomejs.dev/schemas/2.3.14/schema.json` to match the installed version.
- **Effort** — low

### F400 — [NEW] [other] Biome files.includes patterns are overly broad and exclude generated artifacts inconsistently

- **file:line** — `apps/docs/biome.json:8-17`
- **What** — The include patterns (`**/src/**/*`, `**/.vscode/**/*`, `**/index.html`, `**/vite.config.ts`) are broad and apply workspace-wide with `**`, but only exclude two generated files (`!**/src/routeTree.gen.ts`, `!**/src/index.css`). This means Biome will lint/format .vscode config files and index.html across the entire repo, even in other packages (landing, web, etc.) that have their own biome-free set…
- **Why** — Workspace-wide include globs make Biome lint files in unrelated packages and miss generated artifacts inconsistently.
- **How** — Scope the patterns to docs-only by removing `**` or replacing with relative paths: use `src/**/*`, `.vscode/**/*`, etc. Explicitly exclude all generated/build artifacts and non-source directories (dist, .output, node_modules). Consider whether .vscode and index.html should be linted at all (usually editor config and public HTML are not linted).
- **Effort** — low

### F407 — [NEW] [docs] DEPLOYMENT_PLAN.md describes landing app as 'minimal' and 'placeholder' when actual implementation is complete

- **file:line** — `DEPLOYMENT_PLAN.md:179-333`
- **What** — Section 2.5 describes apps/landing as 'Build a simple landing page using @diffgazer/ui components... This is a placeholder — the user will build it out later.' However, the actual apps/landing/src/App.tsx is a complete, working implementation with proper styling, links, and structure.
- **Why** — Describing a finished landing app as a placeholder misrepresents the implemented code as unbuilt.
- **How** — Update Section 2.5 heading to 'Review apps/landing (implemented)' and change the description to note that the landing page is complete. Reference the actual App.tsx file as the implemented version rather than as a placeholder to be filled in. Move placeholder code to an 'Original Template' subsection for reference only.
- **Effort** — low

### F408 — [NEW] [docs] PACKAGE_GOVERNANCE.md contains outdated publish-gate reference dated May 6, 2026

- **file:line** — `PACKAGE_GOVERNANCE.md:14`
- **What** — Line 14 states 'As of May 6, 2026, `npm view @diffgazer/add`, `npm view @diffgazer/ui`, and `npm view @diffgazer/keys` are treated as external publish-gate checks.' This date is now 22 days in the past (current date is May 28, 2026) with no indication of whether packages have actually been published or are still gated.
- **Why** — A hardcoded past-dated publish-gate note leaves the actual publish status of the packages unclear.
- **How** — Replace the date-specific phrasing with a status indicator: 'As of [CURRENT_DATE], these packages are [PUBLISHED | UNPUBLISHED]. Verify with: `npm view @diffgazer/add version`'. Link to a CI/release workflow status badge or add a note that this line should be updated after each release. Alternatively, move this to a separate 'Publish Status' section updated during release.
- **Effort** — low

### F410 — [NEW] [docs] CONTRIBUTING.md is extremely minimal (14 lines) and lacks enforcement mechanism links

- **file:line** — `CONTRIBUTING.md:1-15`
- **What** — CONTRIBUTING.md consists of 14 lines total: a reference to AGENTS.md (which is correct), a one-liner on changesets, and a 7-item checklist with no links to enforcement tools, pre-commit hooks, or CI gates that actually validate the checklist items.
- **Why** — A bare checklist without links to the tools that enforce it gives contributors no way to validate the items.
- **How** — Add specific validation instructions to each checklist item: (1) 'Tests cover behavior — run `pnpm --filter <package> test` before pushing'; (2) 'Type-check passes — enforced by pre-commit hook or `pnpm exec turbo run type-check`'; (3) 'Add changeset — validated by CI if omitted for published packages'. Link to the root scripts in package.json and note which are run before commit vs. on CI.
- **Effort** — low

---
