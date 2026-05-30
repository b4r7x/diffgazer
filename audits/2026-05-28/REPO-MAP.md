# Repo Map — Diffgazer monorepo

Diffgazer is a pnpm + turbo monorepo (pnpm@10.28.2, all packages ESM `type: module`) with terminal-inspired React UI components, composable keyboard hooks, a shadcn-compatible registry system, and CLI tooling. Total: 2,234 TypeScript/TSX source files, 183,407 LOC, across `apps`, `cli`, and `libs`. Tests use Vitest exclusively (344 test files). Workspace dependencies use the `workspace:*` protocol; root coordinates builds via turbo with task caching and artifact validation.

## Packages & Responsibilities

### Libraries (`libs/`)

- **@diffgazer/ui** (v0.2.0) — `libs/ui` — React component library: 40+ exported components + hooks + CSS themes; the dominant package (690 files, 57,833 LOC; registry alone 677 files / 56.2k LOC). Build: tsup + declarations + shadcn registry + docs data + artifacts. Workspace dev deps: `@diffgazer/keys`, `@diffgazer/registry`.
- **@diffgazer/keys** (v0.2.0) — `libs/keys` — Composable scoped keyboard navigation / focus-management hooks (83 files, 11,678 LOC). Build: tsc + RSC verify + shadcn registry + docs/artifacts. Workspace dev dep: `@diffgazer/registry`.
- **@diffgazer/core** (v0.0.1, private) — `libs/core` — Schemas, hooks, forms, navigation, onboarding, review state, theme, footer, API types; 20+ entry points (161 files, 10,203 LOC). Build: tsc only. No workspace deps.
- **@diffgazer/registry** (v0.1.0, private) — `libs/registry` — Reusable registry engine for shadcn-compatible registries: contracts, validation/building, copy bundles, CLI workflow helpers, docs sync, bundler (71 files, 9,245 LOC). Build: tsc. No workspace deps.
- **@diffgazer/keys-artifacts** (v0.1.0, private) — `libs/keys/artifacts` — Artifact container (0 source files). Build: `copy-artifacts.mjs`. Workspace dev deps: `@diffgazer/keys`, `@diffgazer/registry`.
- **playground** (unlisted, private) — `libs/keys/examples/playground` — Vite example app. Build: tsc && vite build. Workspace dep: `@diffgazer/keys`.

### CLI (`cli/`)

- **diffgazer** (v0.1.4, public) — `cli/diffgazer` — User-facing CLI dev toolkit; Ink.js TUI; embeds the `@diffgazer/web` SPA build (167 files, 12,835 LOC). Build: tsup + compile web. Workspace deps: `@diffgazer/core`, `@diffgazer/keys`, `@diffgazer/server`.
- **@diffgazer/server** (v0.1.0, private) — `cli/server` — Embedded Hono backend / AI-LLM router (Vercel AI SDK; Google AI, OpenRouter, Zhipu); git service, config store, review orchestration. CLI-internal, bundled into the `diffgazer` binary (117 files, 16,188 LOC). Build: tsc; dev: tsx. Workspace dep: `@diffgazer/core`.
- **@diffgazer/add** (v0.1.1, public, published as `dgadd`) — `cli/add` — NPM installer CLI (add/remove/list/diff) for the public registry (28 files, 3,726 LOC). Build: tsup + bundle registry + generate bundles. Workspace dep: `@diffgazer/registry`; dev deps: `@diffgazer/keys`, `@diffgazer/ui`.

### Apps (`apps/`)

- **@diffgazer/web** (v0.1.0, private) — `apps/web` — Vite SPA dashboard (review, history, onboarding, settings, providers); adds react-router + react-query (198 files, 19,016 LOC). Build: tsc -b && vite build. Workspace deps: `@diffgazer/core`, `@diffgazer/keys`, `@diffgazer/ui`.
- **@diffgazer/docs** (v0.0.0, private) — `apps/docs` — TanStack Start static site with fumadocs; shares registry with web; 115 MDX files (keys: 27, ui: 88) (713 files, 42,603 LOC). Build: `DOCS_PRERENDER=1 vite build` + sitemap; `prepare:generated` pre-dev/build hook. Workspace deps: `@diffgazer/core`, `@diffgazer/keys`, `@diffgazer/registry`, `@diffgazer/ui`.
- **@diffgazer/landing** (v0.0.0, private) — `apps/landing` — Minimal Vite SPA landing page (6 files, 80 LOC). Build: tsc -b && vite build. Workspace dep: `@diffgazer/ui`.
- **@diffgazer/hub** (v0.0.0, private) — `apps/hub` — Stub package (description only; 0 source files, no scripts/deps).

### Dependency graph

```
landing  -> ui
web      -> core, keys, ui
docs     -> core, keys, registry, ui
add      -> registry            (dev: keys, ui)
diffgazer-> core, keys, server  (embeds web SPA)
server   -> core
keys-artifacts -> keys, registry
playground     -> keys
```

## Key Facts

