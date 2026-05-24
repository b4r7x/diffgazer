# Task T-BUTTON-LAZY — Lazy-load Spinner in Button + Toast

**Source findings:** NEW-027
**Severity:** Medium
**Phase:** 4
**Blocks:** none
**Blocked by:** none

## Goal
`libs/ui/registry/ui/button/button.tsx` imports `Spinner` at module top-level for the `loading` branch. Even consumers who never use `loading={true}` ship ~2.5 KB of Spinner code. Same in Toast.

Pick:
- **Option A:** Split into `<Button>` (bare) and `<LoadingButton>` (with spinner). Breaks consumer API.
- **Option B:** `React.lazy(() => import('../spinner/spinner').then(m => ({ default: m.Spinner })))` and render inside `<Suspense>`. SSR-compatible via React 19.
- **Option C:** Keep current import; accept the 2.5 KB cost as a feature.

Recommend B (no API break, modest cost reduction). C is acceptable if B introduces SSR fragility.

## Files to touch (allowlist)
- `libs/ui/registry/ui/button/button.tsx`
- `libs/ui/registry/ui/button/button.test.tsx` (add loading test that asserts spinner appears via Suspense fallback)
- `libs/ui/registry/ui/toast/toast.tsx` (same pattern if applicable)
- `libs/ui/registry/ui/toast/toast.test.tsx`
- Regenerated `libs/ui/public/r/button.json`, `toast.json`

## Files NOT to touch
- Spinner source
- Other components using Spinner directly

## Acceptance criteria
- [ ] If Option B: `Button` only loads Spinner when `loading={true}` (use `React.lazy` + `Suspense` with `null` fallback)
- [ ] Loading state still renders correctly (test passes)
- [ ] No SSR hydration warning
- [ ] Bundle of `Button` standalone (no `loading` ever used) is at least ~2 KB smaller
- [ ] All existing tests pass
- [ ] `pnpm --filter @diffgazer/ui validate:registry` passes

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- button toast
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui validate:registry
pnpm --filter @diffgazer/ui build:shadcn
# Bundle measurement (manual):
# Compare unminified dist size before/after
```

## Notes & references
- Spec 029 §NEW-027
- React 19 `lazy` works in SSR via Suspense; ensure fallback is `null` (not a different spinner!)

## Non-goals
- Do not refactor Spinner
- Do not change Button API surface
- Do not lazy-load anything else
