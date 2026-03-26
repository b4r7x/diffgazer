# Research: CLI Ink Web Parity

**Date**: 2026-03-26
**Feature**: 016-cli-ink-web-parity

## R1: Terminal Resize in Ink 6

### Decision: Add `useState` + `stdout.on('resize', ...)` to `useTerminalDimensions`

### Rationale

Source-level analysis of Ink 6.6.0 reveals that `useStdout()` is `useContext(StdoutContext)` — a static context set once at mount. The context value (the `stdout` stream object) never changes its reference, so React never triggers a re-render from it.

When the terminal resizes:
1. Node.js emits `resize` event on `process.stdout`
2. Ink's `Ink` class catches this and calls `calculateLayout()` + `onRender()`
3. Yoga recalculates flexbox layout with new terminal width → percentage/flex-based `<Box>` layouts reflow visually
4. **But React component functions do NOT re-execute** — the existing virtual DOM is re-output, not re-rendered

This means:
- `<Box width="50%">` and `<Box flexGrow={1}>` work correctly on resize (Yoga handles it)
- `useResponsive()` breakpoint-dependent conditional rendering (`isNarrow ? <A/> : <B/>`) does NOT update — stale closure values

**Fix**: Add `useState` for dimensions and subscribe to `stdout.on('resize', ...)`:

```typescript
export function useTerminalDimensions(): TerminalDimensions {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState<TerminalDimensions>({
    columns: stdout.columns ?? 80,
    rows: stdout.rows ?? 24,
  });

  useEffect(() => {
    function onResize() {
      setDimensions({
        columns: stdout.columns ?? 80,
        rows: stdout.rows ?? 24,
      });
    }
    stdout.on("resize", onResize);
    return () => { stdout.off("resize", onResize); };
  }, [stdout]);

  return dimensions;
}
```

### Alternatives Considered

- **`ink-use-stdout-dimensions`** (~140k/week, 12+ months inactive): Does the same thing. Skip — adds dependency for 10 lines of code.
- **`fullscreen-ink`** (v0.1.0, low maturity): Provides `useScreenSize()` + alternate screen buffer. Skip — only needed if we want alt buffer mode.
- **Keep current implementation**: Broken for conditional rendering on resize. Rejected.

## R2: Hook Sharing Between CLI and Web

### Decision: Consolidate 3 specific shared hook opportunities; keep platform-specific hooks per-app

### Rationale

The shared `@diffgazer/api/hooks` package already has 25+ hooks used by both apps. The data-fetching/mutation layer is well-shared. Remaining duplication is in:

**HIGH IMPACT — Extract shared orchestration from `useReviewLifecycle`**:
Both apps have ~136/111 line versions composing `useReviewStream` + `useReviewStart` + `useReviewCompletion` with ~70% shared code. Extract common orchestration (config gating, stream wiring, phase derivation, noDiff/loading detection) into a shared base hook. Platform-specific parts (CLI: phase state machine; web: URL sync) remain per-app.

**MEDIUM IMPACT — Share pure functions currently embedded in hooks**:
- `isOpenRouterCompatible` + `mapOpenRouterModels` — web has them in a hook, CLI does the same inline. Move to `@diffgazer/core` or `@diffgazer/api`.
- `areShortcutsEqual` — web's `use-page-footer.ts` has this. Move to `@diffgazer/schemas/ui`.
- `useReviewHistory` (composition of `useReviews` + `useReview` + `selectedId` state) — web extracts it, CLI inlines it. Could share.

**KEEP PER-APP** (platform-specific by nature):
- CLI: `useBackHandler`, `useExitHandler`, `useKey`, `useScope`, `useServers`, `useSettingsZone`, `useTerminalDimensions`, `useReviewKeyboard`
- Web: `useFooterNavigation`, `useScopedRouteState`, `useScrollIntoView`, `useTheme`, `useViewportBreakpoint`, all keyboard hooks (keyscope-based)

### Alternatives Considered

- **Create `@diffgazer/ui-hooks` package**: Would hold the shared lifecycle hook. Rejected — keeping it in `@diffgazer/api/hooks` is simpler since it only uses API hooks + core utilities already imported there.
- **Share `usePageFooter`**: Both apps have it but they depend on platform-specific context providers. The hooks are structurally similar but cannot be unified. Only the `areShortcutsEqual` utility should be shared.

## R3: Loading State Library / Wrapper

### Decision: Keep `matchQueryState`. No new library or component wrapper.

### Rationale

`matchQueryState` is already used in 54 files across both apps. It's 18 lines, works cross-platform (Ink + web), and supports the guard-clause pattern:

```typescript
const guard = matchQueryState(query, { loading: () => <Spinner />, error: (e) => <Err error={e} />, success: () => null });
if (guard) return guard;
// data guaranteed defined
```

**Suspense + `useSuspenseQuery`**: Works in Ink technically, but would be a large migration (54 files) for marginal gain. Current pattern is explicit and debuggable.

**`<QueryGate>` component**: A JSX wrapper around the same logic. Adds nesting without benefit — `matchQueryState` is more composable.

