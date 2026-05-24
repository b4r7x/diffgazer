# SOTA Audit: diffgazer-workspace Handoff Readiness

Date: 2026-05-22 (updated with third verification pass)
Scope: Registry, CLI, docs, web app, security, a11y, hooks, error handling, CSS/theme, build, deployment (VPS)
Method: 18 parallel subagents across 3 passes (~1500 tool calls total), cross-referenced with independent HANDOFF_READINESS_AUDIT.md

---

## Executive Summary

**NOT READY for user handoff.** Three shadcn/copy install paths are broken at runtime. The embedded server has 5 HIGH-severity local-API security issues. Scoped npm packages are not published (E404). All domains are NXDOMAIN. CI publish gate is weaker than the readiness workflow. Registry validator has a blind spot that silently passes broken components.

The npm package build path works correctly. The web app is fully composed from @diffgazer/ui and @diffgazer/keys. Docs content is complete (44 UI + 25 keys pages). Build chain is correct. Type safety is strict across all packages.

---

## P0 — MUST FIX BEFORE ANY HANDOFF

### P0-1: Three components broken in shadcn/copy registry

**Independently confirmed by 2 agents + cross-reference.**

Components `menu`, `navigation-list`, and `code-block` have production files NOT declared in `libs/ui/registry/registry.json` `files[]`. Their `index.ts` imports modules that never get delivered — `npx shadcn add` and `dgadd` both produce broken installs.

| Component | Missing files | Broken exports |
|---|---|---|
| `navigation-list` | `navigation-list-group.tsx`, `navigation-list-group-context.tsx`, `navigation-list-progress.tsx` | `NavigationListGroup`, `NavigationListProgress` |
| `code-block` | `inline-code.tsx` | `CodeBlock.Inline` / `InlineCode` |
| `menu` | `menu-group.tsx`, `menu-label.tsx`, `menu-item-checkbox.tsx`, `menu-item-radio.tsx`, `menu-sub.tsx` | `Menu.Group`, `Menu.Label`, `Menu.ItemCheckbox`, `Menu.ItemRadio`, `Menu.Sub` |

Root cause: `validateRegistryImportClosure` in `libs/ui/scripts/validate-registry-metadata.ts:325-326` — when an imported file is not declared in ANY registry item, `namesByFile.get(importedPath)` returns `undefined`, and the `if (!importedItemName) continue` branch silently skips it. Two distinct failure paths confirmed: (1) orphan files are never visited by the outer loop, (2) imports to undeclared files are silently ignored.

The npm path is unaffected — tsup/tsc resolves all local imports during build. Only copy/shadcn consumers are broken.

Smoke tests (`scripts/monorepo/smoke-shadcn-install.mjs`) test 9 items — none of these three.

### P0-2: Embedded server does not bind to loopback

**Confirmed with 100% confidence.**

`cli/diffgazer/src/lib/servers/embedded-server.ts:109`:
```ts
server = serve({ fetch: app.fetch, port: config.port }, ...)
```

No `hostname` field passed. `@hono/node-server` passes `undefined` to `server.listen()`, which binds on all interfaces (`0.0.0.0`/`::`). The server accepts connections from the LAN.

The Host header middleware guard (403 on non-localhost Host) is a partial mitigation but bypassable via `curl -H "Host: localhost" http://192.168.x.y:PORT/api/...` or DNS rebinding.

Fix: `serve({ fetch: app.fetch, port: config.port, hostname: "127.0.0.1" })`.

### P0-3: Sensitive API routes have no per-run token guard

**Confirmed with 100% confidence.**

The shutdown token (`DIFFGAZER_SHUTDOWN_TOKEN`) is validated ONLY for `/api/shutdown`. All other sensitive routes are unguarded:
- `/api/settings` — trust config read/write
- `/api/config` — provider credentials
- `/api/git` — repository operations
- `/api/review` — review creation and streaming

Any local page from `http://localhost:*` can call these routes via the broad CORS policy.

Additionally: the shutdown token is injected into every SPA HTML response as `window.__DIFFGAZER_SHUTDOWN_TOKEN__` (`embedded-server.ts:95-97`). Any same-origin page can read it from the iframe contentWindow, making even the shutdown token effectively useless.

### P0-4: Packaged API accepts client-supplied project root

**Confirmed with 100% confidence.**

`cli/server/src/shared/lib/http/request.ts:4-9` — `x-diffgazer-project-root` header is honored unconditionally, no packaged-mode restriction. `paths.ts:59-65` validates via `isAllowedPath()` which permits any path under `$HOME` or any path containing `.git`. An attacker can redirect the server to any git repository on the user's machine.

Additional finding: `allowedPathCache` (`paths.ts:13-30`) is a module-level Map that is never invalidated — TOCTOU issue for the path authorization check.

### P0-5: Trust identity is fully client-authoritative

**Confirmed with 100% confidence.**

`POST /api/settings/trust` (`cli/server/src/features/settings/router.ts:56-64`) accepts the full `TrustConfigSchema` body. The store (`cli/server/src/shared/lib/config/store.ts:185-189`) writes it verbatim, keyed by client-supplied `config.projectId`. No server-side validation that:
- `repoRoot` matches the resolved git root for `projectId`
- `projectId` matches the actual project file on disk
- `trustedAt` is server-generated

A malicious local page can pre-populate trust records for arbitrary paths, then later send requests that route through the pre-planted trust.

### P0-6: Web settings collapses session trust to persistent

**Confirmed at TWO call sites (HANDOFF found one, verification found both).**

