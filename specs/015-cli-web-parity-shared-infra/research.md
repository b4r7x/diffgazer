# Research: 015-cli-web-parity-shared-infra

**Date**: 2026-03-26
**Spec**: [spec.md](./spec.md)

## R1: Root Cause of CLI Home Navigation Bug (HOME-NAV-001)

### Decision: Two independent bugs cause the broken navigation

### Findings

**Bug 1 (Primary) — Stale closure in `TerminalKeyboardProvider.useInput`**
- File: `apps/cli/src/app/providers/keyboard-provider.tsx:115-146`
- `scopeStack` is managed via `useState` (line 49)
- Ink's `useInput` captures the initial render closure — `scopeStack` is always `[]`
- `currentScope` is always `null` at line 121-123
- All scope-registered handlers are permanently unreachable
- Only global handlers (`q`, `s`, `?`) ever fire

**Bug 2 — `useScope` stack accumulation**
- File: `apps/cli/src/hooks/use-scope.ts:10-15`
- Each mount pushes without dedup — navigation cycles leave stale entries
- Combined with Bug 1, this is secondary but creates future issues

**Bug 3 — `HomeMenu` hidden by `TrustPanel` when trust is null**
- File: `apps/cli/src/app/screens/home-screen.tsx:97-101`
- In fresh projects with no trust grants, `needsTrust=true` and `HomeMenu` never renders
- This is intentional product behavior but contributes to "nothing works" perception

**Note**: The `Menu` component itself works correctly — it uses its own `useInput` with `isActive` prop, independent of the keyboard provider. When the menu IS rendered, arrow keys and Enter work. The issue is the combination of: (1) keyboard provider scope routing being dead, and (2) trust gate hiding the menu entirely in fresh projects.

### Fix Direction

1. Replace `useState` for `scopeStack` with `useRef` in keyboard-provider.tsx — `useInput` handler reads `scopeRef.current` (always fresh)
2. Keep a separate `useState`-based `activeScope` for triggering re-renders only
3. Add dedup guard in `pushScope` to prevent stack accumulation
4. Ensure `TrustPanel` has functional keyboard navigation so fresh projects aren't stuck

### Alternatives Considered

- **useCallback with scopeStack dependency**: Rejected — Ink's `useInput` does not refresh its callback after mount
- **useEffectEvent**: Could work but adds complexity; `useRef` is simpler and idiomatic for Ink
- **Remove keyboard provider entirely**: Rejected — scope system is needed for complex multi-zone UIs

---

## R2: Responsive Layout System — Current State and Alignment Plan

### Decision: Create shared breakpoint constants, align both platforms to 3-tier system

### Findings

**CLI current state:**
- Hook: `apps/cli/src/hooks/use-terminal-dimensions.ts`
- Breakpoints: `NARROW_THRESHOLD = 80`, `WIDE_THRESHOLD = 100` columns
- 4 screens use responsive layouts (providers, history, review-results, review-progress)
- Uses Ink's `useStdout()` for terminal dimensions with fallbacks (80x24)

**Web current state:**
- No explicit breakpoint constants in TypeScript
- Tailwind v4 defaults: `sm: 640px, md: 768px, lg: 1024px, xl: 1280px`
- Responsive classes applied ad-hoc: `md:text-[10px]`, `lg:w-80`, `lg:w-1/2`
- No JavaScript-based viewport detection

**Gap:**
- CLI: 80/100 column thresholds
- Web: 640/768/1024px Tailwind breakpoints
- No shared constants, no shared semantic names
- Incompatible approaches (programmatic vs CSS)

### Plan

1. Define shared breakpoint constants in `@diffgazer/core` (platform-agnostic):
   - `narrow`: < 80 columns / < 768px
   - `medium`: 80-119 columns / 768-1023px
   - `wide`: >= 120 columns / >= 1024px
2. CLI: Update `useResponsive()` to use shared constants, add `isMedium` boolean
3. Web: Add `useViewportBreakpoint()` hook using `matchMedia` for JS-level detection alongside Tailwind
4. Customize Tailwind config to align breakpoints with shared constants
5. All screens in both apps must respond to all 3 breakpoints

### Alternatives Considered

- **CSS-only for web**: Rejected — spec requires identical layout logic, need JS detection for parity verification
- **Single threshold (narrow/wide only)**: Rejected — spec defines 3 tiers (< 80, 80-119, >= 120)
- **Breakpoints in packages/hooks**: Rejected — breakpoint values are domain constants, belong in `@diffgazer/core`

---

## R3: Shared Hooks Audit — Duplication and Sharing Opportunities

### Decision: Current shared hooks architecture is healthy, minimal changes needed

### Findings

