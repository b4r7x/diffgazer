# Handoff Execution Plan

Date: 2026-05-23
Sources: 6-agent SOTA audit + HANDOFF_AUDIT_FINDINGS.md validated by 4 Opus agents

---

## Verdict

The May 22 SOTA audit found 9 P0 blockers. **All code-level P0s are fixed** -- the 3 broken registry components, 5 security fixes (loopback binding, token guard, project root, trust identity, session trust collapse), and domain migration are done.

However, the HANDOFF_AUDIT_FINDINGS.md surfaced a **second class of issues** that the original audit did not cover: CI/CD supply-chain safety (release workflow doesn't pin SHA, deploy runs independently), browser hardening (no CSP), accessibility regressions (Field SSR ARIA, Select search label), and docs architecture gaps. These are not regressions -- they were always present but not in scope of the original audit.

**Current state:**
- **UI library**: Production-ready. 49 components, 16 hooks, 240 examples, 69 test files. Excellent API consistency, accessibility, and design token system.
- **Registry (shadcn + copy + dgadd)**: Ready. All 312 file paths valid. 3 previously broken components fixed.
- **CLI security**: Core P0s fixed. Browser hardening (CSP) and local-app auth model refinement remain.
- **Build/CI**: Comprehensive pipeline, but release/deploy workflows have supply-chain gaps.
- **Docs**: Build-ready, 114 MDX pages, SSR+prerender. Not deployed.
- **npm packages**: Not published. All tooling ready (changesets, provenance, pack validation).
- **Domains**: All NXDOMAIN. DNS not configured.

---

## Decisions Needed Before Fix Work

These cannot be parallelized -- they gate the work streams below.

### D1: Deployment target -- VPS+Coolify or Vercel?

| Option | Cost | Ops burden | Registry hosting |
|--------|------|------------|-----------------|
| **A: VPS + Coolify** (current DEPLOYMENT_PLAN.md) | $5-10/mo | OS patches, Docker, SSL, 4 containers | Separate `r.b4r7.dev` nginx |
| **B: Vercel** (recommended for this scale) | $0 | Zero | `docs.b4r7.dev/r/` (same origin as docs) |
| **C: Hybrid** (Cloudflare Pages + Vercel) | $0 | Minimal | Cloudflare static |

This decision affects: registry REGISTRY_ORIGIN value, Dockerfiles relevance, nginx configs, deploy workflow, and whether `r.b4r7.dev` exists at all.

If Vercel: change `REGISTRY_ORIGIN` to `https://docs.b4r7.dev`, set `NITRO_PRESET=vercel`, connect 3 projects. Needs test deploy to verify TanStack Start + Nitro works on Vercel.

If VPS: keep current plan, fix deploy workflow (C5), add CSP to nginx (M13).

### D2: CLI local-app auth model -- expand threat model?

Current defenses: 127.0.0.1 binding + Host header validation + per-run token + origin checks + CORS.

The token is JS-readable (`window.__DIFFGAZER_SHUTDOWN_TOKEN__`). HANDOFF_READINESS_AUDIT.md's own threat model says same-user local processes reading the token are **not in scope**. The real risk is XSS from untrusted content (git commits, AI responses, file content rendered in the web UI).

| Option | What it does | Effort |
|--------|-------------|--------|
| **A: Add CSP only** (recommended) | Blocks XSS vectors that would read the token. Keeps current token auth. | Low |
| **B: CSP + HttpOnly cookie** | Full cookie-based auth. Eliminates JS-readable token entirely. | High |

CSP is high-value regardless. The cookie migration is marginal benefit for a local app where the only external content is git diffs and AI output.

### D3: Docs architecture -- support manual-only libraries?

Currently `prepare:generated` wipes the content directory and requires `artifactSource` for each library. Adding a new library with hand-written docs (no generated artifacts) would fail.

| Option | What it does |
|--------|-------------|
| **A: Keep artifact-only** | All docs are generated from registry. Simpler pipeline. Future libraries must have registries. |
| **B: Add manual namespace support** | Skip `resetDir` for namespaces without `artifactSource`. Allow hand-authored MDX alongside generated. |

### D4: Server-side search -- keep SSR or migrate to client-side?

The docs app is SSR only because of `fumadocs-core/search/server`. Everything else is prerendered.

| Option | What it does | Effort |
|--------|-------------|--------|
| **A: Keep SSR** | Works now. Requires Node.js runtime (Vercel serverless or VPS). | None |
| **B: Migrate to Pagefind/Orama** | Full static output. Cloudflare Pages free tier. Zero cold starts. | Medium |

Not blocking -- can be done later. Vercel handles SSR fine on free tier.

### D5: Stale P0 handoff spec -- archive or reconcile?

`specs/001-p0-handoff/tasks.md` has 148 unchecked tasks but most work is actually done. The tracker is stale, not the work.

| Option | What it does |
|--------|-------------|
| **A: Archive** | Move to `specs/archive/`, stop referencing. Simpler. |
| **B: Reconcile** | Check each of 148 tasks against current code. Time-consuming. |

---

## Already Fixed (do not re-litigate)

These were validated as FIXED by the Opus agents:

| ID | What | Evidence |
|----|------|----------|
| P0-1 | Registry components (menu, navigation-list, code-block) | All 312/312 file paths valid |
| P0-2 | Server hostname binding (127.0.0.1) | `embedded-server.ts:110` |
| P0-3 | Per-run token guard on all /api/* routes | `app.ts:75-88` |
| P0-4 | Client project root ignored in packaged mode | `request.ts:8` |
| P0-5 | Trust identity server-derived | `router.ts:73-87` |
| P0-6 | Session trust collapse | `store.ts:334-337` |
| P0-7 | Domain migration to docs.b4r7.dev / r.b4r7.dev | Only stale audit docs reference old domain |
| M5 | CI dirty check order | Runs after build, before verify (correct) |
| M6 | Coverage thresholds defined | `libs/ui/vitest.config.ts` |

---

## Work Streams (after decisions land)

### Stream 1: CLI Browser Hardening

**Scope:** `cli/server/`, `cli/diffgazer/src/lib/servers/`
**Do not touch:** `libs/ui/`, `libs/keys/`, `apps/`, `.github/`

| ID | Finding | Status | Action |
|----|---------|--------|--------|
| C2 | No CSP headers | OPEN | Add `secureHeaders()` + explicit CSP to `cli/server/src/app.ts`. Nonce-based if inline script stays. |
| C1 | JS-readable token | OPEN | Depends on D2. If option B: migrate to HttpOnly cookie. If option A: CSP is sufficient. |
| M3 | No rate limit on AI routes | OPEN | Add per-process rate limits on review creation, drilldown, model fetch in `cli/server/src/features/review/router.ts` |
| M4 | files[] input unbounded | PARTIAL | Add `.max(100)` and per-item `.max(500)` to `files` array in `cli/server/src/features/review/schemas.ts` |
| M2 | Dev-mode project root header | OPEN | Add explicit opt-in flag or secondary dev token |

**Verify:** `pnpm --filter @diffgazer/server test && pnpm --filter @diffgazer/server type-check`

---

### Stream 2: CI/CD & Release Pipeline

**Scope:** `.github/workflows/`, root `package.json` scripts
**Do not touch:** `libs/`, `apps/`, `cli/` source code

| ID | Finding | Status | Action |
|----|---------|--------|--------|
| C4 | Release doesn't pin readiness SHA | OPEN | Add `ref: ${{ github.event.workflow_run.head_sha }}` to checkout step in `release.yml:30` |
| C5 | Deploy runs independently of readiness | OPEN | Gate deploy on readiness success. Remove `\|\| echo` failure masking in `deploy.yml:81`. Add post-deploy health checks. |
| H1 | NPM_TOKEN vs Trusted Publishing | OPEN | Configure npm Trusted Publisher, switch to OIDC auth. Keep provenance. |
| M7 | Lint/check not in release gates | OPEN | Add `pnpm run check` to `verify` and `release-check` scripts |
| Our P1-4 | diffgazer missing prepublishOnly | OPEN | Add `prepublishOnly` script to `cli/diffgazer/package.json` |

**Verify:** CI changes can only be fully verified post-merge. Validate YAML syntax locally with `actionlint` if available.

---

### Stream 3: Registry & Handoff Polish

**Scope:** `libs/ui/scripts/`, `libs/ui/public/r/`, `libs/keys/public/r/`, `libs/registry/`, `scripts/monorepo/smoke-*`, `apps/docs/src/lib/consumption-metadata.ts`, `cli/add/`
**Do not touch:** `cli/server/`, `cli/diffgazer/`, `.github/`, component source in `libs/ui/registry/ui/`

| ID | Finding | Status | Action |
|----|---------|--------|--------|
| Our P1-3 | Smoke tests don't cover menu/navigation-list/code-block | OPEN | Add 3 items to `uiItems` in `smoke-shadcn-install.mjs:28` |
| Our P1-5 | @diffgazer/keys peer floor too low | OPEN | Change `>=0.1.1` to `>=0.2.0` in `libs/ui/package.json:332` |
| H9 | Hidden registry items not freshness-validated | OPEN | Extend validation in `libs/registry/src/shadcn/validate.ts:105` to compare content, not just existence |
| H10/M8 | Registry origin hardcoded in consumption-metadata | OPEN | Read from `import.meta.env.VITE_REGISTRY_ORIGIN` with `r.b4r7.dev` default. Depends on D1. |
| M15 | Copy metadata paths disagree with dgadd defaults | OPEN | Align `consumption-metadata.ts:42` with `cli/add/src/context.ts:97` defaults |
| M1 | Smoke test coverage gap (84 items, 9 tested) | OPEN | Add direct-install smoke for all hidden transitive deps |
| C3 | Hidden hook shims still have @diffgazer/keys imports | PARTIAL | Verify hidden items never surface to copy consumers. Add defensive assertion. |
| Our P1-6 | Stale .output build artifacts | OPEN | Rebuild docs after other registry changes. Sequence after H10. |

**Verify:** `pnpm run prepare:artifacts && pnpm run validate:artifacts:check && DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke`

---

### Stream 4: Accessibility Fixes

**Scope:** `libs/ui/registry/ui/field/`, `libs/ui/registry/ui/select/`, `apps/web/src/features/`
**Do not touch:** `cli/`, `.github/`, `libs/keys/`, `libs/registry/`

| ID | Finding | Status | Action |
|----|---------|--------|--------|
| H5 | Field ARIA IDs set in useEffect, not render | OPEN | Compute `labelId`/`descriptionId`/`errorId` during render using `useId()` + slot presence tracking. Remove effect-based registration. |
| H6 | Select search combobox ignores Field label | OPEN | Destructure `ariaLabelledBy` from context in `select-search.tsx`. Compose with existing `aria-label`. |
| M9 | RadioGroup/CheckboxGroup missing group labels | OPEN | Add `aria-label` to RadioGroup in `theme-selector-content.tsx:87` and `provider-step.tsx:49` |
| M10 | Raw window.addEventListener bypasses key scopes | OPEN | Replace with `useKey("?", handler)` from `@diffgazer/keys` in `home-presentation.tsx` |
| H4 | Keys installation MDX URL missing /r/ prefix | PARTIAL | Fix `libs/keys/docs/content/getting-started/installation.mdx:41-42` URLs |

**Verify:** `pnpm --filter @diffgazer/ui test && pnpm --filter @diffgazer/web test && pnpm --filter @diffgazer/ui type-check`

---

### Stream 5: Docs & Architecture

**Scope:** `apps/docs/`, `libs/registry/src/docs/`
**Do not touch:** `cli/`, `libs/ui/registry/`, `libs/keys/src/`

| ID | Finding | Status | Action |
|----|---------|--------|--------|
| H7 | prepare:generated wipes manual docs | OPEN | Depends on D3. If option B: skip `resetDir` for namespaces without `artifactSource`. |
| H8 | Docs is SSR, not static | OPEN | Depends on D1 and D4. If Vercel: set `NITRO_PRESET=vercel`. If static: migrate search. |
| H11 | Artifacts excluded from npm tarballs | OPEN | Accepted by design. Docs always deploy from monorepo workspace, not published packages. Document this. |
| M14 | Docs preview uses package imports not copy mode | OPEN | Evaluate whether to align preview with copy consumer experience. Low priority. |

**Verify:** `pnpm --filter @diffgazer/docs type-check && pnpm --filter @diffgazer/docs test`

---

### Stream 6: Deploy Infrastructure

**Scope:** `deploy/`, `Dockerfile`, `docker-compose.yml`, DNS, hosting
**Do not touch:** application source code

| ID | Finding | Status | Action |
|----|---------|--------|--------|
| M13 | Nginx lacks CSP/HSTS for static sites | OPEN | Add headers to `deploy/spa-nginx.conf` and `deploy/registry-nginx.conf`. Only if D1=VPS. |
| DNS | All domains NXDOMAIN | OPEN | Configure DNS records per D1 choice. |
| Landing | Placeholder only | OPEN | Build out `apps/landing` with @diffgazer/ui components. Low priority for initial deploy. |
| H3 | Stale 148-task spec | OPEN | Depends on D5. Archive or reconcile. |
| Our P2-7 | Registry validator silent-skip for missing non-CSS files | OPEN | Add existence check for all declared files in `validate-registry-metadata.ts:440` |

**Verify:** Depends on D1. If VPS: `docker compose build && docker compose up -d` + health checks. If Vercel: test deploy + `curl -fI` endpoints.

---

## Execution Sequence

```
D1-D5 decisions (user input)
    │
    ├─── Stream 1 (CLI security)     ─── independent
    ├─── Stream 2 (CI/CD)            ─── independent
    ├─── Stream 4 (Accessibility)    ─── independent
    │
    ├─── Stream 3 (Registry)         ─── depends on D1 (registry origin)
    │         │
    │         └── Rebuild .output    ─── after registry origin changes
    │
    ├─── Stream 5 (Docs)             ─── depends on D1, D3, D4
    │
    └─── Stream 6 (Deploy)           ─── depends on D1, runs last
              │
              └── npm publish        ─── after all streams pass
```

Streams 1, 2, and 4 are fully independent and can run in parallel immediately after decisions.
Stream 3 needs D1 (registry origin).
Stream 5 needs D1 + D3 + D4.
Stream 6 runs last and includes the actual deployment.

---

## Counts

| Category | Total | Fixed | Partially Fixed | Still Open |
|----------|-------|-------|-----------------|------------|
| Critical | 5 | 0 | 1 | 4 |
| High | 11 | 0 | 3 | 8 |
| Medium | 16 | 2 | 2 | 12 |
| Low/Info | from original | varies | - | informational |
| **Our audit P1s** | 6 | 0 | 0 | 6 |

**Total actionable items: ~30** across 6 work streams.

---

## SOTA Rationale

**Analysis method:** 10 subagents total (6 SOTA analysis + 4 Opus validation), ~350 tool calls, primary-source code inspection only.
**Skills applied:** `sota` (quality amplifier), `code-audit`, `clean-code`, `code-quality`, `anti-slop`, `architecture` (implicit in all agents).
**Sources:** All findings from direct file reads and grep. No WebSearch or context7 used -- audit is project-internal.
**Key decisions:** Presented deployment as tradeoff (Path A vs B) rather than verdict. Flagged CLI auth model as a decision point rather than a flat fix. Separated "decisions needed" from "work to do" to prevent agents from committing to incompatible directions.