- `apps/web/src/features/settings/components/trust-permissions/page.tsx:101` — hardcodes `trustMode: "persistent"`
- `apps/web/src/features/home/components/trust-panel.tsx:59` — hardcodes `trustMode: "persistent"`

If a user originally granted session-only trust and later edits permissions, the save silently upgrades to persistent. `trustedAt` is also always reset to `new Date().toISOString()`, erasing the original grant timestamp.

### P0-7: Scoped npm packages not published

**Confirmed via npm registry API (HTTP 404).**

| Package | Status |
|---|---|
| `diffgazer` | Published (0.1.3) |
| `@diffgazer/ui` | NOT PUBLISHED (E404) |
| `@diffgazer/keys` | NOT PUBLISHED (E404) |
| `@diffgazer/add` | NOT PUBLISHED (E404) |

Any user following npm install instructions gets a 404.

### P0-8: All domains are NXDOMAIN

**Confirmed.** No DNS records exist for:
- `docs.diffgazer.b4r7.dev`
- `docs.b4r7.dev`
- `diffgazer.b4r7.dev`

`b4r7.dev` resolves to a parked domain page (domain registered, no active content).

### P0-9: Domain hardcoded across 327 occurrences

**Confirmed: `docs.diffgazer.b4r7.dev` appears in 56 source files.**

Breakdown:
- `apps/docs/` — 7 occurrences across 5 files (seo.ts, generate-sitemap.mjs, consumption-metadata.ts x2, robots.txt, test assertions)
- `libs/registry/src/constants.ts:6` — `REGISTRY_ORIGIN` (no env override)
- `libs/ui/public/r/` — **318 occurrences across 49 JSON files** (registryDependencies URLs)
- `libs/keys/public/r/` — 0 occurrences (clean)

Override coverage: `seo.ts` and `generate-sitemap.mjs` accept `VITE_PUBLIC_ORIGIN`. But `consumption-metadata.ts`, `constants.ts`, `robots.txt`, and all 49 registry JSONs have **no env override** — require code changes + full registry rebuild.

Domain decision still required (see Decision Required section below).

### P0-10: CI dirty-file check will fail

8 staged files in worktree block `release-readiness.yml` git status check. Every push/PR is blocked until committed.

### P0-11: No landing pages exist

- `diffgazer.b4r7.dev` — no app (docs root is a developer nav page, not marketing)
- `b4r7.dev` — no hub/portfolio app

These are new applications to build.

---

## P0 — DECISION REQUIRED: Docs domain

User requested `docs.b4r7.dev`. Codebase has `docs.diffgazer.b4r7.dev` across 327 occurrences.

| Option | Cost | Benefit |
|---|---|---|
| **A: Keep `docs.diffgazer.b4r7.dev`** | Zero code changes | Precise subdomain, future-proof |
| **B: Change to `docs.b4r7.dev`** | 5 source files + Dockerfile + docker-compose + full registry rebuild (49 JSONs) | Shorter, matches user plan |
| **C: Hybrid** | `docs.b4r7.dev` canonical, `REGISTRY_ORIGIN` env var points independently | Flexible, more indirection |

---

## P1 — BEFORE PUBLIC PROMOTION

### P1-1: Broad localhost CORS in packaged mode

**Confirmed.** `cli/server/src/app.ts:49-59` allows any `http://localhost:*` and `http://127.0.0.1:*` origin for `/api/*`. In packaged mode the web UI is same-origin — broad localhost CORS is unnecessary and compounds P0-3.

Fix: restrict CORS to same-origin in packaged mode; keep broad localhost only in dev.

### P1-2: Persisted trust not bound to resolved repo root

**Confirmed.** Trust guard checks `projectId` and `readFiles` but does not verify `trust.repoRoot` matches the current resolved request root.

### P1-3: Publish workflow gate is weaker than release-readiness

**Confirmed.** `release.yml` runs only `release-check`. `release-readiness.yml` runs independently on push-to-main — the two workflows have no `needs:` dependency. Docs E2E (Playwright) is in `release-readiness.yml` but NOT in `release-check` or `verify`. Publish can complete before or despite E2E failure.

### P1-4: StepperTrigger drops consumer onFocus

**Confirmed with 100% confidence.** `libs/ui/registry/ui/stepper/stepper-trigger.tsx:57` — `onFocus` destructured from props but never forwarded to the rendered `<button>`. Any consumer passing `onFocus` gets it silently swallowed. Public prop contract bug.

### P1-5: DialogShell fallback weakens HTMLDialogElement contract

**Confirmed.** `libs/ui/registry/ui/shared/dialog-shell.tsx:254` — fallback path casts `externalDialogRef` via `as unknown as Ref<HTMLDivElement>` and attaches it to a `<div>`. Consumers using `dialogRef.current` expecting `HTMLDialogElement` methods (`.close()`, `.showModal()`, `.returnValue`) will fail on the fallback path.

### P1-6: Docs deployment mode not explicitly decided

**Confirmed.** 5 `createServerFn` calls in `apps/docs/src/` require Node.js runtime. The existing Docker setup works but the intent (SSR vs static) is undecided, affecting E2E test strategy and registry reliability guarantees.

### P1-7: Moderate production audit not clean

**Confirmed via Snyk.** `ws@8.20.0` (via `ink@6.8.0`) carries SNYK-JS-WS-16722635 (medium). CI runs `pnpm audit --prod --audit-level=high` which does not catch medium-severity advisories.

### P1-8: Missing OG/Twitter social images

