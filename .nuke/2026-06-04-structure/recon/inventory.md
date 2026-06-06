# Diffgazer Monorepo — Structural Inventory (Recon R1)

Date: 2026-06-04
Root: `/Users/voitz/Projects/diffgazer-workspace`
Package manager: `pnpm@10.28.2` (workspaces) + Turborepo (`turbo@^2.9.14`)
Module type: ESM throughout (`"type": "module"` everywhere).
Lint/format: Biome `2.3.14` (root config `biome.root.json`).
Excluded from trees: `node_modules`, `dist`, `.turbo`, `coverage`, `.output`, `.source`, `.tanstack`, and generated dirs (`libs/ui/docs/generated`, `libs/keys/docs/generated`, `cli/add/src/generated`, `apps/docs/src/generated`).

---

## 1. Workspaces

`pnpm-workspace.yaml` globs:
```yaml
packages:
  - "apps/*"
  - "cli/*"
  - "libs/*"
  - "libs/keys/artifacts"   # nested helper workspace (publish-artifacts builder)
```

Resolved workspaces (10 main + 1 nested `libs/keys/artifacts`):

| Path | Package name | Private/Published | Version | bin | Notes |
|---|---|---|---|---|---|
| `apps/web` | `@diffgazer/web` | private | 0.1.0 | — | React 19 SPA, review UI. Embedded into `diffgazer` CLI web mode. |
| `apps/docs` | `@diffgazer/docs` | private (no `private` flag but no publishConfig; effectively app) | — | — | TanStack Start + Fumadocs docs site. |
| `apps/landing` | `@diffgazer/landing` | private | — | — | Marketing page, only `@diffgazer/ui` (theme CSS). |
| `cli/diffgazer` | `diffgazer` | **published** (public, provenance) | 0.1.4 | `diffgazer` -> `bin/diffgazer.js` | Public binary: web mode (embeds built web SPA + cli/server Hono) + Ink TUI mode. |
| `cli/add` | `@diffgazer/add` | **published** (public, provenance) | 0.1.1 | `dgadd` -> `./dist/index.js` | shadcn-like registry add/remove/list/diff/init CLI. |
| `cli/server` | `@diffgazer/server` | private | 0.1.0 | — | Embedded Hono backend. exports `.` only. CLI-internal; bundled via tsup `noExternal` into `diffgazer`. |
| `libs/core` | `@diffgazer/core` | private | 0.0.1 | — | Shared Zod schemas, result/error types, hooks, business logic. Huge `exports` map (~30 subpaths). |
| `libs/keys` | `@diffgazer/keys` | **published** (public, provenance) | 0.2.0 | — | Keyboard/focus primitives + public registry. `exports` + `typesVersions`. |
| `libs/ui` | `@diffgazer/ui` | **published** (public, provenance) | 0.2.0 | — | UI primitives + public registry. ~70 `exports` subpaths (per-component + per-hook + lib + CSS). |
| `libs/registry` | `@diffgazer/registry` | private | 0.1.0 | — | Registry contracts/validation/build engine. exports `.`, `./schemas`, `./cli`. |
| `libs/keys/artifacts` | (nested, helper) | private | — | — | Build-artifact publisher helper for keys. |

### Main scripts per workspace (build / test / type-check / entry)

