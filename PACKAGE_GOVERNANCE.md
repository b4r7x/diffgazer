# Package Governance

This document defines the current package, artifact, release, and support contracts for the Diffgazer monorepo.

## Package Set

Public package targets:

- `diffgazer` - product CLI, binary `diffgazer`, Node >= 20.
- `@diffgazer/add` - registry installer CLI, binary `dgadd`, Node >= 18.
- `@diffgazer/ui` - React `>=19.2.0` component package.
- `@diffgazer/keys` - React `>=19.2.0` keyboard hooks package.

As of May 6, 2026, `npm view @diffgazer/add`, `npm view @diffgazer/ui`, and `npm view @diffgazer/keys` are treated as external publish-gate checks. Treat these as publish targets until registry availability is verified.

Workspace-only packages:

- `@diffgazer/registry` - private registry, artifact, and CLI workflow tooling.
- `@diffgazer/core`, `@diffgazer/server` (lives at `cli/server`, internal to the `diffgazer` CLI), `@diffgazer/web`, `@diffgazer/docs` - app/runtime internals.

Artifact handoff:

- `@diffgazer/ui` builds docs and registry artifacts into its own `dist/artifacts`; there is no `@diffgazer/ui-artifacts` package.
- `@diffgazer/keys` builds artifacts into `dist/artifacts`; there is no public `@diffgazer/keys-artifacts` package.
- `@diffgazer/docs prepare:generated` syncs artifacts from packages when resolvable and falls back to workspace artifacts outside CI.
- Artifact validation is non-mutating and must fail on fingerprint drift, missing manifest inputs, stale/tampered copied artifact directories, stale docs-host sync outputs, and copied artifact mirror drift.

## Versioning

Published packages use semantic versioning through changesets. The current package version is the `version` field in each package's `package.json`; do not duplicate current versions in docs.

For `0.x` packages, public contracts may still change, but breaking changes still require a changeset and migration notes.

## Release Scripts

Root scripts used for readiness and release:

```bash
pnpm run build
pnpm run verify
pnpm run smoke:packages
pnpm run test-ci
pnpm run release-check
pnpm run changeset
pnpm run version-packages
pnpm run release
```

`pnpm run verify` runs monorepo invariants, type checks, tests, and smoke checks. `pnpm run smoke:packages` packs local workspace packages into temporary projects and verifies public imports/bins; it does not install from the public npm registry.

`pnpm run test-ci` runs artifact preparation, validation, type-check, tests, strict smoke, and monorepo verification. It is the CI-safe gate that `$sota-verify` invokes.

`pnpm run release-check` runs the full no-publish release readiness sequence: artifact prep, artifact validation, type-check, tests, strict smoke, package smoke, pack dry-runs for all public packages, monorepo verification, and `git diff --check`. It does not run `changeset publish`.

`smoke:packages` currently covers local tarball installs, all exported `@diffgazer/ui` subpaths, CSS export resolution, React SSR rendering, strict NodeNext type checking, and the shared React `>=19.2.0` floor. Public handoff also requires clean consumer checks in Vite and Next apps with npm, pnpm, yarn, and bun after the packages are actually published.

A checked-in release-readiness workflow should wire to the root scripts above and block public handoff when install, build, generated-file cleanliness, verify, changeset, smoke, or pack checks fail.

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
   pnpm --filter diffgazer pack --dry-run
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

- `diffgazer`: `prepack` runs the package build; `build` first runs the required workspace dependency builds for `@diffgazer/core`, `@diffgazer/server`, `@diffgazer/keys`, `@diffgazer/ui`, and `@diffgazer/web`.
- `@diffgazer/add`: `prepublishOnly` runs build, type-check, test, and root artifact validation.
- `@diffgazer/ui`: `prepublishOnly` runs build, type-check, test, and root artifact validation.
- `@diffgazer/keys`: `prepublishOnly` runs build, type-check, test, and root artifact validation.

The release-readiness workflow must also run pack dry-runs for all public packages: `diffgazer`, `@diffgazer/add`, `@diffgazer/ui`, and `@diffgazer/keys`.

## Publish Metadata

Public packages are published through the root `pnpm run release` script, which runs `changeset publish --provenance`. Public package manifests also set `publishConfig.provenance` so one-off `npm publish` calls use the same provenance policy. Scoped public packages set `publishConfig.access` to `public`.

`@diffgazer/keys-artifacts` is private and exists only as a workspace mirror for docs artifact handoff; it is not a public package target.

### Publish Flow

Publishing runs from `.github/workflows/release.yml` via `changesets/action`:

1. A contributor adds a changeset on their PR (`pnpm run changeset`); merging the PR to `main` triggers the release workflow, which opens (or updates) a `chore: version packages` PR that applies pending changesets, bumps versions, and updates CHANGELOGs.
2. Merging the Version PR re-triggers the workflow, which runs `pnpm run release-check` and then `pnpm run release` (`changeset publish --provenance`) under GitHub OIDC so npm records provenance attestations.
3. The workflow requires `secrets.NPM_TOKEN` until each public package is configured for npm Trusted Publishers; once trusted publishing is enabled per package on npmjs.com, the token becomes optional.

