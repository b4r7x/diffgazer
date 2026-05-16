# Task T-FIELD-EMPTY — Field.Description / Field.Error treat empty string as no-children

**Source findings:** NEW-038
**Severity:** High (a11y regression)
**Phase:** 0
**Blocks:** none
**Blocked by:** none

## Goal
Currently `libs/ui/registry/ui/field/field.tsx:178, 208` checks `hasChildren = children !== undefined && children !== null`. Empty string `""` passes this check, so the component renders an empty `<p>` and STILL wires `aria-describedby` to it. Screen readers announce an empty description/error on every focus — a common pattern is `error={formState.errors.email ?? ""}` which would trigger this.

Fix: treat empty string (and arrays of only empty strings) as absent.

## Files to touch (allowlist)
- `libs/ui/registry/ui/field/field.tsx`
- `libs/ui/registry/ui/field/field.test.tsx` (add behavior test)
- `libs/ui/public/r/field.json` — refresh via `pnpm --filter @diffgazer/ui build:shadcn` (do NOT hand-edit)

## Files NOT to touch
- Other Field components, other compound parts beyond Description/Error
- `field.css` or theme files

## Acceptance criteria
- [ ] `hasChildren` returns false when children is `""`
- [ ] `hasChildren` returns false when children is `[]` or `[""]`
- [ ] `hasChildren` returns true for non-empty strings, numbers, JSX, React fragments with content
- [ ] When `error=""`, the `<p>` is NOT rendered AND `aria-describedby` does NOT include the error id
- [ ] When `description=""`, same as above
- [ ] New tests pass: `<Field error="">` does not surface an a11y-described region
- [ ] Existing field tests still pass
- [ ] `libs/ui/public/r/field.json` regenerated to reflect new source

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui test -- field
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui validate:registry
# Confirm public registry regenerated to match source:
pnpm --filter @diffgazer/ui build:shadcn
git diff --stat libs/ui/public/r/field.json
```

## Notes & references
- AGENTS.md "Form Primitives": "Field owns form wiring: label, control id, required, disabled, invalid, description, error, and ARIA relationships."
- Test query helper from `@testing-library/react`: use `queryByText` or check `aria-describedby` attribute presence.
- TESTING.md rule 1: assert on user-visible behavior (no aria-describedby, no rendered text), not on internal `hasChildren` value.

## Non-goals
- Do not change `aria-errormessage` vs `aria-describedby` policy (current `describedby` is acceptable per spec 029).
- Do not add a `required` indicator visual change.
- Do not refactor the field component beyond the empty-string check.