- **apps/web**: `build: tsc -b && vite build`; `test: vitest run`; `type-check: tsc -b`; `test:types: vitest --typecheck`. Entry: `src/main.tsx`.
- **apps/docs**: `build: DOCS_PRERENDER=1 vite build && generate:sitemap` (prebuild runs `prepare:generated`); `test: vitest run` (pretest runs `prepare:generated`); `type-check: tsc --noEmit && tsc --noEmit -p tsconfig.test.json` (pretype-check runs `prepare:generated` + `generate-route-tree`); also `test:e2e: playwright test`, `lighthouse: lhci autorun`. Generators: `scripts/prepare-generated.mjs`, `scripts/generate-sitemap.mjs`, `scripts/generate-route-tree.mjs`.
- **apps/landing**: `build: tsc -b && vite build`; `test: vitest run`; `type-check: tsc -b`.
- **cli/diffgazer**: `build` = `build:deps` (turbo build core/server/keys/ui/web) → clean → `build:web` (vite build into `dist/web`) → `build:bundle` (`tsup`); `test: vitest run`; `type-check: tsc --noEmit`; `dev: tsx src/index.tsx --dev`; `start: node bin/diffgazer.js`. Entry: `src/index.tsx` (web mode) / `src/tui-entry.tsx` (TUI).
- **cli/add**: `build: rm -rf dist && tsup && copy-generated` (prebuild `generate:bundles` via `scripts/bundle-registry.ts` + `scripts/generate-keys-copy-bundle.ts`); `test: registry build + generate:bundles + vitest run`; `type-check: tsc --noEmit`. Bin entry `dist/index.js` from `src/index.ts`.
- **cli/server**: `build: tsc`; `dev: tsx src/dev.ts`; `start: node dist/dev.js`; `test: vitest run`; `type-check: tsc --noEmit`. Exports `./dist/index.js`.
- **libs/core**: `build: tsc && verify:dist-esm` (scripts/verify-dist-esm-imports.ts); `type-check: tsc --noEmit && -p tsconfig.test.json && -p scripts/tsconfig.json`; `test: vitest run`; also `generate:catalog-snapshot`. Main `./dist/index.js`.
- **libs/keys**: `build: validate:registry → rm dist → tsc → verify:dist-esm → verify:rsc → build:shadcn → build:artifacts` (build:docs-data first); `type-check: tsc --noEmit && -p tsconfig.test.json && -p scripts/tsconfig.json`; `test: vitest run`. Main `./dist/index.js`.
- **libs/ui**: `build: validate:registry → tsup → build:declarations → build:shadcn → build:docs-data → build:artifacts`; `type-check: tsc --noEmit && -p tsconfig.tools.json && -p tsconfig.test.json && -p scripts/tsconfig.json` (FOUR tsconfigs); `test: vitest run`. No `main`; exports-only (per-component).
- **libs/registry**: `build: tsc`; `type-check: tsc --noEmit && -p tsconfig.test.json`; `test: vitest run`. Main `./dist/index.js`.

Root scripts of note: `prepare:artifacts` / `prepare:library-artifacts` (regenerate registries + catalog snapshot + docs generated), `validate:artifacts:check`, `verify:monorepo` (`scripts/monorepo/check-invariants.mjs`), `smoke` (cli/packages/shadcn/modelsdev), `bench`, `verify` / `test-ci` / `release-check` (mega gates). Artifact prepare wrapper: `scripts/monorepo/run-with-artifacts.sh`.

---

## 2. Directory trees per workspace (depth ~4) + annotations

### apps/web — bulletproof-react style (canonical)
```
apps/web/src
├── app/                  # app shell: providers/, routes/, router, layout wiring
│   ├── providers/        # config-provider, theme-provider (+ .test.tsx)
│   └── routes/           # TanStack Router route modules
├── components/           # shared cross-feature UI composition
│   ├── layout/           # global-layout, header, footer (+ index barrel)
│   ├── shared/           # cross-feature widgets (api-key-method-selector, *-content)
│   └── ui/               # app-only UI atoms grouped in folders (progress/, severity/)
├── config/               # static app config
├── features/             # FEATURE-FIRST: each feature owns components/ + hooks/ (+ types.ts, utils)
│   ├── history/  home/  onboarding/  providers/  review/  settings/
├── hooks/                # cross-feature hooks (use-theme, use-scoped-route-state)
├── lib/                  # app infra (api, query-client, config-guards, back-navigation)
├── styles/               # index.css, theme-overrides.css
├── testing/              # render.tsx, factories.ts, utils.ts (test helpers)
├── types/                # shared app types
├── utils/                # download.ts etc.
├── main.tsx  test-setup.ts
```
Top dirs: `app, components, config, features, hooks, lib, styles, testing, types, utils`. This is the cleanest bulletproof-react layout in the repo. Features sub-group by `components/` + `hooks/`; some go deeper (`features/providers/components/api-key-dialog/`, `model-select-dialog/` are component-grouping folders).

