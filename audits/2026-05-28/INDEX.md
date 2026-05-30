# Diffgazer — SOTA Audit (2026-05-28)

## Executive Summary

Diffgazer is a mature, well-tested pnpm + turbo monorepo (2,234 TS/TSX source files, ~183k LOC, 344 Vitest suites, ~53% test density) with strong architectural boundaries, a real shadcn-compatible registry, and disciplined artifact-validation tooling. Overall code quality is high: this audit surfaced **349 findings across 23 domains, but only 4 are Critical and most (60 High, 141 Medium, 144 Low) are quality/consistency improvements rather than correctness defects** — and nearly all are NEW (347 NEW, 2 STILL-OPEN, 0 regressions). The dominant systemic issue is a **public-source `.js`-import-specifier violation** (the 2 Criticals in `types-exports`) that breaks copy/shadcn consumers, plus a large `libs/ui` ↔ `apps/docs` registry duplication and several oversized multi-concern files. **Handoff posture: NOT READY today.** No package is published and the hosted registry (`r.b4r7.dev`) is not live, so all three consumption paths are gated; the copy-from-source and shadcn artifact contracts are content-ready (pending a clean-tree build to re-verify artifact↔source sync), but the npm path additionally has two concrete source-level defects (the `@diffgazer/keys` optional-peer + static-import breakage, and a `diffgazer` MIT/Apache-2.0 license-field mismatch). Fix the Criticals and the two npm blockers, author changesets, bring the registry host live, then re-run the full release-check before any external handoff.

## Findings by Domain

| Domain | Total | Critical | High | Medium | Low |
| --- | ---: | ---: | ---: | ---: | ---: |
| [a11y](findings/a11y.md) | 13 | 0 | 2 | 5 | 6 |
| [anti-slop](findings/anti-slop.md) | 9 | 0 | 4 | 2 | 3 |
| [apps-docs](findings/apps-docs.md) | 19 | 1 | 0 | 10 | 8 |
| [apps-hub](findings/apps-hub.md) | 17 | 0 | 8 | 8 | 1 |
| [apps-landing](findings/apps-landing.md) | 21 | 0 | 4 | 10 | 7 |
| [apps-web](findings/apps-web.md) | 17 | 1 | 3 | 8 | 5 |
| [architecture-boundaries](findings/architecture-boundaries.md) | 8 | 0 | 1 | 4 | 3 |
| [cli-add](findings/cli-add.md) | 16 | 0 | 1 | 8 | 7 |
| [cli-diffgazer](findings/cli-diffgazer.md) | 8 | 0 | 1 | 0 | 7 |
| [cli-server](findings/cli-server.md) | 27 | 0 | 6 | 13 | 8 |
| [docs-quality](findings/docs-quality.md) | 9 | 0 | 1 | 6 | 2 |
| [dry-reuse](findings/dry-reuse.md) | 8 | 0 | 1 | 4 | 3 |
| [gap-coverage](findings/gap-coverage.md) | 48 | 0 | 6 | 18 | 24 |
| [handoff-3paths](findings/handoff-3paths.md) | 16 | 0 | 2 | 8 | 6 |
| [libs-core](findings/libs-core.md) | 9 | 0 | 0 | 1 | 8 |
| [libs-keys](findings/libs-keys.md) | 12 | 0 | 0 | 6 | 6 |
| [libs-registry](findings/libs-registry.md) | 14 | 0 | 2 | 8 | 4 |
| [libs-ui-components](findings/libs-ui-components.md) | 11 | 0 | 2 | 4 | 5 |
| [libs-ui-hooks-registry](findings/libs-ui-hooks-registry.md) | 15 | 0 | 2 | 6 | 7 |
| [public-api](findings/public-api.md) | 3 | 0 | 0 | 0 | 3 |
| [structure-srp](findings/structure-srp.md) | 21 | 0 | 7 | 7 | 7 |
| [tests-behavior](findings/tests-behavior.md) | 14 | 0 | 3 | 3 | 8 |
| [types-exports](findings/types-exports.md) | 14 | 2 | 4 | 2 | 6 |
| **TOTAL** | **349** | **4** | **60** | **141** | **144** |

**The 4 Critical findings:**

