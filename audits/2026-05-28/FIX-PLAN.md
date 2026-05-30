# FIX-PLAN — Diffgazer Audit 2026-05-28

Ordered, actionable plan for engineers and AI agents. Items are grouped into four waves by priority, then by package/domain. Each item carries its finding id, `file:line`, a concise fix approach, and an effort estimate.

> **Where the detail lives.** This is an index, not a spec.
> - Big-file splits, object-args refactors (full proposed signatures + call-site updates), and naming fixes are fully specified in **`STRUCTURE.md`**. Items below that touch those carry a `→ STRUCTURE.md` pointer.
> - Three-paths handoff readiness (shadcn / npm package / copy-from-source), pack contents, smoke/validate coverage, and the pre-handoff checklist are specified in **`HANDOFF-READINESS.md`**. Items below that touch those carry a `→ HANDOFF-READINESS.md` pointer.
>
> **Dedup.** Findings that repeat across domain reports are collapsed to a single actionable item, with the duplicate ids noted inline as `(dupes: …)`. **Drop note:** the "verified-good / no change needed" entries (tests-behavior F75, F76, F77, F78, F79; libs-keys F220 documented DOM-boundary cast; structure-srp F343 accepted artifact-sync mirror) are not actionable and are excluded from the checklist counts. No findings were tagged ALREADY-FIXED.

---

## Wave 1 — Handoff-blocking & Critical

Everything that blocks shadcn/package/copy handoff, plus all `Critical`-severity findings from any domain.

### handoff — public source `.js` import specifiers (copy/shadcn breakage)

- [ ] F316 `libs/keys/src/index.ts:1-70` — strip relative `.js` extensions from all import specifiers across `libs/keys/src/**/*.{ts,tsx}` (18+ files); declaration emit re-adds `.js` to `.d.ts` (dupes: F195) (effort: medium)
- [ ] F317 `libs/ui/registry/ui/diff-view/diff-view.tsx:22-23` — strip relative `.js` extensions across `libs/ui/registry` source + registry `lib/*` index files (diff-view*, code-block/highlight, command-palette/highlight, logo/figlet, block-bar, lib/diff/index, logo/get-figlet-text, etc.) (dupes: F197) (effort: medium)
- [ ] F196 `libs/core/src/index.ts:1-6` — strip relative `.js` extensions across `libs/core/src/**/*.ts` (index, hooks, forms, providers, schemas, api, api/hooks); core leaks transitively into public CLI packages (dupes: F318) (effort: medium)
- [ ] F186 `cli/add/scripts/generate-keys-copy-bundle.ts:9-18` — apply `rewriteRelativeJsExtensionsForCopy` (already in `cli/add/src/utils/transform.ts`) inside `rewriteHookInternalImports` so the keys copy bundle stops emitting `from "./utils/*.js"` → HANDOFF-READINESS.md (effort: low)
- [ ] F188 `cli/add/scripts/bundle-registry.ts` — add a `validate-artifacts.mjs` gate that scans the registry bundle + keys copy bundle and fails on any `.js` import specifier; ensure bundle generation applies the strip transform (effort: medium)
- [ ] F119 `libs/ui/scripts/transform-public-registry-keys-imports.ts:55-70` — add source-side validation in the `libs/keys` build asserting no generated `registry.json`/`public/r/*.json` content carries relative `.js` specifiers, instead of relying on the downstream UI-build cleanup (effort: medium)

### handoff — package manifest / peer-dependency blockers (no F-id; from HANDOFF-READINESS.md)

- [ ] HANDOFF-1 `libs/ui/package.json:331-348` (+ static `import { useNavigation } from "@diffgazer/keys"` in `select`, `checkbox`, `radio`, `accordion`, `tabs`, `sidebar`, `toggle-group`, `command-palette`, `diff-view` dist) — resolve the `@diffgazer/keys` optional-peer + static-import contradiction: either make keys a **required** peer (drop `optional:true`) OR keep optional and match the figlet contract (lazy import + clear runtime error + per-component docs). Then add a smoke fixture that installs `@diffgazer/ui` WITHOUT keys and imports a keys-backed subpath → HANDOFF-READINESS.md (effort: high)
- [ ] HANDOFF-2 `cli/diffgazer/package.json` — change `"license": "MIT"` to `"Apache-2.0"` to match the shipped `LICENSE` file and PACKAGE_GOVERNANCE; optionally add a `check-invariants.mjs` assertion that each package `license` field matches its `LICENSE` file → HANDOFF-READINESS.md (effort: low)

### libs/ui — Critical

(none — F113 broken-validation is High; see Wave 2)

### apps/web — Critical

- [ ] F161 `apps/web/src/features/providers/hooks/use-model-filter.ts:18` — `setTierFilter(cycleTierFilterCore)` stores the function instead of cycling; change to `setTierFilter((current) => cycleTierFilterCore(current))` (effort: low)

### apps/docs — Critical

- [ ] F164 `apps/docs/src/features/search/search-context.tsx:13` — invalid provider syntax: change `<SearchContext value=…>` to `<SearchContext.Provider value=…>…</SearchContext.Provider>` (effort: low)

---

## Wave 2 — High

SRP/structure, object-args, DRY, error-handling, a11y, public-api consistency.

### libs/ui

- [ ] F8 `libs/ui/registry/hooks/use-form-reset.ts:23-43` — add deps array `[ref, enabled, handleReset]` to the first `useLayoutEffect` so it stops re-subscribing every render; confirm the unmount effect keeps `[]` (dupes: F227) (effort: low)
- [ ] F113 `libs/ui/registry/ui/checkbox/checkbox-group.tsx:219-227` — `readOnly` hidden input never fires `onInvalid` (HTML spec); remove `readOnly` to enable native validation or move required-validation into the submit handler (effort: high)
- [ ] F98 `libs/ui/registry/hooks/use-listbox.ts:1-436` — split the 5-concern hook (DOM discovery, active-descendant, typeahead, accessible-text, nav binding) into sibling files; keep `use-listbox.ts` as orchestrator → STRUCTURE.md (dupes: F214, F17) (effort: high)

### libs/registry

- [ ] F121 `libs/registry/src/shadcn/validate.ts:64-67` — `compareItemFields` asserts `field as keyof RegistryItem` against a loose `actualItem`; validate `actualItem` conforms to `RegistryItem` shape before field comparison (related: F126) (effort: medium)
- [ ] F128 `libs/registry/src/utils/fs.ts:41-44` — `resetDir` rm-then-mkdir can leave the dir deleted on mkdir failure; wrap in try/catch that recreates on failure or return a result type signalling partial failure (effort: medium)

### libs/core

(no High findings)

### cli/server

- [ ] F24 `cli/server/src/app.ts:90` — `ErrorCode.UNAUTHORIZED` returns HTTP 403; change to 401; apply same fix in `shutdown/router.ts:13`; reserve 403 for `FORBIDDEN` (dupes: F25, F248) (effort: low)
- [ ] F149 `cli/server/src/shared/middlewares/rate-limit.ts:14-43` — `windows` Map never evicts expired entries (unbounded growth); add TTL/size-bounded eviction or periodic prune (dupes: F257) (effort: medium)
- [ ] F151 `cli/server/src/features/review/sessions.ts:140-141` — module-load `setInterval(cleanupStaleSessions)` is never cleared; export `shutdownSessions()` and call it from the shutdown/SIGTERM hook + test teardown (dupes: F256) (effort: medium)
- [ ] F251 `cli/server/src/shared/lib/ai/client.ts:89-95` — `as unknown as LanguageModel` hides SDK drift; replace with a documented `@ts-expect-error` (SDK version note) or an `is`-guard that narrows the model (dupes: F152) (effort: low)