### apps/docs — TanStack Start + Fumadocs + registry mirror
```
apps/docs
├── config/               # site config
├── content/docs/{app,keys,ui}/   # MDX docs content
├── public/{r/{keys,ui}, library-assets/{keys,ui}, schema}/  # served registries + assets
├── registry/             # GITIGNORED MIRROR of libs/ui registry (ui/, lib/, hooks/, examples/, component-docs/, hook-docs/, testing/) — 0 tracked files
├── scripts/              # prepare-generated, generate-sitemap, generate-route-tree, artifacts/ (sync, validation)
├── src/
│   ├── components/        # docs-mdx/ etc.
│   ├── features/          # home/, search/, theme/
│   ├── generated/{keys,ui}/   # GITIGNORED generated docs data
│   ├── layouts/  lib/{hooks}  routes/{$lib}  types/
├── tests/e2e/{baselines}/ # Playwright e2e
├── styles/
```
Note: `apps/docs/registry/` mirrors `libs/ui/registry/ui` directory set almost exactly (one extra example in libs/ui: `keyboard-navigation.integration.test.tsx`); the docs copy is generated and gitignored.

### apps/landing — minimal
```
apps/landing/src
├── sections/   # marketing sections
├── styles/
public/
```
Only `sections/` + `styles/`. No features/lib/hooks. 1 test file.

### cli/diffgazer — bulletproof-react adapted to Ink TUI + servers
```
cli/diffgazer/src
├── app/                  # app shell
│   ├── providers/        # server-provider, keyboard-provider
│   ├── screens/          # TUI screens (home/help/history/review/onboarding) + settings/ subfolder of screens
│   ├── router.tsx  routes.ts  navigation-context.tsx  back-navigation.ts  index.tsx
├── components/{layout, ui}/   # TUI presentational components
├── config/               # navigation.ts
├── features/             # onboarding/, settings/ (mirror web feature names) with components/ + hooks/ + derive-* logic
├── hooks/                # use-key, use-scope, use-servers, use-exit, use-config-guard, ...
├── lib/                  # servers/ (embedded-server, api-server, web-server, create-process-server, server-factories), shutdown-token, *-navigation, api, ink-key, query-client
├── theme/                # TUI theme
├── types/                # cli.ts
├── banner.ts  config.ts  index.tsx  tui-entry.tsx  web-launcher.ts
```
Top dirs match web (`app, components, config, features, hooks, lib, theme, types`) — bulletproof-react clearly extended to a TUI binary. Some root-level files mixed with their tests (`config.ts`+`config.test.ts`, `web-launcher.ts`+`.test.ts`, `cli-options.ts`+`.test.ts`).

### cli/add — flat command-oriented CLI
```
cli/add/src
├── commands/             # list, add, remove, diff, init (+ add/ subfolder: css-ops, manifest, file-ops)
├── utils/                # paths, registry, transform, detect, hashing, namespaces, integration, add-integration
├── context.ts  index.ts
scripts/                  # bundle-registry.ts, generate-keys-copy-bundle.ts, copy-generated.ts
src/generated/            # GITIGNORED generated bundles
```
NOT bulletproof-react; flat `commands/` + `utils/`. Fits a CLI.

### cli/server — feature-folder + shared/lib (DDD-ish)
```
cli/server/src
├── features/             # config/, git/, health/, review/, settings/, shutdown/ — each: router.ts, schemas.ts, service.ts (+ review/ has ~25 files: pipeline, diff, drilldown, sse-replay, sessions, ...)
├── shared/
│   ├── lib/              # git/, config/, storage/, ai/, http/, diff/, review/, testing/ + crypto, fs, log, paths, validation, errors
│   └── middlewares/      # request-logger, rate-limit, setup-guard, trust-guard, body-limit
├── index.ts  app.ts  http-server.ts  dev.ts
```
Feature-first backend with `shared/lib/<domain>/` and `shared/middlewares/`. `features/review/` is by far the heaviest folder (~25 modules).

