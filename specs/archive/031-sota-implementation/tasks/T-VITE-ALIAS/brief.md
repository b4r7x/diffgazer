# Task T-VITE-ALIAS — Fix three missing Vite aliases in apps/docs

**Source findings:** NEW-021, NEW-001
**Severity:** Critical
**Phase:** 0
**Blocks:** T-DOCS-SITE, T-DOCS-PROPS, T-PUBLISH-WF (publish-readiness CI runs `pnpm run build`)
**Blocked by:** none

## Goal
`pnpm --filter @diffgazer/docs build` and `pnpm --filter @diffgazer/docs build:prerender` currently exit non-zero with `[vite:load-fallback] Could not load .../src/lib/aria-utils`. Three `@/lib/*` aliases used by registry source are missing from `apps/docs/vite.config.ts`, and one (`@/lib/utils`) silently falls through to a docs shim that re-exports `cn` from `@diffgazer/ui` — a registry self-containment violation. Add the three explicit alias entries BEFORE the catch-all `"@": resolve(..., "./src")` entry.

## Files to touch (allowlist)
- `apps/docs/vite.config.ts` (resolve.alias block at ~line 120-135)

## Files NOT to touch
- `apps/docs/tsconfig.json` (already has the correct paths)
- `apps/docs/registry/lib/aria-utils.ts`, `typeahead.ts`, `utils.ts` (source files exist; just need aliasing)
- `apps/docs/src/lib/utils.ts` (the shim — leave it, just don't let `@/lib/utils` fall through to it)

## Acceptance criteria
- [ ] `apps/docs/vite.config.ts` resolve.alias block contains entries for `@/lib/aria-utils`, `@/lib/typeahead`, `@/lib/utils` pointing to `registry/lib/*`
- [ ] All three entries appear BEFORE the catch-all `"@": resolve(import.meta.dirname, "./src")`
- [ ] `pnpm --filter @diffgazer/docs build` exits 0
- [ ] `pnpm --filter @diffgazer/docs build:prerender` exits 0 (or fails on a different, post-aria error — note that)

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/docs build 2>&1 | tail -30
pnpm --filter @diffgazer/docs build:prerender 2>&1 | tail -30
# Confirm registry imports resolve to registry files, not src shim:
grep -A 30 "resolve:" apps/docs/vite.config.ts | head -35
```

## Notes & references
- Spec 029 NEW-021 documents this with file:line.
- Pattern of existing alias entries in `vite.config.ts:122-131` — match exactly: `"@/lib/<name>": resolve(import.meta.dirname, "registry/lib/<name>")`.
- TS already resolves these via `tsconfig.json:26-46`; only Vite is out of sync.

## Non-goals
- Do not refactor the alias map structure or use a `tsconfig-paths`-derived loader.
- Do not modify the `src/lib/utils.ts` shim — only prevent the fallthrough by adding the explicit registry alias.
- Do not address other Vite/Nitro/Fumadocs config concerns.