### Build & tooling

- Root `package.json` scripts prepare artifacts, run turbo build/test/type-check, smoke-test CLI + package installs, and publish via changesets.
- Root `turbo.json`: `build` depends on `^build` (deps first); `test`/`type-check` depend on `^test`/`^type-check`; `test:types` needs `^build` + `^test:types`; `prepare:generated` is not cached.
- Build outputs: `build -> dist/**`; `docs#build -> dist/** + .output/**`; `landing#build -> dist/**`; `diffgazer#build` depends on `@diffgazer/web#build`.
- pnpm@10.28.2; all packages `type: module` (ESM); root overrides `@types/node`, `tailwindcss`, `postcss`, `vite`, `jiti`, `undici`, `rollup`, etc. for version consistency.
- Monorepo `verify` command: prepare artifacts + validate + check + type-check + test + test:types + smoke tests. `smoke` covers cli, packages, and shadcn install verification. `release-check` includes `pack --dry-run` for the 4 public packages.

### Size & structure

- Totals: 2,234 TS/TSX source files, 183,407 LOC.
- By top-level: `apps` 917 files / 61,699 LOC; `cli` 312 files / 32,749 LOC; `libs` 1,005 files / 88,959 LOC.
- Largest sub-package: `libs/ui` (690 files, 57,833 LOC; registry-only 677 files / 56,205 LOC). Next: `apps/web` (142 registry/feature files, ~18,969 LOC).
- 98 files exceed 250 LOC; test files dominate the top 30.
- `apps/hub` has 0 source files (stub); `apps/landing` has only 2–6 source files.

### Tests & docs

- 344 test files, Vitest 100% adoption. Test density ~53% (344 test files across ~644 measured source files).
- Largest test suites by file count: `cli/server` (86), `libs/ui` (73), `apps/web` (49).
- `apps/docs`: 115 MDX files. Keys sections: getting-started, api, cli, guides, hooks. UI sections: cli, components, getting-started, hooks, integrations, patterns, theme, utils.
- Generated artifacts (4 locations, ~153 files): `libs/ui/docs/generated` (62), `apps/docs/src/generated` (77), `libs/keys/docs/generated` (12), `cli/add/src/generated` (2). `libs/ui` generated has 49 component dirs + 12 hook dirs.

### Known duplication / hotspots

- `apps/docs` shares its registry with `apps/web` — ~436 LOC of hooks duplication noted.
- `libs/core` holds configuration and review schemas; `libs/registry` handles CLI workflows and package management.

### Deployment

- `deploy/` (6 files, 560 LOC): `registry.Dockerfile` (41), `landing.Dockerfile` (37), `hub.Dockerfile` (16), `registry-nginx.conf` (108), `spa-nginx.conf` (40), `REVERSE_PROXY.md` (318).
- Root `Dockerfile` (53 LOC): two-stage `node:22-alpine` builder + runtime; builds registry → core → keys → ui → docs; runtime `USER node`.
- `docker-compose.yml` (115 LOC): 4 services (docs, registry, landing, hub) bound to `127.0.0.1` on ports 3000/8081/8082/8083; resource limits 512M/0.5CPU (docs), 64M/0.25CPU (others); healthchecks enabled.
- `.env.example` (18 LOC): `REGISTRY_ORIGIN`, `VITE_REGISTRY_ORIGIN`, `VITE_PUBLIC_ORIGIN`, plus commented `VITE_API_URL`, `DIFFGAZER_DEV`, Coolify webhook vars.
- All runtime containers run non-root (`USER node`/`nginx`); `registry.Dockerfile` and `landing.Dockerfile` chown post-copy for nginx; `hub.Dockerfile` copies pre-built static content (no build stage).
- **Critical (OPUS R7-CT-001):** `registry.Dockerfile` builder stage copies only `libs`/`scripts`/`cli/add` and never copies `apps/`, but the runtime stage `COPY` from builder reaches `apps/docs/public/schema/` — the build will fail.

### Existing audit artifacts (2026-05-24)

- `AUDIT_2026-05-24.md` (1,026 LOC / 189K): Verdict, Loop Protocol, Decision Log, Current Findings (6 sub-domains), Pass 2–17 additions, Exclusion Ledger, Verification Log, Sources Consulted.
- `OPUS_AUDIT_2026-05-24.md` (8,781 LOC / 690K): Audit Status/Convergence, Audit Domains, 11 findings sections (Security/Registry/UI/Docs/Build/CLI/Priority + Rounds 2–10 deep dives) covering security, performance, accessibility, user journeys.
- `FIX_SPEC_2026-05-24.md` (1,059 LOC / 51K): Phases 1–8 (Security Blockers, Deployment Readiness, Registry/Package, Component API, Docs/Content, CLI/Server, Code Quality, Test Gaps), Phase Summary, Verification Gates.
- `DEPLOYMENT_PLAN.md` (662 LOC): 5 phases (DNS/Code/Coolify/Deploy/Cleanup) plus Prerequisites, Security Checklist, Coolify Notes, File Inventory, Timeline.

