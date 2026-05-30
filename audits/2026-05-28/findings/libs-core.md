# libs/core — Audit Findings (2026-05-28)

Package: `@diffgazer/core`

## Summary

| Severity | Count | Statuses |
| --- | --- | --- |
| Critical | 0 | — |
| High | 0 | — |
| Medium | 1 | NEW: 1 |
| Low | 8 | NEW: 8 |
| **Total** | **9** | NEW: 9 |

### By category

| Category | Count |
| --- | --- |
| dead-code | 2 |
| dry | 2 |
| type-safety | 2 |
| kiss | 1 |
| srp | 1 |
| big-file-split | 1 |

---

## Medium

### [NEW] [type-safety] Type assertion without proper narrowing in API client parse function

- **File:** `libs/core/src/api/client.ts:37`
- **What:** Function `parse<T>()` returns `body as T` without validation. The body is unconstrained and could be any shape; the `as T` assertion bypasses type safety entirely.
- **Why:** Casting an unconstrained `body` straight to `T` defeats the type system. Any malformed or unexpected API response is silently treated as valid `T`, pushing runtime shape errors downstream to call sites that trust the type.
- **How:** Replace `return body as T;` with a validation step. Create a `SafeApiResult<T>` discriminated union or require callers to provide a Zod schema/type guard when calling `parse<T>()`. At minimum, add a TODO enforcing caller responsibility and document the contract clearly in JSDoc.
- **Effort:** Medium

---

## Low

### [NEW] [dead-code] formatTimestampLocale function defined but not exported

- **File:** `libs/core/src/format.ts:25-27`
- **What:** The internal function `formatTimestampLocale` (line 25) is defined but never used within the same file or exported, making it dead code.
- **Why:** A module-scope helper that is neither exported nor reused signals an accidental export or a refactoring remnant. It adds surface area and reader overhead without earning its keep.
- **How:** Check if `formatTimestampLocale` should be exported as a public utility. If not used outside the module and only needed by `formatTimestampOrNA`, inline it or remove it. Current state: defined at module scope but only used once inside `formatTimestampOrNA` — this is a code smell for accidental export or refactoring remnant.
- **Effort:** Low

### [NEW] [dead-code] Unused private function in format.ts not exported

- **File:** `libs/core/src/format.ts:25-26`
- **What:** The function `formatTimestampLocale` is defined but not exported. It is only used internally by `formatTimestampOrNA`. The function is private and reused only once (3rd-occurrence rule does not apply).
- **Why:** A single-use private helper that is never reused adds an indirection layer without benefit; the rule-of-three for extraction does not apply at one call site.
- **How:** Inline the `formatTimestampLocale` function body directly into the `formatTimestampOrNA` implementation, removing the separate function definition entirely.
- **Effort:** Low

### [NEW] [dry] Duplicate figlet loading logic across libs/core and libs/ui without shared implementation

- **File:** `libs/core/src/get-figlet.ts:1-22`
- **What:** The `getFigletText` function in libs/core is intentionally duplicated in libs/ui/registry/ui/logo/get-figlet-text.ts with slightly different implementations. The core version uses synchronous `figlet.textSync()` while the ui version uses async dynamic imports. This violates DRY for the figlet dependency pattern.
- **Why:** Two divergent implementations of the same banner-rendering concept risk drifting apart over time, and the divergence is documented only via a `@see` reference rather than an explicit rationale a reader can act on.
- **How:** Document why the implementations differ (e.g., sync in core for CLI, async in ui for browser). Consider extracting a shared helper for font initialization if the pattern is reused elsewhere, or document the intentional divergence clearly with a rationale in the comment (not just a `@see` reference).
- **Effort:** Low

### [NEW] [dry] Potential reusability issue: duplicate figlet text generation between libs/core and libs/ui

- **File:** `libs/core/src/get-figlet.ts:1-10`
- **What:** Function `getFigletText()` in libs/core/src/get-figlet.ts is intentionally duplicated in libs/ui/registry/ui/logo/get-figlet-text.ts (per comment at top of file). Both render ASCII art banners.
- **Why:** The duplication is intentional but the reason (circular-dependency avoidance, bundling constraints, or copy-mode isolation) is not recorded, so a future maintainer cannot tell whether consolidation is safe.
- **How:** Document in libs/core/src/get-figlet.ts the reason for duplication: whether it's to avoid circular deps, support bundling, or copy-mode isolation. If intentional, add a sync reminder. If not, refactor to a single source (e.g., move to a shared utilities module).
- **Effort:** Low