- **`types-exports` (2 — both NEW, both the systemic public-handoff blocker):**
  - **F316** — Public `@diffgazer/keys` source (`libs/keys/src/index.ts`) uses relative `.js` import specifiers, violating the AGENTS.md rule and breaking copy/shadcn consumers when registry source is copied locally.
  - **F317** — Public `@diffgazer/ui` registry source (e.g. `libs/ui/registry/ui/diff-view/diff-view.tsx` and dozens of others) uses relative `.js` import specifiers, breaking the public copy/shadcn install path across many components.
- **`apps-docs` (1):** F164 — Invalid React Context Provider syntax in `SearchContext` (type-safety).
- **`apps-web` (1):** F161 — `cycleTierFilter` called without its required argument (type-safety).

## By Status

| Status | Count |
| --- | ---: |
| NEW | 347 |
| STILL-OPEN | 2 |
| REGRESSION | 0 |
| ALREADY-FIXED | 0 |
| **TOTAL** | **349** |

The 2 STILL-OPEN findings both live in `cli-server`: **F24** and **F25** — HTTP status-code mismatch (UNAUTHORIZED returned as `403` instead of `401`) in the main router and the shutdown router. Every other finding across all 23 domains is NEW; there are no regressions against the prior audit and nothing was carried as already-fixed.

## Handoff Readiness

Summarized from [HANDOFF-READINESS.md](HANDOFF-READINESS.md). A global publish gate caps all three paths: nothing is published to npm and `r.b4r7.dev` is not live, so no path is live-installable by an external user today.

- **shadcn registry** (`libs/{ui,keys}/public/r/*`) — **NOT-READY (live); artifact-ready.** The committed registry JSON and smoke contracts are correct and complete (target fields, no `.js` specifiers, direct-URL-localizable deps, transitive theme auto-install), but the hosted endpoint `r.b4r7.dev` does not resolve, so every `npx shadcn add https://r.b4r7.dev/...` snippet is gated. Pending a clean-tree build to re-verify artifact↔source sync.
- **npm package** (`@diffgazer/{ui,keys,add}`, `diffgazer`) — **NOT-READY** (both content and live). Two concrete source defects independent of the publish gate: (1) `@diffgazer/keys` is an *optional* peer of `@diffgazer/ui` yet common components (Select, Checkbox, Radio, Tabs, Accordion, …) **statically** import it with no lazy load / clear-error fallback (the figlet/keys asymmetry), so a keys-absent install fails opaquely; (2) `cli/diffgazer/package.json` advertises `"license": "MIT"` while shipping an Apache-2.0 LICENSE file. Packages are also unpublished and have no changesets.
- **copy-from-source** (`dgadd` + direct GitHub copy) — **NOT-READY (live install command); artifact-ready.** The `dgadd` copy-first lifecycle, ownership-aware removal, and import rewrites are the strongest-verified path, but the documented `npx @diffgazer/add add ui/button` command requires `@diffgazer/add` to be published; until then it works only via a locally packed tarball or direct GitHub file copy.

## Deployment & Routing

Summarized from [DEPLOYMENT-ROUTING.md](DEPLOYMENT-ROUTING.md). The architecture is **separate apps per (sub)domain behind Coolify-managed Traefik**, sharing a design system — not one app doing in-app multi-domain routing. **`docs.b4r7.dev`** (`apps/docs`, TanStack Start) ships today as Node SSR; it can become fully static (the recommended uniform model) once the single runtime dependency — Fumadocs search — is converted to static `staticGET`. **`diffgazer.b4r7.dev`** (`apps/landing`) is a static Vite SPA placeholder needing real content + canonical/OG/sitemap. **`b4r7.dev`** (`apps/hub`) is a no-build raw-HTML stub that must be promoted to a minimal Vite app before it can consume `@diffgazer/ui`, the shared shell, or any SEO helper. Top deploy risks: a contradictory build model (CI pushes GHCR images *and* docs describe Coolify-builds-from-source), landing/hub `robots.txt` pointing at sitemaps that are never generated, and the apex host missing from the post-deploy health check.

## Coverage & Completeness

