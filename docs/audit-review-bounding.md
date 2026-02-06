# Audit: `feature/review-bounding` Branch

Branch: `feature/review-bounding` | Base: `main`
17 files changed, +565/-160 lines
Audited: 2026-02-06 by 3 specialist agents (CodeRabbit, Code Simplifier, Code Explorer)

---

## CRITICAL

### C-1. Debug `console.log("xd")` in production code (3 locations)

Remove all three:

- `apps/server/src/features/review/enrichment.ts:87`
- `apps/server/src/features/review/schemas.ts:31`
- `apps/server/src/features/review/router.ts:205`

These execute at module load on every server startup.

---

## HIGH

### H-1. Unhandled promise rejections in subscriber callbacks (`sessions.ts`)

**Same class of bug as the original `SessionCancelled` crash.**

`cancelSession()` (sessions.ts:85-91) and `addEvent()` (sessions.ts:53-58) both iterate subscribers with `forEach` and wrap in `try/catch`. But subscriber callbacks are `async` (they call `await writeStreamEvent`), so the `try/catch` never catches rejections. Any async throw (e.g., stream already closed) is an unhandled promise rejection.

**Fix:** Either:
- `await` the callbacks (requires changing `forEach` to a `for...of` loop)
- Wrap the async callback with `.catch()` when subscribing
- Fire-and-forget with explicit `.catch(() => {})` in the subscriber invocation

**Files:**
- `apps/server/src/features/review/sessions.ts:53-58` (`addEvent`)
- `apps/server/src/features/review/sessions.ts:85-91` (`cancelSession`)

### H-2. TOCTOU race in `resumeStreamById` — partial replay with no terminal event

**File:** `apps/server/src/features/review/router.ts:100-154`

Flow:
1. Read session (line 102)
2. Check staleness (lines 116-129)
3. Open SSE stream (line 140)

Between steps 2 and 3, another request can call `cancelSession(id)` which deletes the session and sets `isComplete = true`. Then `streamActiveSessionToSSE` replays buffered events but `subscribe()` returns `null` (session deleted from map). The client receives a partial replay with **no terminal event** (`complete` or `error`), leaving the UI in a loading state.

**Fix:** `streamActiveSessionToSSE` should emit a terminal error event when `subscribe()` returns `null` after replaying events. Something like a `SESSION_STALE` error event so the client knows to restart.

**Files:**
- `apps/server/src/features/review/router.ts:100-154`
- `apps/server/src/features/review/service.ts:338-374` (`streamActiveSessionToSSE`)

### H-3. `assertSessionActive` in `finalizeReview` silently discards completed review results

**File:** `apps/server/src/features/review/service.ts:313-314`

The call at line 314 is placed AFTER `stepComplete("report")` and AFTER expensive enrichment, but BEFORE `saveReview()`. If the session is cancelled at this exact point (e.g., another client triggers `cancelSession`), the fully-computed review is never persisted. The `SessionCancelled` error is silently caught at line 456 with `return;`.

**Impact:** Minutes of AI processing + enrichment silently discarded with no notification to the original client.

**Fix options:**
1. Move `assertSessionActive` before enrichment (fail earlier, waste less work)
2. Remove it entirely — let the review save even if the session was cancelled (the data is still valid)
3. Keep it but emit a terminal event to the original client before returning

### H-4. URL flicker on stale session resume (web)

**File:** `apps/web/src/features/review/hooks/use-review-stream.ts:139-175`

When `resume()` is called:
1. Dispatches `START` (resets state including `reviewId: null`)
2. Dispatches `SET_REVIEW_ID` with the OLD stale review ID
3. `resumeReviewStream` returns `SESSION_STALE`
4. Component calls `start(options)` which dispatches `START` again

Between steps 2 and 4, `state.reviewId` is the stale ID. The `useEffect` in `review-container.tsx:139-149` fires on `reviewId` changes, potentially triggering a spurious URL navigation to the stale review URL before the new review starts.

**Fix:** Don't dispatch `SET_REVIEW_ID` in the `resume()` path until the stream is confirmed active, or gate the navigation effect to ignore stale IDs.

**Files:**
- `apps/web/src/features/review/hooks/use-review-stream.ts:149`
- `apps/web/src/features/review/components/review-container.tsx:139-149`

---

## MEDIUM

