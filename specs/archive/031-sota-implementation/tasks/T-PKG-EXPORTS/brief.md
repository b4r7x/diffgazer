# Task T-PKG-EXPORTS — Add `./package.json` export to `@diffgazer/ui`

**Source findings:** PKG-001
**Severity:** High (blocks package-mode docs artifact loading)
**Phase:** 0
**Blocks:** none directly, but docs site can't load artifacts in package mode until fixed
**Blocked by:** none

## Goal
`apps/docs/config/docs-libraries.json` declares `@diffgazer/ui` as an artifact package. The artifact loader resolves package roots through `import.meta.resolve("${packageName}/package.json")`. `@diffgazer/keys` exports `./package.json` (per `libs/keys/package.json:21`), but `@diffgazer/ui` does not. Add it.

## Files to touch (allowlist)
- `libs/ui/package.json` (exports map)

## Files NOT to touch
- Anything else.

## Acceptance criteria
- [ ] `libs/ui/package.json` `exports` contains `"./package.json": "./package.json"`
- [ ] Entry appears alongside existing CSS exports (`./theme-base.css`, `./theme.css`, etc.)
- [ ] `pnpm pack --dry-run` for `@diffgazer/ui` confirms `package.json` is shippable (it always is, but verify exports map is valid JSON)
- [ ] `pnpm --filter @diffgazer/ui type-check` passes
- [ ] `pnpm --filter @diffgazer/ui validate:registry` passes
- [ ] If a package-mode artifact smoke test exists, run it; if not, add one (out of scope — open follow-up)

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
grep -A 1 '"./package.json"' libs/ui/package.json
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/ui validate:registry
pnpm --filter @diffgazer/ui pack --dry-run 2>&1 | grep -E "package.json|exports" | head -5
# Confirm import.meta.resolve works:
node --eval "import('@diffgazer/ui/package.json', { assert: { type: 'json' } }).then(m => console.log(m.default.name))"
```

## Notes & references
- Spec 029 §PKG-001
- Mirror of `libs/keys/package.json:21`: `"./package.json": "./package.json"`
- Apps/docs artifact loader: `apps/docs/scripts/sync-artifacts.mjs` or `prepare-generated.mjs` resolves package roots.

## Non-goals
- Do not refactor the exports map structure.
- Do not change which files ship in the tarball.
- Do not modify the artifact loader.