### cli/add

- [ ] F145 `cli/add/src/commands/diff.ts:36-41` — chunk-dir cleanup via `process.on('exit')` misses signals/uncaught exceptions; use explicit try/finally after command execution (effort: medium)

### cli/diffgazer

- [ ] F159 `cli/diffgazer/src/features/review/components/severity-filter-group.tsx:32-34` — setState during render when `focusedIndex > maxIndex`; move into `useEffect([focusedIndex, maxIndex])` and remove the imperative if-block from render (effort: low)

### apps/web

- [ ] F31 `apps/web/src/features/review/components/page.tsx:106-126` — three `useEffect`s compute `liveState` from `savedOutcomeKind`; derive inline during render, move error/navigation into handlers (dupes: F270) (effort: high)
- [ ] F162 `apps/web/src/features/review/components/issue-list-pane.tsx:12-34` — 21-prop surface; group into `listState`/`callbacks`/`filter`/`refs`/`ui` sub-objects → STRUCTURE.md (effort: high)
- [ ] F276 `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts:76-399` — 399-line hook; extract `useModelSearchFocus`, `useModelFilters`, `useModelDialogFocusTrap`, keep orchestrator → STRUCTURE.md (dupes: F99) (effort: high)
- [ ] F274 `apps/web/src/features/review/hooks/use-review-results-keyboard.ts:1-289` — extract `useReviewSeverityFilterKeyboard` + `useReviewDetailsTabKeyboard`, keep orchestrator → STRUCTURE.md (effort: high)
- [ ] F275 `apps/web/src/features/providers/hooks/use-providers-keyboard.ts:1-277` — extract `useProvidersListNavigation` + `useProvidersActionButtons` + `useProvidersDialogKeyboard`, keep orchestrator → STRUCTURE.md (effort: high)
- [ ] F277 `apps/web/src/features/onboarding/components/onboarding-wizard.tsx:1-344` — extract `useOnboardingKeyboard` (button nav + key bindings + footer shortcuts); component keeps step rendering → STRUCTURE.md (effort: medium)

### apps/docs

- [ ] F94 `libs/ui/registry, apps/docs/registry` — apps/docs carries a 600+ file byte-identical mirror of `libs/ui/registry`; make docs consume `@diffgazer/ui` (import/re-export or shared registry pkg) and delete the duplicate tree; verify artifact sync still covers generated outputs (dupes: F338, F97, F107, F343, F102, F106, F192, F66) (effort: high)
- [ ] F330 `libs/ui/registry/registry.json` — 37 public registry items have no MDX docs; document public hooks/utilities/theme items or mark internal ones `meta.hidden` (effort: high)

### apps/hub

- [ ] F183 `apps/hub/package.json:1-6` — hub is a raw-HTML stub with no scripts/turbo task/`src`; either scaffold a thin Vite app mirroring `apps/landing` (scripts, `tsconfig`, `vite.config`, `src/`, turbo `@diffgazer/hub#build`) or delete the package and its `.changeset/config.json` ignore entry (dupes: F294, F300, F293, F355) (effort: high)
- [ ] F180 `apps/hub/public/index.html:19-35` — inline hardcoded hex tokens bypass the design system; once hub is a Vite app, import `@diffgazer/ui` theme CSS and use tokens/Tailwind (dupes: F298) (effort: high)
- [ ] F182 `apps/hub/public/index.html:9,13` — referenced `favicon.ico` and `og-image.png` do not exist (404s); create the assets or remove the tags (dupes: F295, F296, F297, F181) (effort: low)
- [ ] F184 `apps/hub/public/index.html:8,12,45-47` — cross-property URLs hardcoded; route through a shared `siteLinks` config (per DEPLOYMENT-ROUTING.md) once hub is a Vite app (dupes: F299) (effort: high)

### apps/landing

- [ ] F-landing-a11y-focus `apps/landing/src/App.tsx:15-20` — docs link has hover but no focus indicator; add `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground` (effort: low)
- [ ] F-landing-assets `apps/landing/index.html:9,13` — referenced `/favicon.ico` and `og-image.png` are missing (404s in prod); add the assets to `public/` or remove the references (effort: low)
- [ ] F-landing-docs-url `apps/landing/src/App.tsx:16` — hardcoded `https://docs.b4r7.dev`; use `import.meta.env.VITE_DOCS_ORIGIN ?? '…'`, add to `.env.example`, update the test mock (effort: low)
- [ ] F-landing-landmarks `apps/landing/src/App.tsx:1-25` — no landmarks/skip link (WCAG 2.4.1/1.3.1); add a skip-to-main link + `id="main"` and semantic `header`/`footer` (effort: low)

### libs/keys

(no High findings)

### docs-quality

(F330 listed under apps/docs above)

---

## Wave 3 — Medium

### libs/ui

- [ ] F9 `libs/ui/registry/ui/select/select.tsx:99-145` — sequential `as` casts narrowing public generics to internal string state; extract a typed narrowing helper instead of post-hoc casting (effort: medium)
- [ ] F221 `libs/ui/registry/ui/select/select.tsx:204-217` — hidden native `<select>` has no-op `onChange={() => {}}`; remove the prop or document the intentional no-op (effort: low)
- [ ] F222 `libs/ui/registry/ui/menu/menu-item.tsx:12-60` — duplicated icon-slot base classes between `MenuItemIndicator` and `MenuItemIconSlot`; extract one shared constant (resolved together with the menu-item split) → STRUCTURE.md (effort: low)
- [ ] F224 `libs/ui/registry/ui/dialog/dialog.tsx:14` — compound-component export inconsistency (`Dialog` direct vs `TabsRoot as Tabs`); converge on `XRoot` + `export { XRoot as X }` across Dialog/Tabs/Accordion → STRUCTURE.md (effort: medium)
- [ ] F11 `libs/ui/registry/ui/checkbox/checkbox.tsx:137-139` — `useEffect` state-sync of `nativeInvalid`; derive `resolvedNativeInvalid` during render, set state only in the `onInvalid` handler (effort: low)
- [ ] F12 `libs/ui/registry/ui/switch/switch.tsx:144-146` — same `useEffect` state-sync; compute invalid state during render, set only in `onInvalid` (effort: low)
- [ ] F13 `libs/ui/registry/ui/radio/radio.tsx:171-173` — `useEffect` dispatches `notifySameNameRadios()` on state change; move the call into `toggle()` after `setIsChecked(true)` (effort: low)
- [ ] F115 `libs/ui/registry/ui/dialog/index.ts:1-40` — `DialogKeyboardHints` component not exported (only its types); add `export { DialogKeyboardHints }` (effort: low)
- [ ] F229 `libs/ui/package.json:19` — add export entries for `./hooks/use-is-mobile` and `./hooks/typeahead-buffer` (built + registry-declared but unexported) (effort: low)
- [ ] F228 `libs/ui/registry/hooks/use-presence.ts:59` — `commitExit()` calls `onExitComplete?.()` directly, bypassing the `notifyExit` `useEffectEvent`; route through `notifyExit()` (effort: low)

