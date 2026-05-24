# Diffgazer Handoff Readiness Audit

Date: 2026-05-23
Mode: audit summary for handoff to another agent
Scope: public shadcn registry, `dgadd` copy mode, npm package mode, local `diffgazer`, docs, landing, deployment, CI/release, security, architecture, tests

## Executive Verdict

The project is not ready for a public user handoff yet.

The direction is good: the local `diffgazer` server has strong baseline controls, the web app is mostly composed from `@diffgazer/ui` and `@diffgazer/keys`, public registry artifacts exist, package manifests are close, and test/smoke coverage is broad by inspection.

The blockers are handoff and trust-boundary issues:

- Direct shadcn registry install is not coherent yet.
- Public npm and `npx` commands are still publish-gated.
- `@diffgazer/ui` package exports do not match the promised public surface.
- Provider "Import from Env" can persist an env var name as a literal secret.
- Release/deploy workflows need stronger trust checks.
- Public docs/deploy security headers and redirects are incomplete.
- Registry dependency validation and docs origin/schema routing need hardening.

Do not call this ready for users until the Critical, High, and security-relevant Medium findings are fixed or explicitly risk-accepted.

## Audit Inputs

Skills applied during the audit:

- `sota`
- `code-audit`
- `clean-code`
- `code-quality`
- `anti-slop`
- `security-review`
- `architecture`
- `typescript-expert`
- `test-behavior-not-implementation`
- React review skills from the audit context

Official/current sources consulted:

- shadcn registry item JSON: https://ui.shadcn.com/docs/registry/registry-item-json
- npm Trusted Publishers: https://docs.npmjs.com/trusted-publishers
- GitHub Actions secure use: https://docs.github.com/en/enterprise-cloud@latest/actions/reference/security/secure-use
- TanStack Start static prerendering: https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering
- Vercel monorepo/domain guidance: https://vercel.com/docs/monorepos/monorepo-faq

Context7 was attempted in the original audit but blocked by quota, so official web docs were used.

## Verification Status

Read-only inspection covered:

- `libs/ui/registry`, `libs/ui/public/r`, `libs/keys/registry`, `libs/keys/public/r`
- `libs/registry`, `cli/add`
- `libs/ui`, `libs/keys`, public package manifests and exports
- `cli/diffgazer`, `cli/server`, embedded Hono server, config/secrets paths
- `apps/web`, `apps/docs`, `apps/landing`, deploy configs
- GitHub workflows, package governance, root scripts
- Generated/public artifact policy by inspection

Not run during the audit:

- `pnpm run prepare:artifacts`
- `pnpm run validate:artifacts:check`
- builds, tests, type-checks, smoke tests
- package pack dry-runs
- live public-domain `curl` checks
- `npm view`
- git-history secret scanning

## Critical Findings

### Critical: Direct shadcn/manual registry handoff is not ready

Locations:

- `libs/ui/README.md:66`
- `libs/keys/README.md:11`
- `cli/add/README.md:50`
- `libs/ui/public/r/registry.json`

What:

Docs say `https://r.b4r7.dev` is not live yet, while public registry JSON already depends on that host for registry dependencies.

Why it matters:

Direct shadcn install depends on live URLs. A user running the documented public command can fail immediately or receive partial transitive artifacts. This breaks the "copy from source / shadcn registry" handoff promise.

Required fix:

- Deploy `r.b4r7.dev`.
- Smoke-test a leaf item and a transitive item via `npx shadcn add`.
- Keep docs marked preview/local-tarball only until live installs pass.

## High Findings

### High: Direct shadcn CSS artifact paths are inconsistent

Locations:

- `libs/ui/public/r/callout.json:17`
- `libs/ui/public/r/callout.json:54`
- `libs/ui/public/r/panel.json:16`
- `libs/ui/public/r/panel.json:63`
- `libs/ui/public/r/stepper.json:20`
- `libs/ui/public/r/stepper-variants.json:22`
- `cli/add/src/utils/registry.ts:14`
- `cli/add/src/utils/registry.ts:41`

What:

Some public shadcn JSON files include component source that imports `../shared/*.css`, while the CSS file targets are `~/styles/*.css`. `dgadd` strips CSS side-effect imports, but direct shadcn copy may leave unresolved relative imports.

Why it matters:

This creates a split-brain install path: `dgadd` can work while direct shadcn install fails. Direct shadcn is a promised public consumption mode.

Required fix:

- Either remove/transform those CSS side-effect imports in public shadcn artifacts, or install CSS at the relative path expected by source.
- Add validation that direct shadcn output has no unresolved relative CSS imports.

### High: Public npm and `dgadd` handoff is still publish-gated

Locations:

