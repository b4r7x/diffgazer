# Remediation Checklist — Audit 2026-05-28

The coverage ledger for `SPEC.md`. **249 items**, each assigned to exactly one batch. Authoritative fix detail lives in `../FIX-PLAN.md` (and `../STRUCTURE.md` / `../HANDOFF-READINESS.md`); the short tags here are for tracking only. Check an item only when the fix landed **and** the batch validator passed.

## Coverage invariant

| Source | Count |
| --- | ---: |
| Raw findings (INDEX.md, 23 domains) | 349 |
| − verified-good / no-change dropped (F75–F79, F220, F343) | −7 |
| − cross-domain duplicates folded into primaries (ride as `(dupes:…)`) | (folded) |
| + manifest/peer items with no finding ID (HANDOFF-1, HANDOFF-2) | +2 |
| **= actionable checkboxes (this file = FIX-PLAN.md)** | **249** |

Per-batch sum check (must equal 249): 6+2+2 + 11+27+16+11+9+30+18+9+17+1+22+15+7+14+18+5+9 = **249**. ✓

| Stage | Batches |
| --- | --- |
| 1 (Wave 1) | B1(6) B2(2) B3(2) |
| 2a (libs) | B4(11) B5(27) B6(16) B7(11) B8(9) B20(9) |
| 2b (cli) | B9(30) B10(18) B11(9) |
| 2c (apps) | B12(17) B13(1) B14(22) B15(15) B16(7) |
| 2d (repo) | B17(14) B18(18) B19(5) |

---

## Campaign status (run 2026-05-29/30, no-commit)

All batches executed via the implement→independent-validate→fix workflow. Per-finding evidence lives in the agent transcripts; this is the batch-level verdict landscape. **Final full-repo gates (turbo type-check 11/11, turbo test 11/11, validate:artifacts, verify:monorepo, git diff --check) are GREEN. BUT `smoke` was not in those gates and is the real handoff gate — it is being re-run after the keys-build fix below.**

| Batch | Verdict | Note |
| --- | --- | --- |
| B1, B3 | PASS | Wave 1 (B3 = both false-positives, verified-no-change) |
| B4, B10, B11, B18, B19, B20 | PASS (clean) | |
| B2, B5, B6, B8, B9, B12, B13, B14, B15, B16 | PASS (with documented concerns) | validators passed; concerns noted in transcripts |
| B7 | FAIL → **transient** | gate `@diffgazer/registry test` was red only because B4's keys-source edit left `libs/keys/public/r` stale; the final `prepare:artifacts` regenerated it and the final turbo test passed. B7's own findings (F121/F128/…) landed. Re-confirm. |
| B17 | FAIL (F397) | root lint config for `scripts/monorepo` added; **per-package `check` deferred** (see below) |

### Residuals / follow-ups (flagged for review, not silently dropped)
- **keys npm-dist regression (from B1/F316): ✅ FIXED + smoke-verified.** Kept keys `src` `.js` (Node-ESM dist); completed F186's copy-bundle strip to cover `hooks/utils/*`; reverted 4 detector-fixture strings a codemod had corrupted (keys tests 619/619); added a build-time guard `verify-dist-esm-imports.ts` (fails build if `dist` relative imports lack `.js`). All three output paths now green simultaneously (npm dist `.js`; `public/r` clean; copy-bundle clean). **Full `smoke` PASSES with zero skips** — `smoke:cli` + `smoke:packages` (incl. the previously-red `@diffgazer/keys` standalone import) + `smoke:shadcn` (14/14).
- **F196 (strip `libs/core/src` `.js`): ✅ DELIVERED by B8/F319.** `libs/core` flipped NodeNext→Bundler; core src has 0 relative `.js`.
- **F397 (per-package `check`): DEFERRED.** B17 added the root lint config for `scripts/monorepo`; real per-package `check` surfaces pre-existing lint debt across 10 packages (out of scope for a no-new-debt remediation), and a redundant `tsc --noEmit` would only duplicate `type-check`. Left for a dedicated lint-adoption pass.
- **B7: transient FAIL, resolved.** Stale `public/r` from B4's edit; final `prepare:artifacts` re-synced it; `validate:artifacts:check` + turbo test green.
- **DONE_WITH_CONCERNS (10 batches):** validators passed each with documented concerns (in transcripts); can be surfaced on request.

