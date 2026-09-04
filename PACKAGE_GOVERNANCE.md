# Package Governance

This document defines the current package, artifact, release, and support contracts for the Diffgazer monorepo.

## Package Set

Public package targets:

- `diffgazer` - product CLI, binary `diffgazer`, Node >= 22.
- `@diffgazer/add` - registry installer CLI, binary `dgadd`, Node >= 22.
- `@diffgazer/ui` - React `>=19.2.0` component package, Node >= 22.
- `@diffgazer/keys` - React `>=19.2.0` keyboard hooks package, Node >= 22.

All four published packages declare a single `engines.node: ">=22.0.0"` floor (ink 7's TUI runtime requires Node 22, and CI and Docker run Node 22). The `check-invariants` script asserts this floor is uniform across the published surface so it cannot drift.

**Publish status is per package.** Four packages are release-managed here — they take changesets, get versioned, and keep CHANGELOGs — but that is not the same as being publishable. Only `diffgazer` publishes today; it is live on npm (`npm view diffgazer version` returns a version). The scoped libraries (`@diffgazer/add`, `@diffgazer/ui`, `@diffgazer/keys`) are versioned locally but blocked from npm by the [first-publish gate](#first-publish-gate), and they remain gated until `npm view` succeeds for each:

```bash
npm view diffgazer version
npm view @diffgazer/add version
npm view @diffgazer/ui version
npm view @diffgazer/keys version
```

A 404 on a scoped package means that install path is still gated — expected, not a release failure. A release run whose pending set is `diffgazer` alone is the normal shape; a run whose pending set includes a scoped package fails the preflight by design. See [Hosted Registry Status](#hosted-registry-status) for the registry-endpoint checks.

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
pnpm run release-check
pnpm run changeset
pnpm run version-packages
pnpm run release
```

`pnpm run verify` runs monorepo invariants, type checks, tests, and smoke checks. `pnpm run smoke:packages` packs local workspace packages into temporary projects and verifies public imports/bins; it does not install from the public npm registry.

The `verify` chain runs `verify:monorepo`, artifact validation, the secret scan, `check` (Biome,
deploy-runbook, Turbo, dependency-cruiser, and Knip checks), `test:scripts`, Turbo
type-check/test/test-types, smoke, and the benchmark. It does not invoke `release-check`.

`pnpm run release-check` is an independent no-publish chain. It runs the production audit, secret
scan, build, package checks, artifact validation, `check`, `test:scripts`, Turbo type-check/test/
test-types, the package smoke (`smoke:packages`), the provider web E2E spec on chromium, the docs
build, the changeset coverage check, all four public-package pack dry-runs, `verify:monorepo`, and
`git diff --check`. It does not run the full smoke matrix, the benchmark SLOs, the embedded-production
web suite, or the live registry check. The `test:scripts` glob already includes the
provider-transport legacy-allowlist test; `release-check` repeats that exact test directly near the
end of the chain. The changeset check compares against the merge base with `main`, so it only
examines a branch's own changes: it bites on a local pre-release run from a feature branch, and on
the Release workflow's merged-main checkout the merge base is `HEAD`, so it passes without examining
anything — the same reason CI runs that step on pull requests only. It does not invoke
`changeset publish`.

`smoke:packages` currently covers local tarball installs, all exported `@diffgazer/ui` subpaths, CSS export resolution, React SSR rendering, strict NodeNext type checking, and the shared React `>=19.2.0` floor. Public handoff also requires clean consumer checks in Vite and Next apps with npm, pnpm, yarn, and bun after the packages are actually published.

Of the root scripts above, the checked-in CI workflow runs only `pnpm run build`; `release-check` runs in the Release workflow before publishing, and `verify` and a standalone `smoke:packages` are local commands. CI blocks public handoff when the install, production audit, secret scan, build, generated-file cleanliness, package, changeset, type-check, test, or whitespace checks fail. It is verification-only; it must not call production webhooks, read Coolify secrets, or trigger production deploys.

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
   pnpm run release diffgazer
   ```

   Name the packages explicitly while the scoped libraries are gated. `version-packages` bumps every package that had a changeset, so a bare `pnpm run release` derives a pending set containing `@diffgazer/ui`, `@diffgazer/keys`, and `@diffgazer/add`, and the [first-publish gate](#first-publish-gate) then rejects the whole run — `diffgazer` included. Passing the names selects the publishable subset; the same preflight still applies to it. Drop the argument once every name in the pending set is un-gated.

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
non-`main` refs, requires a green CI run for the deployed SHA, pushes SHA-tagged
GHCR images, scans each pushed image by its manifest digest, runs promotion under
the `production` environment, repoints `:prod` at the scanned digests, calls the
selected Coolify webhooks, and rolls the promotion back when the post-deploy
verification fails.

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

- `diffgazer`: `prepack` owns the build — it fires on every pack, including the smoke tarball install, `attw --pack`, and the release-check dry-run, so the package suite must not hang off it; `prepublishOnly` runs type-check and test. `build` first runs the required workspace dependency builds for `@diffgazer/core`, `@diffgazer/server`, `@diffgazer/keys`, `@diffgazer/ui`, and `@diffgazer/web`.
- `@diffgazer/add`: `prepack` owns the build; `prepublishOnly` runs type-check, test, and root artifact validation.
- `@diffgazer/ui`: `prepublishOnly` runs build, type-check, test, and root artifact validation.
- `@diffgazer/keys`: `prepublishOnly` runs build, type-check, test, and root artifact validation.

`release-check`, which the Release workflow runs before publishing, must also run pack dry-runs for all public packages: `diffgazer`, `@diffgazer/add`, `@diffgazer/ui`, and `@diffgazer/keys`.

## Publish Metadata

Public packages are published through the root `pnpm run release` script. Its targeted publisher derives the pending Version-PR set from package version changes between `HEAD^` and `HEAD`, checks registry versions, preflights every pending package against the first-publish gate, and publishes each missing version with a separate filtered `pnpm publish` invocation. Provenance is supplied by each package's `publishConfig.provenance` plus `NPM_CONFIG_PROVENANCE=true` in the release workflow env under GitHub OIDC. `publishConfig.provenance` also makes one-off `npm publish` calls use the same provenance policy. Scoped public packages set `publishConfig.access` to `public`. The `author` field is uniform across the four published packages (`"author": "diffgazer"`); the `license` field intentionally splits MIT vs Apache-2.0 per the [Licensing](#licensing) section.

`@diffgazer/keys-artifacts` is private and exists only as a workspace mirror for docs artifact handoff; it is not a public package target.

### Publish Flow

Publishing runs from `.github/workflows/release.yml` via `changesets/action`:

1. A contributor adds a changeset on their PR (`pnpm run changeset`); merging the PR to `main` runs CI, and a green CI run on `main` triggers the release workflow, which opens (or updates) a `chore: version packages` PR that applies pending changesets, bumps versions, and updates CHANGELOGs.
2. The Version PR is opened with `GITHUB_TOKEN`. GitHub does not trigger `pull_request` workflows for events created by that token, so the Version PR intentionally receives zero CI checks while open; no GitHub App or PAT is added. After it merges, the trusted push-to-main CI run verifies the merged commit, and its success triggers the release workflow, which runs `pnpm run release-check` and then `pnpm run release` under GitHub OIDC so npm records provenance attestations. `pnpm run release` runs the targeted publisher in `scripts/monorepo/guard-publish.mjs`.
3. The workflow requires `secrets.NPM_TOKEN` until each public package is configured for npm Trusted Publishers; once trusted publishing is enabled per package on npmjs.com, the token becomes optional.

#### First-publish gate

An unfiltered workspace publisher would publish every public package whose version is absent from npm, including unrelated gated packages. To keep each npm gate mechanical, `pnpm run release` delegates publication to `scripts/monorepo/guard-publish.mjs`. The default invocation compares each non-private workspace package's current version with its version in `HEAD^`; only packages versioned by the commit are pending, so an older never-published workspace package is not mistaken for part of the current Version PR. The publisher reads registry versions for that pending set and rejects the whole run before `pnpm` starts if any pending, never-published package is absent from `FIRST_PUBLISH_ALLOWLIST`. Today the allowlist is `["diffgazer"]`, so un-gating one scoped package is an explicit reviewed PR adding only its name to the allowlist (alongside the `npm view` go-live checks above). Maintainers may pass explicit package names to select the recovery set manually; the same whole-set preflight applies.

#### Recovery from publish failure

If the publish step fails after the Version PR is merged (network blip, npm registry error, transient runner issue), first re-run the failed `Release` workflow run from the GitHub Actions UI. Packages are published one at a time. A retry derives the same pending set from the checked-out Version PR commit, skips any exact versions already present on npm, and still emits one exact `New tag: <name>@<version>` line for every recovered or newly published version after the complete set succeeds. This lets `changesets/action` create the missing Git tag and GitHub Release metadata without attempting a duplicate npm publication.

If that workflow run is wedged, use the same `Release` workflow's **Run workflow** action and provide the full 40-character merged-main Version PR commit as `release_sha`. The `Recover Publish from Merged Main SHA` job validates that the selected commit is already contained in `main`, requires the CI run for that exact commit to have completed with every required job green, binds the job to the `production` environment, and then runs `pnpm run release-check` followed by the first-publish-protected release chain on a GitHub-hosted runner with OIDC provenance. The checked-in workflow does not prove a protected `production` environment or required reviewer approval; those rules live in repository settings.

`release-check` is defence in depth, not a replacement for the exact-SHA CI evidence. It does not repeat the event-range Gitleaks scan (the action scans the current push or pull-request commit range; `fetch-depth: 0` does not make that scan full-history) or the `git status --short` dirty-tree guard after build. It does not run the full smoke matrix, the live models.dev fetch enabled by `DIFFGAZER_SMOKE_ALLOW_NETWORK=1`, the benchmark SLOs, or the remaining browser matrix (the docs Playwright suite, the broader web suite, the UI and landing suites, and the Lighthouse budgets) — those are local-only gates — nor the live registry check, which belongs to the deploy workflow: it runs after a `docs-registry` or `all` promote and rolls the promotion back when it fails. It still runs the provider web E2E spec listed above. Do not run the publish command locally: local token authentication does not provide the supported CI identity required by the package provenance policy. For any failure, open an issue or contact a maintainer before starting recovery so the team can confirm registry state first.

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

- `@types/node` pinned to `^22.10.0` so workspace checks use the same Node major as CI and the repository's executable packages. Every Node-typed workspace declares that range, and every package with a Node engine declaration requires Node 22.
- `@types/react` pinned to `^19.2.13` and `@types/react-dom` pinned to `^19.2.3` so the whole workspace resolves to one React 19.2 type line, matching the shared React `>=19.2.0` runtime floor. Declared package ranges stay on the 19.2 line (`@diffgazer/core` declares `^19.2.13`, ui/keys/docs `^19.2.0`, web/landing/diffgazer `^19.2.13`); the override collapses them to a single resolution so a stray `^19.1` cannot reappear.
- `tailwindcss` pinned to `^4.3.0` so `apps/web` and `apps/docs` resolve to one minor (no `4.2.x` / `4.3.x` split).
- `postcss` pinned to `^8.5.18` so transitive Vite/Tailwind resolvers share one patch line, at or above the patched release for the high-severity advisory affecting `postcss <= 8.5.17`.
- `picomatch` pinned to `^4.0.4` so Vite, Vitest, Fumadocs, and Tailwind plugins share one version.
- `vitest` pinned to `^4.1.0`, `@testing-library/react` to `^16.3.2`, `@testing-library/jest-dom` to `^6.9.1`, `jsdom` to `^28.1.0`, `@vitejs/plugin-react` to `^5.1.3`, and `axe-core` to `^4.11.4` so every workspace that imports a test tool resolves to one shared version of each (no `vitest 4.0` / `4.1`, `jsdom 27` / `28`, `@testing-library/react 16.0` / `16.2` / `16.3`, or `@vitejs/plugin-react 5.0` / `5.1` split).

The same workspace file restricts dependency install scripts through `allowBuilds`. That block is the
complete install-script decision list for this workspace, and every entry in it is reviewed here:

- `esbuild@0.27.3` — allowed. Fetches or builds the platform binary the bundler needs in order to run.
- `sharp@0.35.3` — allowed. Builds the libvips binding the docs image pipeline needs; the approved
  version tracks the `sharp` override floor listed below.
- `node-pty@1.1.0` — allowed. Builds the native pty binding the CLI smoke harness
  `scripts/monorepo/smoke-cli/product.mjs` spawns terminals with. Its install script is the one
  `patches/node-pty@1.1.0.patch` amends, so that the prebuilt `spawn-helper` is made executable. The
  root devDependency, build approval, resolved package, and patch all pin `1.1.0`.
- `msw` — denied. The optional postinstall is turned off because the workspace does not need its
  interactive setup.

Every positive approval is exact-version-qualified. A dependency update must review the approval
instead of silently granting script execution to a new release. `check-invariants` rejects a positive
approval that is absent from the lockfile or out of step with its root dependency or patch. It also
fails when an `allowBuilds` key is missing from this section, so the block and this list cannot drift
apart.
- `jiti` (`^2.7.0`), `hono` (`^4.12.34`), and `ws` (`^8.21.0`) are pinned so the config loader, the embedded server framework, and the WebSocket dependency each resolve to one version across the workspace and its dev/build tooling. The `hono` floor is also security-driven — see the overrides list below.

The same file enables pnpm's 24-hour release-age quarantine with `minimumReleaseAge: 1440` (minutes). The temporary `minimumReleaseAgeExclude` exception for `hono@4.12.34` expired after the patched release passed that window and was removed; future emergency exceptions must be reviewed here and removed once they age out.

The `@tanstack/react-router` range is kept aligned across `apps/web` and `apps/docs` (both declare `^1.170.18`) so the two TanStack-Router consumers track one router minor; it is not overridden because the rest of the TanStack Start surface in `apps/docs` resolves its router transitively. That transitive resolution is why the two ranges must move together with `@tanstack/react-start`: `@tanstack/react-start` depends on an exact `@tanstack/react-router`, and when the app's own router resolves to a different version the docs prerender crashes in `dehydrate` with two router instances loaded. Bump `@tanstack/react-start` and both app ranges in one change, then re-run `pnpm --filter @diffgazer/docs build`.

Security-driven overrides — each clears one or more advisories from `pnpm audit --prod --audit-level=moderate`:

- `rollup` pinned to `^4.59.0` to patch GHSA `1113515` (Arbitrary File Write via Path Traversal, high). Reached transitively through `apps/docs > @tailwindcss/vite > vite > rollup`. Sunset when `@tailwindcss/vite` ships a `vite` peer that resolves rollup `>= 4.59.0` naturally.
- `vite` pinned to `^7.3.5` to patch GHSA `1116232` (`server.fs.deny` bypass with queries, high), `1116235` (Arbitrary File Read via dev-server WebSocket, high), and `1116230` (Path Traversal in optimized deps `.map` handling, moderate). Reached transitively through `apps/docs > @tailwindcss/vite > vite`. The advisories were patched at `7.3.2`; the pin tracks the current patch. Sunset when `@tailwindcss/vite` declares a `vite` peer floor at `>= 7.3.5`.
- `undici` pinned to `^7.29.0` to patch GHSA `1114591`, `1114637`, `1114639` (WebSocket frame/length and decompression issues, high), GHSA-4cwx-7wf7-3272 (cross-user information disclosure and parse-time crash via degenerate private cache directives, high, affects `>=7.0.0 <7.29.0`), plus `1114593`, `1114641`, `1114643` (HTTP smuggling, CRLF injection, DeduplicationHandler memory, moderate). This one is no longer transitive-only: `cli/server` declares `undici` directly (for per-dispatch response timeouts — `responseTimeoutDispatcher` builds pooled `Agent`s whose `headersTimeout`/`bodyTimeout` sit just above the dispatch wall, so the deadline the diagnostic names is the one that fires instead of the runtime client's fixed 300s default), and because `undici` is not among `cli/diffgazer`'s own dependencies it is inlined by tsup rather than left external, so the vulnerable code would ship inside the published `diffgazer` binary. It is also still reached transitively through `apps/docs > @tanstack/react-start > @tanstack/start-plugin-core > cheerio > undici`. Sunset never — this is the workspace floor, raise it with each advisory.
- `hono` pinned to `^4.12.34` to patch GHSA-8j4g-w8fx-2239 (CORS middleware ReDoS, affects `< 4.12.34`). This one is not transitive: `cli/server` and `cli/diffgazer` declare `hono` directly and `cli/server` uses `hono/cors`, so the vulnerable code would ship inside the published `diffgazer` binary. Sunset never — this is the workspace floor, raise it with each advisory.
- `js-yaml@4` pinned to `^4.3.0` to clear the high-severity YAML merge-key quadratic-CPU advisory (affects `>=4.0.0 <4.3.0`). Reached transitively through `apps/docs > @tanstack/react-start > @tanstack/start-plugin-core > xmlbuilder2 > js-yaml` and `apps/docs > fumadocs-mdx > js-yaml`. The override is deliberately range-scoped to the v4 line: a blanket `js-yaml` override would force v4 onto the v3 consumers `read-yaml-file` and `@lhci/utils`, which call the v4-removed `safeLoad` API and sit on the release path. Sunset when the v4 consumers resolve a patched version naturally.
- `sharp` pinned to `^0.35.0` to clear the high-severity inherited libvips advisory (affects `< 0.35.0`). Reached transitively through `apps/docs > fumadocs-core > next > sharp`; `next` still declares `sharp` as an optional dependency on the `^0.34.5` line, so the patched floor needs the override. The matching install-script approval is `sharp@0.35.3`. Sunset when `next` declares an optional `sharp` range at `>= 0.35.0`.

Additional minimum-version floors added during dependency audit passes hold transitive packages at their patched releases without a full `^` pin: `h3` and its `h3-v2` alias (`>=2.0.1-rc.18`, reached through `apps/docs > @tanstack/react-start`), `fast-uri` (`>=3.1.2`), `express-rate-limit` (`>=8.2.2`), and `qs` (`>=6.15.2`). Drop each once its transitive parent resolves a patched version naturally

- `nanoid` pinned to `^3.3.18` to patch GHSA-2v37-7h3g-55p8 (custom generators can loop indefinitely when `size` is zero, high, affects `< 3.3.18`). Reached transitively through `apps/docs > @tailwindcss/vite > vite > postcss > nanoid` and sixteen further `postcss` paths. The caret matters: `postcss@8.5.25` declares `nanoid: ^3.3.16`, and an open `>=3.3.18` floor resolves the unrelated `nanoid@6` major, so the pin has to hold the 3.x line. Sunset when `postcss` declares a `nanoid` range at `>= 3.3.18`.

- `browserslist` pinned to `>=4.28.7` to patch GHSA-c83g-rgw3-j3cx (unbounded query-cache growth with no eviction, eventual OOM, high) and GHSA-73wf-gq98-2v4g (uncaught crash and prototype write while normalizing an untrusted `browserslist-stats.json`, high), both affecting `<= 4.28.6`. Reached transitively through `apps/docs > @tanstack/react-start > @tanstack/start-plugin-core > @babel/core > @babel/helper-compilation-targets > browserslist` and sixteen further `@babel/core` paths, including `shadcn@4.7.0` in the `libs/ui` and `libs/keys` dev dependencies, which declares `browserslist` directly (`^4.26.2`) as well as reaching it through `@babel/preset-typescript`. A floor rather than a caret pin: npm has no `browserslist` major beyond 4 (latest `4.28.8`), so `>=4.28.7` resolves inside the line both consumers declare (`^4.24.0`, `^4.26.2`); switch to `^4.28.7` the day a 5.x is published. Sunset when both `@babel/helper-compilation-targets` (today `^4.24.0`) and `shadcn` (today `^4.26.2`) declare a `browserslist` range at `>= 4.28.7`. The bump leaves `next@16.2.12` on its older `caniuse-lite@1.0.30001770` and `baseline-browser-mapping@2.9.19`, so `pnpm dedupe --check` now lists both; accepted as dev-only data packages under `apps/docs`, collapsed at the next `pnpm dedupe` pass.

### Advisories accepted without a fix

`pnpm audit` ignores are listed under `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml`, each with its reachability argument beside it. There are two entries today, both against `image-size`:

- `image-size` — GHSA-w3rx-r6r6-pgpr (ICNS parser infinite loop) and GHSA-5p2g-fcmc-qvqq (JXL and HEIF parser infinite loops), both high, both denial of service. **No override can clear these**: the advisories name `>= 2.0.3` as patched and npm's latest published version is `2.0.2`, so every existing release is affected. Reached only through `apps/docs > fumadocs-core` (also via `fumadocs-mdx > fumadocs-core`), which sizes images referenced by this repo's own MDX at build time. No workspace package declares `image-size`, no source file imports it, and it is absent from the dependency closure of all four published packages (`@diffgazer/add`, `@diffgazer/ui`, `@diffgazer/keys`, `diffgazer`) — `apps/docs` is `private: true` and is never published. Triggering either loop requires an attacker-supplied ICNS/JXL/HEIF file; `apps/docs` accepts no user uploads and reads only images committed to this repository. Drop both ignores the moment `image-size` publishes `2.0.3` and `fumadocs-core` resolves it, and re-check on every release until then.

Note: `@tanstack/start-server-core` is NOT pinned because the natural transitive resolution from `@tanstack/react-start` is required to keep `@tanstack/start-plugin-core` and `@tanstack/start-server-core` version-compatible. Its moderate advisories are cleared by moving `@tanstack/react-start` instead: the `^1.168.34` range in `apps/docs` resolves `@tanstack/start-server-core 1.169.17`, past the `>= 1.167.30` floor for GHSA-9m65-766c-r333 (inbound server-function request deserialization could invoke a sibling client-referenced server function). `apps/docs` runs `createServerFn` and deploys as a live Node server, so this one needs a rebuild and redeploy of the docs image, not just a lockfile change. The related h3 advisories are cleared by the `h3` / `h3-v2` floor above rather than by pinning `@tanstack/start-server-core`.

`@hono/node-server` is a direct dependency of `cli/server` and `cli/diffgazer`, held at `^2.0.12`. The 2.x line is required: GHSA-frvp-7c67-39w9 (Windows `serve-static` path traversal via an encoded backslash bypassing route middleware) is patched only at `>= 2.0.5`, and `cli/diffgazer` serves the embedded web SPA through `serveStatic`. The 2.0.0 breaking changes do not reach this workspace — it dropped Node 18 (the CLI packages require `>= 22`) and removed the Vercel adapter (unused).

Workspace package manifests keep `@types/node` on the `^22.10.0` line. The monorepo invariant checks the CI version, override, manifest ranges, declared engine floors, and resolved lockfile majors together.

`commander` intentionally is **not** overridden. `cli/add` and `libs/registry` declare `^13`, but external dependencies still pull majors 4 / 11 / 14; collapsing them would require validating each transitive consumer.

### Upgrade cadence

- **Security advisories**: patch immediately. Run `pnpm audit --prod --audit-level=moderate` before every release and review new advisories. Bumps that resolve high/critical advisories may add or update an override line.
- **Patch and minor drift**: bump opportunistically alongside related work. Re-run `pnpm dedupe --check` after a bump and update the override if a new duplicate appears.
- **Major drift**: review quarterly. Each major bump (TypeScript, Vite, Vitest, React, Tailwind, Next, Hono, fumadocs, TanStack) requires its own task and changeset because of the public-API blast radius.
- **CI audit gate**: the CI workflow runs `pnpm audit --prod --audit-level=high` as a **hard gate**. HIGH and critical advisories block release. Moderate advisories surface in the audit output but do not fail the build; review them and patch where reasonable. Overrides for known-unfixable transitive advisories are listed in the Overrides section of this document; each override has a stated sunset condition.
- **Secret scan gate**: CI runs `pnpm run secret-scan` as a hard gate before build. The scanner reports high-confidence findings with redacted values.
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

`pnpm run registry:live-check` is not part of CI or `pnpm run release-check`. The manual deploy
workflow runs the same script with `DIFFGAZER_LIVE_REGISTRY_REQUIRED=1` against the promoted image
after a `docs-registry` or `all` promote and rolls the promotion back when it fails; a `landing`
deploy leaves the registry untouched and skips it. Run locally, the script reads the docs consumption metadata (`PUBLISH_GATED` in `apps/docs/src/lib/consumption-metadata.ts`) and **skips** while public hosted-registry install commands remain gated and `DIFFGAZER_LIVE_REGISTRY_REQUIRED` is unset.

When the registry is ungated, a run without `DIFFGAZER_LIVE_REGISTRY_REQUIRED` is a hard gate for DNS resolution and `HEAD` reachability: `r.b4r7.dev` must resolve, and one long-lived sentinel endpoint per tree copied by `deploy/registry.Dockerfile` (`/r/ui/registry.json`, `/r/keys/registry.json`, `/schema/diffgazer.json`) must return `200`. That mode proves the origin is serving, not that the checkout is deployed — sweeping every locally committed endpoint would fail on any registry file the checkout **adds** until a deploy serves it — and it does **not** compare hosted bytes to the committed files.

`DIFFGAZER_LIVE_REGISTRY_REQUIRED=1` is the post-deploy verification mode the deploy workflow uses; set it locally to repeat that proof. It ignores the publish gate, resolves DNS, requires `200` from every served endpoint, then fetches each one and requires the raw response bytes to match the committed file exactly.

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
