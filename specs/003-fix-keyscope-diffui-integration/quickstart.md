# Quickstart: Fix Keyscope + diff-ui Integration

## Problem

After migrating diffgazer's web UI from local components to diff-ui package components, keyscope keyboard navigation is broken. The root cause is an architectural mismatch in how the two layers compose.

## Architecture

```
Layer 1: diff-ui components (standalone a11y + internal keyboard nav)
Layer 2: keyscope hooks (page-level hotkeys, scopes, focus zones) — plugged in ON TOP by consumer
```

## Fix Strategy

### Phase 1: Diagnose

1. Run `cd /Users/voitz/Projects/diffgazer-workspace/diffgazer && pnpm dev:web`
2. Test keyboard navigation on each page
3. Identify which specific components/pages are broken

### Phase 2: Fix diff-ui Components

In `/Users/voitz/Projects/diffgazer-workspace/diff-ui/registry/ui/`:

1. **CheckboxGroup**: Add `useControllableState` for highlight (like RadioGroup already does)
2. **All components**: Add `defaultPrevented` check before calling internal `navKeyDown` (Tabs already does this)
3. **Verify** controlled mode works: when `highlighted` prop is provided, component defers to it

### Phase 3: Fix Diffgazer Wiring

In `/Users/voitz/Projects/diffgazer-workspace/diffgazer/apps/web/src/`:

1. **Remove redundant `useNavigation`** calls where the diff-ui component already handles navigation internally
2. **Keep only** `useKey`, `useScope`, `useFocusZone` for page-level features
3. **Bridge state** between `useFocusZone` and diff-ui components via `highlighted`/`onHighlightChange` props
4. **Fix role mismatches** (e.g., consumer queries `role="option"` but component uses `role="menuitem"`)

### Phase 4: Test

```bash
cd /Users/voitz/Projects/diffgazer-workspace/diffgazer
pnpm --filter @diffgazer/web test
pnpm --filter @diffgazer/web exec tsc --noEmit
```

## Key Files

| Area | Files |
|------|-------|
| diff-ui checkbox fix | `diff-ui/registry/ui/checkbox/checkbox-group.tsx` |
| diff-ui hooks | `diff-ui/registry/hooks/use-listbox.ts`, `use-navigation.ts` |
| diffgazer providers | `diffgazer/apps/web/src/app/providers/index.tsx` |
| Integration tests | `diffgazer/apps/web/src/components/shared/keyboard-navigation.integration.test.tsx` |
| Home page wiring | `apps/web/src/features/home/components/page.tsx` |
| Settings hub wiring | `apps/web/src/features/settings/components/hub/page.tsx` |
| Review results wiring | `apps/web/src/features/review/hooks/use-review-results-keyboard.ts` |
