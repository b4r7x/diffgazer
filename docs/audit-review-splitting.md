# Audit: File Splitting for `apps/server/src/features/review/`

## Current State

| File | Lines | Primary Responsibility |
|------|-------|----------------------|
| `service.ts` | 476 | Review orchestration pipeline + SSE streaming |
| `router.ts` | 363 | Hono HTTP routes (7 endpoints) |
| `context.ts` | 308 | Project context snapshot builder |
| `drilldown.ts` | 210 | Issue drilldown analysis |
| `sessions.ts` | 138 | In-memory session store |
| `enrichment.ts` | 103 | Issue enrichment (blame/context) |
| `schemas.ts` | 44 | Zod validation schemas |

Other feature folders in the project follow `router.ts + schemas.ts + service.ts`. The review feature is the most complex and has grown organically.

## Proposed Changes

### 1. Create `types.ts` — consolidate exported types

Move all **exported** types/interfaces from feature files into a single `types.ts`. Private types stay in their files.

| Type | Current Location | Shared? |
|------|-----------------|---------|
| `StreamReviewParams` | `service.ts:383` | Yes (router imports) |
| `ActiveSession` | `sessions.ts:4` | Yes (service + router import) |
| `DrilldownError` | `drilldown.ts:23` | Yes (exported) |
| `HandleDrilldownError` | `drilldown.ts:166` | Yes (exported) |
| `DrilldownOptions` | `drilldown.ts:84` | No — keep in drilldown.ts |
| `EnrichGitService` | `enrichment.ts:6` | No — keep in enrichment.ts (only used there) |
| `WorkspacePackage` | `context.ts:24` | No — keep in context.ts (only used there) |
| `EmitFn` | `service.ts:137` | Move to types — used by pipeline.ts and service.ts after split |
| `ResolvedConfig` | `service.ts:194` | Move to types — used by pipeline.ts and service.ts after split |
| `ReviewOutcome` | `service.ts:225` | Move to types — used by pipeline.ts and service.ts after split |

**Rule:** Only move types that are (a) already exported, or (b) will be shared across files after the split. Private single-file types stay where they are.

### 2. Move `DrilldownResponseSchema` to `schemas.ts`

`drilldown.ts:27-35` defines `DrilldownResponseSchema` — a Zod schema that belongs with the other schemas. Also move the inferred type `DrilldownResponse` (line 37) since it derives from the schema.

After this move, `schemas.ts` becomes the single source of truth for all Zod schemas in this feature.

### 3. Create `utils.ts` — extract router helpers and pure utility functions

**From `router.ts`** (these are request/response helpers, not route handlers):
- `parseProjectPath` (lines 42-75) — validates `projectPath` query param
- `errorCodeToStatus` (lines 77-88) — maps `StoreErrorCode` to HTTP status
- `handleStoreError` (lines 90-93) — wraps store errors into HTTP responses

**From `drilldown.ts`** (generic utilities, not drilldown-specific):
- `summarizeOutput` (lines 39-63) — formats any value as a short string
- `recordTrace` (lines 65-82) — generic trace recording helper

This brings `router.ts` down to ~320 lines (pure route definitions) and `drilldown.ts` down to ~165 lines.

### 4. Split `service.ts` into `service.ts` + `pipeline.ts`

This is the biggest change. `service.ts` currently has 5 concerns:

**Move to `pipeline.ts` (~260 lines):**
- Constants: `MAX_DIFF_SIZE_BYTES`, `MAX_AGENT_CONCURRENCY`
- `ReviewAbort` class (lines 129-135)
- Report generation: `generateExecutiveSummary`, `generateReport` (lines 64-94)
- Diff filtering: `filterDiffByFiles` (lines 98-121)
- Pipeline steps: `resolveGitDiff`, `resolveReviewConfig`, `executeReview`, `finalizeReview` (lines 139-323)

**Keep in `service.ts` (~200 lines):**
- SSE helpers: `stepStart`, `stepComplete`, `stepError`, `writeStreamEvent` (lines 43-60)
- Session replay: `streamActiveSessionToSSE`, `tryReplayExistingSession` (lines 327-379)
- Main orchestrator: `streamReviewToSSE` (lines 391-476)
- `StreamReviewParams` type moves to `types.ts`

**Dependency flow:** `service.ts` → imports from `pipeline.ts`. `router.ts` → imports from `service.ts` only. No circular dependencies.

### 5. No changes to these files

| File | Reason |
|------|--------|
| `context.ts` (308 lines) | Single pipeline: discover workspace → build file tree → assemble markdown → persist. All private functions serve `buildProjectContextSnapshot`. Would become too small if split. |
| `sessions.ts` (138 lines) | Perfect single concern: in-memory session CRUD + pub/sub |
| `enrichment.ts` (103 lines) | Perfect single concern: issue enrichment |

## Resulting File Structure

```
apps/server/src/features/review/
  types.ts        (~40 lines)  — shared types/interfaces
  schemas.ts      (~55 lines)  — all Zod schemas (including DrilldownResponseSchema)
  utils.ts        (~90 lines)  — pure helpers (parseProjectPath, summarizeOutput, recordTrace, etc.)
  pipeline.ts     (~260 lines) — review pipeline steps (diff, config, review, finalize)
  service.ts      (~200 lines) — SSE orchestration + session replay
  router.ts       (~320 lines) — Hono route definitions only
  context.ts      (308 lines)  — unchanged
  sessions.ts     (138 lines)  — unchanged
  enrichment.ts   (103 lines)  — unchanged
  drilldown.ts    (~165 lines) — drilldown logic only (schema + utils moved out)
```

## Dependency Graph (after refactor)

```
router.ts
  ├── schemas.ts
  ├── utils.ts (parseProjectPath, handleStoreError, errorCodeToStatus)
  ├── types.ts
  ├── service.ts (streamReviewToSSE, streamActiveSessionToSSE)
  ├── context.ts (buildProjectContextSnapshot, loadContextSnapshot)
  ├── drilldown.ts (handleDrilldownRequest)
  └── sessions.ts (getSession, cancelSession)

service.ts
  ├── types.ts (EmitFn, ResolvedConfig, ReviewOutcome, StreamReviewParams)
  ├── pipeline.ts (resolveGitDiff, resolveReviewConfig, executeReview, finalizeReview, ReviewAbort)
  ├── sessions.ts
  ├── context.ts (buildProjectContextSnapshot)
  └── enrichment.ts

pipeline.ts
  ├── types.ts (EmitFn, ResolvedConfig, ReviewOutcome)
  └── schemas.ts (if DrilldownResponseSchema is needed — likely not)

drilldown.ts
  ├── schemas.ts (DrilldownResponseSchema)
  ├── utils.ts (summarizeOutput, recordTrace)
  └── types.ts (DrilldownError, HandleDrilldownError)
```

No circular dependencies. All arrows point "down" in the dependency graph.

## Implementation Notes

- Project uses ESM with `.js` extensions in imports (e.g., `import { foo } from "./types.js"`)
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- Keep `export type` for types in `types.ts`
- `ReviewAbort` is a class (not an Error subclass) — moves to `pipeline.ts` as it's caught only by the pipeline orchestrator
- SSE helpers (`stepStart`, `stepComplete`, `stepError`) stay in `service.ts` because they are used by the orchestrator's `emit` wrapper, not by pipeline steps directly