### libs/keys

- [ ] F6 `libs/keys/src/hooks/use-action-row-navigation.ts:282-293` — `getActionProps()` allocates new callbacks each render; wrap in `useCallback` or use a ref-based registry (effort: medium)
- [ ] F7 `libs/keys/src/hooks/use-focus-zone.ts:255-267` — `getKeyOptions`/`getZoneProps`/`isZone` recreated each render; stabilize with `useCallback`/`useMemo` (effort: medium)
- [ ] F218 `libs/keys/src/hooks/use-key.ts:59-60` — `registrationVersion` recomputed each render and used as effect dep; memoize so the layout effect runs only on actual key changes (effort: medium)
- [ ] F219 `libs/keys/src/hooks/use-navigation.ts:174` — `move()` depends on inline `onNavigationBoundaryReached`; store handler in a ref (or `useEffectEvent`) to restore stability (effort: medium)

### libs/registry

- [ ] F120 `libs/registry/src/docs/index.ts:15-18` — `assertSafeLibraryId` + `SAFE_LIBRARY_ID_RE` duplicated in `docs/index.ts` and `docs/sync-operations.ts`; extract to a shared `docs/library-id-validation.ts` (dupes: F230) (effort: low)
- [ ] F123 `libs/registry/src/registry-types.ts:10-11` — near-identical `RegistryItemSchema` duplicated with `cli/registry.ts`; extract a shared base schema + add a compatibility test (dupes: F235) (effort: medium)
- [ ] F125 `libs/registry/src/docs/index.ts:38-40, sync-operations.ts:284-287` — library-id validation runs twice in one call chain; validate once at the public boundary and document the precondition (effort: low)
- [ ] F126 `libs/registry/src/shadcn/validate.ts:59` — change `actualItem: Partial<Record<keyof RegistryItem, unknown>>` to `Partial<RegistryItem>` to enforce key names (effort: low)
- [ ] F233 `libs/registry/src/cli/registry.ts:198-218` — `metaField` switch is non-exhaustive for `string[]` (silently hits default); add `Array.isArray` narrowing or per-type overloads (effort: medium)

### libs/core

- [ ] F-core-parse `libs/core/src/api/client.ts:37` — `parse<T>()` returns `body as T` with no validation; require a Zod schema/guard or return a `SafeApiResult<T>`; document the caller contract (effort: medium)

### cli/server

- [ ] F26 `cli/server/src/features/review/sessions.ts:143-150` — `createSession` (6 params) → options object → STRUCTURE.md (effort: medium)
- [ ] F27 `cli/server/src/features/review/sessions.ts:268-274` — `getActiveSessionForProject` (5 params) → options object → STRUCTURE.md (effort: medium)
- [ ] F100 `cli/server/src/shared/lib/config/store.ts:1-530` — split `createConfigStore` into `config-persistence`/`secrets-store`/`trust-store`/`providers-store`; orchestrator delegates → STRUCTURE.md (effort: high)
- [ ] F101 `cli/server/src/features/review/context.ts:1-394` — split into `workspace-discovery`/`file-tree`/`context`; fold the 3 dep-aggregation loops (F340) and convert `buildFileTree` to options-object (F212) → STRUCTURE.md (dupes: F215) (effort: medium)
- [ ] F146 `cli/server/src/app.ts:88-90` — shutdown-token validation duplicated in global middleware and `shutdown/router.ts`; keep the global check, remove the router copy (dupes: F255) (effort: low)
- [ ] F147 `cli/server/src/features/review/review-routes.ts:31-45` — `getRequestedProjectPath` returns `string | Response` narrowed by `instanceof Response`; return a discriminated `{ ok }` union (effort: medium)
- [ ] F148 `cli/server/src/app.ts:123-126` — global `onError` collapses all errors to 500; branch on `AppError.code`, log stack for unexpected, keep generic 500 fallback (effort: medium)
- [ ] F156 `cli/server/src/shared/lib/validation.ts:1-6` — `isValidProjectPath` only checks `..`/`\0`; normalize with `path.resolve` + `realpath` and assert containment in an allowed base (effort: medium)
- [ ] F253 `cli/server/src/features/review/review-routes.ts:191-198` — drilldown error→status mapping can miss new codes; use an exhaustive switch over the error union (effort: medium)

### cli/add

- [ ] F22 `cli/add/src/commands/add/manifest.ts:14-16, remove.ts:19-21` — `sha256` duplicated; extract to `cli/add/src/utils/hashing.ts`, import in both, drop the unused manifest export (dupes: F136, F244, F23) (effort: low)
- [ ] F137 `cli/add/src/utils/namespaces.ts:32-48` — `publicInstallNames` and `publicListNames` are identical; merge into `publicAvailableNames()` and update `list.ts` (effort: low)
- [ ] F138 `cli/add/src/commands/remove.ts:174-180` — module-level mutable `activeCwd`/`preRemovalChunksByItem` thread state between callbacks; pass a scoped workflow-context object instead (dupes: F245) (effort: medium)
- [ ] F140 `cli/add/src/commands/diff.ts:40` — empty catch on cleanup `rmSync`; add an intent comment and decide whether logging helps (effort: low)
- [ ] F143 `cli/add/src/utils/namespaces.ts:58-96` — `validateInstallNames` / `validateAnyInstallableName` near-duplicates; extract `validateInstallNamesAgainst(names, uiNames, keyNames)` (effort: low)

### apps/web

- [ ] F32 `apps/web/src/features/onboarding/components/onboarding-wizard.tsx:127-131` — render-time `cleanupRef` mutation as hidden state-sync; use `useEffectEvent`, or move cleanup into the effect's cleanup, or stabilize via `useCallback` (effort: medium)
- [ ] F35 `apps/web/src/features/onboarding/hooks/use-onboarding.ts:37-41` — 5 coupled `useState`s; consolidate into a `useReducer` with `next/back/setError/startSubmit/endSubmit` (effort: high)
- [ ] F268 `apps/web/src/features/review/hooks/use-issue-selection.ts:10-18` — hand-rolled prev-value tracking via state; use `useRef`+`useEffect` or a `key` prop (effort: medium)
- [ ] F269 `apps/web/src/features/history/hooks/use-history-page.ts:112-119` — same render-time reset pattern; extract a shared hook or use `useRef`/`key` (effort: medium)

### apps/docs

- [ ] F37 `apps/docs/src/routes/$lib.tsx:20` — `source.pageTree as unknown as PageTree`; import fumadocs `PageTree` directly or add a validating adapter/type-guard (dupes: F166, F280) (effort: medium)
- [ ] F38 `apps/docs/src/components/docs-mdx/blocks/source-viewer-block.tsx:32` — `as typeof sourceFiles` across the generated-data boundary; add an explicit `CrossDepSourceFile[] → SourceFile[]` mapper (dupes: F167, F282) (effort: medium)
- [ ] F165 `apps/docs/src/features/search/search-context.tsx:12` — `useMemo` over a trivial object with stable `setOpen`; inline the value object (dupes: F278) (effort: low)
- [ ] F279 `apps/docs/src/lib/seo.ts:9-14` — `process.env` then `import.meta.env` fallback for the same var; pick one per execution context and document the two-stage logic (effort: low)
- [ ] F283 `apps/docs/src/lib/consumption-metadata.ts:7` — hardcoded `https://r.b4r7.dev` fallback; define a `DEFAULT_REGISTRY_ORIGIN` const, wire `VITE_REGISTRY_ORIGIN`, document per-env values (effort: low)

