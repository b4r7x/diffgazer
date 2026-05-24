# Task T-BUNDLE-SLIM — Drop dist/artifacts from npm tarballs + make figlet optional

**Source findings:** NEW-025, NEW-026, NEW-044, PKG-002
**Severity:** High
**Phase:** 1
**Blocks:** T-PUBLISH-WF (don't publish bloated tarballs)
**Blocked by:** none

## Goal
Three install-footprint problems:

1. **`@diffgazer/ui` 31.7 MB unpacked, 94% is `dist/artifacts/`** — JSON registry handoff payload consumers never read at runtime.
2. **`@diffgazer/keys` 2.9 MB unpacked, 80% is `dist/artifacts/`** — same.
3. **`figlet` is a hard `dependency` of `@diffgazer/ui`** (~21 MB in `node_modules`) but only used by the `./components/logo/figlet` subpath. Every consumer installs 21 MB to use components other than Logo.

Fix:
- Exclude `dist/artifacts/` from BOTH UI and keys npm tarballs via `files` field negation.
- Move `figlet` from `dependencies` to `peerDependenciesMeta: { figlet: { optional: true } }` on `@diffgazer/ui`.
- Document that ASCII Logo requires `npm install figlet`.

`dist/artifacts/` must still be GENERATED (used by docs sync), just not SHIPPED to npm.

## Files to touch (allowlist)
- `libs/ui/package.json` (`files` field — exclude `dist/artifacts`; move `figlet` to optional peer)
- `libs/keys/package.json` (`files` field — exclude `dist/artifacts`)
- `libs/ui/README.md` (document figlet optional peer install)
- `libs/ui/dist/components/logo/figlet.js` — verify runtime path; should already handle missing figlet gracefully OR add a clear error if not installed
- `apps/docs/scripts/sync-artifacts.mjs` (if it reads from the NPM-packaged tarball, switch to workspace path)
- `scripts/monorepo/validate-artifacts.mjs` (if it asserts artifacts are in the tarball, relax that assertion)

## Files NOT to touch
- `dist/artifacts/` generation pipeline (build:artifacts, build:docs-data) — these must continue running, just don't end up in the tarball
- `libs/ui/registry/ui/logo/get-figlet-text.ts` (already isolated; ensure import is dynamic if not already)
- Other dependencies
- Source code for components

## Acceptance criteria
- [ ] `pnpm --filter @diffgazer/ui pack --dry-run --json` reports `unpackedSize < 5 MB` and `files` count drastically reduced
- [ ] `pnpm --filter @diffgazer/keys pack --dry-run --json` reports `unpackedSize < 500 KB`
- [ ] The published tarball does NOT include any file under `dist/artifacts/`
- [ ] `figlet` is in `peerDependenciesMeta` on `@diffgazer/ui` (NOT in `dependencies`)
- [ ] `import { getFigletText } from "@diffgazer/ui/components/logo/figlet"` either: (a) fails with a clear error message when figlet is not installed ("Install `figlet` to use the ASCII logo: npm install figlet"), OR (b) lazy-imports figlet via `await import("figlet")` so the failure mode is a clear MODULE_NOT_FOUND that the lazy-import catches
- [ ] The `./components/logo` (non-figlet) export still works without figlet installed
- [ ] `pnpm --filter @diffgazer/ui type-check` passes
- [ ] `pnpm --filter @diffgazer/ui test` passes
- [ ] `pnpm run smoke:packages` passes (docs sync still works — `apps/docs` uses workspace dep, can access `dist/artifacts/` directly via filesystem)
- [ ] `pnpm run prepare:artifacts && pnpm run validate:artifacts:check` passes

## Verification commands
```bash
cd /Users/voitz/Projects/diffgazer-workspace
pnpm --filter @diffgazer/ui pack --dry-run --json | tee /tmp/ui-pack.json | head -20
node -e "const j = require('/tmp/ui-pack.json'); const o = JSON.parse(Array.isArray(j)?JSON.stringify(j[0]):JSON.stringify(j)); console.log('unpackedSize:', o.unpackedSize, 'entryCount:', o.entryCount);"
pnpm --filter @diffgazer/keys pack --dry-run --json | tee /tmp/keys-pack.json | head -20
# Confirm artifacts NOT in tarball
pnpm --filter @diffgazer/ui pack --dry-run 2>&1 | grep "dist/artifacts" | head -3   # should be empty
pnpm --filter @diffgazer/keys pack --dry-run 2>&1 | grep "dist/artifacts" | head -3 # should be empty
# Confirm figlet status
grep -A 3 '"figlet"' libs/ui/package.json
grep -A 5 'peerDependenciesMeta' libs/ui/package.json
# Run smokes
pnpm run smoke:packages
pnpm run prepare:artifacts
pnpm run validate:artifacts:check
# Test logo import in isolation
node --eval "import('@diffgazer/ui/components/logo').then(m => console.log('logo OK:', !!m.Logo))"
# Test figlet subpath WITHOUT figlet installed (manual: temporarily uninstall figlet, then re-test)
```

## Notes & references
- Spec 029 §NEW-025, NEW-026, NEW-044, PKG-002
- Bundle audit empirical measurements: `@diffgazer/ui` 1.59 MB packed / 31.7 MB unpacked / 1160 files; `@diffgazer/keys` 174 KB packed / 2.9 MB unpacked / 183 files
- `files` field negation syntax: `["dist", "!dist/artifacts/**", "!dist/**/*.map", ...]` — npm honors these patterns
- `peerDependenciesMeta` schema: `{ "<pkg>": { "optional": true } }` — npm/pnpm will not install but warn on missing
- Reference: https://docs.npmjs.com/cli/v10/configuring-npm/package-json#files

## Non-goals
- Do not split `@diffgazer/ui` into `@diffgazer/ui-runtime` + `@diffgazer/ui-handoff` packages (too invasive for this task)
- Do not move `class-variance-authority`, `clsx`, or `tailwind-merge` to peer deps (separate concern)
- Do not change which artifacts are GENERATED — only what ships
- Do not lazy-load Spinner from Button (separate task T-BUTTON-LAZY)
- Do not strip source maps from keys (separate task T-MAP-POLICY if desired)
