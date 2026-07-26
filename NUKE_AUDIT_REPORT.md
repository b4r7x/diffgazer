# Nuke Audit — Diffgazer Monorepo

**Date:** 2026-07-26 · **Method:** 43-agent workflow (16 Opus 5 finders → per-area adversarial Opus verify → 3 Fable miss-hunters + completeness critic → 4 targeted Opus probes) · **Scope:** all 10 workspaces, 2,682 source files · **Checklists:** code-audit (16 categories), anti-slop pattern catalog, sota-structure measurements, AGENTS.md as the overriding contract.

**Signal integrity:** 355 raw findings → 76 rejected as false positives by adversarial verification → **279 confirmed** (1 critical · 6 high · 64 medium · 208 low). Every confirmed finding carries file:line, quoted evidence, and a concrete fix. Probes were not static: one scaffolded a real Vite app and ran `dgadd add` end-to-end; another ran the full test suite; two parsed the shipped `public/r` payloads.

---

## Outcome — fix run completed (same day)

**278 of 279 findings implemented; 1 skipped on verified merit** (`hunt-core-backend#0` — the base lifecycle hook cannot own session-cache clearing without absorbing surface-specific `mode`/reviewId-precedence concerns; two implementers confirmed the leak independently). Net diff: **~580 files, +3.4k/−5.6k lines**. All six AGENTS.md verification gates green after one repair round: turbo type-check 17/17, turbo test 17/17, `test:scripts` 261/261, strict smoke, `verify:monorepo`, `git diff --check`. Six Fable validators cross-checked every implementer claim against the live diff (7 fixups found and applied).

Owner decisions taken during the run, codified in AGENTS.md: (1) env-gated dev warnings removed from all registry source (shadcn parity; `validateNoBuildEnvReads` + consumer-build e2e guard the ban); (2) CSS suites trimmed to documented-contract assertions (44→34 tests, count/shape snapshots banned).

Watch items, deliberately not fixed: `libs/keys/src/dom/hotkey.ts` reads `NODE_ENV` (legal today — package-compiled, not in the keys copy bundle; becomes the same critical if hotkey ever ships copy-mode); `libs/ui/registry/lib/stepper-variants.ts` shares the single-consumer shape that `horizontal-stepper-variants` was moved home for (labeled in variants.mdx, candidate follow-up).

---

## Executive summary

**This is not a slop repo.** All 17 independent auditors converged on the same picture: zero `as any` outside one justified test cast, zero `@ts-ignore`, zero TODO/FIXME, zero AI-voice vocabulary across ~2,700 files; knip and dependency-cruiser effectively clean; every declared AGENTS.md boundary holds under machine verification; the web/TUI parity contract is real (shared logic genuinely lives in libs/core). Constraint-stating comments appear exactly where hard code needs them — several auditors called it the best comment discipline they would expect to see.

**What it is:** an over-built-in-spots repo with a test-coupling hygiene problem. The confirmed findings cluster into four repeating diseases, not randomness:

1. **Dead code kept alive solely by its own tests** — exports whose only consumer is their unit test (`handleOpenReview`, `toggleFocusArea`, `listReviews`/`listFromIndex`, stream `stop()`, five test-only persistence write paths — **three of which bypass the production file lock**, the one active footgun in the list).
2. **Copy drift at the web/TUI seam** exactly where libs/core stopped one layer too early (catalog fallback notice tripled and already diverging, `describeReviewStartError` bypassed, settings titles duplicated).
3. **Hand-rolled duplication where a helper already exists** (11 store-error blocks in config/settings routers while `handleStoreError` sits one feature over; three byte-identical docs error-boundary classes; four forks of the CSS-contract reader).
4. **Comprehension debt on a handful of hard mechanisms** (`terminal-input.ts`, scroll-area measurement, `lifecycleVersion`, event-sequence WeakMaps, the `useId` reverse-engineering in libs/keys) — all fixable with one sentence each.

The one **critical** finding is real and was proven by execution, not reading: copy-mode registry source references bare `process.env`, so a stock Vite react-ts app fails `pnpm build` immediately after `dgadd add`.

## The Maciek verdict (completeness critic, verbatim)

> He would not land the generic "AI slop" complaint — the usual tells are absent to a degree he'd find suspicious until he checked it himself. His complaints would be specific: (1) "who asked for this?" — the 200-row paging in row-index.ts, the generic `createCollection` factory serving one collection, the tuple-generic machinery in `useActionRowNavigation` with zero real consumers, zod schemas that never parse anything; (2) "your tests are load-bearing walls for corpses" — exports alive only because their own test imports them, and he'd be genuinely angry about the three test-only persistence paths that bypass the cross-process file lock; (3) seam copy-paste (11 store-error blocks, tripled catalog copy, three identical error boundaries); (4) two files as "somebody's kingdom" — the 1,088-line config store and `use-results-keyboard.ts` returning 25 keys; (5) the templated `/** Reads the X context. */` JSDoc across libs/ui contexts. What he would NOT complain about, and would grudgingly praise: the constraint comments on the Ink layout math and focus machinery, the transaction/rollback discipline in cli/add, and the fact that boundaries are enforced by tooling instead of prose. **Verdict: not a slop repo; an over-built-in-spots repo with a test-coupling hygiene problem, roughly two focused cleanup days from having nothing worth raising his voice about.**

## THEME_INIT_SCRIPT — resolved

The owner's canonical "what is this even for" example. Verdict from three independent angles: the mechanism (serialized `themeBootstrap` injected via `ScriptOnce`) is the **industry-standard anti-FOUC bootstrap** (same shape as next-themes and the shadcn TanStack Start guide), and the typed-function-serialization variant is *better* than the usual string blob (type-checked, tested, single source of constants). The documentation debt is already paid — `theme-bootstrap.ts` and `__root.tsx` explain every non-obvious choice. The only contested part is the `MutationObserver` that relabels the theme toggle pre-hydration: the docs auditor and the synthesis both consider its cost (document-wide observer + hydration suppression on a live control) above its benefit (sub-frame-correct label on one chrome control), while the adversarial verifier rejected the finding as "a taste disagreement with a documented trade-off, not a defect" — it is bounded, disconnects on DOMContentLoaded, and the alternative would move accessible text into CSS generated content. **Ruling: not slop. Optional simplification (delete the observer, accept a sub-second default label) if you value less machinery over pre-paint label parity.**

## Scorecard

Scores follow the code-audit rubric (5 = no issues, 4 = lows only, 3 = mediums present, 2 = highs present, 1 = pervasive/critical). Finding density is ~0.1 per file — the volume is dominated by lows.

| Category | Score | Issues |
|---|---|---|
| Architecture & registry contract | 2/5 | 1 critical, 1 high, 5 medium, 3 low |
| Testing | 2/5 | 3 high, 3 medium, 8 low |
| DRY / reusability | 3/5 | 1 high, 19 medium, 24 low |
| Dead code | 3/5 | 1 high, 11 medium, 30 low |
| Comprehensibility | 3/5 | 6 medium, 31 low |
| Over-engineering | 3/5 | 4 medium, 12 low |
| Naming | 4/5 | 3 medium, 19 low |
| YAGNI | 4/5 | 2 medium, 19 low |
| Organization | 4/5 | 2 medium, 13 low |
| Type safety | 4/5 | 3 medium, 8 low |
| Error handling | 4/5 | 3 medium, 5 low |
| SRP | 4/5 | 2 medium, 2 low |
| Anti-slop | 4/5 | 23 low |
| KISS | 4/5 | 5 low |
| Correctness | 4/5 | 1 medium, 1 low |
| React patterns | 4/5 | 4 low (discipline otherwise called exemplary by every auditor) |
| Performance | 4/5 | 1 low |
| **Overall** | **3.5/5 today → ~4.8/5 after the fix plan** | nothing systemic; everything found has a concrete fix |

Structure measurements (sota-structure): 83.5% of basenames at ≤1 hyphen excluding registry compound idiom (elite band is 82–99%); 74 index files, **zero** internal convenience barrels; only one real grab-bag basename; no NestJS dot-segment names; boundaries machine-enforced by dependency-cruiser + knip, both clean.

## Fix plan

Phased so batches are independently landable; pure moves/renames commit separately from logic edits (git rename detection). Gates per AGENTS.md after each phase; full SOTA gate list at the end.

**Phase 0 — Contract breakers (ship-blocking, do first)**
- Copy-mode `process.env` → **owner's final decision: delete the env-gated dev-warning mechanism entirely** (supersedes both the probe's `globalThis` suggestion and the interim `dev-mode.ts` retyping plan). Rationale: env-gated warnings are a `node_modules` idiom (React/Radix/MUI ship them inside packages consumers never type-check or read); the copy-paste ecosystem norm set by shadcn is zero `process.env`/`console.warn` in copied source, with misuse diagnostics as hard throws on wiring errors only. Since Diffgazer's copy mode ships the primitives themselves, the warnings and their machinery are removed (all 8 sites + `warn-unregistered-value.ts` + its callers); hard context-guard throws stay. Two permanent gates prevent recurrence: an env-agnosticism check in `validate-registry-metadata` (rejects `process.env`/`import.meta.env`/`NODE_ENV` anywhere in registry source) and the consumer-build e2e in `cli/add/testing/e2e` (type-checks copied output under stock Vite `types: ["vite/client"]` and asserts zero `process.env` occurrences). Rule codified in AGENTS.md → UI Library Rules. [critical]
- Remove stale `class-variance-authority` deps from 5 registry items, regenerate `public/r`, make the cva gate bidirectional and generic over all `dependencies`, delete the one-off regression test it obsoletes. [2 high]
- Unify the relative-`.js` writer and validation gates on one lexer-backed predicate (`findRelativeJsSpecifiers`); fix the line-scan hole in the copy-contract test. [high]
- Gate: `pnpm run prepare:artifacts && pnpm run validate:artifacts:check`, `pnpm --filter @diffgazer/ui type-check`, cli/add e2e.

**Phase 1 — Test integrity**
- Write `remove/dependencies.test.ts` for the cascade/block contract AGENTS.md names. [high]
- Fix the `q`-shortcut mock factory (add `reportShutdownResult`) in 3 files + assert the second half of the contract. [high]
- Dedup the 4 CSS-contract reader forks into `registry/testing/css-contract.ts`. [high]
- config-guards mock fix; landing line-breaking assertion helper. [medium]

**Phase 2 — Dead code & test-only exports**
- Server: delete 5 test-only persistence paths (file-lock bypass footgun), `listReviews`/`listFromIndex`, orchestrate double-resolution, unread `OrchestrationOutcome` fields, test-only exports; retarget tests at shipped paths.
- Web/TUI: `use-config` dead context fields, `onIssueNav`, `handleOpenReview`, `toggleFocusArea`, `cleanupEarlySave`, dead tokens in theme-overrides.css.
- UI: `useOptionalSidebarSectionContext`, `FloatingPlacement`, `lineCount` (+ regenerate public/r).
- Tooling: refresh depcruise no-orphans allowlist.

**Phase 3 — DRY / seam consolidation**
- Into libs/core: `getCatalogFallbackNotice`, `describeReviewStartError` adoption in web, `SETTINGS_SCREEN_COPY`, keys-dependency prefix constant.
- Server: move `handleStoreError` to `shared/lib/http`, replace 11 hand-rolled blocks; add 415 to `ErrorStatus`.
- Docs: one shared `ErrorBoundary`; `FOCUS_RING_CLASS`/`CHROME_LABEL_CLASS` adoption; compose `@diffgazer/ui` Breadcrumbs.
- Registry/examples: collapse per-variant example copies (sidebar ×5, dialog ×3, stepper ×5); `Omit`-based command-factory configs; core test wrappers; OSC drain extraction; `failStartup` closure; `--font-mono` token unification.

**Phase 4 — Over-engineering removals**
- row-index: flat `matchingRows` + `firstRow` replaces 200-row paging (~120 lines + tests).
- `createCollection` → concrete `reviewStore`; delete unused generic surface.
- `useActionRowNavigation`: adopt the tuple feature or delete the machinery (5 casts, zero consumers).
- sidebar-chrome spinner guard → one requestId ref; `useFocusZone` single validated zone. [correctness]

**Phase 5 — Comprehensibility pass (~37 one-sentence fixes)**
- File headers/comments stating the constraint: `terminal-input.ts`, scroll-area measurement, `useId` decode in libs/keys, `lifecycleVersion`, rekey invariant, the config-store four-state machine name, code-block symbol registry, callout.css header truth, code-block.css passthrough rule, `raw-imports.d.ts`, ssr/ split (TESTING.md).
- Error-message honesty: `dgadd diff` noun, unowned-vs-modified skip reason, figlet error cause.

**Phase 6 — Structure & naming (pure-move commits first)**
- `progress/` → `progress-list/`; `ssr/` dirs → `*.ssr.test.tsx` + vitest globs; keys playground tests → examples; `models-dev-sample.ts` → test root; gitignore `libs/keys/artifacts/artifacts/` and decide the workspace's fate; TUI `Tabs onValueChange` → `onChange`; renames: `use-dialog-focus-trap` → `use-dialog-zones`, `run-mapping` → real name, `model-search-input` basename, dissolve `command-factories/shared.ts`.

**Phase 7 — Low sweep (optional, ~150 remaining lows)**
- Dead guards, aliases, pass-through wrappers, templated context JSDoc across libs/ui. Mechanical; safe to batch by package.

**Final gates:** `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check` · `…turbo run test` · `pnpm run test:scripts` · `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` · `pnpm run verify:monorepo` · `git diff --check`.

## Audit gaps the critic closed (probe results)

1. **Static-only audit** → probe ran the full suite: found the `q`-shortcut test passing while its handler throws.
2. **dgadd never executed** → probe scaffolded a real Vite app: found the critical copy-mode build failure + 2 UX-honesty issues.
3. **1,666 lines of registry CSS deferred** → probe audited rule-by-rule: found token drift, a false header contract, dead-looking rules needing notes.
4. **`public/r` payloads excluded** → probe parsed them: found 5 stale npm deps + the one-directional gate that let them ship.

## SOTA rationale

**Skills applied:** code-audit, anti-slop (+ pattern catalog), sota-structure (+ measured audit procedure), clean-code, code-quality, sota. **Models:** Opus 5 for find/verify/probe waves, Fable 5 for miss-hunting and the completeness critic (per cost directive). **Verification:** every wave-1/wave-2 finding passed adversarial per-area verification (default-reject, evidence re-read, rg-verified dead-code claims); probes self-verified by execution. **Known limits:** low findings were verified but not individually re-probed; the four `no-orphans` depcruise warnings were confirmed false positives.

---

# Full findings


## CRITICAL

### `libs/ui/registry/hooks/use-controllable-state.ts:38` — Copy-mode installed source references bare `process.env`, so a stock Vite+React+TS app fails `pnpm build` right after `dgadd add`

**Category:** architecture · **Source:** probe1

**Why:** AGENTS.md (UI Library Rules) requires "Direct shadcn/copy consumers must receive source that builds without unpublished package-only assumptions." The canonical Vite react-ts template pins `"types": ["vite/client"]` in tsconfig.app.json, so `process` is undeclared. I scaffolded a real `pnpm create vite --template react-ts` app, ran `dgadd init --yes` then `dgadd add ui/select ui/dialog --integration copy`, and `pnpm run build` (`tsc -b && vite build`) exits 2 with 5 × TS2591 "Cannot find name 'process'" in files dgadd itself wrote: dialog-content.tsx(222,9), select-content.tsx(134,49), use-select-state.ts(297,22), portal.tsx(40,29), use-controllable-state.ts(38,9). Nothing in the docs or init output tells the consumer to add @types/node. This is the first thing a cold reviewer hits after a 60-second install.

```
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (wasControlledRef.current !== isControlled) {
```

**Fix:** Replace every bare `process.env.NODE_ENV` in copy-distributed registry source with an ambient-free read that type-checks with DOM-only lib. Verified working in the probe app: `const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;` then compare `env?.NODE_ENV`. Best done once as a `libs/ui/registry/lib/dev-mode.ts` export (`isDevMode()`) consumed by all 8 sites: hooks/use-controllable-state.ts:38, ui/shared/portal.tsx:40, ui/select/select-content.tsx:134, ui/select/use-select-state.ts:297, ui/tabs/tabs.tsx:154, ui/menu/menu.tsx:232, ui/dialog/dialog-content.tsx:222, lib/warn-unregistered-value.ts:15. Add an e2e assertion in cli/add/testing/e2e that copied output type-checks under `types: ["vite/client"]`, or the regression returns silently (libs/ui's own tsconfig has node types, so CI stays green).

**Verifier:** self-verified probe: The dgadd CLI was audited by reading, never by running


## HIGH

### `cli/add/src/commands/remove/dependencies.ts:61` — Cascade-orphan / blocked-dependent removal logic has no test file at all

**Category:** testing · **Source:** add-registry#0

**Why:** AGENTS.md names this exact behavior a contract ("`dgadd remove` must respect ownership metadata and must not remove copied shared dependencies still needed by retained installed items"), yet `expandRemoval`/`dependentsOf` — a fixpoint loop plus a keys-vs-ui dependent scan — is the only remove module with no test. The `blocked` path is tested only in libs/registry with an injected stub `expandRequestedNames`, so the real implementation's cascade and block decisions are unverified.

```
export function expandRemoval(cwd: string, requestedNames: string[]): ExpansionPlan {
  const manifest = loadManifest(cwd);
  const manifestAbsent = Object.keys(manifest).length === 0;
```

**Fix:** Add `cli/add/src/commands/remove/dependencies.test.ts` covering: (a) a transitive whose only dependent is also being removed cascades out, (b) a transitive still needed by a retained item is not cascaded, (c) an explicitly requested item with retained dependents lands in `blocked` and is dropped from `toRemove`, (d) a copy-mode `keys/*` hook is treated as a dependency of its `ui/*` owner but a package-mode one is not, (e) the `manifestAbsent` branch still returns the requested names.

**Verifier:** Verified: cli/add has no test touching expandRemoval/dependentsOf (remove.test.ts covers only the workflow context and transaction-file resolution; the libs/registry workflow tests inject a stub expandRequestedNames), so the fixpoint cascade and the blocked-dependent guard that decide which user files get deleted are entirely unexercised despite AGENTS.md naming that behavior a contract.

### `apps/web/src/app/help-shortcuts.integration.test.tsx:52` — The only test covering the global 'q' Quit shortcut passes while the handler under test throws mid-execution

**Category:** testing · **Source:** probe0

**Why:** The mock factory omits `reportShutdownResult`, so `handleQuit`'s `.then(reportShutdownResult)` throws at global.tsx:103 the moment it dereferences the missing export. `@diffgazer/keys` catches handler errors into `console.error` (libs/keys/src/providers/keyboard.tsx:198-200), so the test still passes: `shutdown()` is evaluated before the throw, satisfying `expect(mockShutdown).toHaveBeenCalledOnce()`. The test is named "'q' backs 'Quit' with live behavior" but half that live behavior — reporting the shutdown result to the toast surface — is never exercised, and every full test run emits a permanent error line into CI logs.

```
vi.mock("@/lib/shutdown", () => ({ shutdown: mockShutdown }));
// global.tsx:103 -> void shutdown().then(reportShutdownResult);
// run output: [@diffgazer/keys] Handler error for "q": Error: [vitest] No "reportShutdownResult" export is defined on the "@/lib/shutdown" mock.
```

**Fix:** Add the missing export to the factory — `vi.mock("@/lib/shutdown", () => ({ shutdown: mockShutdown, reportShutdownResult: mockReportShutdownResult }))` — and assert the second half of the contract: `await waitFor(() => expect(mockReportShutdownResult).toHaveBeenCalledWith({ status: "closed" }))`. The same incomplete factory exists at apps/web/src/app/router.test.tsx:30-32 and apps/web/src/components/layout/global-shortcuts.test.tsx:15; neither presses 'q' today, so neither throws yet, but both should get the same export so the next 'q' test does not silently repeat this. Separately, consider whether the keys provider should rethrow in test/dev instead of only console.error-ing, since that swallow is what let this pass.

**Verifier:** self-verified probe: Nobody executed the verification gates — the entire audit was static

### `libs/ui/registry/ui/command-palette/command-palette.css.test.ts:40` — Four forked copies of the brace-matching CSS-block reader that libs/ui/registry/testing/css-contract.ts already exports

**Category:** dry · **Source:** probe2

**Why:** The shared helper is documented as THE reader for CSS contracts and explicitly warns that a non-brace-matching body scan silently truncates rules that contain nested blocks. Three suites re-implement it anyway, and the command-palette fork reintroduces exactly that bug with `[^}]*`. Any future rule with a nested block will make its assertions pass on text the reader never saw.

```
  function ruleBody(selectorFragment: string, options?: { atRule?: string }): string | null {
    const match = source.match(
      new RegExp(`${whitespaceTolerant(selectorFragment)}\\s*\\{([^}]*)\\}`),
```

