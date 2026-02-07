# Test Audit & Strategy

> "Write tests. Not too many. Mostly integration." — Guillermo Rauch
> "Test as little as possible to reach a given level of confidence." — Kent Beck

## Philosophy

**Risk-based testing.** Test where bugs actually hide: parsing, branching, error handling, state machines. Skip trivial code that can't break.

**Testing Trophy:** Static (TypeScript) → Unit (pure logic) → Integration (routes) → E2E (skip for now).

**Mock at boundaries only:** fetch, file system, AI providers, keyring. Never mock internal modules.

---

## Current State (updated 2026-02-07)

| What | Status |
|------|--------|
| Test runner | Vitest 4.0.18 (root workspace devDep) |
| Config files | 5 configs (core, api, schemas, server, web) |
| Test scripts | All packages except `packages/hooks` |
| Test files | 61+ files |
| Tests passing | 655+ (all green) |

### Coverage by area
| Area | Files | Tests |
|------|-------|-------|
| apps/server | 31 | ~384 |
| packages/core | 8 | ~117 |
| apps/web | 15 | ~110 |
| packages/api | 3 | ~28 |
| packages/schemas | 3 | ~16 |
| packages/hooks | 1 | Not run (missing config) |

---

## TIER 1 — MUST TEST (high complexity, high bug risk)

### Server: Core Business Logic

| # | Module | Lines | Why |
|---|--------|-------|-----|
| 1 | `server/shared/lib/diff/parser.ts` | 165 | Complex regex state machine, multi-pass parser, hunk boundaries |
| 2 | `server/shared/lib/review/orchestrate.ts` | 203 | Concurrent lens execution, result aggregation, dedup/filter/validate/sort pipeline, partial failure handling |
| 3 | `server/shared/lib/review/prompts.ts` | 305 | **SECURITY-CRITICAL**: XML escaping of user content (CVE-2025-53773), prompt construction |
| 4 | `server/shared/lib/review/issues.ts` | 127 | Deduplication by composite key, severity sorting, evidence extraction from diff hunks |
| 5 | `server/shared/lib/storage/persistence.ts` | 210 | Collection CRUD, file I/O errors (ENOENT/EACCES), schema validation, metadata extraction |
| 6 | `server/shared/lib/storage/reviews.ts` | 184 | Review save/list/migrate, severity count migration, project filtering, date sorting |
| 7 | `server/shared/lib/config/store.ts` | 336 | Provider CRUD, secrets migration (file↔keyring), credential storage, activation logic |
| 8 | `server/shared/lib/config/state.ts` | 161 | Config loading/persistence, provider-secrets sync, trust normalization |
| 9 | `server/shared/lib/git/service.ts` | 201 | Git status parsing (porcelain format), branch/remote/ahead/behind, file categorization |
| 10 | `server/shared/lib/ai/client.ts` | 220 | AI client creation, error classification (4 rule sets), timeout/abort composition |
| 11 | `server/shared/lib/ai/openrouter-models.ts` | 148 | Model mapping, cache TTL, cost parsing, compatibility filtering |
| 12 | `server/features/git/service.ts` | 54 | **SECURITY**: Path traversal prevention, symlink escape detection |
| 13 | `server/features/review/pipeline.ts` | 323 | Diff filtering, size limit check, config resolution, executive summary generation |
| 14 | `server/features/review/sessions.ts` | 139 | In-memory session management, subscriber notification, abort/complete lifecycle |
| 15 | `server/app.ts` | 66 | **SECURITY**: Host header validation (getHostname), CORS allowlist |

### Server: Supporting Logic