### [NEW] [kiss] Oversized hook composition return type in useReviewLifecycleBase

- **File:** `libs/core/src/api/hooks/use-review-lifecycle-base.ts:23-44`
- **What:** `UseReviewLifecycleBaseResult` interface returns 13 properties mixed across concerns: stream control (stop/abort/cancel), stream state, error checks, completion delays, and start tracking. No grouping by concern.
- **Why:** A flat 13-property return mixing five concerns raises cognitive load at every call site; readers must scan unrelated fields to find the ones they need, and the grouping that exists conceptually is invisible in the type.
- **How:** Group related properties into sub-objects: `{ stream: { stop, abort, cancel, state, error, isStreaming }, checks: { isNoDiffError, isCheckingForChanges, loadingMessage }, completion: { isCompleting, skipDelay, resetCompletion }, start: { hasStarted, hasStreamed, setHasStarted, setHasStreamed } }`. Reduces cognitive load at call sites.
- **Effort:** Low

### [NEW] [srp] Large reducer switch statement mixing multiple event types without clear separation

- **File:** `libs/core/src/review/review-state.ts:269-326`
- **What:** Function `reviewReducer()` contains a 60-line switch that handles 5 high-level action types (START, EVENT, COMPLETE, COMPLETE_WITH_RESULT, ERROR, RESET). The EVENT case contains nested conditionals for 10+ event sub-types (step, file, enrich, tool, agent, etc). Logic is scattered across helper functions (handleStepEvent, handleFileEvent, etc) making flow hard to follow.
- **Why:** Mixing top-level action dispatch with deep event sub-type routing in one switch blurs two responsibilities. The reducer becomes hard to follow because action-level and event-level concerns interleave, and the relationship to the existing per-event helpers is implicit.
- **How:** Extract event type dispatch into a dedicated `dispatchEvent()` function that routes events to handlers. Keep the reducer focused on action types (START, COMPLETE, etc). The current helper functions are good; make the relationship explicit.
- **Effort:** Low

### [NEW] [type-safety] Missing discriminant narrowing in isStepEvent type guard

- **File:** `libs/core/src/schemas/events/step.ts` (line: unknown)
- **What:** Type guards using `typeof (event as { type: unknown }).type === "string"` pattern cast unknown to a partially-typed intermediate. More robust patterns exist.
- **Why:** Casting `unknown` to a partial `{ type: unknown }` shape inside the guard couples shape checking and narrowing in one ad-hoc expression, which is easy to get subtly wrong and is repeated across guards.
- **How:** Define a helper: `function isEventWithType(event: unknown, type: string): event is { type: string } { return typeof (event as any)?.type === 'string' && (event as any).type === type; }`. This separates shape checking from type narrowing.
- **Effort:** Low

### [NEW] [big-file-split] Large constant data structure in schemas/config/providers.ts lacks modularity

- **File:** `libs/core/src/schemas/config/providers.ts:1-358`
- **What:** File is 358 lines and mixes model definitions (GEMINI_MODELS, GLM_MODELS, OpenRouter schemas), provider info constants (AVAILABLE_PROVIDERS, PROVIDER_CAPABILITIES, PROVIDER_ENV_VARS), and Zod schemas for config validation. No separation.
- **Why:** Bundling model lists, provider capability constants, and Zod config schemas in one 358-line file conflates three distinct concerns, making the file harder to navigate and any one concern harder to evolve in isolation.
- **How:** Split into: `models.ts` (model lists, GEMINI_MODELS, GLM_MODELS, OpenRouterModel*), `capabilities.ts` (PROVIDER_CAPABILITIES, PROVIDER_ENV_VARS, AVAILABLE_PROVIDERS), `schemas.ts` (Zod: Provider*, UserConfig, SaveConfigRequest, etc). Keep only provider config schema in this file.
- **Effort:** Medium
