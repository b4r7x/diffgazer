# Endpoint Migration Plan

> **Note**: This migration plan may be obsolete. The endpoints described here (sessions, triage, etc.) have been migrated and consolidated under `features/review/`. The deprecated features (sessions, triage) have been removed. Consider deleting this file.

This plan migrates deprecated server endpoints into the current `apps/server/src` layout, using Hono best practices and the required structure.

## Target Structure

```
src/
  app.ts                  # creates Hono() + global middleware
  routes.ts               # mounts feature routers via app.route(...)
  features/
    <feature>/
      router.ts           # export default new Hono()...
      service.ts
      repo.ts             # DB/storage access
      schemas.ts          # DTO validation
      types.ts
  shared/
    middlewares/
    lib/
    utils/
```

## Endpoint Mapping

All routes keep the current `/api/*` prefix (existing CORS + routing conventions), except `/health` which also remains available without `/api`.

- `GET /health` → `features/health/router.ts` (no change)
- `GET /git/status` → `features/git/router.ts`
- `GET /git/diff` → `features/git/router.ts`
- `GET /config/check` → `features/config/router.ts`
- `GET /config` → `features/config/router.ts`
- `POST /config` → existing `features/config/router.ts`
- `DELETE /config` → `features/config/router.ts`
- `GET /config/providers` → existing `features/config/router.ts`
- `DELETE /config/provider/:providerId` → existing `features/config/router.ts`
- `GET /settings` → existing `features/settings/router.ts`
- `POST /settings` → existing `features/settings/router.ts`
- `GET /settings/trust` → `features/settings/router.ts`
- `GET /settings/trust/list` → `features/settings/router.ts`
- `POST /settings/trust` → `features/settings/router.ts`
- `DELETE /settings/trust` → `features/settings/router.ts`
- `GET /sessions` → `features/sessions/router.ts`
- `POST /sessions` → `features/sessions/router.ts`
- `GET /sessions/:id` → `features/sessions/router.ts`
- `DELETE /sessions/:id` → `features/sessions/router.ts`
- `POST /sessions/:id/chat` → `features/sessions/router.ts` (SSE)
- `GET /triage/stream` → `features/triage/router.ts` (SSE)
- `GET /triage/reviews` → `features/triage/router.ts`
- `GET /triage/reviews/:id` → `features/triage/router.ts`
- `DELETE /triage/reviews/:id` → `features/triage/router.ts`
- `POST /triage/reviews/:id/drilldown` → `features/triage/router.ts`
- `POST /pr-review` → `features/pr-review/router.ts`
- `GET /review/stream` (legacy) → `features/review/router.ts` (SSE)

## Shared Modules to Add (migrated from deprecated server)

All shared logic is placed under `src/shared` to match the required structure.

- `shared/lib/validation.ts` (UUID, path validation, error → status mapping)
- `shared/lib/sse-helpers.ts` (SSE event helpers)
- `shared/utils/sanitization.ts` (XML escaping, unicode sanitization)
- `shared/lib/ai/` (AI client + provider integration)
- `shared/lib/ai-client.ts` (initialize AI client from config-store)
- `shared/lib/diff/` (diff parsing + filtering)
- `shared/lib/review/` (triage logic, lenses, profiles, drilldown)
- `shared/lib/storage/` (sessions, triage storage, review storage, active sessions)
- `shared/services/git.ts` (git status/diff/blame/commit helpers)

## Config Store Extensions

Extend `shared/lib/config-store` to support trust endpoints:

- `getTrust(projectId)`
- `listTrustedProjects()`
- `saveTrust(trustConfig)`
- `removeTrust(projectId)`

Persist in the existing `trust.json` path.

## Feature Implementations

Each feature follows the `router/service/repo/schemas/types` pattern:

- `features/git/` → git status + diff
- `features/sessions/` → session CRUD + chat SSE
- `features/triage/` → triage stream + reviews + drilldown
- `features/pr-review/` → PR review JSON response
- `features/review/` → legacy review stream
- `features/config/` → add check/get/delete routes
- `features/settings/` → add trust routes
- `features/reviews/` + `features/health/` unchanged

## Routing

Register new routers in `src/routes.ts`:

- `/api/git`
- `/api/sessions`
- `/api/triage`
- `/api/pr-review`
- `/api/review`

Keep existing `/health` and `/api/health`.

## Client + Docs

- Update `packages/api` with new endpoints and types.
- Update `docs/api-routes.md` with new routes and SSE event shapes.

## Constraints

- Preserve API behavior (no semantic changes).
- DRY, KISS, SRP, YAGNI.
- ESM imports with `.js` extensions.