This audit ran **22 audit domains plus a dedicated gap-coverage pass** (23 findings files total). The 22 domains: `a11y`, `anti-slop`, `apps-docs`, `apps-hub`, `apps-landing`, `apps-web`, `architecture-boundaries`, `cli-add`, `cli-diffgazer`, `cli-server`, `docs-quality`, `dry-reuse`, `handoff-3paths`, `libs-core`, `libs-keys`, `libs-registry`, `libs-ui-components`, `libs-ui-hooks-registry`, `public-api`, `structure-srp`, `tests-behavior`, and `types-exports`; the 23rd file, `gap-coverage`, is the cross-cutting gap pass that sweeps anything the domain finders missed (security, performance, observability, env/config, and similar). The audit was reconstructed from a verified multi-round run: **3 rounds of finder agents, an adversarial verification pass, and a reconciliation pass** against the prior `AUDIT_2026-05-24`, `OPUS_AUDIT_2026-05-24`, and `FIX_SPEC_2026-05-24` artifacts to dedupe, re-status (NEW vs STILL-OPEN vs regression), and confirm nothing was double-counted or silently dropped. Structural context is captured in [STRUCTURE.md](STRUCTURE.md) and [REPO-MAP.md](REPO-MAP.md), handoff posture in [HANDOFF-READINESS.md](HANDOFF-READINESS.md), and deployment/routing in [DEPLOYMENT-ROUTING.md](DEPLOYMENT-ROUTING.md).

## Files

| File | Description |
| --- | --- |
| [INDEX.md](INDEX.md) | This master audit index. |
| [FIX-PLAN.md](FIX-PLAN.md) | Prioritized remediation plan (companion doc). |
| [STRUCTURE.md](STRUCTURE.md) | SOTA structure conventions, big-file split plan, object-args refactors, naming fixes. |
| [DEPLOYMENT-ROUTING.md](DEPLOYMENT-ROUTING.md) | Hosting model, shared-shell ownership, routing/origins, CI/deploy pipeline. |
| [HANDOFF-READINESS.md](HANDOFF-READINESS.md) | Per-path handoff verdict (shadcn / npm / copy-from-source) + pre-handoff checklist. |
| [REPO-MAP.md](REPO-MAP.md) | Packages, dependency graph, sizes, largest files, coverage ledger. |
| [findings/a11y.md](findings/a11y.md) | Accessibility findings (13). |
| [findings/anti-slop.md](findings/anti-slop.md) | Anti-slop / DRY / dead-code findings (9). |
| [findings/apps-docs.md](findings/apps-docs.md) | `@diffgazer/docs` findings (19). |
| [findings/apps-hub.md](findings/apps-hub.md) | `@diffgazer/hub` findings (17). |
| [findings/apps-landing.md](findings/apps-landing.md) | `@diffgazer/landing` findings (21). |
| [findings/apps-web.md](findings/apps-web.md) | `@diffgazer/web` findings (17). |
| [findings/architecture-boundaries.md](findings/architecture-boundaries.md) | Architecture/layer-boundary findings (8). |
| [findings/cli-add.md](findings/cli-add.md) | `@diffgazer/add` (`dgadd`) findings (16). |
| [findings/cli-diffgazer.md](findings/cli-diffgazer.md) | `diffgazer` CLI findings (8). |
| [findings/cli-server.md](findings/cli-server.md) | `@diffgazer/server` findings (27). |
| [findings/docs-quality.md](findings/docs-quality.md) | Documentation-quality findings (9). |
| [findings/dry-reuse.md](findings/dry-reuse.md) | Cross-package DRY / reuse findings (8). |
| [findings/gap-coverage.md](findings/gap-coverage.md) | Gap-coverage pass — security/performance/observability/config (48). |
| [findings/handoff-3paths.md](findings/handoff-3paths.md) | Three-path handoff findings (16). |
| [findings/libs-core.md](findings/libs-core.md) | `@diffgazer/core` findings (9). |
| [findings/libs-keys.md](findings/libs-keys.md) | `@diffgazer/keys` findings (12). |
| [findings/libs-registry.md](findings/libs-registry.md) | `@diffgazer/registry` findings (14). |
| [findings/libs-ui-components.md](findings/libs-ui-components.md) | `libs/ui` component findings (11). |
| [findings/libs-ui-hooks-registry.md](findings/libs-ui-hooks-registry.md) | `libs/ui` hooks & registry findings (15). |
| [findings/public-api.md](findings/public-api.md) | `@diffgazer/ui` public-API findings (3). |
| [findings/structure-srp.md](findings/structure-srp.md) | Structure / SRP findings (21). |
| [findings/tests-behavior.md](findings/tests-behavior.md) | Test-behavior / coverage findings (14). |
| [findings/types-exports.md](findings/types-exports.md) | Types & exports findings (14) — includes the 2 Critical `.js`-specifier blockers. |