#### Recovery from publish failure

If the publish step fails after the Version PR is merged (network blip, npm registry error, transient runner issue), re-run the failed `Release` workflow run from the GitHub Actions UI; `changesets/action` is idempotent — already-published versions are skipped. If the workflow itself is wedged or the secret is missing, a maintainer can publish manually from a clean tree at the merged Version PR commit with `pnpm install --frozen-lockfile && pnpm run release-check && pnpm run release`, supplying `NPM_TOKEN` and `NPM_CONFIG_PROVENANCE=true` locally. For any failure, open an issue or contact a maintainer before re-attempting a manual publish so the team can confirm registry state first.

## Dependency Management

- Internal workspace dependencies use `workspace:*`.
- The root `pnpm-lock.yaml` is the resolved dependency source of truth.
- Package manifests may use semver ranges; the lockfile pins the concrete versions used by this repo.
- `@diffgazer/ui` and `@diffgazer/keys` share one React floor: React `>=19.2.0`. The docs app and package smoke fixtures install compatible React ranges so package and docs behavior stay aligned.
- `@diffgazer/ui` has required React, React DOM, and `@diffgazer/keys` peers. Icon primitives ship from the package; there is no `lucide-react` peer or runtime dependency.
- `figlet` is an **optional peer dependency** of `@diffgazer/ui` because the explicit `@diffgazer/ui/components/logo/figlet` deep import requires it. Consumers using this subpath must install figlet themselves; the deep import lazily resolves it at runtime and throws a clear error if absent. The default `@diffgazer/ui/components/logo` entry must not import `figlet`; it accepts precomputed `asciiText` instead.
- `@diffgazer/add` bundles registry data at build time so installed copied components are not linked to workspace source at runtime.
- `@diffgazer/add` is CLI-only. It exposes the `dgadd` binary and intentionally does not expose an import entry until a typed library API is designed and emitted.

## Dependency Governance

The root `package.json` carries a `pnpm.overrides` block to keep shared transitive packages on a single version across the workspace. The current pins collapse duplicates that otherwise drift across apps and tooling:

- `@types/node` pinned to `^25.2.3` so docs, registry, ui, keys, server, core, and cli packages resolve to one major.
- `tailwindcss` pinned to `^4.3.0` so `apps/web` and `apps/docs` resolve to one minor (no `4.2.x` / `4.3.x` split).
- `postcss` pinned to `^8.5.14` so transitive Vite/Tailwind resolvers share one patch line.
- `picomatch` pinned to `^4.0.4` so Vite, Vitest, Fumadocs, and Tailwind plugins share one version.

Security-driven overrides — each clears one or more advisories from `pnpm audit --prod --audit-level=moderate`:

- `rollup` pinned to `^4.59.0` to patch GHSA `1113515` (Arbitrary File Write via Path Traversal, high). Reached transitively through `apps/docs > @tailwindcss/vite > vite > rollup`. Sunset when `@tailwindcss/vite` ships a `vite` peer that resolves rollup `>= 4.59.0` naturally.
- `vite` pinned to `^7.3.2` to patch GHSA `1116232` (`server.fs.deny` bypass with queries, high), `1116235` (Arbitrary File Read via dev-server WebSocket, high), and `1116230` (Path Traversal in optimized deps `.map` handling, moderate). Reached transitively through `apps/docs > @tailwindcss/vite > vite`. Sunset when `@tailwindcss/vite` declares a `vite` peer floor at `>= 7.3.2`.
- `undici` pinned to `^7.24.0` to patch GHSA `1114591`, `1114637`, `1114639` (WebSocket frame/length and decompression issues, high), plus `1114593`, `1114641`, `1114643` (HTTP smuggling, CRLF injection, DeduplicationHandler memory, moderate). Reached transitively through `apps/docs > @tanstack/react-start > @tanstack/start-plugin-core > cheerio > undici`. Sunset when `cheerio` ships with `undici >= 7.24.0`.
- `path-to-regexp` pinned to `^8.4.0` to patch GHSA `1115573` (DoS via sequential optional groups, high) and `1115582` (ReDoS via multiple wildcards, moderate). Reached transitively through `apps/docs > fumadocs-core > path-to-regexp`. Sunset when `fumadocs-core` declares `path-to-regexp >= 8.4.0`.

Note: `@tanstack/start-server-core` is NOT pinned because the natural transitive resolution from `@tanstack/react-start` is required to keep `@tanstack/start-plugin-core` and `@tanstack/start-server-core` version-compatible. The moderate advisories that this pin would have cleared (GHSA 1118887 + 3 h3 transitives) remain visible in `pnpm audit --audit-level=moderate` output; they do not fail CI under the HIGH-only gate.

Workspace package manifests should keep declared ranges compatible with the override (e.g., declare `^25.2.3` for `@types/node` rather than `^22`), so an override removal does not silently regress a package to an older major.

`commander` intentionally is **not** overridden. `cli/add` and `libs/registry` declare `^13`, but external dependencies still pull majors 4 / 11 / 14; collapsing them would require validating each transitive consumer.

