# Stargazer Code Quality Audit

**Date:** 2026-02-07
**Auditors:** 5 specialized agents (React/Web, Server, Packages, CodeRabbit, Code Simplifier)
**Scope:** Full codebase — `apps/server/`, `apps/web/`, `packages/core/`, `packages/api/`, `packages/schemas/`, `packages/hooks/`

---

## Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 6 |
| HIGH | 18 |
| MEDIUM | 28 |
| LOW | 20 |
| **Total** | **72** (deduplicated) |

**Top 3 systemic issues:**
1. **ADR-0001 violations** — 5+ modules throw instead of returning Result<T,E>
2. **20+ useCallback/useMemo in React 19 project** — explicit rule violation across 12 files
3. **Security gaps** — CORS static allowlist (not per ADR-0003), unvalidated project root header, missing security headers

**Overall:** Codebase is well-structured with good separation of concerns. Result<T,E> pattern is consistently applied in most places. Security mitigations (XML escaping, path traversal in git service) are solid. The issues below are real but fixable.

---

## CRITICAL Findings

### CRIT-1: CORS Uses Static Allowlist Instead of Dynamic Hostname Check

**File:** `apps/server/src/app.ts:9-14`
**ADR:** ADR-0003 (CORS Localhost Only)
**Sources:** CodeRabbit C-1, Server C4-01

The CORS implementation hardcodes ports `3001` and `5173`:
```typescript
const ALLOWED_ORIGINS = [
  "http://localhost:3001", "http://127.0.0.1:3001",
  "http://localhost:5173", "http://127.0.0.1:5173",
];
```

ADR-0003 specifies dynamic hostname checking (any localhost port). This breaks if Vite picks a different port and doesn't cover CLI embedded mode (port 3000).

**Fix:** Replace with the dynamic check from ADR-0003 (`new URL(origin).hostname === "localhost"`).

---

### CRIT-2: `resolveProjectRoot` Trusts Client Header Without Validation

**File:** `apps/server/src/shared/lib/paths.ts:27-41`
**Sources:** CodeRabbit C-2, Server C4-02/C4-03

The `x-stargazer-project-root` header is used directly as a file system path. `isValidProjectPath` only blocks `..` and null bytes but:
1. Is NOT applied in `getProjectRoot` (only in `parseProjectPath` for query params)
2. Allows absolute paths like `/etc/passwd`
3. No verification that path contains a `.git` directory

**Impact:** Any endpoint using `getProjectRoot(c)` is vulnerable to arbitrary file read/write.

**Fix:** Apply validation inside `getProjectRoot` itself. Verify the path is under user home or contains `.git`.

---

### CRIT-3: ADR-0001 Violations — throw Instead of Result<T,E>

**Sources:** Server C1-01/02/03, Packages API-01, CROSS-01

5+ modules throw exceptions instead of returning Result, violating the project's core architectural decision:

| File | Function | What it throws |
|------|----------|---------------|
| `apps/server/src/shared/lib/ai/client.ts:93` | `createLanguageModel` | `new Error('Unsupported provider')` |
| `apps/server/src/shared/lib/ai/openrouter-models.ts:92,102,145` | `fetchOpenRouterModels`, `getOpenRouterModelsWithCache` | `new Error(...)` on HTTP/parse failures |
| `apps/server/src/shared/lib/git/service.ts:177,181` | `getHeadCommit` | `new Error(...)` on empty hash/git failure |
| `packages/api/src/client.ts:22,58` | `send()`, `parse()` | `ApiError` on all failures |
| `apps/server/src/features/review/pipeline.ts:125+` | Multiple | `throw reviewAbort(...)` as flow control |

The **API client** is the most impactful — every consumer is forced into try/catch, creating a dual error paradigm across the codebase.

**Fix:** Refactor to return `Result<T, E>`. Priority: API client > AI client > git service > pipeline.

---

### CRIT-4: Explicit `any` Type in Production Code

**File:** `apps/server/src/shared/lib/ai/openrouter-models.ts:22`
**Sources:** Server C2-01, CodeRabbit H-6

```typescript
const mapOpenRouterModel = (raw: any): OpenRouterModel | null => {
```

