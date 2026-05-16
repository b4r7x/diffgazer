# Task T-TYPOGRAPHY-HEADINGS — Decide Typography h1-h6 support, then ship

**Source findings:** UI-003
**Severity:** Low-Medium
**Phase:** 4
**Blocks:** none
**Blocked by:** none

## Goal
`Typography` accepts only `as: "div" | "p" | "span"`. There's no `h1`-`h6` support. `SectionHeader` covers h2-h4, but consumers can't render h1 or h5/h6 semantically without rolling their own.

Pick:
- **Option A:** Extend `Typography` `as` union to include `h1`-`h6` and add variant sizing per heading level.
- **Option B:** Document explicit split: SectionHeader for h2-h4 semantic headings; Typography for body/spans/divs only. Add a `Heading` primitive if h1/h5/h6 needed.

Recommend A (less new surface, consistent API).

## Files to touch (allowlist)
- `libs/ui/registry/ui/typography/typography.tsx` (extend `as` union)
- `libs/ui/registry/ui/typography/typography.test.tsx` (add tests for h1-h6 rendering)
- `apps/docs/content/docs/ui/components/typography.mdx` (document new options)
- `libs/ui/public/r/typography.json` (regenerated)

## Files NOT to touch
- `SectionHeader` (separate concern)
- Other components

## Acceptance criteria
- [ ] `Typography` `as` accepts `"h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div" | "p" | "span"`
- [ ] Default size variants per heading level (h1 largest, h6 smallest) — but explicit `size` prop still wins
- [ ] Tests for h1-h6 rendering with semantic element + correct default size
- [ ] Existing tests pass
- [ ] MDX docs updated
- [ ] `pnpm --filter @diffgazer/ui validate:registry` passes

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- typography
pnpm --filter @diffgazer/ui build:shadcn
pnpm --filter @diffgazer/ui validate:registry
```

## Notes & references
- Spec 028/029 §UI-003

## Non-goals
- Do not deprecate SectionHeader
- Do not change Typography's color/weight variants
- Do not introduce a new `Heading` primitive
