# Package Governance

This document defines the current package, artifact, release, and support contracts for the Diffgazer monorepo.

## Package Set

Public package targets:

- `diffgazer` - product CLI, binary `diffgazer`, Node >= 22.
- `@diffgazer/add` - registry installer CLI, binary `dgadd`, Node >= 22.
- `@diffgazer/ui` - React `>=19.2.0` component package, Node >= 22.
- `@diffgazer/keys` - React `>=19.2.0` keyboard hooks package, Node >= 22.

All four published packages declare a single `engines.node: ">=22.0.0"` floor (ink 7's TUI runtime requires Node 22, and CI and Docker run Node 22). The `check-invariants` script asserts this floor is uniform across the published surface so it cannot drift.

**Publish status is per package.** `diffgazer` is live on npm (`npm view diffgazer version` returns a version). The scoped libraries (`@diffgazer/add`, `@diffgazer/ui`, `@diffgazer/keys`) remain gated until `npm view` succeeds for each:

```bash
npm view diffgazer version
npm view @diffgazer/add version
npm view @diffgazer/ui version
npm view @diffgazer/keys version
```

A 404 on a scoped package means that install path is still gated. See [Hosted Registry Status](#hosted-registry-status) for the registry-endpoint checks.

Workspace-only packages:

- `@diffgazer/registry` - private registry, artifact, and CLI workflow tooling.
- `@diffgazer/core`, `@diffgazer/server` (lives at `cli/server`, internal to the `diffgazer` CLI), `@diffgazer/web`, `@diffgazer/docs` - app/runtime internals.

Artifact handoff:

- `@diffgazer/ui` builds docs and registry artifacts into its own `dist/artifacts`; there is no `@diffgazer/ui-artifacts` package.
- `@diffgazer/keys` builds artifacts into `dist/artifacts`; there is no public `@diffgazer/keys-artifacts` package.
- `@diffgazer/docs prepare:generated` synchronizes only from the prepared `libs/ui/dist/artifacts` and `libs/keys/dist/artifacts` workspace trees.
- Artifact validation is non-mutating and must fail on fingerprint drift, missing manifest inputs, stale/tampered copied artifact directories, stale docs-host sync outputs, and copied artifact mirror drift.

## Artifact Packaging

`dist/artifacts` directories in `@diffgazer/ui` and `@diffgazer/keys` are excluded from npm
tarballs by design. These directories contain registry metadata used by the docs build
pipeline — not consumer-facing code.

The docs site always deploys from the monorepo workspace, where `dist/artifacts` is available
after `pnpm run prepare:library-artifacts`. Deploying docs from published npm packages is not
a supported path.

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

`pnpm run test-ci` runs artifact preparation, validation, type-check, tests, strict smoke, and monorepo verification. It is the CI-safe local pre-release gate. The release workflow uses `pnpm run release-check`, which runs the same gate families plus package pack dry-runs.

`pnpm run release-check` runs the full no-publish release readiness sequence: artifact prep, artifact validation, type-check, tests, strict smoke, package smoke, pack dry-runs for all public packages, monorepo verification, and `git diff --check`. It does not run `changeset publish`.

`smoke:packages` currently covers local tarball installs, all exported `@diffgazer/ui` subpaths, CSS export resolution, React SSR rendering, strict NodeNext type checking, and the shared React `>=19.2.0` floor. Public handoff also requires clean consumer checks in Vite and Next apps with npm, pnpm, yarn, and bun after the packages are actually published.

The checked-in release-readiness workflow wires to the root scripts above and blocks public handoff when install, build, generated-file cleanliness, verify, changeset, smoke, or pack checks fail. It is verification-only; it must not call production webhooks, read Coolify secrets, or trigger production deploys.

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

## Public Surface Deployment

Public hosting is separate from package publishing. Production deploys are manual
only through `.github/workflows/deploy.yml` and are limited to docs, registry,
and landing. The workflow requires `confirm_production=deploy`, refuses
non-`main` refs, pushes SHA-tagged GHCR images, scans those pushed images, waits
for the `production` environment approval, promotes the scanned SHA tags to
`:prod`, and calls the selected Coolify webhooks.

Docs and registry deploy together from the same SHA. Landing may deploy
separately. The `diffgazer` CLI, embedded server, and web app are not VPS public
deploy targets.

Coolify production resources are three separate Docker Image resources with Auto
Deploy off:

- `ghcr.io/b4r7x/diffgazer-docs:prod`
- `ghcr.io/b4r7x/diffgazer-registry:prod`
- `ghcr.io/b4r7x/diffgazer-landing:prod`

There is no Docker Compose deployment path for the public surfaces. Deployment
setup, secret boundaries, public checks, and rollback steps are documented in
[`deploy/PUBLIC_DEPLOYMENT.md`](./deploy/PUBLIC_DEPLOYMENT.md).

## Package Build Guards

Package lifecycle guards currently in the repo:

- `diffgazer`: `prepack` runs the package build; `build` first runs the required workspace dependency builds for `@diffgazer/core`, `@diffgazer/server`, `@diffgazer/keys`, `@diffgazer/ui`, and `@diffgazer/web`.
- `@diffgazer/add`: `prepublishOnly` runs build, type-check, test, and root artifact validation.
- `@diffgazer/ui`: `prepublishOnly` runs build, type-check, test, and root artifact validation.
- `@diffgazer/keys`: `prepublishOnly` runs build, type-check, test, and root artifact validation.

The release-readiness workflow must also run pack dry-runs for all public packages: `diffgazer`, `@diffgazer/add`, `@diffgazer/ui`, and `@diffgazer/keys`.

## Publish Metadata

Public packages are published through the root `pnpm run release` script. Its targeted publisher derives the pending Version-PR set from package version changes between `HEAD^` and `HEAD`, checks registry versions, preflights every pending package against the first-publish gate, and publishes each missing version with a separate filtered `pnpm publish` invocation. Provenance is supplied by each package's `publishConfig.provenance` plus `NPM_CONFIG_PROVENANCE=true` in the release workflow env under GitHub OIDC. `publishConfig.provenance` also makes one-off `npm publish` calls use the same provenance policy. Scoped public packages set `publishConfig.access` to `public`. The `author` field is uniform across the four published packages (`"author": "diffgazer"`); the `license` field intentionally splits MIT vs Apache-2.0 per the [Licensing](#licensing) section.

`@diffgazer/keys-artifacts` is private and exists only as a workspace mirror for docs artifact handoff; it is not a public package target.

### Publish Flow

Publishing runs from `.github/workflows/release.yml` via `changesets/action`:

1. A contributor adds a changeset on their PR (`pnpm run changeset`); merging the PR to `main` triggers the release workflow, which opens (or updates) a `chore: version packages` PR that applies pending changesets, bumps versions, and updates CHANGELOGs.
2. Merging the Version PR re-triggers the workflow, which runs `pnpm run release-check` and then `pnpm run release` under GitHub OIDC so npm records provenance attestations. `pnpm run release` runs the targeted publisher in `scripts/monorepo/guard-publish.mjs`.
3. The workflow requires `secrets.NPM_TOKEN` until each public package is configured for npm Trusted Publishers; once trusted publishing is enabled per package on npmjs.com, the token becomes optional.

#### First-publish gate

An unfiltered workspace publisher would publish every public package whose version is absent from npm, including unrelated gated packages. To keep each npm gate mechanical, `pnpm run release` delegates publication to `scripts/monorepo/guard-publish.mjs`. The default invocation compares each non-private workspace package's current version with its version in `HEAD^`; only packages versioned by the commit are pending, so an older never-published workspace package is not mistaken for part of the current Version PR. The publisher reads registry versions for that pending set and rejects the whole run before `pnpm` starts if any pending, never-published package is absent from `FIRST_PUBLISH_ALLOWLIST`. Today the allowlist is `["diffgazer"]`, so un-gating one scoped package is an explicit reviewed PR adding only its name to the allowlist (alongside the `npm view` go-live checks above). Maintainers may pass explicit package names to select the recovery set manually; the same whole-set preflight applies.

#### Recovery from publish failure

If the publish step fails after the Version PR is merged (network blip, npm registry error, transient runner issue), first re-run the failed `Release` workflow run from the GitHub Actions UI. Packages are published one at a time. A retry derives the same pending set from the checked-out Version PR commit, skips any exact versions already present on npm, and still emits one exact `New tag: <name>@<version>` line for every recovered or newly published version after the complete set succeeds. This lets `changesets/action` create the missing Git tag and GitHub Release metadata without attempting a duplicate npm publication.

If that workflow run is wedged, use the same `Release` workflow's **Run workflow** action and provide the full 40-character merged-main Version PR commit as `release_sha`. The `Recover Publish from Merged Main SHA` job validates that the selected commit is already contained in `main`, waits for approval through the protected `production` environment, and runs the normal release-readiness and first-publish-protected release chain on a GitHub-hosted runner with OIDC provenance. Do not run the publish command locally: local token authentication does not provide the supported CI identity required by the package provenance policy. For any failure, open an issue or contact a maintainer before starting recovery so the team can confirm registry state first.

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

The root `pnpm-workspace.yaml` carries the `overrides` block to keep shared transitive packages on a single version across the workspace. The current pins collapse duplicates that otherwise drift across apps and tooling:

- `@types/node` pinned to `^25.2.3` so docs, registry, ui, keys, server, core, and cli packages resolve to one major.
- `@types/react` pinned to `^19.2.13` and `@types/react-dom` pinned to `^19.2.3` so the whole workspace resolves to one React 19.2 type line, matching the shared React `>=19.2.0` runtime floor. Declared package ranges stay on the 19.2 line (`@diffgazer/core` declares `^19.2.13`, ui/keys/docs `^19.2.0`, web/landing/diffgazer `^19.2.13`); the override collapses them to a single resolution so a stray `^19.1` cannot reappear.
- `tailwindcss` pinned to `^4.3.0` so `apps/web` and `apps/docs` resolve to one minor (no `4.2.x` / `4.3.x` split).
- `postcss` pinned to `^8.5.14` so transitive Vite/Tailwind resolvers share one patch line.
- `picomatch` pinned to `^4.0.4` so Vite, Vitest, Fumadocs, and Tailwind plugins share one version.
- `vitest` pinned to `^4.1.0`, `@testing-library/react` to `^16.3.2`, `@testing-library/jest-dom` to `^6.9.1`, `jsdom` to `^28.1.0`, `@vitejs/plugin-react` to `^5.1.3`, and `axe-core` to `^4.11.4` so every workspace that imports a test tool resolves to one shared version of each (no `vitest 4.0` / `4.1`, `jsdom 27` / `28`, `@testing-library/react 16.0` / `16.2` / `16.3`, or `@vitejs/plugin-react 5.0` / `5.1` split).

The same workspace file restricts dependency install scripts through `allowBuilds`. Only the
reviewed lockfile versions `esbuild@0.27.3` and `sharp@0.34.5` may run their required native
build/install steps. The optional `msw` postinstall is explicitly disabled because the workspace
does not need its interactive setup. Version-qualified approvals are intentional: a dependency
update must review and update the approval instead of silently granting script execution to a new
release.
- `jiti` (`^2.7.0`), `hono` (`^4.12.25`), and `ws` (`^8.21.0`) are pinned so the config loader, the embedded server framework, and the WebSocket dependency each resolve to one version across the workspace and its dev/build tooling.

The `@tanstack/react-router` range is kept aligned across `apps/web` and `apps/docs` (both declare `^1.158.1`) so the two TanStack-Router consumers track one router minor; it is not overridden because the rest of the TanStack Start surface in `apps/docs` resolves its router transitively.

Security-driven overrides — each clears one or more advisories from `pnpm audit --prod --audit-level=moderate`:

- `rollup` pinned to `^4.59.0` to patch GHSA `1113515` (Arbitrary File Write via Path Traversal, high). Reached transitively through `apps/docs > @tailwindcss/vite > vite > rollup`. Sunset when `@tailwindcss/vite` ships a `vite` peer that resolves rollup `>= 4.59.0` naturally.
- `vite` pinned to `^7.3.5` to patch GHSA `1116232` (`server.fs.deny` bypass with queries, high), `1116235` (Arbitrary File Read via dev-server WebSocket, high), and `1116230` (Path Traversal in optimized deps `.map` handling, moderate). Reached transitively through `apps/docs > @tailwindcss/vite > vite`. The advisories were patched at `7.3.2`; the pin tracks the current patch. Sunset when `@tailwindcss/vite` declares a `vite` peer floor at `>= 7.3.5`.
- `undici` pinned to `^7.28.0` to patch GHSA `1114591`, `1114637`, `1114639` (WebSocket frame/length and decompression issues, high), plus `1114593`, `1114641`, `1114643` (HTTP smuggling, CRLF injection, DeduplicationHandler memory, moderate). Reached transitively through `apps/docs > @tanstack/react-start > @tanstack/start-plugin-core > cheerio > undici`. Sunset when `cheerio` ships with `undici >= 7.28.0`.

Additional minimum-version floors added during dependency audit passes hold transitive packages at their patched releases without a full `^` pin: `h3` and its `h3-v2` alias (`>=2.0.1-rc.18`, reached through `apps/docs > @tanstack/react-start`), `fast-uri` (`>=3.1.2`), `express-rate-limit` (`>=8.2.2`), and `qs` (`>=6.15.2`). Drop each once its transitive parent resolves a patched version naturally.

Note: `@tanstack/start-server-core` is NOT pinned because the natural transitive resolution from `@tanstack/react-start` is required to keep `@tanstack/start-plugin-core` and `@tanstack/start-server-core` version-compatible. Its moderate advisory (GHSA 1118887) remains visible in `pnpm audit --audit-level=moderate` output and does not fail CI under the HIGH-only gate; the related h3 advisories are cleared by the `h3` / `h3-v2` floor above rather than by pinning `@tanstack/start-server-core`.

Workspace package manifests should keep declared ranges compatible with the override (e.g., declare `^25.2.3` for `@types/node` rather than `^22`), so an override removal does not silently regress a package to an older major.

`commander` intentionally is **not** overridden. `cli/add` and `libs/registry` declare `^13`, but external dependencies still pull majors 4 / 11 / 14; collapsing them would require validating each transitive consumer.

### Upgrade cadence

- **Security advisories**: patch immediately. Run `pnpm audit --prod --audit-level=moderate` before every release and review new advisories. Bumps that resolve high/critical advisories may add or update an override line.
- **Patch and minor drift**: bump opportunistically alongside related work. Re-run `pnpm dedupe --check` after a bump and update the override if a new duplicate appears.
- **Major drift**: review quarterly. Each major bump (TypeScript, Vite, Vitest, React, Tailwind, Next, Hono, fumadocs, TanStack) requires its own task and changeset because of the public-API blast radius.
- **CI audit gate**: the release-readiness workflow runs `pnpm audit --prod --audit-level=high` as a **hard gate**. HIGH and critical advisories block release. Moderate advisories surface in the audit output but do not fail the build; review them and patch where reasonable. Overrides for known-unfixable transitive advisories are listed in the Overrides section of this document; each override has a stated sunset condition.
- **Secret scan gate**: release readiness runs `pnpm run secret-scan` as a hard gate before build. The scanner reports high-confidence findings with redacted values.
- **Update automation**: Dependabot covers GitHub Actions, Docker base images in `/` and `/deploy`, and npm/pnpm workspace dependencies. Review those PRs with extra attention to workflow, Dockerfile, and public package blast radius.
- **Protected deploy files**: `.github/CODEOWNERS` requires owner review for workflows, deploy Dockerfiles, deploy runbooks, nginx deploy configs, `Dockerfile`, and this governance file.

### Verifying overrides

```bash
pnpm install
pnpm dedupe --check
pnpm outdated -r
pnpm audit --prod --audit-level=moderate
```

`pnpm dedupe --check` exits non-zero if a new transitive duplicate appears; either add the package to overrides or accept the duplicate with a note in the next governance update.

## Security and Support Packaging

All public package tarballs include package-local `SECURITY.md` and `SUPPORT.md` files in addition to README and license files. The root `SECURITY.md` and `SUPPORT.md` remain the canonical repository policy copies. Every security policy doc — the root `SECURITY.md` and each package-local `SECURITY.md` — routes vulnerability reports through both canonical channels: the GitHub private advisory URL and the `b4r7dev@gmail.com` email fallback, differing only in package-specific triage language. Support docs (`SUPPORT.md`) reference security only briefly, so they must not introduce a reporting channel outside root policy but may name a subset of the canonical channels. The `check-invariants` script fails if any `SECURITY.md` omits a canonical channel or any `SUPPORT.md` introduces an off-policy channel. It also enforces README metadata parity: each package README `**Security:**` metadata link must carry every canonical channel, matching what `checkSecurityReportingChannelsAgree` requires of the security docs.

## Consumption Contracts

### `@diffgazer/ui`

Copy-first mode is the canonical customization path:

```bash
npx @diffgazer/add init
npx @diffgazer/add add ui/button
```

These commands are public only after `@diffgazer/add` is published. Before publication, run local package smoke tests or install a locally packed `@diffgazer/add` tarball into a fixture app.

This copies source into the consuming app. The app must configure its own `@/*` TypeScript/bundler alias before `dgadd init` and import the copied CSS entrypoint.

### Local runtime package installation before publication

Until `npm view @diffgazer/ui version` and `npm view @diffgazer/keys version` both succeed, build and pack the packages from a clean local checkout:

```bash
pnpm install --frozen-lockfile
pnpm run prepare:artifacts
pnpm --filter @diffgazer/keys build
pnpm --filter @diffgazer/ui build
mkdir -p .tmp/local-packages
pnpm --filter @diffgazer/keys pack --pack-destination "$PWD/.tmp/local-packages"
pnpm --filter @diffgazer/ui pack --pack-destination "$PWD/.tmp/local-packages"
npm install ./.tmp/local-packages/diffgazer-keys-*.tgz ./.tmp/local-packages/diffgazer-ui-*.tgz
```

Run the final `npm install` from the consuming application and replace the paths with absolute paths to the checkout's tarballs when the consumer is outside this repository. Runtime consumers must import Tailwind CSS v4, `@diffgazer/ui/sources.css`, and `@diffgazer/ui/styles.css` from their global CSS entrypoint.

Public registry installation examples may be added to package READMEs only after both `npm view` checks above pass.

### `@diffgazer/add`

Use with `npx @diffgazer/add ...`, package-manager `dlx` equivalents, or a global install after publication. The binary name is `dgadd`.

### `@diffgazer/keys`

Use as a runtime package for `KeyboardProvider` and hooks after publication, or copy standalone hooks through `npx @diffgazer/add add keys/...`.

## Hosted Registry Status

The hosted shadcn-style registry at `https://r.b4r7.dev` is **not yet live**. DNS for `r.b4r7.dev` does not resolve to a serving registry yet, so every `npx shadcn add https://r.b4r7.dev/r/...` snippet in READMEs and docs is gated as future use until publication.

Until the hosted registry endpoints serve `200 OK` for `/r/ui/registry.json`, `/r/ui/<item>.json`, and `/r/keys/<item>.json`, use one of the supported install paths:

- `dgadd` CLI from a locally packed `@diffgazer/add` tarball: `pnpm exec dgadd add ui/button`.
- Runtime npm packages from locally packed tarballs: `npm install ./diffgazer-ui-*.tgz ./diffgazer-keys-*.tgz`.
- Dependency-closed source archive from the component docs: choose **Copy Full Source**, save the
  copied registry-item JSON as `<component>.registry.json`, then run
  `npx shadcn add ./<component>.registry.json`. The archive includes transitive UI and keys files
  with the same local-import rewrites as `dgadd --integration copy`.

Release readiness runs `pnpm run registry:live-check`. That script reads the docs consumption metadata and skips only while public hosted-registry install commands remain gated. If the registry is ungated, or if `DIFFGAZER_LIVE_REGISTRY_REQUIRED=1` is set, the check is a hard gate.

After deployment or ungating, `registry:live-check` verifies that `r.b4r7.dev` resolves, then
dynamically enumerates every JSON file in the UI, keys, and schema trees copied by
`deploy/registry.Dockerfile`. Every corresponding hosted URL must return `200`, and its raw response
bytes must match the committed file exactly.

Once those checks pass, un-gate the hosted-shadcn install snippets in `README.md`, `libs/ui/README.md`, `libs/keys/README.md`, and `apps/docs/content/docs/**/*.mdx`, and remove the "future" preambles added while the hosted registry was gated.

The committed registry JSON under `libs/ui/public/r` and `libs/keys/public/r` uses the shadcn registry schemas from `https://ui.shadcn.com/schema/`. The Diffgazer config schema is `https://r.b4r7.dev/schema/diffgazer.json`; `dgadd init` writes that URL into consumer `diffgazer.json` files via `REGISTRY_ORIGIN`. The schema file is generated at `apps/docs/public/schema/diffgazer.json` from the `cli/add` config contract, not by the registry item build.

## Migration and Support

- Runtime package consumers update with their package manager and follow changelog/migration notes.
- Copy-first consumers update manually with `npx @diffgazer/add diff` and selective `npx @diffgazer/add add --overwrite` after publication, or the same `dgadd` commands from a locally packed CLI.
- Bug reports go to GitHub Issues. Security reports should be sent privately to maintainers.

## Licensing

Diffgazer ships under a two-license split that matches each package's distribution model.

- **MIT** covers `libs/keys`, `libs/ui`, `libs/registry`, `cli/add` (`@diffgazer/add`), and the root repository LICENSE. These packages are intended for copy-paste shadcn-style consumption and npm install paths, so MIT keeps integration friction minimal and matches the dominant license in the surrounding ecosystem.
- **Apache-2.0** covers `cli/diffgazer`, together with the private `cli/server` (`@diffgazer/server`) and `libs/core` (`@diffgazer/core`) packages bundled into that binary via tsup `noExternal`. All three declare `Apache-2.0` and carry their own Apache `LICENSE` file. The end-user CLI carries explicit patent grant and attribution requirements that suit a distributable binary entry point.

Every published package directory contains its own `LICENSE` file so the license travels with both npm tarballs and direct registry copies. The root `LICENSE` mirrors `libs/ui/LICENSE` (MIT) and applies to non-package source, documentation, and tooling. Contributions are accepted under the license of the directory they touch; cross-license movement requires an explicit relicensing note in the changeset.
