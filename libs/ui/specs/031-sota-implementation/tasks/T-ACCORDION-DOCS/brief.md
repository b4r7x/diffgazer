# Task T-ACCORDION-DOCS — Document accordion `region` prop + trade-off

**Source findings:** FP-006
**Severity:** Low (docs gap)
**Phase:** 4
**Blocks:** none
**Blocked by:** none

## Goal
Diffgazer's Accordion has `region` prop (opt-in) for `role="region"` on panels. APG says MAY (optional). Radix and Mantine default ON; React Aria opt-in. The current opt-in IS APG-conformant — the defect is the prop is undocumented. Document it.

Optionally rename `region: boolean` to `role: "group" | "region"` (React Aria pattern) — more honest.

## Files to touch (allowlist)
- `apps/docs/content/docs/ui/components/accordion.mdx` (document `region` prop + trade-off)
- `apps/docs/registry/component-docs/accordion.ts` (if separate metadata for the prop)
- Optionally: rename in `libs/ui/registry/ui/accordion/accordion-content.tsx` from `region` to `role` prop, regenerate
- `libs/ui/public/r/accordion.json` (regenerated if renamed)

## Files NOT to touch
- Accordion functionality
- Other components

## Acceptance criteria
- [ ] `accordion.mdx` has a "Accessibility: Region role" subsection that:
  - Documents the `region` prop
  - Explains the APG "MAY" stance
  - Calls out the "avoid for >6 panels" recommendation
  - States the default is opt-out
- [ ] Optionally: prop renamed to `role: "group" | "region"` matching React Aria; old `region` prop NOT kept as alias (AGENTS.md: no deprecated aliases pre-public-release)
- [ ] If renamed: all docs, examples, registry source, public registry, tests updated
- [ ] All accordion tests pass

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- accordion
pnpm --filter @diffgazer/ui build:shadcn
pnpm --filter @diffgazer/ui validate:registry
```

## Notes & references
- Spec 029 §FP-006
- APG accordion: https://www.w3.org/WAI/ARIA/apg/patterns/accordion/

## Non-goals
- Do not change accordion behavior
- Do not change default (keep opt-in)
- Do not modify other components' region roles