Processes untrusted external API data with zero type safety. Only `any` in the entire server codebase.

**Fix:** Type as `unknown` with Zod parse, or define an interface for the OpenRouter API response.

---

### CRIT-5: 20+ useCallback/useMemo Violations Across 12 Files

**Sources:** React R-01 through R-07

Project rule (CLAUDE.md): "No manual useCallback/useMemo — React 19 Compiler auto-memoizes."

| File | Count | What |
|------|-------|------|
| `config-provider.tsx` | 4 useCallback + 2 useMemo | Provider context |
| `keyboard-provider.tsx` | 2 useCallback + 1 useMemo | Provider context |
| `theme-provider.tsx` | 1 useMemo | Context value |
| `toast-context.tsx` | 2 useMemo | Split context |
| `footer-context.tsx` | 2 useMemo | Split context |
| `use-reviews.ts` | 1 useCallback | Fetch wrapper |
| `tabs.tsx` | 1 useMemo | Context value |
| `dialog.tsx` | 1 useMemo | Context value |
| `menu.tsx` | 1 useMemo | Context value |
| `navigation-list.tsx` | 1 useMemo | Context value |
| `radio-group.tsx` | 1 useMemo | Context value |
| `checkbox.tsx` | 1 useMemo | Context value |

**Fix:** Remove all. Zero behavioral change with React 19 Compiler. Automated find-and-remove.

---

### CRIT-6: Missing Security Headers

**File:** `apps/server/src/app.ts`
**Sources:** CodeRabbit M-1

Security docs claim `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` are implemented in `app.ts`, but they are NOT present in the actual code.

**Fix:** Add a global middleware setting both headers.

---

## HIGH Findings

### HIGH-1: Unbounded Session Memory

**File:** `apps/server/src/features/review/sessions.ts:18`
**Sources:** Server C3-05/C3-06, CodeRabbit H-4

`activeSessions` Map has no size limit. Events array grows unbounded per session. If a session is created but never completes (client disconnect), it leaks forever.

**Fix:** Add max session count (e.g., 50) with LRU eviction. Add periodic cleanup for sessions older than 30 min.

---

### HIGH-2: Synchronous File I/O in Request Handlers

**File:** `apps/server/src/shared/lib/fs.ts`, `config/state.ts`, `config/store.ts`
**Sources:** Server C5-01

Config persistence uses `readFileSync`/`writeFileSync` called from route handlers. Blocks event loop during API requests.

**Fix:** Use async `atomicWriteFile` (already exists) for writes triggered by API requests. Sync is fine for startup.

---

### HIGH-3: `readJsonFileSync` Silently Swallows JSON Parse Errors

**File:** `apps/server/src/shared/lib/fs.ts:12-22`
**Sources:** CodeRabbit H-2

Returns `null` for both "file not found" and "corrupted JSON". A corrupted config file silently resets all settings.

**Fix:** Only return `null` for ENOENT. Log or throw for parse errors.

---

### HIGH-4: `atomicWriteFile` Race Condition — `Date.now()` for Temp Name

**File:** `apps/server/src/shared/lib/fs.ts:51`
**Sources:** CodeRabbit H-3

Uses `Date.now()` for temp filename while `writeJsonFileSync` correctly uses `randomUUID()`. Concurrent writes within same millisecond collide.

**Fix:** Use `randomUUID()` consistently.

---

### HIGH-5: Async Subscribers Called Synchronously — Unhandled Rejections

**File:** `apps/server/src/features/review/sessions.ts:51-63`
**Sources:** Server C9-01, CodeRabbit H-5

`addEvent` calls subscriber callbacks synchronously, but subscribers in `service.ts` are async (they write SSE). Returned Promises are silently ignored. Rejected Promises become unhandled rejections.

**Fix:** Either make `addEvent` async and await callbacks, or explicitly `.catch()` async subscriber calls.

---

### HIGH-6: Missing `requireRepoAccess` Middleware on Review Stream

**File:** `apps/server/src/features/review/router.ts:101`
**Sources:** Server C8-02

The review stream endpoint only requires `requireSetup` but not `requireRepoAccess`, even though the review process reads repository files.