## Largest Source Files

Top source files by LOC (excludes the generated `.diffgazer/context.json`, audit markdown, and directory-stat rows; test files dominate).

| File | LOC |
| --- | --- |
| libs/ui/registry/ui/dialog/dialog.test.tsx | 1,528 |
| libs/ui/registry/ui/navigation-list/navigation-list.test.tsx | 1,175 |
| libs/ui/registry/ui/menu/menu.test.tsx | 1,135 |
| libs/ui/registry/ui/select/select.test.tsx | 1,017 |
| libs/ui/registry/ui/command-palette/command-palette.test.tsx | 920 |
| libs/keys/src/hooks/use-navigation.test.tsx | 880 |
| libs/ui/registry/ui/radio/radio.test.tsx | 843 |
| libs/keys/src/hooks/use-focus-zone.test.ts | 822 |
| cli/add/src/commands/cli-behavior.test.ts | 821 |
| libs/ui/registry/ui/popover/popover.test.tsx | 719 |
| libs/keys/src/hooks/use-focus-trap.test.ts | 700 |
| libs/ui/registry/ui/toggle-group/toggle-group.test.tsx | 679 |
| libs/ui/registry/ui/checkbox/checkbox.test.tsx | 677 |
| cli/server/src/shared/lib/git/service.test.ts | 669 |
| libs/ui/registry/ui/tabs/tabs.test.tsx | 641 |
| libs/ui/registry/ui/sidebar/sidebar.test.tsx | 624 |
| libs/ui/registry/ui/floating-panel/floating-panel.test.tsx | 606 |
| apps/docs/scripts/artifacts/sync.test.ts | 556 |
| libs/ui/registry/ui/toast/toast.test.tsx | 553 |
| libs/ui/registry/hooks/testing/use-floating-position.test.ts | 551 |
| libs/ui/registry/ui/diff-view/diff-view.test.tsx | 550 |
| libs/registry/src/testing/docs-sync.test.ts | 549 |
| libs/ui/scripts/validate-registry-metadata.ts | 547 |
| libs/ui/registry/ui/code-block/code-block.test.tsx | 532 |
| cli/server/src/shared/lib/config/store.ts | 530 |
| libs/ui/registry/ui/accordion/accordion.test.tsx | 518 |
| cli/server/src/app.test.ts | 513 |
| apps/web/src/features/providers/hooks/use-model-dialog-keyboard.test.ts | 497 |
| apps/docs/src/lib/docs-library.test.ts | 493 |
| libs/keys/src/providers/keyboard-provider.test.tsx | 479 |

## Coverage Ledger

Maps packages/paths to audit domains. (`apps/hub` and `apps/landing` carry no source-code audit domain; deployment assets are audited separately.)

### Code / source-code domains

- **apps** (917 files) → web app (198), docs site (713), landing (6).
- **cli** (312 files) → server (117), diffgazer CLI (167), add command (28).
- **libs** (1,005 files) → ui registry (690), keyboard/keys (83), core (161), registry management (71).
- **libs/ui** (57,833 LOC) → component library + tests, hooks, examples, registry metadata; UI components, hooks, styling, theme system.
- **libs/keys** (11,678 LOC) → keyboard navigation and focus management patterns; accessibility.
- **libs/core** (10,203 LOC) → schemas, review state, API integration, streaming; shared types, business logic.
- **libs/registry** (9,245 LOC) → CLI workflows, artifact loading, docs sync, bundler; component registry, documentation loader, sync operations.
- **cli/server** (16,188 LOC) → git service, config management, AI client, review orchestration; server API, AI integration, git operations, review analysis.
- **cli/diffgazer** → CLI orchestration, command routing, core utilities.
- **cli/add** → CLI command handling, bundle generation.
- **apps/web** (19,016 LOC) → feature-driven UI (review, history, onboarding, settings, providers); UI integration, configuration management.
- **apps/docs** (42,603 LOC) → documentation site with shared registry, examples, layouts; documentation generation, markdown processing, component demo loading.
- **apps/hub** (0 files, stub) → none.
- **apps/landing** (2 files, minimal) → none.
- Test coverage ratio: 344 test files across 644 source files (53% test density).

### Deployment / infra domains

- **deploy/** (6 files) → Docker security; registry/landing/hub service architecture; nginx reverse proxy configuration.
- **@diffgazer/docs** (root Dockerfile, 53 LOC) → SSR + hydration, build artifact caching, ~20.6MB JS footprint.
- **@diffgazer/registry** (static JSON service; 41 LOC Dockerfile, 108 LOC nginx) → CORS, shadcn CLI integration, CSS import stripping, schema access control.
- **@diffgazer/landing** (static SPA; 37 LOC Dockerfile) → SEO (missing OG tags), CSP, font loading, navigation structure.
- **@diffgazer/hub** (static portfolio; 16 LOC Dockerfile) → SEO (placeholder content), CSP, font references.