### ⚠️ Untracked files the maintainer MUST `git add` before committing
- `libs/keys/scripts/verify-dist-esm-imports.ts` — **keys `build` fails without it** (referenced by the build script).
- `cli/add/src/utils/transform.test.ts` — new `.js`-rewrite regex coverage.
- (plus the planning docs + any new component/test files the batches created — review `git status`.)

---

## Stage 1 — Wave 1

### B1 — Public `.js` import-specifier strip (6) — PASS (uncommitted)
- [x] F316 — keys src stripped (Bundler); keys type-check green. _(residual: real `.js` imports remain in keys **test** files — low, not consumer-facing; see Deferrals.)_
- [x] F317 — ui/registry source stripped; ui type-check green. _(same test-file residual.)_
- [ ] **F196 — DEFERRED to B8/F319.** Premise false while core is `NodeNext` (`.js` specifiers are *required*; stripping → 6× TS2835). Must be delivered by F319's NodeNext→Bundler flip in B8. `libs/core/src` correctly left untouched.
- [x] F186 — `rewriteRelativeJsExtensionsForCopy` applied in keys copy-bundle generator; generated bundle clean.
- [x] F188 — `collectBundleRelativeJsImportErrors` gate added + wired into `validate-artifacts.mjs`; proven non-vacuous (seeded offender → exit 1).
- [x] F119 — `assertNoRelativeJsImports` added to keys build; 2 build-side tests pass.

### B2 — keys optional-peer + license (2) · ISOLATED · DECISION-1
- [ ] HANDOFF-1 — resolve keys optional-peer + static-import (per DECISION-1) + keys-absent smoke fixture
- [ ] HANDOFF-2 — `cli/diffgazer` license MIT→Apache-2.0 + license-field invariant

### B3 — Critical type-safety (2) — PASS (uncommitted) · both VERIFIED-NO-CHANGE (false positives)
- [x] F161 — verified-no-change. `cycleTierFilter(current)=>next`, so `setTierFilter(cycleTierFilterCore)` is already a valid React functional updater. Regression test added (`use-model-filter.test.ts`, paid→all wrap); 3/3 pass. No code change (correctly).
- [x] F164 — verified-no-change. React 19.2.4 — `<SearchContext value={value}>` is the valid idiom; `.Provider` would be a regression. New `search-context.test.tsx` (2/2 pass). No code change (correctly).

## Stage 2a — libs

### B4 — libs/keys (11)
- [ ] F6 — `use-action-row-navigation` stable callbacks
- [ ] F7 — `use-focus-zone` stabilize getters
- [ ] F218 — `use-key` memoize registrationVersion
- [ ] F219 — `use-navigation` ref/effectEvent for boundary handler
- [ ] F1 — remove defensive `useMemo` in `useKeyboardContext`
- [ ] F2 — remove defensive `useMemo` in `useOptionalKeyboardContext`
- [ ] F3 — remove defensive `useMemo` on registry/scope values
- [ ] F4 — canonical `getFocusableElements` export path
- [ ] F5 — drop unnecessary `as number` cast
- [ ] F109 — comment intentional `focus` try/catch fallback
- [ ] F206 — `isAriaHidden` honor `aria-hidden="false"` ancestor override

