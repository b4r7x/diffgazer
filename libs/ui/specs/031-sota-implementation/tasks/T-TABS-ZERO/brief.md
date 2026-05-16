# Task T-TABS-ZERO — Tabs with zero triggers must not silently break

**Source findings:** NEW-039
**Severity:** High
**Phase:** 0
**Blocks:** none
**Blocked by:** none

## Goal
`libs/ui/registry/ui/tabs/tabs.tsx:91-92` computes `firstEnabledTab = ""` when no triggers exist, then `resolvedValue=""` always, then no panel matches "" so nothing renders. No throw, no warn, no test. Make this an explicit, debuggable state.

Pick the simplest of three options that fits AGENTS.md style:
1. `console.warn` once when triggers === 0 and there's no `defaultValue`.
2. Render a fallback (e.g. nothing visible but an `aria-live="polite"` SR-only "No tabs available" — only when component is marked as empty-state-aware).
3. Throw with a clear error message ("Tabs requires at least one Tabs.Trigger").

Recommend option 1 (warn) — non-throwing matches existing DialogTitle warn pattern, doesn't break consumer SSR.

## Files to touch (allowlist)
- `libs/ui/registry/ui/tabs/tabs.tsx`
- `libs/ui/registry/ui/tabs/tabs.test.tsx` (add behavior test)
- `libs/ui/public/r/tabs.json` (regenerated via build:shadcn)

## Files NOT to touch
- TabsTrigger, TabsList, TabsContent, TabsPanel files
- Other components

## Acceptance criteria
- [ ] When zero `Tabs.Trigger` children exist, a `console.warn` fires once with a message naming Tabs and suggesting at least one Trigger
- [ ] The warn fires only once per render cycle (use a ref/flag, not a `useEffect` that re-fires)
- [ ] `defaultValue` is still respected even if no triggers (consumer might be lazy-loading)
- [ ] New test asserts warn behavior + no crash
- [ ] Existing tabs tests still pass

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- tabs
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui build:shadcn
git diff --stat libs/ui/public/r/tabs.json
```

## Notes & references
- Pattern reference: `libs/ui/registry/ui/dialog/dialog-content.tsx:92` — `console.warn` + fallback for missing accessible name.
- TESTING.md: use `vi.spyOn(console, "warn")` with `// Boundary mock:` annotation for the warn test.
- Don't throw — many composition patterns intentionally start empty then populate.

## Non-goals
- Do not add an "EmptyState" slot to Tabs (out of scope).
- Do not refactor how triggers are collected.
- Do not change the public Tabs API.