**Fix:** Add `requireRepoAccess` middleware to review stream and context endpoints.

---

### HIGH-7: Review Stream Doesn't Clean Up Session on Client Abort

**File:** `apps/server/src/features/review/service.ts:163-225`
**Sources:** CodeRabbit H-7

When client disconnects, `handleReviewFailure` returns early for abort errors without marking the session complete. The session stays in memory and broken replay attempts follow.

**Fix:** On client abort, mark session complete and cancel session controller.

---

### HIGH-8: `useSettings` Triggers Network Fetch During Render Phase

**File:** `apps/web/src/hooks/use-settings.ts:52-55`
**Sources:** React H-05

`triggerFetch()` runs synchronously during render when no cache exists. Side effects during render are a React anti-pattern.

**Fix:** Move to `useEffect`. 3-line change.

---

### HIGH-9: `as SetupStatus` Cast Without Validation

**File:** `apps/web/src/app/providers/config-provider.tsx:138,166`
**Sources:** React T-01

Casts API response to `SetupStatus` without runtime validation. If API shape changes, silently produces wrong types. The file already uses Zod elsewhere.

**Fix:** Use `SetupStatusSchema.parse(initData.setup)`. 1-line change.

---

### HIGH-10: `useSelectableList` Effect Without Dependency Array

**File:** `apps/web/src/hooks/keyboard/use-selectable-list.ts:85-94`
**Sources:** React R-12

`useEffect(() => { ... })` with NO deps runs after every render. Ref guard prevents actual work, but this is a performance anti-pattern.

**Fix:** Add `[focusedIndex]` dependency. 1-line change.

---

### HIGH-11: `as unknown as LanguageModel` Double Assertion

**File:** `apps/server/src/shared/lib/ai/client.ts:90`
**Sources:** Server C2-02, CodeRabbit L-1

Double-casting bypasses all type safety between OpenRouter SDK and Vercel AI SDK types.

**Fix:** Document the version mismatch or add a runtime wrapper.

---

### HIGH-12: `useFiglet` Is Not a React Hook

**File:** `packages/hooks/src/use-figlet.ts`
**Sources:** Packages HOOKS-01

Pure synchronous function with zero hook behavior. The `use` prefix misleads React 19 Compiler into treating it as a hook.

**Fix:** Rename to `renderFiglet` or `getFigletText`.

---

### HIGH-13: `buildDrilldownPrompt` Doesn't Escape All AI-Derived Fields

**File:** `apps/server/src/shared/lib/review/prompts.ts:244-303`
**Sources:** CodeRabbit M-2/M-3

Only `rationale` and `recommendation` are escaped. `issue.id`, `issue.title`, `issue.file`, and `otherIssuesSummary` are embedded raw. A prompt injection in the first review pass could persist into the drilldown.

**Fix:** Apply `escapeXml` to all dynamic fields.

---

### HIGH-14: Module-Level Mutable Singleton State in Config Store

**File:** `apps/server/src/shared/lib/config/store.ts:26-28`
**Sources:** Server C3-01, CodeRabbit M-7

Mutable module-level state loaded at import time. No reset mechanism for testing. Concurrent async operations could cause lost updates.

**Fix:** Wrap in factory function `createConfigStore()` for testability.

---

### HIGH-15: `useProvidersPageState` Returns 25 Values

**File:** `apps/web/src/features/providers/hooks/use-providers-page-state.ts`
**Sources:** React H-01

God hook composing 4 sub-hooks, returning 25 values. Hard to understand what depends on what.

**Fix:** Group return values into named sub-objects: `{ selection, filters, handlers, state }`.

---

### HIGH-16: ConfigProvider Both Sets Error State AND Re-throws

**File:** `apps/web/src/app/providers/config-provider.tsx:190,218,244`
**Sources:** React P-02

Callers must handle both error state AND thrown exceptions. Fragile dual-channel error contract.

**Fix:** Pick one: either throw OR set state, not both.

---

### HIGH-17: `useReviewStream.resume` Mixes Result and Throw

**File:** `apps/web/src/features/review/hooks/use-review-stream.ts:140-175`
**Sources:** React P-03