**Fix:** Add the whitespace-tolerant selector escaping (the only real reason for the fork) to `libs/ui/registry/testing/css-contract.ts`, then delete the local readers in `command-palette.css.test.ts:16-47`, `diff-view.css.test.ts:19-33` (`scope`), `shared/dialog.css.test.ts:16-28` (`block`), and `shared/overlay-hints.css.test.ts:16-28` (`scope` — byte-identical to dialog's modulo the function name) and import `ruleBody`/`atRuleBody` as `code-block.css.test.ts`, `sidebar.css.test.ts`, and `floating-panel.css.test.ts` already do.

**Verifier:** self-verified probe: 1,666+ lines of registry CSS were explicitly deferred and never audited

### `libs/registry/src/imports/relative-js-imports.ts:17` — The relative-.js writer and the validation gate use different matchers with different semantics, and the docstring claims otherwise

**Category:** architecture · **Source:** probe3

**Why:** `stripRelativeJsExtensions` (the writer) rewrites only executable import specifiers via the lexer, while `RELATIVE_JS_IMPORT_RE` (used by all three gates) is a raw-text regex. The two disagree in both directions, so the gate can fail on content the writer refuses to touch (unfixable red build) and can pass content the writer would have rewritten (broken specifier ships). The JSDoc asserting it is "the union of every form the registry writers and the validate-artifacts gate must catch" is false — no writer uses it.

```
export const RELATIVE_JS_IMPORT_RE =
  /((?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+(?=["']))(["']))(\.{1,2}\/[^"']+)\.js\2/g;
```

**Fix:** Delete `RELATIVE_JS_IMPORT_RE` and give the three gates a lexer-backed predicate from the same module (e.g. `findRelativeJsSpecifiers(content): string[]` built on `extractImportSpecifierRanges`), so writer and gate are one definition by construction. I verified all four divergences empirically with a throwaway vitest file in libs/registry/src/imports (all 4 assertions passed): (1) `// re-export from "./legacy.js"` — writer no-op, gate fails; (2) `const msg = 'run: import "./x.js"'` — writer no-op, gate fails; (3) ``await import(`./lazy.js`)`` — writer rewrites to `./lazy`, gate passes; (4) `export{a}from"./a.js"` — writer rewrites, gate passes (regex needs `\s+` after `from`). Cases 3-4 are live holes in libs/ui/scripts/registry/public-registry-copy-contract.test.ts, which validates committed content without ever running the writer; that test additionally scans line-by-line, so a specifier wrapped as `} from\n  "./x.js"` is invisible to it.

**Verifier:** self-verified probe: The committed public/r payloads were excluded from every agent's scope, and a confirmed finding says the gate that guards them diverges from the writer

### `libs/ui/registry/registry.json:239` — Five shipped registry items declare an npm dependency (class-variance-authority) that nothing in their closure imports

**Category:** dead-code · **Source:** probe3

**Why:** `dependencies` is the install instruction copy/dgadd consumers receive. `callout`, `code-block`, `horizontal-stepper`, `tabs`, and `toggle-group` declare `class-variance-authority` but no file in any of them contains the string `class-variance-authority` or `cva(` — verified by `rg -n 'class-variance-authority|cva\(' libs/ui/registry/ui/<name>/` returning nothing for all five, and by parsing the shipped `libs/ui/public/r/*.json` payloads. For `callout` nothing in its transitive registryDependency closure imports cva either; for the other four the closure member that does (`scroll-area`, `horizontal-stepper-variants`, `segmented-variants`) already declares it itself.

```
"name": "callout",
...
"dependencies": ["class-variance-authority"],
```

**Fix:** Remove the `class-variance-authority` entry from `callout` (registry.json:239), `tabs` (:1011), `toggle-group` (:1373), `code-block` (:1414), and `horizontal-stepper` (:1510), then regenerate `libs/ui/public/r/{callout,code-block,horizontal-stepper,tabs,toggle-group}.json` (each carries it at line 6). This exact bug was already found and fixed once for `overflow`, but the fix was a hardcoded one-off regression test naming that single item (libs/ui/scripts/registry/registry-metadata-contract.test.ts:72-86) rather than a gate, so five siblings still ship it.

**Verifier:** self-verified probe: The committed public/r payloads were excluded from every agent's scope, and a confirmed finding says the gate that guards them diverges from the writer

### `libs/ui/scripts/validate-registry-metadata.ts:260` — The cva dependency gate only checks one direction, so stale declarations can never be caught

**Category:** testing · **Source:** probe3

**Why:** The validator errors when an item imports cva and omits it from `dependencies`, but never when an item declares cva and does not import it. That asymmetry is why the five stale declarations above survived, and why the previous occurrence had to be patched with an item-name-specific test instead of a rule.

```
if (
  itemSourceContains(item, "class-variance-authority") &&
  !item.dependencies?.includes("class-variance-authority")
) {
```

**Fix:** Make the check bidirectional — also `errors.push(...)` when `item.dependencies?.includes("class-variance-authority") && !itemSourceContains(item, "class-variance-authority")` — and generalise it over every entry in `item.dependencies` using `extractImportSpecifiers` (already imported at line 3) rather than a substring scan for one hardcoded package name. Then delete the `describe("stale dependency metadata removed")` block at libs/ui/scripts/registry/registry-metadata-contract.test.ts:72-86, which the gate makes redundant.

**Verifier:** self-verified probe: The committed public/r payloads were excluded from every agent's scope, and a confirmed finding says the gate that guards them diverges from the writer


## MEDIUM (64)


### dry (19)

- **`cli/diffgazer/src/features/providers/components/model-select-overlay.tsx:256`** — Catalog fallback-notice copy and branching duplicated in three places, already drifting _( tui-features#2 )_
  **Why:** The identical source→copy branch exists at model-select-overlay.tsx:254-259, onboarding/components/steps/model-step.tsx:67-72, and apps/web/src/lib/catalog-fallback-notice.ts:17-20. That is 3 occurrences, and they have already diverged: web formats `fetchedAt` via `formatFetchTime`, both TUI copies interpolate the raw ISO string. Per AGENTS.md, `libs/core` already owns exactly this class of shared copy (`getNoChangesCopy`, `getApiKeyMissingCopy`, `sessionTerminationCopy`).
  **Fix:** Move the branch into `libs/core` (e.g. `@diffgazer/core/providers` → `getCatalogFallbackNotice({ source, fetchedAt })`, formatting the timestamp once), then have both TUI sites and apps/web/src/lib/catalog-fallback-notice.ts call it and delete their local copies.

- **`cli/diffgazer/src/lib/servers/embedded.ts:97`** — Four copies of the same startup-failure tail inside createEmbeddedServer _( tui-shared#2 )_
  **Why:** The identical 5-line sequence (set state idle, log, notify onFailure, rejectStartup) appears at lines 97-101, 108-113, 164-174 and 177-181; two of them are byte-identical. Any change to failure reporting has to be made in four places and it is easy to miss one, which is how `state` gets left inconsistent.
  **Fix:** Extract a single closure `function failStartup(message: string, cause?: unknown): void` that sets `state = "idle"`, logs, calls `config.onFailure?.(message)` and calls `rejectStartup(new Error(message, cause ? { cause } : undefined))`, and call it from all four sites.

- **`cli/diffgazer/src/testing/capture-review-frames.tsx:21`** — CaptureOutput/CaptureInput are a verbatim rename of TestOutput/TestInput in render-root-frame.tsx _( tui-shared#9 )_
  **Why:** Both class bodies (~35 lines total) and the `debug/exitOnCtrlC/patchConsole` render-options block are identical to `testing/render-root-frame.tsx:9-44`; only the class names differ. `render-root-frame.tsx` is already the shared testing helper in the same folder, so the copy has no reason to exist.
  **Fix:** Export `TestOutput`/`TestInput` from `testing/render-root-frame.tsx` (or move them to a small `testing/ink-streams.ts`) and import them in `capture-review-frames.tsx`, keeping only the provider stack that genuinely differs.

- **`apps/docs/src/components/docs-mdx/page.tsx:25`** — Three byte-identical React error-boundary classes copy-pasted across docs _( docs-landing#0 )_
  **Why:** `MdxContentErrorBoundary` (page.tsx:25), `LegalContentErrorBoundary` (features/legal/components/page-layout.tsx:17) and `DemoPreviewErrorBoundary` (components/demo-preview.tsx:48) have identical generics, identical `state`, identical `getDerivedStateFromError`, and identical `render` shape — only the fallback JSX differs. Three occurrences is the repo's own extraction threshold, and a class component is exactly the kind of boilerplate a reader should meet once.
  **Fix:** Add one `components/shared/error-boundary.tsx` exporting `<ErrorBoundary fallback={ReactNode}>` with that exact body, and replace the three classes with `<ErrorBoundary fallback={<TuiFaultPanel …/>}>`. Keep the `key={path}` / `key={panelLabel}` remount behaviour at the call sites.

- **`apps/docs/src/components/layout/theme-toggle.tsx:5`** — Focus-ring recipe redeclared locally although the shared constant it copies is imported by six sibling files _( docs-landing#2 )_
  **Why:** `components/shared/focus-ring.ts` exists precisely so "the keyboard focus ring stays one consistent 2px offset outline instead of drifting into per-element variants", and command-row, status-bar, footer-bar, search dialog, registry-directory and session-panel all import `FOCUS_RING_CLASS`. theme-toggle redeclares the identical string; tui-bracket-link.tsx:8 and docs-mdx/blocks/api-reference.tsx:71 inline it too. That is three places the shared recipe can silently drift.
  **Fix:** Import `FOCUS_RING_CLASS` from `@/components/shared/focus-ring` in theme-toggle.tsx, tui-bracket-link.tsx (compose it into `BRACKET_LINK_CLASS` with `cn`), and api-reference.tsx; delete the three literal copies.

- **`apps/landing/src/effects/gaze.ts:61`** — Severity-chip DOM built by hand in four places across three landing effects _( docs-landing#9 )_
  **Why:** `gaze.ts:61-64`, `findings.ts:21-24`, `findings.ts:76-81` and `pipeline.ts:70-73` each create a span, set `sev sev-<severity>`, set textContent and append. The `fd-tag` chip is duplicated between gaze.ts and findings.ts on top of that. Four copies of the same markup contract means a class rename has to be found in three files.
  **Fix:** Add a tiny DOM helper next to `demo.ts` — `export const el = (tag: string, className: string, text: string) => { … }` and `export const severityChip = (f: DemoFinding) => el("span", `sev sev-${f.severity}`, f.severity)` — and use them in all four sites. That also removes the ~12 other create/className/textContent triples in these three files.

- **`cli/server/src/features/config/router.ts:53`** — The same 7-line store-error response block is copy-pasted 11 times across config/settings routers while the helper for it already exists _( server#0 )_
  **Why:** `features/review/errors.ts` already defines exactly this as `handleStoreError(ctx, error)`. config/router.ts repeats the literal block 8 times and settings/router.ts 3 more — 11 sites that must all be edited together if the error envelope ever changes.
  **Fix:** Move `handleStoreError` from `features/review/errors.ts` to `shared/lib/http/store-error.ts` (next to `storeErrorStatus`), widen its param to `AppError<StoreHttpErrorCode>` so it accepts SecretsStorageError and ConfigServiceErrorCode, then replace all 11 blocks with `return handleStoreError(c, result.error);`.

- **`libs/registry/src/build-checks/dist-keys.ts:3`** — The `@diffgazer/keys` registry-dependency prefix pair is redefined in three places inside this scope (and more outside) _( add-registry#1 )_
  **Why:** The same two-element prefix list is the parsing contract for every keys registry dependency. It is declared twice as a private const and open-coded a third time as inline string literals, in different orders. Adding or renaming a namespace prefix silently fixes one code path and breaks the others.
  **Fix:** Export a single `KEYS_REGISTRY_DEPENDENCY_PREFIXES` (and a `parseKeysDependencyRef` helper) from `@diffgazer/registry/schemas`, then have `dist-keys.ts`, `cli/add/src/commands/add/integration.ts`, and `cli/add/src/utils/keys-copy-bundle.ts` import it. `libs/ui/scripts/registry/fs.ts` and `libs/ui/scripts/build-docs-data.ts` carry the same const and should follow.

- **`libs/registry/src/cli/command-factories/remove.ts:11`** — Command factories re-declare their workflow's options interface and forward it field-by-field _( add-registry#2 )_
  **Why:** `RemoveCommandConfig` is exactly `Omit<RunRemoveWorkflowOptions, "cwd"|"names"|"yes"|"dryRun"|"force">` — 15 members typed twice — and `buildRemoveAction` then copies all 15 across by hand. `DiffCommandConfig`/`buildDiffAction` is the same pattern. Adding one workflow option means editing three places, and a forgotten line in the forwarding block silently drops a caller's callback with no type error.
  **Fix:** Define `export type RemoveCommandConfig<TItem, TConfig> = Omit<RunRemoveWorkflowOptions<TItem, TConfig>, "cwd" | "names" | "yes" | "dryRun" | "force">` and call `runRemoveWorkflow({ ...config, cwd, names, yes: opts.yes ?? false, dryRun: opts.dryRun ?? false, force: opts.force ?? false })`. Apply the same to `command-factories/diff.ts` (`Omit<RunDiffWorkflowOptions, "cwd" | "requestedNames" | "renderChangedFile">`).

- **`libs/core/src/api/hooks/review.test.ts:12`** — Four core hook tests hand-roll `makeWrapper` although `createTestQueryWrapper` ships in the same package _( core#0 )_
  **Why:** `libs/core/src/testing/query-wrapper.ts` already provides exactly this wrapper (and is a public `./testing/query-wrapper` subpath used by `config.test.ts:25` and `use-review-stream.test.ts:31`). Four sibling files copy the same 8-line QueryClientProvider+ApiProvider composition, so any change to the test harness (e.g. mutation retry defaults) has to be made in five places.
  **Fix:** Delete the local `makeWrapper` in `api/hooks/review.test.ts:12`, `api/hooks/server.test.ts:12`, `api/hooks/trust.test.ts:14`, and `api/hooks/use-trust-editor.test.ts:25`; use `createTestQueryWrapper({ api })` which already returns `{ Wrapper, queryClient, api }` (covers both the shared-client and own-client cases these copies handle).

- **`libs/core/src/review/sanitize-terminal.ts:44`** — The OSC drain loop is copy-pasted between the ESC-introduced and C1 paths of a security parser _( core#9 )_
  **Why:** Lines 44-58 (ESC `]`) and 84-97 (C1 `0x9d`) are byte-for-byte the same BEL / ST / ESC-`\` termination scan. This file neutralizes terminal-escape injection (CWE-150) in model-supplied text; a fix applied to one copy and not the other is a security regression that the type system cannot catch.
  **Fix:** Extract `function consumeOsc(input: string, start: number): number` next to the existing `consumeCsi`, and call it from both the `next === 0x5d` branch and the `code === 0x9d` branch.

- **`libs/ui/registry/ui/avatar/use-image-status.ts:29`** — useImageStatus preloads with `new Image()` while both call sites already render a real <img> with the same handlers _( ui-comp-a#2 )_
  **Why:** AvatarImage and AvatarFallback are the only consumers, and both render an `<img src={src} onLoad={onLoad} onError={onError}>` that already drives the identical state transitions. The preloader duplicates the fetch and the state machine for no added signal — and the one value it exists to produce, `status`, is never destructured by either consumer (they take only `showImage`, `onLoad`, `onError`).
  **Fix:** Delete the preloader effect and the unused `status` field from the return object. Keep the render-derived status used by `showImage` plus the `onLoad`/`onError` setters that the rendered <img> already calls.

- **`libs/ui/registry/examples/sidebar/sidebar-variant-caret.tsx:14`** — Five sidebar per-variant examples are 50-line copies whose only real diff is the variant prop _( ui-docs-examples#2 )_
  **Why:** sidebar-variant-{caret,inverted,bar,terminal,tree}.tsx differ from each other by 2-4 lines (the `variant` value and which item carries `active`). They duplicate the same nav tree five times, and sidebar-variants.tsx already renders exactly this nav through a ToggleGroup over all five variants, so the axis is documented twice.
  **Fix:** Keep sidebar-variants (the switcher, already used by libs/ui/docs/content/components/sidebar.mdx) plus at most one static variant example that shows something the switcher cannot (tree connectors). Delete the remaining sidebar-variant-* files and drop their entries from sidebarDoc.examples and sidebar-examples-mobile.test.tsx.

- **`libs/ui/registry/examples/dialog/dialog-viewfinder-outset.tsx:17`** — Three dialog viewfinder examples are byte-identical apart from the corners value _( ui-docs-examples#3 )_
  **Why:** `diff dialog-viewfinder.tsx dialog-viewfinder-outset.tsx` reports only the function name and `corners=`; the -subtle copy adds one more line. That is three 38-line files for one enum, while dialog-sizes.tsx already shows the in-repo pattern of mapping a prop axis inside a single example.
  **Fix:** Collapse dialog-viewfinder, dialog-viewfinder-subtle and dialog-viewfinder-outset into one `dialog-corners` example that maps `["subtle","standard","outset","bold"]` the way dialog-sizes.tsx maps sizes, and replace the four entries in dialogDoc.examples with one.

- **`apps/web/src/features/review/hooks/use-lifecycle.ts:220`** — Web review lifecycle hand-rolls review-start error copy instead of calling the shared describeReviewStartError, losing every code-specific message _( xcut-dry#0 )_
  **Why:** libs/core/src/review/presentation/error-guidance.ts:45 owns describeReviewStartError and emits the exact same fallback strings ("Failed to Start Review" / "Could not create a review session."). The TUI (cli/diffgazer/src/features/review/hooks/use-lifecycle.ts:171) and web home (apps/web/src/features/home/components/presentation.tsx:139) both call it; only this call site reimplements it, so API_KEY_MISSING, UNSUPPORTED_PROVIDER, MODEL_ERROR and KEYRING_READ_FAILED silently lose their titles and their "Add one in Settings → Providers" / "Check Settings → Storage" guidance on the web mode-switch path.
  **Fix:** Replace both lines with `const { title, message } = describeReviewStartError(error); toast.error(title, { message });` and add `describeReviewStartError` to the existing `@diffgazer/core/review` import block at the top of the file (it is already exported from libs/core/src/review/index.ts:79).

- **`cli/diffgazer/src/features/providers/components/model-select-overlay.tsx:254`** — Catalog fallback notice is built in three places; the two TUI copies print a raw ISO timestamp the web helper formats _( xcut-dry#1 )_
  **Why:** apps/web/src/lib/catalog-fallback-notice.ts:12-23 already names this branch (source === "cache" | "snapshot") and formats fetchedAt via getDateLabel/getTimestamp. The two TUI sites inline the identical branch with the identical strings but interpolate `fetchedAt` raw, and useModelSource returns it as the unformatted ISO string from ProviderModelsResponse — so the terminal renders "Using cached catalog data from 2026-07-26T10:31:02.145Z." while the browser renders a readable time.
  **Fix:** Move getCatalogFallbackNotice (and its formatFetchTime helper) into libs/core/src/catalog/ — core already owns catalog presentation and exports getDateLabel/getTimestamp from `@diffgazer/core/format`. Export it from libs/core/src/catalog/index.ts, then delete apps/web/src/lib/catalog-fallback-notice.ts and replace the inline blocks at cli/diffgazer/src/features/providers/components/model-select-overlay.tsx:254-259 and cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx:67-72 with `const fallbackNotice = getCatalogFallbackNotice(source, fetchedAt);`.

- **`apps/web/src/features/settings/components/storage/page.tsx:37`** — Settings screen titles and subtitles are duplicated verbatim between apps/web and cli/diffgazer even though the analysis screen already shares its subtitle through libs/core _( xcut-dry#4 )_
  **Why:** apps/web and cli/diffgazer mirror the same settings slices and must stay in copy parity, and the repo already established the pattern: ANALYSIS_SETTINGS_SUBTITLE lives in libs/core/src/schemas/review/lens-selection.ts:5 and both surfaces import it. Storage and Agent Execution instead hardcode both strings on both sides, so a copy edit silently applies to one surface only. Same class: "Analysis Settings" (web analysis/page.tsx:44 vs TUI analysis-screen.tsx:59), "Failed to save settings" (web use-settings-form-actions.ts vs TUI storage-screen.tsx:44).
  **Fix:** Add SETTINGS_SCREEN_COPY (title + subtitle per screen) next to SECRETS_STORAGE_OPTIONS/AGENT_EXECUTION_OPTIONS in libs/core/src/schemas/config/settings-options.ts, fold ANALYSIS_SETTINGS_SUBTITLE into it, and consume it from apps/web/src/features/settings/components/storage/page.tsx:37-38, cli/diffgazer/src/features/settings/components/storage-screen.tsx:52-53, apps/web/src/features/settings/components/agent-execution/page.tsx:56-57 and cli/diffgazer/src/features/settings/components/agent-execution-screen.tsx:57-58.

- **`apps/docs/src/features/home/components/session-panel.tsx:131`** — Five docs files inline the chrome-label recipe with a hardcoded text-2xs, silently opting out of CHROME_LABEL_CLASS's documented mobile step-up _( xcut-dry#6 )_
  **Why:** CHROME_LABEL_CLASS (apps/docs/src/components/shared/chrome-label.ts:9) is `font-mono text-xs uppercase tracking-widest text-muted-foreground md:text-2xs` and its docstring states "Below md the label steps up a type size for mobile legibility". Thirteen files import it; these five re-type the same recipe with a fixed text-2xs, so their labels stay at the smallest step on phones. session-panel.tsx imports the constant elsewhere in the same file and still inlines this variant, so it is drift rather than a deliberate opt-out.
  **Fix:** Replace the inlined recipe with CHROME_LABEL_CLASS in apps/docs/src/features/home/components/session-panel.tsx:131, apps/docs/src/components/page-layout.tsx:92, apps/docs/src/components/layout/tui-bracket-link.tsx:8, apps/docs/src/features/home/components/registry-directory.tsx:76 and apps/docs/src/features/search/components/dialog.tsx:189. If any site genuinely must stay at a fixed text-2xs, export a second named constant from chrome-label.ts rather than re-typing the string.

- **`libs/ui/registry/ui/callout/callout.css:36`** — Callout is the only registry CSS file reading --font-mono; its three siblings read --base-font-mono, and the two token stacks have drifted _( probe2 )_
  **Why:** A copy-mode consumer that installs Callout plus CodeBlock gets two different mono fallback chains. The two stacks are maintained independently — theme.css:38 has "SF Mono" and no Monaco/Courier New; theme-base.css:248 has Monaco and "Courier New" and no "SF Mono" — plus a third hardcoded chain inlined as the var() fallback in code-block.css and diff-view.css.
  **Fix:** Pick one token for component CSS. Simplest: make the Tailwind `@theme` entry derive from the primitive (`--font-mono: var(--base-font-mono);` at theme-base.css:248) so the stack exists once at theme.css:38, then change callout.css:36 to `var(--base-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)` to match code-block.css:30,122 and diff-view.css:102.


### dead-code (11)

- **`apps/web/src/hooks/use-config.tsx:22`** — `providerStatusLoadState` is a dead context field kept alive only by its own test _( web-shared#0 )_
  **Why:** The field, its dedicated `ProviderStatusLoadState` union, its `useMemo`, and its slot in the context dep array exist purely so `use-config.test.tsx` can render it — no feature reads it. It inflates the app's central context and makes every reader wonder which of three loading signals (`loadState`, `providerStatusLoadState`, `isLoading`) is the real one.
  **Fix:** Delete the `providerStatusLoadState` field (lines 22, 78-82, 127, 142), the `ProviderStatusLoadState` type (lines 41-44), and the `<p>Provider status load: …</p>` assertion in `use-config.test.tsx:71`. Re-add only when a screen actually needs provider-status load state.

- **`cli/diffgazer/src/features/review/hooks/use-keyboard.ts:4`** — useReviewKeyboard's onIssueNav option and its j/k branches are dead — the only consumer never passes it _( tui-features#0 )_
  **Why:** `ReviewResultsView` is the sole call site (results-view.tsx:77) and passes only onZoneSwitch/onTabSwitch/onBack. j/k navigation is actually owned by IssueListPane (issue-list-pane.tsx:71,81), so this hook keeps two key branches and an `isActive` option that no caller can ever reach. A reader has to chase both handlers to learn which one really moves the selection.
  **Fix:** Delete `onIssueNav` and the j/k branches, and drop the unused `isActive = true` option. With three live options and one consumer, consider inlining the remaining `useInput` into `ReviewResultsView` — the hook then adds no logic.

- **`cli/diffgazer/src/features/history/hooks/use-screen.ts:91`** — handleOpenReview is dead in production and kept alive only by its own unit test _( tui-features#1 )_
  **Why:** `HistoryScreen` opens runs through `screen.handleRunActivate` (screen.tsx:101,224); nothing in the app calls `handleOpenReview`. `rg handleOpenReview` across the repo returns only this hook and use-screen.test.ts:177, so the test is asserting a code path the TUI can never run.
  **Fix:** Delete `handleOpenReview` from `UseHistoryScreenResult` and the hook body, and drop the assertions at use-screen.test.ts:177-181. While there, `handleRunActivate: onOpenReview` is a pure rename of an option into a result key — expose `onOpenReview` under its own name or have the screen call the prop directly.

- **`cli/server/src/features/review/storage/reviews.ts:390`** — `listReviews` and its only caller-chain `listFromIndex` are production-dead — every route uses `listReviewPage` _( server#1 )_
  **Why:** `rg` over the whole repo shows `listReviews` referenced only from `reviews.test.ts` and `app-review-rekey.test.ts`. `listFromIndex` (lines 337-388) is called only from `listReviews`. That is ~75 lines of index-serving logic kept alive purely by its own tests, in the same file as the live paginated path — a reader cannot tell which one is real.
  **Fix:** Delete `listReviews` (390-410) and `listFromIndex` (331-388), and rewrite the tests that exercise index-serving behavior against `listReviewPage`, which is the shipped path. Keep `listReviewsFromFullScan` — `listReviewPage` still calls it.

- **`cli/server/src/shared/lib/config/persistence/config.ts:184`** — Five persistence write paths are test-only, and three of them bypass the cross-process file lock the production paths depend on _( server#3 )_
  **Why:** `persistConfig`, `persistConfigMergedAsync` (config.ts), `persistSecrets`, `removeSecretsFile` (secrets.ts) and `persistTrust` (trust.ts) are referenced only from `persistence-*.test.ts`. The sync ones write with `writeJsonFileSync` outside `withFileTransactionLock`, so they are live footguns: anyone reaching for the obvious-looking `persistConfig` silently breaks the locking invariant the async path enforces.
  **Fix:** Delete `persistConfig`, `persistConfigMergedAsync`, `persistSecrets`, `removeSecretsFile` and `persistTrust`; retarget their tests at the locked paths (`withConfigFileTransaction`, `persistSecretsAsync`, `persistTrustRecordAsync`) which are what production actually runs.

- **`cli/server/src/features/review/engine/orchestrate.ts:94`** — Lens/filter resolution is done twice — orchestrate's `profile` fallbacks and `["correctness"]` default are unreachable _( server#6 )_
  **Why:** `pipeline.executeReview` already resolved lenses and filter via `resolveReviewDefaults` and passes only `{ lenses, filter }`. `reviewOptions.profile` is never set by any caller, so both `profile?.lenses` and `profile?.filter` branches are dead, and the hardcoded `["correctness"]` default duplicates a decision `resolveActiveLenses` already made.
  **Fix:** Change the signature to require the already-resolved `{ lenses: LensId[]; filter?: SeverityFilter }` and delete the profile fallbacks, the `[...new Set(...)]` re-dedupe and the `["correctness"]` default — `resolveReviewDefaults` owns all three.

- **`libs/ui/registry/ui/sidebar/sidebar-section-context.tsx:41`** — `useOptionalSidebarSectionContext` has zero consumers and ships in the public copy registry _( ui-comp-b#1 )_
  **Why:** `rg` across the whole repo finds it only at its definition and inside the generated `libs/ui/public/r/sidebar.json` mirror. It is not re-exported by `sidebar/index.ts`, so no package consumer can reach it either — it is dead code that copy-mode users receive as part of the sidebar registry item.
  **Fix:** Delete the function and its doc comment, then regenerate `libs/ui/public/r/sidebar.json` via `pnpm run prepare:artifacts`.

- **`libs/ui/registry/lib/floating-position-constants.ts:6`** — `FloatingPlacement` is a dead public type whose definition also contains a no-op template literal _( ui-hooks-lib#0 )_
  **Why:** Declared, imported into `use-floating-position.ts` purely to be re-exported, and referenced by zero components, tests, docs or props anywhere in the repo. It ships in the `floating-position` registry item and the `@diffgazer/ui/hooks/floating-position` subpath, so a cold reader hunting for the `placement` prop it implies finds nothing. Its body is also self-defeating: `` `${FloatingSide}` `` is identical to `FloatingSide`.
  **Fix:** Delete the `FloatingPlacement` type, its `import type` entry at `hooks/use-floating-position.ts:23`, and its name from the `export type { ... }` list at `hooks/use-floating-position.ts:36`, then regenerate `libs/ui/public/r/floating-position.json`. If a combined placement token is ever wanted, reintroduce it as `FloatingSide | \`${FloatingSide}-${FloatingAlign}\`` at the point a component actually accepts one.

- **`.dependency-cruiser.cjs:64`** — no-orphans allowlist is stale in both directions, so `pnpm run depcruise` always prints 4 warnings _( xcut-arch#2 )_
  **Why:** The allowlist exempts `apps/web/src/testing/factories` which no longer exists, and omits four live modules, so every boundary run ends with `4 dependency violations (0 errors, 4 warnings)`. A gate that is never green trains reviewers to skim past it, and a genuinely orphaned module would land in the same noise.
  **Fix:** Drop `factories` (deleted) and add `reticle` to the web testing group; add `docs-tree-context` to the `apps/docs/src/hooks/(theme-context|use-demos)` group. For the two CLI hits prefer renames over new exemptions: `cli/diffgazer/src/testing/vitest.setup.ts` → `test-setup.ts` (already matched by `(^|/)test-setup\.ts$`) and the type-only `cli/diffgazer/src/lib/servers/controller.ts` → `types.ts` (already matched by `(^|/)types\.ts$`). Verify with `pnpm run depcruise` reporting zero violations.

- **`apps/web/src/styles/theme-overrides.css:59`** — --row-active-fg and its @theme bridge --color-row-active-fg have zero consumers _( probe2 )_
  **Why:** The token is declared in both theme blocks, bridged into Tailwind, and advertised in the file header (line 5) as one of the live diffgazer-only domain tokens. A repo-wide search for `row-active` returns only these four lines, so a reader budgets maintenance for a contract that does not exist.
  **Fix:** Delete `--row-active-fg` from both theme blocks (lines 59 and 106), delete `--color-row-active-fg` from the `@theme inline` block (line 130), and drop "row-active" from the domain-token list in the header comment (line 5).

- **`apps/docs/src/components/docs-mdx/markdown-renderers.tsx:104`** — showLineNumbers on the shiki passthrough is a no-op _( probe2 )_
  **Why:** CodeBlockContent honors `showLineNumbers` only inside the auto-split branch for string children (its own JSDoc at code-block-content.tsx:10 says "Auto-split mode only"). Here `children` is the shiki-emitted <code> element, so `lines` is null and the prop is never read. The expression reads as a live shell-vs-code distinction that does nothing.
  **Fix:** Delete `showLineNumbers={!isShell}`. If docs code fences are supposed to have a gutter, that needs the CodeBlock.Line or CodeBlockHighlight path instead, not this prop.


### comprehensibility (6)

- **`cli/diffgazer/src/lib/terminal-input.ts:8`** — 264-line stdin escape-sequence parser + stdin Proxy with zero statement of the problem it solves _( tui-shared#0 )_
  **Why:** This is the single hardest file in the TUI shell to read cold. Nothing anywhere says what `legacy-modified` means, why an ESC byte is withheld for 50ms, or why `stdin` is wrapped in a Proxy at all. A reader cannot tell whether this is essential or accidental, and the consumer (`app/providers/keyboard.tsx:57`) is equally silent.
  **Fix:** Add a 3-4 line file header stating the constraint the code cannot show: terminals encode Alt+<key> as ESC followed by the key ("legacy modified" encoding), Ink cannot distinguish that from a bare Escape, so a lone ESC is held for ESCAPE_PREFIX_HOLD_MS before being released, and the Proxy exists to intercept `read()` without replacing the real stdin Ink needs. Add one sentence at app/providers/keyboard.tsx:57 stating that `consume()` must be called exactly once per Ink input event to stay in lockstep with the queue.

- **`cli/diffgazer/src/components/ui/scroll-area.tsx:93`** — ScrollArea's content-measurement state machine (isMeasuringContent / contentReference) is unexplained anywhere _( tui-shared#1 )_
  **Why:** Three interlocking derived values plus a set-state-during-render block implement a two-pass measure of unmeasured static children, and `minHeight={isMeasuringContent ? undefined : scrollState.rowCount}` reads as arbitrary. `rg` confirms not one comment or test names the mechanism. This is the exact class of code the reviewer will stop on.
  **Fix:** Add one comment above line 90 stating the constraint: static children have no known row count until `useBoxMetrics` reports one, so on a content swap the box must render unclamped for one commit (`minHeight: undefined`) to be measured, then re-clamp to the measured `rowCount` — `isMeasuringContent` is that one-commit window.

- **`libs/keys/src/providers/keyboard.tsx:62`** — React useId string is reverse-engineered with regexes and radix 32 with no explanation _( keys#1 )_
  **Why:** This is the load-bearing mechanism for implicit scope resolution (it decides which scope owns an unscoped hotkey), and it decodes an undocumented React internal string format. Nothing in the file says that `order` is a `useId()` value, what `:r0:` / `H1` mean, or why base-32. A reader cannot tell what the regexes match or when this breaks on a React version bump. The explanation exists only in libs/keys/docs/content/guides/scopes.mdx:20.
  **Fix:** Add two sentences above `getScopeOrderSegments`: that `order` is a React `useId()` value whose tree path is base-32 encoded between `:r`/`:` markers with an optional `H<localId>` suffix, that decoding it yields declaration order so scopes mounting in the same commit can be ranked, and that this depends on React's id format (cross-link the scopes.mdx note). Also add one line at `IMPERATIVE_SCOPE_ORDER_PREFIX` (line 59) stating U+FFFF is chosen so imperative `pushScope` calls sort after every React-generated id.

- **`libs/registry/src/cli/workflows/diff.ts:113`** — `dgadd diff` summary counts files but labels them with `itemPlural` ("items") _( probe1 )_
  **Why:** The counters are incremented inside the inner per-file loop, but the summary is printed with `options.itemPlural`. In my probe app `dgadd diff` printed "Summary: 1 changed, 65 unchanged items." while only 25 items were installed (66 was the manifest file count). A user reading that number will think two thirds of their components are unaccounted for.
  **Fix:** Either say "file(s)" in the summary (the counters are per-file at diff.ts:126-129), or aggregate per item before counting. If both numbers are useful, print "Summary: 1 changed file across 1 item, 24 items unchanged." Add a test asserting the summary noun matches the unit counted.

- **`libs/ui/registry/ui/callout/callout.css:18`** — callout.css header states a chrome-ownership contract the Callout components do not honor _( probe2 )_
  **Why:** A reader trusting this header would look only at callout.css to change Callout chrome and miss four TSX files that carry colors, sizing, hover, focus rings, touch targets, and a forced-colors fallback. The claim is contradicted inside the same component folder.
  **Fix:** Either move the remaining chrome out of the TSX (callout.tsx:171 `forced-colors:bg-[CanvasText]`, callout-title.tsx:17, callout-icon.tsx:30, callout-dismiss.tsx:37-46) into callout.css, or rewrite the header to state what is actually true: the CSS owns frame/tone/grid and the parts own their own typography and interactive chrome via Tailwind. Also fix the second copy of the claim at callout.css:104 ("the React components emit data-attributes only").

- **`libs/ui/registry/ui/code-block/code-block.css:45`** — `[data-slot="code-block-content"] > code` reads as a dead rule — nothing in the library ever renders a bare <code> child _( probe2 )_
  **Why:** Every path CodeBlockContent owns renders CodeBlockLine spans (each with its own nested <code>), so this selector matches nothing in the library. It is actually load-bearing for the undocumented-in-CSS shiki/rehype-pretty-code passthrough, which apps/docs depends on. Without a note the next reader deletes it and silently breaks every docs code fence's block layout and 12px inset.
  **Fix:** Add one sentence above the rule: "Passthrough path for highlighters that emit their own <pre><code> markup (shiki / rehype-pretty-code) — see code-block.mdx and apps/docs markdown-renderers.tsx:104. CodeBlock.Line children never hit this rule."


### architecture (5)

- **`libs/ui/registry/ui/callout/callout.tsx:36`** — Callout hand-rolls a focusable-element selector and DOM-position constants that libs/keys already owns _( ui-comp-a#0 )_
  **Why:** AGENTS.md assigns focusable/tabbable utilities to libs/keys, and the file already imports `isFocusable` from `@diffgazer/keys` (callout's registry item already declares `@diffgazer-keys/focusable`, so copy mode is not the excuse). The local list is a strict subset of keys' `FOCUSABLE_SELECTOR` — it omits `area[href]`, `[contenteditable]`, `details > summary:first-of-type`, `iframe/object/embed`, `audio/video[controls]` — so dismissing a callout whose nearest neighbour is a contenteditable or a summary silently moves focus somewhere further away. `DOCUMENT_POSITION_PRECEDING/FOLLOWING` are copied verbatim from keys/src/dom/focusable.ts:128-129.
  **Fix:** Delete DISMISS_FOCUS_SELECTOR and both DOCUMENT_POSITION_* constants. Build candidates with `getFocusableElements(root.ownerDocument.body)` from @diffgazer/keys (its traversal is already shadow-composed, which also removes the need for `getFocusSearchScope`) and keep only the `!root.contains(candidate)` filter plus the following/preceding split. If keys needs to export the position constants, add them there rather than re-declaring locally.

- **`libs/ui/registry/ui/progress/index.ts:3`** — `ProgressVariant` is a public prop type that the package entry does not export _( ui-comp-b#7 )_
  **Why:** `ProgressProps.variant?: ProgressVariant` is public API, but the subpath entry re-exports only `ProgressSize`, so a package consumer cannot name the type of a prop they must pass. AGENTS.md requires package consumers to receive complete exports.
  **Fix:** Add `type ProgressVariant` to the re-export list, matching how `ProgressSize` is surfaced.

- **`libs/ui/registry/examples/stepper/stepper-keyboard.tsx:3`** — Public stepper keyboard example imports the unpublished @diffgazer/keys package instead of the local copy-mode hook path _( ui-docs-examples#0 )_
  **Why:** AGENTS.md requires public UI registry source to rewrite keys package imports to local copied hook paths, and the dialog/search-input keyboard examples were already converted and pinned by tests. A reader copying this example off the docs page gets an unresolvable import, because Diffgazer packages are not published to npm (dialogDoc states this explicitly).
  **Fix:** Swap to the existing local re-export used by the two sibling examples: `// @hidden-imports-ok — demo imports the useNavigation re-export from the hidden use-navigation hook registry item` + `import { useNavigation } from "@/hooks/use-navigation";` (libs/ui/registry/hooks/use-navigation.ts already re-exports it).

- **`libs/ui/registry/examples/menu/menu-keyboard.tsx:3`** — Menu keyboard example demonstrates useKey/KeyboardProvider, which no copy/dgadd registry item ships _( ui-docs-examples#1 )_
  **Why:** libs/keys/public/r only ships focus-restore, focus-trap, focusable, navigation and scroll-lock — there is no registry item for useKey or KeyboardProvider, and the package is unpublished. The example is referenced by menuDoc as "Controlled Keyboard Navigation", so the one Menu keyboard example on the docs site cannot be reproduced through any supported install path.
  **Fix:** Either add a hidden `use-key` hook registry item + local re-export (as done for use-navigation) and import from `@/hooks/use-key`, or rewrite the example to drive hotkeys with a plain keydown handler so it works through copy/dgadd.

- **`apps/docs/src/components/breadcrumbs.tsx:50`** — apps/docs re-implements the Breadcrumbs contract that @diffgazer/ui already ships, against the AGENTS.md "consume, never mirror" rule _( xcut-dry#3 )_
  **Why:** AGENTS.md: "apps/docs … must consume `@diffgazer/ui`, never mirror it". libs/ui/registry/ui/breadcrumbs ships exactly the nav[aria-label=Breadcrumb] + separator + aria-current="page" contract this file rebuilds from raw spans, including the role="list" restoration that Tailwind preflight otherwise strips for VoiceOver. The docs copy renders no list at all, so it loses those semantics while duplicating the primitive's markup rules; only the PATH_CHAR_BUDGET collapse and the page-tree slug resolution are genuinely docs-specific.
  **Fix:** Compose `Breadcrumbs`/`Breadcrumbs.Item`/`Breadcrumbs.Link` from `@diffgazer/ui/components/breadcrumbs` (separator="/", className for the mono chrome row) and keep only the collapse decision and findTreeSectionPath slug mapping in this file. Rename the local export to DocsPathBreadcrumbs so it no longer shadows the primitive's name.


### overengineering (4)

- **`apps/web/src/features/review/components/activity-log/row-index.ts:46`** — The log row index is chunked into 200-row "pages" that buy nothing over a flat index array _( web-features#0 )_
  **Why:** `MatchingPage`, `buildMatchingPages`, `pruneMatchingPages`, `appendMatchingIndices` and `getRowLogicalIndices` (~120 of the file's 259 lines, plus most of its 202-line test) exist only to keep the matching logical indices split into LOG_WINDOW_SIZE chunks. The upstream event buffer is capped at MAX_EVENTS = 5000 (libs/core/src/review/event-sequence.ts:65), so a single `readonly number[]` of matching indices plus a `firstRow` offset gives identical behaviour, makes window extraction one `slice` instead of a page scan, and removes the off-by-one edge cases in `pruneMatchingPages` (`firstRetainedOffset <= 0 && pageIndex === 0`).
  **Fix:** Replace `matchingPages: readonly MatchingPage[]` with `matchingRows: readonly number[]` (logical indices) plus `firstRow: number`. `getEventRowBounds` becomes `{ start: firstRow, end: firstRow + matchingRows.length }`, `getRowLogicalIndices` becomes `matchingRows.slice(startRow - firstRow, endRow - firstRow)`, prune becomes one `findIndex` + `slice`, append becomes one spread. Delete `MatchingPage`, `buildMatchingPages`, `pruneMatchingPages`, `appendMatchingIndices` and the page-boundary cases in row-index.test.ts.

- **`apps/docs/src/components/layout/sidebar-chrome.tsx:57`** — Library-switch spinner is guarded by a four-field snapshot plus a monotonic token read during render _( docs-landing#1 )_
  **Why:** A `<Select>` that awaits one server fn carries `transitionTokenRef`, `currentRouteRef`, a `pendingSwitch` object snapshotting {token, library, pathname, pendingPathname}, a layout effect that bumps the token on both run and cleanup, and an `ownsTransition()` closure. `switching` is derived by reading `transitionTokenRef.current` *during render* — a ref read in the render phase, which AGENTS.md's React rules exclude — and the token check is redundant with the three field comparisons beside it. When the route does change mid-flight the `finally` skips the reset, so `pendingSwitch` is left non-null forever.
  **Fix:** Collapse to one `const requestIdRef = useRef(0)` bumped inside `handleLibraryChange` only, plus `const [switching, setSwitching] = useState(false)`. After the await, `if (requestIdRef.current !== id) return;` guards the stale response; clear `switching` unconditionally in `finally`. Delete `transitionTokenRef`, `currentRouteRef`, the `useLayoutEffect`, and the `pendingSwitch` snapshot object.

- **`cli/server/src/features/review/storage/persistence.ts:228`** — `createCollection` is a generic multi-collection factory with exactly one collection, and half its surface is never called in production _( server#2 )_
  **Why:** The only production instantiation is `reviewStore`. `collection.list()`, `collection.readMetadata()` and external `ensureDir()` are referenced only from `persistence.test.ts` — and `getMetadata`/`metadataSchema`/`extractMetadataFromFile` exist solely to serve those. That is ~85 lines of generic plumbing (plus `Collection`/`CollectionConfig` in types.ts) whose only consumer is its own test file.
  **Fix:** Delete `list`, `readMetadata`, `extractMetadataFromFile`, the `getMetadata`/`metadataSchema` config fields and the corresponding tests. Then collapse the remaining `read`/`readDetailed`/`write`/`ensureDir` into a concrete `reviewStore` module (no `<T, M, D>` generics) since there is one collection.

- **`libs/keys/src/hooks/use-action-row-navigation.ts:14`** — Tuple-generic index/disabled-flag machinery in useActionRowNavigation has zero real consumers _( keys#0 )_
  **Why:** Two conditional mapped types, a generic parameter threaded through options + return type, five internal `as ActionRowIndex<Actions>` casts, and five dedicated type-level tests exist to narrow indices for tuple instantiations — but every one of the 9 in-repo call sites either takes the default or explicitly writes `useActionRowNavigation<readonly unknown[]>` (which IS the default). No call site ever instantiates a tuple, so the whole apparatus buys nothing while making the hook signature and its own body require casts.
  **Fix:** Either adopt the feature (drop the `<readonly unknown[]>` annotations at apps/web/src/features/providers/hooks/use-action-buttons.ts:64, .../settings/hooks/use-settings-form-footer.ts:31, .../settings/components/diagnostics/use-diagnostics-keyboard.ts:84, .../providers/components/{model-select-dialog/use-dialog-keyboard.ts:131, api-key-dialog/use-keyboard.ts:109}, .../review/components/no-changes-view.tsx:32, components/shared/failure-view.tsx:50 and let inference produce tuples) or delete `ActionRowIndex`/`ActionRowDisabledFlags`, drop the `Actions` generic, type indices as `number` and `disabledActions` as `readonly boolean[]`, and remove the five `as ActionRowIndex<Actions>` casts plus the tuple type tests in use-action-row-navigation.test.tsx:595-663.


### testing (3)

- **`apps/web/src/lib/config-guards.test.ts:13`** — Guard test mocks and asserts on `api.checkConfig`, which the guards never call _( web-shared#1 )_
  **Why:** `config-guards.ts` only calls `configQueries.init(api)`; `checkConfig` appears nowhere in it. The mock, three `mockCheckConfig.mockResolvedValue(...)` setups and two `expect(mockCheckConfig).not.toHaveBeenCalled()` assertions test a mock, and the test title invents a "legacy check" concept that exists nowhere in the codebase.
  **Fix:** Drop `mockCheckConfig` and every `checkConfig` reference from the mock factory, the setups (lines 46, 54, 61, 69) and the assertions (lines 50, 65); rename the test at line 60 to describe what the guard actually does ("redirects on init setup status") or fold it into the existing unconfigured case.

- **`apps/landing/src/styles/line-breaking.test.ts:43`** — CSS assertion matches an exact whitespace-formatted declaration string, which the sibling test file explicitly avoids _( docs-landing#16 )_
  **Why:** hud-corners.test.ts builds `mediaBlocks`/`ruleFor` specifically so assertions are "about the contract instead of about how the declarations happen to be formatted". This file then does the exact thing that comment warns against: a literal `indexOf` on `".gaze-diff .diff-code { overflow: hidden;"`, which breaks if a formatter moves the brace or reorders the declarations, with no behavioural change.
  **Fix:** Move `mediaBlocks`/`ruleFor` from hud-corners.test.ts into `src/testing/css.ts` and rewrite this assertion as `expect(ruleFor(mediaBlocks("max-width: 700px"), ".gaze-diff .diff-code")).toContain("text-overflow: ellipsis")`, which is order- and whitespace-independent.

- **`libs/ui/registry/examples/dialog/dialog-keyboard.test.tsx:12`** — The keys copy-mode contract is enforced by two hand-written per-file tests instead of one check over all examples _( ui-docs-examples#4 )_
  **Why:** The identical assertion exists in dialog-keyboard.test.tsx and search-input-keyboard.test.tsx, each reading its own sibling file. Because the rule is opt-in per example rather than swept, stepper-keyboard.tsx and menu-keyboard.tsx both still import @diffgazer/keys and nothing fails.
  **Fix:** Replace both per-file describes with one assertion in libs/ui/scripts/validate-registry-metadata.ts (next to validateNoPublicKeysImports) or in the existing apps/docs docs-example-wiring examples.test.ts that walks every libs/ui/registry/examples/**/*.tsx and rejects `from "@diffgazer/keys"`.


### naming (3)

- **`cli/diffgazer/src/hooks/use-list-navigation.ts:58`** — `selectItem` neither selects nor mutates — it is a lookup, and one call site uses it purely as a boolean guard _( tui-shared#3 )_
  **Why:** AGENTS.md requires keyboard/navigation callbacks to describe the semantic event. `selectItem` reads as a state change but is `selectableItems.find(...) ?? null`. At menu.tsx:173 it is used inside an `&&` chain as an is-selectable test, which reads as a selection side effect inside a condition.
  **Fix:** Rename to `findSelectableItem` in `ListNavigation`, `use-list-navigation.ts`, `use-list-navigation-input.ts:40`, `menu.tsx:173` and `use-list-navigation-input.test.ts:26`. At menu.tsx:173 hoist the guard out of the `&&` chain into an explicit `if (!navigation.findSelectableItem(item.id)) continue;`.

- **`cli/diffgazer/src/components/ui/tabs.tsx:13`** — TUI `Tabs` uses `onValueChange` while every sibling value control and the web `Tabs` use `onChange` _( tui-shared#5 )_
  **Why:** AGENTS.md Public UI API: "Public value controls use `value`, `defaultValue`, and `onChange(value)`." `libs/ui/registry/ui/tabs/tabs.tsx:31` is `onChange`, and the TUI's own RadioGroup/CheckboxGroup/Input all use `onChange`. Tabs is the only outlier in the directory, which breaks the deliberate web/TUI mirror.
  **Fix:** Rename `onValueChange` to `onChange` in `components/ui/tabs.tsx` and update the one consumer chain: `features/providers/components/tier-filter-tabs.tsx:13` and its call site at `features/providers/components/model-select-overlay.tsx:341`, plus `components/ui/tabs.test.tsx`.

- **`cli/diffgazer/src/features/review/components/progress-view/view.tsx:84`** — Sibling directories progress/ and progress-view/ in one folder, one of which mirrors web's progress-list/ _( xcut-structure#3 )_
  **Why:** `features/review/components/` contains both `progress/{list,step}.tsx` and `progress-view/{activity,overview,view}.tsx`. Nothing in either name says which is which, and `apps/web` — the surface this TUI deliberately mirrors — calls the same pair `progress-list/{list,step}.tsx` and `progress-view.tsx`. Every file inside `progress-view/` also repeats the folder name (`progress-view.context.test.tsx`, `progress-view.elapsed.test.tsx`, `progress-view.status.test.tsx`, `progress-view.layout.test.tsx`, `progress-view.test-harness.tsx`) while the component file itself is bare `view.tsx`.
  **Fix:** Rename `cli/diffgazer/src/features/review/components/progress/` → `progress-list/` to match `apps/web`. Inside `progress-view/`, drop the folder-name prefix per the folder-context rule: `view.tsx` stays, `progress-view.test-harness.tsx` → `test-harness.tsx`, `progress-view.context.test.tsx` → `context.test.tsx`, and likewise for `.elapsed`, `.status`, `.layout`.


### type-safety (3)

- **`cli/diffgazer/src/app/use-config-guard.test.ts:104`** — Test builds React trees with createElement plus `as Parameters<typeof X>[0]` casts because the file is .ts, not .tsx _( tui-shared#12 )_
  **Why:** The three casts exist purely to silence the missing `children` prop that is actually supplied as createElement's third argument. They disable prop checking on `ConfigGate`, `NavigationProvider` and `CliThemeProvider`, so a genuine prop-type regression in those components would not fail this test.
  **Fix:** Rename the file to `use-config-guard.test.tsx` and replace the three `createElement` chains with JSX; all three `as Parameters<typeof …>[0]` casts then disappear and prop types are checked again.

- **`apps/web/src/styles/theme-overrides.css:108`** — Light/dark drift: --input-well collapses to --background in light mode _( probe2 )_
  **Why:** The dark block declares `--base-input-bg: #010409` (a real step below `--base-bg: #0d1117`) and the comment calls it a "sunken input-well surface". The light block reads `--base-input-bg` without declaring it, so it falls through to the lib's light value `#ffffff` — identical to this file's own `--base-bg: #ffffff` on line 68. Both `bg-input-well` call sites lose their sunken affordance entirely in light theme.
  **Fix:** Declare the GitHub-light counterpart in the light block alongside the other primitive overrides (GitHub-light uses canvas-subtle `#f6f8fa` for input wells): add `--base-input-bg: #f6f8fa;` next to `--base-border`/`--base-muted` around line 75, or set `--input-well: #f6f8fa` directly. Verify against the two consumers: apps/web/src/components/shared/api-key-method-selector.tsx:122 and apps/web/src/features/providers/components/model-select-dialog/search-input.tsx:46.

- **`libs/registry/src/imports/relative-js-imports.ts:18`** — A stateful module-level /g regex is exported as public API, forcing every consumer to work around its shared lastIndex _( probe3 )_
  **Why:** A `g`-flagged RegExp carries mutable `lastIndex`. All four consumers independently defend against it — two by rebuilding the regex from `.source`, two by manually zeroing `lastIndex` (which mutates state other callers share). Any future consumer that forgets silently skips matches, which for a handoff gate means a false pass.
  **Fix:** Subsumed by removing the regex export entirely (see the writer/gate finding). If it is kept for any reason, export a function returning the matches instead of the regex object — the workarounds live at libs/keys/scripts/transform-public-registry-imports.ts:98, libs/keys/scripts/validate-registry-closure/public-registry.ts:91, libs/ui/scripts/registry/public-registry-copy-contract.test.ts:12, and libs/registry/src/imports/relative-js-imports.test.ts:5.


### error-handling (3)

- **`cli/server/src/features/review/diff.ts:16`** — A git error is classified into a typed code, the code is discarded, then re-derived by string-prefix matching on the message _( server#13 )_
  **Why:** `createGitDiffError` runs `classifyError` to produce a `GitDiffErrorCode`, then throws the code away by returning a bare `Error`. `getReviewErrorCodeForGitDiff` recovers it with `startsWith("Git is not installed")` — so editing that user-facing copy in `git/errors.ts:17` silently downgrades GIT_NOT_FOUND to GENERATION_FAILED with no test or type failing.
  **Fix:** Have `createGitDiffError` return `{ code: GitDiffErrorCode; message: string }` instead of an `Error`, and map `code === "GIT_NOT_FOUND"` directly in `diff.ts`.

- **`libs/registry/src/cli/workflows/remove/targets.ts:64`** — "has been modified" skip message also fires when the file simply has no ownership record _( probe1 )_
  **Why:** `canRemoveFile` in cli/add/src/commands/remove.ts:97-101 returns false for two distinct reasons: no ownership hash (`if (!expectedHash) return false`) and hash mismatch. The single message hardcodes the mismatch wording. Reproduced by wiping `installedComponents` from diffgazer.json and running `dgadd remove ui/button --yes`: it printed "Skipping ui/button: src/components/ui/button/index.ts has been modified (use --force to override)" for a file that was byte-identical to what dgadd wrote. The advice is worse than wrong — following it (`--force`) then deletes files dgadd has no ownership record for, which I confirmed does happen.
  **Fix:** Have `canRemoveFile` return a reason (e.g. `"unowned" | "modified" | true`) and emit distinct messages: "…is not tracked in the ownership manifest" vs "…has been modified". Keep `--force` guidance only on the modified branch; for the unowned branch say the manifest is missing or was reset.

- **`libs/ui/registry/ui/logo/figlet-text.ts:38`** — Font-load failure is reported as "install figlet" on a branch where figlet is provably already installed, and the real error is discarded _( probe3 )_
  **Why:** `loadFont` only runs after `await loadFiglet()` resolved (getFigletText:55-56), so figlet is installed by definition when this catch fires. Every real cause — a chunk/network failure, a bad font export — is replaced with a message that is guaranteed to be wrong, and the original error is dropped, leaving nothing to debug. This ships verbatim to copy consumers in libs/ui/public/r/logo-figlet.json.
  **Fix:** Drop the catch at lines 38-40 and let the real rejection propagate (the outer catch at 44-47 already clears the cache entry and rethrows). If a hint is wanted, wrap with `new Error(\`Failed to load figlet font "${font}".\`, { cause: error })` so the root cause survives. Keep the message on the `loadFiglet` catch at line 25, where it is actually correct.


### yagni (2)

- **`cli/diffgazer/src/features/settings/components/settings-form-screen.tsx:33`** — cancelVariant/saveVariant knobs make the same shell render two different button pairs _( tui-features#12 )_
  **Why:** The shell exists so every settings form looks the same, but it exposes styling props that one screen uses differently: storage-screen.tsx:60-61 passes `secondary`/`primary` while agent-execution-screen.tsx:65-66 and analysis-screen.tsx:67-68 pass `ghost`/`success` (theme-screen.tsx:169,173 hardcodes ghost/success too). So the Storage screen's Cancel/Save is visually inconsistent with every other settings form, with no stated reason.
  **Fix:** Pick one pair (ghost/success, matching three of the four screens), hardcode it in SettingsFormScreen, and delete both props from the interface and all four call sites.

- **`libs/ui/registry/ui/code-block/code-block-content.tsx:12`** — lineCount is an undocumented public prop with no call sites _( probe2 )_
  **Why:** It is the only prop in CodeBlockContentProps without a JSDoc line, it has no entry in libs/ui/registry/component-docs/code-block.ts (which documents showLineNumbers twice), and a repo-wide search finds no consumer passing it. It only exists to pre-set the gutter width fed into --code-block-line-number-w, which `Children.count` already derives.
  **Fix:** Delete `lineCount` from the interface (line 12), from the destructure (line 18), and simplify line 33 to `const lineCount = lines ? lines.length : Children.count(children);`. Re-run `pnpm run prepare:artifacts` so the registry/docs artifacts drop the prop. If it must stay, document it in component-docs/code-block.ts and give it a JSDoc explaining which composed-children case needs it.


### srp (2)

- **`cli/server/src/shared/lib/config/store.ts:84`** — `store.ts` is a 1088-line module that also owns the entire secrets recovery-WAL subsystem _( server#4 )_
  **Why:** Besides the config store itself, the file holds the recovery-record schema, serialize/restore, startup reconcile, begin/clear recovery, and the multi-way keyring+config+secrets rollback ladders. Reading `saveProviderCredentials` requires holding six separate rollback concepts in your head at once. The file's own comment justifies keeping config+secrets *state* inline — it does not justify the WAL living here.
  **Fix:** Move the recovery-record concern into `shared/lib/config/secrets-recovery.ts`: `SecretsRecoveryRecordSchema`, `getSecretsRecoveryPath`, `serializeSecretsState`, `restoreRecoveryRecordSync`, `readSecretsRecovery`, `reconcileSecretsRecoveryAtStartup` and `rollbackFailure` are all closure-free top-level functions and move without touching `createConfigStore`'s internals.

- **`cli/add/src/commands/remove.ts:87`** — `remove` resolves `.css` registry files that `add` never writes, emitting spurious "file not found on disk" skips _( probe1 )_
  **Why:** `add` (cli/add/src/commands/add/file-ops.ts:48) and `diff` (cli/add/src/commands/diff.ts:140) both filter `.css` registry files out of on-disk handling — CSS is merged into styles.css as tracked chunks. `remove` does not filter, so every removal of an item with a `.css` file reports a scary skip for a file dgadd deliberately never created. Reproduced: `dgadd remove ui/dialog` printed "Skipping src/components/ui/shared/dialog.css: file not found on disk" plus the same for overlay-hints.css and spinner.css. 15 registry items carry `.css` files, so this hits most real removals.
  **Fix:** Filter `.css` out in `resolveFilesForItem` the same way diff.ts:140 does (`item.files.filter((file) => !file.path.endsWith(".css"))`); CSS chunk removal is already owned separately by `planOwnedCssChunkRemoval` in remove/css.ts. Note the coupling to libs/registry/src/cli/workflows/remove/targets.ts:72 — `hadMissingFiles` currently also flips on these phantom CSS files, which would let a `--force` removal record a name whose only "missing" files were never files at all.


### organization (2)

- **`libs/keys/artifacts/package.json:17`** — 76 build-generated files are committed under libs/keys/artifacts/artifacts/, and the workspace that owns them has zero dependents _( xcut-structure#0 )_
  **Why:** `copyArtifactsToPackage` does `rmSync(target, {recursive:true, force:true})` then `cpSync` on every build, so all 76 tracked files under `libs/keys/artifacts/artifacts/` are regenerated build output living in git. No package.json in the repo depends on `@diffgazer/keys-artifacts` (grep across all manifests returns only its own), and the sibling `libs/ui` ships zero committed artifacts — so this is an asymmetric, unconsumed, self-churning tree. It also produces the `artifacts/artifacts` path echo that reads as a mistake.
  **Fix:** Add `libs/keys/artifacts/artifacts/` to `.gitignore` and `git rm -r --cached` the 76 files (`validate-artifacts.mjs:132` already rebuilds+validates them, so CI is unaffected). Then, since nothing depends on `@diffgazer/keys-artifacts`, either delete the workspace and drop `libs/keys/artifacts` from `pnpm-workspace.yaml`/`check-invariants/topology.mjs`, or — if it must stay as the publish rehearsal PACKAGE_GOVERNANCE.md:182 describes — move it to a non-nested `libs/keys-artifacts/` so it stops being a workspace inside a workspace and the payload path becomes `libs/keys-artifacts/artifacts/`.

- **`libs/keys/src/playground/composite-semantics.test.tsx:4`** — libs/keys/src/playground/ holds only tests, and they reach into a different workspace's source by relative path _( xcut-structure#1 )_
  **Why:** The directory is inside the published library's `src/` but contains no library source and no playground source — just three test files that import `../../examples/playground/src/...`, crossing out of `libs/keys` into the separate `libs/keys/examples/playground` workspace via a relative path that bypasses package resolution entirely. A cold reader opening `libs/keys/src/playground/` finds a folder that lies about its contents, and the tests are nowhere near the code they test.
  **Fix:** Move all three files next to the demos they exercise: `libs/keys/src/playground/composite-semantics.test.tsx` → `libs/keys/examples/playground/src/demos/composite-semantics.test.tsx`, `demo-dialog.test.tsx` → `libs/keys/examples/playground/src/components/demo-dialog.test.tsx`, `global-shortcuts.test.tsx` → `libs/keys/examples/playground/src/demos/global-shortcuts.test.tsx`. Add a vitest config to the playground workspace aliasing `@diffgazer/keys` → `../../src/index.ts` (replacing the per-file `vi.mock`), and delete `libs/keys/src/playground/`.


### correctness (1)

- **`libs/keys/src/hooks/use-focus-zone/state.ts:59`** — useFocusZone keeps both a validated and an unvalidated current zone and uses them inconsistently _( keys#2 )_
  **Why:** `zone`, `isZone`, `getKeyOptions` and focus sync use the validated `safeZone`, but the keyboard transitions and `setZoneValue`'s equality/lifecycle logic use the raw `currentZone`. When a controlled `zone` is not in `zones` (realistic when the zones array shrinks while controlled state still holds the old zone — and explicitly exercised by the "falls back to first zone when initial is invalid" test), `transitions()` receives a zone the consumer was never told is active, `tabCycle.indexOf` misses, and `setZone(safeZone)` fires spurious `onLeaveZone(<invalid>)`/`onEnterZone`/`onZoneChange` even though the reported zone never changed.
  **Fix:** Validate once: store `safeZone` into `zoneStateRef.current.currentZone` and stop returning the raw `currentZone` from `useFocusZoneState`; have `useFocusZoneKeyboard` consume `safeZone` for `transitions()` and `cycleZone`. One name, one meaning.


## LOW (208)

Complete list; each has full why/evidence/fix in the machine-readable findings JSON.


### comprehensibility (31)

- `apps/web/src/features/providers/components/model-select-dialog/use-dialog-keyboard.ts:153` — Three wrappers over `getActionProps` diverge on whether they forward `actionProps.onFocus`, and one pays for it with shadow state

- `apps/web/src/features/review/components/summary-view.tsx:66` — Raw `false`/`true` returns where `libs/keys` exports the named `DECLINE` sentinel

- `apps/web/src/app/not-found.tsx:8` — Imperative `document.title` write with no explanation while every route uses `head`

- `apps/web/src/components/layout/global.tsx:93` — Two independent dialog-suppression mechanisms with nothing saying why both are needed

- `apps/web/src/styles/theme-overrides.test.ts:49` — Node builtins loaded through string-variable indirection with no stated reason

- `apps/web/src/app/route-error-boundary.tsx:51` — `EMPTY_FOOTER_SHORTCUTS: []` — neither the empty-tuple type nor the hoisting is explained

- `cli/diffgazer/src/features/home/components/screen.tsx:161` — HomeMenuWithFooter is an unexplained prop-spreading wrapper that duplicates a documented pattern

- `cli/diffgazer/src/lib/servers/process/server.ts:85` — `lifecycleVersion` restart-cancellation mechanism has no explanation

- `apps/docs/src/features/search/components/dialog.tsx:28` — biome-ignore justified by an internal phase number a cold reader cannot resolve

- `apps/docs/src/components/inset-preview-pane.tsx:7` — "A3 docs-shell inset" names the component after an unresolvable internal label

- `apps/docs/src/security-headers.ts:15` — Cache-Control comment points at an "/assets/** rule" that does not exist in the repo

- `cli/add/src/commands/add/integration-mode.ts:119` — `planIntegrationModeMigration` builds six interlocking sets with no statement of what the plan means

- `libs/core/src/review/event-sequence.ts:10` — The WeakMap-of-WeakMaps sequence-token machinery has no explanation of what it is for

- `libs/keys/src/hooks/use-action-row-navigation.ts:64` — Disabled flags are encoded as a "0101" string with nothing explaining why

- `libs/keys/src/hooks/use-focus-zone/focus-sync.ts:102` — Deliberate no-dependency effect left unexplained where the rest of the library explains it

- `libs/keys/src/hooks/use-key.ts:66` — Length-prefixed registration key encoding is unexplained

- `libs/ui/registry/ui/code-block/code-block.tsx:68` — Symbol-keyed registration Map has no stated reason to exist

- `libs/ui/registry/ui/checkbox/checkbox.tsx:151` — data-diffgazer-checkbox-group-item guard is duplicated with no explanation of the ownership rule

- `libs/ui/registry/ui/label/label.tsx:98` — Label's mousedown handler is the only unexplained block in a heavily annotated file

- `libs/ui/registry/ui/code-block/code-block-content.tsx:12` — lineCount is the only undocumented prop in a fully documented public interface

- `libs/ui/registry/ui/breadcrumbs/breadcrumbs.tsx:27` — flattenFragments key composition has no stated purpose

- `libs/ui/registry/ui/navigation-list/navigation-list-item-context.tsx:10` — Templated context-member JSDoc restates the field name, and `descId` is documented as an id when it is a prefix

- `libs/ui/registry/examples/tabs/tabs-reflow.tsx:15` — One example per component folder silently switches between namespaced and flat compound exports

- `apps/docs/tsconfig.json:25` — Unexplained one-off tsconfig alias into libs/ui build output, present only for a single test import

- `AGENTS.md:51` — Two real pnpm workspaces are absent from the repo contract

- `libs/ui/registry/hooks/ssr/use-active-heading.test.tsx:3` — Two directories exist solely as a vitest project glob, and nothing at either directory says so

- `TESTING.md:22` — TESTING.md points at libs/ui/registry/hooks/testing/, a directory that does not exist

- `cli/diffgazer/src/lib/list-window.ts:48` — getListWindow's two-pass fixed-point loop for indicator-row reservation is unexplained

- `libs/ui/registry/ui/diff-view/diff-view.css:166` — Okabe-Ito block is labelled "(dark tier)" but is not theme-scoped, and the light tier silently inherits its strong percentages

- `libs/ui/registry/ui/command-palette/command-palette.css:17` — The documented override-knob list omits --command-palette-shadow

- `libs/ui/registry/ui/logo/figlet-text.ts:16` — Copy-mode consumers get a runtime error naming a package path that does not exist in their project


### dead-code (30)

- `apps/web/src/features/onboarding/lib/shortcuts.ts:17` — Unreachable `default` branch kills exhaustiveness on a 6-arm switch of near-identical rows

- `apps/web/src/features/history/hooks/use-page.ts:105` — `handleRunsBoundary`'s "down" branch is unreachable — the caller already filters to "previous"

- `apps/web/src/hooks/use-config.tsx:32` — `setupStatus` context field is never read

- `apps/web/src/components/shared/severity/bar.tsx:6` — Prop/helper types exported but never imported anywhere

- `cli/diffgazer/src/features/review/components/category-stats-table.tsx:5` — Dead re-export of a core type from a component file

- `cli/diffgazer/src/features/onboarding/hooks/use-wizard.ts:168` — cleanupEarlySave is re-exported from the hook result with no consumer

- `cli/diffgazer/src/lib/breakpoints.ts:3` — BREAKPOINTS is exported but module-private, and half its fields are never read

- `cli/diffgazer/src/components/layout/footer.tsx:14` — RowProps declares a `tokens.fg` field ShortcutRow never reads

- `cli/diffgazer/src/lib/routes.ts:40` — SCREEN_NAMES is exported but consumed only by isScreenName in the same file

- `apps/docs/src/types/data.ts:12` — Re-export barrel forwards five registry types that nothing imports from here

- `apps/docs/src/features/theme/lib/token-presentation.ts:112` — Duplicate-primitive check in orderThemeDocsPrimitives is unreachable

- `cli/server/src/features/review/engine/types.ts:16` — `failedLenses` and `droppedIncompleteProviderIssues` are computed and returned in `OrchestrationOutcome` but never read

- `cli/server/src/features/review/storage/persistence.ts:142` — Two pure re-export lines with zero consumers

- `cli/server/src/features/review/engine/issues/evidence.ts:256` — `ensureIssueEvidence` and `MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES_PER_REVIEW` exist only for their own tests

- `cli/server/src/features/review/engine/prompts.ts:36` — `createPromptFileIdentities` is exported but used only inside its own file

- `libs/registry/src/cli/item-accessors.ts:56` — `createItemAccessors(...).validate` and its `validateItems` helper are never called

- `libs/core/src/onboarding/save-wizard.ts:23` — `buildCredentialRef` is exported but used only inside its own file

- `libs/keys/src/hooks/use-focus-zone/keyboard.ts:137` — `hasExplicitScope` branch is a no-op — both arms evaluate identically

- `libs/keys/src/hooks/use-navigation/core.ts:24` — `queryNavigationElements` and `wrapIndex` are exported but only used inside their own file

- `libs/ui/registry/ui/dialog/dialog-footer.tsx:7` — Dead re-export of DialogKeyboardHints through dialog-footer

- `libs/ui/registry/ui/badge/badge.tsx:8` — BadgeSize and BadgeAppearance alias types are referenced nowhere, not even by BadgeProps

- `libs/ui/registry/ui/toggle-group/toggle-group-context.tsx:29` — `ToggleGroupContextValue.containerRef` and `.selectionMode` are published to context but never read

- `libs/ui/registry/ui/navigation-list/navigation-list-progress.tsx:10` — `progressColorVariants` and `SUBSTEP_STATUS_BADGE_VARIANTS` are `export`ed but package-internal

- `libs/ui/registry/component-docs/types.ts:3` — types.ts re-exports five registry types that nothing imports from it

- `knip.jsonc:121` — Three libs/ui knip entry globs are fully subsumed by the catch-all on the next lines

- `libs/ui/registry/ui/checkbox/checkbox-group.tsx:259` — The `event.key !== " "` guard in CheckboxGroup's keydown handler can never change behavior and is unexplained

- `libs/core/src/api/hooks/use-review-lifecycle-base.ts:62` — contextReady is computed and returned but no production consumer reads it

- `libs/core/src/api/hooks/use-review-stream.ts:89` — stream stop() and its COMPLETE reducer action are kept alive only by tests

- `cli/diffgazer/src/components/ui/menu.tsx:16` — Menu's onClose prop and its Escape branch are dead in production, kept alive only by menu.test.tsx

- `apps/landing/src/styles/index.css:34` — --muted in the landing token bridge restates the library's own --muted verbatim


### dry (24)

- `apps/web/src/features/review/hooks/use-results-keyboard.ts:196` — `findFilterChip` exists but two other sites re-inline the same `findNavigationItemByValue` call verbatim

- `apps/web/src/components/layout/header.tsx:78` — Three parallel `Record<HeaderServerState, …>` maps for one concept

- `cli/diffgazer/src/features/review/components/api-key-missing-view.tsx:41` — Local BACK_SHORTCUTS re-declares the identical constant libs/core already exports

- `cli/diffgazer/src/lib/servers/api.test.ts:144` — api.test.ts re-declares FakeChild and createFakeChild that already exist in the sibling test-support module

- `apps/docs/src/components/docs-mdx/blocks/consumption.tsx:102` — ConsumptionBlock inlines the body of the useCurrentLibrary hook sitting next to it

- `apps/landing/src/effects/field.ts:149` — Three copies of the same rect-overlap dimming test in the field draw loop

- `apps/docs/src/components/inset-preview-pane.tsx:14` — Suspense fallbacks and demo-slot component duplicated verbatim between parent and child

- `apps/docs/src/features/theme/components/diffgazer-preview.tsx:39` — GitHub URL hardcoded although docs-libraries.json already supplies it

- `cli/server/src/features/review/context/workspace/manifest.ts:17` — The same zod-issue formatter is written three times, one of them inline

- `cli/server/src/features/review/storage/persistence.ts:31` — `isValidUuid` is defined twice, identically, in sibling files in the same directory

- `libs/registry/src/docs-sync/output-validation.ts:28` — Two `directoryHasFiles` functions with identical semantics in the same directory, one hand-rolling a tree walk

- `libs/core/src/navigation/home-screen.ts:67` — `HomeMenuActivationContext` duplicates the exported `MenuDisablingContext` from the sibling file

- `libs/core/src/schemas/review/lens-selection.ts:7` — Four hand-rolled const-tuple membership guards, three different idioms, while a correct generic already exists in the package

- `libs/core/src/review/presentation/error-guidance.ts:107` — The api-key guidance object is written twice in one function

- `libs/ui/registry/ui/command-palette/use-command-palette-state.ts:163` — getEffectiveHighlighted is computed twice from identical arguments

- `libs/ui/registry/ui/divider/divider.tsx:79` — Identical hairline class expression repeated three times in one render

- `libs/ui/registry/lib/accessible-text.ts:16` — Two constants named `NON_NAMING_ELEMENTS` with silently different contents, next to two functions named `isHiddenFromAccessibleName`

- `libs/ui/registry/component-docs/select.ts:113` — select-multiselect-simple duplicates a case already covered by select-multiple and select-display-modes

- `apps/docs/src/components/layout/theme-toggle.tsx:5` — The docs focus-ring recipe is inlined in three files that bypass the shared FOCUS_RING_CLASS constant

- `cli/diffgazer/src/features/review/components/severity-filter-group.tsx:20` — The single-letter severity label map is declared twice in cli/diffgazer under two different names

- `cli/server/src/shared/lib/fs.ts:99` — The temp-write-then-cleanup dance is written three times, and only two of the three explain their empty catch

- `libs/core/src/api/hooks/use-review-lifecycle-base.ts:31` — Base hook's callback seam forces both surfaces to reimplement identical session-cache clearing

- `cli/diffgazer/src/features/onboarding/hooks/use-wizard.ts:49` — Wizard-abandonment cleanup effect is duplicated verbatim in web and TUI instead of living in core's useWizardState

- `cli/diffgazer/src/features/review/components/metrics-footer.tsx:11` — The per-metric emphasis rule (elapsed→info, issues-found>0→warning) is re-implemented on both surfaces around the shared row builder


### slop (23)

- `apps/web/src/features/home/components/presentation.tsx:127` — `isMountedRef` plus its lifecycle effect are dead — the sibling ref check already covers unmount

- `apps/web/src/features/providers/components/list.tsx:172` — Two dead guards on values that are never falsy in the provider row

- `apps/web/src/features/providers/components/list.tsx:103` — Redundant second lookup and guard after a successful `findIndex`

- `apps/web/src/hooks/use-theme.tsx:22` — Dead SSR guards in a client-only SPA

- `apps/web/src/lib/api.ts:6` — `getDefaultApiUrl`/`getShutdownToken` branch on a no-window case that cannot happen

- `cli/diffgazer/src/features/providers/components/api-key-overlay.tsx:76` — handleMethodChange forwards to setMethod with no added logic

- `cli/diffgazer/src/components/ui/scroll-area.tsx:168` — Constant bound to a variable one line before its only use

- `apps/landing/src/effects/copy.ts:37` — Revert timer re-checks three conditions that cannot be false when it runs

- `apps/docs/src/components/page-layout.tsx:100` — Description guard re-tests the condition its own boolean already encodes

- `libs/registry/src/docs-data/build.ts:104` — `findExamplesFn: findExamples` passes the parameter's own default value

- `libs/core/src/review/presentation/issue.ts:64` — Redundant `String()` calls inside template literals

- `libs/ui/registry/ui/accordion/accordion-context.tsx:32` — Template JSDoc restating the identifier on internal context helpers

- `libs/ui/registry/ui/command-palette/use-command-palette-state.ts:67` — Alias constant that only renames an import

- `libs/ui/registry/ui/logo/figlet-text.ts:37` — Nullish fallback contradicts the declared module type and needs a cast to compile

- `libs/ui/registry/ui/code-block/code-block-highlight.tsx:129` — Source is split into lines twice per render

- `libs/ui/registry/ui/tabs/tabs-context.tsx:6` — `encodeIdPart` is a pure forwarding wrapper around `encodeURIComponent`, and a third id-encoding scheme

- `libs/ui/registry/ui/menu/menu-item-layouts.tsx:122` — Prop JSDoc copy-pasted from `MenuProps` describes the wrong thing on the internal layout props

- `libs/ui/registry/ui/spinner/use-animation.ts:8` — `UseSpinnerAnimationOptions.speed` doc copied from `SpinnerProps.speed` and now false

- `libs/ui/registry/ui/menu/menu-item-checkbox.tsx:141` — `|| undefined` on a CVA boolean variant that already declares a `false` case

- `libs/ui/registry/ui/menu/menu-sub.tsx:322` — Fallback that cannot trigger, and would highlight an empty item id if it did

- `libs/ui/registry/hooks/overlay-dismiss-stack.ts:74` — Length guard around `Array.prototype.includes` that can only produce the value it guards against

- `libs/ui/registry/hooks/use-floating-indicator.ts:23` — useFloatingIndicator's JSDoc claims it "owns the CSS-escape of activeValue" but no CSS escaping exists in the implementation

- `cli/server/src/features/review/router/history.ts:23` — .passthrough() on the reviews list query schema has zero observable effect


### yagni (19)

- `apps/web/src/features/providers/hooks/use-providers.ts:4` — `useProviders` is a rename-only pass-through with a single consumer

- `apps/web/src/features/history/components/timeline-list.tsx:30` — Single-use one-line wrapper around `pluralize`

- `cli/diffgazer/src/components/ui/spinner.tsx:11` — Spinner's `variant` prop has zero non-default consumers; two of its three mappings are dead

- `cli/diffgazer/src/lib/servers/factories.ts:11` — One-field base interface `ServerFactoryOptions` exists only to be extended once

- `apps/docs/src/lib/generated-doc-data.ts:115` — Generic parse-and-label helper wrapping a single call

- `cli/server/src/features/review/engine/orchestrate.ts:233` — `partialOnAllFailed` is an extensibility flag whose only caller always passes `false`, making its whole branch unreachable

- `cli/server/src/features/review/context/workspace/discovery.ts:40` — `WorkspaceRoot.includeSelf` / `includeChildren` are config knobs with a single constant value, leaving two dead branches

- `cli/server/src/features/review/context/snapshot/build.ts:12` — `withSnapshotLock` is a pass-through wrapper around a lock that is itself used once

- `libs/registry/src/cli/workflows/diff.ts:53` — `renderChangedFile` is an injection point whose only value is a function defined in the same file

- `cli/add/src/utils/transform.ts:200` — `rewriteRelativeJsExtensionsForCopy` is a rename-only wrapper around `stripRelativeJsExtensions`

- `libs/registry/src/cli/workflows/remove/transaction.ts:178` — `deleteRemovalFiles` re-passes `options.cwd` as a separate argument and restates `DeleteResult` inline

- `libs/core/src/schemas/errors.ts:55` — `createDomainErrorSchema` carries an `includeDetails` option with zero call sites

- `libs/core/src/testing/match-media.ts:102` — Two exported pass-through wrappers around `installMatchMedia`, one of which discards its return value

- `libs/ui/registry/ui/diff-view/diff-view-split.tsx:241` — disableWordDiff is threaded through two component layers for a guard that can never fire

- `libs/ui/registry/ui/select/selection.ts:28` — `isActiveOptionVisible` takes a `matches` callback that all five call sites pass `matchesSearch` to

- `libs/ui/registry/testing/css-contract.ts:33` — `ruleBody` is a rename-only pass-through to the private `blockAfter`

- `apps/web/src/components/shared/severity/constants.ts:16` — BAR_FILLED_CHAR / BAR_EMPTY_CHAR restate BlockBar's own defaults and are passed back into it at the single call site

- `cli/server/src/features/git/router.ts:11` — The entire /api/git feature has no first-party consumer

- `libs/registry/src/docs-sync/sync.ts:17` — syncSchemaVersion is a public option that no caller ever sets


### naming (19)

- `apps/web/src/features/providers/components/model-select-dialog/use-dialog-focus-trap.ts:30` — `useModelDialogFocusTrap` is not a focus trap; AGENTS.md reserves that term for libs/keys

- `apps/web/src/features/review/hooks/use-issue-selection.ts:38` — `selectedIssueId` and `highlightedIssueId` are the same value under two names

- `apps/web/src/features/history/components/page.tsx:102` — `activeRunId` is a bare alias for `selectedRunId`

- `apps/web/src/types/focus-element.ts:1` — `FocusElement` is a generic-sounding shared type that is really the API-key form's focus targets

- `cli/diffgazer/src/features/history/lib/run-mapping.ts:1` — run-mapping.ts contains no run mapping — it is the history focus-zone module

- `cli/diffgazer/src/features/review/components/api-key-missing-view.tsx:76` — The shared ReviewGateView shell lives in a file named after one of its three consumers

- `cli/diffgazer/src/features/providers/components/model-search-input.tsx:14` — Basename does not match the primary export (model-search-input.tsx exports SearchInput)

- `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx:15` — Same wrapped-row helper implemented twice under two names

- `cli/diffgazer/src/features/home/components/home-screen.floor.test.tsx:5` — Path-echo test filename breaks the split-test convention used by every other slice

- `apps/docs/src/hooks/search-context.tsx:91` — useSearchOpen returns the whole context and its error message is wrong for two of its three callers

- `apps/docs/src/mdx-components.tsx:9` — Duplicate basenames between docs-mdx/ and docs-mdx/blocks/, reconciled by import aliases

- `cli/server/src/shared/lib/ai/models-dev-catalog.ts:172` — `ProviderModelsResult` is an alias for `ProviderModelsResponse` that adds no meaning

- `libs/registry/src/cli/fs/tsconfig-paths.ts:234` — `readTsConfig` is used to parse `package.json`

- `libs/keys/src/hooks/focus-trap-controller.ts:233` — Tab-cycling code names its tabbable list `focusableEls`

- `libs/ui/registry/ui/select/select-value.tsx:59` — `MultiValue` is the render path for single-select values too

- `apps/web/src/app/providers/app-providers.tsx:14` — A one-file directory whose basename repeats both of its path segments

- `apps/web/src/features/settings/components/settings-form-actions.tsx:18` — Four files inside features/settings/ prefix themselves with "settings"

- `libs/registry/src/cli/command-factories/shared.ts:10` — Grab-bag basename shared.ts next to five command-named siblings

- `apps/docs/src/lib/load-doc-data.test.ts:10` — Fixture advertises a token vocabulary that does not exist (--syntax-keyword, code-fn)


### organization (13)

- `cli/diffgazer/src/features/review/components/severity-filter-group.tsx:47` — Cross-component layout math lives in a component file while the feature has lib/ for exactly this

- `cli/diffgazer/src/hooks/use-exit.ts:33` — A React provider lives in hooks/ as a .ts file and is written with createElement to dodge JSX

- `apps/docs/src/components/layout/sidebar.tsx:126` — Cross-feature shared class constant lives inside the DocsSidebar module

- `cli/server/src/shared/lib/ai/models-dev-sample.ts:5` — A 110-line test fixture lives in the production `shared/lib/ai/` directory and ships in the bundle

- `libs/registry/src/cli/registry.ts:60` — `REGISTRY_ORIGIN` is re-exported through `cli/registry.ts` purely as a hop

- `libs/core/src/review/index.ts:1` — `formatRunId` is re-exported from the review barrel, splitting one formatter family across two public subpaths

- `libs/keys/src/providers/keyboard.tsx:37` — `HandlerOptions` re-export chain through the provider component module

- `libs/ui/registry/lib/horizontal-stepper-variants.ts:1` — Single-consumer variant module parked in shared registry/lib, against the repo's own documented rule

- `libs/ui/registry/hooks/use-composed-refs-docs.test.ts:9` — Docs-content guard parked in the hook source tree under a hook-shaped filename

- `libs/ui/registry/component-docs/stepper.ts:67` — Stepper and HorizontalStepper document the same variant axis twice — an interactive switcher plus one static example per variant

- `apps/web/src/features/history/components/page-test-utils.tsx:1` — Three competing conventions for feature-local test helpers across the mirrored web/TUI slices

- `cli/add/src/commands/remove.ts:19` — `remove` subcommand is both a file and a same-named folder, unlike `add`

- `cli/diffgazer/src/features/providers/components/model-select-overlay.test-harness.tsx:1` — Four different naming idioms for the same concept: shared test fixtures


### overengineering (12)

- `apps/web/src/features/onboarding/components/steps/model-step.tsx:29` — Two stacked single-use prop-forwarding wrappers around one `RadioGroup`

- `apps/web/src/app/route-error-boundary.tsx:112` — Four-level single-consumer wrapper chain around one error boundary

- `cli/diffgazer/src/features/providers/lib/overlay-footer-gate.ts:6` — A lib module plus a dedicated test file for a three-term boolean AND

- `cli/diffgazer/src/components/ui/input.tsx:44` — Input forwards eight props to a single-use ManualTextEdit through a no-op handleChange wrapper

- `libs/core/src/schemas/presentation/progress.ts:5` — Presentation view-model types are declared as zod schemas that never validate anything

- `libs/core/src/schemas/git.ts:7` — `schemas/git.ts` builds three zod schemas that nothing in the repo ever parses

- `libs/ui/registry/ui/button/button.tsx:15` — Button code-splits its own Spinner behind Suspense with a null fallback

- `libs/ui/registry/ui/navigation-list/navigation-list-group.tsx:154` — `useNavigationListGroupHeader` is a single-use hook that returns one of its own arguments untouched

- `cli/diffgazer/src/features/settings/lib/derive-storage-save-state.ts:16` — Single-use wrapper around deriveSaveState that adds one boolean clause and two mirror types

- `cli/diffgazer/src/lib/servers/factories.ts:11` — One-property base interface with exactly one extender

- `cli/server/src/shared/lib/ai/openrouter-models.ts:53` — Raw-API model mapper carries camelCase alias fallbacks for fields OpenRouter never sends

- `apps/web/src/features/settings/hooks/use-settings-form-footer.ts:38` — useSettingsFormFooter's canSave option is a third guard on a condition already enforced twice


### testing (8)

- `apps/web/src/components/layout/footer.integration.test.ts:23` — React test written in `.ts`, forcing `createElement` noise, with two near-identical builders

- `cli/diffgazer/src/features/providers/components/model-select-overlay.test-harness.tsx:101` — Wrapper mints a new QueryClient and api on every render; StableWrapper is a copy-paste workaround

- `cli/diffgazer/src/features/onboarding/hooks/use-wizard.ts:171` — toggleFocusArea is exported from the hook result only so the test can drive an internal step

- `libs/ui/registry/lib/step-status.test.ts:18` — Test asserts a constant equals a verbatim copy of its own definition

- `cli/diffgazer/src/lib/servers/process-shutdown.test.ts:7` — process/ has three source files and zero tests; its three tests sit one directory above under invented names

- `cli/diffgazer/src/features/home/components/home-screen.floor.test.tsx:1` — One floor test out of five prefixes its feature name, breaking the row

- `cli/add/src/commands/remove/dependencies.ts:65` — `manifestAbsent` recovery branch in `expandRemoval` is the one uncovered path in the removal-safety logic

- `apps/web/src/styles/theme-overrides.test.ts:36` — CONTRAST_VALUES duplicates the CSS hexes so the test asserts the CSS equals itself


### type-safety (8)

- `cli/diffgazer/src/features/history/lib/run-mapping.ts:4` — MappedRun is a bare alias of HistoryRunSummary that adds no meaning

- `cli/server/src/shared/lib/config/transaction/file-lock.ts:47` — `ObservedDirectoryLock` re-declares the `kind: "directory"` member of `ObservedLock` field-for-field

- `libs/core/src/providers/use-provider-models-mapped.test.ts:26` — `as unknown as BoundApi` double casts where the helper already accepts `Partial<BoundApi>`

- `libs/keys/src/providers/keyboard-context.ts:97` — useKeyboardContext leaks internal registry members at runtime

- `libs/ui/registry/ui/code-block/code-block-highlight.tsx:15` — HastNode union is shaped so TypeScript cannot narrow it, forcing four `as` casts

- `libs/ui/registry/ui/status-indicator/status-indicator.tsx:37` — `Omit<VariantProps<typeof statusIndicatorDotVariants>, "status" | "pulse">` resolves to `{}`

- `libs/ui/registry/ui/switch/switch.tsx:222` — `React.MouseEvent` uses the UMD global namespace while the same files import every other React type by name

- `cli/add/src/context.ts:76` — Manifest types and the integration-mode union are hand-restated instead of derived


### kiss (5)

- `apps/web/src/features/home/components/presentation.tsx:102` — IIFE for a decision the sibling settings hub already expresses as a named function

- `cli/server/src/shared/middlewares/trust-guard.ts:14` — `requireRepoAccess` reads the project trust twice per request for two checks that overlap

- `libs/registry/src/docs-sync/docs-libraries-config.ts:35` — A throwing assertion is wrapped in try/catch twice to serve as a boolean zod refinement

- `libs/ui/registry/ui/progress/progress.tsx:68` — Three-step value normalisation whose first two steps are dead in the indeterminate branch

- `libs/ui/registry/hooks/use-active-heading.ts:6` — `(number & {})` in a public type is the string-literal-widening idiom applied where nothing can widen


### error-handling (5)

- `cli/server/src/features/review/router/sessions.ts:39` — The 415 handler hand-rolls the error envelope because 415 is missing from the `ErrorStatus` allowlist

- `cli/server/src/shared/lib/config/store.ts:631` — `prepareAggregateRead()`'s Result is silently discarded in three getters but propagated in a fourth

- `libs/ui/registry/ui/code-block/code-block-copy-button.tsx:78` — Clipboard availability pre-check bypasses the hook's own failure path

- `libs/ui/registry/ui/toast/use-container.ts:9` — Silent try/catch around `node.matches(":hover")` with no stated reason

- `cli/server/src/shared/lib/fs.ts:99` — One of three identical empty catches lacks the rationale its siblings carry


### react (4)

- `libs/ui/registry/ui/avatar/use-image-status.ts:23` — Effect re-syncs state that the render body already derives

- `libs/ui/registry/ui/avatar/avatar.tsx:68` — Effect used only to relay a state change to a consumer callback

- `libs/ui/registry/ui/toggle-group/toggle-group.tsx:206` — ToggleGroup is the only selectable group that omits controlled-mode detection for its highlighted prop

- `libs/ui/registry/ui/command-palette/use-command-palette-state.ts:178` — Context-value useMemo can never cache because navKeyDown is a fresh closure every render


### architecture (3)

- `cli/server/src/shared/lib/testing/factories.ts:1` — shared/ test factory imports a feature type and re-exports core factories, serving only the review feature

- `cli/server/src/shared/lib/testing/factories.ts:1` — shared/ imports features/, the exact direction the codebase elsewhere says it must not

- `libs/registry/src/imports/relative-js-imports.ts:17` — Writer and gate for the no-.js-imports contract use different matchers with different semantics


### srp (2)

- `cli/server/src/shared/lib/config/store.ts:84` — store.ts is 1088 lines because a self-contained secrets-recovery WAL module sits in front of the config-store closure

- `libs/core/src/api/hooks/use-review-lifecycle-base.ts:54` — Base result exposes raw setHasStarted/setHasStreamed setters instead of a reset() operation


### correctness (1)

- `libs/registry/src/docs-data/build-hooks.ts:51` — Artifact output ordering uses `localeCompare` in the files that produce docs artifacts, against the repo's own documented rule


### performance (1)

- `apps/web/vite.config.ts:12` — The web app's explicitly configured 750 kB chunk budget is breached on every build, so the warning is now permanent noise


## Per-area notes (what is notably clean)


### web-features — 16 confirmed, 2 rejected

Overall this area is in good shape and clearly has had a deliberate quality pass. Zero `as any`, zero `@ts-ignore`, zero `TODO`/`FIXME`, zero `console.*`, zero non-null assertions across all ~90 non-test files. No AGENTS.md boundary violations: nothing in `features/` imports from `cli/*` or `libs/*` internals, domain logic consistently lives in `libs/core` (`buildHomeContextInfo`, `resolveHomeMenuActivation`, `deriveLensSelectionState`, `useHistoryScreenState`, `useIssueDetailsState`, `classifyReviewStreamError`, …) and the feature files are thin adapters over it. No internal barrel files. Components compose `libs/ui` and `libs/keys` rather than reimplementing list navigation, roving focus or ARIA wiring, exactly as the Extraction Rules require.

Notably clean: React discipline is unusually good — derived state is computed during render with the prev-state-comparison pattern (`use-issue-selection.ts`, `use-details-tab-keyboard.ts`, `review/components/page.tsx` route-key reset, `use-stream-liveness.ts`) instead of sync effects; every retained effect is real external synchronization (scroll position, timers, focus repair, DOM measurement) and the two `biome-ignore useExhaustiveDependencies` suppressions both carry a specific, checkable reason. `useReviewClock` is a genuinely good call — one tick provider so the metrics timer, tail row and liveness notice cannot disagree. Comments overwhelmingly explain *why* (layout constraints, a11y trade-offs, breakpoint decisions), not *what*; there is essentially no comment slop. Tests use role/label queries, and every `fireEvent` carries the rationale `test:scripts` requires.

Where the noise is: the keyboard layer. Five of the six largest files are focus-zone machines (`use-results-keyboard.ts` 378 lines returning 25 keys, `use-dialog-keyboard.ts` 365, `use-keyboard.ts` 261/241). They are decomposed sensibly and each sub-hook is documented, but the seams between them are where the duplication and divergence in my findings cluster — the three `getActionProps` wrappers, the bypassed `findFilterChip`, the two `handleMethodKeyDown` implementations (2 sites, left alone per the 3+ rule). If anything else gets touched here, making those seams consistent is the highest-value cleanup.

Files whose purpose was not evident within 30 seconds: `review/components/activity-log/row-index.ts` — the incremental paging index is the one place in the area where I had to reconstruct the design intent from `libs/core/src/review/event-sequence.ts` to conclude the pages buy nothing (reported). `providers/components/model-select-dialog/use-dialog-focus-trap.ts` — the filename actively pointed me at the wrong concept until I read the body (reported). Two files share the generic basename `page-test-utils.tsx` (`history/components/`, `settings/components/diagnostics/`) and each mixes fixtures, API mocks, render wrappers and query helpers; not reported as a finding since colocation is permitted by the taxonomy and both are readable, but the name tells you nothing and `module-level `export let` mocks are an unusual convention worth a one-line note if either file grows.


### web-shared — 14 confirmed, 3 rejected

Overall this shared tier is in good shape and clearly has had a deliberate pass over it. Zero `as any`, zero `@ts-ignore`, zero TODO/FIXME, zero AI-voice words, no `fireEvent`, no dead imports, no commented-out code. The comment discipline is unusually good: nearly every comment in `header.tsx`, `path-value.tsx`, `back-navigation.tsx`, `shutdown.ts`, `config-guards.ts`, `test-setup.ts`, `utils/download.ts` and `styles/index.css` states a constraint the code cannot show (why a Record instead of CVA, why the figlet is precomputed, why the revoke is deferred a task, why no blanket overscroll-behavior). The one Tailwind-class assertion in `severity/breakdown.test.tsx` carries an explicit sanction comment, and mock usage across the test files is disciplined and annotated with "Boundary mock:" rationales.

Notably clean: `lib/` is genuinely thin and single-purpose per file (`back-navigation.ts`, `shutdown.ts`, `catalog-fallback-notice.ts`, `main-content.ts`), `components/layout/*` composes `libs/ui` rather than reimplementing it, and `hooks/use-scoped-route-state.ts` carries the single best explanatory docstring in the area (the useSyncExternalStore non-primitive-default trap). `testing/reticle.ts` is not a duplicate of `libs/ui/registry/testing/reticle.ts` — it is a deliberate app-level superset, and the lib file says so.

Main themes in the findings: (a) genuinely dead surface in the app's central config context, kept alive by a test; (b) a guard test that mocks and asserts on an API method the code under test never calls; (c) SSR-shaped defensive branches in a surface that has no SSR; (d) a few places where the "why" is real but unstated (not-found title, double dialog guard, node-builtin indirection in the CSS parity test).

Files whose purpose I could not work out from name plus code alone: `apps/web/src/styles/theme-overrides.test.ts` — the CSS is regex-parsed and node builtins are pulled in through string variables with a locally-declared `process`, and nothing says why either is necessary (reported). Everything else in the area resolved within the 30-second budget.


### tui-features — 19 confirmed, 5 rejected

Overall the Ink TUI feature slices are in good shape and clearly better than average AI-touched code. No `as any`, no `@ts-ignore`, no commented-out code, no AI-voice comments ("robust"/"ensure"/"graceful" all absent), no TODO/FIXME, no section dividers. Every one of the four `biome-ignore` directives carries a specific reason. There are zero cross-feature imports (`features/x` never reaches into `features/y`), and no `libs/core`/boundary violations — the slices consume `@diffgazer/core`, `@diffgazer/keys` and local `components/ui` exactly as AGENTS.md prescribes.

Notably clean:
- **Terminal layout math.** `history/lib/pane-layout.ts`, `review/lib/pane-geometry.ts`, `review/components/progress-view/overview.tsx`, `review/components/severity/ribbon.tsx` and `review/components/progress/list.tsx` are the strongest work in the area. Every magic row-count constant is named and each one carries a comment stating the Ink constraint it encodes (orphaned borders from half-drawn boxes, yoga zeroing a row when a deficit spreads, wrapped chip rows costing viewport rows). These pass the Maciek test cleanly — this is the class of code that would normally be inscrutable and instead is the most readable part of the tree.
- **React discipline.** Derived-during-render is used consistently instead of effect-synced state (providers/components/screen.tsx:96-102 and review/components/severity-filter-group.tsx:80 both say so explicitly). `useEffectEvent` is used correctly for reset-on-open in both overlays. There is no defensive `useMemo`/`useCallback`/`memo` anywhere in the area.
- **Ink-specific hacks are explained.** The two overlay reset effects, `SearchInput`'s cursor block, the `columnGap`-not-`gap` note in severity-filter-group.tsx:120, and `BrowseFooter`'s branch-scoped footer rationale (providers/components/screen.tsx:35-39) all have the one sentence they need. The main gaps I found are siblings of that pattern that were left unexplained: `HomeMenuWithFooter` (the same footer trick, spelled differently and undocumented) and the double guards in `review/components/container.tsx`.
- **Tests.** No `fireEvent` anywhere, no Tailwind-class assertions (N/A for Ink), and the frame-level tests (`review-facts.test.tsx`, the `.floor.` suites, `settings-fold-safety.test.tsx`) test real rendered output at fixed terminal sizes, which is the right contract for a TUI. Exceptions I flagged: the `isOverlayFooterNavActive` truth-table test, the `handleOpenReview` assertion keeping dead code alive, and the `toggleFocusArea` implementation-detail test.

Themes behind the findings: (1) a handful of exports/props survive only because a test still references them (`handleOpenReview`, `toggleFocusArea`, `contextOutputDirectory`, `cleanupEarlySave`); (2) the providers/onboarding model-picking paths duplicate catalog-fallback copy that `libs/core` should own — this is the one finding with real cross-surface drift already visible; (3) a few files put non-render logic (fs writes, chip-row budgets) in `components/` while the same slice has a `lib/` for it.

No file's purpose was opaque to me. The two I had to work hardest to reconstruct were `providers/lib/overlay-footer-gate.ts` (the F-347b comment carries the whole file — see the finding) and `providers/components/model-select-overlay.test-harness.tsx`'s `Wrapper`/`StableWrapper` split, where the reason for the second component is only discoverable by noticing that the first recreates its QueryClient per render.


### tui-shared — 17 confirmed, 0 rejected

Overall this area is in good shape and clearly reviewed already. What is notably clean: zero `as any`, zero `@ts-ignore` without a reason, zero TODO/FIXME, and a repo-wide grep for AI-voice markers ("robust", "ensure", "graceful", "comprehensive", "seamless") returns nothing in the whole non-features scope. Comments are almost uniformly load-bearing — `theme/chrome.ts` is exemplary (each helper states the design constraint and the measured contrast ratios), and `hooks/use-terminal-dimensions.ts`, `lib/servers/process/termination.ts`, `lib/servers/process/server.ts` (the `detached` comment), `config.ts` (why gracefulMs must exceed forceKillMs) and `app/startup-theme-sync.tsx` all explain the non-obvious constraint rather than restating code. `lib/get-figlet.ts` explicitly documents why it deliberately diverges from the libs/ui counterpart, which pre-empts a false duplication report.

Tests in the area are strong: they assert rendered frames and user-visible text rather than internals, mocks are labelled "Boundary mock:", and `theme/provider.test.ts` and `components/layout/header.test.tsx` test real behaviour contracts. The DI seams in `lib/servers/factories.ts` and `lib/servers/process/server.ts` (`spawn`, `maxBuffer`, `forceKillMs`, `getCwd`, `findGitRoot`) all have exercising tests, so they are not speculative extensibility. Architecture boundaries hold: nothing in scope imports from `apps/*`, `libs/ui`, or `cli/add`; `libs/keys` is consumed only for `moveHighlight`; single-surface helpers (`breakpoints`, `get-figlet`) sit in the TUI as AGENTS.md prescribes.

Where the area is weakest is comprehensibility of three genuinely hard mechanisms that carry no explanation at all: `lib/terminal-input.ts` (ESC-prefix hold + "legacy-modified" classification + stdin Proxy), the `isMeasuringContent`/`contentReference` two-pass measure in `components/ui/scroll-area.tsx`, and `lifecycleVersion` in `lib/servers/process/server.ts`. These are the siblings of the THEME_INIT_SCRIPT pattern in this area — all three are correct code that a cold reader cannot justify, and all three are fixable with one sentence each rather than a refactor.

Files whose purpose I could not fully work out from name + code alone: `lib/terminal-input.ts` (I reconstructed the intent from the parser and the test harness, but the file itself never states it) and the measurement half of `components/ui/scroll-area.tsx`. Everything else in the scope read clearly on a first pass.

Two things I checked and deliberately did NOT report as findings: (1) `GateFrame` in `app/root.tsx` and `GlobalLayout` in `components/layout/global.tsx` both call `isTerminalTooSmall` — this is not redundant duplication, because the gate screens (spinner/error) render before `GlobalLayout` mounts and both paths are independently exercised by tests; (2) `SectionHeader`'s `default` variant, which I initially suspected was dead — 19 of 43 call sites use it.


### docs-landing — 20 confirmed, 8 rejected

Overall the area is in strong shape — noticeably better than a typical docs+marketing pair. No architecture violations: apps/docs imports only @diffgazer/{core/testing, keys, registry, ui} and nothing from apps/* or cli/*; apps/landing's UI-only boundary is enforced by its own boundary.test.ts and holds. Zero `as any`, zero unexplained `@ts-ignore`, zero TODO/FIXME, no commented-out code, and every retained `fireEvent` carries the rationale AGENTS.md requires.

Notably clean: `lib/page-tree.ts` and `lib/library.ts` are pure, well-named, thoroughly tested transforms with comments that explain constraints rather than restate code. `lib/server-inputs.ts` is a tight validation boundary with every export consumed. The landing `effect-scope.ts` / AbortSignal discipline is genuinely good — every effect is teardown-safe, the reduced-motion flip restarts the whole graph cleanly, and `effects/lifecycle.test.ts` pins that contract. `apps/landing/src/accessibility.test.ts` and `deployment.test.ts` test real user-visible/deployment contracts rather than internals. The `security-headers.ts` split (base headers via routeRules, per-request CSP with a nonce from server.ts, node:async_hooks kept out of the client bundle via the csp-nonce bridge) is correct and justified — the only gripes are naming and one comment that names a nonexistent rule.

On the mandatory probe: THEME_INIT_SCRIPT is no longer the mystery the owner hit. `theme-bootstrap.ts` now explains why it must stay self-contained, why the theme-color meta is created imperatively (React 19 hoistable dedup), and why the whole body is one try/catch; `routes/__root.tsx` explains ScriptOnce, the nonce, self-removal, and `suppressHydrationWarning`. That documentation debt is paid. What remains is a complexity question, filed above: the MutationObserver that relabels the theme toggle during head-time parse is the one piece whose cost (document-wide observer on the critical path + a hydration-suppression on a live control + a documented fragility if the button ever gains a non-text child) exceeds its benefit (a sub-frame-correct label on one chrome control). Everything else in that bootstrap is the simplest correct version.

Docs-only utilities are not drifting toward library code — `lib/` holds page-tree adaptation, doc-data loading, SEO, and consumption metadata, all genuinely docs-shaped. The one place the boundary leaks the wrong way is `components/layout/footer-pager.tsx`, which re-implements focusable/interactive-element detection that `libs/keys` owns and exports.

Landing's effects respect the prefers-reduced-motion contract consistently: every `init*` takes `Flags`, branches to a settled state under `reduced`, and `bootstrap.ts` tears the whole graph down and rebuilds it when the preference flips at runtime — which is more than the contract asks for and is tested. The complexity is real but proportionate to a hand-written motion layer; my findings there are duplication and one over-guarded timer, not the architecture.

Files whose purpose I could not fully work out: (1) the `biome-ignore format: Phase 10 accept checks quoted section keys` in `features/search/components/dialog.tsx:28` — "Phase 10" resolves to nothing in the repo and I could not find any check that inspects quoting; (2) the `A3` prefix in `components/inset-preview-pane.tsx:7`; (3) why `provider-catalog-copy.test.ts` and `results-guide.test.ts` sit at `src/` root when both read only from `apps/docs/content/` — the provider one is clearly a privacy-disclosure guard, but its home means MDX editors will never see it.


### server — 22 confirmed, 5 rejected

Overall this is one of the more disciplined areas I've read. The Hono taxonomy in AGENTS.md is followed exactly: `createApp()` in app.ts, runtime entries split out, `features/<domain>/{router,service,schemas}` mounted via `app.route()`, colocated zod schemas with `zValidator`, no Rails controllers, `shared/{lib,middlewares}`. No boundary violations: nothing under `cli/server/src` imports from `apps/*` or other `cli/*` packages, and the one place `shared/` would have needed `features/` (review re-keying on project move) is solved correctly with a composition-root hook registered in `app.ts` and explained in a comment.

Notably clean: `app.ts` (the security middleware chain, the split-dev token decision and the `onError` rationale are all explained in "why" comments, not restated code); `shared/lib/http/response.ts` (the closed `WireErrorCode` union making an out-of-vocabulary error code a compile error is a genuinely good contract) and `store-error.ts`'s exhaustive `never` switch; `stream/store.ts` and `stream/replay.ts`, where the `StatusHashKind` discriminant, the event-cap overwrite rule and the subscribe-before-snapshot race window all carry precise comments that justify non-obvious code; `git/service.ts`'s `SANITIZED_GIT_ENV_KEYS` / `HARDENED_BASE_ARGS` (explains *why* keys are deleted rather than blanked); `transaction/file-lock.ts` and `transaction/mutex.ts`. Type safety is strong throughout — the only `@ts-expect-error` occurrences in the whole tree are three deliberate negative type tests in test files, each with a written reason, and there is not a single `as any`.

The real weight of my findings is dead/test-only code rather than bad code. Four clusters of it: the un-shipped `listReviews`/`listFromIndex` path in reviews.ts, the unused half of the `createCollection` factory, five test-only persistence write paths (three of which bypass the file lock and are therefore active footguns), and a handful of test-only exports (`ensureIssueEvidence`, `deleteSession`, `MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES_PER_REVIEW`, `createPromptFileIdentities`). The second theme is error-shape inconsistency at the router layer: `handleStoreError` exists in `features/review/errors.ts` but config and settings hand-roll the identical block eleven times, and one route hand-rolls a 415 envelope because 415 is missing from the `ErrorStatus` allowlist.

Files whose purpose took real effort to reconstruct, in case others hit the same wall: `features/review/storage/rekey.ts` — the `isRecoveryAttempt` / `migrationFailed` / "retain the source index as the durable retry set" protocol is correct and heavily commented, but there is no single sentence stating the invariant the whole file upholds ("the source index may only be deleted once the destination index provably contains every id this pass claimed"); a one-line summary at the top would pay for itself. `shared/lib/config/store.ts` — the interaction between `prepareAggregateRead`, `canReadInitialState`, `startupRecoveryError` and `activeSecretsRecovery` is the hardest thing in the area; the individual comments are good but the four-state machine they collectively implement is never named. Everything else I could account for.


### add-registry — 14 confirmed, 3 rejected

Scope covered: all 46 files under `cli/add/src` (excluding `generated/`) and all 128 files under `libs/registry/src`, sources and tests.

**Notably clean.** This is the most disciplined area I'd expect to find in the repo. Zero `as any`, zero `@ts-ignore`, zero TODO/FIXME, zero section-divider comments, and zero AI-voice vocabulary across ~23k lines. The comments that exist almost all earn their place by stating a constraint the code cannot show — `cli/add/src/context.ts:201-205` (why `keys-version.json` is read at runtime rather than imported), `cli/add/src/commands/diff.ts:33-40` (why SIGINT/SIGTERM need their own scratch-dir handlers when `process.on("exit")` does not fire), `cli/add/src/commands/remove/css.ts:90-95` (why remove state lives in an object instead of module bindings), `libs/registry/src/cli/file-write-rollback.ts:59-63` (why rollback must track the whole mkdir chain), `libs/registry/src/utils/compare-code-units.ts` (why not `localeCompare`), and `cli/add/src/utils/keys-copy-bundle.ts:111-118` (why this is deliberately *not* `resolveKeysHookFiles` from build-checks). That last one is the model answer to the "Maciek test": two near-identical functions, one comment, no confusion. The transaction/rollback discipline is genuinely strong — every mutating path (`add` finalize, integration-mode migration, retired-ownership reconciliation, remove, init) snapshots, rolls back, and reports incomplete rollback via `AggregateError` rather than swallowing it. Path safety is layered consistently (`isRelativeSubpath` → `resolveInside`/`ensureWithinDir` → realpath check) rather than ad hoc.

**What feels off.** Three themes, all structural rather than sloppy:
1. `libs/registry/src/cli/command-factories/*` is the weakest module. All five factories exist to serve one consumer (`cli/add`), and two of them (`remove`, `diff`) re-type their workflow's whole option interface and then copy it across field by field. AGENTS.md sanctions `libs/registry` owning "shared CLI workflow helpers", so the *location* is fine — the hand-copying is not.
2. Public export hygiene at the package boundaries has drifted: three exported symbols (`updateManifest`, `CopyBundleItemSchema`, `computeInputsFingerprint`) plus one returned method (`itemAccessors.validate`) have no consumer.
3. The ownership-metadata edge cases the task asked me to watch for are largely well tested (`ownership-reconciliation.test.ts` covers the v1-manifest adoption path end to end; `remove-transaction.test.ts` covers three rollback races; `remove/css.test.ts` covers drifted-chunk retention). The one real gap is `cli/add/src/commands/remove/dependencies.ts`, which has no test at all despite implementing the cascade/block rule AGENTS.md calls out by name.

**Command handlers holding domain logic.** Checked specifically per the brief and it is clean: `commands/list.ts`, `commands/diff.ts`, and `commands/remove.ts` are wiring, with domain logic in `utils/` (`css-chunks`, `namespaces`, `keys-copy-bundle`, `registry`, `transform`) or in `commands/<cmd>/` folders as the taxonomy allows. The one misfiled thing is `createRemoveWorkflowContext` sitting in `commands/remove/css.ts` (reported).

**Transform/validation duplication between the two packages.** Also checked: `cli/add/src/utils/transform.ts` (alias rewriting) and `libs/registry/src/imports/*` (lexer-based specifier extraction) do genuinely different jobs and share `stripRelativeJsExtensions` correctly. The only true cross-package duplication is the keys prefix constant (reported). `registry-types.ts:31-32` even carries a NOTE explaining why the installer schema in `cli/registry.ts` is deliberately a near-duplicate — correct call, correctly documented.

**Files whose purpose I could not fully work out.** None, with two near-misses I resolved by reading rather than guessing: (a) `libs/registry/src/imports/import-specifier-lexer.ts` + `jsx-source-mask.ts` (423 + 157 lines of hand-written tokenizer) look alarming until you see they exist so `.js`-looking text inside JSX raw text, template literals, and regex literals survives byte-identical — that constraint is stated on `stripRelativeJsExtensions` but not on the lexer itself, which would benefit from a one-line header pointing back; (b) `planIntegrationModeMigration` (reported) is the one function I had to read three times.

**Not reported as findings, deliberately.** `assertInsideProject` (paths.ts:34) is a result-discarding wrapper over `resolveProjectPath` but its comment names the intent ("fail-fast assertion … so traversal errors throw before any IO") and 8 call sites read better for it. `hook-doc-loader.ts` re-checks containment after a regex that already forbids separators — defense-in-depth on a path boundary is the right default. `SharedCommandOptions`' `[key: string]: unknown` index signature weakens the typed fields, but it is required by Commander's options bag and is documented. `cli/add/src/commands/add/manifest.ts` at 355 lines is at the edge of comfortable but every export is manifest-ownership work, so it is cohesive rather than a grab bag.


### core — 14 confirmed, 6 rejected

Overall `libs/core/src` is the strongest-looking area I have read in this repo: ~230 files, zero `as any`, zero `@ts-ignore`, zero `console.*`, zero TODO/FIXME, zero `fireEvent`, no commented-out code, no section-divider comments, and no AI-voice filler. Comments are overwhelmingly load-bearing — they explain constraints the code cannot show (why `step_error` on the `context` step is non-fatal, why `reviewQueries.context` deliberately omits the reviewId from its key, why `sanitizeTerminalText` strips SGR, why line-number refines were removed from `ReviewIssueSchema`, why the web/TUI theme token vocabulary is frozen). The AGENTS.md boundary holds: nothing under `src/` imports from `apps/*` or `cli/*`, and the two-surface parity contracts (theme token keys, `useHistoryScreenState`, `useReviewLifecycleBase`, presentation copy modules) are real shared logic, not speculative abstraction.

Notably clean: `theme/` (token-keys + palette-values, documented parity contract, nothing extraneous), `review/state.ts` (a proper reducer with exhaustiveness guards and per-sub-type handlers), `catalog/transform.ts` and `catalog/provider-overlay.ts` (every non-obvious rule — freshness tiers, free-tier semantics, display-safe ids — is explained in one sentence), `schemas/config/trust-*` (deliberate a11y/security wiring, correctly kept as pure functions), and `api/hooks/match-query-state.ts` (three subtle TanStack states each justified inline). `useTrustEditor`'s render-time key-reset instead of a sync effect, and `use-review-start`/`use-review-completion`'s use of `useEffectEvent`, are exactly what the React Rules section asks for. I checked every `useMemo`/`useCallback` in the package: each one has a real referential contract (e.g. `useReviewSessionCache`'s memo is consumed in an effect dep array at `apps/web/src/features/review/hooks/use-lifecycle.ts:100`), so there is no defensive memoization to report.

Themes behind the findings: (1) zod used as a type-declaration language in places where nothing parses (`schemas/presentation/{progress,timeline,category-stats,analysis}.ts`, all of `schemas/git.ts`); (2) small re-export hops that split one concept across two public subpaths (`formatRunId`, the review `enums.ts` chain); (3) test-harness duplication inside the package that already ships the shared harness.

Files whose purpose I could not work out from name + code within 30 seconds: `review/event-sequence.ts` — the `stream`/`token` WeakMap-of-WeakMaps transition chain is the clearest sibling of the THEME_INIT_SCRIPT class in this area; I only recovered its intent by reading `apps/web/src/features/review/components/activity-log/row-index.ts`. Everything else in the area was legible on its own.

Out of scope but worth flagging to whoever owns docs: `apps/docs/src/testing/match-media.ts` correctly wraps the core stub rather than duplicating it — no action needed there, but it is the reason `stubControllableMatchMedia`'s pass-through shape is visible from two packages.


### keys — 11 confirmed, 4 rejected

Overall this is the strongest-looking area I would expect in the repo: no AI voice, no section dividers, no `as any`, no commented-out code, no empty catches, and only 55 line comments across all non-test source — nearly all of them stating a real constraint the code cannot show (jsdom compound-selector ordering in focusable.ts:127, the `<area>` display:none exception at focusable.ts:48, the `<legend>` spec carve-out at focusable.ts:106, the aria-hidden="false" ARIA rule at focusable.ts:67, the release-ordering rationale in use-focus-trap.ts:54-56 and :97-98, the iframe-owner-document sentinel in keyboard.tsx:206-208). The DOM layer (element-guards.ts, focusable.ts, navigation-items.ts) is genuinely excellent: realm-safe guards, composed-tree traversal, ownerDocument respected everywhere, and the focusable/tabbable split is real and correctly implemented (getFocusableElements includes tabIndex=-1, getTabbableElements filters and collapses radio groups). Editable-target handling is consistently routed through isEditableElement with a documented non-editable input-type set, and the scope-registration-before-dependent-hooks rule holds.

Real problems cluster in three places. (1) `useActionRowNavigation` carries tuple-generic index machinery that no consumer in the monorepo uses — every call site opts back out to the default — while the implementation needs five casts to satisfy it. (2) `providers/keyboard.tsx` reverse-engineers React's `useId()` string format to rank implicit scopes; it is the single least self-explanatory function in the library and has no source-level comment (the explanation lives only in the docs guide). (3) `useFocusZone` splits its state into a validated `safeZone` and an unvalidated `currentZone` and then uses them inconsistently, which produces spurious zone lifecycle callbacks when a controlled zone is not in `zones`.

Naming is clean and semantic throughout (onNavigate / onHighlightChange / onNavigationBoundaryReached / onZoneChange all match the AGENTS.md contract); the one lapse is `focusableEls` holding tabbable elements inside the focus trap's Tab handler.

Files whose purpose took extra digging but that I did work out: `src/playground/*.test.tsx` — they test demos that live outside `src/` (in `libs/keys/examples/playground/`) and self-alias the package via `vi.mock("@diffgazer/keys", () => import("../index.js"))`; they sit under `src/` only because vitest.config.ts's `include` covers `src/`, `registry/` and `scripts/` but not `examples/`. That is a defensible workaround, though a one-line comment at the top of those files (or an `examples/**` include) would save the next reader the same hunt. `core/keys.ts` exports a helper with zero in-repo call sites, but it is a documented public API of a published library with its own docs page and tests, so I did not flag it as dead code.


### ui-comp-a — 22 confirmed, 6 rejected

Scope covered: every file under libs/ui/registry/ui in folders accordion…logo (24 component folders, ~90 source files plus their tests and CSS).

Overall this half of the primitive library is in good shape and clearly above average for a hand-rolled shadcn-style registry. What is notably clean:

- **A11y wiring is real, not cargo-culted.** Dialog's three-path accessible-name resolution with a dev warning, Field's dual seed-from-children + effect-registration model for SSR/first-paint ARIA parity, Checkbox/CheckboxGroup's hidden validation mirrors, CodeBlock/DiffView's sr-only diff prefixes and single-owner live regions — all of these are deliberate, and every non-obvious branch carries a why-comment. None of it should be "simplified".
- **Comment quality is unusually high.** Button's variant block, the command palette's top-pinned-for-software-keyboard rationale, horizontal-stepper-variants' measured window-threshold table, DiffView's `resolvedLineNumbers` reasoning — these are the comments the rest of the repo should be measured against. Every `biome-ignore` in scope states a real reason.
- **Test discipline is strong.** Every `fireEvent` in scope carries the required rationale comment; queries are role/label-based; the class-name assertions that exist (horizontal-stepper container queries, callout touch target, divider opacity) are all cases where the class is the only jsdom-observable form of a documented contract, so they read as justified rather than as implementation coupling.
- **The public/copy/package contract is coherent.** `code-block/highlight.ts` and `command-palette/highlight.ts` are declared package subpaths (not stray barrels), and registry.json dependency closures check out (button→spinner, callout→@diffgazer-keys/focusable).

Where the area is weakest: a handful of places where a primitive quietly grew a second implementation of something the repo already owns — callout re-declaring keys' focusable selector, `matchPositions` re-implementing search folding differently from `matchesSearch`, `useImageStatus` preloading images the rendered `<img>` already loads. Those are the findings worth acting on first. The second cluster is comprehensibility: four spots (CodeBlock's symbol registry, Checkbox's group-item attribute guard, Label's mousedown handler, Breadcrumbs' fragment flattening) where a real constraint is enforced but never stated, each fixable with one sentence — the same class as the THEME_INIT_SCRIPT example.

One cross-cutting item I deliberately reported once rather than 20 times: the templated `/** Reads the X context. */` / `/** React context backing X. */` / `/** Provides X behavior. */` JSDoc. I verified against libs/ui/scripts/jsdoc-metadata-sync that only public `*Props` interfaces and documented hook option/return members are contractually required to carry JSDoc, so these internal one-liners are removable — but the fix spans the whole registry, not just a–l.

Files whose purpose I could not fully work out: none. The only one that took real effort was `code-block/code-block.tsx`'s `registerLabel` symbol map (I inferred the StrictMode/remount-ordering motive but could not confirm it from the code or tests, which is why it is filed as a comprehensibility finding rather than an over-engineering one). I also did not deeply audit the four CSS files in scope (callout.css, code-block.css, command-palette.css, diff-view.css — 1,666 lines total); each has an accompanying `.css.test.ts`, and spot checks showed the token/data-attribute contracts they encode are the ones the components document, but a rule-by-rule dead-selector pass on them remains unexamined.


### ui-comp-b — 17 confirmed, 3 rejected

Scope covered: all 26 component folders under `libs/ui/registry/ui` whose names start with m–z (menu, navigation-list, overflow, pager, panel, popover, progress, radio, scroll-area, search-input, section-header, select, shared, sidebar, skeleton, spinner, status-indicator, stepper, switch, tabs, textarea, toast, toc, toggle-group, tooltip, typography) — ~36k lines including tests, CSS and index barrels.

Overall state: this is genuinely strong primitive code, well above the bar the brief sets. Nothing in the second half reads as generated filler. Specifically clean:
- **Comment discipline.** Almost every comment states a constraint the code cannot show (why `popSub` takes an optional entry id, why the menu stack region is `hidden` rather than unmounted, why `--progress-cell` degrades at `size="sm"`, why the inverted sidebar row hard-couples to `SidebarContent`'s `p-4`). Zero AI-voice markers: `rg` for robust/ensure/seamless/comprehensive/gracefully across the whole scope returns nothing, as does `as any` / `@ts-ignore` / `TODO` / `FIXME`.
- **A11y contracts are deliberate and explained.** Every `biome-ignore` carries a real justification (dynamic roles Biome cannot resolve, APG listbox `aria-activedescendant` patterns, `role="status"` vs `<output>`). Non-colour carriers for state (`✓` glyphs, `[x]`/`( )` markers, StatusIndicator's per-status shape, the toast countdown's reduced-motion tick glyphs) are consistent and commented.
- **Form-submission semantics.** Radio/Switch/Select/ToggleGroup all use the same hidden-native-mirror + `useFormReset` + controlled-reset-baseline shape. It is the most intricate machinery in the area and it is consistent across four components.
- **Tests.** Behaviour- and role-driven. The handful of `toHaveClass` assertions I found are each preceded by a rationale tying them to something jsdom cannot compute (touch-target floors, `OVERLAY_SURFACE` tier parity, truncation preconditions) — that matches the AGENTS.md carve-out, so I did not flag them.
- **Variant hygiene.** CVA is used for named dimensions with compound variants doing real work; `shared/overlay-surface.ts` documents why the class strings are written out in full rather than composed (Tailwind scanning). No variant sprawl worth flagging — the widest surfaces (`sidebarItemVariants`, `toastPositionVariants`) each earn their size with per-variant comments.

Files whose purpose was NOT evident within 30 seconds (the "Maciek test" siblings of THEME_INIT_SCRIPT):
- `libs/ui/registry/ui/toast/use-container.ts:9` — the `try/catch` around `node.matches(":hover")` is unexplained; reported.
- `libs/ui/registry/ui/select/searchable-content.tsx:99-189` — `partitionSelectSearchChildren` + `getSecondaryWrapperSemanticOverrides` is ~90 lines of child-cloning that strips `id`/`role`/`tabIndex`/`aria-*` from the non-primary copy of a wrapper. I worked out *what* it does but not *why* the semantics-stripping rule is what it is; there is no comment stating the invariant (presumably "a wrapper duplicated across partitions must not duplicate its ARIA identity"). Worth one sentence, but I did not file it since I could not confirm the intent from code alone.
- `libs/ui/registry/ui/select/select-content.tsx:25-59` (`SelectDropdownInitializer`) vs `use-content-navigation.ts:168-177` — the same "focus once + initialize highlight once when open" state machine exists twice, once for the portaled dropdown (gated on `positioned` from FloatingPanel context) and once inline for the `card` variant. Only two sites, and the split has a real cause (the context is only available inside the panel), so I left it alone per the 3+ rule — but a reader hits both and has to prove to themselves they are not redundant.

One systemic note behind several individual findings: the per-component `*-context.tsx` files carry auto-templated JSDoc (`/** Toggles sidebar. */`, `/** Registers item with menu. */`, `/** Whether navigation list item is tree. */`). The public prop docs are contract-bearing — `libs/ui/scripts/jsdoc-metadata-sync` tests pin them against `registry/component-docs/*` — but the context-member docs are not covered by that, which is exactly where the restating and the outright-wrong lines have accumulated.


### ui-hooks-lib — 7 confirmed, 3 rejected

Scope audited: 26 files under libs/ui/registry/hooks, 34 under libs/ui/registry/lib (incl. lib/diff), 5 under libs/ui/registry/testing, plus their tests. Read every non-test source file end to end and spot-read the large test suites.

OVERALL STATE: unusually high. This is the strongest-written area I would expect in this repo. Zero AI-voice markers (`rg` for robust/seamless/comprehensive/graceful/ensure-that returns nothing), zero TODO/FIXME, zero section dividers, zero `as any`, zero `@ts-ignore`. Every `as unknown as` outside test stubs has an adjacent comment explaining the cast (`use-floating-position.ts:139` is the only one, and it is well argued). Every retained `fireEvent` carries the rationale comment `test:scripts` enforces.

NOTABLY CLEAN:
- Comment discipline is the best I have seen in an audit of this kind. The comments explain constraints the code cannot show — why `--primary` and not `--success` (`stepper-variants.ts:59`), why the LCS cell budget uses `+1` on both axes (`diff/lcs.ts:3`), why the availableHeight floor is unreachable (`use-floating-position.ts:310`), why `outline-hidden` beats `outline-none` under forced-colors (`input-variants.ts:22`), why Space runs typeahead before nav (`use-listbox.ts:367`). These are exactly the "one sentence stating the constraint" fixes the Maciek test asks for, already applied. `horizontal-stepper-variants.ts` even documents the measurement sweep that produced its threshold table and how to re-derive it.
- React rules are followed without exception. Every `useMemo`/`useCallback` I checked has a stated referential contract (`use-is-mobile.ts:41` explains the useSyncExternalStore re-subscription hazard; `use-composed-refs.ts:6` explains React 19 ref-cleanup-on-identity-change). No derived state synced through effects — `usePresence` uses the store-prev-render pattern with an explicit comment saying so. Every dependency-array `biome-ignore` names the trigger and why.
- The `hooks/use-focus-trap.ts` / `use-scroll-lock.ts` / `use-focus-restore.ts` / `use-navigation.ts` re-export shims LOOK like the classic zero-value wrapper, but they are the documented copy-mode contract from AGENTS.md ("public UI registry source must rewrite package imports to local copied hook/utility paths") and are named as such in `scripts/registry/imports.ts:74`. Correctly NOT flagged.
- `createTopLayerStack()` looks like a factory-for-one, but has two genuinely independent instances (`dialog-shell.tsx:43`, `toast-container.tsx:47`). Correctly not flagged.
- `useCopyToClipboard` returning both a `status` union and `copied`/`failed` booleans is not boolean explosion — the union is primary and both booleans have real consumers in apps/docs.
- `marker-rail.test.tsx` asserting Tailwind classes is legitimate: those class strings ARE the exported public contract.
- No stale helpers survived the redesign commits. `selectable-collection-stylesheet-observation.test.ts` appears in `867f352e`'s tree but is gone from disk — deleted cleanly, no orphan left behind.

FILE WHOSE PURPOSE I COULD NOT WORK OUT FROM NAME + CODE: `lib/floating-position-constants.ts`. The basename promises constants; five of its seven exports are types (`FloatingSide`, `FloatingAlign`, `FloatingPlacement`, `Viewport`, `Bounds`) and only two are constants. Its real job is "the shared vocabulary `floating-position.ts` and `use-floating-position.ts` both import, split out to break the cycle between them" — which nothing states. Not filed as a finding on its own (renaming it churns the public registry item for a one-word gain), but `-types` or `-contract` would describe it honestly, and it is the one basename in this area that actively misleads.

BOUNDARIES: no violations. No `apps/*` or `cli/*` import anywhere in scope; keys utilities are consumed through `@diffgazer/keys` or the copy-mode shims, never reimplemented. The `hooks/` = registry:hook, `lib/` = registry:lib split is consistent with registry.json, including the three hooks that live in `lib/` (`useFieldsetDisabled`, `useSelectableGroupAutoFocus`, `useTopLayerPosition`) — those are internal component dependencies, correctly kept off the public `hooks/` docs surface rather than misfiled.


### ui-docs-examples — 9 confirmed, 3 rejected

Scope: 50 component-docs + 13 hook-docs + 282 example .tsx files (plus 21 colocated example tests) under libs/ui/registry.

Overall this area is in good shape and clearly hand-tended, not generated. Concretely verified as clean:
- No orphan examples. I enumerated all 282 example files and grepped every referencing surface (component-docs, hook-docs, libs/ui/docs/content, apps/docs/content, libs/registry, libs/ui/scripts): zero unreferenced. apps/docs/scripts/artifacts/docs-example-wiring/examples.test.ts already enforces the reverse direction (no doc may reference a missing example).
- No API drift. `pnpm --filter @diffgazer/ui type-check` passes, and tsconfig.test.json re-includes registry/examples + component-docs, so examples are genuinely type-checked against current component props. I also cross-checked every documented prop name against its component source: the only "misses" (href on Breadcrumbs/Pager/Toc, alignOffset/avoidCollisions/collisionPadding on Tooltip.Content) are correctly inherited via AnchorHTMLAttributes / PopoverContentProps. useFloatingPosition's documented `side: "top"` default matches the implementation.
- No AI voice. One "ensures" in hook-docs/active-heading.ts:139 in an otherwise substantive sentence; zero instances of robust/seamless/comprehensive/gracefully/leverage anywhere else. Zero `as any`, `@ts-ignore`, or unexplained `@ts-expect-error` in the whole scope.
- Comments are the good kind: they state constraints the code cannot show (card-interactive.tsx's FORCED_HOVER explains why hover classes are duplicated statically; toc-active.tsx explains the useId namespacing because useActiveHeading resolves via document.getElementById; sidebar-mobile-sheet.tsx explains breakpoint={9999}/shortcutKey={null}; tooltip-open.tsx explains why `open` is pinned and warns not to do it in product code; every biome-ignore carries a real rationale). No section dividers, no restating comments, no TODOs.
- Prose docs are dense design rationale (contrast ratios, token roles, collision geometry, ARIA reasoning), consistently accurate against the source I spot-checked.

The real problems cluster in two places: (1) the copy-mode import contract is enforced per-file by hand, so two of four keyboard examples still import the unpublished @diffgazer/keys — and one of them (menu-keyboard) uses APIs that ship in no registry item at all; (2) prop-axis examples are duplicated as N near-identical files even where an interactive switcher example already exists (sidebar ×5, dialog corners ×3, stepper ×5, horizontal-stepper ×3).

Files whose purpose was not immediately evident:
- libs/ui/registry/examples/diff-view/raw-imports.d.ts — an ambient `*?raw` module declaration parked inside a public example folder. It is genuinely needed (libs/ui has no vite/client types and diff-view-examples.test.ts imports ?raw), and build-docs-data only reads .tsx so it never ships, but a reviewer opening the diff-view example folder will not know why a .d.ts lives beside the demos. One sentence at the top ("libs/ui does not pull vite/client types; diff-view-examples.test.ts needs ?raw") would settle it.
- The nine diff-view examples that each inline the same `const patch = ...` literal look like copy-paste, but diff-view-examples.test.ts parses that literal out of each file's raw source and validates it with `git apply --numstat`, and examples must stay standalone-copyable — so I deliberately did not report it.
- libs/ui/registry/examples/floating-panel/floating-panel-custom-menu.tsx hand-rolls arrow/Home/End roving focus with a switch and querySelectorAll while dialog-keyboard.tsx uses useNavigation for the same job. I did not report it as an anti-pattern demo because keeping FloatingPanel's example free of a keys dependency is a defensible deliberate choice — but if that is not the intent, it is the third place in this area where the same keyboard behaviour is spelled a different way.


### xcut-dry — 9 confirmed, 3 rejected

Scope: whole repo, hunting cross-package duplication (web↔TUI mirrored slices, schemas across cli/server, utilities across libs/apps, constants defined twice). Method: enumerated all non-generated sources with rg, then (a) name-collision index of every exported function and every exported type/interface across packages, (b) cross-package literal-string index restricted to user-facing copy, (c) an 8-line normalised shingle hash across every .ts/.tsx/.mjs to catch near-duplicate blocks. Every candidate was opened at both sites before being reported or dropped.

Notably clean, and worth saying so because it is where duplication usually lives in a two-surface product:
- The web/TUI parity contract is real, not aspirational. Both surfaces genuinely consume libs/core for the shared decisions: HELP_SHORTCUTS + groupShortcutsByContext, SECRETS_STORAGE_OPTIONS / AGENT_EXECUTION_OPTIONS, buildReviewSummary / buildCategoryStats / buildLensSummaryRows / buildDuplicateCollapseNotice, useReviewLifecycleBase, useHistoryScreenState, useModelSource / useModelFilter, sessionTerminationCopy, deriveSaveState, SEVERITY_LABELS/severityRank. The two mirrored summary-views and help screens differ only in renderer. The two real gaps I found (describeReviewStartError, the catalog fallback notice) are the exceptions that prove the rule.
- cli/server declares no schema libs/core already owns; every features/*/schemas.ts starts from a core schema and narrows it (ReviewModeSchema.exclude, SettingsConfigSchema.partial, AIProviderSchema).
- Format/string helpers are centralised in libs/core (format.ts, strings.ts, catalog/format.ts) with zero re-implementations anywhere in apps or cli.
- libs/registry is a genuine shared owner for the registry pipelines: build-shadcn-registry, build-publish-artifacts and verify-rsc-directives in libs/ui and libs/keys are thin 11-30 line entrypoints over it. The one gap is the output-dir walk (reported).

Duplicates I confirmed and deliberately did NOT report, with the reason, so a later pass does not re-raise them:
- escapeRegExp in apps/web/src/testing and cli/diffgazer/src/testing — two sites only, and the third hit is a dependency-free .mjs smoke script.
- The CSP directive list in apps/docs/src/security-headers.ts:24-35 vs cli/diffgazer/src/lib/servers/embedded.ts:31-42 — byte-identical apart from directive order, but only two sites and no shared home that both a Nitro SSR surface and the embedded Hono server can reach.
- Two unified-diff parsers (cli/server/.../engine/diff/parser.ts vs libs/ui/registry/lib/diff/parse.ts) plus their two git C-quote decoders — architecturally forced (a DOM/React copy library cannot be imported by the server), and cli/server/.../engine/diff/types.ts:3 already carries an explicit `@see` pointing at the other one.
- MODELS_DEV_SAMPLE (cli/server) vs RAW_CATALOG (libs/core) — overlapping model objects, but they are independent fixtures for independent suites that need not agree, the split is commented, and libs/core excludes **/fixtures.ts from its build.
- toPosixPath / resolveInside / readJson in scripts/monorepo/lib/*.mjs vs libs/registry — documented at scripts/monorepo/lib/paths.mjs:7 ("These scripts run under plain Node before TypeScript packages are built").
- libs/ui/registry/hooks/{use-focus-trap,use-focus-restore,use-scroll-lock,use-navigation}.ts re-exporting @diffgazer/keys — checked the consumers first: these are the copy-mode local paths referenced by libs/ui/registry/registry.json and dialog-shell.tsx, i.e. the documented handoff contract, not pass-through slop.
- apps/docs/src/components/docs-mdx/blocks/* wrapping their presentational siblings — a real layering boundary (blocks read doc-data context, the siblings take props), not indirection.
- Two ThemeProviders (apps/web/src/hooks/use-theme.tsx vs apps/docs/src/hooks/theme-context.tsx) share ~6 lines of applyTheme; two sites, different persistence models (server settings vs localStorage + SSR bootstrap) and different token values.

On the assignment's named example: THEME_INIT_SCRIPT is now fully explained in place (apps/docs/src/hooks/theme-context.tsx:95-101 plus the suppressHydrationWarning rationale in theme-toggle.tsx), so that specific comprehensibility gap appears already closed. I looked for siblings of the pattern and the closest survivor is the sortIssuesBySeverity name collision reported above.

One file whose purpose I could not fully settle: cli/server/src/shared/lib/ai/models-dev-sample.ts sits in the server's production source tree (shared/lib/ai/) rather than a test root, yet it is test-only data and cli/server/src/shared/lib/testing/tsconfig-boundary.test.ts advertises a rule that "keeps fixtures in test roots and out of production roots". Either that test has a carve-out for this file or the file is in the wrong directory; I could not tell from the file itself and did not read the boundary test's full assertion set, so I left it out of the findings.


### xcut-arch — 9 confirmed, 3 rejected

Scope: cross-cutting architecture, boundaries, and dead code across the whole repo (3169 non-excluded files enumerated with rg --files).

WHAT IS NOTABLY CLEAN — this area is in genuinely good shape and most of my checks came back empty:

1. Declared boundaries hold. `libs/core` imports nothing from `apps/*` or `cli/*` (verified by rg over every import specifier plus the dependency-cruiser `core-not-app-or-cli` rule). `libs/ui`, `libs/keys`, and `libs/registry` import no app code — the only `@diffgazer/keys` hits inside libs/registry are string literals in `imports/keys-import-rewrite.test.ts` fixtures, not real imports. `apps/landing` depends on `@diffgazer/ui` alone (package.json + `src/boundary.test.ts`); its non-relative imports are node builtins, vitest, and axe-core only. No feature imports a sibling feature in apps/web, apps/docs, cli/server, or cli/diffgazer outside test files, and no `components/`, `hooks/`, `lib/`, or `types/` shared tier imports `@/features/*`.

2. `pnpm exec knip` (v6.16.0) is completely clean — zero unused files, exports, types, dependencies, or binaries, and it stays clean when re-run per-issue-type (`--include files,dependencies`, `--include exports`). I did not have to triage a single false positive.

3. `pnpm run depcruise` reports 0 errors / 0 circular dependencies across 2842 modules and 5682 dependencies. The only output is 4 `no-orphans` warnings, and I confirmed all four are false positives (vitest setupFiles string reference, a type-only module, an `@/`-alias test helper, an `@/`-alias context) — hence the allowlist-staleness finding rather than a dead-code finding.

4. Package `exports` maps match reality: all 33 `@diffgazer/core`, 3 `@diffgazer/keys`, and 4 `@diffgazer/registry` subpaths are imported somewhere in-repo, and no import targets a subpath that is not declared. The 9 unimported `@diffgazer/ui` subpaths (avatar, textarea, icons, label, overflow, divider, breadcrumbs, switch, skeleton) are expected for a published component library and are not a finding.

5. Type safety is unusually disciplined: repo-wide there is exactly one `as any` and it carries an inline justification (`libs/registry/src/cli/workflows/init-workflow.test.ts:264`), with zero `@ts-ignore`/`@ts-nocheck`. Only four empty catch blocks exist and three are commented.

6. I ran an independent unused-export scan (own script, corpus = every file under apps/cli/libs/scripts including tests, mdx, and mjs) over 848 non-test source files. It surfaced no dead modules. `libs/core/src/api/test-helpers.ts` and `libs/core/src/catalog/fixtures.ts` looked orphaned but are used by colocated tests; the ~60 "value exports with no external consumer" it found are all used inside their own file, which knip deliberately tolerates via `ignoreExportsUsedInFile: true` — a policy call, not drift. `libs/core` in particular has no dead modules and every subpath barrel maps to a real package export.

7. The comprehensibility exemplar named in the brief is already fixed: `THEME_INIT_SCRIPT` (apps/docs/src/hooks/theme-context.tsx:95-101) now carries a doc comment stating exactly what it does and why it runs pre-paint. Its siblings are in the same state — `apps/docs/src/lib/csp-nonce.ts`, `request-nonce.ts`, and `client-runtime.ts` (`z.config({ jitless: true })` for the eval-free CSP) each explain the constraint the code cannot show. The one place that pattern breaks is `apps/docs/tsconfig.json:25`, reported above.

8. apps/docs genuinely composes `@diffgazer/ui` rather than mirroring it (breadcrumbs, toc, and copy-button all build on `@diffgazer/ui` primitives). The `components/docs-mdx/<x>.tsx` (presentational) vs `components/docs-mdx/blocks/<x>.tsx` (data-bound `<X>Block`) same-basename pairs read oddly at first but are a consistent, intentional split — not reported.

WHAT FEELS OFF: three themes. (a) Indirection layers that exist for tooling rather than for readers — the 13 empty `apps/web/src/app/routes/*` shims, and the core-factory re-export in `cli/server/src/shared/lib/testing/factories.ts`. (b) Config that has drifted from the tree it describes — the dependency-cruiser allowlist, the subsumed knip entry globs, the unexplained docs tsconfig alias. (c) Placement conventions that AGENTS.md states once but the tree implements three ways — feature-local test helpers, `libs/ui/src/`, `cli/add`'s `remove` file-plus-folder.

FILES WHOSE PURPOSE I COULD NOT WORK OUT: only one, and only for a moment — `apps/docs/tsconfig.json:25`'s `@/components/ui/select` alias, which I had to trace through `libs/ui/registry/examples/select/*` and `apps/docs/src/components/layout/footer-pager.test.tsx:11` to explain. That is the finding. Everything else I read had either a self-evident name or an explaining comment. I deliberately did NOT report: the `escapeRegExp` duplication between apps/web and cli/diffgazer testing (2 sites, brief says leave alone); `setReviewRekeyHandler` in cli/server's config store (a documented, minimal inversion that exists precisely to honor the shared→features rule); the 6-key `ServerFactoryDependencies` injection seam in cli/diffgazer (used consistently by web-launcher.ts too, and it replaces vi.mock); and the `libs/keys/artifacts/artifacts` path stutter (it is the package's `files` field output dir, governed by PACKAGE_GOVERNANCE.md).


### xcut-structure — 14 confirmed, 10 rejected

SCOPE: cross-cutting structure agent over the whole repo (2,682 source files: .ts/.tsx/.js/.mjs/.css, excluding node_modules, dist, */generated/, */public/r/, *.gen.ts, lockfiles, and the committed libs/keys/artifacts/artifacts mirror).

MEASUREMENTS (sota-structure audit procedure, generated code excluded):

1. Hyphen distribution (per basename, tooling suffixes and the `use-` hook prefix stripped per the skill's exemptions): 0 hyphens 1007, 1 hyphen 1123, 2 hyphens 477, 3 hyphens 56, 4+ 1. That is 80.0% at <=1 hyphen repo-wide, and 83.5% when the shadcn/keys registry trees (libs/ui/registry, libs/keys/registry, apps/docs/registry) are excluded — those are almost entirely the exempt `<component>-<part>` compound idiom (`dialog-footer.tsx`, `select-trigger.tsx`). 83.5% puts the repo just inside the elite band (82-99%) and better than the vercel CLI's 18%-at-2+. Only one 4+ hyphen basename exists outside generated trees, and it is a registry example (`use-focus-trap-initial-focus.tsx`) where the folder is the distribution unit. The residual 2+ hyphen names that ARE fixable by the folder-context move are the settings/docs/persistence clusters reported above.

2. Path-echo: ~230 raw hits, but the overwhelming majority are the sanctioned shadcn per-component distribution folders (`ui/select/select-trigger.tsx`) and are correctly exempt. After filtering those, the real echoes are the ones filed: apps/docs `docs-*`, apps/web `settings-*` and `app/providers/app-providers.tsx`, cli/server `persistence-*.test.ts` and `review-lock/review-cursor`, cli/diffgazer `progress-view/progress-view.*` and `*-screen.tsx`, `scripts/monorepo/`. `cli/server/src/http-server.ts` looks like an echo but is named verbatim in AGENTS.md:49 — not a finding.

3. File size (1,763 non-test, non-CSS source files): 189 over 200 lines (10.7%), 60 over 300 (3.4%), 33 over 350 (1.9%). Counted per responsibility, almost all of the >350 set are cohesive by construction — `libs/ui/registry/component-docs/*.ts` are docs data tables, `libs/ui/registry/hooks/use-floating-position.ts` and `overlay-dismiss-stack.ts` are single algorithms, `libs/core/src/review/state.ts` is a state machine. The one genuine multi-responsibility file is `cli/server/src/shared/lib/config/store.ts` at 1,088 lines, filed above; note it already carries an explicit inline justification (lines 223-226) for why the closure itself must stay whole, and that justification is correct — only the 110-line WAL prefix should move.

4. Barrel census: 74 index files, and every one checks out. libs/ui's 51 per-component `index.ts` are shadcn distribution units (ALLOWED); libs/core's 14 map 1:1 to explicit `exports` subpaths in its manifest (verified against libs/core/package.json — it correctly has no root "." entry); libs/keys, libs/registry and the CLI entries are package public entries. Zero internal convenience barrels found. This is the cleanest part of the structure.

5. Grab-bag basenames: only one real offender, `libs/registry/src/cli/command-factories/shared.ts`. `libs/ui/registry/lib/utils.ts` is the shadcn-mandated `cn` location and is a hard copy-mode contract — exempt. The ~25 `types.ts` files are sanctioned by AGENTS.md's Hono (`features/<domain>/{router,service,schemas,types}`) and UI-surface taxonomies.

6. Test placement: 203 test files have no same-stem source sibling, but most are legitimate contract/scenario suites (`app-http-boundaries.test.ts`, `boundary.test.ts`, `vite-config.test.ts`) or unit shards. The genuine anomalies are filed: libs/keys/src/playground, cli/diffgazer/src/lib/servers/process-*, cli/server persistence-*. One systemic wobble not worth its own finding: shard separators are inconsistent — hyphen in cli/server (`store-basics.test.ts`) and libs/ui (`select-keyboard.test.tsx`), dot in apps/web (`page.trust.test.tsx`) and cli/diffgazer (`screen.floor.test.tsx`) — and cli/diffgazer uses both (`process-shutdown.test.ts` and `screen.floor.test.tsx`). Worth one line in TESTING.md picking a side.

7. Dot-segment names: no NestJS-style `.service.ts`/`.routes.ts` anywhere. All dot segments are on test/fixture files, which is defensible; the outliers are covered by the test-helper-naming finding.

NOTABLY CLEAN (verified, not assumed): zero cross-feature imports across apps/web, apps/docs and cli/diffgazer (checked by resolving every relative and `@/features/*` specifier in all three feature trees). libs/core imports nothing from apps/* or cli/*. libs/keys imports no sibling workspace. knip reports zero unused files, exports or dependencies — only ignore-config hints. Zero `as any` outside `routeTree.gen.ts`, zero `@ts-ignore`, zero bare `@ts-expect-error`, zero section-divider comments, zero TODO/FIXME. Only three empty catch blocks exist and two are documented. The pnpm workspace and dependency-cruiser config are both wired, so the boundary rules are machine-enforced rather than prose. The THEME_INIT_SCRIPT case named in the brief is already fixed — apps/docs/src/hooks/theme-context.tsx:95-101 now carries a precise why-comment; I hunted its siblings and the only remaining instance of that class is the `ssr/` directory-as-vitest-selector, filed above.

FILES WHOSE PURPOSE I COULD NOT FULLY WORK OUT: (a) `@diffgazer/keys-artifacts` — PACKAGE_GOVERNANCE.md:182 calls it "a workspace mirror for docs artifact handoff", but no package.json in the repo depends on it and apps/docs never references it, so I could not determine what actually consumes the mirror; if there IS a consumer I missed, the finding's fix should be reduced to just gitignoring the payload. (b) `apps/docs/src/lib/docs-chrome.ts` holds three unrelated constants (a version string, a hardcoded registry host, a Tailwind shell class) under one name — each has a good why-comment individually, but the file's organizing principle is not evident; I left it unfiled since every constant is justified in place. (c) `libs/ui` has two testing directories, `libs/ui/testing/` (axe, e2e, fixtures) and `libs/ui/registry/testing/` (assertions, css-contract, form-behavior, reticle), both imported by registry tests; the split is probably registry-scoped vs package-scoped but nothing states it — one sentence in TESTING.md would close it.


### hunt-ui-keys — 4 confirmed, 5 rejected

libs/keys/src is the strongest code in the scope: dense focus/keyboard machinery (focus-trap-controller, use-focus-restore, hotkey parsing, overlay-agnostic DOM guards) where nearly every non-obvious construct carries a constraint comment explaining which browser/React behavior forces it, and the public API shapes (value/onChange, onNavigationBoundaryReached, ownerDocument discipline) match the repo contract. Its remaining weak spots (useId regex parsing, the unvalidated/validated zone split, the tuple machinery in use-action-row-navigation) were already flagged by wave one; the only new structural gap I found is that useNavigation withholds the event from onHighlightChange, which forces ref-smuggling downstream in libs/ui. libs/ui/registry is high quality at the primitive level (floating-position math, overlay-dismiss-stack, use-presence, use-form-reset are all well-reasoned and annotated), but the composite-listbox layer shows seam drift: the shared hooks exist (useListbox with a metadata mode, selectable-collection with resolve helpers, useTypeaheadBuffer/typeaheadSearch), yet the biggest composites each rebuild slices of them — Select re-implements the keystroke arbitration and active-descendant init, RadioGroup/ToggleGroup/Menu/Select hand-roll four variants of child seeding with two duplicate hidden-seed predicates, and TabsList/ToggleGroup copy the segmented-indicator rendering. Individually each copy is clean; collectively the same concept has 2-4 implementations that already disagree on details (controlled-highlight detection, expanded-container seeding). One coexistence worth a one-line doc rather than a finding: hooks/overlay-dismiss-stack (dismissal routing with priorities/nesting) vs lib/top-layer-stack (topmost-element tracking for toasts/dialog shells) — both are justified, but nothing at either file says why there are two stacks. No file in scope had a purpose I could not determine.


### hunt-core-backend — 10 confirmed, 0 rejected

This scope is in unusually strong shape for a pre-release codebase, and most of what a checklist audit would catch was already caught in wave one. The load-bearing hard parts — SSE replay concurrency (stream/replay.ts), session identity/staleness (stream/store.ts dual reviewInputHash vs status-hash modes, verified both modes have live callers), git hardening (shared/lib/git/service.ts env sanitization + fsmonitor overrides), the crash-recovery rekey protocol (storage/rekey.ts, verified wired via the project-move onMove hook), and the disk-cache TTL/fallback lattice — are all genuinely correct and carry the constraint comments the Maciek test demands; I tried to break several (replay Set-dedupe, evict/timeout races, freshness-gate on completed sessions) and could not. The dominant residual disease is seams that stop one layer too early: useReviewLifecycleBase is the clearest case, where the base owns the state machine but leaves identical session-cache plumbing and reset orchestration to both surfaces, which is exactly the web/TUI duplication libs/core exists to absorb. Second theme: API surface kept alive by tests or docs alone (stream stop()+COMPLETE, contextReady, the whole /api/git feature). Third: types restated by hand next to their derivable source (cli/add manifest types). The onboarding wizard and history pipelines are model extractions — core owns the machine, surfaces own only focus/navigation — and libs/registry's CLI framework layer is coherent, with the writer/gate matcher divergence for the .js-import contract the only structural wobble I found there. One file I could not fully justify: cli/server/src/shared/lib/config/store.ts remains the concentration point (already flagged for size); its rekey-handler indirection (setReviewRekeyHandler default `async () => true`) silently reports success if app.ts wiring is ever missed, which is worth a thought when the flagged split happens.


### hunt-apps — 5 confirmed, 4 rejected

Overall this scope is in unusually good shape for a second-wave audit. The web/TUI mirroring strategy mostly works as designed: real logic (useWizardState, useReviewLifecycleBase, useHistoryScreenState, resolveSavedReviewOutcome, buildHubValues, buildReviewMetricsRows, buildSeverityBreakdownRows, groupShortcutsByContext) genuinely lives in libs/core, and the surface files are thin presentational adapters. Comment discipline is exceptional — use-stream-liveness.ts, use-review-clock.tsx, toc.tsx, theme-bootstrap.ts, chrome.ts, and interactive-target.ts all carry constraint-style comments that pass the cold-reader test; the docs THEME_INIT_SCRIPT class of magic has largely been paid down. apps/landing is small, clean, and honest about its no-framework constraint (effect-scope/observe/motion are tight, well-scoped utilities). What remains wrong concentrates at one seam: the TUI's private component set (cli/diffgazer/src/components/ui) drifts from the libs/ui vocabulary its sibling surface uses — tone vs variant on Callout, numeric vs semantic boundary directions, renamed prop contracts on mirrored shared components — and small presentation *policies* (hub value emphasis, metric emphasis) got re-derived per surface around the shared core row builders and are already diverging. The web review feature's transition-token machinery in use-lifecycle.ts and the 32-field use-results-keyboard controller hook are heavy but justified and well-commented; I deliberately did not flag them. No file in scope had a purpose I could not reconstruct.