- `cli/add/README.md:12`
- `cli/add/README.md:16`
- `libs/ui/README.md:7`
- `libs/keys/README.md:7`
- `apps/docs/src/lib/consumption-metadata.ts:21`

What:

Docs explicitly say public npm commands are valid only after `npm view` returns package versions.

Why it matters:

Users cannot rely on `npx @diffgazer/add`, `npm install @diffgazer/ui`, `npm install @diffgazer/keys`, or `npm install -g diffgazer` until public packages exist.

Required fix:

- Publish and verify `diffgazer`, `@diffgazer/add`, `@diffgazer/ui`, and `@diffgazer/keys`.
- Run `npm view` checks.
- Keep docs in preview/local mode until publication is complete.

### High: `@diffgazer/ui` package exports are incomplete

Locations:

- `libs/ui/README.md:98`
- `libs/ui/package.json:224`
- `libs/ui/package.json:264`
- `libs/ui/registry/registry.json`
- `libs/ui/dist/hooks/*`
- `libs/ui/dist/lib/*`

What:

README promises `@diffgazer/ui/hooks/*` and `@diffgazer/ui/lib/*`, but `package.json.exports` exposes only a subset. The audit found 40 registry/dist hook/lib entrypoints vs 13 package exports. Missing examples include `./hooks/use-navigation`, `./hooks/use-focus-trap`, `./hooks/use-scroll-lock`, `./hooks/use-typeahead-buffer`, `./lib/aria-utils`, `./lib/diff`, `./lib/focus`, and multiple variant helpers.

Why it matters:

Package consumers can follow docs or registry import paths and hit `ERR_PACKAGE_PATH_NOT_EXPORTED`. This blocks installable package readiness.

Required fix:

- Derive `package.json.exports` from registry/build entries, or add the missing explicit exports.
- Add an invariant check comparing registry/dist declarations against package exports.

### High: Provider "Import from Env" can save the env var name as a literal secret

Locations:

- `apps/web/src/features/providers/hooks/use-api-key-form.ts:29`
- `apps/web/src/features/providers/components/page.tsx:156`
- `apps/web/src/features/providers/hooks/use-provider-management.ts:20`
- `cli/server/src/shared/lib/config/store.ts:68`

What:

The form sends the env var name as `value` when method is `env`. The page ignores `_method` and saves the string value. The server store treats env-backed credentials only as `CredentialRef` or legacy string `"env"`. A string such as `OPENROUTER_API_KEY` can be persisted as the secret.

Why it matters:

The UI can tell users they imported from env while actually storing the env var name as a credential. This is both a correctness bug and a credential-handling trust problem.

Required fix:

- Pass the method through provider management.
- Save env credentials as `{ kind: "env", varName }`.
- Ensure failed saves do not close/clear the dialog as success.
- Add behavior tests for paste vs env credential storage.

### High: Privileged release/deploy workflows trust broad `workflow_run` gates

Locations:

- `.github/workflows/release.yml:21`
- `.github/workflows/release.yml:34`
- `.github/workflows/deploy.yml:21`
- `.github/workflows/deploy.yml:43`

What:

Privileged jobs with publish/deploy capability run after `workflow_run` success and checkout `head_sha`. Current guards check success but not enough of the trusted event/branch/SHA boundary.

Why it matters:

GitHub warns that `workflow_run` and privileged workflows can be dangerous when they check out or process untrusted code. These jobs have write, publish, or deploy access.

Required fix:

- Require `github.event.workflow_run.event == 'push'`.
- Require `github.event.workflow_run.head_branch == 'main'`.
- Verify the SHA belongs to current `main` before checkout/publish/deploy.
- Keep production environment protection for manual deploys.
- Consider replacing `workflow_run` with a protected-branch publish workflow if possible.

### High: Public docs Node runtime lacks explicit security headers

Locations:

- `apps/docs/src/server.ts:5`
- `Dockerfile:37`
- `Dockerfile:50`
- `deploy/spa-nginx.conf:8`
- `deploy/registry-nginx.conf:7`

What:

Docs are served by a Node runtime that directly returns `handler.fetch(request)`. Static Nginx services define headers, but docs runtime does not wrap responses with repo-owned headers.

Why it matters:

`docs.b4r7.dev` is intended as the main public entrypoint. It should not depend on implicit platform defaults for CSP, frame policy, MIME sniffing protection, referrer policy, permissions policy, or HSTS at the edge.

Required fix:

- Add docs-server response header middleware or equivalent platform headers.
- Include `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`, and a CSP compatible with TanStack Start.
- Set HSTS at the TLS edge if this repo/deploy owns it.

### High: Current local docs prerender output is stale for intended host/route shape

Locations:

- `apps/docs/.output/public/sitemap.xml`
- `apps/docs/.output/public/robots.txt`
- `apps/docs/src/lib/seo.ts:7`
- `apps/docs/scripts/generate-sitemap.mjs:8`
- `apps/docs/src/routes/$lib.tsx:28`

What:

The existing local `.output/public` snapshot was reported as stale for the intended host and route shape.

Why it matters:

If stale generated output leaks into deployment or validation, public SEO/canonical URLs can point at old hosts or old paths such as `/ui/docs/*`.

Required fix:

- Rebuild docs with `VITE_PUBLIC_ORIGIN=https://docs.b4r7.dev`.
- Verify `.output/public` has no old host and no `/ui/docs` or `/keys/docs` sitemap URLs.
- Keep generated output ignored unless intentionally part of deploy artifacts.

### High: Missing edge/proxy redirects for old docs host/path assumptions

Locations:

- `apps/docs/src/routes/$lib.tsx:33`
- `apps/docs/src/routes/$lib/$.tsx:43`
- `.github/workflows/deploy.yml:85`

What:

The app has route handling, but there is no explicit platform-level redirect plan for older host/path assumptions.

Why it matters:

Docs are the public entrypoint. Users, crawlers, previous links, and generated references need stable canonical paths.

Required fix:

- Add edge/proxy redirects:
  - `docs.diffgazer.b4r7.dev/* -> docs.b4r7.dev/*`
  - `/ui/docs/:path* -> /ui/:path*`
  - `/keys/docs/:path* -> /keys/:path*`

## Medium Findings

### Medium: Public security headers are fragile in Nginx configs

Locations:

- `deploy/spa-nginx.conf:8`
- `deploy/spa-nginx.conf:20`
- `deploy/registry-nginx.conf:7`
- `deploy/registry-nginx.conf:13`

What:

Nginx `add_header` inside nested `location` blocks can override inherited headers from the server block. Static asset or registry responses can miss security headers unless repeated in every location using `add_header`.

Why it matters:

The static services are public. Header regressions are easy to miss in config review and affect browser security posture.

Required fix:

- Repeat the full security header set inside every `location` with `add_header`.
- Add live or container-level header smoke tests.

### Medium: JS-readable local bearer token authorizes API and shutdown

Locations:

- `cli/diffgazer/src/lib/servers/embedded-server.ts:24`
- `apps/web/src/lib/api.ts:17`
- `cli/server/src/app.ts:80`
- `cli/server/src/features/shutdown/router.ts:8`

What:

The embedded shell injects a token readable by JavaScript. The same token class gates privileged local API access and shutdown.

Why it matters:

Loopback binding, Host/Origin guards, and CSP help, but any same-origin XSS can read the token and call local APIs.

Required fix:

- Split shutdown auth from API session auth.
- Prefer an `HttpOnly; SameSite=Strict` cookie or equivalent non-JS-readable session for API auth.
- Keep CSP strict and add XSS-focused tests for any HTML/rendered markdown surfaces.

### Medium: Registry dependency specs are not protocol-constrained

Locations:

- `libs/registry/src/registry-types.ts:18`
- `libs/registry/src/cli/registry.ts`
- `libs/registry/src/cli/package-manager.ts:33`

What:

Registry `dependencies` are passed to package managers after package-name validation, but protocol/source specs should be explicitly constrained.

Why it matters:

`execFile` avoids shell injection, but package managers interpret dependency strings. A compromised or malformed registry item could try `file:`, `git+`, `https:`, path inputs, or other non-registry sources.

Required fix:

- Validate registry dependencies and install inputs with an allowlist.
- Reject non-registry protocols unless explicitly supported.
- Add tests for rejected `file:`, `git+`, `https:`, absolute, relative, and path traversal dependency specs.

### Medium: npm Trusted Publishing is not fully configured

Locations:

- `.github/workflows/release.yml:27`
- `.github/workflows/release.yml:58`
- `.github/workflows/release.yml:66`
- `package.json:56`
- `PACKAGE_GOVERNANCE.md:155`

What:

Release uses provenance settings and `id-token: write`, but still depends on `secrets.NPM_TOKEN`. Governance says Trusted Publishers are not configured per package yet.

Why it matters:

Long-lived npm tokens are a supply-chain risk. npm Trusted Publishing allows OIDC-based publishing without long-lived automation tokens and can automatically generate provenance.

Required fix:

- Configure npm Trusted Publishers for `diffgazer`, `@diffgazer/add`, `@diffgazer/ui`, and `@diffgazer/keys`.
- Remove or explicitly document `NPM_TOKEN` as fallback-only.
- Consider npm settings that disallow token publishing after OIDC is proven.

