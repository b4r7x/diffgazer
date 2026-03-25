# Research: Fix Review Regression & Consolidate Shared Review Hooks

## R1: Resume Return Type

**Decision**: Restore `Result<void, StreamReviewError>` return type on `useReviewStream.resume`.

**Rationale**: The underlying `api.resumeReviewStream()` already returns `Result<void, StreamReviewError>` with specific error codes (`SESSION_STALE`, `SESSION_NOT_FOUND`). The current hook discards this structured error information and silently dispatches `RESET`, leaving callers unable to distinguish between error types that require fundamentally different UX flows (stale = start fresh, not-found = load saved or navigate away).

**Alternatives considered**:
- **Callback-based error reporting** (`onStale`, `onNotFound`): Works but couples the stream hook to specific error handling strategies. The Result type is more flexible and matches the project's ADR-0001 convention.
- **Error state field** (expose `state.lastErrorCode`): Requires callers to observe state changes in effects rather than responding to the resume call directly. More indirect and harder to reason about.

**Implementation detail**: For `SESSION_STALE` and `SESSION_NOT_FOUND`, the hook should NOT dispatch `RESET` or `ERROR` internally -- it should return the Result and let the caller decide. For other errors, dispatch `ERROR` internally AND return the Result. This matches the pre-013 web behavior exactly.

---

## R2: CLI Start() Bug Fix Strategy

**Decision**: Make `start()` an imperative function that directly triggers the stream, rather than relying on mode state changes to re-fire an effect.

**Rationale**: The current architecture has `start()` call `setMode(mode)` which triggers a `useReviewStart` effect via the dependency array. When mode doesn't change (default "staged" to requested "staged"), React treats `setMode("staged")` as a no-op -- no re-render, no effect re-fire, review hangs. Adding a counter/token state to force re-renders is a workaround that adds complexity to compensate for an inherently fragile architecture.

**Alternatives considered**:
- **startToken counter** (`useState(0)` incremented on each `start()` call): Works but is indirect -- the counter has no semantic meaning, it exists solely to force re-renders.
- **useReducer with START action**: Cleaner semantically but overcomplicates what should be a simple imperative call.

**Implementation approach**: `useReviewStart` should expose a `startReview()` function that the lifecycle calls directly (imperative), rather than running an auto-start effect. The auto-start-on-mount behavior can be a separate concern (a one-time mount effect in the lifecycle hook that calls `startReview()`).

---

## R3: hasStreamed Stale Read Fix

**Decision**: Convert `hasStreamed` from a ref to state (`useState`).

**Rationale**: `hasStreamedRef.current` is read during render (line 71 of CLI lifecycle) and passed as a plain boolean to `useReviewCompletion`. Because ref mutations don't trigger re-renders, the completion hook can receive stale `false` values after the ref has been set to `true` inside an effect. Converting to state ensures React propagates the value through renders.

**Alternatives considered**:
- **Pass the ref object** to completion hook (read `.current` inside the effect): Works but violates the convention of passing primitive values to hooks and makes the API harder to understand.
- **Derive from stream state** (`isStreaming` has been `true` at least once): Would work but requires tracking in the stream reducer, which is more invasive.

---

## R4: React Compiler Status

**Decision**: React Compiler is NOT active. Manual referential stability is required for all function references in effect dependency arrays.

**Rationale**: Confirmed by searching the entire repo -- no `babel-plugin-react-compiler`, no `reactCompiler` option in Vite configs, no `.babelrc` files. The CLAUDE.md rule "No manual `useCallback`/`useMemo`" is aspirational, not enforced by tooling.

**Impact**: The `start`, `resume`, `getActiveSession`, and `defaultLenses` values in `useReviewStart`'s dependency array are recreated every render. The `hasStartedRef.current` guard prevents functional issues but the effect still re-runs (and runs cleanup) on every render.

**Mitigation approach**: Use the "ref-based stable callback" pattern: store injected functions in refs, read from refs inside effects, exclude from dependency arrays. This is the standard pattern when React Compiler is not available and `useCallback` is prohibited by convention.

---

## R5: Display Utilities Divergence

**Decision**: Keep `mapStepStatus` as platform-specific (web and CLI have different UI type systems). Extract `isNoDiffError`, `isCheckingForChanges`, and `loadingMessage` derivation as shared pure functions.

**Rationale**: The web uses a 3-value `ProgressStatus` (`"completed" | "active" | "pending"`) from the schemas package, which has no `"error"` variant. The web's `mapStepStatus` mapping `error -> pending` is intentional and tested. The CLI uses a 4-value `UIStepStatus` which preserves error. Forcing unification would require either adding `"error"` to `ProgressStatus` (cascading changes to components, CVA variants, badge mappings) or removing error from CLI display.

**Alternatives considered**:
- **Add "error" to web's ProgressStatus**: Requires changes to `progress-step.tsx` (CVA variants, badge mappings), schema changes, and test updates. Net benefit is marginal -- the web's error-guard logic in `review-container.tsx` catches step errors before they reach the progress display.
- **Parameterize mapStepStatus**: A function like `mapStepStatus(status, { collapseErrorTo: "pending" })` adds complexity for a case that is better served by two distinct 3-line functions.

**What IS shared**: `isNoDiffError`, `isCheckingForChanges`, and `loadingMessage` derivation are copy-pasted identically between apps (only cosmetic string differences). These should be pure functions in `@diffgazer/core/review`.

**What stays per-app**: `mapStepStatus`, `getAgentDetail`/`getSubstepDetail` (different type systems, different truncation/separator choices). The shared `display.ts` is renamed/documented as CLI-specific, and the web keeps its local `review-container.utils.ts`.

---

## R6: Hook Consolidation Architecture

**Decision**: Consolidate `useReviewStart` and `useReviewCompletion` into `@diffgazer/api/hooks`. Keep `useReviewLifecycle` per-app.

**Rationale**: The shared hooks package already contains `useReviewStream` (the streaming core), `useDiagnosticsData` (a composed hook precedent), and all query/mutation hooks. Adding `useReviewStart` and `useReviewCompletion` follows the same pattern: pure behavior hooks with injected dependencies and no platform-specific imports.

**Architecture**:
```
@diffgazer/api/hooks/
  use-review-stream.ts     (existing -- streaming core)
  use-review-start.ts      (NEW -- start/resume orchestration)
  use-review-completion.ts (NEW -- completion detection with callback)

apps/cli/src/features/review/hooks/
  use-review-lifecycle.ts  (STAYS -- CLI orchestration, phase machine, navigation)

apps/web/src/features/review/hooks/
  use-review-lifecycle.ts  (STAYS -- web orchestration, URL sync, reducers)
```

**Interface designs**: See data-model.md for detailed type definitions.
