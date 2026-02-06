# Test Implementation — Agent Team Orchestration

## Your Mission

You are the team lead for implementing a comprehensive test suite for the Stargazer project — a TypeScript monorepo (pnpm) with a Hono server, React 19 web app, and shared packages.

## Phase 1: Validate the Test Audit

Before spawning any teammates, YOU must:

1. **Read the test audit document**: `.claude/docs/test-audit.md` — this is the master plan with 64 files, ~330-430 tests planned across 5 phases.

2. **Read the testing guidelines**: `.claude/docs/testing.md` — project testing rules (AAA pattern, mock at boundaries, no snapshots, co-locate tests).

3. **WebSearch for validation** — search for the latest (2025-2026) best practices and verify our audit aligns:
   - "vitest monorepo pnpm best practices 2025 2026"
   - "testing hono API routes vitest 2025"
   - "React 19 testing-library vitest 2025 2026"
   - "typescript Result type testing patterns"
   - "what NOT to test in TypeScript projects"

4. **Explore the project structure** — read `package.json` files, check what exists, understand the monorepo layout. Key paths:
   - `apps/server/src/` — Hono backend
   - `apps/web/src/` — React 19 frontend
   - `packages/core/src/` — shared utilities, Result type, review logic
   - `packages/api/src/` — API client
   - `packages/schemas/src/` — Zod 4 schemas
   - `packages/hooks/src/` — shared React hooks

5. **Check existing tests**: there are 3 test files in `packages/core/src/` — read them to understand the existing test style and patterns.

6. **Check existing infrastructure**: there is NO vitest installed, NO configs, NO test scripts yet.

7. **If you find issues with the audit** — fix the document before proceeding. If the audit is solid, move on.

## Phase 2: Setup Infrastructure

Before spawning test-writing teammates, set up the test infrastructure yourself:

1. Install vitest: `pnpm add -Dw vitest`
2. Create `vitest.config.ts` for each package/app that needs tests:
   - `packages/core/vitest.config.ts` — environment: node
   - `packages/api/vitest.config.ts` — environment: node
   - `packages/schemas/vitest.config.ts` — environment: node
   - `apps/server/vitest.config.ts` — environment: node
   - `apps/web/vitest.config.ts` — environment: jsdom (install `jsdom` if needed)
3. Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to each package.json
4. Add `"test": "pnpm -r test"` to root package.json
5. Verify the existing 3 test files pass: `pnpm --filter @stargazer/core test`

**Do NOT proceed to Phase 3 until infrastructure works and existing tests pass.**

## Phase 3: Spawn Test-Writing Team

Create an agent team with teammates organized by domain. Each teammate works independently on their assigned files. Use Opus for all teammates.

### Teammate 1: "server-core"
**Assignment: Server core business logic tests (P0)**
Files to test:
- `apps/server/src/shared/lib/diff/parser.ts` — diff parsing (20-25 tests)
- `apps/server/src/shared/lib/review/prompts.ts` — XML escaping + prompt construction (10-15 tests)
- `apps/server/src/shared/lib/review/issues.ts` — dedup, sort, evidence extraction (15-20 tests)
- `apps/server/src/shared/lib/review/orchestrate.ts` — concurrent execution, runWithConcurrency (15-20 tests)
- `apps/server/src/app.ts` — getHostname, host validation (8-10 tests)
- `apps/server/src/shared/lib/validation.ts` — path traversal check (5-6 tests)

Spawn prompt: "You are writing unit tests for the Stargazer server's core business logic. Read `.claude/docs/test-audit.md` and `.claude/docs/testing.md` for context and rules. Read each source file BEFORE writing tests. Use vitest. Co-locate tests next to source files. Follow AAA pattern, mock at boundaries only, no snapshots. Test edge cases and error paths. Run tests after writing each file to verify they pass. Your files: diff/parser.ts, review/prompts.ts, review/issues.ts, review/orchestrate.ts, app.ts (getHostname only), validation.ts"