### B5 — libs/ui components & a11y (27)
- [ ] F113 — checkbox-group native validation (remove readOnly / submit-handler)
- [ ] F9 — select typed narrowing helper (no post-hoc casts)
- [ ] F221 — remove no-op hidden-select `onChange`
- [ ] F222 — shared icon-slot base class (menu-item)
- [ ] F224 — Dialog/Tabs `XRoot`-then-alias consistency
- [ ] F11 — checkbox derive `nativeInvalid` (no effect-sync)
- [ ] F12 — switch derive invalid (no effect-sync)
- [ ] F13 — radio move notify into toggle()
- [ ] F115 — export `DialogKeyboardHints`
- [ ] F321 — disabled anchor not Tab-reachable
- [ ] F81 — checkbox hidden-input redundant aria-label/refocus review
- [ ] F322 — checkbox hidden input inherit aria-invalid/describedby
- [ ] F325 — radio-group required uses `type="radio"`/group onInvalid
- [ ] F64 — delete decorative divider comments (menu-sub)
- [ ] F65 — extract indicator-color ternary (navigation-list-item)
- [ ] F311 — `SidebarProvider` semantic state name
- [ ] F67 — document/wrap polymorphic `ref as never` (card)
- [ ] F223 — remove empty-string selectable variants
- [ ] F225 — `isRenderPropProps` guard (button)
- [ ] F226 — re-export `inputSizeClasses` from Input
- [ ] F86 — `data-loading` attribute for button spinner
- [ ] F324 — search-input gate transition behind reduced-motion
- [ ] F326 — checkbox-group hidden input single aria label source
- [ ] F327 — input-group affix aria-hidden contract
- [ ] F83 — avatar decorative-alt JSDoc + accessible-name test
- [ ] F84 — unnamed dialog throws in dev/test + JSDoc
- [ ] F85 — document popover role-by-triggerMode

### B6 — libs/ui hooks, big-file splits, object-args, exports, registry internals (16)
- [ ] F8 — `use-form-reset` deps array
- [ ] F98 — split `use-listbox` (STRUCTURE §1) + `hasDomItem` object-args
- [ ] F229 — export `use-is-mobile`/`typeahead-buffer`
- [ ] F228 — `use-presence` route exit through `notifyExit`
- [ ] F92 — `use-active-heading` accept containerRef/ownerDocument
- [ ] F58 — add `aria-utils` registry:lib item + dep
- [ ] F59 — portal SSR hydration-safe guard
- [ ] F306 — registry-metadata validation gate for keys-dep optionality
- [ ] F111 — `use-presence` prevOpen via ref
- [ ] F117 — `use-controllable-state` sync internalRef
- [ ] F118 — `use-is-mobile` expand memo rationale comment
- [ ] F104 — split `validate-registry-metadata` into testable validators (STRUCTURE §8)
- [ ] F69 — registry tsconfig `verbatimModuleSyntax`
- [ ] F70 — ui package.json `main`/`types` (or document)
- [ ] F71 — document optional-peer→export mapping
- [ ] F190 — theme registry item `meta.hidden` or `./theme` export
- _Also implement STRUCTURE §2 (menu-item), §3 (select-content), §4 (use-floating-position + object-args), §5 (stepper-variants) splits._

### B7 — libs/registry (11)
- [ ] F121 — validate `actualItem` shape before field compare
- [ ] F128 — `resetDir` failure-safe
- [ ] F120 — extract shared library-id validator
- [ ] F123 — shared base `RegistryItemSchema` + compat test
- [ ] F125 — validate library-id once at boundary
- [ ] F126 — `Partial<RegistryItem>` for actualItem
- [ ] F233 — `metaField` switch handles `string[]`
- [ ] F122 — logger methods required/no-op
- [ ] F124 — unify `computeIntegrity`
- [ ] F129 — manifest path containment checks
- [ ] F234 — `assertNoUnrewrittenOrigin` guard + rethrow

### B8 — libs/core (9)
- [ ] F-core-parse — `parse<T>` require schema/guard or SafeApiResult
- [ ] F-core-format — inline single-use `formatTimestampLocale`
- [ ] F-core-figlet — document sync/async figlet divergence
- [ ] F-core-lifecycle-return — group 13-prop return (STRUCTURE §15)
- [ ] F-core-reducer — extract `dispatchEvent` (STRUCTURE §10)
- [ ] F-core-stepguard — shared `isEventWithType` helper
- [ ] F-core-providers-split — split providers.ts (STRUCTURE §9)
- [ ] F319 — converge moduleResolution (also `libs/keys/tsconfig.json`)
- [ ] F68 — label test `as unknown as T` casts

