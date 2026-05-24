# Task T-PERF-PALETTE — useDeferredValue in command-palette filtering

**Source findings:** NEW-041
**Severity:** Low-Medium (opportunity, only matters for large lists)
**Phase:** 4
**Blocks:** none
**Blocked by:** none

## Goal
`libs/ui/registry/ui/command-palette/use-command-palette-state.ts:53-62` runs filter synchronously per keystroke. For palettes with 100+ items, typing latency degrades. Wrap consumed `search` value in `useDeferredValue` to keep typing responsive.

## Files to touch (allowlist)
- `libs/ui/registry/ui/command-palette/use-command-palette-state.ts`
- `libs/ui/registry/ui/command-palette/command-palette-item.tsx` (consumer of `search`)
- `libs/ui/registry/ui/command-palette/command-palette.test.tsx` (add perf test with many items)
- `libs/ui/public/r/command-palette.json` (regenerated)

## Files NOT to touch
- Other components
- Search/filter algorithm itself

## Acceptance criteria
- [ ] `useDeferredValue(search)` wraps the search value passed to filtering
- [ ] Input value still updates synchronously (no input lag)
- [ ] Filter results may lag input by 1-2 frames (acceptable; React handles backpressure)
- [ ] New test: render 200 items, type quickly, assert input updates immediately and results converge
- [ ] Existing tests pass

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- command-palette
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui build:shadcn
```

## Notes & references
- Spec 029 §NEW-041
- React docs: https://react.dev/reference/react/useDeferredValue

## Non-goals
- Do not virtualize the list (separate concern)
- Do not change filter algorithm
- Do not replace command-palette with a 3rd-party lib