### M-1. `cancelSession` deletes session immediately vs `markComplete`'s 5-min TTL

**File:** `apps/server/src/features/review/sessions.ts:72-93`

`cancelSession` calls `activeSessions.delete(reviewId)` immediately (line 93), while `markComplete` uses a 5-minute delayed cleanup (line 68). If a second client tries to resume the cancelled session, `getSession` returns `undefined` and they get `SESSION_NOT_FOUND` instead of `SESSION_STALE` — semantically inaccurate.

**Fix:** Use the same delayed cleanup in `cancelSession`, or at minimum keep the session in the map with `isComplete = true` for a short TTL.

### M-2. Stream closed without terminal event returns generic `STREAM_ERROR`

Due to H-2, if the SSE stream closes without a terminal event, `processReviewStream` returns `{ code: "STREAM_ERROR", message: "Stream ended without complete event" }`. The web hook at `use-review-stream.ts:162-166` only special-cases `SESSION_STALE` and `SESSION_NOT_FOUND`, so the user sees a generic error instead of being prompted to restart.

### M-3. Type safety gap — error codes use raw string comparisons across packages

Error codes like `"SESSION_STALE"` and `"SESSION_NOT_FOUND"` are string literals duplicated across:
- `packages/schemas/src/review/issues.ts:115-116`
- `packages/api/src/review.ts:85,88`
- `apps/web/src/features/review/hooks/use-review-stream.ts:163-164`
- `apps/web/src/features/review/components/review-container.tsx:194,200`
- `apps/server/src/features/review/sessions.ts:80`
- `apps/server/src/features/review/router.ts:97-98`

No compile-time exhaustiveness checking. If codes are renamed, clients break silently.

**Fix:** Export the codes as a const enum or string union from `@stargazer/schemas` and import everywhere.

---

## LOW / PERFORMANCE

### L-1. Parallelize sequential git calls with `Promise.all`

Two locations do sequential independent git calls:

```typescript
// router.ts:113-117
currentHeadCommit = await gitService.getHeadCommit();
currentStatusHash = await gitService.getStatusHash();

// service.ts:414-416 (same pattern)
```

**Fix:** `Promise.all([gitService.getHeadCommit(), gitService.getStatusHash()])`

### L-2. `assertSessionActive` return value is unused at its sole call site (service.ts:314)

The function returns `ActiveSession` but the return is discarded. Either use the return value or simplify.

### L-3. `apps/cli/.stargazer/` files contain machine-local absolute paths and are committed — consider `.gitignore`

---

## SERVICE.TS SPLIT ANALYSIS

**Verdict: DO NOT SPLIT.**

483 lines is appropriate for a pipeline orchestrator. The file has clean internal structure:
1. Constants (36-39)
2. SSE event helpers (41-60)
3. Report generation (62-94)
4. Diff helpers (96-121)
5. Error control flow (123-150)
6. Pipeline steps (152-334): `resolveGitDiff` -> `resolveReviewConfig` -> `executeReview` -> `finalizeReview`
7. Session replay (336-390)
8. Main orchestrator (392-483)

All steps form a single narrative. Splitting would require jumping between files to understand the flow. Module boundaries in `apps/server/src/features/review/` are already correct. Revisit only if file grows past 600-700 lines.

---

## CANCELLATION ARCHITECTURE: Replace `SessionCancelled` with `AbortSignal`

### Problem