### apps/hub

- [ ] F55 `apps/hub/package.json` — missing `"type": "module"`; add it for ESM/workspace uniformity (dupes: F179) (effort: low)

### a11y (libs/ui)

- [ ] F206 `libs/keys/src/dom/focusable.ts:36-37` — `isAriaHidden` ignores the `aria-hidden="false"` override; walk ancestors and stop at the first explicit setting (effort: low)
- [ ] F321 `libs/ui/registry/ui/button/button.tsx:180-197` — disabled anchor stays Tab-reachable/activatable; add `role="button"`, force `tabIndex={-1}` when `aria-disabled`, or render `<span>`/`<button disabled>` (effort: medium)
- [ ] F81 `libs/ui/registry/ui/checkbox/checkbox.tsx:173-191` — hidden native input's redundant `aria-label` + refocus-on-invalid competes with the visible control's naming/focus; review necessity (effort: medium)
- [ ] F322 `libs/ui/registry/ui/checkbox/checkbox.tsx:173-191` — hidden native input doesn't inherit `aria-invalid`/`aria-describedby`; mirror them or document validation-only intent (effort: low)
- [ ] F325 `libs/ui/registry/ui/radio/radio-group.tsx:260-276` — required-validation uses hidden `type="checkbox"`; switch to `type="radio"` or validate via `onInvalid` on the group (effort: medium)

### docs-quality

- [ ] F87 `apps/docs/registry/registry.json:1-2777` — 44+ stale component descriptions; regenerate via `prepare:generated` so descriptions match `component-docs/*` and MDX frontmatter (effort: low)
- [ ] F88 `apps/docs/content/docs/ui/getting-started/installation.mdx:7-34` — publish-gating buried in passive prose; add a prominent "Temporary: packages publish-gated" callout above the commands (effort: low)
- [ ] F89 `apps/docs/content/docs/ui/getting-started/installation.mdx:1-152` — only local-validation commands shown; add the post-publication copy-paste install path as primary, demote local validation, add a dated note (effort: medium)
- [ ] F207 `apps/docs/content/docs/ui/integrations/keys.mdx:119` — `useScope` row links to `[useKey]`; fix link text/target to point to the `useScope` page (effort: low)
- [ ] F328 `apps/docs/content/docs/keys/index.mdx:14-18` — `keys/hooks/index.mdx` and `keys/guides/index.mdx` are linked but missing; create both landing pages (effort: low)
- [ ] F329 `apps/docs/content/docs/ui` — six UI sections lack `index.mdx` (getting-started, hooks, integrations, patterns, theme, utils); add section landing pages (effort: low)

### architecture / governance

- [ ] F333 `AGENTS.md:31-38` — AGENTS.md documents only 6 of 11 packages; add boundary sections for `libs/core`, `cli/diffgazer`, `apps/docs`, `apps/landing`, `apps/hub` (dupes: F93, F334, F335, F336, F337) (effort: low)
- [ ] F92 `libs/ui/registry/hooks/use-active-heading.ts:10,37,114,155,208` — hook assumes global `document`/`window`; accept a `containerRef` and use `ownerDocument`/`defaultView` (effort: medium)

### registry / handoff (medium)

- [ ] F58 `libs/ui/registry/ui/dialog/dialog-content.tsx:17` — `mergeIds` from `@/lib/aria-utils` is not a registry item; add an `aria-utils` `registry:lib` item and list it in `registryDependencies` (dupes: F62) (effort: medium)
- [ ] F59 `libs/ui/registry/ui/shared/portal.tsx:26` — `typeof document` check returns null on SSR (not hydration-safe); add `'use client'`/lazy guard, a hydration-safe placeholder, or document client-only (effort: medium)
- [ ] F189 `scripts/monorepo/smoke-shadcn-install.mjs:112-161` — smoke doesn't verify registry-item dependency closure or file completeness; walk `registryDependencies` recursively and type-check resolved files (effort: medium)
- [ ] F306 `libs/ui/package.json:331-348` — add `validate-registry-metadata.ts` check that any non-hidden item with `@diffgazer-keys/*` deps has `peerDependenciesMeta["@diffgazer/keys"].optional` set as decided in HANDOFF-1 (this is the *validation* gate, distinct from the peer decision) (effort: medium)
- [ ] F310 `scripts/monorepo/smoke-cli.mjs:289-316` — copy-mode smoke never imports/calls the copied hooks; add a step that imports a rewritten hook from the fixture build to prove the rewrite works (effort: medium)

### build / tooling

- [ ] F356 `package.json` — 9 root scripts repeat the `prepare:artifacts` + `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1` prelude; extract a `prepare` turbo task (or shared shell script) all tasks depend on (effort: medium)
- [ ] F397 `biome.json (apps/docs only); root package.json` — lint/format covers only docs; the `turbo check` gate passes vacuously for 10 packages; add a root lint config + per-package `check` scripts and wire into release CI (dupes: F401, F402) (effort: high)
- [ ] F347 `.github/dependabot.yml` — npm group excludes `major` updates (ungrouped PRs); add a `major` group with documented rationale or fold into one group (effort: low)

### env / deployment docs

- [ ] F363 `.env.example` — AI provider keys (`GOOGLE_API_KEY`, `ZAI_API_KEY`, `OPENROUTER_API_KEY`) undocumented; add a credentials section noting at least one is required (effort: low)
- [ ] F360 `.env.example` — `VITE_DIFFGAZER_SHUTDOWN_TOKEN` undocumented; add as optional (injected in packaged mode) (effort: low)
- [ ] F361 `.env.example` — `VITE_API_URL` marked optional but actively used by `apps/web/vite.config.ts`; uncomment and mark recommended (effort: low)
- [ ] F364 `.env.example` — docker-compose build args `REGISTRY_ORIGIN`/`VITE_PUBLIC_ORIGIN`/`VITE_REGISTRY_ORIGIN` missing; add with defaults; move COOLIFY vars to a Deployment section (effort: low)
- [ ] F406 `DEPLOYMENT_PLAN.md:102-170` — Step 2 documents completed setup as future work; restructure into Completed / Remaining / Verification (dupes: F407) (effort: medium)
- [ ] F403 `README.md:15` — `apps/web` mislabeled "public"; change to "private" to match governance; align package.json/release-check references (effort: low)

### monorepo scripts (medium)

- [ ] F366 `scripts/monorepo/smoke-cli.mjs, smoke-package-runner.mjs` — `missingLocalDeps`/`missingLocalInstallDeps` near-identical; extract `resolveAndCollectMissing(deps, resolveFn)` into `smoke-shared.mjs` (effort: low)
- [ ] F368 `scripts/monorepo/smoke-cli.mjs` — `runFailure()` distinguishes errors only by numeric `status`; introduce a `CommandFailedError` carrying cmd/exit/stdout/stderr context (effort: medium)
- [ ] F376 `cli/server/src/dev-server.ts, cli/diffgazer/src/lib/servers/server-factories.ts` — `parsePortEnv` duplicated; extract to `@diffgazer/core` (env/ports) and import in both + tests (effort: medium)
- [ ] F381 `cli/diffgazer/src/lib/servers/api-server.ts` — readiness inferred only from a stdout pattern; add a `GET /api/health` check with timeout before `onReady` (effort: medium)

