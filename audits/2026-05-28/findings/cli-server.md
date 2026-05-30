# Findings: `@diffgazer/server` (cli/server)

## Summary

| Severity | Count | STILL-OPEN | NEW |
| --- | --- | --- | --- |
| Critical | 0 | 0 | 0 |
| High | 6 | 2 | 4 |
| Medium | 13 | 0 | 13 |
| Low | 8 | 0 | 8 |
| **Total** | **27** | **2** | **25** |

---

## Critical

_No critical findings._

---

## High

### F24 — [STILL-OPEN] [error-handling] HTTP Status Code Mismatch: UNAUTHORIZED with 403 instead of 401

- **file:line** — `cli/server/src/app.ts:90`
- **What** — `ErrorCode.UNAUTHORIZED` is paired with HTTP status 403 (Forbidden) instead of 401 (Unauthorized).
- **Why** — Authentication failures should return 401; using 403 misrepresents the failure mode to clients and tooling.
- **How** — Change status from 403 to 401 on line 90: `errorResponse(c, "Unauthorized", ErrorCode.UNAUTHORIZED, 401)`.
- **Effort** — low

### F25 — [STILL-OPEN] [error-handling] HTTP Status Code Mismatch: UNAUTHORIZED with 403 in shutdown router

- **file:line** — `cli/server/src/features/shutdown/router.ts:13`
- **What** — `ErrorCode.UNAUTHORIZED` is paired with HTTP status 403 instead of 401 in the shutdown endpoint.
- **Why** — Authentication failures should return 401; the shutdown endpoint reports the wrong status class on a rejected token.
- **How** — Change status from 403 to 401: `errorResponse(c, "Shutdown is not authorized.", ErrorCode.UNAUTHORIZED, 401)`.
- **Effort** — low

### F149 — [NEW] [architecture] Rate limiter uses unbounded in-memory Map that grows indefinitely

- **file:line** — `cli/server/src/shared/middlewares/rate-limit.ts:14-43`
- **What** — The `windows` Map stores rate limit entries by key but never evicts expired entries. If many unique keys are used (e.g., different endpoints), memory grows unbounded.
- **Why** — An ever-growing map is a memory leak that degrades the long-running CLI server over time.
- **How** — Implement entry eviction: track oldest entry or use a TTL-based cleanup. Option A: Delete entries when they expire (check in `getOrResetWindow`). Option B: Use a size-bounded LRU cache. Option C: Run periodic cleanup interval.
- **Effort** — medium

### F248 — [NEW] [error-handling] HTTP 401 Unauthorized using 403 Forbidden status code

- **file:line** — `cli/server/src/app.ts:90`
- **What** — The shutdown token validation returns HTTP 403 Forbidden with `ErrorCode.UNAUTHORIZED`. The HTTP status code should be 401 Unauthorized for authentication failures, not 403 Forbidden (which is for authorization/permission failures).
- **Why** — Mixing 401 and 403 semantics breaks the contract between authentication errors and authorization errors for consumers.
- **How** — Change the HTTP status code from 403 to 401 when returning UNAUTHORIZED errors. Reserve 403 for `FORBIDDEN` `ErrorCode` (trust/permission failures). Update both `app.ts:90` and `shutdown/router.ts:13`.
- **Effort** — low

### F251 — [NEW] [type-safety] Type-unsafe type assertion in AI client initialization

- **file:line** — `cli/server/src/shared/lib/ai/client.ts:89-95`
- **What** — Double type assertion `as unknown as LanguageModel` bypasses TypeScript type checking for the OpenRouter provider. Runtime validation checks exist but the assertion hides type mismatches.
- **Why** — Silent type erasure means a future SDK change can break the integration without any compile-time signal.
- **How** — Add a comment explaining the SDK version drift: `// @ts-expect-error SDK version drift between @openrouter/ai-sdk-provider and ai`. The comment signals the issue and makes it searchable for future upgrades.
- **Effort** — low

### F257 — [NEW] [architecture] Rate limit window map grows unbounded

- **file:line** — `cli/server/src/shared/middlewares/rate-limit.ts:14,16-24`
- **What** — The rate limit middleware stores a global `windows` Map that tracks request counts per key. Old windows are cleaned up when they expire (`getOrResetWindow`), but the Map never shrinks—expired entries remain in memory indefinitely.
- **Why** — Stale entries accumulate, leaking memory in a long-lived server process.
- **How** — Add a cleanup mechanism: (1) Periodically prune expired entries, or (2) use a better data structure like `node-cache` or `lru-cache`. Example: `if (now - entry.windowStart >= windowMs * 2) { windows.delete(key); }` Check and delete stale entries periodically or on every access.
- **Effort** — medium