### libs/core — domain-grouped library
```
libs/core/src
├── api/                  # client, protocol, git, config, review, shutdown + hooks/ (queries/), bound, query-client, types
├── catalog/{__fixtures__}/   # models.dev catalog
├── footer/  forms/  hooks/  layout/  navigation/  onboarding/  providers/  review/  select/  streaming/  theme/
├── schemas/              # config/, context/, events/, git/, presentation/, review/, shared/ + errors.ts
├── testing/              # dom-polyfills, factories
├── env.ts  format.ts  get-figlet.ts  index.ts (+ many domain index.ts barrels)
tsconfig/                 # shared tsconfig presets (base, node, cli, cli-test, react, test) consumed across repo
scripts/                  # generate-catalog-snapshot.ts, verify-dist-esm-imports.ts
```
Domain-named folders, each with an `index.ts` barrel (20 barrels). `tsconfig/` here is the shared TS preset source for the whole monorepo.

### libs/keys — src + registry + in-package docs + examples
```
libs/keys/src
├── context/    core/    dom/    hooks/ (use-*)    providers/    testing/    index.ts
libs/keys/registry/        # SOURCE registry: examples/use-*/ (committed), registry.json
libs/keys/public/r/        # COMMITTED public registry JSON (6 files)
libs/keys/docs/            # in-package docs content (content/{api,cli,getting-started,guides,hooks}, design/, guides/, hook-docs/, assets/) — 50 files
libs/keys/examples/playground/   # standalone playground app
libs/keys/artifacts/       # nested workspace (publish-artifacts builder + scripts/)
libs/keys/scripts/         # build-shadcn-registry, build-publish-artifacts, validate-registry-closure, verify-rsc-directives, verify-dist-esm-imports, build-docs-data
```

### libs/ui — src is thin; registry holds the real components
```
libs/ui/registry/
├── ui/<component>/        # COMPONENT-FOLDER GROUPING: e.g. button/{button.tsx, button.test.tsx, index.ts} — ~55 component folders + shared/
├── lib/                   # aria-utils, compose-refs, focus, *-variants, selectable-collection, typeahead, diff/, testing/
├── hooks/                 # use-*.ts (controllable-state, listbox, presence, ...) + testing/
├── examples/<component>/  # docs examples (committed)
├── component-docs/  hook-docs/  testing/
libs/ui/src/validation/    # registry validators (the only thing in src/)
libs/ui/shared/            # registry-types.ts
libs/ui/public/r/          # COMMITTED public registry JSON (84 files, ~1.0M)
libs/ui/docs/              # in-package docs content (content/{components,hooks,patterns,theme,integrations,utils,getting-started,cli}) — 102 files
libs/ui/specs/             # 10 LIB-LOCAL spec folders (020..030 *-readiness-audit / sota-*) — process docs living inside the package
libs/ui/prompts/  styles/  testing/  scripts/
```
Key structural observation: `libs/ui` keeps almost no code in `src/`; the library’s actual components live under `registry/ui/<name>/` using the **component-folder grouping** pattern (`button.tsx` + `button.test.tsx` + `index.ts` together). This is the shadcn registry layout, not a classic `src/components`.

### libs/registry — engine library
```
libs/registry/src
├── cli/{bundler, workflows}/   # CLI workflow helpers
├── docs/  docs-data/  shadcn/  utils/  testing/
├── index.ts  schemas.ts
```

---

## 3. tsconfig topology

Shared presets live in **`libs/core/tsconfig/`**: `base.json` (strict ES2022 ESM bundler, declaration+maps, noUncheckedIndexedAccess), `node.json` (extends base, `types: [node]`), `cli.json` (extends node, `jsx: react-jsx`), `cli-test.json` (extends cli, noEmit, vitest globals), `react.json`, `test.json` (extends node, noEmit, vitest globals). These are consumed cross-workspace via relative `extends`.

Per-workspace:

- **apps/web** & **apps/landing** — solution config pattern: `tsconfig.json` = `{ files: [], references: [tsconfig.app.json, tsconfig.test.json] }`, run via `tsc -b`. `tsconfig.app.json` (strict, `@/* -> src/*`, excludes `*.test.*`); `tsconfig.test.json` extends app, re-includes tests, adds `vitest/globals` + `@testing-library/jest-dom` types, relaxes unused checks.
- **apps/docs** — NOT a solution build: `tsconfig.json` (bundler, big `paths` map incl. cross-workspace `@diffgazer/keys` -> `../../libs/keys/src`, fumadocs collections); `tsconfig.test.json` extends it (adds node + vitest + jest-dom, allowJs); `registry/tsconfig.json` references `../tsconfig.test.json` and re-declares `@/components/ui/*`, `@/lib/*`, `@/hooks/*` for the mirrored registry. type-check = `tsc --noEmit && tsc --noEmit -p tsconfig.test.json`.
- **cli/diffgazer** — `tsconfig.json` extends `libs/core/tsconfig/cli.json` (outDir dist, rootDir src, jsx); `tsconfig.test.json` extends `libs/core/tsconfig/cli-test.json` (adds react type). type-check = `tsc --noEmit`.
- **cli/add** — self-contained `tsconfig.json` (NodeNext, emits to dist, not extending core presets); `tsconfig.test.json`; `scripts/tsconfig.json` extends `core/tsconfig/base.json` (NodeNext, node types) for build scripts.
- **cli/server** — `tsconfig.json` extends `libs/core/tsconfig/node.json`; `tsconfig.test.json`.
- **libs/core** — `tsconfig.json` extends local `tsconfig/node.json` (emits to dist); `tsconfig.test.json` extends local `tsconfig/test.json`; `scripts/tsconfig.json` extends local `tsconfig/base.json` (NodeNext). type-check chains all three.
- **libs/keys** — `tsconfig.json`, `tsconfig.test.json`, `scripts/tsconfig.json`, plus `examples/playground/tsconfig.json`. type-check chains main + test + scripts.
- **libs/ui** — FOUR configs: `tsconfig.json` (bundler, `@/lib/* -> registry/lib/*`, `@/hooks/* -> registry/hooks/*`, `@/components/ui/* -> registry/ui/*`); `tsconfig.test.json` (extends, node+vitest+jest-dom); `tsconfig.tools.json` (extends, NodeNext, for tsup.config + scripts + src); `scripts/tsconfig.json` (extends `../../core/tsconfig/base.json`, NodeNext); plus `registry/tsconfig.json`. type-check chains main + tools + test + scripts.
- **libs/registry** — `tsconfig.json`, `tsconfig.test.json`. type-check chains both.

Pattern summary: apps use `tsc -b` solution refs OR an app+test pair; libs/CLIs use `tsc --noEmit` chains over `{tsconfig, tsconfig.test, scripts/tsconfig}`. Build-script coverage is deliberate (per AGENTS.md verification gate). Shared presets centralized in `libs/core/tsconfig/`.

---

## 4. Where tests live

Test file counts (`*.test.*` / `*.spec.*`, excluding generated):
- apps/web: 53 · apps/docs: 14 · apps/landing: 1
- cli/diffgazer: 29 · cli/add: 7 · cli/server: 47
- libs/core: 62 · libs/keys: 20 · libs/ui: 77 · libs/registry: 14

**Dominant pattern: co-located unit tests** — 324 test files sit next to their source (e.g. `libs/ui/registry/ui/button/button.test.tsx`, `libs/core/src/format.test.ts`, `cli/server/src/features/review/...test.ts`). Only ~20 files live in a dedicated `tests/` or `__tests__/` dir, all in **apps/docs** (`apps/docs/tests/e2e/` Playwright).

Per type:
- **Unit / component**: co-located `*.test.ts(x)` everywhere (Vitest + jsdom + Testing Library). Examples: `libs/core/src/onboarding/can-proceed.test.ts`, `libs/keys/src/dom/focusable.test.ts`, `apps/web/src/app/providers/theme-provider.test.tsx`.
- **Integration**: spelled as a `.test.tsx` with `integration` in the name, NOT a separate `.integration.ts` extension (0 files use `.integration.test` extension as a vitest project; e.g. `libs/ui/registry/.../keyboard-navigation.integration.test.tsx`, `apps/web/.../model-select-dialog.integration.test.tsx`). Co-located.
- **type tests**: `vitest --typecheck` (`test:types`) per workspace, no separate files dir.
- **e2e**: ONLY apps/docs — `apps/docs/tests/e2e/` + `baselines/`, Playwright (`test:e2e`), plus Lighthouse (`lighthouse`).
- **smoke**: ROOT-level Node test scripts in `scripts/monorepo/` (`smoke-cli.mjs`, `smoke-package-install.mjs`, `smoke-shadcn-install.mjs`, `smoke-modelsdev.mjs`, plus `*-runner`/`*-fixtures`/`*-shared`/`smoke-keys-absent.mjs`). These run installed-package / CLI / shadcn-copy / models.dev paths. There are also Node `--test` files for the scripts themselves (`scripts/monorepo/*.test.mjs`, run via `pnpm test:scripts`).
- **bench**: `scripts/monorepo/benchmark-server.mjs` + `benchmark-slo`.