### performance / observability (medium)

- [ ] F384 `cli/server/src/features/git/router.ts` — git status/diff endpoints lack request timing; add timing middleware + `performance.now()` around service calls (related: F396, F386, F394) (effort: medium)
- [ ] F395 `apps/docs` — no bundle-size/Lighthouse/Web-Vitals monitoring; add size-limit + Lighthouse CI and lazy-load demos (effort: medium)

---

## Wave 4 — Low / anti-slop polish

### libs/ui

- [ ] F64 `libs/ui/registry/ui/menu/menu-sub.tsx:26-28,47-49,88-90,189-191` — delete decorative `// ----` divider comments (noise in copy-mode source) (effort: low)
- [ ] F65 `libs/ui/registry/ui/navigation-list/navigation-list-item.tsx:177-181` — extract the nested indicator-color ternary into a named `indicatorColorClass` variable (effort: low)
- [ ] F311 `libs/ui/registry/ui/sidebar/sidebar-provider.tsx:8-14` — non-semantic `state`/`onStateChange`; rename to a semantic name (e.g. `collapsed`/`onCollapsedChange`) or document the exception (effort: medium)
- [ ] F67 `libs/ui/registry/ui/card/card.tsx:77` — `ref={ref as never}` polymorphic-ref cast; document the pattern (PATTERNS.md) or wrap in a named helper (effort: low)
- [ ] F111 `libs/ui/registry/hooks/use-presence.ts:34-54` — `prevOpen` mirrors the `open` prop into state; replace `useState(open)` with a `useRef` updated during render (effort: medium)
- [ ] F223 `libs/ui/registry/lib/selectable-variants.ts:44-51` — `selectableIndicatorVariants` has empty-string `checked`/`highlighted` variants; remove them, rely on the compound variant (effort: low)
- [ ] F225 `libs/ui/registry/ui/button/button.tsx:158` — `(props as ButtonRenderPropProps).ref` without a guard; add an `isRenderPropProps` predicate (effort: low)
- [ ] F226 `libs/ui/registry/ui/input/input.tsx:1-22` — re-export `inputSizeClasses` from the Input module so consumers don't import `input-variants` directly (effort: low)
- [ ] F117 `libs/ui/registry/hooks/use-controllable-state.ts:18-40` — `internalRef` not synced after state changes; add `useLayoutEffect(() => { internalRef.current = internal }, [internal])` (effort: low)
- [ ] F118 `libs/ui/registry/hooks/use-is-mobile.ts:14-15` — expand the `useMemo` comment to state the React-19 concurrent-rendering rationale so it isn't removed as defensive (effort: low)
- [ ] F86 `libs/ui/registry/ui/button/button.tsx:100-129` — loading state relies on an `aria-hidden` spinner with `sr-only` content; document/add a `data-loading` attribute for visual CSS targeting (effort: low)
- [ ] F324 `libs/ui/registry/ui/search-input/search-input.tsx:10-25` — focus transition ignores `prefers-reduced-motion`; gate transitions behind the media query (effort: low)
- [ ] F326 `libs/ui/registry/ui/checkbox/checkbox-group.tsx:209-227` — hidden required input has both `aria-label` and `aria-labelledby`; use only one (effort: low)
- [ ] F327 `libs/ui/registry/ui/input/input-group.tsx:20-62` — only plain-string affixes get `aria-hidden`; add an `ariaHidden` prop or always-hide affixes and let interactive content opt out (effort: low)
- [ ] F83 `libs/ui/registry/ui/avatar/avatar-image.tsx:38` — document the decorative-image contract (empty `alt`) in JSDoc; test that an avatar-containing card has an accessible name (effort: low)
- [ ] F84 `libs/ui/registry/ui/dialog/dialog-content.tsx:136-141` — unnamed dialog only warns; escalate to a thrown error in dev/test and add a JSDoc example of the three naming paths (effort: low)
- [ ] F85 `libs/ui/registry/ui/popover/popover-content.tsx:74-75` — document the implicit `role`-by-`triggerMode` behavior and how to override it (effort: low)

### libs/keys

- [ ] F1 `libs/keys/src/context/keyboard-context.ts:34` — remove the unprofiled defensive `useMemo` in `useKeyboardContext`; return the object directly (effort: low)
- [ ] F2 `libs/keys/src/context/keyboard-context.ts:41-44` — remove the defensive `useMemo` in `useOptionalKeyboardContext` (dupes: F217) (effort: low)
- [ ] F3 `libs/keys/src/providers/keyboard-provider.tsx:220-228` — remove the unprofiled `useMemo` wrapping `registryValue`/`scopeValue` (effort: low)
- [ ] F4 `libs/keys/src/dom/navigation-items.ts:196` — `getFocusableElements` re-exported from two modules without rationale; pick the canonical export path and document it (effort: low)
- [ ] F5 `libs/keys/src/hooks/use-action-row-navigation.ts:287` — remove the unnecessary `as number` cast on `data-action-index` (already typed) (effort: low)
- [ ] F109 `libs/keys/src/dom/focus-restore.ts:31-32` — add a comment explaining the `focus({ preventScroll })` try/catch fallback is intentional degradation (effort: low)

### libs/core

- [ ] F-core-format `libs/core/src/format.ts:25-27` — `formatTimestampLocale` is single-use and unexported; inline it into `formatTimestampOrNA` (dupes: the second format.ts entry) (effort: low)
- [ ] F-core-figlet `libs/core/src/get-figlet.ts:1-22` — document why the sync core `getFigletText` intentionally diverges from the async UI version (replace the bare `@see`) (effort: low)
- [ ] F-core-lifecycle-return `libs/core/src/api/hooks/use-review-lifecycle-base.ts:23-44` — 13-prop flat return; group into `stream`/`checks`/`completion`/`start` sub-objects → STRUCTURE.md (effort: low)
- [ ] F-core-reducer `libs/core/src/review/review-state.ts:269-326` — extract a `dispatchEvent()` that routes the `EVENT` sub-types; reducer handles only top-level actions → STRUCTURE.md (effort: low)
- [ ] F-core-stepguard `libs/core/src/schemas/events/step.ts` — replace the ad-hoc `(event as {type:unknown}).type` pattern with a shared `isEventWithType(event, type)` helper (effort: low)
- [ ] F-core-providers-split `libs/core/src/schemas/config/providers.ts:1-358` — split into `models.ts`/`capabilities.ts` + keep config schemas; update the barrel → STRUCTURE.md (effort: medium)

### cli/server