---

## Medium

### F26 — [NEW] [object-args] Too Many Positional Parameters: createSession Function

- **file:line** — `cli/server/src/features/review/sessions.ts:143-150`
- **What** — `createSession()` has 6 parameters (5 required + 1 optional with default), all positional.
- **Why** — Long positional parameter lists are error-prone at call sites and hard to extend safely.
- **How** — Refactor to accept an options object: `createSession(reviewId: string, options: { projectPath: string; headCommit: string; statusHash: string; mode: ReviewMode; scopeKey?: string })`.
- **Effort** — medium

### F27 — [NEW] [object-args] Too Many Positional Parameters: getActiveSessionForProject Function

- **file:line** — `cli/server/src/features/review/sessions.ts:268-274`
- **What** — `getActiveSessionForProject()` has 5 parameters (4 required + 1 optional), all positional.
- **Why** — Long positional parameter lists are error-prone at call sites and hard to extend safely.
- **How** — Refactor to accept an options object: `getActiveSessionForProject(projectPath: string, options: { headCommit: string; statusHash: string; mode: ReviewMode; scopeKey?: string })`.
- **Effort** — medium

### F146 — [NEW] [dry] Duplicate shutdown token validation logic across app and router

- **file:line** — `cli/server/src/app.ts:88-90`
- **What** — Both `app.ts` (global middleware) and `shutdownRouter` duplicate identical `SHUTDOWN_TOKEN_HEADER` validation using `safeTokenMatch`.
- **Why** — Duplicated security-critical validation can drift apart, leaving one path weaker than the other.
- **How** — Extract a shared middleware function for shutdown token validation and apply it once at the global level OR once at the feature level. Remove the duplicate validation from `shutdownRouter` since `app.ts` already enforces it for all `/api/*` routes except health.
- **Effort** — low

### F147 — [NEW] [type-safety] getRequestedProjectPath uses instanceof Response as a type predicate

- **file:line** — `cli/server/src/features/review/review-routes.ts:31-45`
- **What** — Function `getRequestedProjectPath` returns `string | Response` (a union of distinct types), and callers check `instanceof Response` to narrow. This is fragile and non-idiomatic for HTTP handlers.
- **Why** — Conflating a success value with an error transport object hides control flow and is easy to misuse.
- **How** — Return a discriminated union: `{ ok: true; projectPath: string } | { ok: false; response: Response }`. Update callers to destructure instead of `instanceof` checks. Alternatively, move validation into a middleware or separate validation step.
- **Effort** — medium

### F148 — [NEW] [error-handling] Error handlers in app.onError lack structured error type checking

- **file:line** — `cli/server/src/app.ts:123-126`
- **What** — Global error handler catches all errors with bare `console.error` and returns generic 500. No distinction between expected errors (validation, business logic) and unexpected errors (crashes).
- **Why** — Collapsing all errors into a 500 loses actionable status codes and obscures real crashes among expected failures.
- **How** — Check if error is an `AppError` (from `@diffgazer/core/errors`) with a `code` property; if so, use its code and message. Otherwise log full stack and return generic 500. Consider using a separate logger/telemetry service.
- **Effort** — medium

### F151 — [NEW] [architecture] Sessions cleanup uses setInterval without graceful shutdown

- **file:line** — `cli/server/src/features/review/sessions.ts:140-141`
- **What** — A cleanup interval is created at module load with `setInterval(cleanupStaleSessions, 5 * 60 * 1000)` and marked `unref`, but there is no shutdown hook to clear it when the server terminates.
- **Why** — A dangling interval complicates clean shutdown and leaks timers/state across test runs.
- **How** — Export a cleanup function (e.g., `shutdownSessions()`) that clears the interval. Call it from a server shutdown hook or SIGTERM handler. For tests, provide a reset function that clears intervals and session state.
- **Effort** — medium

### F152 — [NEW] [type-safety] AIClient type assertion for OpenRouter lacks runtime narrowing safety

- **file:line** — `cli/server/src/shared/lib/ai/client.ts:89-95`
- **What** — OpenRouter model creation uses double assertion (`as unknown as LanguageModel`) with post-hoc runtime checks. The assertion is necessary due to SDK type drift, but the code then checks for methods without proper TypeScript guards.
- **Why** — Ad-hoc method checks without `is` guards leave the narrowed type unverified by the compiler.
- **How** — Create a type guard function with proper `is` keyword to narrow the model type. Document the OpenRouter SDK version compatibility issue. Consider adding a comment explaining the assertion with SDK version constraints.
- **Effort** — low

### F156 — [NEW] [error-handling] Path validation using string patterns lacks comprehensive coverage