### B20 — libs/ui tests-behavior refactor (9) · runs after B5/B6
- [ ] F72 — use-form-reset: behavior not spy assertions
- [ ] F199 — progress: aria/property not class assertions
- [ ] F200 — skeleton: drop utility-class assertions
- [ ] F73 — radio: called-with-value vs count
- [ ] F74 — tabs: role/behavior not `data-slot` querySelectorAll
- [ ] F202 — typography: truncate via observable effect
- [ ] F80 — justify unusual patterns in >500-line test files
- [ ] F204 — accordion: role/id query not parent traversal
- [ ] F205 — code-block: computed-color not `hljs-*` class

## Stage 2b — cli

### B9 — cli/server (30)
- [ ] F24 — UNAUTHORIZED 403→401 (both routers; reserve 403 FORBIDDEN)
- [ ] F149 — rate-limit map eviction (TTL/size bound)
- [ ] F151 — `shutdownSessions()` clears interval + teardown
- [ ] F251 — replace `as unknown as LanguageModel`
- [ ] F26 — `createSession` object-args (STRUCTURE §4)
- [ ] F27 — `getActiveSessionForProject` object-args (STRUCTURE §5)
- [ ] F100 — split config `store.ts` (STRUCTURE §6) + forwarder collapse
- [ ] F101 — split review `context.ts` (STRUCTURE §7) + fold dep loops + buildFileTree object-args
- [ ] F146 — remove duplicated shutdown-token check in router
- [ ] F147 — `getRequestedProjectPath` discriminated union
- [ ] F148 — `onError` branch on AppError.code
- [ ] F156 — `isValidProjectPath` realpath + containment
- [ ] F253 — exhaustive drilldown error→status switch
- [ ] F28 — public `ZodError` type
- [ ] F29 — shared bodyLimit middleware factory
- [ ] F154 — document lazy singleton init safety
- [ ] F95 — export `getStore()`, drop 13 forwarders
- [ ] F96 — structured persistTrust error (no bare console.warn)
- [ ] F155 — emit non-terminal "events incomplete" event
- [ ] F157 — extract `resolveActiveLenses`
- [ ] F158 — `errorResponse` typed status
- [ ] F249 — intent comments on cleanup catches (fs)
- [ ] F250 — log index-write errors (storage/reviews)
- [ ] F252 — validate snapshot.markdown / clarify dup field
- [ ] F384 — git endpoints request timing
- [ ] F385 — onError structured log + trace id
- [ ] F386 — refreshContextHandler timing
- [ ] F396 — per-route latency/error-rate middleware
- [ ] F393 — structured logging (pino) + request-id
- [ ] F394 — per-step review timing + queue metrics

### B10 — cli/add (18)
- [ ] F145 — chunk-dir cleanup via try/finally
- [ ] F22 — extract shared `sha256`
- [ ] F137 — merge `publicInstallNames`/`publicListNames`
- [ ] F138 — scoped workflow-context object (no module-mutable state)
- [ ] F140 — intent comment on cleanup `rmSync` catch
- [ ] F143 — extract `validateInstallNamesAgainst`
- [ ] F304 — `rewriteLocalImportsForKeysPackage` log/throw unknown
- [ ] F303 — single CSS/whitespace normalization on `none` path
- [ ] F307 — shared `mergeCopyBundleFiles`
- [ ] F308 — document/invalidate module-level cache
- [ ] F309 — test mixed type+value `@/hooks` consolidation
- [ ] F63 — verify keys-copy-bundle integrity on load + smoke
- [ ] F141 — replace nested `keyName` ternary
- [ ] F142 — hoist recompiled RegExp to module constant
- [ ] F144 — exhaustive `IntegrationMode` switch
- [ ] F198 — `InitOptions` interface + Zod validation
- [ ] F103 — transform helpers object-args (STRUCTURE §6–§9)
- [ ] F320 — strip `.js` specifiers in `cli/add/src` + `cli/diffgazer/src`

### B11 — cli/diffgazer (9)
- [ ] F159 — severity-filter setState-in-render → effect
- [ ] F160 — shared `SHUTDOWN_TIMEOUT_MS`
- [ ] F260 — remove unused default React import
- [ ] F262 — rename unused `input`→`_input`
- [ ] F263 — remove unused `ReactNode` imports (badge/button/section-header/spinner)
- [ ] F378 — build-time version constant for `--version`
- [ ] F379 — standardized entry error handling (also `cli/server/src/dev.ts`)
- [ ] F382 — name/comment `FORCE_KILL_DELAY_MS`
- [ ] F381 — `GET /api/health` readiness probe before onReady

