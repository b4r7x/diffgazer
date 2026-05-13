# Review Start Session Lifecycle SOTA Plan

## Context

Current review startup couples three concerns:

- creating a new review session
- subscribing to a review stream
- routing to a review URL

The current flow can start a review from `/review?mode=unstaged`, receive a `reviewId` from the stream, navigate to `/review/{reviewId}`, and then accidentally treat that same ID as an external resume target. That can trigger a second stream subscription and abort the first one.

Target model:

- creating a review is an explicit mutation
- `/review/{reviewId}` is the canonical URL before streaming begins
- the stream endpoint subscribes to an existing review only
- saved review loading and live review streaming are distinct states

## Goal

Implement a clean create-then-stream lifecycle:

1. User starts review.
2. Frontend sends a create-review request.
3. Backend creates a review session and returns `reviewId`.
4. Frontend navigates to `/review/{reviewId}?mode=...`.
5. Route `/review/{reviewId}` subscribes to that review stream.
6. Refreshing or deep-linking `/review/{reviewId}` resumes/subscribes or loads saved results according to review state.

## Non-Goals

- Do not use `window.history.replaceState` as a workaround.
- Do not rely on unconditional diagnostic `console.log` in final code.
- Do not preserve legacy aliases unless a test proves they are needed.
- Do not change unrelated history/focus behavior in this pass.

## Architecture Decision

Use a command/query split:

- `POST /api/review/reviews` creates the review session and returns `reviewId`.
- `GET /api/review/reviews/:reviewId/stream` streams an existing review session.
- `GET /api/review/reviews/:reviewId` loads a completed saved review result.

This matches React and TanStack guidance:

- React effects should synchronize with an external system and have symmetric cleanup. They should not hide one-time user commands when a direct event/mutation can express the action.
- TanStack Router should react to URL state, not own long-lived mutation state.
- TanStack Query-style mutations are the right shape for create/update/delete server effects.

## Phase 1: Backend Session Creation

Add endpoint:

```http
POST /api/review/reviews
```

Request:

```ts
{
  mode: "staged" | "unstaged";
  lenses?: LensId[];
  profile?: ProfileId;
  files?: string[];
}
```

Response:

```ts
{
  reviewId: string;
}
```

Implementation requirements:

- Reuse the same project-root, trust, config, provider, and diff validation currently used before streaming.
- Extract session creation from the existing stream-start path into a shared service, for example `createReviewSession(...)`.
- Store enough session metadata for `GET /api/review/reviews/:reviewId/stream` to continue without reconstructing request context from query params.
- Return structured API errors consistent with existing review errors.
- Do not start long-running AI analysis in this endpoint unless the existing architecture requires a worker/session record to be initialized synchronously. The important contract is that creation returns quickly with `reviewId`.

Backend tests:

- `POST /api/review/reviews` returns a UUID-like `reviewId`.
- It records mode, lenses, profile, files, project root, status hash/head metadata as needed.
- Missing trust/config/provider/diff cases preserve existing behavior.
- The endpoint does not stream SSE.

## Phase 2: Stream Existing Sessions Only

Use:

```http
GET /api/review/reviews/:reviewId/stream
```

Contract:

- It never creates a new review ID.
- It subscribes to or starts processing the existing session for `reviewId`.
- `404` means `SESSION_NOT_FOUND`.
- `409` means `SESSION_STALE`.
- Completed sessions should have one clear behavior:
  - either stream a final `complete` event, or
  - return a typed stale/completed response and let the frontend use `GET /reviews/:id`.

Pick one behavior and cover it with tests.

Migration:

- Prefer removing `GET /api/review/stream?mode=...` before public release.
- If temporarily retained, implement it as a thin compatibility wrapper around create + stream, and mark it internal in tests/comments only if necessary.

Backend tests:

- Streaming an existing session emits `review_started` with the existing ID.
- Streaming a missing session returns `SESSION_NOT_FOUND`.
- Streaming a stale session returns `SESSION_STALE`.
- The endpoint does not create a second session for the same request.

## Phase 3: Core API Client

In `libs/core/src/api/review.ts`, add:

```ts
export interface CreateReviewOptions {
  mode: ReviewMode;
  lenses?: LensId[];
  profile?: ProfileId;
  files?: string[];
}

export interface CreateReviewResponse {
  reviewId: string;
}

export async function createReview(
  client: ApiClient,
  options: CreateReviewOptions,
): Promise<CreateReviewResponse> {
  return client.post<CreateReviewResponse>("/api/review/reviews", options);
}
```

Add to `bindReview`:

```ts
createReview: (options: CreateReviewOptions) => createReview(client, options),
```

Core API tests:

- `createReview` posts to `/api/review/reviews` with the expected body.
- Existing `resumeReviewStream` tests still pass.
- No `.js` import specifier issues are introduced.

## Phase 4: Core Hooks

Refactor startup around explicit create.

Target responsibilities:

- `useReviewStart` decides whether to create or resume.
- `useReviewStream` only streams existing sessions.
- `useReviewLifecycleBase` wires create/resume/stream state together.

Suggested `UseReviewStartOptions` shape:

```ts
interface UseReviewStartOptions {
  mode: ReviewMode;
  configLoading: boolean;
  settingsLoading: boolean;
  isConfigured: boolean;
  defaultLenses: LensId[];
  reviewId?: string;
  startToken?: number;
  create: (options: { mode: ReviewMode; lenses?: LensId[] }) => Promise<{ reviewId: string }>;
  resume: (reviewId: string) => Promise<Result<void, StreamReviewError>>;
  getActiveSession: (mode: ReviewMode) => Promise<ActiveReviewSessionResult>;
  onReviewCreated: (reviewId: string) => void;
  onNotFoundInSession?: (reviewId: string) => void;
}
```

Behavior:

- If config/settings are loading or not configured, do nothing.
- If `reviewId` exists, call `resume(reviewId)`.
- If no `reviewId`, optionally check active session:
  - if active session exists, navigate/resume that ID
  - if no active session, call `create(...)`, then `onReviewCreated(reviewId)`
- Do not call stream-start APIs from no-ID route.
- Ensure React StrictMode setup-cleanup-setup does not create two sessions.

Important guard:

- Use an effect-local `ignore` flag or request identity so the first StrictMode probe cannot publish a stale create result.
- Do not use a global `hasStartedGuard` that can block the real second StrictMode effect.

Core hook tests:

- No-ID route calls `create`, not `resume`.
- `create` success calls `onReviewCreated(reviewId)`.
- StrictMode creates exactly one review.
- Route with `reviewId` calls `resume(reviewId)`.
- Stale/not-found resume behavior matches existing product decision.
- Aborted/stale async results do not update state after cleanup.

## Phase 5: Web Review Route Flow

Route without ID:

- `/review?mode=unstaged` should render a creating/loading state.
- It should not render progress for an unknown session.
- After `createReview` returns, navigate:

```ts
navigate({
  to: "/review/{-$reviewId}",
  params: { reviewId },
  search: (prev) => prev,
  replace: true,
});
```

Route with ID:

- `/review/{reviewId}?mode=unstaged` should stream/resume that existing review.
- It should load saved results only when there is no live stream for that ID and the saved review has a result.
- It should not fallback to starting a new review merely because `GET /reviews/:id` returns 404 while the session is live.

Suggested page state:

```ts
type LiveReviewState =
  | { phase: "creating" }
  | { phase: "streaming"; reviewId: string }
  | { phase: "summary"; reviewData: ReviewData }
  | { phase: "results"; reviewData: ReviewData };
```

Web tests:

- `/review?mode=unstaged` shows creating/loading.
- Create success navigates to `/review/{id}?mode=unstaged`.
- No saved review query runs for the live ID before streaming attaches.
- `/review/{id}` resumes/subscribes to stream.
- Completed saved review renders results.
- Missing/stale session behavior is explicit and tested.
- Regression: there is no sequence `create/start -> navigate -> resume same id -> abort active start`.

## Phase 6: Remove Temporary Diagnostics

Before final handoff, remove any temporary logs:

- `[diffgazer:review-stream]`
- `[diffgazer:review-lifecycle]`
- `[diffgazer:review-page]`

Do not leave unconditional `console.log` or `console.warn` in production code.

If persistent diagnostics are desired, add a real dev-only logger in a separate follow-up, not inside this fix.

## Phase 7: Verification

Run focused checks first:

```bash
pnpm --filter @diffgazer/core test -- src/api/review.test.ts src/api/hooks/use-review-start.test.ts src/api/hooks/use-review-stream.test.ts
pnpm --filter @diffgazer/core type-check
pnpm --filter @diffgazer/web test -- src/features/review/components/page.test.tsx
pnpm --filter @diffgazer/web type-check
git diff --check
```

If backend/CLI packages are touched, also run their focused tests:

```bash
pnpm --filter @diffgazer/cli test
```

If package builds are needed for local web runtime:

```bash
pnpm --filter @diffgazer/core build
```

Manual browser verification:

1. Open `http://localhost:3001/review?mode=unstaged`.
2. Confirm the first review request is `POST /api/review/reviews`.
3. Confirm the URL becomes `/review/{id}?mode=unstaged`.
4. Confirm the stream request is `GET /api/review/reviews/{id}/stream`.
5. Confirm no `GET /api/review/stream?mode=...` is used in the new flow.
6. Confirm no `signal is aborted without reason`.
7. Refresh `/review/{id}?mode=unstaged` and confirm it resumes or renders saved result.

## Acceptance Criteria

- New review creation is an explicit POST mutation.
- New review URL contains `reviewId` before streaming begins.
- Stream endpoint only streams existing sessions.
- Refresh and deep link to `/review/{id}` work.
- No accidental second resume cancels the active stream.
- No manual `history.replaceState`.
- No unconditional diagnostic logs remain.
- Focused core and web tests pass.
- `git diff --check` passes.

## Notes For Implementing Agent

- Keep changes scoped to review creation/stream lifecycle.
- Prefer reusing existing review schemas and Result/error types.
- Keep app-specific orchestration in `apps/web`.
- Keep reusable stream/session hooks in `libs/core`.
- Do not introduce broad routing, history, or focus refactors in this task.
- If an existing endpoint already partially creates sessions, extract the session creation logic instead of duplicating it.