- **file:line** — `cli/server/src/shared/lib/validation.ts:1-6`
- **What** — `isValidProjectPath` only checks for `..` and `\0`. It doesn't validate against symlink traversal, relative paths like `./../../`, or absolute paths being misused.
- **Why** — Incomplete path validation is a traversal risk and can let requests escape the intended project root.
- **How** — Use `path.resolve()` to normalize, then check if the resolved path starts with an allowed base (using `realpath` to detect symlink traversal). Move validation logic to `features/git/service.ts` which already does proper `realpath` checks; consider using that pattern elsewhere.
- **Effort** — medium

### F249 — [NEW] [error-handling] Empty catch blocks suppress errors without intent-to-handle

- **file:line** — `cli/server/src/shared/lib/fs.ts:122,137`
- **What** — Two empty catch blocks (lines 122 and 137) in `writeJsonFile` and `atomicWriteFile` swallow errors during cleanup. While the intent is to suppress temp file deletion failures, the catch body is empty with no comment explaining the deliberate suppression.
- **Why** — Undocumented empty catches read as bugs and hide whether suppression is intentional.
- **How** — Add a comment explaining why cleanup errors are safe to ignore, e.g., `catch {} // Temp file cleanup failed but main write succeeded; safe to continue`.
- **Effort** — low

### F250 — [NEW] [error-handling] Unhandled promise rejections silently ignored in storage

- **file:line** — `cli/server/src/shared/lib/storage/reviews.ts:130,132`
- **What** — Two `.catch(() => {})` calls silently drop errors from `writeProjectIndex` and `removeFromProjectIndex` background operations. No logging or recovery strategy exists.
- **Why** — Silently dropped index-write failures make corruption and drift impossible to diagnose.
- **How** — Add logging: `writeProjectIndex(...).catch(err => console.warn('[storage] Failed to update project index:', getErrorMessage(err)))`.
- **Effort** — low

### F252 — [NEW] [error-handling] Missing default value safety in config context response

- **file:line** — `cli/server/src/features/review/context-routes.ts:24-28`
- **What** — The `getContextHandler` returns an object with `markdown` field twice (lines 24-25) and doesn't validate that snapshot fields exist before exposure.
- **Why** — Returning unvalidated snapshot fields can expose `undefined`/incomplete data to clients as if it were valid.
- **How** — Validate snapshot structure before returning: `if (!snapshot?.markdown) return errorResponse(c, 'Incomplete context snapshot', ErrorCode.INTERNAL_ERROR, 500);` Also remove the duplicate `text` field or clarify the intent (is it an alias?).
- **Effort** — low

### F253 — [NEW] [error-handling] Inconsistent error status mapping in drilldown handler

- **file:line** — `cli/server/src/features/review/review-routes.ts:191-198`
- **What** — The `drilldownHandler` maps error codes to HTTP status codes with a default of 500. The status variable is explicitly typed as `400 | 404 | 500` but the logic could miss new error codes added to `HandleDrilldownError`.
- **Why** — Without an exhaustive check, new error codes silently fall through to 500 and lose their intended status.
- **How** — Use a switch statement with exhaustive check: `switch (code) { case 'ISSUE_NOT_FOUND': status = 404; break; case 'NOT_FOUND': status = 404; break; case 'VALIDATION_ERROR': status = 400; break; default: status = 500; }` or ensure the if-chain covers all union members with a compile-time check.
- **Effort** — medium

### F256 — [NEW] [architecture] Session cleanup interval never cleared on server shutdown

- **file:line** — `cli/server/src/features/review/sessions.ts:140-141`
- **What** — A `setInterval` for `cleanupStaleSessions` is created and marked as `unref()` to avoid blocking shutdown, but there's no corresponding `clearInterval` on server shutdown or process termination.
- **Why** — The uncleared interval leaks across lifecycles and interferes with deterministic test teardown.
- **How** — Export a cleanup function from the sessions module: `export function cleanupSessions() { clearInterval(cleanupInterval); }` and call it from the server shutdown handler or in test teardown.
- **Effort** — medium

---

## Low

### F28 — [NEW] [type-safety] Unusual Type Import Pattern in response.ts

- **file:line** — `cli/server/src/shared/lib/http/response.ts:4,27`
- **What** — Importing `type { core }` from zod and using `core.$ZodError` is non-standard.
- **Why** — Relying on an internal zod namespace is brittle and unclear versus the public `ZodError` type.
- **How** — Replace `type { core } from "zod"` with direct use of `ZodError`: `import type { ZodError } from "zod"` and use `ZodError` in the type signature.
- **Effort** — low

### F29 — [NEW] [dry] Duplicate Rate Limit Configuration in Review Router