## Stage 2c — apps

### B12 — apps/web (17)
- [ ] F31 — derive `liveState` (no 3 effects)
- [ ] F162 — group 21-prop `IssueListPaneProps` (STRUCTURE §14)
- [ ] F276 — split `use-model-dialog-keyboard` (STRUCTURE §11)
- [ ] F274 — split `use-review-results-keyboard` (STRUCTURE §12)
- [ ] F275 — split `use-providers-keyboard` (STRUCTURE §13)
- [ ] F277 — extract `useOnboardingKeyboard` (STRUCTURE §14/onboarding)
- [ ] F32 — onboarding cleanupRef render-time mutation fix
- [ ] F35 — onboarding `useReducer` consolidation
- [ ] F268 — issue-selection prev-value via ref/key
- [ ] F269 — history-page render-time reset fix
- [ ] F33 — remove defensive memo on config provider values
- [ ] F34 — verify `as const` fallback models 'streaming'
- [ ] F36 — config provider callbacks depend on stable refs
- [ ] F272 — severity-filter focus via ref/parent
- [ ] F273 — drop `refreshAllInFlight` ref duplicating state
- [ ] F312 — import core `Theme` (web theme incl 'terminal')
- [ ] F313 — delete web `InputMethod`, import core (3 consumers)

### B13 — apps/docs registry mirror deletion (1) — PASS (uncommitted) · VERIFIED-NO-CHANGE (accepted artifact-sync mirror) · ISOLATED · HIGH BLAST RADIUS
- [x] F94 — verified-no-change (accepted generated artifact-sync mirror; proposed deletion declined because it would regress the build). The 600+ file `apps/docs/registry/` tree is NOT tracked source: it is gitignored (`apps/docs/.gitignore:11` `registry/`) and has 0 files tracked at HEAD and at the pre-batch snapshot (empty `git log`). It is generated output synced from `libs/ui/dist/artifacts` by `apps/docs/scripts/sync-artifacts.mjs` → `@diffgazer/registry` `syncDocsFromArtifacts`; single source of truth = `libs/ui/registry`. The folded dupe F343 was independently classified by the audit (FIX-PLAN.md:9) as an "accepted artifact-sync mirror". The proposed fix ("docs consume `@diffgazer/ui`; delete the mirror") is NOT achievable as-is: `apps/docs/vite.config.ts:71-88` aliases `@/components/ui`→`registry/ui`, `@/hooks`→`registry/hooks`, `@/lib/*`→`registry/lib/*`, and `apps/docs/tsconfig.json:29-45` mirrors these path mappings — docs consumes the mirror AS SOURCE for code display + live demos, and `@diffgazer/ui` package exports do not provide registry source. Deleting the tree without rewiring all aliases would regress the docs build. Coverage = docs build gate + existing `libs/registry/src/testing/docs-sync.test.ts` (sync behavior). No code change, no new regression test (nothing tracked to delete; the mirror is regenerated by `prepare:artifacts`).

### B14 — apps/docs content, types, docs-quality (22)
- [ ] F330 — document 37 public registry items or mark hidden
- [ ] F37 — fumadocs `PageTree` type/adapter
- [ ] F38 — explicit cross-dep SourceFile mapper
- [ ] F165 — inline trivial search-context memo
- [ ] F279 — single env-var source per context
- [ ] F283 — `DEFAULT_REGISTRY_ORIGIN` const + env
- [ ] F87 — regenerate stale registry descriptions
- [ ] F88 — prominent publish-gated callout
- [ ] F89 — post-publication install path primary
- [ ] F207 — fix `useScope` doc link
- [ ] F328 — create keys hooks/guides landing pages
- [ ] F329 — six UI section `index.mdx` pages
- [ ] F39 — guard `console.error` in copy-button
- [ ] F41 — remove pass-through type re-exports
- [ ] F42 — generate/validate `SECTIONS_WITH_INDEX`
- [ ] F168 — `apps/docs/.env.example`
- [ ] F171 — stable section key (no index)
- [ ] F172 — onNavigate primary-click guard
- [ ] F281 — document/replace experimental `useEffectEvent`
- [ ] F398 — bump docs biome `$schema`
- [ ] F400 — scope docs biome includes/excludes
- [ ] F395 — docs bundle-size/Lighthouse/Web-Vitals + lazy demos