### Medium: Registry schema is behind current shadcn item schema

Locations:

- `libs/registry/src/registry-types.ts:23`
- `libs/registry/src/registry-types.ts:24`
- `libs/registry/src/registry-types.ts:25`

What:

The schema preserves older shapes for fields such as `css` and `envVars`. Current shadcn docs support newer item fields and item types such as `registry:base` and `registry:font`.

Why it matters:

If this registry is meant to be shadcn-compatible long term, schema drift creates false validation confidence and can block future public item types.

Required fix:

- Align `RegistryItemSchema` with current shadcn registry item JSON.
- Add tests that validate current `css`, `cssVars`, `envVars`, `registry:base`, and `registry:font` shapes.

### Medium: `@diffgazer/keys` version docs are stale

Locations:

- `cli/add/src/utils/add-integration.ts:16`
- `libs/ui/package.json:332`
- `cli/add/README.md:104`
- `libs/ui/docs/content/cli/add.mdx:37`
- `libs/ui/README.md:109`

What:

Some docs still reference `@diffgazer/keys` `^0.1.1` or `>=0.1.1`, while package metadata and code use `^0.2.0` / `>=0.2.0`.

Why it matters:

Users can install the wrong peer version, especially in package mode and `dgadd --integration keys`.

Required fix:

- Update all docs and generated docs to the `0.2.0` contract.
- Add a doc/package metadata invariant check.

### Medium: Registry origin handling is split

Locations:

- `Dockerfile:17`
- `apps/docs/scripts/sync-artifacts.mjs:34`
- `apps/docs/src/lib/consumption-metadata.ts:7`

What:

Artifact sync uses `REGISTRY_ORIGIN`, while UI command snippets use `VITE_REGISTRY_ORIGIN`. Docker only sets `REGISTRY_ORIGIN`.

Why it matters:

Docs can build with correct artifacts but stale/default command snippets. Public install commands must be canonical and reproducible.

Required fix:

- Treat `https://r.b4r7.dev` as canonical registry origin.
- Pass both `REGISTRY_ORIGIN` and `VITE_REGISTRY_ORIGIN` in docs builds.
- Add build-time assertions for rendered command origins.

### Medium: Schema URL is inconsistent with deployed static registry

Locations:

- `cli/add/src/commands/init.ts:183`
- `libs/registry/src/constants.ts:6`
- `deploy/registry.Dockerfile:24`
- `apps/docs/public/schema/diffgazer.json:3`

What:

The schema is present under docs public assets, but the registry deployment copies only `/r/ui` and `/r/keys`.

Why it matters:

`dgadd init` config or generated files may point users at a schema URL that is not served by the intended registry host.

Required fix:

- Either serve `/schema/diffgazer.json` from `r.b4r7.dev`, or point schema references to `https://docs.b4r7.dev/schema/diffgazer.json`.
- Align `$id` and generated config defaults.

### Medium: Docs content is not public-handoff clean while install paths are publish-gated

Locations:

- `apps/docs/src/lib/consumption-metadata.ts:21`
- `apps/docs/content/docs/ui/getting-started/installation.mdx`
- `apps/docs/content/docs/ui/components/button.mdx`
- `apps/docs/content/docs/ui/theme/typography.mdx`

What:

Docs have strong content coverage, but package and public command availability is still gated.

Why it matters:

Docs are intended as the entrypoint for future apps. If they look public but commands are not live, user trust drops quickly.

Required fix:

- Keep preview language until publish and registry live checks pass.
- Remove publish-gated wording only after `npm view`, direct shadcn, and `dgadd` public installs pass.

### Medium: Docs E2E tests use non-canonical routes

Locations:

- `apps/docs/tests/e2e/button.e2e.ts:6`
- `apps/docs/scripts/generate-sitemap.test.ts:56`
- `apps/docs/src/lib/docs-library.ts:120`

What:

Playwright docs tests use `/ui/docs/components/*`, while sitemap/SEO canonical paths are `/ui/components/*`.

Why it matters:

The advertised/prerendered public routes are not the same routes getting browser, axe, and visual coverage.

Required fix:

- Switch E2E `page.goto` paths to canonical `/ui/components/...`.
- Or add paired canonical-route tests.

### Medium: Sitemap and robots writer output is under-tested

Locations:

- `apps/docs/scripts/generate-sitemap.test.ts:10`
- `apps/docs/scripts/generate-sitemap.mjs:118`
- `apps/docs/scripts/generate-sitemap.mjs:141`

What:

Tests cover page enumeration but not enough of the emitted files.

Why it matters:

SEO output is part of the public docs handoff. Bugs in origin trimming, XML escaping, `robots.txt`, or fallback timestamps can ship unnoticed.

