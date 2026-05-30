# Deploy Runbook — Diffgazer / b4r7.dev

**Who runs this:** you (manual infra/publish steps). The remediation campaign (`SPEC.md`) makes the **code** deploy-ready; it does **not** touch your infra, DNS, registry host, or npm. This runbook is the hand-off boundary.

**Sources (read for detail; not duplicated here):** `../DEPLOYMENT-ROUTING.md` (hosting model, build pipeline, gaps), `../HANDOFF-READINESS.md` (three-path publish gates + pre-handoff checklist), `../../DEPLOYMENT_PLAN.md`, `../../deploy/REVERSE_PROXY.md`.

---

## Part A — What the campaign delivers (code is ready)

When `SPEC.md`'s code gates are green, the following are done in-repo and committed:

- **B1** — no `.js` import specifiers in public source (copy/shadcn consumers build).
- **B2** — `@diffgazer/keys` is a clean **optional** peer: keys-backed `@diffgazer/ui` components lazy-import keys with a clear error; a keys-absent install builds; `cli/diffgazer` license is `Apache-2.0`; license-field invariant added.
- **B13/B14** — `apps/docs` consumes `@diffgazer/ui` (no 600-file mirror); registry items documented; artifact sync passes.
- **B15** — `apps/landing`: SEO-complete (canonical, JSON-LD, OG), static `sitemap.xml` so `robots.txt` resolves, a11y + tests green, builds to `dist/`.
- **B16** — `apps/hub`: minimal **deployable** Vite app (build/tsconfig/vite.config/src), `@diffgazer/ui` theme tokens, static `sitemap.xml`, `@diffgazer/hub#build` in `turbo.json`.
- **Final Gate / HANDOFF-3** — changesets authored; `pnpm run release-check` style code gates green; `git status` clean after `prepare:artifacts`.

After this, each property has a working `build → dist/.output/public → nginx` (docs: Node SSR by default) shape ready to containerize.

---

## Part B — Manual steps you run (in order)

### B.0 — Decide the build model (DEPLOYMENT-ROUTING §4.2) — **blocking, your call**

`deploy.yml` builds+scans+pushes GHCR images **and** docs describe Coolify building from source — mutually exclusive. Pick one before go-live:
- [ ] **Model A (recommended):** Coolify resources = "Docker Image" pointing at `ghcr.io/…/diffgazer-<svc>:<sha>`; webhook redeploys the pinned tag. Keep the CI build/scan/push; trivy-gated before deploy; reproducible; rollback = redeploy previous `:<sha>`.
- [ ] **Model B:** Coolify builds from source on push (Watch Paths) — then **remove** the build/push/scan matrix from `deploy.yml` (it becomes redundant and races Coolify's auto-deploy).
- [ ] Update `DEPLOYMENT_PLAN.md` + `deploy/REVERSE_PROXY.md` to match the chosen model (kill the contradiction).

### B.1 — CI deploy fixes (small edits, but infra-coupled → yours)
- [ ] Add the apex `b4r7.dev` (hub) host to the post-deploy health check in `deploy.yml` (currently checks docs/r/diffgazer only — §4.2).
- [ ] Pin Coolify to the immutable `:<sha>` tag, not `:latest` (Model A).
- [ ] Confirm `COOLIFY_WEBHOOK_URL` / `COOLIFY_TOKEN` are set as **GitHub Actions secrets** (not committed to `.env`) — §5.10.
- [ ] (Optional clarity) comment the `docker-compose.yml` `PORT` host-vs-container mapping — §5.9.

### B.2 — DNS + reverse proxy
- [ ] Wildcard `A *` + apex `A @` → VPS IP (covers all current + future subdomains; `DEPLOYMENT_PLAN.md` §DNS).
- [ ] Coolify-managed Traefik `Host()` rules for `docs.b4r7.dev`, `diffgazer.b4r7.dev`, `b4r7.dev`, `r.b4r7.dev` with Let's Encrypt auto-TLS + HTTP→HTTPS (`deploy/REVERSE_PROXY.md`).
- [ ] One Coolify resource per property (docs SSR via root `Dockerfile`; landing/hub/registry static nginx via their `deploy/*.Dockerfile`).

### B.3 — Bring `r.b4r7.dev` live (gates all shadcn-install snippets)
- [ ] Deploy the registry container (`deploy/registry.Dockerfile`, serves committed `public/r/**`).
- [ ] Confirm `200` on `/r/ui/registry.json`, `/r/ui/button.json`, `/r/keys/<item>.json` (governance acceptance checks).
- [ ] Un-gate the hosted `npx shadcn add https://r.b4r7.dev/...` snippets in the README/docs (4 locations — HANDOFF-READINESS).
- [ ] Add the CI step that asserts the live endpoints (governance asks for it; doesn't exist yet).

### B.4 — Publish npm packages (`@diffgazer/{ui,keys,add}`, `diffgazer`)
- [ ] Changesets already authored by the campaign (HANDOFF-3) → merge the Version PR `release.yml` opens.
- [ ] Publish; then verify `npm view @diffgazer/{ui,keys,add} version` and `npm view diffgazer version`.
- [ ] **Package-manager matrix** (HANDOFF-READINESS pre-handoff): install npm/pnpm/yarn/bun in clean **Vite AND Next** apps against the *real published* packages; for each add the `@/*` alias, the CSS import, and the package-mode Tailwind `@source` entry, then build. (The local smoke only proves tarball/in-process — not the real registry.)
- [ ] `DIFFGAZER_SMOKE_ALLOW_NETWORK=1 DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` so the network/Next fixtures actually execute.
- [ ] `pnpm audit --prod --audit-level=high` (CI hard gate); review the moderate advisories the HIGH-only gate lets through.

### B.5 — Deploy + verify
- [ ] Trigger deploy (Model A: webhook redeploys pinned `:<sha>`; Model B: push triggers Coolify).
- [ ] Post-deploy health-check **all four** hosts including apex `b4r7.dev`.

---

## Part C — Optional / future (explicitly deferred — not blocking deploy)

- **docs static conversion** (DEPLOYMENT-ROUTING §1.1): convert Fumadocs search to `staticGET` + static-ify the 4 content loaders + SPA-mode+prerender → serve docs from `.output/public` via nginx (drops the only Node container). Docs ships fine as **Node SSR** today; this is an optimization. Re-verify Nitro v3 (beta) preset names at deploy time.
- **Reusable-template extraction** (DEPLOYMENT-ROUTING §2/§3/§6): `AppShell`/`SiteHeader`/`SiteFooter` primitives in `libs/ui` + a shared `libs/core` `./seo` + sitemap/robots generator + cross-property nav registry. Worth doing **only when a third real app exists** — until then it's a premature abstraction (two placeholder consumers). Landing/hub deploy correctly with their own minimal SEO/sitemap (Part A).
- **apps/landing real content** — currently a one-screen placeholder; a product decision, not a deploy blocker.
