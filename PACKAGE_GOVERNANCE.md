# Package Governance

This document defines the current package, artifact, release, and support contracts for the Diffgazer monorepo.

## Package Set

Public package targets:

- `diffgazer` - product CLI, binary `diffgazer`, Node >= 20.
- `@diffgazer/add` - registry installer CLI, binary `dgadd`, Node >= 18.
- `@diffgazer/ui` - React 19 component package.
- `@diffgazer/keys` - React 19 keyboard hooks package.

As of May 6, 2026, `npm view @diffgazer/add`, `npm view @diffgazer/ui`, and `npm view @diffgazer/keys` are treated as external publish-gate checks. Treat these as publish targets until registry availability is verified.

Workspace-only packages:

- `@diffgazer/registry` - private registry, artifact, and CLI workflow tooling.
- `@diffgazer/core`, `@diffgazer/server`, `@diffgazer/web`, `@diffgazer/docs` - app/runtime internals.

Artifact handoff:

- `@diffgazer/ui` builds docs and registry artifacts into its own `dist/artifacts`; there is no `@diffgazer/ui-artifacts` package.
- `@diffgazer/keys` builds artifacts into `dist/artifacts`; there is no public `@diffgazer/keys-artifacts` package.
- `@diffgazer/docs prepare:generated` syncs artifacts from packages when resolvable and falls back to workspace artifacts outside CI.

## Versioning

Published packages use semantic versioning through changesets. The current package version is the `version` field in each package's `package.json`; do not duplicate current versions in docs.

For `0.x` packages, public contracts may still change, but breaking changes still require a changeset and migration notes.

## Release Scripts

Root scripts used for readiness and release:

```bash
pnpm run build
pnpm run verify
pnpm run smoke:packages
pnpm run changeset
pnpm run version-packages
pnpm run release
```

`pnpm run verify` runs monorepo invariants, type checks, tests, and smoke checks. `pnpm run smoke:packages` packs local workspace packages into temporary projects and verifies public imports/bins; it does not install from the public npm registry.

`smoke:packages` currently covers local tarball installs, all exported `@diffgazer/ui` subpaths, CSS export resolution, React SSR rendering, and strict NodeNext type checking. Public handoff also requires clean consumer checks in Vite and Next apps with npm, pnpm, yarn, and bun after the packages are actually published.

A checked-in release-readiness workflow should wire to the root scripts above and block public handoff when install, build, verify, changeset, smoke, or pack checks fail.

## Release Process

1. Build and verify from a clean install:

   ```bash
   pnpm install --frozen-lockfile
   pnpm run build
   pnpm run verify
   pnpm run smoke:packages
   ```

2. Create changesets for changed published packages:

   ```bash
   pnpm run changeset
   ```

3. Version packages and inspect generated changelogs/package diffs:

   ```bash
   pnpm run version-packages
   ```

4. Publish updated packages:

   ```bash
   pnpm run release
   ```

5. Before publishing, verify tarball contents:

   ```bash
   pnpm --filter @diffgazer/add pack --dry-run
   pnpm --filter @diffgazer/ui pack --dry-run
   pnpm --filter @diffgazer/keys pack --dry-run
   ```

6. After publishing, verify npm registry installs:

   ```bash
   npm view @diffgazer/add version
   npm view @diffgazer/ui version
   npm view @diffgazer/keys version
   npm create vite@latest /tmp/dg-vite -- --template react-ts
   npx create-next-app@latest /tmp/dg-next --ts --eslint --app --src-dir --import-alias "@/*"
   ```

7. In clean Vite and Next fixtures, repeat the documented install path with each package manager:

   ```bash
   npm exec @diffgazer/add init
   npm exec @diffgazer/add add ui/button
   pnpm dlx @diffgazer/add init
   yarn dlx @diffgazer/add init
   bunx @diffgazer/add init
   npm install @diffgazer/ui @diffgazer/keys
   ```

   Build each fixture after adding the required `@/*` alias, app CSS import, and package-mode Tailwind `@source` entry.

The current `smoke:packages` script validates packed local packages, not freshly published registry packages. The npm, yarn, and bun matrix above is an external publish-gate check until registry packages exist.

## Package Build Guards

Package lifecycle guards currently in the repo:

- `diffgazer`: `prepack` runs the package build.
- `@diffgazer/add`: `prepublishOnly` builds and checks generated registry/key bundles.
- `@diffgazer/ui`: `prepublishOnly` builds and checks `dist`.
- `@diffgazer/keys`: `prepublishOnly` builds and checks `dist/artifacts/artifact-manifest.json`.

## Dependency Management

- Internal workspace dependencies use `workspace:*`.
- The root `pnpm-lock.yaml` is the resolved dependency source of truth.
- Package manifests may use semver ranges; the lockfile pins the concrete versions used by this repo.
- `@diffgazer/ui` has required React and `@diffgazer/keys` peers. Icon primitives ship from the package; there is no `lucide-react` peer or runtime dependency.
- `@diffgazer/add` bundles registry data at build time so installed copied components are not linked to workspace source at runtime.

## Consumption Contracts

### `@diffgazer/ui`

Copy-first mode is the canonical customization path:

```bash
npx @diffgazer/add init
npx @diffgazer/add add ui/button
```

These commands are public only after `@diffgazer/add` is published. Before publication, run local package smoke tests or install a locally packed `@diffgazer/add` tarball into a fixture app.

This copies source into the consuming app. The app must configure its own `@/*` TypeScript/bundler alias before `dgadd init` and import the copied CSS entrypoint.

Runtime package mode is supported for versioned imports:

```bash
npm install @diffgazer/ui @diffgazer/keys
```

These commands are public only after both packages are published. Runtime consumers must configure Tailwind CSS v4 `@source` for `@diffgazer/ui/dist` and import `@diffgazer/ui/styles.css`.

### `@diffgazer/add`

Use with `npx @diffgazer/add ...`, package-manager `dlx` equivalents, or a global install after publication. The binary name is `dgadd`.

### `@diffgazer/keys`

Use as a runtime package for `KeyboardProvider` and hooks after publication, or copy standalone hooks through `npx @diffgazer/add add keys/...`.

## Migration and Support

- Runtime package consumers update with their package manager and follow changelog/migration notes.
- Copy-first consumers update manually with `npx @diffgazer/add diff` and selective `npx @diffgazer/add add --overwrite` after publication, or the same `dgadd` commands from a locally packed CLI.
- Bug reports go to GitHub Issues. Security reports should be sent privately to maintainers.