Returns `Result<void, StreamReviewError>` but also has a catch block that re-throws. Callers must handle both paths.

**Fix:** Always return Result. Catch and wrap in `err(...)`.

---

### HIGH-18: Dev Server Binds to 0.0.0.0

**File:** `apps/server/src/dev.ts:8-16`
**Sources:** CodeRabbit L-4

The `@hono/node-server` `serve()` binds to all interfaces by default, violating the "localhost-only" security model.

**Fix:** Add `hostname: "127.0.0.1"` to serve options.

---

## MEDIUM Findings

| # | File | Issue | Source |
|---|------|-------|--------|
| M-1 | `server/features/review/enrichment.ts` | `enrichIssues` ignores abort signal during execution | CodeRabbit H-1 |
| M-2 | `server/shared/lib/git/service.ts` + others | Silent `catch {}` blocks swallow errors (5+ places) | Server C1-05 |
| M-3 | `server/shared/lib/storage/reviews.ts:152,173` | `.catch(() => {})` hides migration write failures | Server C1-06 |
| M-4 | `server/features/review/pipeline.ts:125+` | `throw reviewAbort(...)` as flow control | Server C1-04 |
| M-5 | `server/features/review/context.ts:12-22` | Duplicate `readJsonFile` reimplements `shared/lib/fs.ts` | Simplifier #2, Server C3-03 |
| M-6 | `server/shared/lib/ai/client.ts` + `git/errors.ts` | Identical error classification algorithm duplicated | Simplifier #3 |
| M-7 | `server/shared/lib/ai/client.ts:20` | `as Record<AIProvider, string>` should use `satisfies` | Server C2-03 |
| M-8 | `server/features/review/pipeline.ts:197` | `as LensId[]` without validation | Server C2-06 |
| M-9 | `server/shared/lib/config/state.ts:36-38` | Paths computed at import time, env vars must be set before import | Server C3-02 |
| M-10 | `server/features/review/router.ts:299` | Drilldown error always returns 400 (should map codes to HTTP status) | Server C8-04 |
| M-11 | `server/features/review/schemas.ts:31-37` | `CsvLensIdsSchema` throws inside `.transform()` via `.parse()` | CodeRabbit M-9 |
| M-12 | `server/shared/lib/review/orchestrate.ts:18-59` | `runWithConcurrency` has undefined holes on abort | CodeRabbit M-4 |
| M-13 | `server/shared/lib/storage/reviews.ts:48-66` | `migrateReview` mutates input object | CodeRabbit M-5 |
| M-14 | `server/features/review/drilldown.ts:107-146` | Re-fetches git diff instead of using stored diff | CodeRabbit M-6 |
| M-15 | `server/features/review/schemas.ts:20-29` | `parseCsvParam` has no item count limit | Server C4-04, CodeRabbit M-8 |
| M-16 | `server/features/review/context.ts:295-305` | Writes files with plain `writeFile` instead of `atomicWriteFile` | CodeRabbit M-10 |
| M-17 | `server/shared/lib/review/analysis.ts` | 247-line god function | Server C6-05 |
| M-18 | `server/shared/lib/paths.ts:15` + `context.ts:57` | Sync `existsSync` in request path | Server C5-02 |
| M-19 | `server/shared/lib/storage/reviews.ts:140-161` | `listReviews` reads all files for migration check | Server C5-03 |
| M-20 | `web/hooks/use-openrouter-models.ts:84-135` | Complex two-effect state machine with refs | React R-11 |
| M-21 | `web/hooks/use-settings.ts:71` | `error` field is always `null` — typed lie | React H-06, Simplifier #19 |
| M-22 | `web/providers/config-provider.tsx` + `router.tsx` + `use-settings.ts` | Duplicate module-level config caches with different TTLs | React P-04 |
| M-23 | `web/features/review/hooks/use-review-lifecycle.ts` | 186 lines, manages 6+ concerns with 3 refs and 3 effects | React H-02 |
| M-24 | `packages/api/src/client.ts:24` | `return body as T` — no runtime validation | Packages API-03 |
| M-25 | `packages/core/src/review/review-state.ts:9` | `Set<string>` not serializable | Packages CORE-03 |
| M-26 | `packages/schemas/src/events/agent.ts:42-83` | `AGENT_METADATA` bypasses `AgentMetaSchema` validation | Packages SCHEMA-01 |
| M-27 | `packages/hooks/src/use-figlet.ts:6-7` | Module-level side effects (font parsing on import) | Packages HOOKS-03 |
| M-28 | `packages/core/src/format.ts:16-22` | `formatTimestamp` returns raw string for string input | CodeRabbit M-11 |