| # | Module | Lines | Why |
|---|--------|-------|-----|
| 16 | `server/shared/lib/config/keyring.ts` | 136 | Keyring availability detection, read/write/delete with error handling |
| 17 | `server/shared/lib/fs.ts` | 65 | Atomic file write (temp+rename), readJsonFileSync, removeFileSync |
| 18 | `server/shared/lib/paths.ts` | 66 | Project root resolution (5-level priority chain), findGitRoot directory walk |
| 19 | `server/shared/lib/validation.ts` | 7 | Path traversal check (`..`, null bytes) |
| 20 | `server/shared/lib/git/errors.ts` | 53 | Git error classification (5 patterns + fallback) |
| 21 | `server/shared/lib/http/response.ts` | 29 | Zod error handler, error response format |
| 22 | `server/features/review/utils.ts` | 133 | parseProjectPath, errorCodeToStatus, isReviewAbort, summarizeOutput |
| 23 | `server/features/review/schemas.ts` | 57 | parseCsvParam (comma-separated values) |
| 24 | `server/features/review/enrichment.ts` | 104 | Issue enrichment (blame + file context), abort handling |
| 25 | `server/features/review/drilldown.ts` | 147 | Drilldown request handling, issue lookup, AI call + save |
| 26 | `server/features/review/context.ts` | 309 | Workspace discovery, file tree building, cache check |
| 27 | `server/features/config/service.ts` | 154 | Config CRUD, OpenRouter model validation, provider activation |
| 28 | `server/shared/middlewares/trust-guard.ts` | 25 | Trust capability check |

### Packages: Core Logic

| # | Module | Lines | Why |
|---|--------|-------|-----|
| 29 | `core/src/json.ts` | 33 | Markdown code block stripping + JSON parse + error factory |
| 30 | `core/src/review/review-state.ts` | 264 | **UNDER-TESTED**: ~15 untested reducer branches (updateAgents, file progress, scope filtering, colon parsing) |
| 31 | `core/src/review/event-to-log.ts` | 206 | 17+ event type → log entry mappings, exhaustive switch |
| 32 | `core/src/review/stream-review.ts` | 139 | Query param building, SSE stream processing, 3 terminal outcomes |
| 33 | `core/src/errors.ts` | 27 | getErrorMessage with unknown type handling (3 branches) |
| 34 | `core/src/strings.ts` | 22 | truncate edge case: maxLength < suffix.length |
| 35 | `core/src/format.ts` | 23 | Time formatting boundaries (0ms, negative, overflow) |
| 36 | `api/src/client.ts` | 89 | HTTP client: URL construction, conditional headers, error response parsing |
| 37 | `api/src/review.ts` | 168 | resumeReviewStream: HTTP status → error code mapping (404/409/other) |

### Schemas: Custom Validation Only

| # | Module | Lines | Why |
|---|--------|-------|-----|
| 38 | `schemas/src/config/providers.ts` | 282 | `UserConfigSchema.refine()` → `isValidModelForProvider()` |
| 39 | `schemas/src/review/storage.ts` | 52 | `ReviewMetadataSchema.transform()` → backwards-compat mode migration |
| 40 | `schemas/src/ui/ui.ts` | 256 | `calculateSeverityCounts`, `severityRank` (indexOf -1 edge case) |

### Web: Hooks & State Management

| # | Module | Lines | Why |
|---|--------|-------|-----|
| 41 | `web/features/review/hooks/use-review-stream.ts` | 190 | Reducer + event batching (rAF) + abort handling + resume logic |
| 42 | `web/features/review/hooks/use-review-lifecycle.ts` | 187 | Async orchestration, state machine, completion delays, resume fallback |
| 43 | `web/app/providers/config-provider.tsx` | 310 | Cache TTL, 5 async operations, isConfigured derivation, split context |
| 44 | `web/app/providers/keyboard-utils.ts` | 37 | Hotkey parsing/matching, modifier detection, isInputElement |
| 45 | `web/app/providers/keyboard-provider.tsx` | 81 | Scope stack management, handler registry, keydown dispatch |
| 46 | `web/hooks/keyboard/use-selectable-list.ts` | 94 | Navigation with disabled items, wrapping, boundary callbacks |
| 47 | `web/hooks/use-scoped-route-state.ts` | 73 | External store, eviction at MAX_ENTRIES, functional updates |
| 48 | `web/hooks/use-settings.ts` | 76 | Cache TTL, request deduplication, lazy fetch |
| 49 | `web/features/review/components/review-container.utils.ts` | 63 | Pure data transforms: step/agent status mapping, substep derivation |
| 50 | `web/features/history/utils.tsx` | 72 | Date grouping, duration formatting, timeline building |
| 51 | `web/features/providers/hooks/use-model-filter.ts` | 65 | Tier + search filtering, filter cycling |
| 52 | `web/features/providers/hooks/use-openrouter-models.ts` | 146 | Reducer + compatibility filtering + dialog lifecycle |
| 53 | `web/components/ui/toast/toast-context.tsx` | 111 | Toast queue (max 5), auto-dismiss, animation lifecycle |
| 54 | `web/app/providers/theme-provider.tsx` | 82 | Theme resolution priority chain, system detection, settings override |
| 55 | `web/features/review/hooks/use-review-settings.ts` | 19 | LensId validation with fallback |
| 56 | `web/features/review/hooks/use-review-error-handler.ts` | 51 | isApiError type guard, status → title/message mapping |
| 57 | `web/features/providers/hooks/use-api-key-form.ts` | 63 | canSubmit derivation, method-dependent value, double-submit prevention |
| 58 | `web/features/history/hooks/use-reviews.ts` | 48 | Optimistic delete + rollback on error |

