# Deployment & Multi-Domain Routing Design — b4r7.dev / Diffgazer

**Date:** 2026-05-28
**Author:** Platform/Architecture review
**Scope:** Hosting model, shared shell ownership, routing/origin strategy, build & deploy pipeline, gaps in current deploy setup, and outstanding work for `apps/hub` + `apps/landing`.

> **Framing correction (important).** This is **not** one app doing multi-domain routing. There are **separate apps per (sub)domain**, each deployed independently. The architecture goal is that these separate deploys *share a reusable template and design system* so a future app slots in cheaply — not that they share a runtime router. This doc treats "multi-domain routing" as **DNS + reverse-proxy host routing across independent deployments**, plus **cross-property linking + canonical/SEO consistency**, not in-app routing.

## 0. Properties in scope

| Domain | App (workspace pkg) | Today's tech | Today's runtime | Status |
|---|---|---|---|---|
| `docs.b4r7.dev` | `apps/docs` (`@diffgazer/docs`) | TanStack Start 1.138 + Fumadocs 16 + Nitro 3 beta | **Node SSR** (`node .output/server/index.mjs`) | Real, shipping; *entry point / template for future apps* |
| `diffgazer.b4r7.dev` | `apps/landing` (`@diffgazer/landing`) | Vite 7 + React 19 + `@diffgazer/ui` | **Static** (nginx SPA) | Exists, minimal one-screen placeholder |
| `b4r7.dev` (apex) | `apps/hub` (`@diffgazer/hub`) | Raw hand-written HTML | **Static** (nginx, no build) | Stub only — *cannot consume libs yet* |
| `r.b4r7.dev` | (built from `libs/ui` + `libs/keys` public registries) | Static JSON | **Static** (nginx) | Real; shadcn-compatible registry |
| *(none — not public)* | `apps/web` (`@diffgazer/web`) | Vite SPA, `/api` → local CLI server | **Bundled into `diffgazer` CLI binary** | **Out of public-deploy scope** (see §1.5) |

Reverse proxy is **Coolify-managed Traefik** with Let's Encrypt auto-TLS and HTTP→HTTPS redirect ([`deploy/REVERSE_PROXY.md`](../../deploy/REVERSE_PROXY.md) lines 1-36). DNS is a wildcard `A *` + apex `A @` to the VPS IP ([`DEPLOYMENT_PLAN.md`](../../DEPLOYMENT_PLAN.md) lines 75-98).

---

## 1. Recommended hosting / build per app

### Cross-cutting recommendation: collapse to ONE uniform static model where possible

Three of the four public properties are already static nginx deploys. The only SSR outlier is `docs`. The single most valuable architectural move is to make **docs static too**, so every public property is the same boring "build → `dist`/`.output/public` → nginx" shape. That uniformity is what makes docs a genuine *template* for future apps (deliverable 2 + 4), and it removes the only long-running Node process (the most expensive, highest-attack-surface container — currently capped at 512 MB vs 64 MB for the rest, [`docker-compose.yml`](../../docker-compose.yml) lines 16-20).

This is feasible. See §1.1 for the precise constraint that decides it.

### 1.1 `docs.b4r7.dev` → **RECOMMENDATION: ship static (CDN/nginx), drop the Node runtime**

**Current state (verified):** docs prerenders *and* runs as a Node server. `apps/docs/package.json` build is `DOCS_PRERENDER=1 vite build`, `vite.config.ts` wires `tanstackStart({ prerender: { enabled, crawlLinks: false }, pages })` **and** `nitro()`, and the root `Dockerfile` runs `node .output/server/index.mjs` (lines 50-53). So today it emits prerendered HTML into `.output/public` **and** keeps a Node process for request-time server functions. Prerender ≠ static: there are 5 `createServerFn` call sites.

**The discriminating question: do any of those 5 server functions need *request-time* execution?** I read all five:

| Server fn | File | Reads from | Request-time? |
|---|---|---|---|
| `docsShellLoader` (pageTree) | `src/routes/$lib.tsx` | static MDX `source.pageTree` | **No** — build-resolvable |
| `serverLoader` (page meta) | `src/routes/$lib/$.tsx` | `source.getPage()` | **No** — build-resolvable |
| `serverLoader` (index meta) | `src/routes/$lib/index.tsx` | `source.getPage()` | **No** — build-resolvable |
| `resolveLibrarySwitchPath` | `src/layouts/header.tsx` | `source.getPage()` (deterministic slug map) | **No** — build-resolvable |
| `doSearch` | `src/features/search/hooks/use-search.ts` → `src/lib/search-server.ts` | `createFromSource(source).search(query)` on a **user-typed query** | **YES** — the only true runtime dependency |

Four of five exist only to keep the heavy fumadocs `source` import out of the client bundle; with prerendering they resolve at build time per page. **Search is the single blocker** to a pure-static deploy.

**Conversion path (two independent fixes):**

1. **Static-ify the 4 content/nav loaders — but split them by input shape.** TanStack Start runs server functions at build time during prerender when they carry `staticFunctionMiddleware` (result cached as static JSON keyed by function id + payload hash) — TanStack Start *Static Server Functions* docs.[^tss-static-fn] Because the cache only covers payloads executed at build time, the split matters:
   - The **3 page loaders** (`$lib.tsx` pageTree, `$lib/$.tsx` + `$lib/index.tsx` page meta) key off bounded inputs (library id / page path) that are all prerendered → `staticFunctionMiddleware` caches them cleanly. (Or inline them into the route loader so prerender embeds the data directly.)
   - The **library switcher** (`resolveLibrarySwitchPath`) takes the *current page's slugs* as input, so a switch from a slug combo not pre-computed would miss the static cache. It is a deterministic slug map over the **already-loaded `pageTree`**, so move it **client-side** instead of static-caching it. This removes its server dependency without relying on the build having enumerated every (from-page × target-library) pair.
2. **Static-ify search.** Fumadocs supports fully-static client-side search: export `staticGET` from `createFromSource(source)` and switch the client hook to `useDocsSearch({ type: 'static' })`, which downloads a prebuilt index JSON instead of calling a server.[^fd-static-search] Our search server is exactly `createFromSource(source)` (`src/lib/search-server.ts`), so this is a drop-in. Caveat from fumadocs: the client downloads the whole index, "expensive" for very large sites — fine at our current ~115 MDX pages, revisit if the corpus explodes.[^fd-static-search]

The fumadocs-blessed shape for a fully static TanStack Start build is **SPA mode + prerender**: `tanstackStart({ spa: { enabled: true }, prerender: { enabled: true } })` (TanStack Router auto-crawls; add hidden paths to `pages`).[^fd-tss-static] Output lands in `.output/public` and is served by any static host — the same nginx image as landing. Keep the existing prerender `pages` enumeration from `scripts/generate-sitemap.mjs` (`vite.config.ts` lines 12-17) so every route is emitted.

**Net recommendation:** after the two fixes, deploy docs from `.output/public` via an nginx container identical to `deploy/landing.Dockerfile`.