### Upgrade cadence

- **Security advisories**: patch immediately. Run `pnpm audit --prod --audit-level=moderate` before every release and review new advisories. Bumps that resolve high/critical advisories may add or update an override line.
- **Patch and minor drift**: bump opportunistically alongside related work. Re-run `pnpm dedupe --check` after a bump and update the override if a new duplicate appears.
- **Major drift**: review quarterly. Each major bump (TypeScript, Vite, Vitest, React, Tailwind, Next, Hono, fumadocs, TanStack) requires its own task and changeset because of the public-API blast radius.
- **CI audit gate**: the release-readiness workflow runs `pnpm audit --prod --audit-level=high` as a **hard gate**. HIGH and critical advisories block release. Moderate advisories surface in the audit output but do not fail the build; review them and patch where reasonable. Overrides for known-unfixable transitive advisories are listed in the Overrides section of this document; each override has a stated sunset condition.

### Verifying overrides

```bash
pnpm install
pnpm dedupe --check
pnpm outdated -r
pnpm audit --prod --audit-level=moderate
```

`pnpm dedupe --check` exits non-zero if a new transitive duplicate appears; either add the package to overrides or accept the duplicate with a note in the next governance update.

## Security and Support Packaging

All public package tarballs include package-local `SECURITY.md` and `SUPPORT.md` files in addition to README and license files. The root `SECURITY.md` and `SUPPORT.md` remain the canonical repository policy copies; package-local files carry the same reporting URLs with package-specific triage language.

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

These commands are public only after both packages are published. Runtime consumers must import Tailwind CSS v4, `@diffgazer/ui/sources.css`, and `@diffgazer/ui/styles.css` from their global CSS entrypoint.

### `@diffgazer/add`

Use with `npx @diffgazer/add ...`, package-manager `dlx` equivalents, or a global install after publication. The binary name is `dgadd`.

### `@diffgazer/keys`

Use as a runtime package for `KeyboardProvider` and hooks after publication, or copy standalone hooks through `npx @diffgazer/add add keys/...`.

## Hosted Registry Status

The hosted shadcn-style registry at `https://r.b4r7.dev` is **not yet live**. DNS for `r.b4r7.dev` does not resolve to a serving registry yet, so every `npx shadcn add https://r.b4r7.dev/r/...` snippet in READMEs and docs is gated as future use until publication.

Until the hosted registry endpoints serve `200 OK` for `/r/ui/registry.json`, `/r/ui/<item>.json`, and `/r/keys/<item>.json`, use one of the supported install paths:

- `dgadd` CLI from a locally packed `@diffgazer/add` tarball: `pnpm exec dgadd add ui/button`.
- Runtime npm packages from locally packed tarballs: `npm install ./diffgazer-ui-*.tgz ./diffgazer-keys-*.tgz`.
- Direct file copy from GitHub: `https://github.com/b4r7x/diffgazer/tree/main/libs/ui/registry/ui/<component>`.

After deployment, hosted-registry availability is verified by:

1. `host r.b4r7.dev` resolves to the deploy target.
2. `curl -fI https://r.b4r7.dev/r/ui/registry.json` returns `200`.
3. `curl -fI https://r.b4r7.dev/r/ui/button.json` returns `200`.
4. A CI smoke step in the release-readiness workflow asserts the same three responses on every release run.

Once those checks pass, un-gate the hosted-shadcn install snippets in `README.md`, `libs/ui/README.md`, `libs/keys/README.md`, and `apps/docs/content/docs/**/*.mdx`, and remove the "future" preambles introduced by T-DIST-DEPLOY.

The JSON `$schema` references at `https://diffgazer.com/schema/diffgazer.json` inside `libs/{ui,keys}/public/r/*.json` are machine references for shadcn tooling, not install commands. They are not user-facing and do not need gating.

## Migration and Support

- Runtime package consumers update with their package manager and follow changelog/migration notes.
- Copy-first consumers update manually with `npx @diffgazer/add diff` and selective `npx @diffgazer/add add --overwrite` after publication, or the same `dgadd` commands from a locally packed CLI.
- Bug reports go to GitHub Issues. Security reports should be sent privately to maintainers.

## Licensing

Diffgazer ships under a two-license split that matches each package's distribution model.

- **MIT** covers `libs/keys`, `libs/ui`, `libs/registry`, `cli/add` (`@diffgazer/add`), and the root repository LICENSE. These packages are intended for copy-paste shadcn-style consumption and npm install paths, so MIT keeps integration friction minimal and matches the dominant license in the surrounding ecosystem.
- **Apache-2.0** covers `cli/diffgazer`. The end-user CLI carries explicit patent grant and attribution requirements that suit a distributable binary entry point.

Every published package directory contains its own `LICENSE` file so the license travels with both npm tarballs and direct registry copies. The root `LICENSE` mirrors `libs/ui/LICENSE` (MIT) and applies to non-package source, documentation, and tooling. Contributions are accepted under the license of the directory they touch; cross-license movement requires an explicit relicensing note in the changeset.