Required fix:

- Add temp-dir unit tests for `writeSitemap()`.
- Assert `sitemap.xml`, `robots.txt`, origin trimming, root URL, XML escaping, and `lastmod` fallback.

### Medium: Landing app is only build-gated

Locations:

- `apps/landing/package.json:5`
- `turbo.json`
- `package.json:22`

What:

`@diffgazer/landing` has `build`, but no dedicated `test`, `type-check`, or `check` script.

Why it matters:

The landing page will be the public `diffgazer.b4r7.dev` surface. A public page should have at least minimal type, accessibility, and metadata coverage.

Required fix:

- Add a `type-check` script.
- Add a minimal RTL/axe smoke test for heading, docs link, install command, and metadata.

### Medium: Landing page is a placeholder, not a credible public product surface

Locations:

- `apps/landing/src/App.tsx:1`
- `HANDOFF_EXECUTION_PLAN.md:203`

What:

The current landing page is a small block with one install command and docs link.

Why it matters:

`diffgazer.b4r7.dev` should explain the product, show proof, and route users to install/docs/GitHub. A placeholder weakens the handoff even if the local app itself works.

Required fix:

- Build a real landing page with product proof, install path, screenshots/demo, docs/GitHub links, OG/canonical metadata, and domain-specific copy.

### Medium: Typography and token story drifts across app/docs/landing

Locations:

- `apps/landing/src/App.tsx:5`
- `apps/web/src/styles/index.css:2`
- `apps/web/src/styles/theme-overrides.css:171`
- `cli/diffgazer/src/lib/servers/embedded-server.ts:30`

What:

Landing uses `text-tui-text`, which appears undefined. The app/docs/landing typography/token setup is not yet a single coherent public brand story. Remote font usage can conflict with local-first/offline positioning and packaged CSP.

Why it matters:

The public site and local app should feel like one product. Undefined tokens cause visual regressions, and remote fonts can violate CSP/offline assumptions.

Required fix:

- Standardize one brand CSS/token entry.
- Replace undefined `text-tui-text`.
- Self-host or drop remote fonts where local/offline/CSP matters.

### Medium: Repository-controlled workspace globs can escape project root

Locations:

- `cli/server/src/features/review/context.ts:61`
- `cli/server/src/features/review/context.ts:95`
- `cli/server/src/features/review/context.ts:101`

What:

Context snapshotting accepts `pnpm-workspace.yaml` globs, joins them to `projectPath`, and reads package metadata. A repo can use parent globs such as `../*`.

Why it matters:

Diffgazer reviews user repositories. Repository-controlled config should not make the local server read sibling package metadata outside the trusted project root.

Required fix:

- Resolve each workspace root with `path.resolve(projectPath, dir)`.
- Require it to equal or stay under the real project root.
- Reject absolute and parent globs.
- Add regression tests for `../*`.

### Medium: Onboarding OpenRouter early-save can double-submit and silently fail

Locations:

- `apps/web/src/features/onboarding/hooks/use-onboarding.ts:40`
- `apps/web/src/features/onboarding/hooks/use-onboarding.ts:60`
- `apps/web/src/features/onboarding/components/onboarding-wizard.tsx:134`

What:

Early-save state is not fully part of the disabled/action path, and errors can be swallowed.

Why it matters:

Onboarding is a first-run trust path. Silent provider setup failure makes the product feel broken and can confuse credential state.

Required fix:

- Include `isEarlySaving` in disabled paths.
- Show saving state.
- Surface errors consistently.

### Medium: Web app lacks skip link/focus bypass

Locations:

- `apps/web/src/components/layout/global-layout.tsx:51`
- `apps/docs/src/routes/__root.tsx:78`

What:

Docs has a skip link, but the web app layout does not.

Why it matters:

Keyboard and screen-reader users need a way to bypass repeated layout chrome. The app is keyboard-first, so this should be baseline behavior.

Required fix:

- Add a skip link in `GlobalLayout`.
- Give `<main>` a stable `id="main-content"`.

### Medium: CLI owns a parallel keyboard/scope/navigation stack outside `libs/keys`

Locations:

- `cli/diffgazer/src/app/providers/keyboard-provider.tsx:6`
- `cli/diffgazer/src/hooks/use-key.ts:1`
- `cli/diffgazer/src/hooks/use-scope.ts:1`
- `cli/diffgazer/src/lib/highlight-navigation.ts:1`

What:

The Ink CLI has its own keyboard provider, scope stack, handlers, and highlight navigation. `libs/keys` owns keyboard-first behavior per repo boundaries.

Why it matters:

This may be intentional because Ink is not DOM, but it is not documented as a boundary decision. Without an ADR, future work may duplicate behavior or extract the wrong layer.