### Teammate 2: "server-storage-config"
**Assignment: Storage, config, git, AI client tests (P0)**
Files to test:
- `apps/server/src/shared/lib/storage/persistence.ts` — collection CRUD (15-20 tests)
- `apps/server/src/shared/lib/storage/reviews.ts` — save/list/migrate (12-15 tests)
- `apps/server/src/shared/lib/config/store.ts` — provider CRUD, secrets migration (15-20 tests)
- `apps/server/src/shared/lib/config/state.ts` — loading, sync (10-12 tests)
- `apps/server/src/shared/lib/git/service.ts` — status parsing, parseBranchLine, categorizeGitFile (12-15 tests)
- `apps/server/src/shared/lib/git/errors.ts` — error classification (6-8 tests)
- `apps/server/src/shared/lib/ai/client.ts` — classifyError, createAIClient (10-12 tests)
- `apps/server/src/features/git/service.ts` — path traversal prevention (8-10 tests)

Spawn prompt: "You are writing unit tests for Stargazer's storage, config, git, and AI layers. Read `.claude/docs/test-audit.md` and `.claude/docs/testing.md` for context and rules. Read each source file BEFORE writing tests. Mock file system (fs/promises), keyring, and AI providers at boundaries. Use vitest with vi.mock(). Co-locate tests. Follow AAA pattern. Run tests after writing each file. Your files: persistence.ts, reviews.ts, config/store.ts, config/state.ts, git/service.ts, git/errors.ts, ai/client.ts, features/git/service.ts"

### Teammate 3: "packages"
**Assignment: Core packages + schemas tests (P1)**
Files to test:
- `packages/core/src/json.ts` — markdown stripping + JSON parse (8-10 tests)
- `packages/core/src/strings.ts` — truncate edge cases (6-8 tests)
- `packages/core/src/format.ts` — time formatting boundaries (6-8 tests)
- `packages/core/src/errors.ts` — getErrorMessage, toError (5-6 tests)
- `packages/core/src/review/review-state.ts` — FILL GAPS: updateAgents, file progress, scope filtering, COMPLETE/ERROR actions (15-20 tests)
- `packages/core/src/review/event-to-log.ts` — 17+ event type mappings (15-20 tests)
- `packages/core/src/review/stream-review.ts` — buildReviewQueryParams + processReviewStream (10-12 tests)
- `packages/api/src/client.ts` — URL construction, error parsing (10-15 tests)
- `packages/api/src/review.ts` — resumeReviewStream status mapping (5-8 tests)
- `packages/schemas/src/config/providers.ts` — isValidModelForProvider + UserConfigSchema.refine (5-6 tests)
- `packages/schemas/src/review/storage.ts` — ReviewMetadataSchema.transform (4-5 tests)
- `packages/schemas/src/ui/ui.ts` — calculateSeverityCounts, severityRank (5-6 tests)

Spawn prompt: "You are writing unit tests for Stargazer's shared packages: core, api, and schemas. Read `.claude/docs/test-audit.md` and `.claude/docs/testing.md` for context and rules. Read each source file BEFORE writing tests. For review-state.ts, there are EXISTING tests — read them first and only add tests for UNCOVERED branches (updateAgents, file progress, scope filtering, COMPLETE/ERROR actions). For api/client.ts, mock global fetch. For schemas, only test .refine() and .transform() — NOT plain Zod schemas. Co-locate tests. AAA pattern. Run tests after each file."

### Teammate 4: "server-supporting"
**Assignment: Server supporting modules (P1)**
Files to test:
- `apps/server/src/shared/lib/fs.ts` — atomic write, readJsonFileSync, removeFileSync (8-10 tests)
- `apps/server/src/shared/lib/paths.ts` — resolveProjectRoot, findGitRoot (8-10 tests)
- `apps/server/src/shared/lib/config/keyring.ts` — availability, read/write/delete (8-10 tests)
- `apps/server/src/shared/lib/http/response.ts` — zodErrorHandler (4-5 tests)
- `apps/server/src/shared/lib/review/utils.ts` — estimateTokens, getThinkingMessage (4-5 tests)
- `apps/server/src/features/review/utils.ts` — parseProjectPath, errorCodeToStatus, isReviewAbort, summarizeOutput (12-15 tests)
- `apps/server/src/features/review/schemas.ts` — parseCsvParam (5-6 tests)
- `apps/server/src/features/review/sessions.ts` — session lifecycle (10-15 tests)
- `apps/server/src/features/review/pipeline.ts` — filterDiffByFiles, generateExecutiveSummary (8-10 tests)
- `apps/server/src/features/review/enrichment.ts` — enrichIssue, enrichIssues (6-8 tests)
- `apps/server/src/features/config/service.ts` — checkConfig, activateProvider, getOpenRouterModels (8-10 tests)
- `apps/server/src/shared/lib/ai/openrouter-models.ts` — parseCost, mapOpenRouterModel, cache logic (10-12 tests)