- **file:line** — `cli/server/src/features/review/router.ts:29-31`
- **What** — `bodyLimitMiddleware` (50KB) is instantiated identically to `config/router.ts`, creating duplication of middleware setup logic across routers.
- **Why** — Repeated middleware config drifts over time and obscures the intended shared limit.
- **How** — Consider creating a shared middleware factory or constants file for standard middleware configurations that are reused across routers.
- **Effort** — low

### F154 — [NEW] [architecture] Config store singleton lazy initialization not thread-safe

- **file:line** — `cli/server/src/shared/lib/config/store.ts:510-530`
- **What** — Lazy singleton pattern using `if (!_store) _store = createConfigStore()` can initialize the store twice in concurrent scenarios if two threads/async tasks check the condition before either completes initialization.
- **Why** — Although low-risk in Node.js, the pattern reads as unsafe and could double-initialize under other runtimes.
- **How** — This is low-risk in Node.js due to the single-threaded event loop, but for clarity: document that initialization is safe in Node.js, or use an `init()` function called once at startup instead of lazy initialization.
- **Effort** — low

### F155 — [NEW] [error-handling] Sessions event cap reached warning lacks severity or action guidance

- **file:line** — `cli/server/src/features/review/sessions.ts:49-66`
- **What** — When `MAX_EVENTS_PER_SESSION` is reached, code logs a warning once but silently drops non-terminal events. No client-side notification or retry guidance is provided.
- **Why** — Clients receive incomplete event streams with no signal that data was dropped.
- **How** — Consider emitting a non-terminal event to the client warning about the cap (e.g., 'Review session event storage exceeded limit. Events may be incomplete.'). Alternatively, increase `MAX_EVENTS_PER_SESSION` if 10k is too small for typical reviews.
- **Effort** — low

### F157 — [NEW] [kiss] Review pipeline config resolution lacks nullish coalescing clarity

- **file:line** — `cli/server/src/features/review/pipeline.ts:40-47`
- **What** — `resolveReviewConfig` uses nested ternary and `??` in a way that's hard to follow: `lensIds ?? profile?.lenses ?? settings.defaultLenses ?? [...]`.
- **Why** — Dense fallback chains hide the precedence rules and are easy to misread when editing.
- **How** — Extract into a helper function with a clear name and comment explaining the priority: `resolveActiveLenses(lensIds, profile, settings)`. Return an explicitly ordered fallback.
- **Effort** — low

### F158 — [NEW] [type-safety] HTTP response wrapper function allows passing invalid status codes

- **file:line** — `cli/server/src/shared/lib/http/response.ts:19-24`
- **What** — `errorResponse` accepts a `status` parameter of type `number` but only looks up values in `VALID_ERROR_STATUSES`. If an invalid status (e.g., 418) is passed, it silently defaults to 500 without warning or error.
- **Why** — A too-wide parameter type lets invalid statuses slip through and silently degrade to 500.
- **How** — Change the `status` parameter to `keyof typeof VALID_ERROR_STATUSES` (a literal union of valid codes). This forces callers to pass valid codes at compile time. Alternatively, add a runtime assertion with a helpful error message.
- **Effort** — low

### F255 — [NEW] [dry] Shutdown token validation duplicated across routes

- **file:line** — `cli/server/src/app.ts:88-91` and `cli/server/src/features/shutdown/router.ts:11-13`
- **What** — The shutdown token validation logic is implemented twice: once in the global middleware (`app.ts`) and again in the shutdown route handler (`shutdown/router.ts`). Both read `DIFFGAZER_SHUTDOWN_TOKEN` and call `safeTokenMatch`.
- **Why** — Duplicated auth checks can diverge, and the redundant second check adds maintenance cost without added safety.
- **How** — Remove the token check from `shutdown/router.ts:11-13` and rely on the global middleware in `app.ts`. The middleware ensures no request reaches `/api/shutdown` without a valid token, so the router can assume the token is valid.
- **Effort** — low

### F258 — [NEW] [dry] Context-routes response duplication and missing validation

- **file:line** — `cli/server/src/features/review/context-routes.ts:23-27`
- **What** — Both `getContextHandler` and `refreshContextHandler` return the same response shape with duplicated field `text: snapshot.markdown` and `markdown: snapshot.markdown`. The duplication is inconsistent with REST conventions.
- **Why** — Two handlers building the same shape by hand drift apart, and the duplicated `text`/`markdown` fields confuse the contract.
- **How** — Extract the response shape into a shared function: `const toContextResponse = (snapshot) => ({ markdown: snapshot.markdown, graph: snapshot.graph, meta: snapshot.meta });` Use it in both handlers. Remove the `text` field unless it serves a backward-compatibility purpose (document it if so).
- **Effort** — low