Required fix:

- Write a short ADR deciding whether Ink keyboard behavior is CLI-local.
- If not CLI-local, extract platform-neutral scope/key/list-navigation primitives into `libs/keys` and keep CLI as an Ink adapter.

### Medium: `libs/core` boundary is implicit and broad

Locations:

- `libs/core/src/review/progress-mapping.ts:1`
- `libs/core/src/review/display.ts:2`
- `libs/core/src/theme/token-keys.ts:12`

What:

`libs/core` includes schemas/protocols, presentation mapping, React-query-style hooks, footer state, and theme vocabulary.

Why it matters:

AGENTS defines boundaries for keys/ui/registry/CLI/server, but not core. Core can become a dumping ground for cross-client behavior.

Required fix:

- Add a core boundary decision:
  - either restrict core to domain/protocol/schemas, or
  - explicitly document that core owns cross-client product presentation contracts.

## Low Findings

### Low: `files[]` validation is length/null-only before git pathspecs

Locations:

- `cli/server/src/features/review/schemas.ts:35`
- `cli/server/src/features/review/diff.ts:64`
- `cli/server/src/shared/lib/git/service.ts:181`

What:

`files[]` can include `../`, absolute paths, backslashes, or git pathspec magic. Git execution uses `execFile` and `--`, so this is not shell injection, but path selection is left to git.

Why it matters:

For a local code-review tool, file selection should be constrained to normalized repo-relative paths and ideally intersect with changed files.

Required fix:

- Validate as normalized repo-relative paths.
- Reject `..`, absolute paths, NUL, backslash escapes, and leading `:` pathspec magic.
- Prefer intersecting with parsed changed-file paths.

### Low: Some API/SSE paths return raw operational error messages

Locations:

- `cli/server/src/features/git/router.ts:34`
- `cli/server/src/features/review/errors.ts:24`
- `cli/server/src/features/review/session-resume.ts:82`

What:

Some route-level errors can return raw git/provider/store details to the browser.

Why it matters:

Local paths, provider details, or git stderr can leak into UI-visible messages. Global errors are generic, but route-level paths are less consistent.

Required fix:

- Map internal failures to public-safe messages.
- Keep detailed diagnostics in server logs.

### Low: PR/release readiness does not run the exact release gate

Locations:

- `package.json:24`
- `.github/workflows/release-readiness.yml:56`
- `.github/workflows/release.yml:52`

What:

`release-check` includes strict smoke, pack dry-runs, verify, and `git diff --check`, but Release Readiness runs a hand-assembled sequence.

Why it matters:

CI and release can drift. A release-only gate catches issues later than necessary.

Required fix:

- Add `git diff --check` to Release Readiness.
- Prefer calling `pnpm run release-check` or keeping a single shared release gate.

### Low: `cli/server` build output and dependencies are noisy

Locations:

- `cli/server/tsconfig.json:8`
- `cli/server/package.json:25`
- `cli/server/package.json:34`

What:

The server tsconfig includes all `src`, so tests can emit to `dist`. `@napi-rs/keyring` appears in both dependencies and devDependencies with different ranges.

Why it matters:

`cli/server` is private, so this is not a direct package leak. But noisy build outputs and inconsistent dependency metadata make handoff and packaging less predictable.

Required fix:

- Exclude `**/*.test.ts` from the server build.
- Remove or align duplicate keyring dependency declarations.

### Low: `libs/keys` verification reaches into `apps/docs`

Location:

- `libs/keys/package.json:55`

What:

`verify:registry-cleanup` calls `../../apps/docs/scripts/verify-registry-cleanup.mjs`.

Why it matters:

A reusable library package depends on app-owned tooling for its own verification. That weakens ownership boundaries.

Required fix:

- Move shared cleanup verification to root tooling or `libs/registry`.
- Have docs and keys call the neutral script.

### Low: UI tests import keys internal source layout

Locations:

- `libs/ui/registry/ui/menu/menu.test.tsx:4`
- `libs/ui/registry/ui/tabs/tabs.test.tsx:3`
- `libs/ui/registry/ui/navigation-list/navigation-list.test.tsx:4`
- `libs/ui/registry/ui/accordion/accordion.test.tsx:4`

What:

UI tests import `../../../../keys/src/testing/navigation-behavior.js` directly.

Why it matters:

UI can depend on keys, but tests are tied to a private file layout instead of a declared testing contract.

Required fix:

- Expose a dev-only `@diffgazer/keys/testing` entry, or move the helper to explicit shared test utilities.

### Low: Docker base images use mutable tags and Dependabot does not cover Dockerfiles

Locations:

- `Dockerfile:2`
- `deploy/registry.Dockerfile:22`
- `deploy/landing.Dockerfile:23`
- `.github/dependabot.yml:3`

What:

Dockerfiles use mutable tags such as `node:22-alpine` and `nginx:1.27-alpine`. Dependabot tracks GitHub Actions and npm, not Docker.

Why it matters:

Mutable image tags reduce build reproducibility. Docker base updates can miss security review.

Required fix:

- Pin base images by digest for production deploys.
- Add Dependabot or Renovate Docker updates.

### Low: `ws` override lacks governance rationale

Locations:

- `package.json:81`
- `pnpm-lock.yaml`
- `PACKAGE_GOVERNANCE.md:174`

What:

`ws` is pinned in root overrides but is not documented in the override rationale section.

Why it matters:

Every override should have a reason, advisory/source, and sunset condition so it does not become stale dependency policy.

Required fix:

- Document why `ws` is pinned and when it can be removed.
- Or remove it if obsolete.

### Low: npm release still uses long-lived `NPM_TOKEN`

Locations:

- `.github/workflows/release.yml:27`
- `.github/workflows/release.yml:66`
- `PACKAGE_GOVERNANCE.md:155`

What:

This overlaps with the Trusted Publishing finding. `NPM_TOKEN` is still required until Trusted Publishers are configured.

Why it matters:

Long-lived registry write tokens are higher risk than short-lived OIDC publishing.

Required fix:

- Configure npm Trusted Publishers.
- Remove or demote `NPM_TOKEN` to documented fallback-only.

## Info Findings And Positive Checks

### Info: CLI TUI has separate Ink primitives

Locations:

- `cli/diffgazer/src/components/ui/button.tsx:2`
- `cli/diffgazer/src/components/ui/radio.tsx:9`
- `cli/diffgazer/src/components/ui/navigation-list.tsx:9`

What:

The CLI TUI has Ink-specific `Button`, `RadioGroup`, and `NavigationList` primitives.

Why this is acceptable:

DOM `@diffgazer/ui` primitives cannot render in Ink. This is acceptable if the boundary is documented and renderer-agnostic navigation/state helpers are extracted only when duplication grows.

Suggested action:

- Document the boundary.
- Avoid forcing DOM UI abstractions into Ink.

### Info: Local server baseline controls are strong

Positive checks:

- Embedded/dev API binds `127.0.0.1`.
- Host allowlist is present.
- Unsafe Origin rejection is present.
- API token middleware is present.
- Packaged CORS is restricted.
- Shutdown token is per-run random.
- Embedded HTML JSON-escapes token and uses CSP nonce.
- Git uses `execFile`, fixed args, `--no-ext-diff`, and `--no-textconv`.
- Secret storage uses keyring or `0600` file writes.
- Config GET does not return API keys.

Risk:

These controls do not eliminate the JS-readable token issue or local XSS risk, but they are a solid baseline.

### Info: Web app mostly composes shared primitives correctly

Positive checks:

- `apps/web` depends inward on `@diffgazer/core`, `@diffgazer/keys`, and `@diffgazer/ui`.
- Product-specific composition stays mostly in `apps/web`.
- CLI packaging embeds `@diffgazer/web` into `dist/web` and serves it same-origin with CSP/token injection.

Risk:

Landing and typography/token consistency still need work before public handoff.

### Info: Test coverage is broad in core areas

Positive checks:

- UI and keys have behavior/a11y/keyboard coverage by inspection.
- Registry and CLI copy/package/direct paths have smoke/invariant coverage by inspection.
- Local server auth and middleware behavior are covered by tests by inspection.

Risk:

The audit did not run tests. Coverage claims are based on source inspection.

### Info: No obvious hardcoded source secrets found

Positive checks:

- `.env.example` exists.
- `.gitignore` excludes `.env` and `.env.*` except examples.
- `SECURITY.md` and `SUPPORT.md` are present.
- GitHub Actions are pinned by commit SHA.
- Lockfile is committed.
- Release readiness includes a production dependency audit gate.

Risk:

This was an `rg`-based source scan only, not a git-history secret scan.

## Domain And Routing Recommendation

Use separate projects/services per subdomain, not one mega-router inside the docs app.

Recommended mapping:

- `docs.b4r7.dev` -> `apps/docs`
- `r.b4r7.dev` -> static registry JSON
- `diffgazer.b4r7.dev` -> `apps/landing`
- `b4r7.dev` -> `apps/hub`
- `apps/web` -> local-only, embedded into the `diffgazer` CLI

Why:

- Docs, registry, landing, and hub have different runtime, cache, CORS, and security-header needs.
- The repo already has separate Docker/deploy surfaces for docs, registry, landing, and hub.
- Registry should stay static and cacheable with CORS.
- Docs should be optimized for canonical SEO and content navigation.
- Landing should be a product marketing/support page.
- The actual web app should remain local because it talks to a local server and user repositories.

Deploy follow-ups:

- Configure canonical domains and redirects.
- Pass `VITE_PUBLIC_ORIGIN=https://docs.b4r7.dev`.
- Pass both `REGISTRY_ORIGIN=https://r.b4r7.dev` and `VITE_REGISTRY_ORIGIN=https://r.b4r7.dev`.
- Add docs security headers at the app or edge layer.
- Add live health/header checks for all public services.

## Recommended Fix Order

### Phase 1: Security and trust boundary blockers

Fix first:

1. Harden `workflow_run` release/deploy guards.
2. Add docs and static service security headers correctly.
3. Fix provider env credential persistence.
4. Constrain workspace globs to project root.
5. Validate registry dependency protocols.
6. Decide whether to split JS-readable API/shutdown token now or document risk acceptance.

Verification:

- Focused server/security tests.
- Provider credential behavior tests.
- Workflow review.
- Header smoke checks against local containers or deployed preview.

### Phase 2: Public install path blockers

Fix next:

1. Fix shadcn CSS artifact path mismatch.
2. Complete `@diffgazer/ui` exports.
3. Align `@diffgazer/keys` version docs.
4. Align registry schema with current shadcn.
5. Align schema URL and registry origin handling.

Verification:

- `pnpm run prepare:artifacts`
- `pnpm run validate:artifacts:check`
- `pnpm run smoke:shadcn`
- `pnpm run smoke:packages`
- Pack dry-runs for all public packages
- Direct shadcn install from local/static fixture

### Phase 3: Public docs and domain readiness

Fix next:

1. Add platform redirects.
2. Rebuild docs with canonical origins.
3. Switch docs E2E to canonical routes.
4. Test sitemap and robots output.
5. Build a real `diffgazer.b4r7.dev` landing page.
6. Add landing type-check and minimal tests.
7. Standardize typography/tokens and font policy.

Verification:

- Docs build and preview.
- Playwright docs E2E on canonical routes.
- Sitemap/robots unit tests.
- Landing build/type-check/test.
- Live smoke on public domains after deploy.

### Phase 4: Package publication readiness

Fix after install paths pass locally:

1. Configure npm Trusted Publishers.
2. Remove or demote `NPM_TOKEN`.
3. Run `release-check`.
4. Publish packages.
5. Verify with `npm view`.
6. Run fresh consumer smoke tests against public npm packages.
7. Remove publish-gated docs copy only after public checks pass.

Verification:

- `npm view diffgazer version`
- `npm view @diffgazer/add version`
- `npm view @diffgazer/ui version`
- `npm view @diffgazer/keys version`
- Fresh app install tests for:
  - `npx @diffgazer/add init`
  - `npx @diffgazer/add add ui/button`
  - `npm install @diffgazer/ui @diffgazer/keys`
  - `npm install -g diffgazer`

### Phase 5: Architecture and cleanup

Fix after blockers:

1. Add ADR for Ink keyboard vs `libs/keys`.
2. Add ADR for `libs/core` ownership.
3. Move keys cleanup verifier out of `apps/docs`.
4. Add `@diffgazer/keys/testing` or shared test util boundary.
5. Clean server test build output and duplicate dependency metadata.
6. Pin Docker images by digest or configure Docker update automation.
7. Document or remove the `ws` override.

Verification:

- Root invariant checks.
- Package build/type-check/test.
- Architecture docs reviewed against AGENTS boundaries.

## Final Release Gate Before Calling It Ready

Do not call the project ready until this passes:

```bash
pnpm run prepare:artifacts
pnpm run validate:artifacts:check
pnpm run check
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test:types
DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke
pnpm run smoke:packages
pnpm --filter @diffgazer/add pack --dry-run
pnpm --filter @diffgazer/ui pack --dry-run
pnpm --filter @diffgazer/keys pack --dry-run
pnpm --filter diffgazer pack --dry-run
pnpm run verify:monorepo
git diff --check
```

Additional public handoff checks:

```bash
npm view diffgazer version
npm view @diffgazer/add version
npm view @diffgazer/ui version
npm view @diffgazer/keys version
curl -fsS https://docs.b4r7.dev
curl -fsS https://r.b4r7.dev/r/ui/registry.json
curl -fsS https://r.b4r7.dev/r/keys/registry.json
curl -fsS https://diffgazer.b4r7.dev
```

Also run fresh external-consumer installs for shadcn direct copy, `dgadd`, package imports, and global `diffgazer`.