- [ ] F28 `cli/server/src/shared/lib/http/response.ts:4,27` — replace `type { core } from "zod"` / `core.$ZodError` with the public `ZodError` type (effort: low)
- [ ] F29 `cli/server/src/features/review/router.ts:29-31` — `bodyLimitMiddleware` (50KB) duplicated with `config/router.ts`; extract a shared middleware factory/constant (effort: low)
- [ ] F154 `cli/server/src/shared/lib/config/store.ts:510-530` — document that lazy singleton init is safe in Node's single-threaded loop, or use an explicit `init()` at startup (effort: low)
- [ ] F95 `cli/server/src/shared/lib/config/store.ts:517-530` — 13 hand-typed forwarder exports re-typing `ConfigStore`; export `getStore()` (or the instance) and drop the wrappers (dupes: F339, F341, F344) → STRUCTURE.md (effort: low)
- [ ] F96 `cli/server/src/shared/lib/config/store.ts:267-269` — unstructured `console.warn` in async catch; return the error from `persistTrust()` or use a structured logger (effort: low)
- [ ] F155 `cli/server/src/features/review/sessions.ts:49-66` — event-cap silently drops events; emit a non-terminal "events may be incomplete" event to the client (effort: low)
- [ ] F157 `cli/server/src/features/review/pipeline.ts:40-47` — dense `??` fallback chain; extract `resolveActiveLenses(lensIds, profile, settings)` with an ordered fallback (effort: low)
- [ ] F158 `cli/server/src/shared/lib/http/response.ts:19-24` — `errorResponse` `status: number` silently degrades invalid codes to 500; type it `keyof typeof VALID_ERROR_STATUSES` (effort: low)
- [ ] F249 `cli/server/src/shared/lib/fs.ts:122,137` — two empty cleanup catches; add intent comments (temp-file cleanup failure is safe) (effort: low)
- [ ] F250 `cli/server/src/shared/lib/storage/reviews.ts:130,132` — `.catch(() => {})` drops index-write errors; log via `console.warn` + `getErrorMessage` (effort: low)
- [ ] F252 `cli/server/src/features/review/context-routes.ts:24-28` — validate `snapshot.markdown` before returning; remove/clarify the duplicated `text`/`markdown` field (dupes: F258) (effort: low)

### cli/add

- [ ] F302 `cli/add/src/utils/transform.ts:8-9` — `escapeForRegex` re-defined locally; move to a shared module (e.g. `@diffgazer/core/strings` or registry utils) and import; remove the now-dead `libs/ui/shared/string-utils.ts` export if unused (dupes: F208, F246, F209) (effort: low)
- [ ] F304 `cli/add/src/utils/transform.ts:200-204` — `rewriteLocalImportsForKeysPackage` silently passes through unknown specifiers; log/throw when `unknown.length > 0` or validate hook names at the CLI layer (effort: low)
- [ ] F303 `cli/add/src/utils/registry.ts:54-66` — `prepareFileContentForIntegration` re-runs CSS/whitespace normalization on the common `none` path; inline so it runs once (effort: low)
- [ ] F307 `cli/add/src/commands/add/file-ops.ts:72-101` — inlined keys-file dedup logic; extract a shared `mergeCopyBundleFiles(files)` reused by the copy-bundle builder (effort: medium)
- [ ] F308 `cli/add/src/utils/transform.ts:211-231` — module-level `_keysHookFiles`/`_reLocalHookImport` cache never invalidated; document single-shot intent or make it invalidatable (dupes: F139, F247) (effort: low)
- [ ] F309 `cli/add/src/utils/transform.test.ts` — add a test that `rewriteLocalImportsForKeysPackage` consolidates mixed type+value `@/hooks` imports without duplicating the `type` keyword (effort: low)
- [ ] F63 `cli/add/src/generated/keys-copy-bundle.json` — bundle has an `integrity` hash that the CLI never verifies; verify on load + add a tamper-detection smoke assertion (effort: medium)
- [ ] F190 `libs/ui/package.json:276-280` — registry `theme` item has no matching package export; mark it `meta.hidden:true` or add a `./theme` export, and document intent (effort: low)
- [ ] F141 `cli/add/src/commands/remove.ts:206-208` — nested ternary for `keyName`; rewrite as explicit early-returns in a helper (effort: low)
- [ ] F142 `cli/add/src/utils/transform.ts:153-157` — `RegExp` recompiled per call in `rewriteRelativeJsExtensionsForCopy`; hoist to a module-level constant (also `rewriteKeysPackageImportLine`) (effort: low)
- [ ] F144 `cli/add/src/utils/add-integration.ts:53-82` — `resolveIntegrations` lacks exhaustiveness; use a `switch` with a `never` default over `IntegrationMode` (effort: low)
- [ ] F198 `cli/add/src/commands/init.ts:33` — `buildInitPlannedPaths` opts type uses `[key:string]:unknown`; define an `InitOptions` interface and validate with Zod (effort: low)
- [ ] F103 `cli/add/src/utils/transform.ts:241-259` — `parseKeysImportLine`/`replaceSubpathAlias`/`replaceClosingBlockComment`/`replaceWithBlockComment` (3-4 positional params) → options objects → STRUCTURE.md (effort: low)
- [ ] F320 `cli/add/src/context.ts:1, cli/diffgazer/src/tui-entry.tsx:1-10` — strip relative `.js` specifiers in `cli/add/src` and `cli/diffgazer/src` (lower priority than the libs fixes) (effort: medium)

### cli/diffgazer

- [ ] F160 `cli/diffgazer/src/web-launcher.ts:17, hooks/use-exit.ts:5` — `SHUTDOWN_TIMEOUT_MS=3000` duplicated; extract to a shared constants module (effort: low)
- [ ] F260 `cli/diffgazer/src/app/navigation-context.tsx:1` — remove the unused default `React` import (effort: low)
- [ ] F262 `cli/diffgazer/src/app/screens/history-screen.tsx:58` — rename unused `input` param to `_input` in the `useInput` handler (effort: low)
- [ ] F263 `cli/diffgazer/src/components/ui/badge.tsx:1` — remove the unused `ReactNode` type import (dupes: F264, F265, F266 — button/section-header/spinner) (effort: low)
- [ ] F378 `cli/diffgazer/src/index.tsx:13-34` — `readVersion()` reads/validates `package.json` at runtime for `--version`; replace with a build-time version constant (effort: medium)
- [ ] F379 `cli/server/src/dev.ts, cli/diffgazer/src/index.tsx` — divergent entry-point error handling; standardize on one try/catch-in-main pattern (shared CLI error helper) (effort: low)
- [ ] F382 `cli/diffgazer/src/lib/servers/create-process-server.ts` — `FORCE_KILL_DELAY_MS=2000` hardcoded/undocumented; name it in config, comment the choice, consider env override (effort: low)

### apps/web

- [ ] F33 `apps/web/src/app/providers/config-provider.tsx:117-143` — remove defensive `useMemo` on `dataValue`/`actionsValue` (no memoized consumers) (effort: low)
- [ ] F34 `apps/web/src/features/review/components/page.tsx:145` — `as const` on the fallback object; verify `LiveReviewState` models the `'streaming'` literal or use a factory (effort: low)
- [ ] F36 `apps/web/src/app/providers/config-provider.tsx:88-115` — three `useCallback`s depend on extracted `mutateAsync`; depend on stable refs or document why (effort: low)
- [ ] F272 `apps/web/src/features/review/components/severity-filter-group.tsx:45-51` — `useEffect` imperatively focuses the reset button; move focus to a ref callback/parent or `autoFocus` (effort: low)
- [ ] F273 `apps/web/src/features/settings/hooks/use-diagnostics-keyboard.ts:40-75` — `refreshAllInFlight` ref duplicates `isRefreshingAll` state; rely on the state alone (effort: low)