**Fallback (today's working state — keep documented):** if you choose *not* to convert search, **keep `node-server`**. Node server is TanStack Start's default deploy target and the documented self-host path (`node .output/server/index.mjs`).[^tss-hosting] The current root `Dockerfile` is correct for that mode. This is a legitimate ship-now option; the static conversion is an optimization, not a prerequisite.

> **RECOMMENDATION / time-sensitive — Nitro 3 is beta, verify the preset before relying on it.** Do **not** assume a Nitro v3 `static`/SSG *preset* name. The static path here is **TanStack Start's own SPA-mode + prerender** producing `.output/public`, *not* a Nitro preset. Nitro's documented **default production preset is the Node.js server**; presets are selected via `NITRO_PRESET`/`SERVER_PRESET` env, `nitro.config.ts` `preset`, or `--preset`, and several hosts (Vercel, Netlify, Cloudflare, AWS Amplify, Azure, Firebase App Hosting, Stormkit, Zeabur) are auto-detected zero-config.[^nitro-deploy] TanStack Start's `nitro()` plugin takes `nitro({ preset: '…' })`; documented Start targets include `node-server`, `bun`, `vercel`, `netlify`, `cloudflare-workers`, `railway`, `appwrite-sites`.[^tss-hosting] Because we self-host on a generic VPS behind Traefik, **`node-server` is the only relevant SSR preset**; everything else is static. Re-verify these names against `nitro.build/deploy` at deploy time since v3 is pre-release.[^nitro-deploy]

### 1.2 `diffgazer.b4r7.dev` (`apps/landing`) → **static SPA (keep)**

Vite + React + `@diffgazer/ui`, built to `dist`, served by nginx (`deploy/landing.Dockerfile`, `deploy/spa-nginx.conf`). No SSR needed — it's a marketing page. **Keep static.** Outstanding content/SEO work in §6.

### 1.3 `b4r7.dev` (`apps/hub`) → **promote stub to a minimal Vite static app, then keep static**

Today hub is raw hand-written HTML served by nginx with **no build step** (`deploy/hub.Dockerfile` copies `apps/hub/public/` directly). Fine for a placeholder but architecturally a dead end: **a no-build static page cannot consume `@diffgazer/ui`, the shared shell, design tokens, or any JS SEO helper.** Since hub is the portfolio root and the natural home for cross-property navigation, it should become a tiny Vite app exactly like landing (same Dockerfile shape). Recommendation in §6. Until then it stays static nginx.

### 1.4 `r.b4r7.dev` (registry) → **static JSON (keep)**

`deploy/registry.Dockerfile` builds `libs/{ui,keys}` and serves the committed `public/r/**` JSON via nginx with CORS + rate-limit + security headers (`deploy/registry-nginx.conf`). Correct as-is. Not an "app" — included for completeness.

### 1.5 `apps/web` → **explicitly out of public-deployment scope**

`@diffgazer/web` is a Vite SPA whose dev server proxies `/api` to `http://127.0.0.1:3000` (the local CLI's embedded Hono server — `apps/web/vite.config.ts`). Per `AGENTS.md` Architecture Boundaries, `apps/web` is **bundled into the local `diffgazer` CLI binary** and `cli/server` is "CLI-internal, not a reusable primitive." It has **no public subdomain and must not get one.** Listed here so its absence reads as deliberate.

---

## 2. Shared shell, design tokens & navigation — who owns what

The task's premise ("docs as entry point for future apps implies a reusable template, not 3 disconnected deploys") is correct and is **the main architecture gap today**: `DEPLOYMENT_PLAN.md` treats the three properties as independent deploys with hand-duplicated chrome (e.g. hub re-types the nav link list as static HTML, lines 343-385). There is no shared shell package.

### 2.1 What is already shared vs duplicated (verified)

| Concern | Owner today | Shared correctly? |
|---|---|---|
| **Design tokens** (TUI theme CSS) | `libs/ui` — exports `./theme.css`, `./theme-base.css`, `./styles.css` (verified in `libs/ui/package.json`) | **Partially.** `apps/landing` imports them directly (`@diffgazer/ui/theme.css` etc, `src/styles/index.css`). `apps/docs` consumes the **same tokens via a synced copy** — `apps/docs/styles/` is **git-ignored** (`apps/docs/.gitignore` line 12) and written by the docs **artifact-sync** step (`apps/docs/scripts/artifacts/sync`, exercised by `sync.test.ts` which writes `styles/styles.css`), copying from `libs/ui`. Verified `apps/docs/styles/theme.css` is **byte-identical** to `libs/ui/styles/theme.css` — i.e. a synced copy, *not* a hand-edited fork. `apps/hub` **hard-codes hex values** in inline `<style>` (e.g. `#0a0a0a`, `#7aa2f7`) — **drift risk**. |
| **Header / sidebar / footer shell** | `apps/docs/src/layouts/{header,sidebar,footer}.tsx` — **app-local, not extracted** | **No.** Not reusable by landing/hub/future apps. |
| **Footer logic** (page-footer state) | `libs/core` `./footer` (`use-page-footer.ts`, provider) | Logic shared; React shell is not. |
| **Navigation logic** (grouping, back-target, trust) | `libs/core` `./navigation` | Logic shared; React nav UI is not. |
| **Theme token keys/types** | `libs/core` `./theme` (`token-keys.ts`) | Shared (types/keys only). |
| **SEO / canonical / sitemap** | `apps/docs/src/lib/seo.ts` + `apps/docs/scripts/generate-sitemap.mjs` — **docs-only** | **No.** Landing/hub can't reuse it (see §3). |

So tokens *are* shared (via two delivery mechanisms), but the **visual shell and the SEO logic are docs-local**, and **hub bypasses tokens entirely**.

### 2.2 Ownership recommendation (grounded in `AGENTS.md` extraction rules)

`AGENTS.md`: *"Extract primitives, not product widgets … `libs/ui` owns reusable shadcn-like UI primitives and headless-ish hooks that can build app components without importing app code … Do not move app-specific components such as … onboarding copy … into `libs/ui`."* That rule cleanly partitions the shell:

1. **Generic, slot-based shell → `libs/ui`.** Add a small compound primitive set — `AppShell` (header/content/footer regions), `SiteHeader` (logo slot + nav slot + actions slot), `SiteFooter` (link columns + meta). These are *primitives with slots*, contain **no product copy or domain logic**, and qualify as "reusable compound components with a clear public contract." They become the reusable template every property mounts.
2. **App-specific chrome stays per-app, composing the primitives.** The docs library switcher + search button (`apps/docs/src/layouts/header.tsx` is full of `DocsLibraryId`/search-context logic) and the landing CTA are product widgets — they stay in their app and fill the `SiteHeader` slots. This is exactly the `AGENTS.md` "keep app adapters thin" rule.
3. **Tokens: standardize on the `@diffgazer/ui` import everywhere.**
   - Migrate `apps/hub` off inline hex onto `@diffgazer/ui/theme*.css` (requires hub to become a build step — §1.3 / §6).
   - Keep landing's direct import.
   - Docs' synced-copy path (via `apps/docs/scripts/artifacts/sync`, §2.1) is acceptable since it derives byte-for-byte from `libs/ui`, but the sync should stay the only writer — add a header comment / lint note so no one hand-edits the git-ignored `apps/docs/styles/`, which would silently fork the theme.
4. **Cross-property nav data → `libs/core` (single source of the property list).** The "diffgazer / docs / hub / github" link set is currently re-typed in `apps/hub/public/index.html`, `apps/landing/src/App.tsx`, and the docs header GitHub link. Put the canonical list of properties (label, href, external?) in `libs/core` (it already owns `./navigation`). Every property's `SiteHeader`/`SiteFooter` renders from it, so adding a future app updates all cross-links in one place.

> **Concrete answer to "which package owns the shared shell":**
> - **`libs/ui`** owns the *visual shell primitives* (`AppShell`/`SiteHeader`/`SiteFooter`, slot-based, no copy).
> - **`libs/core`** owns *shell-feeding logic*: the cross-property navigation registry, footer/nav state (already there), theme token keys (already there), **and the extracted SEO/canonical/sitemap helpers** (§3).
> - **Each app** owns its *product chrome* (copy, domain widgets) and mounts the shell.
> This matches the existing `libs/ui` = primitives / `libs/core` = logic / `apps/*` = composition split and the `AGENTS.md` boundaries.

---

## 3. Routing / origin strategy (cross-links, env origins, canonical, sitemaps, SEO)

### 3.1 Host routing

Pure DNS + Traefik host-rule routing; no in-app multi-domain logic. Wildcard `A *` covers all current + future subdomains, apex `A @` for hub ([`DEPLOYMENT_PLAN.md`](../../DEPLOYMENT_PLAN.md) lines 79-98; Traefik `Host()` rules in [`deploy/REVERSE_PROXY.md`](../../deploy/REVERSE_PROXY.md) lines 98-120). A new app = one DNS name (covered by wildcard) + one Coolify resource. Keep.

### 3.2 Env-driven origins (current state — mostly good, one stale instruction)

Origins are already env-driven and centralized:

- **Registry origin:** `REGISTRY_ORIGIN` constant in `libs/registry/src/constants.ts` (= `https://r.b4r7.dev`, **already migrated** — see §5) bakes URLs into generated registry JSON. Client-side docs uses **`VITE_REGISTRY_ORIGIN`** with a fallback: `apps/docs/src/lib/consumption-metadata.ts` line 7 — `const REGISTRY_ORIGIN = import.meta.env.VITE_REGISTRY_ORIGIN ?? "https://r.b4r7.dev"`.
- **Docs public origin:** `VITE_PUBLIC_ORIGIN` → `apps/docs/src/lib/seo.ts` (`PUBLIC_ORIGIN`, strips trailing slash, defaults to `https://docs.b4r7.dev`) → canonical + OG URLs; same var read by `scripts/generate-sitemap.mjs` (`resolveOrigin()`).
- Build args flow through root `Dockerfile` (lines 17-24), `docker-compose.yml` (lines 6-9), `turbo.json` (`@diffgazer/docs#build` `env` allowlist, lines 9-13), `.env.example`.

> **Stale-doc note:** `DEPLOYMENT_PLAN.md` §2.2 (lines 129-138) tells you to change `consumption-metadata.ts` to `import { REGISTRY_ORIGIN } from "@diffgazer/registry"`. The code has **already moved past that** to the cleaner build-time `VITE_REGISTRY_ORIGIN` env approach. Don't follow that step — it would regress an env-driven value to a hard import. Update the plan.

### 3.3 Canonical URLs & SEO — works for docs, broken for landing/hub

- **Docs:** solid. `buildCanonicalUrl` + per-page `buildPageSeo` (canonical, OG, Twitter) in `seo.ts`; `__root.tsx` sets root head defaults.
- **Landing:** `apps/landing/index.html` has `<title>`/`<meta description>` but **no canonical tag** and **no OG image** wired.
- **Hub:** static HTML *does* have canonical + OG (`apps/hub/public/index.html` lines 8-18). Ironically the stub is more SEO-complete than landing — but it hard-codes everything.

### 3.4 Sitemaps & robots — concrete bug

- **Docs:** correct. `generate-sitemap.mjs` writes `sitemap.xml` **and** `robots.txt` into `.output/public` at build (`writeSitemap`, lines 141-156), origin-aware. (There is no committed `apps/docs/public/robots.txt`; the real one is generated into `.output/public` at build time — verified.)
- **Landing & hub: broken promise.** Both ship a `robots.txt` pointing at a sitemap that **does not exist**:
  - `apps/landing/public/robots.txt` → `Sitemap: https://diffgazer.b4r7.dev/sitemap.xml` — **no sitemap is generated** (no sitemap tooling in `apps/landing`).
  - `apps/hub/public/robots.txt` → `Sitemap: https://b4r7.dev/sitemap.xml` — same, no generator.
  Crawlers will 404 on both. Fix in §6.

### 3.5 Cross-links — present but hand-duplicated

Cross-property links exist (landing→docs in `App.tsx`; hub→{diffgazer,docs,github} in hub HTML; docs→github in header). They are **typed in three places** with no shared source → drift risk. Fix = the `libs/core` property registry from §2.2(4).

### 3.6 Recommendation: extract SEO to shared logic

Move `buildCanonicalUrl` / `buildPageSeo` / `buildRootHeadDefaults` and the sitemap+robots generator out of `apps/docs` into **`libs/core`** (new `./seo` export, beside `./navigation`/`./footer`). Parameterize by `{ origin, siteName }`. Then:

- docs, landing, and a future-app all call `buildPageSeo({...})` with their own `VITE_PUBLIC_ORIGIN`,
- landing/hub get real, origin-correct `sitemap.xml` + `robots.txt` from one tested generator,
- canonical/OG behavior is uniform across properties.

This is the SEO half of the "reusable template" and directly fixes §3.4's bug for every future app.

---

## 4. Build & deploy pipeline (turbo filters, CI) + how a future app slots in

### 4.1 Turbo build graph (verified)

`turbo.json` already declares per-app build tasks:
- `@diffgazer/docs#build` — `dependsOn: ["^build"]`, env allowlist, outputs `dist/**` + `.output/**`.
- `@diffgazer/landing#build` — `dependsOn: ["^build"]`, outputs `dist/**`.
- generic `build` — `dependsOn: ["^build"]`, outputs `dist/**`.
- `diffgazer#build` — depends on `@diffgazer/web#build` (CLI embeds web).

Per-app filters exist in root `package.json` (`docs:build`, `landing:build`, `web:build`, etc.). **Gap:** no `hub:build`/`hub#build` because hub has no build (fix when hub becomes a Vite app, §6).

Artifact ordering is centralized: `prepare:artifacts` → `prepare:library-artifacts` (registry → keys → ui → add bundles) → docs `prepare:generated`. CI/build gates run with `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1` after a single up-front prepare (root `package.json` `test-ci`, `release-check`).

### 4.2 CI today (verified) — and a contradiction to resolve

Three workflows in `.github/workflows`:
1. **`release-readiness.yml`** (on PR + push to main): install → `pnpm audit --prod` → `pnpm run build` → assert clean `git status` (committed registry up to date) → `pnpm run verify` → package smoke. The quality gate.
2. **`deploy.yml`** (on `release-readiness` success on main, or manual): a **matrix builds all four images** (docs/registry/landing/hub) with `docker/build-push-action`, **trivy-scans** (`CRITICAL,HIGH`, `exit-code: 1`), pushes to **GHCR**, then a `deploy` job `curl`s the **Coolify webhook** and health-checks `docs`/`r`/`diffgazer`.
3. `release.yml` — npm/changesets publish (library packages), orthogonal to site deploys.

> **GAP — two contradictory build models (biggest concrete issue).** `deploy.yml` builds + scans + pushes images to **GHCR** and then triggers Coolify. But `DEPLOYMENT_PLAN.md` §3 and `deploy/REVERSE_PROXY.md` describe Coolify **building from the Dockerfiles itself on git push** (Build Pack = Dockerfile, Watch Paths, etc.). These are mutually exclusive sources of truth. **Decide one:**
> - **(A) Coolify pulls the GHCR image** — Coolify resources set to "Docker Image" pointing at `ghcr.io/.../diffgazer-<svc>:<sha>`; the webhook triggers a redeploy of the new tag. *Pro:* images are trivy-gated before deploy; reproducible; build happens once in CI. **Recommended.**
> - **(B) Coolify builds from source on push** — then `deploy.yml`'s build/push/scan matrix is redundant (and the webhook step races Coolify's own auto-deploy). You'd drop the image build from CI and rely on Coolify Watch Paths.
> Today *both* are wired, meaning either double builds or an unused image registry. Resolve before go-live.

> **GAP — health check misses the apex.** `deploy.yml` verifies `docs.b4r7.dev`, `r.b4r7.dev`, `diffgazer.b4r7.dev` but **not `b4r7.dev` (hub)**. Add a hub check.

### 4.3 Recommended pipeline (assuming model A)

```
push → release-readiness.yml (build + verify + audit + smoke)        [gate]
        └─ on success → deploy.yml
              matrix per service: docker build → trivy(HIGH/CRIT) → push GHCR:<sha>
              deploy: Coolify webhook (deploy pinned <sha> image) → health-check ALL 4 hosts
```
- Keep `cache-from/to: type=gha` (already present) for fast monorepo image builds.
- Pin Coolify to the immutable `:<sha>` tag, not `:latest`, so a deploy is reproducible and rollback = redeploy previous tag.
- Per-service selectivity: either Coolify Watch Paths (model B) or a CI `paths-filter` to skip unchanged service images (model A). Note docs/landing/registry all `dependsOn ^build` of `libs/*`, so a `libs/ui` change legitimately rebuilds docs+landing+registry — correct, not waste.

### 4.4 How a FUTURE app slots in (the template payoff)

With §1–§3 in place, adding `apps/<new>` for `<new>.b4r7.dev` is mechanical:

1. **Scaffold** from the docs (SSR) or landing (static) template depending on need; mount `AppShell`/`SiteHeader`/`SiteFooter` from `libs/ui`, fed by the `libs/core` property registry.
2. **Tokens:** `@import "@diffgazer/ui/theme.css"` — instant visual consistency.
3. **SEO:** `buildPageSeo` + the shared sitemap/robots generator from `libs/core` with its own `VITE_PUBLIC_ORIGIN`.
4. **Cross-links:** add one entry to the `libs/core` property registry → it appears in every other property's nav automatically.
5. **Build:** add `@diffgazer/<new>#build` to `turbo.json` (+ a `<new>:build` script). It inherits `^build` of libs.
6. **Deploy:** copy `deploy/landing.Dockerfile` (static) or root `Dockerfile` (SSR), add a `deploy.yml` matrix entry, create a Coolify resource on the wildcard DNS. No DNS change needed (wildcard).

That is the difference between "a reusable template" and "3 disconnected deploys."

---

## 5. Gaps in current `DEPLOYMENT_PLAN.md` / `deploy/` setup

1. **Stale "create" steps.** `DEPLOYMENT_PLAN.md` §2.4–2.6 instruct creating `deploy/*`, `apps/landing/*`, `apps/hub/*` — **all already exist** (verified on disk + in git). The plan reads as greenfield but the repo is past it. Mark these done.
2. **`REGISTRY_ORIGIN` already migrated.** §2.1 says change it from `https://docs.diffgazer.b4r7.dev` to `https://r.b4r7.dev`; it is **already** `https://r.b4r7.dev` (`libs/registry/src/constants.ts`). Same for `Dockerfile`/`docker-compose.yml` defaults. Done.
3. **Stale consumption-metadata instruction.** §2.2 says import `REGISTRY_ORIGIN` from the package; code already uses the better `VITE_REGISTRY_ORIGIN` env (§3.2). Following the plan would regress it.
4. **Build-model contradiction (§4.2):** GHCR-image vs Coolify-builds-from-source unresolved across `deploy.yml` vs `DEPLOYMENT_PLAN.md`/`REVERSE_PROXY.md`. **Highest-priority fix.**
5. **Docs hosting model not reconciled with the "static template" goal (§1.1):** plan hard-codes docs as Node SSR; the runtime-search dependency that *forces* SSR is never identified. The plan should state the static-conversion path (or explicitly accept SSR).
6. **Landing/hub sitemaps referenced but never generated (§3.4)** — concrete crawler 404.
7. **No shared shell/SEO ownership (§2/§3):** plan duplicates nav as static HTML in hub instead of a shared source; no package owns the template.
8. **Health-check gap:** apex `b4r7.dev` not verified post-deploy (§4.2).
9. **`PORT` mapping is cosmetic-confusing:** `docker-compose.yml` maps `127.0.0.1:${PORT:-3000}:3000` — setting `PORT` changes only the *host* side; the container is fixed at 3000 via `ENV PORT=3000`. Worth a clarifying comment.
10. **`.env.example` Coolify secrets are commented stubs** (`COOLIFY_WEBHOOK_URL`, `COOLIFY_TOKEN`) — fine, but the deploy depends on these being set as GH **Actions secrets** (they are, per `deploy.yml`), not `.env`. Document that distinction so no one commits secrets to `.env`.

**What's genuinely good and should be kept:** pinned base-image digests; non-root nginx/node; trivy gate; CORS/rate-limit/security headers on the registry; `127.0.0.1` host-port binding; Traefik-managed TLS (no custom Docker networks, per Coolify guidance, `DEPLOYMENT_PLAN.md` lines 605-609); env-driven origins; centralized artifact prep.

---

## 6. What `apps/hub` and `apps/landing` still need

### 6.1 `apps/hub` (apex `b4r7.dev`) — the portfolio root

1. **Promote from raw HTML → minimal Vite static app** (mirror `apps/landing`: `package.json` with `build: vite build`, `vite.config.ts`, `index.html`, `src/`). *Reason:* a no-build page can't consume `@diffgazer/ui`, the shared shell, or any JS SEO/sitemap helper (§1.3). This is the **key unblock** — everything else for hub depends on it.
2. Add `@diffgazer/ui` dependency; replace inline hex `<style>` with `@import "@diffgazer/ui/theme*.css"` so the portfolio matches the design system.
3. Mount the shared `SiteHeader`/`SiteFooter` (`libs/ui`) fed by the `libs/core` property registry → cross-links stay correct as apps are added.
4. Generate a real `sitemap.xml` (fix §3.4) via the shared `libs/core` generator; keep canonical/OG (already present) but source them from the shared SEO helper.
5. Add `@diffgazer/hub#build` to `turbo.json` + `hub:build` script; update `deploy/hub.Dockerfile` to a 2-stage build (build → nginx) like landing; add hub to the `deploy.yml` matrix health check.

### 6.2 `apps/landing` (`diffgazer.b4r7.dev`) — product page

1. **Real content.** `src/App.tsx` is a one-screen placeholder (logo, install snippet, single docs link). Build out the actual diffgazer product page using `@diffgazer/ui` primitives (Panel/Button/Badge per the plan's intent).
2. **SEO completeness.** Add canonical + OG image (missing today, §3.3); ideally via the shared `libs/core` SEO helper.
3. **Generate `sitemap.xml`** to satisfy its own `robots.txt` (fix §3.4) — even a one-URL sitemap; use the shared generator.
4. **Adopt the shared shell** once `libs/ui` exposes `SiteHeader`/`SiteFooter`, so its header/footer match docs + hub and cross-links come from the shared registry.
5. **Keep tests green in the gate.** landing already has `type-check` + `test` + an `App.test.tsx`; they run under the root `verify`/turbo graph — keep them passing as content grows.

### 6.3 Shared prerequisites that unblock both (do these first)

- **`libs/ui`:** add `AppShell` / `SiteHeader` / `SiteFooter` slot primitives (§2.2).
- **`libs/core`:** add the **property/navigation registry** (single source of cross-links) and the **`./seo` helper + sitemap/robots generator** (§3.6).
- These two extractions convert "3 disconnected deploys" into the reusable template the brief asks for; hub and landing then become thin compositions.

---

## Appendix A — Decision summary

| Property | Hosting recommendation | Owner of shell | Outstanding |
|---|---|---|---|
| `docs.b4r7.dev` | **Static via SPA-mode+prerender** (convert search to `staticGET` + static-ify 4 source loaders); **fallback `node-server`** | `libs/ui` shell + docs product chrome | search static conversion; extract SEO to `libs/core` |
| `diffgazer.b4r7.dev` | Static nginx (keep) | `libs/ui` shell + landing chrome | content, canonical/OG, sitemap, adopt shell |
| `b4r7.dev` | **Promote to Vite static app**, then nginx | `libs/ui` shell + portfolio chrome | become a build; tokens; sitemap; shell |
| `r.b4r7.dev` | Static JSON nginx (keep) | n/a | none |
| `apps/web` | **Not deployed** — embedded in CLI binary | n/a | n/a |

## Appendix B — Sources

[^tss-hosting]: TanStack Start — *Hosting*. Supported deploy targets include `node-server`, `bun`, `vercel`, `netlify`, `cloudflare-workers`, `railway`, `appwrite-sites`, `nitro`; preset set via `nitro({ preset: '…' })`; Node self-host = `node .output/server/index.mjs`. https://tanstack.com/start/latest/docs/framework/react/guide/hosting (accessed 2026-05-28)
[^tss-static-fn]: TanStack Start — *Static Server Functions*. Server fns run at build time during prerender when carrying `staticFunctionMiddleware` (applied last); result cached as static JSON keyed by fn id + payload hash. https://tanstack.com/start/latest/docs/framework/react/guide/static-server-functions (accessed 2026-05-28)
[^fd-static-search]: Fumadocs — *Orama search (static mode)*. `export const { staticGET: GET } = createFromSource(source)` + client `useDocsSearch({ type: 'static' })` for server-less static search; downloads full index (expensive for very large docs). https://www.fumadocs.dev/docs/headless/search/orama (accessed 2026-05-28)
[^fd-tss-static]: Fumadocs — *Static Build (TanStack Start)*. Recommended fully-static config: `tanstackStart({ spa: { enabled: true }, prerender: { enabled: true } })`; router auto-crawls, add hidden paths to `pages`. https://www.fumadocs.dev/docs/deploying/static (accessed 2026-05-28)
[^nitro-deploy]: Nitro (**v3 docs — beta, verify before use**) — *Deploy*. Default production preset = Node.js server; preset via `NITRO_PRESET`/`SERVER_PRESET` env, `nitro.config.ts` `preset`, or `--preset`; zero-config auto-detect for AWS Amplify, Azure, Cloudflare, Firebase App Hosting, Netlify, Stormkit, Vercel, Zeabur. https://nitro.build/deploy (accessed 2026-05-28)
[^tss-prerender]: TanStack Start — *Static Prerendering*. `tanstackStart({ prerender: { enabled, crawlLinks, autoSubfolderIndex, pages, … } })`; prerendered output served as static files. https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering (accessed 2026-05-28)