### Web: Components with Internal Logic

| # | Module | Lines | Why |
|---|--------|-------|-----|
| 59 | `web/components/ui/dialog/dialog-content.tsx` | 118 | Focus trap: Tab/Shift+Tab wrapping, body scroll lock, focus restore on unmount, backdrop click |
| 60 | `web/components/ui/menu/menu.tsx` | 134 | Recursive child extraction (incl. Fragments), disabled item skipping, number key jump, Enter activation |
| 61 | `web/components/ui/form/checkbox.tsx` | 252 | Controlled/uncontrolled toggle, CheckboxGroup array value (add/remove), Enter triggers toggle + onEnter |
| 62 | `web/components/ui/form/radio-group.tsx` | 230 | Controlled/uncontrolled selection, keyboard nav via useGroupNavigation, onFocusZoneEnter before onValueChange |
| 63 | `web/components/ui/severity/severity-bar.tsx` | 29 | Bar fill calculation (division by max, rounding), max=0 edge case |
| 64 | `web/features/review/components/activity-log.tsx` | 71 | Auto-scroll near-bottom detection (50px threshold), scroll-to-bottom on new entries |

---

## TIER 2 — SKIP (do not test)

| Category | Examples | Why |
|----------|----------|-----|
| Trivial constructors | `result.ts` (11 lines), `createError` | Can't break |
| Re-exports / barrels | `severity.ts`, all `index.ts` | Zero logic |
| Plain Zod schemas | 90% of `packages/schemas/` | Testing Zod, not our code |
| Type definitions | `types.ts` files | TypeScript validates |
| Thin API wrappers | `api/config.ts`, `api/git.ts`, `api/bound.ts` | No branching, delegate to client |
| Route handlers | All `router.ts` files | Test as integration tests later |
| Pure UI components | Most `apps/web/src/components/` | No business logic |
| CLI components | All `apps/cli/src/` | Ink hard to test, web is source of truth |
| Complex keyboard hooks | `use-group-navigation.ts`, `use-model-dialog-keyboard.ts` | DOM-dependent, better as E2E |
| Pure-render components | Layout, icons, badges, wrappers | Props → JSX, TypeScript catches errors |
| `use-figlet.ts` | 24 lines | Wraps third-party library |
| `use-timer.ts` | 40 lines | Simple interval, low risk |
| Constants files | `constants.ts`, `navigation.ts` | No logic |

---

## Test Count Estimate

| Area | Files | Est. Tests | Priority |
|------|-------|------------|----------|
| **Server: diff/parser** | 1 | 20-25 | P0 |
| **Server: review logic** (orchestrate, issues, prompts, enrichment) | 4 | 35-45 | P0 |
| **Server: storage** (persistence, reviews) | 2 | 20-25 | P0 |
| **Server: config** (store, state, keyring) | 3 | 25-35 | P0 |
| **Server: git** (service, errors) | 2 | 15-20 | P0 |
| **Server: AI client** (client, openrouter) | 2 | 15-20 | P0 |
| **Server: security** (app.ts hostname, validation, trust-guard) | 3 | 10-12 | P0 |
| **Server: supporting** (fs, paths, http, utils, schemas, sessions, pipeline, drilldown, context, config service) | 10 | 40-55 | P1 |
| **Core: json, strings, format, errors** | 4 | 15-20 | P1 |
| **Core: review-state (fill gaps)** | 1 | 15-20 | P1 |
| **Core: event-to-log, stream-review** | 2 | 20-25 | P1 |
| **API: client, review** | 2 | 12-15 | P1 |
| **Schemas: custom validation** | 3 | 8-10 | P1 |
| **Web: review hooks** (stream, lifecycle, settings, error) | 4 | 20-25 | P2 |
| **Web: providers/config** (config-provider, keyboard-utils, model-filter, openrouter) | 4 | 15-20 | P2 |
| **Web: utils** (history utils, container utils, scoped-route-state, toast) | 4 | 15-20 | P2 |
| **Web: components with logic** (dialog focus trap, menu, checkbox, radio, severity-bar, activity-log) | 6 | 20-30 | P2 |
| **Total** | **~64 files** | **~330-430 tests** | — |

