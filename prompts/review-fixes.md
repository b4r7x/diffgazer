# Diffgazer: Prompt For Empty-Context Agent (Audit + Fixes)

Date: 2026-02-05
Workspace: `/Users/voitz/Projects/diffgazer`

## 1. Role And Mode
You are a coding agent working in this monorepo with **empty context**. Your task is to implement targeted fixes based on the current working-tree changes. Prioritize correctness, maintainability, and consistency with existing project patterns.

Use these standards while implementing:
- Hono guidance and best practices: [hono.dev/docs/guides/best-practices](https://hono.dev/docs/guides/best-practices)
- `hono`, `hono-core`, `hono-routing`, `hono-typescript`
- `typescript`
- `code-simplifier`
- `react-patterns`

## 2. Hard Constraints (Owner Preferences)
- Keep backend shared utilities in `/Users/voitz/Projects/diffgazer/apps/server/src/shared/lib`.
- Avoid overengineering. Prefer explicit, simple code.
- Move things to `/Users/voitz/Projects/diffgazer/packages` **only when truly reused** across web/backend/CLI (types, schemas, shared logic).
- On frontend, avoid unnecessary `useMemo` / `useCallback` / `useEffect`. Use them only when justified.
- Preserve behavior unless fixing a confirmed bug/regression.
- Do not run `git add`, do not commit.

## 3. Current Scope You Must Review/Touch
All current local changes in `git status --short` (server + web + packages + docs), especially:
- `/Users/voitz/Projects/diffgazer/apps/server/src/features/review/*`
- `/Users/voitz/Projects/diffgazer/apps/server/src/features/pr-review/*`
- `/Users/voitz/Projects/diffgazer/apps/server/src/features/diff-review/*`
- `/Users/voitz/Projects/diffgazer/apps/server/src/shared/lib/*`
- `/Users/voitz/Projects/diffgazer/apps/web/src/features/review/*`
- `/Users/voitz/Projects/diffgazer/apps/web/src/features/providers/components/model-select-dialog/*`
- `/Users/voitz/Projects/diffgazer/packages/api/*`
- `/Users/voitz/Projects/diffgazer/packages/core/*`
- `/Users/voitz/Projects/diffgazer/packages/schemas/*`
- `/Users/voitz/Projects/diffgazer/docs/api-routes.md`

## 4. Verified Findings (Fix In Priority Order)

### P1-1: Resume stream contract is internally inconsistent
Evidence:
- `/Users/voitz/Projects/diffgazer/packages/api/src/review.ts:81` calls `/api/review/${reviewId}/stream`
- `/Users/voitz/Projects/diffgazer/apps/web/src/features/review/hooks/use-review-stream.ts:152` uses `resumeReviewStream`
- `/Users/voitz/Projects/diffgazer/apps/server/src/features/review/router.ts` has no `/reviews/:id/stream` or `/:id/stream` route (only `/stream`, `/context`, `/reviews/*`)
- `/Users/voitz/Projects/diffgazer/apps/web/src/app/routes/review.tsx:340` now pre-checks by `api.getReview(reviewId)` only

Impact:
- Deep-linking to in-progress review sessions is effectively broken (404 path or forced fallback).

Required fix:
- Unify resume strategy end-to-end. Pick one design and apply consistently:
1) restore explicit server resume endpoint(s), or
2) remove resume-by-id API and reconnect through `/api/review/stream` with deterministic mode/session matching.

### P1-2: Missing strict input validation for lens/profile query/body values
Evidence:
- `/Users/voitz/Projects/diffgazer/apps/server/src/features/review/router.ts:294-306` casts query to `ReviewMode`/`ProfileId`/`LensId[]` without schema validation
- `/Users/voitz/Projects/diffgazer/apps/server/src/features/pr-review/schemas.ts:5-6` accepts plain `string[]` / `string`
- `/Users/voitz/Projects/diffgazer/apps/server/src/features/pr-review/router.ts:962-968` casts to `ProfileId` / `LensId[]`
- `/Users/voitz/Projects/diffgazer/apps/server/src/features/review/service.ts:1250-1261` assumes valid lenses and dereferences `lens.id`

Impact:
- Invalid external input can crash/500 in runtime instead of returning 400.

Required fix:
- Add `zValidator("query", ...)` for review stream params.
- Strengthen PR review body schema to enum-constrained lens/profile IDs.
- Return clean 400 validation errors.

### P1-3: Model dialog reset effect can use stale model list
Evidence:
- `/Users/voitz/Projects/diffgazer/apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.tsx:148-159`

Impact:
- Selection can initialize against outdated/empty model list when OpenRouter models load asynchronously.

Required fix:
- Split reset logic and selection logic, or add proper dependencies (`models`, `resetFilters`) with guards to avoid bad resets.

### P2-1: API docs are out of sync with real server routes
Evidence:
- `/Users/voitz/Projects/diffgazer/docs/api-routes.md:618-758` still documents `/api/reviews/*` and status/stream endpoints that are gone.