`SessionCancelled` is a throw-based cancellation mechanism (poor man's AbortSignal). It breaks when `onEvent` callbacks are fire-and-forget (not awaited) — the thrown error becomes an unhandled promise rejection that crashes Node.js.

The `onEvent` type is `() => void` but the actual implementation is `async`. There are 34 `onEvent` call sites (12 in hot paths), none awaited.

### Existing Infrastructure (already in the project)

| Layer | Status | Where |
|-------|--------|-------|
| Web app | AbortController in `use-review-stream.ts` | `useRef<AbortController>` |
| API package | `signal?: AbortSignal` in `StreamReviewOptions`, `ResumeReviewOptions` | `packages/api/src/review.ts` |
| Core package | `signal?: AbortSignal` in `StreamReviewRequest` | `packages/core/src/review/stream-review.ts` |
| AI client | `abortSignal` in `generateObject()` | `apps/server/src/shared/lib/ai/client.ts:126` |
| Hono | `c.req.raw.signal` available (not currently used) | Standard Hono API |
| Server orchestration | **MISSING** — no signal propagation | Gap to fill |

### Solution: Two patterns for two contexts

| Context | Pattern | Why |
|---------|---------|-----|
| **Awaited code** (main pipeline in service.ts) | `signal.throwIfAborted()` | Throw propagates through async stack to main catch |
| **Fire-and-forget** (onEvent in orchestrate.ts, analysis.ts) | `if (signal.aborted) return` | Boolean check, never throws, zero unhandled rejections |

### Implementation Plan

#### 1. Store `AbortController` per session (`sessions.ts`)

```typescript
interface ActiveSession {
  // ... existing fields
  controller: AbortController;
}
```

`cancelSession()` calls `session.controller.abort("session_stale")` instead of (or in addition to) setting `isComplete`.

#### 2. Combine signals in router (`router.ts`)

```typescript
return streamSSE(c, async (stream) => {
  const clientSignal = c.req.raw.signal;
  await streamReviewToSSE(aiClient, options, stream, clientSignal);
});
```

#### 3. In `streamReviewToSSE`, combine client + session signals (`service.ts`)

```typescript
const session = createSession(reviewId, ...);
const signal = clientSignal
  ? AbortSignal.any([session.controller.signal, clientSignal])
  : session.controller.signal;
```

#### 4. `emit` uses boolean check (safe for fire-and-forget) (`service.ts`)

```typescript
const emit: EmitFn = async (event) => {
  if (signal.aborted) return;  // never throws
  addEvent(reviewId, event);
  await writeStreamEvent(stream, event);
};
```

#### 5. Pass signal through pipeline (`orchestrate.ts`, `analysis.ts`, `enrichment.ts`)

Add optional `signal?: AbortSignal` parameter to:
- `orchestrateReview()`
- `runWithConcurrency()` — check `signal.aborted` in `launchNext()` before launching new workers
- `runLensAnalysis()` — check at file loop boundaries (line 61)
- `enrichIssues()` — check before starting per-issue enrichment
- Pass to AI client's `generateObject({ abortSignal: signal })`

#### 6. Checkpoint locations (5 key places)

1. `service.ts` emit function: `if (signal.aborted) return` (every emit)
2. `orchestrate.ts` `launchNext()`: don't start new workers if aborted
3. `analysis.ts` file loop: `if (signal.aborted) break` before each file
4. `analysis.ts` progress timer: `if (signal.aborted) { clearInterval(...); return; }`
5. `enrichment.ts` enrichment loop: check before starting enrichment

#### 7. Top-level catch handles `AbortError` (`service.ts`)

```typescript
} catch (error) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return;  // clean exit on cancellation
  }
  // ... handle ReviewAbort, other errors as before
}
```

#### 8. Remove dead code

- Delete `SessionCancelled` class
- Delete `assertSessionActive` function
- Remove `instanceof SessionCancelled` checks from catch blocks

### What this solves

- **Crash bug**: Fire-and-forget callbacks use `if (signal.aborted) return` — no throws, no unhandled rejections
- **Wasted compute**: Workers in `runWithConcurrency` check signal before launching, AI calls get aborted mid-flight
- **Client disconnect**: Hono's `c.req.raw.signal` auto-cancels when client disconnects
- **Composability**: `AbortSignal.any()` combines client disconnect + manual cancel + potential timeout
- **Consistency**: Same pattern used end-to-end (web → api → core → server → AI client)

---

## IMPLEMENTATION PRIORITY ORDER

1. **C-1**: Remove `console.log("xd")` (trivial, do first)
2. **CANCEL**: Replace `SessionCancelled` with `AbortSignal` (solves H-1, H-3, L-2 and the original crash)
3. **H-2**: Emit terminal event on race condition (UI stuck in loading)
4. **H-4**: Fix stale reviewId dispatch in resume path (URL flicker)
5. **M-1**: Align `cancelSession` TTL with `markComplete` (semantic accuracy)
6. **M-2**: Handle `STREAM_ERROR` as potential stale session in web hook
7. **M-3**: Centralize error code constants in schemas package
8. **L-1**: `Promise.all` for parallel git calls
9. **L-3**: `.gitignore` for cli context files