### B15 — apps/landing (15)
- [ ] F-landing-a11y-focus — docs link focus indicator
- [ ] F-landing-assets — add/remove missing favicon/og-image
- [ ] F-landing-docs-url — env-driven docs origin
- [ ] F-landing-landmarks — skip link + semantic header/footer
- [ ] F-landing-code-aria — install-command accessible label
- [ ] F-landing-test-types — add `test:types`, include tests
- [ ] F-landing-ui-reuse — adopt `@diffgazer/ui` or document minimal
- [ ] F-landing-tsconfig-strict — match workspace strict flags
- [ ] F-landing-build-emit — `noEmit`, build with vite
- [ ] F-landing-a11y-test — keyboard/landmark/axe assertions
- [ ] F-landing-jsonld — SoftwareApplication/Product JSON-LD
- [ ] F-landing-wrapper — move cosmetic wrapper styles to body/global
- [ ] F-landing-strings — extract shared string constants
- [ ] F-landing-ui-dep — document CSS-only `@diffgazer/ui` dep
- [ ] F-landing-copy-cmd — copy-to-clipboard button

### B16 — apps/hub (7) · DECISION-2
- [ ] F183 — scaffold thin Vite app OR delete package
- [ ] F180 — design-system theme tokens (if scaffold)
- [ ] F182 — fix missing favicon/og-image (if scaffold)
- [ ] F184 — shared `siteLinks` config (if scaffold)
- [ ] F55 — add `"type": "module"` (if scaffold)
- [ ] F185 — fix description vs stub state
- [ ] F355 — remove `.changeset` ignore entry (if delete)

## Stage 2d — repo-wide

### B17 — monorepo scripts, smoke/validate gates, build/tooling (14)
- [ ] F189 — smoke verifies registry dependency closure
- [ ] F310 — copy-mode smoke imports rewritten hook
- [ ] F356 — root `prepare` turbo task de-dupes prelude
- [ ] F397 — root lint config + per-package `check` in CI
- [ ] F366 — extract `resolveAndCollectMissing`
- [ ] F368 — `CommandFailedError` with context
- [ ] F370 — centralize env-var-name literals
- [ ] F371 — `rewriteRegistryUrls` + `createRegistryHandler` factory
- [ ] F372 — `joinLines(...)` helper
- [ ] F374 — `runValidationChecks(checks)` runner
- [ ] F375 — explicit exit-code contract for cleanup scripts
- [ ] F367 — drop redundant console.error before throw
- [ ] F380 — rename `dev-server.ts`→`http-server.ts` (STRUCTURE §Naming)
- [ ] F391 — load/benchmark suite (autocannon/k6) + SLOs

### B18 — governance, docs, env, .github (18)
- [ ] F333 — AGENTS.md boundaries for 5 missing packages
- [ ] F363 — `.env.example` AI provider keys section
- [ ] F360 — `.env.example` shutdown token (optional)
- [ ] F361 — `.env.example` `VITE_API_URL` recommended
- [ ] F364 — `.env.example` docker-compose build args
- [ ] F406 — restructure DEPLOYMENT_PLAN Step 2
- [ ] F403 — README web "public"→"private"
- [ ] F346 — PR template mirrors CONTRIBUTING
- [ ] F348 — dependabot docker cap + group
- [ ] F350 — issue templates link CONTRIBUTING/AGENTS
- [ ] F351 — dependabot commit-message convention
- [ ] F352 — PR template summary depth guidance
- [ ] F353 — dependabot workspace-aware config
- [ ] F408 — governance publish-gate status indicator
- [ ] F410 — CONTRIBUTING per-item validation links
- [ ] F362 — `.env.example` dev/build flags section
- [ ] F365 — `.env.example` `PORT` documented
- [ ] F347 — dependabot major-update group