---

## Rules

### DO test:
1. Pure functions with branching (parsers, formatters, validators, mappers)
2. Error handling paths — what happens when things fail
3. Edge cases at boundaries — empty inputs, off-by-one, null/undefined
4. State machines and reducers — every action type, every branch
5. Security-critical code — XML escaping, path traversal, CORS, host validation
6. Custom schema validation — `.refine()`, `.transform()` only
7. Integration between layers (route → service → response) — later phase

### DO NOT test:
1. Constants, re-exports, barrel files
2. Framework behavior (React rendering, Hono routing, Zod built-in validators)
3. Trivial constructors that can't break (`ok()`, `err()`, `createError()`)
4. Implementation details (internal state, hook call counts)
5. CSS/styling, pure UI components
6. Third-party library behavior
7. Code that requires heavy mocking of internal modules
8. Complex DOM-dependent hooks (better as E2E)

### Test quality:
1. **AAA pattern**: Arrange → Act → Assert
2. **One behavior per test** — related assertions OK, unrelated = split
3. **Mock at boundaries only** — fetch, fs, AI providers, keyring
4. **No snapshots** — assert specific values
5. **Test names describe behavior**: `should return error when file not found`
6. **Co-locate tests**: `parser.ts` → `parser.test.ts` (same folder)

---

## Infrastructure — COMPLETE

- [x] Vitest installed (`^4.0.18` at root)
- [x] Per-package vitest.config.ts (5 configs)
- [x] Test scripts in package.json (5 of 6 packages)
- [ ] `packages/hooks` missing vitest config and test script

---

## Implementation Order

### Phase 0: Infrastructure
Setup vitest, configs, scripts.

### Phase 1: Server Core (highest risk)
1. Diff parser — complex parsing, most likely to have bugs
2. Review prompts — security-critical XML escaping
3. Review issues — dedup, sort, evidence extraction
4. Review orchestration — concurrent execution, error aggregation
5. Git service — status parsing, path traversal prevention
6. AI client — error classification, provider creation
7. App security — hostname validation, CORS

### Phase 2: Storage & Config
8. Persistence — collection CRUD, file I/O errors
9. Reviews storage — save/list/migrate
10. Config store — provider CRUD, secrets migration
11. Config state — loading, provider-secrets sync
12. Keyring — availability, read/write/delete

### Phase 3: Packages
13. Core: json, strings, format, errors
14. Core: review-state (fill gaps), event-to-log, stream-review
15. API: client, resumeReviewStream
16. Schemas: custom validation (3 schemas)

### Phase 4: Web
17. Pure utils: history utils, container utils, keyboard-utils
18. Review hooks: stream reducer, lifecycle, settings
19. State management: scoped-route-state, config-provider cache, settings cache, toast
20. Provider hooks: model-filter, openrouter-models
21. Components with logic: dialog focus trap, menu item extraction/navigation, checkbox/radio controlled state, severity-bar calculation, activity-log auto-scroll

### Phase 5: Integration Tests (future)
22. Server route integration tests via `app.request()`
23. Full review pipeline integration

---

## Sources
- Kent C. Dodds: [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- Kent Beck: "Test as little as possible to reach a given level of confidence"
- Vitest 3.2+: [Projects config](https://vitest.dev/guide/projects) (workspace.ts deprecated)
- Hono: [Testing with app.request()](https://hono.dev/docs/guides/testing)
