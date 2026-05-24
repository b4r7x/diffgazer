# Task T-DOCS-VALIDATE — Fail validate when public component prop tables are empty

**Source findings:** DOCS-004
**Severity:** Medium
**Phase:** 3
**Blocks:** none
**Blocked by:** T-DOCS-PROPS (must populate props first, otherwise validation fails immediately)

## Goal
`validate:registry` currently passes even when most public component prop tables are empty (the root cause of DOCS-001). After T-DOCS-PROPS populates them, add a guard so this never silently regresses again.

## Files to touch (allowlist)
- `libs/ui/scripts/validate-registry-metadata.ts` (add check: every public component item has non-empty `props` in its docs JSON, unless marked `noProps: true`)
- Optionally: `scripts/monorepo/check-invariants.mjs` if validation should run at monorepo level too
- `libs/ui/registry/component-docs/*.ts` (if `noProps` exemption needs declaring per-component)

## Files NOT to touch
- Source components
- Prop type definitions
- Other validation scripts

## Acceptance criteria
- [ ] `pnpm --filter @diffgazer/ui validate:registry` fails with a clear error when any public component item has empty `props` AND no `noProps: true` exemption
- [ ] Pure-visual components (the ones T-DOCS-PROPS identifies as `noProps`) explicitly declare it
- [ ] Failure message includes the component name and how to fix (either populate props or add `noProps: true`)
- [ ] After T-DOCS-PROPS has run (44 components with populated props OR explicit `noProps`), validation passes
- [ ] Existing validation rules still apply

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui validate:registry
# Manual test: temporarily set one component's props to {} and verify validate fails
```

## Notes & references
- Spec 029 §DOCS-004
- This is a guard rail — companion to T-DOCS-PROPS
- Pattern: validate-registry-metadata.ts already has many similar guards; add another one

## Non-goals
- Do not change the docs metadata format
- Do not populate any props in this task (that's T-DOCS-PROPS)
- Do not change `<APIReference />` MDX behavior