No `__tests__/` folders in libs/apps source; the repo standard is strict co-location. Test helpers live in per-package `testing/` dirs (`apps/web/src/testing/`, `libs/core/src/testing/`, `cli/server/src/shared/lib/testing/`, `libs/ui/registry/.../testing/`).

---

## 5. Root-level directories and files

Tracked-file counts: `audits/` 41 · `specs/` 61 · `agent-specs/` 21 · `agent-skills/` 1 · `deploy/` 5 · `scripts/` 30 · `tmp/` 0 (gitignored).

- **scripts/** — TRACKED, current. All under `scripts/monorepo/`: artifact prepare/validate/sync (`artifacts/*.mjs`, `validate-artifacts.mjs`, `sync.mjs`), invariant check (`check-invariants.mjs`), smoke runners, benchmark, `run-with-artifacts.sh`, plus their own `*.test.mjs`. `scripts/README.md`. This is live monorepo tooling referenced by root `package.json`.
- **specs/** — TRACKED but content is archival: only `specs/archive/` exists (001-p0-handoff, 028-sota-handoff, 031-sota-implementation, plus HANDOFF_*/SOTA-AUDIT md). `.gitignore` lists `/specs/` (root-anchored) yet these are tracked from before; effectively a stale archive of past handoff specs. Likely STALE.
- **agent-specs/** — TRACKED. `review-start-session-lifecycle-plan.md` + a `superpowers/specs/` subtree. Agent planning docs; mixed currency, looks like working notes (likely stale-ish).
- **agent-skills/** — TRACKED. Single `diffgazer-project-rules/SKILL.md` — the project-rules skill. Current (mirrors AGENTS.md intent).
- **audits/** — TRACKED, multiple dated runs: `2026-05-28/` (DEPLOYMENT-ROUTING, FIX-PLAN, HANDOFF-READINESS, INDEX, REPO-MAP, STRUCTURE, findings/, spec/), `2026-05-31/` (THERMO-NUCLEAR-AUDIT + remediation spec + handoff prompts + remediation-workflow.mjs), `2026-06-01/` (THERMO-NUCLEAR-REAUDIT, HANDOFF, phase-runner/reaudit workflow mjs). Most recent is 2026-06-01 (3 days before today). Active-ish audit history; older dated dirs are stale.
- **deploy/** — TRACKED, current. `landing.Dockerfile`, `registry.Dockerfile`, `registry-nginx.conf`, `spa-nginx.conf`, `REVERSE_PROXY.md`. Paired with root `Dockerfile`, `docker-compose.yml`, `.dockerignore`.
- **tmp/** — GITIGNORED (0 tracked), 91 entries: scratch HTML previews, PNG screenshots, redesign/audit `.md` notes (command-palette, code-block, diff-view, callout variants, `audit-screenshots/`, `command-palette-explorations/`). Pure scratch; not part of the tree.

Stray root markdown files (all TRACKED despite `.gitignore` patterns `AUDIT_*.md`, `OPUS_AUDIT_*.md`, `FIX_SPEC_*.md` — committed before ignore, so they persist):

| File | Size | mtime | Status |
|---|---|---|---|
| `AUDIT_2026-05-24.md` | 193 KB | 2026-05-24 | TRACKED, **STALE** (11 days old; matches an ignore pattern → intended to be transient) |
| `OPUS_AUDIT_2026-05-24.md` | 707 KB | 2026-05-24 | TRACKED, **STALE** (huge single-file audit dump) |
| `FIX_SPEC_2026-05-24.md` | 52 KB | 2026-05-24 | TRACKED, **STALE** |
| `DEPLOYMENT_PLAN.md` | 20 KB | 2026-05-31 | TRACKED, semi-current (4 days) |
| `TESTING.md` | 11 KB | 2026-06-02 | TRACKED, current (2 days) |
| `PACKAGE_GOVERNANCE.md` | 19 KB | 2026-05-31 | TRACKED, semi-current |
| `README.md` | 3.6 KB | 2026-06-03 | TRACKED, current |

Other tracked root governance files: `AGENTS.md` (the contract), `CLAUDE.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, `LICENSE`, `README.md`, `.env.example`, `biome.root.json`, `turbo.json`, `pnpm-workspace.yaml`, `docker-compose.yml`, `Dockerfile`, `.dockerignore`. `.changeset/` present (changesets release flow).

Observation for the owner: the three `*_2026-05-24.md` mega-audit dumps at repo root are the most obvious structural noise — large, dated, and already matched by `.gitignore` patterns yet still committed.

---

## 6. Committed-contract registry dirs (public/r)

These are the reviewable handoff contract (per AGENTS.md "Generated Artifacts"): keep committed.

- **libs/ui/public/r/** — 84 JSON files, ~1.0 MB total. Flat directory of `<item>.json` (e.g. `accordion.json`, `button.json`, `aria-utils.json`, `active-heading.json`). Each is a shadcn-style registry item (component / hook / lib util). One JSON per registry item; flat, no subfolders.
- **libs/keys/public/r/** — 6 JSON files, ~80 KB total: `focus-restore.json`, `focus-trap.json`, `focusable.json`, `navigation.json`, `scroll-lock.json`, `registry.json` (the index). Flat.

Source-of-truth registries (committed, the build inputs): `libs/ui/registry/` (703 tracked files: `ui/<name>/`, `lib/`, `hooks/`, `examples/`, `component-docs/`, `hook-docs/`) and `libs/keys/registry/` (`examples/use-*/`, `registry.json`). The `apps/docs/registry/` and `apps/docs/public/r/` copies are generated/gitignored mirrors for the docs site.

---

## Cross-cutting structural notes (for downstream audit agents)

1. **Two distinct structural philosophies coexist**: (a) bulletproof-react feature-first (`apps/web`, `cli/diffgazer` adapt it to a TUI binary, `cli/server` uses a backend variant with `features/` + `shared/lib/`); (b) shadcn-registry layout (`libs/ui`, `libs/keys`) where real code lives under `registry/` not `src/`.
2. **Component-folder grouping is already in use** in `libs/ui/registry/ui/<name>/` (component + test + index together) and in deeper web feature dialogs (`features/providers/components/api-key-dialog/`). `apps/web` mixes single-file components with grouped folders.
3. **File naming**: kebab-case dominant. Hyphen-count distribution across non-generated src TS/TSX basenames: 0 hyphens 356, 1 hyphen 258, **2 hyphens 164, 3 hyphens 36, 4 hyphens 6** → the "at most one hyphen" goal is widely violated today (≈206 files have 2+ hyphens, e.g. `use-review-results-keyboard.ts`, `api-key-method-selector.tsx`, `use-api-key-dialog-keyboard.ts`, `secrets-migration.ts`). `.test.ts`/`.test.tsx` and `use-x.ts` suffix conventions are universal and intentional.
4. **Barrels**: heavy in `libs/core` (20 `index.ts`) and `apps/web` (15); `libs/ui` and `cli/diffgazer` have ~0 `src` barrels (ui re-exports via package `exports` map per component; cli imports directly).
5. **CLI vs lib structure question (owner's open Q-b)**: `cli/add` is flat command/utils (fits a CLI, not bulletproof-react). `cli/server` is feature-first backend. `cli/diffgazer` does push bulletproof-react onto a TUI binary, including `app/screens/settings/` nesting screens under screens. Evidence is in-repo that the pattern was force-fit onto CLI/TUI/server.
6. **Generated vs committed**: gitignored = `tmp/`, `apps/docs/registry/`, `apps/docs/src/generated/`, `*/docs/generated/`, `cli/add/src/generated/`, `dist/`, `.output/`, `.turbo/`, `coverage/`. Committed contract = `libs/{ui,keys}/public/r` + `libs/{ui,keys}/registry` sources.
