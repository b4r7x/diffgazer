# Verification

## Focused Gates

Run focused gates first after each implementation slice:

```bash
pnpm --filter @diffgazer/keys test
pnpm --filter @diffgazer/keys type-check
pnpm --filter @diffgazer/ui test
pnpm --filter @diffgazer/ui type-check
pnpm --filter @diffgazer/registry test
pnpm --filter @diffgazer/registry type-check
pnpm --filter @diffgazer/add test
pnpm --filter @diffgazer/add type-check
pnpm --filter @diffgazer/docs test
pnpm --filter @diffgazer/docs type-check
pnpm --filter @diffgazer/web test
pnpm --filter @diffgazer/web type-check
```

Narrow this to affected files while developing, then run the package-level commands before considering a slice done.

## Artifact Gates

Required after registry, CLI, docs, public API, or handoff changes:

```bash
pnpm run prepare:artifacts
pnpm run validate:artifacts:check
git diff --check
```

Public registries under `libs/ui/public/r` and `libs/keys/public/r` are committed and must be reviewable.

## Three-Path Smoke Gates

Add or update these gates as part of this spec:

1. **Direct shadcn/manual copy smoke**
   - Serve `libs/ui/public/r` and `libs/keys/public/r`.
   - Create a clean fixture with `components.json` registry namespaces for `@ui` and `@diffgazer-keys`.
   - Run shadcn add for representative items:
     - `@diffgazer-keys/navigation`
     - `@diffgazer-keys/focus-trap`
     - `@ui/block-bar`
     - `@ui/diff-view`
     - `@ui/dialog`
     - `@ui/popover`
     - `@ui/select`
   - Type-check/build the fixture.
   - Assert CSS-dependent components receive the required CSS path.

2. **`dgadd` copy mode smoke**
   - Clean Vite and Next-style fixtures where supported.
   - Run `dgadd init`.
   - Run `dgadd add ui/select ui/menu ui/dialog keys/navigation --integration copy`.
   - Type-check/build.

3. **`dgadd --integration keys` smoke**
   - Clean fixture with local tarball/package override for `@diffgazer/keys`.
   - Run `dgadd add ui/select ui/menu --integration keys` without relying only on `--skip-install`.
   - Assert `@diffgazer/keys` dependency is installed and build succeeds.

4. **Npm package smoke**
   - Pack local `@diffgazer/ui`, `@diffgazer/keys`, and `@diffgazer/add`.
   - Install from tarballs into clean fixtures.
   - Exercise representative imports:
     - `@diffgazer/ui/components/button`
     - `@diffgazer/ui/components/select`
     - `@diffgazer/ui/components/dialog`
     - `@diffgazer/ui/lib/compose-refs`
     - `@diffgazer/keys` root import with `KeyboardProvider`, `useKey`, `useScope`, `useNavigation`, `useFocusTrap`.
   - Include CSS imports:
     - `@diffgazer/ui/sources.css`
     - `@diffgazer/ui/styles.css`

## Release-Readiness Gates

Before claiming ready:

```bash
pnpm run prepare:artifacts
pnpm run validate:artifacts:check
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test
DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke
pnpm run verify:monorepo
git diff --check
```

## SOTA Verify Compatibility

The local `sota-verify` skill expects a spec directory and asks verification/fix agents to run `npm run test-ci`. This repo currently uses `pnpm` gates. Implementation should either:

1. add a root `test-ci` script that wraps the release-readiness gates above, or
2. explicitly instruct `$sota-verify` agents to run the repo-specific `pnpm` gate matrix from this file.

Prefer option 1 if practical, because it makes the verification skill deterministic.

