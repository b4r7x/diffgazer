# Quickstart: CLI-Web Shared Infrastructure Consolidation & Quality Audit

**Branch**: `017-cli-web-shared-quality`

## Prerequisites

```bash
cd /Users/voitz/Projects/diffgazer-workspace/diffgazer
git checkout 017-cli-web-shared-quality
pnpm install
pnpm build  # baseline build
```

## Implementation Order

This is a refactoring with 8 work streams. Execute in this order to minimize conflicts:

### Phase A: Foundation (parallel — no interdependencies)

**WS1: Extract shared utilities**
1. Add 5 functions to `packages/core/src/format.ts` (copy from web's canonical versions)
2. Add `buildResponsiveResult` to `packages/core/src/layout/breakpoints.ts`
3. Add `getSeverityColor` to `apps/cli/src/theme/severity.ts`
4. Update all consumers to import from shared locations
5. Build: `pnpm --filter @diffgazer/core build`

**WS2: Remove dead code**
1. Delete files: `toast.tsx`, `logo.tsx`, `features/settings/index.ts`
2. Remove dead code within files (see data-model.md for exact lines)
3. Remove `<Toaster />` from `apps/cli/src/app/index.tsx`
4. Replace `InfoField` with `KeyValue` in `context-sidebar.tsx`, then delete `info-field.tsx`
5. Build: `pnpm build`

**WS4: Provider memoization**
1. Add `useMemo`/`useCallback` to each of the 5 providers (see data-model.md)
2. Test: `pnpm --filter @diffgazer/web test` (config-provider and theme-provider tests exist)

**WS7: Relocate misplaced code**
1. Move `getProviderStatus`/`getProviderDisplay` from `format.ts` to `providers/display-status.ts`
2. Move `PROVIDER_CAPABILITIES` + `OPENROUTER_PROVIDER_ID` to `@diffgazer/schemas/config`
3. Move `getFigletText` to `@diffgazer/core`, `useTimer` to web app
4. Remove `@diffgazer/core/severity` passthrough and `providers/types/index.ts`
5. Remove `@diffgazer/hooks` package from workspace
6. Update all import paths
7. Build: `pnpm build`

### Phase B: Consolidation (after Phase A)

**WS3: Settings keyboard consolidation**
1. Update `useFooterNavigation` with `allowInInput` and `wrap` options
2. Refactor 4 settings pages + onboarding wizard to use hook
3. Test: `pnpm --filter @diffgazer/web test`

**WS5: Hook consolidation**
1. Both responsive hooks now use `buildResponsiveResult` (done in WS1)
2. Extract `canProceed` validation in onboarding
3. Remove manual `useMemo` from `use-openrouter-models.ts`
4. Import `ReviewEvent` from core in API package

**WS6: Loading state presets**
1. Create `apps/cli/src/lib/query-presets.tsx` and `apps/web/src/lib/query-presets.tsx`
2. Consolidate duplicate `LoadingReviewState` / `ReviewLoadingMessage`
3. Optionally update existing `matchQueryState` call sites to use presets

**WS8: Responsiveness fixes**
1. Cap Input widths at container width
2. Fix Panel/SectionHeader full-width lines
3. Make IssuePreviewItem path truncation dynamic

### Phase C: Verify

```bash
pnpm build           # all packages build
pnpm type-check      # all packages type-check
pnpm --filter @diffgazer/web test   # web tests pass
# Manual: run CLI at 40, 80, 120 columns to verify responsiveness
```

## Key Patterns

### Adding a function to `@diffgazer/core/format`

```typescript
// packages/core/src/format.ts
export function formatTimestampOrNA(
  value: string | null | undefined,
  fallback = "N/A",
): string {
  return value ? formatTimestampLocale(value) : fallback;
}
```

### Adding memoization to a provider

```typescript
// Before
const value = { data, actions };

// After
const value = useMemo(() => ({ data, actions }), [data, actions]);
```

### Using `useFooterNavigation` in a settings page

```typescript
// Before: ~15 lines of useKey calls
// After:
const footer = useFooterNavigation({
  enabled: isSuccess,
  buttonCount: 2,
  onAction: (index) => {
    if (index === 0) handleCancel();
    else if (index === 1 && canSave) handleSave();
  },
});
// Use footer.inFooter instead of focusZone === "buttons"
// Use footer.focusedIndex instead of buttonIndex
```

## Verification Checklist

- [ ] `pnpm build` passes at workspace root
- [ ] `pnpm type-check` passes
- [ ] `pnpm --filter @diffgazer/web test` passes
- [ ] No grep hits for deleted exports (toast, Logo, NoChangesInline, DEFAULT_TTL, etc.)
- [ ] CLI starts and navigates all 13 screens
- [ ] Web starts and navigates all 13 routes
- [ ] CLI renders correctly at 40, 80, 120, 200 columns