### Alternatives Considered

- `useSuspenseQuery` + `<Suspense>` + `<ErrorBoundary>`: Large migration, marginal benefit. Rejected.
- Component-based `<QueryGate>`: Adds JSX nesting, less composable than function call. Rejected.
- Third-party loading libraries: None found that are Ink-compatible or better than current approach.

## R4: Layout Centering Patterns

### Decision: Add centering to menu/settings screens; keep full-width for data-dense screens

### Rationale

**Current CLI**: No centering anywhere (except Dialog overlays). All content starts top-left, expands full width. HomeScreen uses hardcoded `width={30}` sidebar with no max-width.

**Web approach**: Per-page centering with `justify-center items-center` + `max-w-*` constraints. Data-dense screens (review results, progress, history) span full width.

**Ink equivalent pattern**:
```tsx
// Centered content (menus, settings)
<Box justifyContent="center" alignItems="center" flexGrow={1}>
  <Box width={Math.min(columns, MAX_WIDTH)}>
    {/* content */}
  </Box>
</Box>

// Full-width content (review, history)
<Box flexGrow={1} flexDirection="row">
  {/* panes with calculated widths */}
</Box>
```

**Screens needing centering**: HomeScreen, Settings Hub, all single-panel settings sub-screens (theme, storage, analysis, agent-execution, trust-permissions), review summary.

**Screens fine as-is**: Review results (2-pane, full width), review progress (2-pane), history (2-pane), providers (2-pane). Already have responsive breakpoint handling.

### Alternatives Considered

- **Center everything in GlobalLayout**: Would require data-dense screens to opt-out with `alignSelf="stretch"`. Rejected — per-screen centering is cleaner.
- **Layout primitive components** (`<Center>`, `<VStack>`, `<HStack>`): No maintained Ink libraries. Ink's `<Box>` is already the layout primitive. Extract project-local helpers only if repetition warrants it.

## R5: Screen Parity Gaps

### Decision: Address 3 functional gaps; accept 6 cosmetic differences

### Functional gaps to fix

1. **Help page**: Web is a stub ("Help is not wired in this build"). CLI has full keyboard shortcuts. **Action**: Port CLI help content to web.
2. **Onboarding step order**: Web starts with storage, CLI starts with provider. **Action**: Align to same order (storage-first makes more sense — need storage before anything else).
3. **Trust `runCommands` toggle**: CLI exposes it, web hardcodes `false`. **Action**: Align behavior (web should either expose it or CLI should hide it).

### Cosmetic differences (acceptable)

1. Theme live preview (web only) — terminal can't preview themes the same way
2. Provider search/filter (web only) — CLI has simpler list, fine for terminal
3. Cancel buttons (web has Cancel+Save, CLI has Save only) — terminal convention is simpler
4. Toast vs inline messages — platform-appropriate feedback
5. Review `durationMs` (CLI tracks, web doesn't) — not a parity issue
6. No-changes phase (CLI only) — CLI-specific UX enhancement

## R6: Cross-Workspace Code Quality

### Decision: Consolidate 6 specific duplication targets, remove 4 thin wrappers, delete 1 dead component

### Consolidation targets (by priority)

1. **`buildLensOptions()`** — 3 copies (CLI analysis-selector, web analysis/page, web onboarding analysis-step). Pure data transform from `LENS_TO_AGENT` + `AGENT_METADATA`. Move to `@diffgazer/schemas/events`.
2. **`getSubstepDetail()`** — web re-implements `getAgentDetail()` from `@diffgazer/core/review`. Web should import and extend, not duplicate.
3. **Display status mapping** (`statusBadge`/`statusBadgeVariant`/`statusLabel`/`getStatusIndicator`) — 4 copies across CLI and web provider components. Move to `@diffgazer/schemas/config` or `@diffgazer/core`.
4. **`ProviderWithStatus`/`DisplayStatus` types** — web defines in `features/providers/types/`, CLI has inline equivalents. Move to `@diffgazer/schemas/config`.
5. **`getBackTarget()`** — both apps implement same routing logic. Move to `@diffgazer/core`.
6. **Navigation config re-exports** — both apps re-export same constants from `@diffgazer/schemas/ui`. Import directly at usage sites.

### Thin wrappers to remove

1. CLI `StorageStep` — pure passthrough to `StorageSelector`
2. CLI `AnalysisStep` — pure passthrough to `AnalysisSelector`
3. CLI `ApiKeyStep` — only adds a type cast, inline at call site
4. Web `api-key-method-selector.tsx` (providers) — single re-export line

### Dead code to delete

1. Web `WizardLayout` — exported but never imported, superseded by `CardLayout`

### Anti-slop to clean

1. JSX section comments in `provider-details.tsx`, `wizard-layout.tsx`, `card-layout.tsx`, `trust-permissions-content.tsx` — comments that repeat what code structure already shows
2. No-op `useKey("ArrowDown", () => {}, ...)` handlers — register empty handler to prevent propagation; confusing without docs
3. `PROVIDER_FILTER_VALUES` derived array — redundant with existing tuple