### apps/docs

- [ ] F39 `apps/docs/src/components/copy-button.tsx:43` — unguarded `console.error`; wrap in `if (import.meta.env.DEV)` (dupes: F40) (effort: low)
- [ ] F41 `apps/docs/src/lib/docs-library.ts:9-11` — remove pass-through type re-exports; import the types directly (effort: low)
- [ ] F42 `apps/docs/src/components/breadcrumbs.tsx:12-19` — hardcoded `SECTIONS_WITH_INDEX` mirrors the filesystem; generate from `source.pageTree` or validate in a test (effort: medium)
- [ ] F168 `apps/docs/src/lib/consumption-metadata.ts:7` — create `apps/docs/.env.example` documenting `VITE_REGISTRY_ORIGIN` and `VITE_PUBLIC_ORIGIN` (effort: low)
- [ ] F171 `apps/docs/src/layouts/sidebar.tsx:96` — index-based section key `${i}-${title}`; use a stable `section.title` key (effort: low)
- [ ] F172 `apps/docs/src/layouts/sidebar.tsx:117-123` — `onNavigate` fires on middle/Ctrl-click; guard for primary click (`button===0`, no modifiers) (effort: low)
- [ ] F281 `apps/docs/src/features/theme/components/variable-diagram.tsx:1,36` — undocumented experimental `useEffectEvent`; add a rationale comment or fall back to `useCallback`/inline (effort: low)

### apps/landing

- [ ] F-landing-code-aria `apps/landing/src/App.tsx:10-12` — install-command `<code>` lacks an accessible label; add `aria-label` or wrap in figure/figcaption (effort: low)
- [ ] F-landing-test-types `apps/landing/tsconfig.json:14, vitest.config.ts:6, package.json` — tests excluded from type-check; add `test:types` (`vitest --typecheck --typecheck.only --run`) and include tests (effort: low)
- [ ] F-landing-ui-reuse `apps/landing/package.json:13, src/App.tsx:1-26` — `@diffgazer/ui` unused in code; adopt Button/Link/Card or document the deliberately-minimal choice (effort: medium)
- [ ] F-landing-tsconfig-strict `apps/landing/tsconfig.json` — add `noUncheckedIndexedAccess`/`noImplicitOverride`/`isolatedModules`/`verbatimModuleSyntax` to match workspace standard (effort: low)
- [ ] F-landing-build-emit `apps/landing/package.json:7` — `tsc -b` emits then vite overwrites; add `noEmit:true`, drop `outDir`, build with `vite build` (effort: low)
- [ ] F-landing-a11y-test `apps/landing/src/App.test.tsx` — add keyboard-focus + landmark/skip-link assertions (e.g. `userEvent.tab()`, jest-axe) (effort: medium)
- [ ] F-landing-jsonld `apps/landing/index.html:1-27` — add a `SoftwareApplication`/`Product` JSON-LD block for SEO (effort: low)
- [ ] F-landing-wrapper `apps/landing/src/App.tsx:3` — purely-cosmetic wrapper `<div>`; move `min-h-screen`/bg/font/text to body or global CSS (effort: low)
- [ ] F-landing-strings `apps/landing/src/App.tsx:5-19` — extract hardcoded strings (product name, install command, docs URL, button text) to a constants module shared with the test (effort: low)
- [ ] F-landing-ui-dep `apps/landing/package.json:13` — document why `@diffgazer/ui` is a dep (CSS theming only) to prevent accidental removal (effort: low)
- [ ] F-landing-copy-cmd `apps/landing/src/App.tsx:10-12` — install command isn't copyable; add a copy-to-clipboard button (effort: medium)

### libs/registry (low)

- [ ] F122 `libs/registry/src/fingerprint.ts:13` — optional `logger.warn?.()`/`debug?.()` silently no-op; make the methods required (with no-op defaults) or document non-emission (effort: low)
- [ ] F124 `libs/registry/src/cli/integrity.ts:5-7, copy-bundle.ts:47-49` — `computeIntegrity` duplicated with differing string styles; unify in one module or document the split; normalize to template literals (dupes: F231) (effort: low)
- [ ] F129 `libs/registry/src/manifest.ts:23-25` — `registry.index`/`publicDir` validated as bare strings; apply `RelativeArtifactPathSchema`/`isRelativeSubpath` containment checks (effort: low)
- [ ] F234 `libs/registry/src/docs/sync-operations.ts:26-46` — `assertNoUnrewrittenOrigin` silently swallows `readFileSync` errors; `existsSync`-guard then log/rethrow unexpected errors (effort: low)

### types / type-safety (low)