### B19 — cross-cutting DRY / shared extractions (5) · runs LAST
- [ ] F302 — `escapeForRegex` shared (cli/add + libs/ui + libs/core)
- [ ] F376 — `parsePortEnv`→core (cli/server + cli/diffgazer + core)
- [ ] F383 — `parsePortEnv` configurable variableName (with F376)
- [ ] F194 — `createQueryClientBase`→core (web + cli/diffgazer)
- [x] F315 — shared test-setup util (web + landing). Created `libs/core/src/testing/dom-polyfills.ts` (pure-vitest side-effect module: ResizeObserver + matchMedia + HTMLDialogElement stubs mirroring `libs/ui/test-setup.ts`), exported as `@diffgazer/core/testing/dom-polyfills`. `apps/web` now imports it (replacing its inline RO stub) and `apps/landing` imports it too, so both align on the fuller UI-lib setup. `cleanup` + jest-dom matchers stay per-app by design to keep core free of `@testing-library` deps. Added `@diffgazer/core` to landing devDeps (+lockfile). Verified: scoped 7-pkg type-check green; `@diffgazer/web` test 273/273 (covers RO-dependent tabs/toggle-group) and `@diffgazer/landing` test 7/7. Hub left untouched (outside owned paths and F315's web+landing scope).

---

## Decisions log

- **DECISION-0 (commit policy):** ☑ **No commits — leave all changes uncommitted in the worktree** (user, 2026-05-29). The workflow edits files only; the user reviews `git diff <planning-commit>` and decides what to commit. Validators isolate batches via path-scoped `git diff`.
- **DECISION-1 (keys peer, B2):** ☑ **Option B — optional + lazy import.** Rationale (user, 2026-05-29): do not force consumers to install `@diffgazer/keys`. Convert the ~9 keys-backed components to lazy `import("@diffgazer/keys")` + clear runtime error (figlet contract) + per-component docs + a keys-absent smoke fixture the reviewer must run.
- **DECISION-2 (hub, B16):** ☑ **Option A — scaffold minimal, deployable.** Rationale (user, 2026-05-29): keep hub small so subdomain deploy can be validated; promote to a thin Vite app, no shared-shell extraction.

## Deploy-prep add-ons (outside the 249 — no audit finding ID; absorbed into existing batches)

These are genuine code-side deploy-readiness fixes from `../DEPLOYMENT-ROUTING.md` that have no FIX-PLAN finding ID. They do **not** affect the 249 invariant; they ride in the batch that owns those files.
- [ ] B15 — `apps/landing`: emit static `sitemap.xml` + canonical tag so `robots.txt` stops 404-ing (§3.3–§3.4). Minimal, no shared SEO module.
- [ ] B16 — `apps/hub`: emit static `sitemap.xml` so `robots.txt` resolves (§3.4); add `@diffgazer/hub#build` to `turbo.json`.

Everything else from DEPLOYMENT-ROUTING (shared shell primitives, `libs/core` SEO module, docs static conversion, `deploy.yml` build-model, apex health check, DNS/Coolify/publish) is **deferred or manual** → see `DEPLOY-RUNBOOK.md`.

## Deferrals (record any item intentionally not done, with reason)

- **F196 (B1 → B8): strip `.js` in `libs/core/src`** — blocked while `libs/core` is `NodeNext` (`.js` required). **Must be executed by F319 (B8)** when it flips core to `Bundler`; until then core source is correctly unchanged. B8's F319 scope updated to include this.
- **Test-file `.js` residual (B1, low):** real relative `.js` imports remain in a few **test** files (`libs/keys/src/registry-handoff.test.ts` → `../scripts/*.js`; `libs/ui/registry/lib/testing/resolve-diff-input.test.ts` → `../diff/*.js`). They resolve fine under Bundler and are **not** consumer-facing, so they don't affect the copy/shadcn handoff. Optional consistency cleanup (fold into B20 ui-tests). **Do NOT strip the detector-fixture strings** in `registry-handoff.test.ts` (e.g. `'import { x } from "./utils/x.js"'`) — those are intentional inputs that test the F119/F188 `.js` detector.