---

## LOW Findings

| # | File | Issue | Source |
|---|------|-------|--------|
| L-1 | `server/shared/lib/fs.ts:18,45` + `context.ts:18` | Repeated `as NodeJS.ErrnoException` — reuse `isNodeError` | Server C2-04 |
| L-2 | `server/shared/lib/http/response.ts:11` | `as ContentfulStatusCode` hides invalid status | Server C2-05 |
| L-3 | `server/features/review/pipeline.ts:47` | `as Record<ReviewSeverity, number>` on empty object | Server C2-07 |
| L-4 | `server/features/review/enrichment.ts:88` | `enrichIssues` no abort check during execution | Server C3-04 |
| L-5 | `server/app.ts:48-49` | Health router mounted at both `/` and `/api` — undocumented | Server C8-01 |
| L-6 | `server/features/config/router.ts:99-110` | Missing `zodErrorHandler` on delete param validation | Server C8-03 |
| L-7 | `server/shared/lib/ai/openrouter-models.ts:85-89` | No timeout on OpenRouter API fetch | Server C9-02 |
| L-8 | `server/features/review/context.ts:139-170` | `buildFileTree` no symlink cycle protection | CodeRabbit L-2 |
| L-9 | `server/features/config/service.ts:149-157` | `deleteConfig` returns `ok(null)` instead of `err(NOT_FOUND)` | CodeRabbit L-5 |
| L-10 | `packages/core/src/strings.ts:6-9` | `truncate` broken when `maxLength < suffix.length` | Packages CORE-11, CodeRabbit L-7 |
| L-11 | `packages/core/src/review/review-state.ts:259` | Missing exhaustive check in reducer default case | Packages CORE-04 |
| L-12 | `packages/core/src/streaming/sse-parser.ts:21` | `console.debug` in library code | Packages CORE-10 |
| L-13 | `packages/api/src/config.ts:97` | `deleteTrust` bypasses standard `parse()` pattern | Packages API-04 |
| L-14 | `packages/schemas/src/config/providers.ts:159,162` | `as GeminiModel` / `as GLMModel` in `.includes()` | Packages SCHEMA-03 |
| L-15 | `packages/schemas/src/events/step.ts:72-81` | `isStepEvent` uses manual cast instead of Zod safeParse | Packages SCHEMA-04 |
| L-16 | `web/features/review/components/review-container.utils.ts:18-21` | `truncateText` duplicates core `truncate` | Simplifier #12 |
| L-17 | `web/features/providers/hooks/use-openrouter-models.ts:1` | Re-export wrapper adds no value | React O-01 |
| L-18 | `web/hooks/use-scroll-into-view.ts:23,44` | `as HTMLElement` casts — use `querySelectorAll<HTMLElement>` | React T-06 |
| L-19 | `packages/core/src/review/filtering.ts` | 3 exported functions with zero production consumers (~45 lines dead code) | Simplifier #1, Packages CORE-02 |
| L-20 | `server/shared/lib/review/prompts.ts:12` + `lenses.ts:68` + `profiles.ts:36` | Dead exports: `DEFAULT_RUBRIC`, `LENSES`, `PROFILES` | Simplifier #16/17/18 |

---

## Quick Wins (Minimal Risk, High Impact)