**Already shared (26 hooks, all properly consumed):**
- 9 query hooks (useSettings, useInit, useProviderStatus, useConfigCheck, useOpenRouterModels, useReviews, useReview, useActiveReviewSession, useReviewContext)
- 9 mutation hooks (useSaveSettings, useSaveConfig, useActivateProvider, useDeleteProviderCredentials, useSaveTrust, useDeleteTrust, useDeleteReview, useRefreshReviewContext, useShutdown)
- 3 lifecycle hooks (useReviewStream, useReviewStart, useReviewCompletion)
- 2 server hooks (useServerStatus, useDiagnosticsData)
- 1 utility (matchQueryState)
- 2 context (ApiProvider, useApi)

**matchQueryState adoption:** 9 of 13 locations use it. Remaining 4 are intentionally complex composite state machines (analysis page, diagnostics page) — not candidates for conversion.

**Correctly per-app (not shareable):**
- `useReviewLifecycle` — CLI has phase state machine, web has URL sync. Fundamentally different.
- `usePageFooter` — Both exist but depend on different context structures. Acceptable.
- 35+ per-app hooks for keyboard, navigation, form state — all legitimately platform-specific.

**No hand-rolled fetch patterns found** outside documented exceptions.

### Action Items

- No hooks need to be consolidated or moved
- No thin wrappers need removal
- Monitor future additions — default to shared unless platform-specific

---

## R4: Component Parity Audit — CLI vs Web Gaps

### Decision: CLI has major feature gaps in review detail views, needs 10+ components added

### Findings

**UI primitives — well aligned (16/16 match):**
Badge, Button, Callout, Checkbox, Dialog, EmptyState, Input, KeyValue, Menu, NavigationList, Panel, Radio, ScrollArea, SectionHeader, Spinner, Tabs, Toast — all have matching prop names, variants, and composition patterns.

**Review feature — significant gaps:**

| Missing in CLI | Web Component | Impact |
|----------------|---------------|--------|
| Trace tab | `issue-details-pane.tsx` (Trace tab) | High — agent execution history not visible |
| Patch tab | `diff-view.tsx` | High — suggested patches not visible |
| Interactive fix plan | `fix-plan-checklist.tsx` | Medium — CLI shows read-only, web is interactive |
| AgentBoard | `agent-board.tsx` | Medium — agent states not visualized during review |
| ContextSnapshotPreview | `context-snapshot-preview.tsx` | Medium — project context not previewed |
| ReviewMetricsFooter | `review-metrics-footer.tsx` | Medium — metrics not shown during review |
| AgentFilterBar | activity log filtering | Low — can't filter logs by agent |
| SeverityFilterGroup | `severity-filter-group.tsx` | Low — CLI uses inline filter cycling |
| NoChangesView | `no-changes-view.tsx` | Low — CLI uses generic callout |
| ApiKeyMissingView | `api-key-missing-view.tsx` | Low — CLI uses generic callout |

**CLI has data web doesn't show:**
- `betterOptions` array
- `testsToAdd` array
- These should be added to web for true parity.

**IssueDetailsPane prop mismatch:**
- CLI: `issue`, `isActive`, `scrollHeight`
- Web: `issue`, `activeTab`, `onTabChange`, `completedSteps`, `onToggleStep`, `isFocused`
- CLI needs tab management and fix plan completion tracking added.

---

## R5: Cross-Workspace Quality Audit

### Decision: Codebase is high quality (Grade A), minimal actionable findings

### Findings

| Category | Count | Severity |
|----------|-------|----------|
| Production `any` types | 1 actionable | Low (docs theme config cast) |
| Test-only `any` types | 5 | None (standard mock patterns) |
| Generated `any` | 4 | None (TanStack Router codegen) |
| console statements | 92 | None (all legitimate: build scripts, error handlers) |
| Manual useCallback/useMemo | 13 | Informational (justified in keyboard handlers, context values) |
| TODO comments | 1 | None (documented future feature) |
| Empty catch blocks | 0 | Clean |
| Commented-out code | 0 | Clean |
| Unused imports | 0 | Clean |

**Only actionable finding:**
- `apps/docs/source.config.ts:19-20` — `as any` for fumadocs theme type mismatch. Low priority, document or extract theme const.

**Manual memoization (13 uses) — all justified:**
- `keyscope/keyboard-provider.tsx` — event handler registration (performance-sensitive)
- `diff-ui/command-palette/use-item-registry.ts` — event registry callbacks
- `apps/web/footer-context.tsx` — context value memoization (standard pattern)
- `apps/web/use-openrouter-models.ts` — expensive model filtering
- `apps/docs/use-search.ts` — search callback
- These are in code where React Compiler may not be active (library code, shared packages)
