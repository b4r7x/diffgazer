# Task T-PKG-ENGINES — Add `engines.node` to `@diffgazer/ui` and `@diffgazer/keys`

**Source findings:** PKG-003
**Severity:** Medium
**Phase:** 0
**Blocks:** none
**Blocked by:** none

## Goal
`@diffgazer/add` declares `engines.node: ">=18.0.0"`. `diffgazer` (CLI) declares `>=20.0.0`. Neither `@diffgazer/ui` nor `@diffgazer/keys` declare `engines` — pnpm's `engineStrict` users and PaaS Node version pickers can't filter. React 19.2 requires Node 18+ at minimum.

## Files to touch (allowlist)
- `libs/ui/package.json`
- `libs/keys/package.json`

## Files NOT to touch
- Anything else.

## Acceptance criteria
- [ ] `libs/ui/package.json` has `"engines": { "node": ">=18.0.0" }`
- [ ] `libs/keys/package.json` has `"engines": { "node": ">=18.0.0" }`
- [ ] `pnpm install` succeeds
- [ ] `pnpm --filter @diffgazer/ui type-check` passes
- [ ] `pnpm --filter @diffgazer/keys type-check` passes
- [ ] `pnpm pack --dry-run` for both packages emits `engines` field in metadata

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
grep -A 2 '"engines"' libs/ui/package.json libs/keys/package.json
pnpm install
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/keys type-check
```

## Notes & references
- Spec 029 §PKG-003
- React 19.2 minimum: Node 18 (`>=18.0.0`).
- Match `@diffgazer/add`'s declaration style: `"engines": { "node": ">=18.0.0" }`.

## Non-goals
- Do not bump to `>=20` (more restrictive than React requires; libs should support widest compatible range).
- Do not add other `engines` keys (pnpm/yarn/npm).
- Do not modify CLI packages' engines.