Spawn prompt: "You are writing unit tests for Stargazer's server supporting modules. Read `.claude/docs/test-audit.md` and `.claude/docs/testing.md` for context and rules. Read each source file BEFORE writing tests. Mock fs, keyring, and external APIs at boundaries. Co-locate tests next to source files. AAA pattern, no snapshots. Run tests after writing each file. Your files: fs.ts, paths.ts, keyring.ts, http/response.ts, review/utils.ts (both shared and feature), review/schemas.ts, sessions.ts, pipeline.ts, enrichment.ts, config/service.ts, openrouter-models.ts"

### Teammate 5: "web"
**Assignment: Web hooks, utils, and components with logic (P2)**
Files to test:
- `apps/web/src/app/providers/keyboard-utils.ts` — matchesHotkey, isInputElement (8-10 tests)
- `apps/web/src/features/review/components/review-container.utils.ts` — mapStepsToProgressData (8-10 tests)
- `apps/web/src/features/history/utils.tsx` — getDateLabel, formatDuration, buildTimelineItems (8-10 tests)
- `apps/web/src/features/providers/hooks/use-model-filter.ts` — filterModels, cycleTierFilter (6-8 tests)
- `apps/web/src/features/review/hooks/use-review-stream.ts` — webReviewReducer (10-12 tests)
- `apps/web/src/features/review/hooks/use-review-settings.ts` — LensId validation (4-5 tests)
- `apps/web/src/features/review/hooks/use-review-error-handler.ts` — isApiError (4-5 tests)
- `apps/web/src/hooks/use-scoped-route-state.ts` — store logic, eviction (8-10 tests)
- `apps/web/src/components/ui/toast/toast-context.tsx` — toast queue, auto-dismiss (8-10 tests)
- `apps/web/src/components/ui/dialog/dialog-content.tsx` — focus trap (6-8 tests)
- `apps/web/src/components/ui/menu/menu.tsx` — item extraction, navigation (6-8 tests)
- `apps/web/src/components/ui/severity/severity-bar.tsx` — bar calculation (3-4 tests)

Spawn prompt: "You are writing unit tests for Stargazer's web app: hooks, utils, and components with internal logic. Read `.claude/docs/test-audit.md` and `.claude/docs/testing.md` for context and rules. Read each source file BEFORE writing tests. For pure utility functions (keyboard-utils, history/utils, review-container.utils, model-filter), write simple unit tests. For reducers (use-review-stream), test state transitions directly. For React components with logic (toast, dialog focus trap, menu, severity-bar), use @testing-library/react if available, or test the extracted logic directly. Install @testing-library/react and @testing-library/jest-dom if needed for component tests. Co-locate tests. AAA pattern. Run tests after each file."

## Rules for ALL Teammates

- Use **Opus** model for all teammates
- Read source files BEFORE writing any test
- Read `.claude/docs/testing.md` for patterns
- Co-locate tests: `parser.ts` → `parser.test.ts` in the same directory
- AAA pattern: Arrange → Act → Assert
- One behavior per test
- Mock at boundaries ONLY (fetch, fs, AI, keyring) — never mock internal modules
- No snapshots — assert specific values
- Run `vitest run` in the relevant package after writing each test file to confirm tests pass
- If a test doesn't pass, fix it before moving on
- Do NOT test: constants, re-exports, barrel files, trivial constructors, plain Zod schemas, framework behavior

## Phase 4: Verification

After all teammates finish, YOU (the lead) must:
1. Run `pnpm -r test` to verify ALL tests pass across all packages
2. Count total tests and compare against the audit estimate (~330-430)
3. Report a summary: tests per package, pass/fail, any gaps