Required fix:
- Update docs to current routes and payloads (`/api/review/reviews`, `/api/review/context`, `/api/review/context/refresh`, drilldown, stream query params).

### P2-2: Backend review logic is duplicated and too inlined
Evidence:
- `/Users/voitz/Projects/diffgazer/apps/server/src/features/review/service.ts:240+`
- `/Users/voitz/Projects/diffgazer/apps/server/src/features/pr-review/router.ts:40+`

Impact:
- Drift risk and hard maintenance.

Required fix:
- Extract shared lens/profile/orchestration pieces into reusable modules under `/Users/voitz/Projects/diffgazer/apps/server/src/shared/lib/review/*`.
- Keep router files thin (routing/validation only), move heavy orchestration to service modules.

### P2-3: Frontend has avoidable complexity (code-simplifier/react-patterns)
Evidence:
- `/Users/voitz/Projects/diffgazer/apps/web/src/features/review/components/review-progress-view.tsx:76-107` (static memoized constants)
- `/Users/voitz/Projects/diffgazer/apps/web/src/app/routes/settings/diagnostics.tsx:40-97` (unnecessary memo/callback + duplicated download helper)
- `/Users/voitz/Projects/diffgazer/apps/web/src/features/review/components/review-container.tsx:54-61` (nested ternary in substep detail)
- `/Users/voitz/Projects/diffgazer/apps/web/src/app/routes/history.tsx:139-164` (cheap derived data wrapped in memo)

Required fix:
- Remove unnecessary memoization.
- Replace nested ternary with explicit `if/else` or helper function.
- Extract shared context-download helper if reused in more than one place.

### P2-4: API surface drift and dead code in packages
Evidence:
- `/Users/voitz/Projects/diffgazer/packages/api/src/types.ts` contains overlapping/legacy review type shapes (`ReviewHistoryMetadata`, `TriageReviewMetadata`, `ReviewMetadata` aliasing).
- `/Users/voitz/Projects/diffgazer/packages/api/src/diff-review.ts` exists but is not exported from `/Users/voitz/Projects/diffgazer/packages/api/src/index.ts`.

Required fix:
- Consolidate exported review contracts to one canonical shape.
- Either export and use diff-review API intentionally, or delete dead file.

### P2-5: Generated context artifacts are currently untracked in CLI app tree
Evidence:
- `/Users/voitz/Projects/diffgazer/apps/cli/.diffgazer/context.json`
- `/Users/voitz/Projects/diffgazer/apps/cli/.diffgazer/context.md`
- `/Users/voitz/Projects/diffgazer/apps/cli/.diffgazer/context.meta.json`
- `/Users/voitz/Projects/diffgazer/apps/cli/.diffgazer/context.txt`

Required fix:
- Decide whether these are fixture files or local artifacts.
- If local artifacts: add ignore rules.

### P3-1: Minor error-string formatting issue in diff-review service
Evidence:
- `/Users/voitz/Projects/diffgazer/apps/server/src/features/diff-review/service.ts:96`

Required fix:
- Close human-readable parenthesis in message string for consistency.

## 5. Implementation Order (Do Not Skip)
1. Fix P1-1 and P1-2 first (runtime correctness/contract safety).
2. Fix P1-3 (model selection correctness).
3. Refactor P2-2 with minimal churn and clear module boundaries.
4. Apply P2-3 simplifications in web.
5. Clean contracts/dead code (P2-4), then docs sync (P2-1).
6. Resolve artifact policy (P2-5) and minor cleanup (P3-1).

## 6. Required Architecture Direction
- Backend:
  - Router = request parsing + validation + response wiring.
  - Service = orchestration/business logic.
  - Shared reusable server logic = `/Users/voitz/Projects/diffgazer/apps/server/src/shared/lib`.
- Cross-app reuse:
  - If used by web + cli + server, move to `/Users/voitz/Projects/diffgazer/packages/*`.
  - Do not move prematurely.

## 7. Validation Commands (Run After Changes)
- `pnpm --filter @diffgazer/server build`
- `pnpm --filter @diffgazer/web build`
- `pnpm --filter @diffgazer/schemas build`
- `pnpm --filter @diffgazer/core build`
- `pnpm --filter @diffgazer/api build`

## 8. Output Format Expected From Agent
Return in this exact structure:
1. `Summary` (short paragraph)
2. `Changes` (bullets with absolute file paths)
3. `Validation` (commands + pass/fail)
4. `Risks` (remaining)
5. `Questions for owner` (only unresolved decisions)

## 9. Decisions Needed From Owner (Ask If Blocked)
1. Should resume-by-`reviewId` be restored explicitly, or should reconnect rely only on `/api/review/stream` dedupe logic?
2. Should `diff-review` remain as separate feature (`/api/diff-review`) or be merged/deprecated now?
3. Should `.diffgazer/context.*` under `apps/cli` be committed fixtures or ignored runtime artifacts?