**Confirmed.** `apps/docs/src/lib/seo.ts` declares `twitter:card: summary_large_image` but emits no `og:image` or `twitter:image`. Social previews show blank.

### P1-9: Docs UI renders old-host shadcn commands as available

**Confirmed.** `consumption-metadata.ts:69,98` hardcode `npx shadcn add https://docs.diffgazer.b4r7.dev/r/...` — shown to users as copy-paste commands before the host is live.

### P1-10: TrustPanel hardcodes internal permission name

**Confirmed.** `apps/web/src/features/home/components/trust-panel.tsx:45` — `value: "readFiles"` hardcoded as focus navigation target. If capability key is renamed, TrustPanel silently falls back to last item with no type error.

### P1-11: Set up VPS infrastructure

Nginx reverse proxy, SSL (Let's Encrypt), CI/CD deploy pipeline, DNS records — none exist yet.

---

## P2 — BEFORE 1.0

### P2-1: No test coverage thresholds
**Confirmed across all packages.** No `vitest.config.ts` has `coverage.thresholds`. `libs/registry` has `coverage.provider` and `coverage.include` but no thresholds. Logic can be deleted without CI failure.

### P2-2: 7 pending changesets with breaking renames
**Confirmed.** 5 minor + 2 patch changesets. First release will be 0.2.0 with breaking API renames (`keys-rename-aliases`, `ui-rename-aliases`, `ui-value-onchange`, `ui-keys-peer-floor`, `floating-panel-extraction`).

### P2-3: Dead light theme CSS
**Confirmed.** `apps/docs/src/routes/__root.tsx:58` hardcodes `data-theme="dark"`. The `[data-theme="light"]` block in `styles/theme.css` (lines 111-208, 98 lines) is permanently unreachable. No toggle exists.

### P2-4: Footer keyboard hints without handlers
**Confirmed.** `/` (search) and `mod+k` are wired. `j`/`k` (scroll) and `c` (copy code) are advertised in the footer but have zero implementation anywhere in `apps/docs/src/`.

### P2-5: Review POST-to-stream integration test gap
**Confirmed.** `cli/server` tests cover `createReviewSession` (mocked) and `streamActiveSessionToSSE` (isolated) but no test exercises POST `/api/review/reviews` → GET stream → verify event sequence. Router POST tests are blocked at the 503 setup-guard layer and explicitly don't reach handler logic.

### P2-6: Registry dependency allowlist missing
**Confirmed.** No origin/path validation on `registryDependencies` URLs. An item could reference arbitrary external URLs without failing any check.

### P2-7: `lowlight` optional peer undocumented
**Confirmed.** `libs/ui/package.json` declares it optional. `README.md` documents `figlet` but NOT `lowlight`. No smoke test for the missing-peer rejection path (only happy-path test with lowlight installed as devDep).

### P2-8: `floating-indicator` lacks hand-authored docs
**Confirmed.** Public registry entry exists (`libs/ui/public/r/floating-indicator.json`). No MDX page at `apps/docs/content/docs/ui/components/floating-indicator.mdx`.

### P2-9: Docs TypeScript vs Vite alias mismatch
**Confirmed.** `apps/docs/tsconfig.json:28` maps `@/lib/utils` → `./src/lib/utils.ts`. `apps/docs/vite.config.ts:87` maps `@/lib/utils` → `registry/lib/utils`. TypeScript type-checks a different file than what Vite bundles.

### P2-10: Raw internal error messages in refreshContextHandler
**Confirmed.** `getErrorMessage(error)` returns raw `Error.message` to API clients.

### P2-11: Backward-compat hook docs committed against AGENTS.md
**Confirmed.** `libs/ui/docs/generated/ui-hooks.json` and `libs/keys/docs/generated/keys-hooks.json` exist as committed files. AGENTS.md explicitly says "Do not commit deterministic generated data under `libs/ui/docs/generated`, `libs/keys/docs/generated`". Build scripts reference them as validation targets, creating a contradiction.

### P2-12: `@diffgazer/core/schemas/ui` naming
Exports shared UI contracts (menu items, shortcut keys), not Zod schemas. Consider renaming before 1.0.

### P2-13: Stepper reimplements keyboard navigation locally
**Confirmed.** `libs/ui/registry/ui/stepper/stepper.tsx:115-176` implements roving tabIndex and Arrow/Home/End navigation inline. Per AGENTS.md, this belongs in `@diffgazer/keys`. Architecture observation, not a runtime bug.

### P2-14: Select public-to-internal bridge type assertions
**Confirmed.** `libs/ui/registry/ui/select/select.tsx:134-136` uses double-cast for multiple path and widening cast for onChange. Contained within the component, does not escape to callers.

### P2-15: OpenRouter adapter double assertion
**Confirmed.** `cli/server/src/shared/lib/ai/client.ts:89` — `as unknown as LanguageModel`. Runtime guard checks `doGenerate` and `doStream` but not exhaustive.

### P2-16: Smoke test list needs expansion
**Confirmed.** 9 items tested vs 58+ visible UI items. Add at minimum `navigation-list`, `code-block`, `menu` immediately; add slower all-item matrix for release/nightly.

### P2-17: SEO cleanup
Missing root canonical/`og:url`. Sitemap `lastmod` falls back to `new Date()` for source-less pages. `robots.txt` sitemap URL hardcoded (not env-overridable).

---

## P3 — POLISH

### P3-1: AgentBoard progress bar inaccessible
**Confirmed.** `apps/web/src/features/review/components/agent-board.tsx:40-45` — raw `<div>` with no `role="progressbar"`, no `aria-valuenow`, no `aria-valuemin`/`max`. Screen readers cannot read progress.

### P3-2: IssuePreviewItem hand-rolled polymorphic button
**Confirmed.** `apps/web/src/features/review/components/issue-preview-item.tsx:27-38` — `const Tag = isClickable ? "button" : "div"` pattern bypasses design system.

### P3-3: Header status pill
**Partially confirmed.** `apps/web/src/components/layout/header.tsx:30-33` — `<span>` in accessible `<div aria-label>`. Presentational only, not a blocking a11y gap.

### P3-4: Orphaned `theme-classic.css` file
**Confirmed.** `libs/ui/styles/theme-classic.css` (5605 bytes) exists on disk but is not built, not exported, not referenced anywhere. Dead code — delete or properly export.

### P3-5: `@diffgazer/keys` not in `noExternal` in diffgazer tsup config
**Confirmed.** `cli/diffgazer/tsup.config.ts` — `@diffgazer/keys` is imported (for `clampIndex`) but only in `devDependencies`. Currently works (esbuild bundles devDeps by default). If ever moved to `dependencies`, tsup would mark it external and the published CLI binary breaks. Add to `noExternal` explicitly.

### P3-6: Vestigial `@source` directives in docs CSS
**Confirmed.** `apps/docs/styles/sources.css` — 4 `@source` directives point to non-existent paths relative to `apps/docs/styles/`. Silently no-op. Delete or correct.

### P3-7: `dialog.css` hardcoded rgba backdrop
`libs/ui/registry/ui/shared/dialog.css:13` — `::backdrop { background: rgba(0,0,0,0.6); }`. Known browser limitation (::backdrop cannot inherit CSS custom properties in all targets). Acceptable for now.

### P3-8: `findOrphanedDeps` ignores integration mode
`cli/add/src/commands/remove.ts:237-250` — when calculating orphaned npm deps, uses raw registry-declared deps without checking each remaining item's `integrationMode`. Can produce incorrect "you may want to remove" guidance.

### P3-9: Remove `canRemoveFile` bails on first unowned file
`libs/registry/src/cli/workflows/remove.ts:129-138` — if one file in a component was user-modified, ALL other unmodified files are silently kept. No feedback to user about partial block.

---

## PASS 3 FINDINGS — Accessibility, Hooks, Error Handling, CSS, Build, CLI Edge Cases

### P1-12: AbortController race condition in `use-review-stream.ts` (CRITICAL)

**Confirmed (confidence: 90).** `libs/core/src/api/hooks/use-review-stream.ts:116-118` — `finally` block unconditionally sets `abortControllerRef.current = null`. If `resume()` is called twice before the first resolves, Call 1's `finally` discards Call 2's AbortController. The still-running stream from Call 2 becomes un-cancellable — leaks until server closes it or component unmounts.

Fix: `if (abortControllerRef.current === abortController) { abortControllerRef.current = null; }`

### P1-13: Config file corruption silently replaced with defaults (CRITICAL)

**Confirmed (confidence: 95).** `cli/server/src/shared/lib/fs.ts:16-25` — `readJsonFileSync` returns `null` for both `ENOENT` and JSON parse errors. `cli/server/src/shared/lib/config/state.ts:54-63` — `loadConfig` treats `null` identically for both: falls back to `DEFAULT_SETTINGS`. Next persist call overwrites the corrupted file with defaults. All user settings silently lost. Same applies to `secrets.json` and `trust.json`.

Fix: Differentiate `ENOENT` from parse errors. Log a warning for corruption. Don't auto-overwrite.

### P1-14: Async persist failures swallowed — "saved" when nothing written (CRITICAL)

**Confirmed (confidence: 90).** `cli/server/src/shared/lib/config/store.ts:76-97` — `persistConfig`, `persistTrust`, `persistFileSecrets` all schedule async writes with only `.catch(console.warn)`. Every mutation method returns `ok(...)` synchronously before write completes. On full disk or EACCES, API responds success, UI reflects change, nothing persisted. Next restart loses all mutations.

### P2-18: Double `onExitComplete` invocation in `use-presence.ts`

**Confirmed (confidence: 85).** `libs/ui/registry/hooks/use-presence.ts:56-74,88-93` — when `ref` is provided, both the native DOM `animationend` listener and React's synthetic `onAnimationEnd` fire for the same event. `onExitComplete?.()` called twice.

Fix: Gate synthetic event path on `!ref`.

### P2-19: Unstable context value in `theme-provider.tsx`

**Confirmed (confidence: 80).** `apps/web/src/app/providers/theme-provider.tsx:61-73` — `setTheme` arrow function and `value` object literal created fresh every render. All `useTheme()` consumers re-render on every parent re-render.

Fix: Stabilize with `useCallback` + `useMemo`.

### P2-20: Mutation object instability in `config-provider.tsx`

**Confirmed (confidence: 80).** `apps/web/src/app/providers/config-provider.tsx:84-119` — `activateProvider`, `saveCredentials`, `deleteProviderCredentials` each depend on full mutation object (new ref every render). TanStack Query only guarantees `mutate`/`mutateAsync` stability, not the object itself. All callbacks + `actionsValue` memo recompute every render.

Fix: Depend on `mutateAsync` directly: `const { mutateAsync } = activateMutation;`

### P2-21: WCAG contrast failure in select card variant (light mode)

**Confirmed (confidence: 92).** `libs/ui/registry/ui/select/select-item.tsx:34` — `text-white` on `bg-muted-foreground`. In light mode `--tui-dim: #9c9c9c`, white on #9c9c9c = ~2.65:1 contrast ratio (WCAG AA requires 4.5:1). Dark mode passes (~5.47:1).

Fix: Replace `text-white` with a theme-aware token.

### P2-22: MenuSubContent animations without `motion-reduce:` suppression

**Confirmed (confidence: 90).** `libs/ui/registry/ui/menu/menu-sub.tsx:241-242` — `zoom-in-95`/`zoom-out-95` animations fire unconditionally. Every other animated component in libs/ui pairs with `motion-reduce:`. This is the sole exception. Users with vestibular sensitivity get unsuppressed zoom animations.

Fix: Add `motion-reduce:data-[state=open]:animate-none` etc.

### P2-23: Missing `[data-theme="dark"]` Shiki selector (latent theme break)

**Confirmed (confidence: 82).** `libs/ui/styles/theme-base.css:469-480` — Shiki dual-theme CSS only sets light selectors. No `[data-theme="dark"]` rule switching to `--shiki-dark`/`--shiki-dark-bg`. Currently masked because docs uses same theme for both. Will break when distinct themes are adopted.

### P2-24: Web `@theme` overrides `prefers-reduced-motion` animation resets

**Confirmed (confidence: 88).** `apps/web/src/styles/theme-overrides.css:311-314` — re-declares `--animate-fade-in`, `--animate-slide-in`, `--animate-slide-in-right`, `--animate-slide-out-right` in `@theme` block, overwriting `libs/ui`'s `prefers-reduced-motion` nulling for these tokens. Users with "Reduce Motion" enabled still get slide/fade animations in the web app.

### P2-25: `menu-sub.tsx` z-50 conflicts with FloatingPanel z-index

**Confirmed (confidence: 85).** `libs/ui/registry/ui/menu/menu-sub.tsx:240` — `className="z-50 ..."` overrides FloatingPanel's `z-index: var(--ui-floating-z, var(--z-popover))` (300) with Tailwind `z-50` (50). Submenus render beneath dropdowns (z=100), popovers (z=300), and toasts (z=400).

### P2-26: `menu-sub.tsx` animate-in/animate-out classes are dead code

**Confirmed (confidence: 90).** `libs/ui/registry/ui/menu/menu-sub.tsx:241-242` — `animate-in`, `fade-in-0`, `zoom-in-95` etc. require `tw-animate-css` package. Not installed as a dependency. Classes produce no CSS output. Submenu has no open/close animation.

### P2-27: `panel.css` hardcoded white inner highlight breaks light mode

**Confirmed (confidence: 85).** `libs/ui/registry/ui/shared/panel.css:185` — `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04)`. White-on-white in light mode. Replace with a token-based value.

### P2-28: `command-palette.css` hardcoded shadows and footer

**Confirmed (confidence: 85).** `libs/ui/registry/ui/shared/command-palette.css` — 5 `box-shadow` rules use `rgba(0,0,0,0.6-0.7)`. Footer uses `color-mix(in oklab, black 25%, transparent)` — computes to dark gray overlay inside white card in light mode.

### P2-29: SSE event buffer cap silently cuts off delivery

**Confirmed (confidence: 85).** `cli/server/src/features/review/sessions.ts:29-41,135-141` — 10,000-event cap. When reached, `storeSessionEvent` returns `false`, `addEvent` returns early without calling `notifySubscribers`. Live SSE clients stop receiving events silently. No error emitted. Connection stays open indefinitely until terminal event.

### P2-30: `generateStream` doesn't propagate cancellation signal

**Confirmed (confidence: 88).** `cli/server/src/shared/lib/ai/client.ts:157-187` — `generateStream` doesn't accept a `signal` parameter. When SSE client disconnects, `streamText` keeps consuming provider tokens until provider-side timeout (300s default). Wastes quota on every user navigation-away.

### P2-31: No retries on transient AI provider failures

**Confirmed (confidence: 85).** `cli/server/src/shared/lib/ai/client.ts:25` — `DEFAULT_MAX_RETRIES = 0`. A single transient network error aborts the entire lens analysis. AI SDK retry mechanism explicitly disabled.

### P2-32: CSS duplication after `dgadd init` + `dgadd add`

**Confirmed (confidence: 87).** `cli/add/src/commands/init.ts:93-112` writes component CSS unmarked into `styles.css`. `cli/add/src/commands/add/css-ops.ts:35-44` detects chunks only by `/* dgadd:css <hash> */` markers. Running `dgadd init` then `dgadd add ui/dialog` produces duplicate CSS — unmarked from init + marked from add.

### P2-33: Concurrent `dgadd` process race on manifest

**Confirmed (confidence: 83).** `libs/registry/src/cli/config.ts:81-110` — `updateManifest` is read-modify-write with no file lock. Two simultaneous `dgadd add` invocations race — last write wins, silently discarding the other's entries.

---

## WHAT IS READY (unchanged from pass 1)

### Registry — npm package path: PASS
- 40+ explicit exports, `{ types, import }` pairs, correct `prepublishOnly`, peer deps, files exclusions

### Registry — libs/keys: PASS
- 5 items, zero drift vs disk, copy-mode import rewriting functional

### CLI (dgadd): PASS (after P0-1 fix)
- 3 paths (copy, package, registry), SHA-256 ownership, cascading orphan removal

### Web app composition: PASS
- 27+ @diffgazer/ui components, @diffgazer/keys keyboard navigation throughout
- Zero components qualify for extraction per AGENTS.md

### TUI: STRUCTURAL EXCEPTION
- Cannot use @diffgazer/ui (DOM + Tailwind) or @diffgazer/keys (DOM events)
- 16 parallel TUI primitives are architecturally required, not debt

### Build chain: PASS
- Turbo graph correct, `noExternal` strategy correct, artifact pipeline complete

### Docs content: PASS
- 44 UI + 25 keys MDX pages, all shortcodes wired, ConsumptionBlock renders 3 install paths

### Typography & design system: PASS
- Coherent dark-mode TUI system, JetBrains Mono, correct cascade

### Type safety: PASS
- Full strict mode across all packages, per-package typecheck + test:types

### CI/CD: PASS (with P1-3 gate gap caveat)
- release-readiness.yml comprehensive, Dependabot active, SLSA provenance

### Contributor docs: PASS
- README, CONTRIBUTING, AGENTS.md, TESTING.md, SECURITY.md, SUPPORT.md, CODE_OF_CONDUCT

---

## DEPLOYMENT STRATEGY — VPS with Docker + Nginx reverse proxy

### Architecture

```
VPS (b4r7.dev)
|
+-- Nginx (port 80/443, SSL termination)
|   |
|   +-- docs.[diffgazer.]b4r7.dev  --> docs container (port 3000)
|   +-- diffgazer.b4r7.dev         --> landing container (port 3001)
|   +-- b4r7.dev                   --> hub container (port 3002)
|
+-- Docker Compose
    +-- docs     (Node.js, Nitro SSR, existing Dockerfile)
    +-- landing  (Nginx static, new Dockerfile)
    +-- hub      (Nginx static, new Dockerfile)
```

### DNS records

```
b4r7.dev                    A       <VPS_IP>
*.b4r7.dev                  A       <VPS_IP>
```

Or individual records for each subdomain.

### SSL/TLS with Let's Encrypt

Option A — Certbot on host:
```sh
certbot --nginx -d b4r7.dev -d diffgazer.b4r7.dev -d docs.diffgazer.b4r7.dev
```

Option B — Docker automated (recommended):
`jwilder/nginx-proxy` + `nginx-proxy/acme-companion` containers.

### Nginx reverse proxy config

```nginx
# Docs site — SSR, requires Node runtime
server {
    listen 443 ssl http2;
    server_name docs.diffgazer.b4r7.dev;

    ssl_certificate     /etc/letsencrypt/live/docs.diffgazer.b4r7.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/docs.diffgazer.b4r7.dev/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        location ~* ^/r/.*\.json$ {
            proxy_pass http://127.0.0.1:3000;
            add_header Cache-Control "public, max-age=3600, s-maxage=86400";
        }
    }
}

# Diffgazer landing — static SPA
server {
    listen 443 ssl http2;
    server_name diffgazer.b4r7.dev;

    ssl_certificate     /etc/letsencrypt/live/diffgazer.b4r7.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/diffgazer.b4r7.dev/privkey.pem;

    root /var/www/landing/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# b4r7.dev hub/portfolio — static SPA
server {
    listen 443 ssl http2;
    server_name b4r7.dev www.b4r7.dev;

    ssl_certificate     /etc/letsencrypt/live/b4r7.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/b4r7.dev/privkey.pem;

    root /var/www/hub/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name b4r7.dev www.b4r7.dev diffgazer.b4r7.dev docs.diffgazer.b4r7.dev;
    return 301 https://$host$request_uri;
}
```

### Extended docker-compose.yml

```yaml
services:
  docs:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        REGISTRY_ORIGIN: ${REGISTRY_ORIGIN:-https://docs.diffgazer.b4r7.dev}
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

  landing:
    build:
      context: .
      dockerfile: apps/landing/Dockerfile
    ports:
      - "127.0.0.1:3001:80"
    restart: unless-stopped

  hub:
    build:
      context: .
      dockerfile: apps/hub/Dockerfile
    ports:
      - "127.0.0.1:3002:80"
    restart: unless-stopped
```

Ports bound to `127.0.0.1` — Docker ports only reachable via Nginx.

### Dockerfile for static apps

```dockerfile
# apps/landing/Dockerfile (same pattern for apps/hub/Dockerfile)
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/landing/ apps/landing/
COPY libs/ libs/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @diffgazer/keys build
RUN pnpm --filter @diffgazer/ui build
RUN pnpm --filter @diffgazer/landing build

FROM nginx:alpine AS runtime
COPY --from=builder /app/apps/landing/dist /usr/share/nginx/html
COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### CI/CD for VPS

Option A — GitHub Actions SSH deploy:
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/diffgazer
            git pull origin main
            docker compose build
            docker compose up -d --remove-orphans
```

Option B — Docker registry (ghcr.io) + pull on VPS.
Option C — Manual SSH deploy.

---

## COMPONENT MAP

### @diffgazer/ui — Used in apps/web (27+)

Badge, Button, Callout, Card (via CardLayout), CheckboxGroup + CheckboxItem, CodeBlock, Dialog family, DiffView, Divider, EmptyState, Field, HorizontalStepper, Input + InputGroup, KeyValue, Logo, Menu + MenuDivider + MenuItem, NavigationList (full), Panel, RadioGroup + RadioGroupItem, ScrollArea, SearchInput, SectionHeader, Stepper + StepperSubstep, Tabs family, ToggleGroup + ToggleGroupItem, BlockBar (via SeverityBar), toast/Toaster, cn.

### @diffgazer/ui — Unused in apps/web (17, expected for library)

Accordion, Avatar/AvatarGroup, Breadcrumbs, CodeBlock/highlight, CommandPalette, FloatingPanel, Icons (standalone), Label (standalone), Overflow, Pager, Popover, Select, Sidebar, TOC, Tooltip, Typography.

### @diffgazer/keys — Used across 20+ components

useScope, useKey, useActionRowNavigation, focusNavigationItem, isListNavigationKey, toVerticalBoundaryDirection, getVerticalArrowDirection.

---

## BUILD CHAIN

```
libs/core (tsc)
    +-- libs/keys (tsc + shadcn registry + docs data + artifacts)
    +-- libs/ui (tsup + declarations + shadcn registry + docs data + artifacts)
    +-- libs/registry (tsc)
    +-- apps/web (tsc -b + vite build --> cli/diffgazer/dist/web/)
    +-- cli/server (tsc)
    +-- cli/diffgazer (tsup, noExternal: [core, server], clean: false)
    +-- cli/add (tsup, generates offline registry bundle)
    +-- apps/docs (TanStack Start + Nitro, prerender, requires prepare:artifacts)
```

---

## EMBEDDED SERVER THREAT MODEL

`cli/server` is a local HTTP server bundled into the installable `diffgazer` app. Evaluate as local app surface, NOT hosted backend.

**Trusted:** the diffgazer process, the same-origin embedded web UI, the user.
**Untrusted:** arbitrary browser origins, other localhost apps, other local processes, LAN clients.

**Sensitive capabilities:** repository read, trust config write, credential config, review creation, review deletion, app shutdown.

The goal is not a perfect anti-local-malware boundary. The right goals are:
- Do not accidentally expose the server on the LAN (P0-2)
- Prevent unrelated browser origins from driving sensitive routes (P0-3, P1-1)
- Keep API scope tied to the launched project (P0-4)
- Keep trust records server-derived and validated (P0-5, P0-6, P1-2)

---

## FIX CHECKLIST

### P0 — Must fix before any handoff (13 items)

- [ ] Add 9 missing file entries to `libs/ui/registry/registry.json` (P0-1)
- [ ] Patch `validateRegistryImportClosure` blind spot (P0-1)
- [ ] Bind embedded server to `127.0.0.1` (P0-2)
- [ ] Extend per-run token to all sensitive API routes (P0-3)
- [ ] Ignore `x-diffgazer-project-root` in packaged mode (P0-4)
- [ ] Server-derive trust identity; reject client `projectId`/`repoRoot`/`trustedAt` (P0-5)
- [ ] Preserve existing `trustMode` in web settings (P0-6)
- [ ] Publish `@diffgazer/ui`, `@diffgazer/keys`, `@diffgazer/add` to npm (P0-7)
- [ ] Configure DNS records (P0-8)
- [ ] Decide docs domain and update all 327 occurrences if changing (P0-9)
- [ ] Commit dirty files (P0-10)
- [ ] Create `apps/landing/` and `apps/hub/` (P0-11)
- [ ] Regenerate all artifacts: `pnpm run prepare:artifacts` (after all registry fixes)

### P1 — Before public promotion (14 items)

- [ ] Restrict CORS to same-origin in packaged mode (P1-1)
- [ ] Validate persisted trust against resolved repo root (P1-2)
- [ ] Gate publish on release-readiness workflow (P1-3)
- [ ] Fix StepperTrigger onFocus forwarding (P1-4)
- [ ] Fix or document DialogShell fallback type contract (P1-5)
- [ ] Explicitly commit to docs deployment mode (P1-6)
- [ ] Resolve moderate audit advisories (P1-7)
- [ ] Add OG/Twitter images or downgrade card type (P1-8)
- [ ] Gate or fix shadcn install command URLs (P1-9)
- [ ] Use typed reference for TrustPanel focus target (P1-10)
- [ ] Set up VPS infrastructure (P1-11)
- [ ] Fix AbortController race in use-review-stream.ts — stream leak on double resume (P1-12)
- [ ] Handle config file corruption — don't silently replace with defaults (P1-13)
- [ ] Surface async persist failures to caller — don't return ok() before write (P1-14)

### P2 — Before 1.0 (33 items)

- [ ] Add vitest coverage thresholds (P2-1)
- [ ] Ship pending changesets (P2-2)
- [ ] Remove dead light theme CSS or build toggle (P2-3)
- [ ] Wire footer keyboard hints or remove them (P2-4)
- [ ] Add review POST-to-stream integration test (P2-5)
- [ ] Add registry dependency URL allowlist (P2-6)
- [ ] Document lowlight optional peer + add smoke test (P2-7)
- [ ] Add floating-indicator docs page (P2-8)
- [ ] Fix docs @/lib/utils alias mismatch (P2-9)
- [ ] Sanitize error messages in refreshContextHandler (P2-10)
- [ ] Resolve committed generated artifacts vs AGENTS.md policy (P2-11)
- [ ] Rename `@diffgazer/core/schemas/ui` (P2-12)
- [ ] Route Stepper keyboard nav through @diffgazer/keys (P2-13)
- [ ] Clean up Select type assertions (P2-14)
- [ ] Document OpenRouter adapter assertion (P2-15)
- [ ] Expand smoke test items (P2-16)
- [ ] Fix SEO (canonical, og:url, lastmod, robots.txt) (P2-17)
- [ ] Fix double onExitComplete in use-presence.ts (P2-18)
- [ ] Stabilize theme-provider.tsx context value with useMemo (P2-19)
- [ ] Fix mutation object instability in config-provider.tsx (P2-20)
- [ ] Fix WCAG contrast failure in select card variant light mode (P2-21)
- [ ] Add motion-reduce: to MenuSubContent animations (P2-22)
- [ ] Add [data-theme="dark"] Shiki selector to theme-base.css (P2-23)
- [ ] Fix web @theme override of prefers-reduced-motion animation resets (P2-24)
- [ ] Fix menu-sub.tsx z-50 vs FloatingPanel z-index conflict (P2-25)
- [ ] Fix menu-sub.tsx dead animate-in/out classes (no tw-animate-css) (P2-26)
- [ ] Replace panel.css hardcoded white highlight with token (P2-27)
- [ ] Replace command-palette.css hardcoded shadows/footer with tokens (P2-28)
- [ ] Handle SSE event buffer cap — emit warning or increase limit (P2-29)
- [ ] Add signal parameter to generateStream for cancellation (P2-30)
- [ ] Set DEFAULT_MAX_RETRIES > 0 for transient failures (P2-31)
- [ ] Fix dgadd init + add CSS duplication (mark or strip init CSS) (P2-32)
- [ ] Add file lock or optimistic concurrency to dgadd manifest writes (P2-33)

### P3 — Polish (9 items)

- [ ] Add ARIA progressbar attributes to AgentBoard (P3-1)
- [ ] Adopt NavigationList.Item in IssuePreviewItem (P3-2)
- [ ] Consider replacing Header status pill span with Badge (P3-3)
- [ ] Delete orphaned theme-classic.css (P3-4)
- [ ] Add @diffgazer/keys to noExternal in diffgazer tsup config (P3-5)
- [ ] Delete vestigial @source directives in docs/styles/sources.css (P3-6)
- [ ] Document dialog.css backdrop limitation (P3-7)
- [ ] Fix findOrphanedDeps integration mode awareness (P3-8)
- [ ] Improve remove canRemoveFile partial-block feedback (P3-9)

---

## AUDIT METHODOLOGY

### Pass 1 — SOTA analysis (6 parallel agents, ~495 tool calls)

- Registry handoff readiness (80 calls, 561s)
- Docs app architecture (72 calls, 480s)
- CLI/diffgazer architecture (105 calls, 596s)
- Web app UI primitives (98 calls, 550s)
- Domain/routing strategy (53 calls, 308s)
- Quality gates/CI readiness (87 calls, 459s)

### Pass 2 — Cross-reference + independent verification (6 parallel agents, ~495 tool calls)

- Cross-reference: SOTA-AUDIT.md vs HANDOFF_READINESS_AUDIT.md (full comparison)
- Security verification: 6 claims verified, 3 new findings discovered
- Registry verification: 8 claims verified, all confirmed
- Docs/domain verification: domain grep (327 hits), SEO, SSR, theme, footer
- UI contracts verification: 11 claims checked, 9 confirmed
- CI/gates verification: 10 claims checked, all confirmed

### Pass 3 — Deep dive into under-explored areas (6 parallel agents, ~500 tool calls)

- Deep accessibility audit (113 calls, 601s) — 2 new findings (WCAG contrast, motion-reduce gap)
- React hooks + lifecycle audit (58 calls, 712s) — 4 new findings (AbortController race, double onExitComplete, unstable context, mutation instability)
- Build + exports verification (61 calls, 327s) — 2 new findings (orphaned CSS, tsup latent risk)
- Error handling + edge cases (30 calls, 246s) — 5 new findings (config corruption, persist swallowed, SSE buffer, stream cancellation, no retries)
- CSS/theme system deep audit (95 calls, 668s) — 9 new findings (Shiki selector, animation overrides, z-index, dead classes, hardcoded colors, panel/command-palette/select light-mode breaks)
- CLI dgadd edge cases (43 calls, 398s) — 5 new findings (CSS duplication, manifest race, orphan deps, partial remove, corrupted config during remove)

### Key corrections across passes

1. **Security: PASS → FAIL (pass 2).** SOTA conflated "Host header middleware" with "loopback binding". 5 HIGH findings confirmed.
2. **npm packages: PASS → FAIL (pass 2).** Structural readiness validated but actual registry returns E404.
3. **Error handling: not audited → 5 issues (pass 3).** Config corruption, persist failures, SSE buffer, stream cancellation, zero retries.
4. **CSS/theme: PASS → 9 issues (pass 3).** Multiple hardcoded colors, z-index conflicts, dead animation classes, light-mode breaks in panel/command-palette/select.
5. **Hooks: not audited → 4 issues (pass 3).** AbortController race (stream leak), double exit callback, two unstable context patterns.
6. **dgadd CLI: PASS → 5 issues (pass 3).** CSS duplication, manifest race, orphan dep mode, partial remove silence, corrupted config during remove.
7. **a11y: PASS → 2 issues (pass 3).** WCAG contrast failure in select card variant, MenuSubContent missing motion-reduce.

### Total findings

| Priority | Count |
|---|---|
| P0 (must fix) | 13 |
| P1 (before promotion) | 14 |
| P2 (before 1.0) | 33 |
| P3 (polish) | 9 |
| **Total** | **69** |

### Skills loaded
sota, code-audit, clean-code, code-quality, anti-slop (AGENTS.md mandate)

### Sources
- 18 parallel subagents across 3 passes (~1500 tool calls)
- HANDOFF_READINESS_AUDIT.md (independent security-focused audit)
- Direct source code verification at 80-100% confidence per finding
- npm registry API (publication status)
- Snyk vulnerability database (ws@8.20.0)