- [ ] F68 `libs/core/src/api/openrouter-utils.test.ts` — label intentional `as unknown as T` test fixtures with a comment or a `testCast<T>(value, reason)` helper (effort: low)
- [ ] F69 `libs/ui/registry/tsconfig.json:10` — registry tsconfig has `verbatimModuleSyntax:false` vs `true` elsewhere; enable it or comment why dev-only source needs false (effort: low)
- [ ] F319 `libs/core/tsconfig/base.json:8-9, libs/keys/tsconfig.json:11-12` — `NodeNext` vs `Bundler` moduleResolution divergence; converge on one (Bundler+ESNext for this browser-heavy monorepo) and verify declaration emit (effort: low)
- [ ] F70 `libs/ui/package.json:1-30` — no top-level `main`/`types`; add them (or document the ESM-subpath-only design for non-`exports`-aware tools) (effort: low)
- [ ] F71 `libs/ui/package.json:331-348` — optional peers (`@diffgazer/keys`/figlet/lowlight) not mapped to the exports that need them; document in README + per-component JSDoc (effort: low)
- [ ] F312 `apps/web/src/types/theme.ts:1-8` — `WebTheme` omits `'terminal'` which components actually handle; import core `Theme` (or model the terminal→dark mapping explicitly) (dupes: F314, F193) (effort: low)
- [ ] F313 `apps/web/src/types/input-method.ts:1-2` — `InputMethod`/`INPUT_METHODS` duplicate core's export; delete and import from `@diffgazer/core/onboarding` (update the 3 consumers) (effort: low)
- [ ] F194 `apps/web/src/lib/query-client.ts:1-22, cli/diffgazer/src/lib/query-client.ts:1-18` — query-client factories share structure; extract `createQueryClientBase(overrides?)` in core or document the deliberate split (effort: low)
- [ ] F315 `apps/web/src/test-setup.ts:6-12, apps/landing/src/test-setup.ts` — ResizeObserver polyfill/cleanup duplicated and inconsistent; share a test-setup util (or align all on the UI lib's fuller setup) (effort: low)

### tests-behavior (low)

- [ ] F72 `libs/ui/registry/hooks/testing/use-form-reset.test.tsx:202-223` — replace `addEventListener`/`removeEventListener` spy assertions with behavior: reset callback fires once per reset, stable rerenders don't re-trigger (effort: medium)
- [ ] F199 `libs/ui/registry/ui/progress/progress.test.tsx:39-68` — replace Tailwind class assertions with aria/computed-style/property assertions, or document the size classes as public contract (effort: medium)
- [ ] F200 `libs/ui/registry/ui/skeleton/skeleton.test.tsx:19-30` — drop utility-class assertions; keep aria-hidden + className-forwarding; test appearance via axe/computed style (effort: low)
- [ ] F73 `libs/ui/registry/ui/radio/radio.test.tsx:21` — distinguish contract call-counts from implementation-detail counts; assert called-with-value where count isn't the contract (effort: medium)
- [ ] F74 `libs/ui/registry/ui/tabs/tabs.test.tsx:524-526` — replace internal `data-slot` `querySelectorAll` with behavior/role assertions or document the DOM shape as contract (effort: medium)
- [ ] F202 `libs/ui/registry/ui/typography/typography.test.tsx:98-106` — test truncate via observable effect (computed `text-overflow`/actual truncation) or document the class as contract (effort: low)
- [ ] F80 `libs/ui/registry/ui/dialog/dialog.test.tsx:1-75` — audit test files >500 lines and add 1-line justification comments before unusual patterns (querySelector/fireEvent/spy) (effort: low)
- [ ] F204 `libs/ui/registry/ui/accordion/accordion.test.tsx:~520-530` — replace `.parentElement?.parentElement` traversal with a role/id query (effort: low)
- [ ] F205 `libs/ui/registry/ui/code-block/code-block.test.tsx` — replace `hljs-*` class assertions with computed-color/visual checks of highlighting (effort: medium)

### monorepo scripts / governance (low)

- [ ] F370 `scripts/monorepo/smoke-shared.mjs, smoke-cli.mjs, smoke-package-runner.mjs, smoke-shadcn-install.mjs, validate-artifacts.mjs` — env-var-name string literals scattered; centralize in an `artifacts/env.mjs` `ENV` const (effort: low)
- [ ] F371 `scripts/monorepo/smoke-shadcn-install.mjs:287-355` — `startRegistryServer` closure-coupled handlers; extract `rewriteRegistryUrls(baseUrl)` + a `createRegistryHandler` factory for testability (effort: medium)
- [ ] F372 `scripts/monorepo/smoke-cli.mjs, smoke-shadcn-install.mjs, smoke-package-fixtures.mjs, validate-artifacts.mjs` — `[...].join('\n')` repeated 10+ times; add a `joinLines(...)` helper in `smoke-shared.mjs` (effort: low)
- [ ] F374 `scripts/monorepo/check-invariants.mjs, validate-artifacts.mjs` — shared read-validate-collect-throw shape; extract a `runValidationChecks(checks)` runner (effort: low)
- [ ] F375 `scripts/monorepo/check-invariants.mjs, validate-artifacts.mjs, smoke-*.mjs` — implicit exit-code-1-via-uncaught-error contract; add explicit try/finally + `process.exit(1)` for cleanup scripts and a header comment (effort: low)
- [ ] F367 `scripts/monorepo/check-invariants.mjs:356-358` — redundant `console.error` immediately before throwing the same message; drop the `console.error` (effort: low)
- [ ] F383 `cli/server/src/dev-server.ts, cli/diffgazer/src/lib/servers/server-factories.ts` — `parsePortEnv` error wording differs; on consolidation (F376) support the configurable `variableName` (defaults to PORT) (effort: low)
- [ ] F380 `cli/server/src/dev-server.ts` — misleading `dev-server.ts` name for production HTTP-server logic; rename to `http-server.ts`/`server.ts` and move `DEFAULT_*` to `config.ts` → STRUCTURE.md (effort: low)
- [ ] F104 `libs/ui/scripts/validate-registry-metadata.ts:1-547` — extract reusable validators (`registry-import-validator`/`registry-orphan-validator`/`registry-exports-validator`) into a testable module; keep a thin CLI wrapper → STRUCTURE.md (effort: medium)
- [ ] F346 `.github/PULL_REQUEST_TEMPLATE.md` — checklist wording drifts from CONTRIBUTING.md; make the template verbatim-mirror CONTRIBUTING items 9-14 (effort: low)
- [ ] F348 `.github/dependabot.yml` — docker ecosystem uncapped/ungrouped; add `open-pull-requests-limit` + a `docker-updates` group (effort: low)
- [ ] F350 `.github/ISSUE_TEMPLATE/bug_report.yml` — issue templates don't link CONTRIBUTING/AGENTS; add a note field pointing to both (effort: low)
- [ ] F351 `.github/dependabot.yml` — no commit-message convention; add `commit-message: { prefix: chore(deps), include: scope }` (effort: medium)
- [ ] F352 `.github/PULL_REQUEST_TEMPLATE.md` — sparse Summary guidance; add a one-sentence depth instruction (effort: low)
- [ ] F353 `.github/dependabot.yml` — npm config not workspace-aware; add `versioning-strategy`/`allow` (or document independent-workspace handling) (effort: medium)
- [ ] F355 `apps/hub/package.json` — covered by F183 (scaffold-or-delete decision); if deleting, also remove the `.changeset/config.json` ignore entry (effort: low)
- [ ] F185 `apps/hub/package.json:5` — description claims "project portfolio" but content is three links; update to match the stub state (effort: low)
- [ ] F398 `apps/docs/biome.json:2` — `$schema` references Biome 2.2.4 but 2.3.14 is installed; bump the schema URL (effort: low)
- [ ] F400 `apps/docs/biome.json:8-17` — workspace-wide `**` includes lint other packages and miss generated artifacts; scope to docs-relative paths and exclude build dirs (effort: low)
- [ ] F408 `PACKAGE_GOVERNANCE.md:14` — hardcoded May-6 publish-gate date; replace with a status indicator + `npm view` verification command (effort: low)
- [ ] F410 `CONTRIBUTING.md:1-15` — 14-line checklist with no enforcement links; add per-item validation commands and links to root scripts/CI gates (effort: low)

### env docs (low)

- [ ] F362 `.env.example` — undocumented internal flags (`DIFFGAZER_DEV`, `DIFFGAZER_SKIP_ARTIFACT_PREPARE`, `DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT`, `PLAYWRIGHT_PORT`, `DOCS_PRERENDER`); add a "Development and Build Flags" section (effort: low)
- [ ] F365 `.env.example` — `PORT` undocumented; add `PORT=3000` with a note it controls the API server + docker-compose port and should match `VITE_API_URL` (effort: low)

### performance / observability (low)

- [ ] F385 `cli/server/src/app.ts:123-126` — `onError` log lacks request context; emit structured `{level,timestamp,error,request,response,durationMs}` with a trace id (effort: low)
- [ ] F386 `cli/server/src/features/review/context-routes.ts:31-54` — `refreshContextHandler` has no timing; capture `startTime`, log duration in success/error, expose a histogram metric (effort: low)
- [ ] F396 `cli/server/src/app.ts` — no per-route latency/error-rate middleware; add timing + 4xx/5xx categorization middleware (effort: low)
- [ ] F391 `root` — no load/benchmark suite (344 unit tests, 0 perf); add autocannon/k6 benchmarks with SLOs (review p95, diff parse, concurrent sessions) in CI (effort: high)
- [ ] F393 `cli/server/src` — ad-hoc console logging, no correlation IDs/traces/metrics export; add structured logging (pino) + request-id middleware + optional OpenTelemetry (effort: high)
- [ ] F394 `cli/server/src/features/review` — only end-of-review timing; add per-step timing (diff/context/orchestration/enrichment/storage) + queue-depth/rejection metrics (effort: high)