| # | Fix | Files | Effort | Risk |
|---|-----|-------|--------|------|
| QW-1 | Remove all `useCallback`/`useMemo` (20+ instances) | 12 web files | 30 min | None |
| QW-2 | Move `triggerFetch()` to `useEffect` in `use-settings.ts` | 1 file | 5 min | None |
| QW-3 | Add `[focusedIndex]` dep to `useSelectableList` effect | 1 file | 1 min | None |
| QW-4 | Use `querySelectorAll<HTMLElement>` in `use-scroll-into-view.ts` | 1 file | 2 min | None |
| QW-5 | Replace `Date.now()` with `randomUUID()` in `atomicWriteFile` | 1 file | 1 min | None |
| QW-6 | Validate `initData.setup` with Zod instead of `as SetupStatus` | 1 file | 2 min | None |
| QW-7 | Add security headers middleware | 1 file | 5 min | None |
| QW-8 | Add `hostname: "127.0.0.1"` to dev server | 1 file | 1 min | None |
| QW-9 | Type `any` as `unknown` in `mapOpenRouterModel` | 1 file | 5 min | None |
| QW-10 | Delete dead code: filtering.ts unused exports, LENSES, PROFILES, DEFAULT_RUBRIC | 4 files | 10 min | None |

---

## Additional Tests Needed (Based on Audit)

### From Existing Gap Analysis (16 files, ~95-134 tests)
These were already identified in `test-implementation-report.md` Section 3.

### New Tests From This Audit

| Priority | Test | Finding |
|----------|------|---------|
| P0 | CORS dynamic origin check (any localhost port) | CRIT-1 |
| P0 | `getProjectRoot` with malicious header values | CRIT-2 |
| P0 | Security headers present in responses | CRIT-6 |
| P0 | `readJsonFileSync` behavior with corrupted JSON | HIGH-3 |
| P0 | `atomicWriteFile` concurrent write safety | HIGH-4 |
| P0 | Session memory limits and cleanup on abort | HIGH-1, HIGH-7 |
| P1 | `addEvent` async subscriber error handling | HIGH-5 |
| P1 | Review stream requires repo access middleware | HIGH-6 |
| P1 | `use-settings` render-phase fetch and error state | HIGH-8, M-21 |
| P1 | `useReviewStream.resume` error paths (Result vs throw) | HIGH-17 |
| P1 | `enrichIssues` abort signal propagation | M-1 |
| P1 | `runWithConcurrency` behavior on abort (undefined holes) | M-12 |
| P2 | `truncate` edge case when `maxLength < suffix.length` | L-10 |
| P2 | `formatTimestamp` with string input | M-28 |
| P2 | `CsvLensIdsSchema` with invalid lens IDs | M-11 |
| P2 | Drilldown error code to HTTP status mapping | M-10 |

**Estimated: ~30-40 additional tests from audit findings.**

---

## Architecture Observations (Positive — Preserve These)

1. **Result<T,E> pattern** — well-implemented where used
2. **XML escaping in prompts** — correctly addresses CVE-2025-53773
3. **Host header validation** — proper DNS rebinding protection
4. **Path traversal protection in git service** — `realpath` + prefix check
5. **Atomic file writes** — temp-then-rename pattern
6. **Zod validation on all route inputs** — prevents malformed requests
7. **Concurrency control in orchestration** — proper limits with abort
8. **Split context pattern (React)** — data + actions contexts
9. **Keyboard scope system** — well-designed handler registration
10. **SSE parser buffer overflow protection** — 1MB limit

---

## Recommended Fix Priority

### Phase 1: Security (do first)
- CRIT-1: Fix CORS to dynamic hostname check
- CRIT-2: Validate project root header
- CRIT-6: Add security headers
- HIGH-6: Add `requireRepoAccess` to review stream
- HIGH-13: Escape all fields in drilldown prompt
- HIGH-18: Bind dev server to 127.0.0.1

### Phase 2: Quick Wins (low risk, high value)
- All QW-1 through QW-10

### Phase 3: Error Handling Consistency
- CRIT-3: Refactor API client to return Result<T,E>
- HIGH-16: ConfigProvider single error channel
- HIGH-17: useReviewStream.resume single error channel

### Phase 4: Stability
- HIGH-1: Session memory limits
- HIGH-2: Async file I/O for config persistence
- HIGH-3: Proper JSON parse error handling
- HIGH-4: UUID for temp files
- HIGH-5: Async subscriber handling
- HIGH-7: Session cleanup on abort

### Phase 5: Code Quality
- Remaining MEDIUM and LOW findings
- Dead code removal
- Deduplication
