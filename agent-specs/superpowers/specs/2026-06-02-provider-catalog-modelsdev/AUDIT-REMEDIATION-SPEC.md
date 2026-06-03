# Provider/Model Catalog (models.dev) — Audit & Remediation Spec

> **What this is.** The consolidated output of an independent, multi-agent ("thermonuclear") quality + completeness audit of the **uncommitted working-tree changes** that implement the models.dev provider catalog (see `design.md`, `plan.md`, `EXECUTE.md` in this folder). It is BOTH the audit record AND a ready-to-execute remediation spec.
> 
> **Status:** audit complete; **remediation COMPLETE (2026-06-02)** — 140/146 findings fixed across 3 multi-agent workflows, working-tree only, no git operations. Final gate independently verified green (22/22 turbo, forced fresh). See the Remediation log below. The 6 unactioned items are listed there (1 = a `git add` left to the user; the rest by-design / uncertain-kept).
> 
> **Date:** 2026-06-02 · **Audit cost:** 189 Opus subagents, ~9.1M tokens, 2600 tool-uses, 8 critic rounds · **Result:** 146 confirmed findings (9 high, 34 medium, 103 low; 0 critical). 9 are tagged UNCERTAIN for human judgment.

**Independent gate evidence (re-run during the audit):** `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check test` → **22/22 tasks pass, exit 0** (web 282/282, add 83/83, landing 7/7, …). The tree compiles and the existing suite is green; every finding below is a *quality/correctness/completeness* gap that current tests do not catch — which is itself part of the finding set (test-quality is the largest category).

---

## Remediation log (COMPLETE — 2026-06-02)

All findings were remediated by three sequential multi-agent Opus workflows (TDD; **working tree only; no git operations** — staging/tracking left exactly as found, per the user's instruction). **140 / 146 findings explicitly fixed.** Final state independently verified: `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check test --force` → **22/22 tasks pass (0 cached)**; `git diff --check` clean; nothing staged.

| Wave | Scope | Result |
|---|---|---|
| 1 — HIGH | Theme B (activateProvider live-catalog model validation = Task 13/D5 + fail-open API-key guard), Theme C (I/O resilience: per-provider non-empty fall-through to snapshot, single-provider-drop cache-poison guard, best-effort persist that never leaks the fs path, corrupt-cache→snapshot shrink-guard baseline), Theme D (real structured_output test, model-selection in web+TUI, OpenRouter branch, saving/error states) | ✅ 22/22 |
| 2 — MEDIUM (15) + ~39 folded LOWs | client overlay-baseURL + `resolveAbortSignal` dedup; removed vestigial `ProviderInfo.models`; `guardQueryState` idle-query no longer shows a permanent spinner + TUI ModelStep on the mapped hook; smoke covers all enabled providers + tsup-inline snapshot check; catalog cache type de-dup + parse memoization (D6 unification taken as a documented exception to preserve Wave-1 resilience); service-layer D4 OpenRouter boundary + dead re-parse removal + typed-error→status mapping | ✅ 22/22 |
| 3 — LOW (63) | catalog pure-layer branch tests + environment-independent ordering + dead-export pruning + de-narrated comments; core providers/contract (dead `buildModels` removal, transient-refetch data retention); server-ai nits; **shared `getCompatibilityLabel`** across web+TUI; UI test-quality (paid badge, focus, casts); snapshot generator trim-to-used-fields + deterministic order + `prepare:artifacts` wiring | ✅ 22/22 |

**Intentionally NOT actioned (6):**
- `r2-completeness-and-deferrals#0` (HIGH, repo-integrity) — the fix is `git add` of the untracked `libs/core/src/catalog/` + `catalog-errors.ts`; **left to the user** (no git operations were permitted). It builds fine in the working tree today; this only matters for a future commit/clean checkout.
- `server-cache#0`, `server-cache#1` (LOW) — by-design: Wave 1's OpenRouter cache refactor preserved observable behavior, so the findings' premises no longer hold.
- `xc-test-quality#4` (LOW, UNCERTAIN) — kept the `useProviderModels` tests; they guard the real hook contract, not just framework behavior.
- `r6-deep-logic-correctness#3` (LOW, UNCERTAIN) — documented that merge dedup is intentionally by inner `model.id`; no parser drop-behavior change (collapse is unreachable with today's single-source overlays).
- `r5-completeness-and-deferrals#1` (LOW) — `cached` kept on the `ProviderModelsResponse` wire contract (removing it is a cross-package ripple unjustified for a low; it harmlessly mirrors `source`).

---

## How to execute this spec (read first)

- **Scope:** remediate the findings below in the **working tree only**. Do **NOT** commit or push (matches the `EXECUTE.md` protocol). The reviewer inspects via `git diff`.
- **No new scope.** Fix exactly what is listed. Do not refactor adjacent code, rename public APIs, or churn generated artifacts beyond what a finding requires.
- **TDD.** For every behavioral fix: write/repair the failing test first, confirm it fails for the right reason, implement the minimal change, confirm green. Several findings ARE "the test does not actually test the contract" — fix the test so it would fail on the regression it names, then keep it green.
- **Load skills** (the audit applied these; the fix must satisfy them): `code-audit`, `clean-code`, `code-quality`, `anti-slop`, `test-behavior-not-implementation`; for React/TUI files also `react-senior-guide` + `react-useeffect`/`react-useref`/`react-anti-patterns`/`react-hook-authoring`; for the I/O layer `sota`.
- **Honest verification.** Run the real gates; do not claim GREEN without output. The original `EXECUTE.md` over-claimed ("sota-verify CLEAN") on contracts that were in fact unimplemented or untested — do not repeat that.

### Verification gates (from `AGENTS.md`) — run after fixes
```bash
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test
pnpm run prepare:artifacts && pnpm run validate:artifacts:check
DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke   # add DIFFGAZER_SMOKE_ALLOW_NETWORK=1 for the live models.dev path
pnpm run verify:monorepo
git diff --check
```

### Recommended fix-workflow shape (if running multi-agent, like the audit)
1. **Batch 0 (blocker, do first, sequential):** repo integrity — Theme A. A `git add` decision, not a code change.
2. **Batch 1 (server I/O + validation, sequential — shared files):** Themes B & C. These cluster on `cli/server/src/shared/lib/ai/models-dev-catalog.ts`, `cli/server/src/features/config/service.ts`, `disk-cache.ts` — one focused agent per theme, run in order to avoid edit conflicts.
3. **Batch 2 (tests + consumers, parallel — independent files):** Theme D + per-file MEDIUM test/consumer findings. Each test file is independent; fan out one agent per file.
4. **Batch 3 (cleanup, parallel by file):** dead-code / anti-slop / DRY / YAGNI lows, grouped by file.
5. **Verify each fix adversarially** (an independent agent confirms the test now fails-without/passes-with the change and the finding is actually resolved), then re-run the gates. Loop until every targeted finding is closed and gates are green.

---

## Executive summary

Independent re-derivation of the "provider catalog from models.dev" feature (design D1-D6 + plan Tasks 1-30) against the uncommitted working tree. The architecture (D1-D6) is broadly realized and well-shaped: a clean pure layer in libs/core/src/catalog (schema/overlay/transform/capabilities/snapshot/format), a single keyless 24h disk cache with three-tier fallback in cli/server, a slim Zod-typed GET /provider/:id/models route, a typed PROVIDER_DISABLED domain error, groq+cerebras wired through one openai-compatible factory, and overlay-derived ENV_VARS/ALLOWLIST/AVAILABLE_PROVIDERS. The TDD discipline and naming are generally strong, and the headline D2 tier-resolution logic (gemini-2.5-flash stays free, zai-coding stays paid, absent-cost stays unknown) is correctly implemented and tested.

However, the EXECUTE.md "all GREEN / sota-verify CLEAN" claim is materially false in at least three places. (1) Task 13 / D5 server-side activateProvider model validation was NEVER implemented: service.ts:177-190 only runs UserConfigSchema.safeParse, whose relaxed isValidModelForProvider (providers.ts:36-37) accepts ANY non-empty string for ANY provider — a vacuous control directly contradicting the JSDoc promise and the design contract. (2) Multiple high-severity correctness/resilience defects survive in the I/O layer: the fresh-cache path serves an empty picker tagged source='cache' when the cached catalog lacks the requested provider (models-dev-catalog.ts:94-95, no snapshot fallback); a corrupt/missing cache silently disables the shrink-guard and lets a degenerate live fetch poison the on-disk cache (90-118); and an unguarded persistDiskCache write failure throws out of getProviderModels, discarding a good result and leaking the cache file path to the HTTP client (110-114 + fs.ts:83-84 has no try/catch). (3) The headline regression test for structured_output:null is vacuous (capabilities.test.ts:43-47 asserts only string length, which is always non-empty), and the central user behavior — model selection — is untested in both the web dialog and the TUI overlay, as is the entire D4 OpenRouter compatibility-label branch.

A repo-integrity red flag: the entire pure catalog layer and catalog-errors.ts are UNTRACKED in git (not gitignored) while edited, tracked files import them — meaning the feature as committed would not build. Cross-cutting code-quality debt is moderate: D6's withTtlAndFallback helper exists and is used by OpenRouter but the models.dev path bypasses it; getCompatibilityLabel is duplicated across web and CLI; PROVIDER_CAPABILITIES is frozen to the bundled snapshot rather than live data; and there is a long tail of dead exports (pricingTierOf, CatalogError, fetchModelsDevCatalog, ProviderInfo.models, sdkKind) and AI-voice/narration comments.

## Completeness verdict

PARTIAL — substantially implemented but with one design contract entirely missing and several high-severity correctness/resilience gaps.

Fully + correctly implemented: D1 (./catalog subpath + cli/server I/O split), D2 (curated hasFreeTier + derived pricingTier; the headline free/paid regressions are correct and tested), D3 (6 enabled + 3 surfaced; groq/cerebras wired), D4 (OpenRouter kept on its live key-gated route alongside the catalog), most of D6 (generated TS snapshot, 24h disk cache, three-tier resolution order, DIFFGAZER_OFFLINE), and the enum half of D5 (AIProvider stays closed, expanded by groq+cerebras; isValidModelForProvider relaxed).

MISSING / DEVIATING:
1. D5 / Task 13 server-side activateProvider model validation is NOT implemented. service.ts:177-190 validates only via the relaxed UserConfigSchema, accepting any non-empty model for any provider; it never fetches getProviderModels to reject unknown ids. providers.ts:32-34 JSDoc actively promises this nonexistent behavior. EXECUTE.md's P4 "Task 13 completed here as planned" is a false GREEN.
2. D6 unification deviates: the models.dev path reimplements cache resolution inline (models-dev-catalog.ts:90-118) instead of the shared withTtlAndFallback helper it mandated; isCacheFresh duplicates disk-cache's private isFresh. (The plan does carve out a documented exception for the 3-way source tag, so this is partial-deviation, not pure miss.)
3. D6 "never a blank picker" resilience is breached on two paths: fresh-cache-missing-provider (94-95) and the shrink-guard bypass when the baseline cache is absent/corrupt (90-118), which also poisons the cache.
4. D6 snapshot regeneration is not wired into prepare:artifacts (package.json:27-28) and the snapshot is not trimmed to used fields (generate-catalog-snapshot.ts).
5. Outgoing route payload is not re-validated against ProviderModelsResponseSchema at the service boundary (service.ts:251-267) despite the "slim Zod-validated" contract; D4's OpenRouter boundary is enforced only in client hooks, not the owning server service.
6. The "snapshot bundling / tsup-inlining anti-regression" test from the testing plan was never realized; the never-blank-picker smoke covers only 3 of 6 enabled providers.
7. Repo integrity: libs/core/src/catalog/* and catalog-errors.ts are untracked and not gitignored — the importing tracked files would not compile from a clean checkout.

Net: the feature works for the happy path and the headline tier semantics are correct, but a security-relevant validation contract is absent, several offline/resilience edges fail unsafely, and the test suite over-claims coverage of exactly the contracts the design calls headline.

## Scorecard

Overall: **3.4 / 5** (5 = exemplary).

| Category | Score | Notes |
|---|:---:|---|
| DRY | 3/5 | Real duplication: getCompatibilityLabel cloned across web and CLI (xc-react#1); isCacheFresh duplicates disk-cache isFresh (xc-dry-arch#1); zhipu baseURL hardcoded in client.ts duplicating the overlay's single-source-of-truth value (r1-anti-slop#1); identical abort-signal blocks in generate/generateStream (r1-anti-slop#3); ProviderModelsResult duplicates the Zod ProviderModelsResponse contract (xc-dry-arch#2); deriveCapabilities re-gathers models instead of reusing the merge. Offset by genuinely good reuse of loadDiskCache/persistDiskCache and the shared formatContextTokens. |
| SRP | 4/5 | Layering is clean and faithful to D1: pure schema/transform/capabilities in libs/core, I/O in cli/server, HTTP in the route, consumption in hooks. getProviderModels mixes cache-resolution, shrink-guard, persistence and source-tagging in one function, but that is a bounded, cohesive orchestration. |
| KISS | 4/5 | Mostly straightforward. Minor over-branching: getCompatibilityLabel computed unconditionally for non-OpenRouter providers (web-consumers#2); getSubtitle special-cases openrouter though the caller already branches on isOpenRouter (tui-consumers#7). No gratuitous abstraction. |
| YAGNI | 3/5 | Several speculative surfaces: relaxed isValidModelForProvider keeps a now-dead provider param + indirection (schemas-config#0); eager full Record<AIProvider,string> DEFAULT_MODELS built for single-key lookups (r2-anti-slop#3); toResult threads a cached boolean always derivable from source (r8-anti-slop#1); ProviderModelsResponse.cached is structurally redundant with source and read by no consumer (r5-completeness#1). |
| Over-Engineering | 4/5 | Generally restrained — the team correctly declined to force the catalog through withTtlAndFallback and documented why. Counterweight: source/fetchedAt resilience metadata is plumbed end-to-end through hooks but read by no consumer (r2-deep-logic#0), and SURFACED_OVERLAYS/snapshot carry full overlay shapes where only modelsDevIds is read (r5-anti-slop#1, r7-completeness#0). |
| Anti-Slop | 3/5 | Multiple AI-voice/narration comments: SDK-drift handling restated three times in client.ts (r1-anti-slop#2); inline comments narrating control flow in capabilities.ts (r7-anti-slop#4), parseModelsDevCatalog JSDoc (r7-anti-slop#3), test comments narrating internal setHighlightIndex/hook state (tui-consumers#6, xc-test-quality#2); defensive if(!config.provider) on a required enum (r7-anti-slop#0); smoke JSDoc asserting a symmetry the code does not honor (scripts-docs#1). |
| Naming | 4/5 | Names are clear and intent-revealing (pricingTierOf, isModelFreeToUse, mergeModelsAcrossSources, withTtlAndFallback). Only nit: loading-ellipsis style differs between overlay (U+2026) and onboarding step (ASCII '...') (tui-consumers#4). |
| File-Org | 4/5 | Layout matches the design file tree precisely (catalog barrel, schema/overlay/transform/capabilities/snapshot/format, models-dev-catalog + disk-cache in cli/server). The only structural blemish is repo-integrity, not layout: the whole catalog dir is untracked. |
| Type-Safety | 3/5 | Enum kept closed and exhaustive Records are sound. But: non-null assertion on array indexing in resolveProviderDisplayName (xc-security#2); disk-cache fetchedAt typed z.string() while the response contract demands z.string().datetime() (r1-deep-logic#4); 'as Parameters<...>' casts + inner model shadowing per SDK branch (r2-anti-slop#4); test-side 'as Record<string,unknown>' and prop 'as' casts bypassing completeness (catalog-schema#0, xc-react#3). |
| Error-Handling | 2/5 | Weakest area alongside completeness. HIGH: unguarded persistDiskCache write-failure throws out of getProviderModels, discards a good fetch, and leaks the cache file path to the client (r5-security#0). activateProvider's API-key guard fails open when the secret read errors (r6-security#0). withTtlAndFallback fallback ignores isCacheUsable, serving a cache the predicate rejected (r3-deep-logic#0). Router buckets all code-less errors into 500 (server-route-client#2). useProviderModelsMapped discards still-valid data on a transient background-refetch error (r1-deep-logic#2). Corrupt disk cache silently degrades to first-run and accepts a degenerate fetch (r8-deep-logic#0). |
| Dead-Code | 2/5 | Long tail of dead exports/data: buildModels has zero prod consumers yet is still tested (providers-runtime#0/2); pricingTierOf/PricingTier, CatalogError, CATALOG_ERROR_CODES-as-type-only, ModelsDevProvider, ModelsDevCatalogCache, ModelsDevCatalogCacheSchema, fetchModelsDevCatalog, FreeTierSelector, WithTtlAndFallbackOptions/DiskCacheResolution all exported but consumed only in-module or in tests; sdkKind overlay field has no runtime consumer (client switches on provider); ProviderInfo.models is permanently-empty vestigial data with dead UI branches (r5-anti-slop#0); PROVIDER_DISABLED 404 and the service AIProviderSchema re-parse are unreachable behind the router param validator (r3-security#0, r5-deep-logic#0). |
| Patterns | 3/5 | Resolution-order and three-tier fallback follow the OpenRouter precedent well, but several anti-patterns: localeCompare makes the 'deterministic' ordering locale-sensitive (r3-deep-logic#3); freshest-date tie-break compares last_updated of one model against release_date of another (r4-deep-logic#2); guardQueryState renders a permanent fake spinner for a disabled idle query — TUI shows 'Loading models...' forever on nav focus (r4-deep-logic#0); merge keys on inner model.id while the catalog keys by map key, risking silent collapse (r6-deep-logic#3, uncertain). |
| Architecture | 4/5 | The three-layer split (pure/IO/HTTP) is correct, boundaries are respected, and the closed-enum + dynamic-models decision (D5) is sound and well-executed at the type level. Marks lost because the D4/D5 boundary is enforced in client hooks rather than the owning server service, and the models.dev path bypasses the helper D6 mandated unifying onto. |
| Reusability | 4/5 | Pure transforms are genuinely shared across web/TUI/server/smoke; the disk-cache primitives are reused by OpenRouter. Reusability is undercut where it matters for DRY (compatibility-label not shared, capabilities not deriving from live data) but the shared surface that exists is well-factored. |
| Performance | 3/5 | Fresh-cache path re-reads and full-Zod-revalidates the entire ~2MB multi-provider catalog synchronously on every request (r3-deep-logic#1) — a real per-request cost on the hot path. models.dev fetch never caps the buffered response size (r2-security#0). Otherwise acceptable for a low-QPS local server. |
| Test-Quality | 2/5 | High volume but over-claims coverage of headline contracts. The structured_output:null regression test is vacuous (catalog-capabilities#0). Model selection — the central user behavior — is untested in both web dialog and TUI overlay (r2-test#0). D4 OpenRouter compatibility-label branch is untested everywhere (r3-test#2). Shrink-guard test never triggers the guard (r2-test#1); 'persists the cache' only checks file existence (r2-test#2); 'never empty' / 'every enabled provider' tests omit 2-3 enabled providers (r8-test#1, r2-completeness#1). Many tests assert wiring/framework guarantees, mutate shared singletons (service.test#0), or test dead code (providers-runtime#2). Numerous uncovered branches (resolveTier free/paid-only, groq/cerebras caps, describeModel fallbacks, formatContext 'Varies'). |
| Completeness | 2/5 | D5/Task 13 server-side validation entirely missing and falsely reported GREEN; the JSDoc promises it (xc-completeness#2). never-blank-picker breached on cache-missing-provider and shrink-guard-bypass paths. Outgoing payload not Zod-validated at the boundary. Snapshot regen not wired into prepare:artifacts; tsup-inline anti-regression test never built. PROVIDER_CAPABILITIES frozen to the bundled snapshot rather than live data. And the catalog layer is untracked in git, so the feature would not build from a clean checkout. |
| Security | 2/5 | Multiple confirmed issues: activateProvider model validation is a vacuous control accepting any model for any provider (r1-security#1); API-key guard fails open on secret-read error (r6-security#0); cache-file path leaked to HTTP client on write failure (r5-security#0); live fetch follows cross-host redirects then persists the redirected body to a global on-disk cache (r7-security#0); response size never capped (r2-security#0); env-credential varName validated against the global allowlist but not bound to the provider it is saved for (r4-security#0); the new route shares one global rate-limit bucket with OpenRouter (r2-security#0/boundaries). The closed enum + ZHIPU_API_KEY exclusion from the allowlist are the genuine positives. |
| React | 4/5 | Hook design mirrors the established useOpenRouterModels pattern cleanly and consumers keep the stable ModelInfo/PROVIDER_CAPABILITIES contract. Issues are mostly test-shaped (mocking an internal module instead of the API boundary, r2-react#0; asserting call args rather than observable behavior) plus the guardQueryState idle-query spinner and the transient-refetch data-loss, both already counted under Patterns/Error-Handling. Component code itself is idiomatic React 19. |

## Top risks

1. FALSE-GREEN CONTRACT GAP (HIGH): D5/Task 13 server-side activateProvider model validation is unimplemented — service.ts:177-190 accepts any non-empty model id for any provider via the relaxed UserConfigSchema, while providers.ts:32-34 JSDoc and EXECUTE.md both claim it exists. A security/validation boundary the design treats as load-bearing is absent and was reported as done.
2. REPO INTEGRITY (HIGH): the entire pure catalog layer (libs/core/src/catalog/*) and catalog-errors.ts are UNTRACKED in git and not gitignored, while edited tracked files import them. A clean checkout/CI build would fail to compile — the feature is not actually committable as-is.
3. RESILIENCE / NEVER-BLANK-PICKER BREACH (HIGH): getProviderModels serves an empty picker tagged source='cache' when the fresh cache lacks the requested provider (models-dev-catalog.ts:94-95, no snapshot fallback), and a missing/corrupt cache disables the shrink-guard so a degenerate live fetch (e.g. dropping a provider) is accepted and persisted — poisoning the global on-disk cache for every future request (90-118).
4. UNHANDLED PERSISTENCE FAILURE + PATH LEAK (HIGH): persistDiskCache is called unguarded after a successful live fetch (112-114) and writeJsonFileSync (fs.ts:83-84) has no try/catch, so a disk-write error throws out of getProviderModels, discards the good in-memory result, and surfaces the cache file path to the HTTP client via the INTERNAL_ERROR message.
5. HEADLINE TEST COVERAGE OVER-CLAIMED (HIGH): the structured_output:null regression test is vacuous (asserts only non-empty strings), model selection is untested in both UI surfaces, the D4 OpenRouter compatibility-label branch is untested everywhere, and the shrink-guard / never-empty / persistence tests do not actually exercise the conditions they name — so sota-verify CLEAN cannot be trusted for exactly the contracts the design flags as critical.
6. CODE-QUALITY DEBT TAIL (MEDIUM): capabilities frozen to the bundled snapshot instead of live data, getCompatibilityLabel duplicated across web/CLI, models.dev path bypassing the D6 withTtlAndFallback helper, ~2MB synchronous Zod revalidation on the hot path, and a broad set of dead exports/AI-voice comments — individually low but collectively indicative of insufficient final cleanup.

## Findings overview

| Severity | Count |
|---|:---:|
| critical | 0 |
| high | 9 |
| medium | 34 |
| low | 103 |
| **total** | **146** |

| Category | Count |
|---|:---:|
| test-quality | 49 |
| completeness | 21 |
| dead-code | 18 |
| DRY | 14 |
| patterns | 10 |
| error-handling | 9 |
| anti-slop | 7 |
| security | 6 |
| type-safety | 5 |
| YAGNI | 3 |
| KISS | 2 |
| naming | 1 |
| performance | 1 |

---

## P0 — High severity (must fix before this feature is committable)

The 9 high-severity findings cluster into 4 themes. Related medium findings are cross-referenced; fix them together.

### Theme A — Repo integrity: the catalog layer is untracked in git (BLOCKER)

The entire pure catalog layer (`libs/core/src/catalog/*`, including the generated `catalog-snapshot.ts`) and `libs/core/src/schemas/config/catalog-errors.ts` are UNTRACKED (`git status` `??`) while tracked, modified files import them. A clean checkout / CI build would fail to compile and would ship no offline snapshot. **Resolve first** — this is a `git add` + generated-vs-committed decision, not a code change. After staging, confirm a fresh clone type-checks and `git ls-files libs/core/src/catalog` returns the source set.

#### `r2-completeness-and-deferrals#0` — Entire catalog pure layer (schema/overlay/transform/capabilities/snapshot) and catalog-errors.ts are untracked in git, while the in-scope edited files import them

> `libs/core/src/catalog/provider-overlay.ts:1-133`  (completeness · high · confidence:high)

**Problem.** git ls-files returns ZERO tracked files under libs/core/src/catalog/ (the whole dir shows as `??` untracked), and libs/core/src/schemas/config/catalog-errors.ts is also untracked. Yet the modified, tracked in-scope files depend on them at compile time: service.ts imports PROVIDER_OVERLAY from @diffgazer/core/catalog (line 12) and PROVIDER_DISABLED/CatalogErrorCode (lines 7-9); router.ts imports PROVIDER_DISABLED (line 21). The 345KB offline emergency snapshot (catalog-snapshot.ts, design D6's 'never a blank picker' guarantee), the schema, the overlay, the transforms, deriveCapabilities, format.ts and the barrel are ALL untracked. This is exactly the carried 'catalog dir tracked' deferral; the P5/P6 progress log flagged it open ('libs/core/src/catalog/ ... is untracked and not gitignored — P6 should confirm') and EXECUTE.md never records it as resolved. A commit that stages only modified (already-tracked) files would ship a tree that does not compile and has no offline fallback.

**Evidence.**
```ts
$ git ls-files 'libs/core/src/catalog/*' -> 0 ; $ git status --short -> '?? libs/core/src/catalog/' and '?? libs/core/src/schemas/config/catalog-errors.ts'
```

**Fix.** git add the full libs/core/src/catalog/ directory (including the generated catalog-snapshot.ts) and libs/core/src/schemas/config/catalog-errors.ts before committing, or explicitly decide-and-document which artifacts are generated vs committed. Verify with `git ls-files libs/core/src/catalog` returning the source set, and confirm a fresh clone type-checks.

### Theme B — Server-side model validation (Task 13 / D5) was never implemented, but reported done

`design.md` D5 + plan Task 13 require `activateProvider` to reject a model id absent from the provider's resolved catalog (OpenRouter exempt). It is NOT implemented: `service.ts` only re-runs the relaxed `UserConfigSchema`, whose `isValidModelForProvider` now accepts any non-empty string for any provider. The schema-layer JSDoc and `EXECUTE.md` P4 both claim the validation exists (false GREEN). Implement the live-catalog check + rejection test, fix the fail-open API-key guard, delete/replace the vacuous `safeParse` block, and correct the misleading comment and the `EXECUTE.md` entry. **Related medium:** `r1-security-and-boundaries#1` (vacuous control), `r6-security-and-boundaries#0` (fail-open key guard), `xc-completeness-tasks#2` (false comment).

#### `server-route-client#0` — Server-side activateProvider model validation (Task 13 / D5) never implemented despite GREEN claim

> `cli/server/src/features/config/service.ts:156-199`  (completeness · high · confidence:high)

**Problem.** Plan Task 13 Step 3 and design D5 (design.md:114, plan.md:1917-1934) mandate that activateProvider, when a model is supplied for a non-OpenRouter provider, fetch the provider's live catalog via getProviderModels(providerId) and reject an unknown model id with MODEL_ERROR. EXECUTE.md P4 (line 195) explicitly claims 'Task 13's deferred server-side activateProvider model validation completed here as planned.' That claim is false. activateProvider performs only: existing-provider check, model-presence check, API-key-presence check, and UserConfigSchema.safeParse. Because the relaxed isValidModelForProvider (providers.ts:36-38) returns model.trim().length > 0 for EVERY provider, UserConfigSchema accepts ANY non-empty string — e.g. activating gemini with model 'totally-fake-model-xyz' succeeds. getProviderModelsFromCatalog is imported (line 30) but used ONLY by the new getProviderModels service fn (line 263), never inside activateProvider. There is also no test asserting an unknown model id is rejected for an enabled provider (service.test.ts:149-169 only covers missing-model and unknown-provider).

**Evidence.**
```ts
const validation = UserConfigSchema.safeParse({ provider, model: effectiveModel, createdAt: now, updatedAt: now });
if (!validation.success) { return err(createError("INVALID_BODY", "Model is not valid for the selected provider")); }
```

**Fix.** Inside activateProvider, after the existing provider/key checks and when a model is supplied and provider !== 'openrouter', call await getProviderModelsFromCatalog(provider), and if models.some(m => m.id === effectiveModel) is false return err(createError('MODEL_ERROR', `Model "${effectiveModel}" is not available for provider "${provider}".`)). Add the focused service test from Task 13 Step 4 (catalog mocked: known model activates, unknown is rejected). Correct the EXECUTE.md P4 entry once implemented.

#### `xc-completeness-tasks#0` — Task 13 server-side activateProvider model validation never implemented (false GREEN in EXECUTE.md)

> `cli/server/src/features/config/service.ts:177-190`  (completeness · high · confidence:high)

**Problem.** design.md D5 (line 114) and plan.md Task 13 Step 3 require activateProvider to validate a supplied model id against the provider's LIVE catalog list and reject unknown ids (concrete spec: `const { models } = await getProviderModels(providerId); const known = models.some(m => m.id === model); if (!known) return err(createError('MODEL_ERROR', ...))`, OpenRouter exempt). The actual activateProvider only re-runs `UserConfigSchema.safeParse`, whose refine (`isValidModelForProvider`, providers.ts:36-38) is now just `model.trim().length > 0`. There is NO call to the catalog, no `models.some`, no `MODEL_ERROR`. The catalog fn is imported as `getProviderModelsFromCatalog` but used only by the separate `getProviderModels` route service, never by activateProvider. EXECUTE.md P4 log claims "Task 13's deferred server-side activateProvider model validation completed here as planned" — this is fabricated; the code does not do it. Confirmed by service.test.ts:158-162, which activates gemini with `gemini-2.5-pro` and expects success even though the `catalog.getProviderModels` mock returns undefined by default — the test only passes because activateProvider does NOT touch the catalog (otherwise destructuring `{ models }` from undefined would throw). No test asserts rejection of an unknown model id.

**Evidence.**
```ts
const validation = UserConfigSchema.safeParse({
      provider,
      model: effectiveModel,
      createdAt: now,
      updatedAt: now,
    });
    if (!validation.success) {
      return err(createError("INVALID_BODY", "Model is not valid for the selected provider"));
    }
```

**Fix.** Implement the spec: after the provider/key checks, when `model` is present and `provider !== 'openrouter'`, call `await getProviderModelsFromCatalog(provider)`, and if `!result.models.some(m => m.id === model)` return a typed error (createError('MODEL_ERROR', `Model "${model}" is not available for provider "${provider}".`)). Add the service test from Task 13 Step 4 (known model activates, unknown rejected, catalog mocked at the boundary). Then either remove the now-redundant UserConfigSchema.safeParse block or keep it only as the cheap non-empty guard.

### Theme C — I/O resilience: never-blank-picker breaches, cache poisoning, unhandled persist failure

Three independent failure modes in `models-dev-catalog.ts` violate the D6 "never a blank picker" / "fallback never empty" guarantee and the cache-integrity risk mitigation: (1) a fresh cache missing the requested provider returns `models:[]` tagged `source:'cache'` with no snapshot fallback; (2) the total-only shrink-guard accepts a live fetch that dropped a single enabled provider and persists it, poisoning the global on-disk cache; (3) an unguarded `persistDiskCache` write failure throws out of `getProviderModels`, discards the good in-hand result, and leaks the cache file path into the HTTP 500 body. Fix: per-provider non-empty check with snapshot fall-through; refuse to persist a catalog that drops a previously-present overlay provider; wrap persistence best-effort and never reflect fs paths to the client. **Related medium:** `r3-deep-logic-correctness#2`, `r8-deep-logic-correctness#0` (shrink-guard baseline degrades on corrupt cache), `r3-deep-logic-correctness#0` (UNCERTAIN: fallback ignores `isCacheUsable`), `xc-dry-arch#0`/`xc-completeness-design#1` (bypasses the D6 `withTtlAndFallback` helper), `r3-deep-logic-correctness#1` (~2MB re-validation per request).

#### `xc-security#0` — Live fetch that drops a single provider serves an empty picker and poisons the disk cache (shrink-guard bypass)

> `cli/server/src/shared/lib/ai/models-dev-catalog.ts:90-118`  (completeness · high · confidence:high)

**Problem.** The shrink-guard in fetchModelsDevCatalog only checks the TOTAL model count across the whole catalog (countModels sums every provider, line 26-30 / 57-61). It does not guard the requested provider. If models.dev returns an overall-healthy catalog (total > 50% of baseline) but the specific provider being requested is absent or renamed (e.g. 'groq' temporarily dropped, or 'zai-coding-plan' id changes upstream), then: (1) fetchModelsDevCatalog returns ok, (2) persistDiskCache OVERWRITES the previously-good cache with the provider-missing catalog (cache poisoning), and (3) catalogToModelInfo(catalog, provider) returns [], so the route serves { models: [], source: 'live', cached: false } — a blank picker. This violates the D6 invariant 'never a blank picker' and the design's 'fallback never returns empty'. The only existing protections (snapshot floor + the 'never returns an empty model list' test) trigger solely when the FETCH fails (mockRejectedValue) — never when the fetch succeeds-but-yields-empty-for-this-provider, and the shrink-guard test only covers an all-providers shrink. The dangerous path is untested and unguarded.

**Evidence.**
```ts
const baselineModelCount = cache ? countModels(cache.catalog) : 0;
const fetchResult = await fetchModelsDevCatalog({ baselineModelCount });
if (fetchResult.ok) {
  persistDiskCache(path, { catalog: fetchResult.value, fetchedAt });
  return toResult(fetchResult.value, providerId, fetchedAt, "live", false);
}
```

**Fix.** After resolving a 'live' or 'cache' result, check that catalogToModelInfo(catalog, providerId) is non-empty before returning; if a fresh/live result yields zero models for the requested provider, fall through to the next tier (stale cache, then snapshotResult(providerId)). Also avoid persisting a catalog that loses a previously-present overlay provider, or only treat the disk write as authoritative per-provider. Add a test: live fetch succeeds with a catalog missing one enabled provider -> route still serves a non-empty list for that provider and does not overwrite the good cache.

#### `r5-security-and-boundaries#0` — A disk-write failure when persisting a successful live catalog fetch discards the result and leaks the cache file path to the HTTP client

> `cli/server/src/shared/lib/ai/models-dev-catalog.ts:110-114`  (error-handling · high · confidence:high)

**Problem.** On the live-fetch success path, getProviderModels calls persistDiskCache(path, ...) BEFORE returning the result it already holds. persistDiskCache -> writeJsonFileSync (cli/server/src/shared/lib/fs.ts:72-85) does NOT catch fs errors: fs.writeFileSync/renameSync throw on ENOSPC, EACCES, EROFS, etc. Every other code path in this module is infallible (loadDiskCache swallows errors, fetchModelsDevCatalog returns a Result, parseModelsDevCatalog/catalogToModelInfo never throw), so this is the ONLY throw source. That throw propagates out of getProviderModelsFromCatalog, is caught by the try/catch in config/service.ts getProviderModels (lines 262-266), and is bucketed into ErrorCode.INTERNAL_ERROR -> HTTP 500 via the router. Two distinct problems result: (1) a fully successful, already-fetched live catalog is thrown away and the user gets a 500 instead of their models, purely because the cache could not be written; (2) the error message returned is getErrorMessage(error, ...), and Node fs errors embed the absolute path (e.g. "EACCES: permission denied, open '/Users/<user>/.diffgazer/models-dev.json.<uuid>.tmp'"), so the server reflects the on-disk cache path and username verbatim into the HTTP error body — filesystem/path information disclosure across the server boundary.

**Evidence.**
```ts
if (fetchResult.ok) {
  const fetchedAt = new Date().toISOString();
  persistDiskCache(path, { catalog: fetchResult.value, fetchedAt });
  return toResult(fetchResult.value, providerId, fetchedAt, "live", false);
}
```

**Fix.** Decouple persistence from the response: wrap persistDiskCache in a best-effort try/catch (log-and-continue) and return the freshly fetched catalog regardless of write success — a cache-write failure should never fail a request whose data is already in hand. Separately, in service.ts do not forward raw caught-error text to the client for the catalog INTERNAL_ERROR path; return a fixed generic message (the real error can be logged server-side) so fs paths are never reflected.

#### `r6-deep-logic-correctness#1` — Fresh-cache path serves an empty picker tagged source='cache' when the cached catalog lacks the requested provider's source id, never falling back to the snapshot

> `cli/server/src/shared/lib/ai/models-dev-catalog.ts:94-95`  (completeness · high · confidence:high)

**Problem.** When a fresh, schema-valid disk cache is present, getProviderModels returns `toResult(cache.catalog, providerId, ...)` unconditionally. catalogToModelInfo -> mergeModelsAcrossSources skips any modelsDevId absent from the catalog (`if (!source) continue`), so if the cached catalog happens to be missing the requested provider's source id (e.g. a prior live fetch that dropped 'cerebras', or a hand-trimmed cache), the consumer gets `models: []` tagged `source:'cache'`. The shrink-guard and 3-tier fallback only run on the *fetch* path; the fresh-read path has no per-provider presence check and no escape to CATALOG_SNAPSHOT, so the design's 'never a blank picker' guarantee is violated on a cache hit. The 'never returns an empty model list' test only feeds a complete fixture and does not exercise a provider-missing-from-cache scenario.

**Evidence.**
```ts
if (cache && isCacheFresh(cache)) {
    return toResult(cache.catalog, providerId, cache.fetchedAt, "cache", true);
  }
```

**Fix.** After resolving from any cache (fresh or stale), if the produced ModelInfo[] is empty for an enabled provider, fall through to snapshotResult(providerId) so a structurally-valid-but-provider-missing cache cannot serve a blank picker.

### Theme D — Test suite over-claims coverage of exactly the headline contracts

`sota-verify CLEAN` cannot be trusted for the contracts the design flags as headline. The `structured_output:null` regression test is vacuous (asserts only non-empty strings). Model selection — the central user behavior — is untested in BOTH UI surfaces. The D4 OpenRouter compatibility-label / custom-model branch is untested everywhere. The TUI saving-spinner + activate-error states are untested. Rewrite each to assert observable behavior via accessible queries (so it would fail on the regression it names). **Related medium:** `r1-test-suite-gaps#0` (PROVIDER_DISABLED 404), `r2-test-suite-gaps#0` (model selection), `r1-test-suite-gaps#1` (web loading/error/empty), `r5-test-suite-gaps#0`/`#2` (initial selection markers), `tui-consumers#2`, `r3-test-suite-gaps#0` (groq/cerebras caps), `r2-test-suite-gaps#1`/`#2` (shrink-guard/persist tests inert), `r8-test-suite-gaps#1` (omits enabled providers), `xc-react#0` (mocks an internal module).

#### `catalog-capabilities#0` — Headline regression test for structured_output:null does not actually assert the contract

> `libs/core/src/catalog/capabilities.test.ts:43-47`  (test-quality · high · confidence:high)

**Problem.** The design names this the headline structured_output regression (design.md lines 280 and 298: "structured_output:null does NOT hide a model"; the JSON capability/prose must remain present for an otherwise-capable provider whose structured_output is null/absent). The test picks `zai` (whose fixture models have no structured_output field, so anyStructured===false) but only asserts `caps.jsonMode.length > 0` and `caps.toolCalling.length > 0`. Both strings are non-empty in EVERY branch of deriveCapabilities (jsonMode falls back to the non-empty "Supported where the model offers JSON output", streaming/toolCalling are always non-empty literals). The assertion is trivially true and would still pass if a regression made JSON suppressible — e.g. if line 49 were gated on `anyStructured` or the JSON capability were dropped. It tests almost nothing about the actual contract.

**Evidence.**
```ts
const caps = deriveCapabilities(catalog, "zai");
    expect(caps.jsonMode.length).toBeGreaterThan(0);
    expect(caps.toolCalling.length).toBeGreaterThan(0);
```

**Fix.** Assert the observable contract directly: `expect(caps.capabilities).toContain("JSON")` (the array push at capabilities.ts:49 is the suppression-proof behavior) and `expect(caps.jsonMode).toMatch(/JSON/i)`. Optionally also assert that the chosen provider genuinely has structured_output absent/null in the fixture so the test name stays honest.

#### `r3-test-suite-gaps#2` — OpenRouter compatibility-label branch (D4) is untested in both the web dialog and TUI overlay — every UI test feeds only non-OpenRouter providers

> `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx:45-53`  (test-quality · high · confidence:high)

**Problem.** The web dialog renders an OpenRouter-only compatibility notice (getCompatibilityLabel + 'You can enter a custom model ID at your own risk.', model-select-dialog.tsx:154-160) and the TUI overlay renders the same label (model-select-overlay.tsx:204-230) plus a custom-model action — behavior that is the entire point of keeping OpenRouter on its live key-gated path (D4). Both UI test files only ever pass provider='gemini'/providerId='gemini', so the OpenRouter branch — compatibility label text, the custom-model affordance (showCustomAction), and the openRouter vs catalog hook selection — is never rendered or asserted in any in-scope UI test. A refactor that breaks the OpenRouter dialog path would pass all UI tests.

**Evidence.**
```ts
provider="gemini" ... // only gemini; no provider="openrouter" case anywhere in the UI tests
```

**Fix.** Add an OpenRouter-path render to the web dialog and TUI overlay tests (provider='openrouter', mocked useOpenRouterModelsMapped) asserting the compatibility label text and the custom-model action are shown, exercising the isOpenRouter branch.

#### `r5-test-suite-gaps#1` — TUI overlay: saving spinner and activate-mutation-error states are entirely untested

> `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx:102-193`  (test-quality · high · confidence:high)

**Problem.** The overlay file contains exactly ONE test (the ArrowUp clamp bug). The component owns two observable states driven by useActivateProvider that no test covers: (1) the "Saving…" Spinner rendered while activateProvider.isPending (source line 243) and the input lock it imposes (useInput isActive: open && !saving, lines 174/199), and (2) the activate error surfaced via activateProvider.error?.message (source lines 100-103) which renders in the error branch. The design's resilience plan requires the error path to render gracefully, and the saving state gates all keyboard interaction. Distinct from r2-test-suite-gaps#0 (which is the happy-path selection action): these are the in-flight and failure observable states of the same mutation, both unverified, so a regression that fails to lock input while saving, or swallows an activation error, would pass.

**Evidence.**
```ts
describe("ModelSelectOverlay ArrowUp after list shrinks (W9.5 bug fix)", () => {
  ...
  test("rebases ArrowUp on safeHighlightIndex ...")
```

**Fix.** Add tests that mock the api.activateProvider boundary to (a) stay pending and assert the "Saving…" spinner shows and arrow keys no longer move the highlight, and (b) reject and assert the error message is rendered to the user.

---

## P1 — Medium severity (34) — grouped by file

### `cli/server/src/shared/lib/ai/models-dev-catalog.ts` (6)

#### `r3-deep-logic-correctness#1` — Fresh models.dev cache path re-reads and full-Zod-revalidates the entire ~2MB multi-provider catalog synchronously on every request

> `cli/server/src/shared/lib/ai/models-dev-catalog.ts:90-96`  (performance · medium · confidence:high)

**Problem.** getProviderModels persists and reads the ENTIRE parsed live catalog (all ~50 models.dev providers, hundreds-to-thousands of models; line 112 persists fetchResult.value untrimmed and parseModelsDevCatalog keeps every provider). On the common fresh-cache path, every HTTP request calls loadDiskCache (disk-cache.ts lines 9-14), which does a synchronous readJsonFileSync of that ~2MB file plus a full ModelsDevCatalogSchema.safeParse over every provider and model, then discards everything except the one overlay's modelsDevIds via catalogToModelInfo. There is no in-memory memoization (service.ts just awaits the catalog function each call). The picker fetches all 6 enabled providers, so a single picker open triggers 6 synchronous full-catalog reads + 6 full Zod re-validations of data that is ~99% discarded. Design D6 calls for a slim payload; the disk cache and its per-request revalidation are the opposite.

**Evidence.**
```ts
const cache = loadDiskCache(path, ModelsDevCatalogCacheSchema);
if (cache && isCacheFresh(cache)) {
  return toResult(cache.catalog, providerId, cache.fetchedAt, "cache", true);
}
```

**Fix.** Memoize the parsed catalog in module scope keyed by fetchedAt (parse once per cache generation), or trim the persisted cache to overlay providers/used fields like the snapshot. At minimum, avoid re-running a full Zod safeParse of the whole 2MB blob on every request to a single provider.

#### `r3-deep-logic-correctness#2` — Shrink-guard counts only post-parse survivors, so a partially-corrupt upstream payload passes the guard and poisons/ratchets the cache

> `cli/server/src/shared/lib/ai/models-dev-catalog.ts:55-64`  (error-handling · medium · confidence:medium)

**Problem.** parseModelsDevCatalog silently drops any provider whose provider-level shape fails and any model whose per-model safeParse fails, returning the survivors. fetchModelsDevCatalog then counts only the SURVIVING models against baseline*0.5. If an upstream schema change breaks the per-model shape for many providers but leaves enough valid models to clear 50% of baseline (or baseline is 0 on first run), the heavily-truncated catalog passes the guard and is persisted as the new trusted cache, which becomes the next run's baseline, ratcheting the floor downward. The guard measures post-drop survivors, not raw upstream size, so silent mass-drops are invisible to it; first run (baseline 0) accepts any non-zero count.

**Evidence.**
```ts
const catalog = parseModelsDevCatalog(payload);
const liveCount = countModels(catalog);
const baseline = options?.baselineModelCount ?? 0;
if (baseline > 0 && liveCount < baseline * SHRINK_GUARD_RATIO) { ... }
```

**Fix.** Track a drop ratio (raw upstream provider/model count vs surviving count) and refuse to persist (fall back to cache/snapshot) when an unexpectedly large fraction was dropped. Consider seeding the first-run baseline from CATALOG_SNAPSHOT's overlay-provider count rather than accepting any non-zero payload blindly.

#### `r8-deep-logic-correctness#0` — Corrupt or schema-invalid disk cache silently disables the shrink-guard baseline (degrades to first-run, accepts a degenerate live fetch)

> `cli/server/src/shared/lib/ai/models-dev-catalog.ts:92-118`  (error-handling · medium · confidence:medium)

**Problem.** getProviderModels derives the shrink-guard baseline from loadDiskCache: `const baselineModelCount = cache ? countModels(cache.catalog) : 0` (line 107). loadDiskCache (disk-cache.ts:9-14) returns null in TWO indistinguishable cases: (a) genuine first run / missing file, and (b) a present-but-unloadable cache — either unreadable/corrupt JSON (readJsonFileSync returns null) OR a cached catalog that fails ModelsDevCatalogCacheSchema.safeParse (e.g. a truncated write, disk error, or schema drift after a model-shape change). In case (b), baselineModelCount collapses to 0, and fetchModelsDevCatalog short-circuits the shrink-guard entirely (`if (baseline > 0 && liveCount < baseline * SHRINK_GUARD_RATIO)`, line 59). The next live fetch then runs with NO shrink protection: any upstream payload with >=1 model (line 62 only rejects an exact-zero parse) is accepted and immediately persisted (lines 110-113), ratcheting the on-disk cache down to a half-populated catalog. design.md D6 line 281 pins the baseline as 'the prior *trusted disk cache* (the freshness yardstick)', explicitly distinct from first-run-accept; a cache that exists but cannot be loaded is precisely when a large stale baseline should have guarded the fetch, yet it is treated as if no cache ever existed. This is distinct from r3-deep#2 (partial-corruption of the upstream payload passing the post-parse count guard) and xc-security#0 (a single dropped provider) — here the GUARD'S OWN BASELINE silently degrades to 0 on any local cache-load failure.

**Evidence.**
```ts
const baselineModelCount = cache ? countModels(cache.catalog) : 0;
... 
if (baseline > 0 && liveCount < baseline * SHRINK_GUARD_RATIO) {
```

**Fix.** Distinguish 'no cache file' from 'cache file present but unloadable'. If the cache path exists on disk but loadDiskCache returns null (corrupt/schema-invalid), do not treat the run as a baseline-free first run: either quarantine the corrupt file (fs.ts already exposes quarantineCorruptFile) and fall through to the bundled CATALOG_SNAPSHOT model count as an emergency floor for the baseline, or refuse to persist a fetch that cannot be shrink-checked. At minimum, log the load failure so a degraded baseline is observable rather than silent.

#### `xc-completeness-design#1` — models.dev cache path bypasses the shared withTtlAndFallback helper D6 mandated unifying onto

> `cli/server/src/shared/lib/ai/models-dev-catalog.ts:90-118`  (completeness · medium · confidence:high)

**Problem.** D6 binds: 'Unify with the OpenRouter cache by extracting loadCache/persistCache/withTtlAndFallback parameterized by (path, schema, ttl, optional keyHash); OpenRouter passes a keyHash, models.dev passes none' (design.md:122). The disk-cache.ts module was correctly extracted and openrouter-models.ts was refactored onto withTtlAndFallback (openrouter-models.ts:128), but getProviderModels hand-rolls its own TTL check (isCacheFresh), fetch-then-persist, and cache-fallback flow instead of calling withTtlAndFallback — reusing only the lower-level loadDiskCache/persistDiskCache. The result is that the keyless models.dev path uses none of the unified resolution the helper was generalized (with `keyHashOf`/`currentKeyHash` made optional) to serve. This is a partial deviation: the cache primitives are shared, but the TTL+fallback orchestration the design called out by name is duplicated. (Mitigating: models.dev legitimately needs a third snapshot tier and a shrink-guard the helper does not model, so full reuse is not free.)

**Evidence.**
```ts
const cache = loadDiskCache(path, ModelsDevCatalogCacheSchema);
if (cache && isCacheFresh(cache)) { return toResult(cache.catalog, ...); }
...
const fetchResult = await fetchModelsDevCatalog({ baselineModelCount });
if (fetchResult.ok) { persistDiskCache(path, ...); ... }
```

**Fix.** Either route the live→stale-cache portion of getProviderModels through withTtlAndFallback (passing no keyHash, with the snapshot tier and shrink-guard layered around it), or explicitly amend D6 to say models.dev shares the cache primitives but keeps its own three-tier orchestration because of the snapshot tier + shrink-guard. Pick one so the implementation and the binding decision stop diverging silently.

#### `xc-dry-arch#0` — models-dev catalog reimplements the cache-resolution flow inline instead of the shared withTtlAndFallback helper (D6 violation)

> `cli/server/src/shared/lib/ai/models-dev-catalog.ts:90-118`  (DRY · medium · confidence:high)

**Problem.** getProviderModels hand-rolls the full disk-cache resolution flow (loadDiskCache -> fresh check via local isCacheFresh -> fetch -> persistDiskCache -> stale-cache fallback) that is already implemented generically in disk-cache.ts's withTtlAndFallback, which openrouter-models.ts consumes. Design D6 explicitly mandates: "Unify with the OpenRouter cache by extracting loadCache/persistCache/withTtlAndFallback parameterized by (path, schema, ttl, optional keyHash); OpenRouter passes a keyHash, models.dev passes none." The helper even carries the keyHashOf/currentKeyHash params designed precisely so models.dev can omit them — yet models.dev never calls it. The result is two parallel TTL/fetch/persist/fallback flows that can drift (e.g. one persists on success, the other could diverge on error handling). The only real difference (shrink-guard needs a baseline count) is already available as countModels(cache.catalog) and fits the helper's existing isCacheUsable/fetcher seam.

**Evidence.**
```ts
const cache = loadDiskCache(path, ModelsDevCatalogCacheSchema);
  if (cache && isCacheFresh(cache)) { return toResult(...,"cache",true); }
  ...
  const fetchResult = await fetchModelsDevCatalog({ baselineModelCount });
  if (fetchResult.ok) { persistDiskCache(path, {...}); return toResult(...,"live",false); }
  if (cache) return toResult(...,"cache",true);
```

**Fix.** Route getProviderModels through withTtlAndFallback (pass path, ModelsDevCatalogCacheSchema, CACHE_TTL_MS, no keyHash; move the offline short-circuit and the shrink-guard baseline into the fetcher closure which already has the loaded cache in scope). Delete the duplicated isCacheFresh + inline resolution. This is the explicit D6 deliverable.

#### `xc-dry-arch#2` — ProviderModelsResult interface duplicates the Zod-derived ProviderModelsResponse contract

> `cli/server/src/shared/lib/ai/models-dev-catalog.ts:67-72`  (DRY · medium · confidence:medium)

**Problem.** ProviderModelsResult declares { models: ModelInfo[]; fetchedAt: string; source: "live"|"cache"|"snapshot"; cached: boolean }, which is structurally identical to ProviderModelsResponse (z.infer of ProviderModelsResponseSchema in libs/core schemas/config/models.ts). The config service (service.ts:251-263) already returns the catalog function's value typed as ProviderModelsResponse, proving they must stay in lockstep. The source union literal "live"|"cache"|"snapshot" is now hand-typed in three places (this interface, the schema enum, and providers/use-provider-models-mapped.ts:9), so adding a future source tag requires editing all three. This is the single-source-of-truth principle from D6's slim HTTP contract being bypassed.

**Evidence.**
```ts
export interface ProviderModelsResult {
  models: ModelInfo[];
  fetchedAt: string;
  source: "live" | "cache" | "snapshot";
  cached: boolean;
}
```

**Fix.** Make ProviderModelsResult an alias of the canonical ProviderModelsResponse type from @diffgazer/core/schemas/config (the schema is the source of truth for the wire contract), or have the service derive its return type from this interface — but not both hand-maintained. At minimum, reuse ProviderModelsResponse["source"] for the union rather than re-typing the literal.

### `cli/server/src/features/config/service.ts` (4)

#### `r1-completeness-and-deferrals#0` — D4 OpenRouter boundary is enforced only in client hooks, not in the server service that owns it

> `cli/server/src/features/config/service.ts:251-267`  (completeness · medium · confidence:medium)

**Problem.** Design D4 (LOCKED) requires OpenRouter to stay on its live key-gated API because models.dev's openrouter data is a lagging subset that lacks per-model `supported_parameters` — the field Diffgazer's `isOpenRouterCompatible` structured-output gate and the `require_parameters:true` strict path depend on. But `getProviderModels(providerId)` accepts `openrouter` (its overlay is `enabled:true`) and would call `getProviderModelsFromCatalog('openrouter')`, serving OpenRouter models from the models.dev catalog/snapshot (openrouter IS in CATALOG_SNAPSHOT). The only things preventing this are (a) the HTTP route `/provider/openrouter/models` shadowing `/provider/:id/models`, and (b) the `useProviderModelsMapped`/TUI hooks guarding `provider !== OPENROUTER_PROVIDER_ID`. The service that owns the boundary has no guard, so any future direct caller of the service silently violates D4 and serves OpenRouter models stripped of the compatibility metadata the gate needs.

**Evidence.**
```ts
if (!PROVIDER_OVERLAY[provider].enabled) { ... }
  try { return ok(await getProviderModelsFromCatalog(provider)); }
```

**Fix.** Reject `openrouter` in the service `getProviderModels` (e.g. a typed `PROVIDER_DISABLED`/`VALIDATION_ERROR` for openrouter, mirroring how disabled providers are rejected) so the D4 boundary is enforced at the layer that owns it, not only in two consumer hooks.

#### `r1-security-and-boundaries#1` — activateProvider model-validation block is a vacuous control that accepts any non-empty model id for any provider

> `cli/server/src/features/config/service.ts:177-190`  (security · medium · confidence:medium)

**Problem.** The block reads as a model-validity gate ('Validate the model against provider-level constraints') and constructs UserConfigSchema.safeParse with the effective model, implying server-side enforcement. But UserConfigSchema's only model refinement delegates to isValidModelForProvider (providers.ts:36-38) which returns `model.trim().length > 0` — the provider arg is ignored. The route already enforced model via ActivateProviderBodySchema (z.string().min(1)). So this 14-line block can never reject a real request: any caller can activate an arbitrary model string (typos, hallucinated ids, models belonging to a different provider) so long as it is non-whitespace. This is security theater — a control that looks like validation but enforces nothing — distinct from the already-reported absence of a live-catalog check: the problem here is that the present code misleads readers/auditors into believing activation is validated.

**Evidence.**
```ts
const validation = UserConfigSchema.safeParse({ provider, model: effectiveModel, createdAt: now, updatedAt: now });
if (!validation.success) {
  return err(createError("INVALID_BODY", "Model is not valid for the selected provider"));
}
```

**Fix.** Either validate effectiveModel against the provider's resolved catalog (getProviderModelsFromCatalog(provider)) so the message is truthful, or delete the dead safeParse block and rely on the route's z.string().min(1). Do not keep a no-op that masquerades as a provider-scoped model check.

#### `r5-deep-logic-correctness#0` — Router pre-validates provider id, making the service-layer AIProviderSchema re-parse and its VALIDATION_ERROR/400 mapping unreachable

> `cli/server/src/features/config/service.ts:254-257`  (dead-code · medium · confidence:high)

**Problem.** getProviderModels' only production caller is the router's GET /provider/:id/models handler, which already validates the param through ProviderModelsParamSchema = z.object({ id: AIProviderSchema }) (schemas.ts:12). By the time service.getProviderModels(id) runs, `id` is a fully-validated AIProvider, so AIProviderSchema.safeParse(providerId) can never fail in production. The VALIDATION_ERROR return is dead, and so is the router's `result.error.code === ErrorCode.VALIDATION_ERROR ? 400` branch (router.ts:82). This mirrors the already-reported PROVIDER_DISABLED-unreachable issue but is a distinct dead branch (the VALIDATION_ERROR/400 path), so neither the test nor any client can ever exercise the 400 contract.

**Evidence.**
```ts
const parsed = AIProviderSchema.safeParse(providerId);
  if (!parsed.success) {
    return err(createError(ErrorCode.VALIDATION_ERROR, `Unknown provider: ${providerId}`));
  }
```

**Fix.** Drop the redundant safeParse in the service (the router boundary already guarantees a valid AIProvider) and remove the now-dead VALIDATION_ERROR->400 branch in the router, or move the enum validation to the service and keep the router param schema permissive — but not both. Pick one boundary as the source of truth.

#### `r6-security-and-boundaries#0` — activateProvider's 'API key required' guard is bypassed when the secret read errors (fails open)

> `cli/server/src/features/config/service.ts:172-175`  (security · medium · confidence:high)

**Problem.** The guard reads `getStore().getProviderApiKey(provider)` and only blocks activation when the call succeeds AND returns a falsy value: `if (apiKeyResult.ok && !apiKeyResult.value)`. When the secrets-storage read itself fails (`apiKeyResult.ok === false` — e.g. keychain locked, decrypt error, backend unavailable), the condition is false, so the guard is skipped entirely and activation proceeds. This fails open: a provider gets activated/persisted as the active model selection even though its credential could not be verified, after which initializeAIClient (client.ts:241-249) will only surface the failure at review time as a confusing MODEL_ERROR/API_KEY_MISSING. The contiguous getConfig (lines 140-141) and initializeAIClient (lines 242-243) treat a non-ok key read as a hard failure, so this branch is inconsistent with the codebase's own error handling for the same operation.

**Fix.** Treat a failed key read as a blocking error in activateProvider: `if (!apiKeyResult.ok) return err(createError("INVALID_BODY", apiKeyResult.error.message)); if (!apiKeyResult.value) return err(createError("INVALID_BODY", "API key required before selecting model"));` so activation fails closed when the credential cannot be confirmed.

### `cli/server/src/shared/lib/ai/models-dev-catalog.test.ts` (3)

#### `r2-test-suite-gaps#1` — "shrink-guarded fetch falls back to snapshot" test never actually triggers the shrink-guard

> `cli/server/src/shared/lib/ai/models-dev-catalog.test.ts:113-118`  (test-quality · medium · confidence:high)

**Problem.** The test name claims to cover the shrink-guard at the getProviderModels integration level, but it runs with no disk cache, so baselineModelCount resolves to 0 (models-dev-catalog.ts:107) and the shrink-guard branch (`baseline > 0 && liveCount < baseline*0.5`) is never entered. The empty `{ google: { models: {} } }` payload falls to snapshot only via the unrelated `liveCount === 0` zero-guard. The design.md testing plan (line 281) explicitly requires the shrink-guard baseline to come from the prior trusted disk cache and reject a far-smaller live fetch in favor of that cache — that integration path (stale cache as baseline -> shrunken live rejected -> serves the STALE CACHE, not the snapshot) has no test. The test's own name misrepresents what it verifies.

**Evidence.**
```ts
vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse({ google: { id: "google", models: {} } })); // no writeCache -> baseline 0, shrink-guard inert
```

**Fix.** Add a test that writeCache(MODELS_DEV_SAMPLE, stale()) (providing a non-zero baseline), mocks fetch to return a payload with >0 but far-fewer models than baseline*0.5, and asserts source==='cache' (the stale cache wins, not the snapshot). Rename or keep the current zero-models case as a separate 'empty payload' test.

#### `r2-test-suite-gaps#2` — "live success persists the cache" only checks the file exists, never that the persisted content is valid / round-trips

> `cli/server/src/shared/lib/ai/models-dev-catalog.test.ts:80-87`  (test-quality · medium · confidence:high)

**Problem.** The persistence assertion is `expect(fs.existsSync(cachePath())).toBe(true)`. It does not read the file back or validate it against ModelsDevCatalogCacheSchema, so a regression that writes a malformed, empty, or partially-serialized cache (the cache-poisoning risk explicitly called out in design.md risks and in already-reported xc-security#0) would still pass this test. The behavior that matters — 'the next request can serve this persisted cache as fresh' — is not asserted; only a side-effect (a file appeared on disk) is.

**Evidence.**
```ts
expect(fs.existsSync(cachePath())).toBe(true);
```

**Fix.** Read the persisted file and assert ModelsDevCatalogCacheSchema.safeParse(JSON.parse(...)).success === true and that a follow-up getProviderModels('gemini') with fetch now failing serves source==='cache' from it (proving the round-trip), or assert the persisted catalog contains the expected provider models.

#### `r8-test-suite-gaps#1` — "never returns an empty model list" omits two enabled providers (zai-coding, openrouter) despite asserting an every-enabled-provider contract

> `cli/server/src/shared/lib/ai/models-dev-catalog.test.ts:137-142`  (test-quality · medium · confidence:high)

**Problem.** The never-blank-picker test (the design's 'never empty' resilience guarantee, the opencode #4959 regression it explicitly cites) iterates only ["gemini", "groq", "cerebras", "zai"], silently dropping zai-coding and openrouter — both enabled providers in PROVIDER_OVERLAY whose source ids (zai-coding-plan, openrouter) are present in the bundled CATALOG_SNAPSHOT. zai-coding is the highest-risk case (hasFreeTier:false, all models classify paid) and openrouter resolves through a separate modelsDevId; a snapshot/overlay change that emptied either picker would not be caught. The test name claims a per-provider universal but the body hardcodes a partial subset, the same single-source-of-truth gap already flagged for the smoke script (r2-completeness#1) but here in a different file with a different roster.

**Evidence.**
```ts
for (const id of ["gemini", "groq", "cerebras", "zai"] as const) { expect((await getProviderModels(id)).models.length).toBeGreaterThan(0); }
```

**Fix.** Derive the loop from the enabled overlay roster (or at minimum add "zai-coding" and "openrouter") so the never-empty guarantee is asserted for every provider the picker can actually request.

### `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx` (2)

#### `r1-test-suite-gaps#1` — Web model-select-dialog integration test omits loading, error, and empty-state coverage

> `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx:57-85`  (test-quality · medium · confidence:high)

**Problem.** This is the only test file for the web catalog dialog, and it covers only the happy path (render free-first + apply free filter). model-select-dialog.tsx computes catalogError, emptyLabel and isLoading (lines 113-116) and threads them into ModelList — these render an in-UI error message / loading indicator / empty label, which is exactly the graceful-degradation surface the design's three-tier-fallback resilience plan exists to feed. None of those rendered states is asserted on the web consumer. The TUI side covers loading/error (and the TUI gap was separately flagged as tui-consumers#2), but the web consumer's error and loading rendering paths are entirely untested.

**Evidence.**
```ts
const catalogError = isOpenRouter ? openRouter.error : catalog.error;
const emptyLabel = catalogError ?? "No models match your search";
const isLoading = isOpenRouter ? openRouter.loading : catalog.loading;
```

**Fix.** Add web integration tests: (a) getProviderModels rejecting -> the dialog renders the error text via ModelList emptyLabel; (b) a pending query renders the loading state; assert via accessible queries (getByRole/getByText), not internal hook state.

#### `r5-test-suite-gaps#0` — Web dialog passes currentModel but never asserts the pre-checked radio (initial selection state untested)

> `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx:49`  (test-quality · medium · confidence:high)

**Problem.** renderDialog() passes currentModel="gemini-2.5-flash", which the source wires into ModelList as the radiogroup value={currentModelId} (model-list.tsx:61), producing an observable aria-checked radio. No test asserts that the current model renders as the checked option. This is a distinct contract from the model-selection action (already-reported r2-test-suite-gaps#0): it is the INITIAL pre-selection state a user sees when reopening the dialog for an already-configured provider. The prop is supplied but its only observable effect is never verified, so a regression that drops currentModel wiring would pass silently.

**Evidence.**
```ts
currentModel="gemini-2.5-flash"
      onSelect={vi.fn()}
```

**Fix.** After the radios render, assert the current model is checked, e.g. expect(screen.getByRole("radio", { name: /Gemini 2\.5 Flash/ })).toBeChecked() (or assert aria-checked="true" on that radio and "false" on the others).

### `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx` (2)

#### `r2-test-suite-gaps#0` — No test exercises model selection — the central user behavior — in either the web dialog or the TUI overlay

> `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx:107-192`  (test-quality · medium · confidence:high)

**Problem.** The single overlay test only verifies ArrowUp/ArrowDown highlight clamping; it passes `onSelect={() => {}}` and `onOpenChange={() => {}}` and never presses Enter, so the core flow (Enter on a highlighted model -> activateProvider.mutate({providerId, model}) -> onSelect(modelId) -> onOpenChange(false)) is completely uncovered. The web dialog test (model-select-dialog.integration.test.tsx:50) likewise passes `onSelect={vi.fn()}` and never asserts it fires. Selecting a model is the entire purpose of these components, yet the activation handler (model-select-overlay.tsx:131-141), the success-close behavior, and the onSelect contract have zero coverage. This is distinct from the already-reported loading/error/empty-state gap — it is the missing happy-path behavior assertion.

**Evidence.**
```ts
<ModelSelectOverlay open providerId="gemini" onSelect={() => {}} ... /> // never pressed Return; activateProvider.mutate path untested
```

**Fix.** Add a test that highlights a model, presses Enter (`stdin.write("\r")` / userEvent confirm), and asserts the onSelect spy is called with the chosen id and onOpenChange(false) fires after a successful activate mutation. Mock the activate endpoint at the api boundary (already mocked via BoundApi).

#### `r5-test-suite-gaps#2` — TUI overlay never feeds selectedId, leaving the current-model marker (isSelected) unverified

> `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx:108-117`  (test-quality · medium · confidence:high)

**Problem.** Every render in this file passes ModelSelectOverlay without a selectedId prop. The source renders each ModelListItem with isSelected={model.id === selectedId} (source line 68/239) to mark the user's currently-active model. With selectedId always undefined, no row is ever the selected one, so the observable 'this is your current model' marker is never exercised. This is the TUI analogue of the web pre-check gap but a distinct file/component, and unlike the web radiogroup the TUI uses a custom marker that has no other coverage.

**Evidence.**
```ts
<ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={() => {}}
        />
```

**Fix.** Render the overlay with selectedId set to one of the fixture model ids and assert the rendered frame marks that model as selected (and only that model).

### `cli/server/src/shared/lib/ai/client.ts` (2)

#### `r1-anti-slop-and-deadcode#1` — zhipu `baseURL` hardcoded in client.ts duplicates the overlay value that exists precisely to be the single source of truth

> `cli/server/src/shared/lib/ai/client.ts:86,93`  (DRY · medium · confidence:high)

**Problem.** The `zai` and `zai-coding` SDK branches hardcode `baseURL: "https://api.z.ai/api/paas/v4"` and `.../coding/paas/v4` inline, while `PROVIDER_OVERLAY.zai.baseURL` / `PROVIDER_OVERLAY['zai-coding'].baseURL` already carry the identical strings. The groq/cerebras branch in the same function correctly reads `overlay.baseURL`. This is two sources of truth for the same URL; a future endpoint change must be made in two files or the overlay value silently diverges (it is already dead for zhipu). This is distinct from the already-reported overlay#1 finding, which flags the overlay field as ignored — here the concrete duplication and the inconsistency with the sibling openai-compatible branch in the SAME function is the issue.

**Evidence.**
```ts
case "zai": {
  const zhipu = createZhipu({ apiKey, baseURL: "https://api.z.ai/api/paas/v4" });
```

**Fix.** Read `PROVIDER_OVERLAY[provider].baseURL` in the zhipu branch exactly as the groq/cerebras branch does, removing the inline literals so the overlay is the single source.

#### `r1-anti-slop-and-deadcode#3` — Identical 10-line abort-signal construction block duplicated across `generate` and `generateStream`

> `cli/server/src/shared/lib/ai/client.ts:158-167,190-199`  (DRY · medium · confidence:high)

**Problem.** Both methods build the timeout/abort signal with byte-for-byte identical logic (timeoutMs resolution, `AbortSignal.timeout`, feature-detect, `AbortSignal.any` vs `??`). This is a 3rd-occurrence-worthy DRY candidate: same stable contract (config + optional external signal -> AbortSignal | undefined), and any change to timeout semantics must be edited in two places. The duplication is non-trivial (feature-detection + combining branch), not two trivial lines.

**Evidence.**
```ts
const abortSignal =
  timeoutSignal && externalSignal
    ? AbortSignal.any([timeoutSignal, externalSignal])
    : timeoutSignal ?? externalSignal;
```

**Fix.** Extract `resolveAbortSignal(config, options?.signal)` returning `AbortSignal | undefined` and call it from both methods.

### `libs/core/src/schemas/config/capabilities.ts` (2)

#### `r1-deep-logic-correctness#0` — Provider capabilities never derive from live/cached models.dev data — frozen to the bundled snapshot

> `libs/core/src/schemas/config/capabilities.ts:45-50`  (completeness · medium · confidence:high)

**Problem.** deriveCapabilities is invoked exactly once, at module-load, with CATALOG_SNAPSHOT (the static, bundled emergency fallback). A repo-wide grep confirms it is never called with the live or disk-cached catalog. The HTTP route (router.ts /provider/:id/models) returns only ModelInfo[] + source — capabilities are not served. So every capability card (toolCalling, jsonMode, contextWindow, tier, tierBadge, costDescription) consumed by apps/web provider-details/provider-list/provider-step is permanently pinned to whatever was captured in catalog-snapshot.ts, even when the model picker beside it shows live prices/context/new ids. This contradicts design Goal #1 ('Derive model data (names, pricing, context, CAPABILITIES, new ids) live from models.dev') and the D2/architecture description of deriveCapabilities operating on 'the catalog'. The catalog parameter of deriveCapabilities is effectively dead — only the snapshot is ever passed.

**Evidence.**
```ts
export const PROVIDER_CAPABILITIES = Object.fromEntries(
  (Object.keys(PROVIDER_OVERLAY) as AIProvider[]).map((id) => [
    id,
    deriveCapabilities(CATALOG_SNAPSHOT, id),
  ]),
)
```

**Fix.** Either (a) wire capabilities through the live catalog path — e.g. have the server compute deriveCapabilities(resolvedCatalog, provider) and ship it on the /provider/:id/models response so the card matches the model list source — or (b) if a static snapshot-derived card is the accepted design, drop the misleading live-derivation claims from design.md Goal #1 / D2 and document that capability prose is intentionally snapshot-frozen. As-is the implementation silently diverges from the stated contract.

#### `r5-anti-slop-and-deadcode#0` — ProviderInfo.models is permanently-empty vestigial data, leaving dead UI branches after the catalog migration

> `libs/core/src/schemas/config/capabilities.ts:36-43`  (dead-code · medium · confidence:high)

**Problem.** AVAILABLE_PROVIDERS now hardcodes `models: []` for every provider with the comment that the static array 'is no longer the source of truth' (lines 40-42). But ProviderInfoSchema still requires `models: z.array(z.string()).readonly()` (providers.ts:14), so the field survives only as dead, always-empty payload. The TUI onboarding provider-step consumes it: getProviderDescription does `if (!info || info.models.length === 0)` then `return info.models.join(", ")` — since info.models is ALWAYS [], the `length === 0` guard is always true and the `info.models.join()` line is unreachable. Net effect: every non-OpenRouter provider now renders an empty description string, and a whole code path is dead. This is the migration leaving a vestigial field plus a dead branch, distinct from the already-reported isValidModelForProvider param and buildModels findings.

**Evidence.**
```ts
models: [],
  // Runtime model lists come from the catalog route; the static array is no
  // longer the source of truth.
```

**Fix.** Drop the `models` field from ProviderInfoSchema/ProviderInfo entirely and stop synthesizing `models: []`. Update the TUI provider-step.tsx getProviderDescription to remove the dead `info.models` branch (it can only ever hit the empty path), or move its description copy to the overlay.

### `scripts/monorepo/smoke-modelsdev.mjs` (2)

#### `r2-completeness-and-deferrals#1` — Never-blank-picker smoke validates only 3 of the 6 enabled providers; zai and zai-coding are silently omitted despite the function's own 'every enabled provider' contract

> `scripts/monorepo/smoke-modelsdev.mjs:9,19-26`  (completeness · medium · confidence:high)

**Problem.** design D6 + the testing plan require the offline snapshot to guarantee a non-blank picker for the enabled roster ('all 6 enabled providers parse', 'never empty'). The shared assertCatalogProviders helper documents this contract ('every enabled provider must resolve to at least one model, otherwise the picker would be blank' — smoke-modelsdev.test.mjs:6). But the runner hardcodes ENABLED_PROVIDERS = ['gemini','groq','cerebras'] and runs both the bundled-snapshot pass and the live pass over only those three. zai and zai-coding are enabled:true in PROVIDER_OVERLAY and ARE present in the committed snapshot, yet a bad snapshot regenerate that dropped zai/zai-coding models (a blank zai picker offline) would pass the smoke green. (openrouter is correctly excluded — it has its own live path.) The coverage promised by the helper's contract is not delivered by its caller.

**Evidence.**
```ts
const ENABLED_PROVIDERS = ["gemini", "groq", "cerebras"];  // smoke-modelsdev.mjs:9 — vs 6 enabled in PROVIDER_OVERLAY
```

**Fix.** Include the snapshot-backed enabled providers in ENABLED_PROVIDERS — at minimum add 'zai' and 'zai-coding' (the providers whose offline picker is served from CATALOG_SNAPSHOT). Optionally derive the list from PROVIDER_OVERLAY (enabled && sdkKind !== 'openrouter') so it can never drift from the roster again.

#### `r4-completeness-and-deferrals#0` — Snapshot-bundling verification (design's tsup-inlining anti-regression test) was never realized

> `scripts/monorepo/smoke-modelsdev.mjs:11-26`  (completeness · medium · confidence:high)

**Problem.** Design D6 + the Testing plan ('Snapshot bundling: build the diffgazer binary; assert the snapshot is inlined (no runtime fs json)') + Build sequence step 5 + the med Risk row ('JSON snapshot missing from the tsup binary → blank first-run picker') all call for a check that the *tsup-bundled diffgazer binary* inlines CATALOG_SNAPSHOT. The implemented smoke instead imports the offline snapshot from `libs/core/dist/catalog/index.js` (the plain-tsc core ESM dist) via `await import(resolve(root, "libs/core/dist/catalog/index.js"))`. That validates the source-of-truth module, not the bundled binary that ships to users. The exact regression the design set out to prevent (opencode #4959 blank first-run picker because the snapshot fell out of the binary) is therefore unguarded — the bundle happens to inline it today (chunk-62RLEEUG.js contains the snapshot data), but no test would catch a future tsup/noExternal change that drops it.

**Evidence.**
```ts
const { catalogToModelInfo, CATALOG_SNAPSHOT, parseModelsDevCatalog } = await import(
    resolve(root, "libs/core/dist/catalog/index.js")
  );
```

**Fix.** Add a smoke/test step that builds the diffgazer binary (tsup) and asserts the snapshot is present in the emitted bundle (e.g. grep a known default model id like `gpt-oss-120b` in `cli/diffgazer/dist`, or run the bundled binary with `DIFFGAZER_OFFLINE=1` and assert a non-empty picker), so the binary-inlining guarantee — not just the core dist — is exercised.

### `apps/web/src/features/onboarding/components/steps/model-step.tsx` (1)

#### `r3-completeness-and-deferrals#1` — Web onboarding CatalogModelList has no empty-state branch — a zero-model catalog response renders a dead, selectionless picker

> `apps/web/src/features/onboarding/components/steps/model-step.tsx:136-172`  (completeness · medium · confidence:medium)

**Problem.** CatalogModelList handles only `loading` and `error` from useProviderModelsMapped; when the query resolves successfully with an empty `models` array it falls through to `ModelInfoList`, which renders the subtitle plus an empty RadioGroup with zero selectable items and no manual-id input fallback — a silent dead-end during onboarding with no way to proceed. The error branch's manual-input escape hatch is unreachable in this path because there is no error, just empty data. The sibling web ModelSelectDialog correctly handles this (model-select-dialog.tsx:46 'No models available.' / emptyLabel), so the onboarding step is the inconsistent consumer. Design goal 6 ('never a blank picker') is enforced server-side, but the client has no defense if that guarantee ever degrades (e.g. a future enabled provider whose snapshot/cache resolves to zero models, or a transform regression), and the success-with-empty case is exactly the resilience boundary the design calls out.

**Evidence.**
```ts
const { models, loading, error } = useProviderModelsMapped(true, provider);
  if (loading) { ... }
  if (error) { ... }
  return (<ModelInfoList ... models={models} ... />);
```

**Fix.** Add an explicit `if (!loading && !error && models.length === 0)` branch in CatalogModelList that renders the same manual-id Input fallback used by the error branch (with the provider's defaultModel placeholder), mirroring ModelSelectDialog's empty handling.

### `cli/diffgazer/src/features/onboarding/components/steps/model-step.test.tsx` (1)

#### `tui-consumers#2` — TUI ModelStep/Overlay tests omit error-fallback and empty-state coverage that the resilience design relies on

> `cli/diffgazer/src/features/onboarding/components/steps/model-step.test.tsx:74-88`  (test-quality · medium · confidence:medium)

**Problem.** model-step.test.tsx has a single happy-path test (lists models with free/recommended badges) and model-select-overlay.test.tsx covers only the W9.5 navigation regression. Neither exercises the error branch (lines 71-104 of model-step.tsx render a manual model-ID Input on catalog/OpenRouter failure) nor the empty branch ('No models available for this provider.'). The design's headline goal is offline/failure resilience ('never a blank picker', three-tier fallback, manual entry on error); the manual-entry fallback is real observable behavior with its own UI yet is untested in the TUI slice. A boundary mock that rejects getProviderModels would assert the user can still type a model id.

**Fix.** Add a test that rejects the boundary-mocked getProviderModels and asserts the error message plus the manual-ID Input render (and optionally an empty-models case asserting the 'No models available' text). Keep it behavior-based (rendered output), reusing the existing Wrapper.

### `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx` (1)

#### `tui-consumers#0` — TUI ModelStep consumes catalog via raw query + guardQueryState while every sibling consumer uses the mapped hook

> `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx:60-109`  (DRY · medium · confidence:high)

**Problem.** The TUI onboarding ModelStep wires the catalog with raw useOpenRouterModels/useProviderModels + guardQueryState and hand-rolled loading/error/empty branches. Every other consumer of the same data — the sibling TUI ModelSelectOverlay (model-select-overlay.tsx:94-105), the web ModelSelectDialog (model-select-dialog.tsx:62), and the web onboarding ModelStep (apps/web/.../model-step.tsx:136,182) — consumes through useProviderModelsMapped/useOpenRouterModelsMapped, which already collapse loading/error/data into a flat {models,loading,error} shape. P5 explicitly introduced the mapped hook as the 'web/TUI-facing shape' (EXECUTE.md Task 22), yet this one file did not adopt it, duplicating state-shaping logic and the loading/error/empty UI that the mapped hook plus a small guard already encapsulate elsewhere.

**Fix.** Swap this ModelStep onto useProviderModelsMapped/useOpenRouterModelsMapped (matching model-select-overlay.tsx and the web ModelStep), or factor the loading/error/empty rendering shared with the overlay into one helper. This removes the divergent guardQueryState path and aligns the slice on a single catalog-consumption pattern.

### `cli/server/src/features/config/router.test.ts` (1)

#### `r1-test-suite-gaps#0` — Router test never exercises the PROVIDER_DISABLED -> 404 HTTP contract

> `cli/server/src/features/config/router.test.ts:32-88`  (test-quality · medium · confidence:high)

**Problem.** design.md (line 250) makes the typed PROVIDER_DISABLED error returning HTTP 404 for an enabled:false enum provider an explicit contract of GET /provider/:id/models. router.ts:81-84 implements that status mapping (PROVIDER_DISABLED -> 404), but the router test only covers 200 (live), 200 (snapshot), 400 (unknown id), 429 (rate limit), and the schema shape. The 404/disabled branch is verified ONLY at the service layer (service.test.ts:401), and that service test does it by mutating the shared PROVIDER_OVERLAY singleton (already reported). The HTTP-boundary status code for a disabled provider — the actual contract consumers depend on — has zero coverage, so a regression that mapped PROVIDER_DISABLED to 500 (the fall-through bucket) would pass all router tests. This is distinct from the activateProvider validation gap (server-route-client#0).

**Evidence.**
```ts
it("returns 400 VALIDATION_ERROR for an unknown provider id", ...)
// no test requests an enabled:false provider (mistral/huggingface/github-models) expecting 404
```

**Fix.** Add a router test that requests /config/provider/mistral/models (a surfaced-but-disabled enum provider) and asserts res.status === 404 with body.error.code === "PROVIDER_DISABLED".

### `cli/server/src/shared/lib/ai/disk-cache.ts` (1)

#### `r3-deep-logic-correctness#0` — withTtlAndFallback fetch-failure fallback ignores isCacheUsable, serving a cache the predicate already rejected

> `cli/server/src/shared/lib/ai/disk-cache.ts:49-64`  (error-handling · medium · confidence:high · ⚠ UNCERTAIN (needs human judgment))

**Problem.** isCacheUsable gates whether a FRESH cache is reused (lines 49-54: cacheFresh includes `(isCacheUsable === undefined || isCacheUsable(cache))`). But the fetch-failure fallback at line 63 only checks `cache && keyMatches` and never consults isCacheUsable. So when the network fetch fails and the on-disk cache exists with the correct key but FAILS the usability predicate, the unusable cache is served anyway. For the only real caller (OpenRouter, openrouter-models.ts line 132 `isCacheUsable: (entry) => countWithParams(entry.models) > 0`), this means a cache with zero models carrying `supported_parameters` (the exact data Diffgazer needs for isOpenRouterCompatible / require_parameters gating) is returned as the fallback. The predicate's whole purpose (force a refetch when the cache lacks the gating field) is silently defeated on the failure path: the consumer gets a list that cannot be compatibility-gated instead of a clean error.

**Evidence.**
```ts
const cacheFresh = cache !== null && isFresh(cache, ttlMs) && (isCacheUsable === undefined || isCacheUsable(cache)) && keyMatches;
...
if (cache && keyMatches) return ok({ entry: cache, cached: true });
```

**Fix.** Apply the same usability predicate on the fallback branch: `if (cache && keyMatches && (isCacheUsable === undefined || isCacheUsable(cache))) return ok({ entry: cache, cached: true });`. If the only available cache is unusable, return the fetch error so the caller surfaces a degraded state rather than silently serving un-gateable data.

### `cli/server/src/shared/lib/ai/openrouter-models.ts` (1)

#### `r1-completeness-and-deferrals#2` — getOpenRouterModelsWithCache re-reads and re-parses the disk cache and re-derives freshness solely to drive log branches

> `cli/server/src/shared/lib/ai/openrouter-models.ts:124-126`  (DRY · medium · confidence:high)

**Problem.** After the D6 cache refactor, `withTtlAndFallback` already loads and parses the disk cache and computes TTL freshness internally. `getOpenRouterModelsWithCache` then calls `loadOpenRouterModelCache()` a SECOND time (another synchronous `readJsonFileSync` + `safeParse`) and recomputes `cacheValid` by duplicating the exact `Date.parse(...) < CACHE_TTL_MS` logic that `disk-cache.ts`'s private `isFresh` already owns — purely to pick between three `console.info` branches. This is a second disk read per request and a third copy of the freshness predicate, defeating the point of extracting the shared helper.

**Evidence.**
```ts
const cache = loadOpenRouterModelCache();
  const cacheTime = cache ? Date.parse(cache.fetchedAt) : NaN;
  const cacheValid = Number.isFinite(cacheTime) && Date.now() - cacheTime < CACHE_TTL_MS;
```

**Fix.** Have `withTtlAndFallback` return whether the existing cache was TTL-fresh (or expose the loaded entry) so the caller can log without a second `loadDiskCache` call and without re-implementing `isFresh`. Or drop the cosmetic `cacheValid` log distinction.

### `libs/core/src/api/hooks/match-query-state.ts` (1)

#### `r4-deep-logic-correctness#0` — guardQueryState renders a permanent fake loading spinner for a disabled (idle) query — TUI ModelStep shows "Loading models..." forever when focus is on nav

> `libs/core/src/api/hooks/match-query-state.ts:29-39`  (patterns · medium · confidence:high)

**Problem.** guardQueryState's final branch is `return callbacks.loading()` for the catch-all `data === undefined` case. For a TanStack query created with `enabled: false`, the state is `isLoading:false` (fetchStatus is 'idle'), `error:null`, `data:undefined` — so the function falls through every guard and returns the loading element. In the TUI onboarding ModelStep (cli/diffgazer/.../steps/model-step.tsx:61) the catalog query is `enabled: isActive && !isOpenRouter`. The wizard mounts ModelStep while focus is on the nav sidebar (`isActive = focusArea === 'step'` => false, onboarding-wizard.tsx:33,70), so the query is disabled, `guardQueryState` returns the spinner, and the user sees a perpetual "Loading models..." placeholder for an inactive-but-visible step. The catalog also never fetches in that state (enabled=false), so nothing will ever resolve it until focus returns. The web hook avoids this by short-circuiting `if (!enabled) return EMPTY_STATE` (use-provider-models-mapped.ts:28); the TUI raw-query path has no such guard. This is distinct from the already-reported 'OpenRouter query not gated on isActive' (tui-consumers#1) — here the catalog query IS gated, and the gating is precisely what trips the false-loading fallthrough.

**Evidence.**
```ts
if (query.isLoading) return callbacks.loading();
  if (query.error) return callbacks.error(query.error);
  if (query.data !== undefined) return null;
  return callbacks.loading();
```

**Fix.** guardQueryState (and matchQueryState) must distinguish a disabled/idle query from an in-flight one. Gate the final loading fallback on `query.fetchStatus !== 'idle'` (or `query.isFetching`), and render nothing / an empty/idle branch when the query is disabled. Alternatively the TUI ModelStep should mirror the web hook and not call guardQueryState while the query is disabled (return the model list/empty branch directly when !isActive).

### `libs/core/src/catalog/capabilities.test.ts` (1)

#### `r3-test-suite-gaps#0` — deriveCapabilities is never tested for groq or cerebras — the freeTier:'all' tier path and freeTierNote costDescription branch are uncovered

> `libs/core/src/catalog/capabilities.test.ts:8-48`  (test-quality · medium · confidence:high)

**Problem.** Every deriveCapabilities case exercises only gemini, zai-coding, and zai. groq and cerebras are the headline newly-enabled providers in this cut (D3), yet no test derives capabilities for them. This leaves two distinct behaviors with zero coverage: (a) resolveTier returning 'free' via the freeTier:'all' selector (only gemini's 'mixed' path is tested — the pure-'free' branch is untested), and (b) the freeTierNote-driven costDescription branch in deriveCapabilities (capabilities.ts:55-56), which only cerebras' overlay triggers ('Cerebras free tier: ~1M tokens/day.'). The design testing plan explicitly lists 'a groq/cerebras priced model → tier:free (freeTier:all)' and capability derivation as required coverage.

**Evidence.**
```ts
deriveCapabilities(catalog, "gemini") / "zai-coding" / "zai"  // no groq, no cerebras
```

**Fix.** Add a deriveCapabilities case for cerebras asserting tier resolves to 'free' (freeTier:'all') and costDescription begins with the freeTierNote prose, and a groq case asserting the 'all'-selector free tier — covering the two capabilities.ts branches no current test reaches.

### `libs/core/src/catalog/provider-overlay.ts` (1)

#### `catalog-overlay#1` — zai/zai-coding `baseURL` duplicated: overlay value ignored by the zhipu SDK branch

> `libs/core/src/catalog/provider-overlay.ts:53,63`  (DRY · medium · confidence:high)

**Problem.** The overlay declares the zai baseURLs as the curated single source of truth (`https://api.z.ai/api/paas/v4` at line 53, `https://api.z.ai/api/coding/paas/v4` at line 63). But cli/server/src/shared/lib/ai/client.ts:86 and :93 hardcode those exact same two URLs again inside the `zai`/`zai-coding` cases of `createLanguageModel`, while the groq/cerebras branch (client.ts:117) correctly reads `overlay.baseURL`. This is an inconsistent, duplicated source of truth: editing the zai endpoint in the overlay silently has no effect on the live SDK client, which is exactly the kind of rot the catalog/overlay design set out to eliminate. The overlay's `baseURL` JSDoc even says 'Required for zhipu + openai-compatible SDK factories', yet the zhipu factory does not consume it.

**Evidence.**
```ts
baseURL: "https://api.z.ai/api/paas/v4",  // overlay
... and client.ts: baseURL: "https://api.z.ai/api/paas/v4", // hardcoded again
```

**Fix.** Make the zhipu branch in client.ts read `PROVIDER_OVERLAY[provider].baseURL` (mirroring the groq/cerebras branch) so the overlay is the single source of truth, or remove `baseURL` from the zai rows if the zhipu factory is intentionally pinned in client.ts. Pick one source; do not keep both.

### `libs/core/src/providers/use-provider-models-mapped.test.ts` (1)

#### `xc-react#0` — Hook test mocks an internal module instead of the API boundary

> `libs/core/src/providers/use-provider-models-mapped.test.ts:9-13`  (test-quality · medium · confidence:high)

**Problem.** The test for useProviderModelsMapped mocks the internal module ../api/hooks/config via vi.mock, replacing useProviderModels with a canned fn. test-behavior-not-implementation explicitly bans mocking internal modules ('NEVER mock internal modules just to isolate units. Import the real module.'). The sibling tests for the same feature (apps/web .../steps/model-step.test.tsx and cli .../steps/model-step.test.tsx) correctly mock only at the system boundary (the bound API's getProviderModels) and exercise the real useProviderModels + QueryClient. This test instead asserts on the mapping wiring of an internal hook, so it will break on harmless refactors (e.g. renaming/relocating the internal hook) without any behavior change, and it does not prove the real TanStack wiring works.

**Evidence.**
```ts
vi.mock("../api/hooks/config", () => ({
  useProviderModels: (...args: unknown[]) => mockUseProviderModels(...args),
}));
```

**Fix.** Render the hook through a real QueryClientProvider + ApiProvider with a boundary-mocked getProviderModels (as the two model-step tests already do), and assert on the returned ProviderModelsState (models/loading/error/source). Drop the vi.mock of the internal config hook entirely.

### `libs/core/src/schemas/config/providers.ts` (1)

#### `xc-completeness-tasks#2` — providers.ts comment promises activateProvider catalog validation that does not exist

> `libs/core/src/schemas/config/providers.ts:31-38`  (completeness · medium · confidence:high)

**Problem.** The doc comment above isValidModelForProvider asserts: "Server-side activateProvider validates the id against the provider's live model list." This is the documented contract justifying the relaxed (non-empty-only) refine. But activateProvider performs no such live-list validation (see service.ts finding). The comment is therefore misleading — it describes behavior that was never implemented, masking the completeness gap from anyone reading the schema layer.

**Evidence.**
```ts
/**
 * Models come live from the catalog, so config validation only enforces that a
 * model id is a non-empty string. Server-side activateProvider validates the
 * id against the provider's live model list.
 */
function isValidModelForProvider(_provider: AIProvider, model: string): boolean {
  return model.trim().length > 0;
}
```

**Fix.** Once activateProvider actually validates against the catalog, this comment becomes accurate. Until then it is false documentation; either implement the validation or correct the comment to state that no server-side model-list validation currently runs.

---

## P2 — Low severity (103) — grouped by file (compact)

Polish / cleanup. Each is a real, verified issue but individually minor; batch by file.

### `cli/server/src/shared/lib/ai/models-dev-catalog.ts` (11)

- **`r1-deep-logic-correctness#4`** `cli/server/src/shared/lib/ai/models-dev-catalog.ts:20-23` — Disk-cache fetchedAt typed z.string() but the response contract demands z.string().datetime()  _type-safety · low · confidence:medium_
  - _Problem:_ ModelsDevCatalogCacheSchema.fetchedAt is z.string() (any string), and getProviderModels passes cache.fetchedAt straight through to the ProviderModelsResult on the cache/offline paths. The wire contract ProviderModelsResponseSchema.fetchedAt is z.string().datetime() (strict ISO). A disk cache file with a non-ISO fetchedAt (older format, manual edit) loads successfully and is served without revalidation — the router c.json()s result.value with no outbound Zod check — so a value that violates the declared response contract reaches the client. The mismatch is currently masked only by the absent output validation.
  - _Fix:_ Tighten the cache schema's fetchedAt to z.string().datetime() so the persisted value matches the response contract, and/or validate the outgoing ProviderModelsResponse before c.json so a malformed cache cannot leak a contract-violating payload.
- **`r1-security-and-boundaries#2`** `cli/server/src/shared/lib/ai/models-dev-catalog.ts:42-62` — models.dev fetch guards against a too-small payload but never caps the size of the buffered response  _security · low · confidence:low_
  - _Problem:_ fetchModelsDevCatalog applies a 10s AbortSignal.timeout and a SHRINK_GUARD_RATIO floor against a payload that is too small, but buffers the entire body with `await response.json()` with no upper bound — no Content-Length pre-check, no streamed cap. The shrink-guard is asymmetric: it protects against a pruned/empty upstream but not against an oversized one. A compromised upstream, MITM, or a misbehaving corporate proxy returning a multi-hundred-MB body would be fully read into memory before parsing, risking memory exhaustion of the in-process CLI server. The URL is hardcoded so there is no SSRF, and the endpoint is normally trusted, hence low severity — but the guard asymmetry is a real hardening gap given fetch hardening was an explicit design concern.
  - _Fix:_ Reject responses whose Content-Length exceeds a sane ceiling (the snapshot is ~2 MB, so e.g. 16 MB) before buffering, or read with a size-capped reader. Pair the existing shrink-guard with a corresponding growth ceiling.
- **`r3-anti-slop-and-deadcode#2`** `cli/server/src/shared/lib/ai/models-dev-catalog.ts:24` — ModelsDevCatalogCache type alias exported but only used as an in-file function parameter  _dead-code · low · confidence:high_
  - _Problem:_ `export type ModelsDevCatalogCache = z.infer<typeof ModelsDevCatalogCacheSchema>;` has no external importers (tests import only `ModelsDevCatalogCacheSchema`, the runtime Zod object). Its single use is the `isCacheFresh(cache: ModelsDevCatalogCache)` parameter in the same file, so the `export` adds public surface no one consumes.
  - _Fix:_ Remove the `export` keyword (keep it module-local) or inline `z.infer<typeof ModelsDevCatalogCacheSchema>` at the one use site. The schema export already covers every real consumer.
- **`r3-deep-logic-correctness#4`** `cli/server/src/shared/lib/ai/models-dev-catalog.ts:94-101` — DIFFGAZER_OFFLINE serves a stale-beyond-TTL cache tagged source='cache', indistinguishable from a fresh hit  _patterns · low · confidence:medium_
  - _Problem:_ On the offline path a stale-but-present cache is returned with source='cache' and cached=true (line 99), identical to a genuinely fresh cache hit (line 95). The three-source provenance tag exists to communicate freshness to the UI (design: source: 'live'|'cache'|'snapshot'), yet an arbitrarily old offline cache is presented as equivalent to a same-day cache; the consumer cannot distinguish them. fetchedAt is carried but read by no consumer, so there is no way for the UI to warn that offline data may be far out of date.
  - _Fix:_ Either surface staleness to the consumer via fetchedAt (currently dead plumbing) or distinguish a stale offline cache from a fresh one, so the freshness signal the UI receives is honest for the offline path.
- **`r6-anti-slop-and-deadcode#2`** `cli/server/src/shared/lib/ai/models-dev-catalog.ts:37-65` — `fetchModelsDevCatalog` exported despite having zero production consumers — test-only export widening  _dead-code · low · confidence:high_
  - _Problem:_ getProviderModels is the module's real public entry point and the only production caller of fetchModelsDevCatalog (via the in-module reference at line 108). Grepping the whole repo, the only external importer of the exported `fetchModelsDevCatalog` symbol is its own test file (models-dev-catalog.test.ts). The `export` keyword exists solely to let the unit test poke an internal step directly — testing an implementation detail rather than the getProviderModels contract.
  - _Fix:_ Make fetchModelsDevCatalog module-private and exercise the shrink-guard / zero-model / fetch-failure behavior through getProviderModels (the actual contract), or accept the export as a deliberate seam and document why. As written it is an unused public surface.
- **`r6-anti-slop-and-deadcode#3`** `cli/server/src/shared/lib/ai/models-dev-catalog.ts:20-24` — `ModelsDevCatalogCacheSchema` named export is consumed only by its own test; production uses it purely in-file  _dead-code · low · confidence:medium_
  - _Problem:_ The schema is needed at runtime (passed to loadDiskCache at line 92 and shaped at persist time line 112), but every production use is in-file. The only importer of the exported name across the repo is models-dev-catalog.test.ts. Combined with the already-reported dead `ModelsDevCatalogCache` type alias, this module exports two cache-shape symbols whose sole external reader is the test suite — widening the public surface to validate an internal representation.
  - _Fix:_ Drop the `export` on ModelsDevCatalogCacheSchema (keep it local) and assert its round-trip indirectly via getProviderModels' cache path, or fold the cache-shape test into the behavior test. Reserve exports for symbols production code outside this module actually imports.
- **`r6-deep-logic-correctness#0`** `cli/server/src/shared/lib/ai/models-dev-catalog.ts:74-77` — isCacheFresh treats any future-dated fetchedAt as permanently fresh (no upper bound)  _error-handling · low · confidence:high_
  - _Problem:_ isCacheFresh only checks `Date.now() - time < CACHE_TTL_MS`. When `fetchedAt` is in the future (clock skew on the writing machine, a manually-edited cache, or a daylight/timezone-corrupted write), `time > Date.now()` makes the difference negative, which is always `< CACHE_TTL_MS`. The cache is then treated as fresh forever and the live fetch is permanently skipped — the catalog can never refresh until the wall clock finally catches up to the bogus future timestamp. The same one-sided comparison exists in disk-cache.ts isFresh, but here it directly governs whether the 3-tier fallback ever runs.
  - _Fix:_ Bound freshness on both sides: treat a fetchedAt newer than `Date.now()` (beyond a small skew tolerance) as not-fresh so the live fetch re-runs, e.g. `const age = Date.now() - time; return Number.isFinite(time) && age >= 0 && age < CACHE_TTL_MS;`.
- **`r7-security-and-boundaries#0`** `cli/server/src/shared/lib/ai/models-dev-catalog.ts:42` — models.dev fetch transparently follows cross-host redirects, then parses and persists the redirected body to a global on-disk cache  _security · low · confidence:medium_
  - _Problem:_ The outbound catalog fetch is `await fetch(MODELS_DEV_URL, { signal: AbortSignal.timeout(10_000) })` with no `redirect` option, so it defaults to `redirect: "follow"` (up to 20 hops to ANY host). models.dev (or anything able to MITM/poison DNS for it) can 3xx-redirect this request to an arbitrary host — including internal/link-local addresses (169.254.169.254, 127.0.0.1) — and the response is then JSON-parsed via parseModelsDevCatalog and, on success, written verbatim to the shared global cache path (persistDiskCache at line 112). This is the classic SSRF-via-redirect surface: the pinned-constant URL gives a false sense of safety because the effective destination is attacker-influenceable once a redirect is honored. The companion `redirect`/host-validation guard that the OpenRouter and credential paths would benefit from is absent here, and unlike the size-cap concern this is a destination-trust gap, not a payload-size gap. Once a redirected payload clears the parser and the >=50% shrink-guard, it poisons the 24h global cache served to every consumer.
  - _Fix:_ Pass `redirect: "error"` (or `"manual"` with an explicit same-origin/https-host allowlist check on response.url) to the fetch call so a redirect away from models.dev is rejected rather than silently followed, parsed, and cached. Combine with the already-reported response-size cap. Add a test that a 302 to a foreign host yields a fetch error and falls back to cache/snapshot instead of persisting.
- **`r8-anti-slop-and-deadcode#1`** `cli/server/src/shared/lib/ai/models-dev-catalog.ts:79-117` — toResult threads a `cached` boolean that is always derivable from `source`  _YAGNI · low · confidence:high_
  - _Problem:_ ProviderModelsResult carries both `source: 'live'|'cache'|'snapshot'` and `cached: boolean`, and toResult takes them as two separate positional parameters. At every one of the five call sites `cached` is exactly `source === 'cache'` ('cache' -> true, 'live'/'snapshot' -> false). The boolean encodes no information the discriminant `source` does not already carry, yet it is hand-passed as a 5th positional arg each time, inviting a future caller to pass an inconsistent pair (e.g. source:'live', cached:true).
  - _Fix:_ Drop the `cached` parameter from toResult and derive it once where the value actually crosses the response boundary (`cached: source === 'cache'`), or remove `cached` from the interface entirely and let consumers branch on `source`. This also removes the structurally-impossible inconsistent-pair states.
- **`server-cache#2`** `cli/server/src/shared/lib/ai/models-dev-catalog.ts:74-77` — isCacheFresh duplicates the private isFresh helper in disk-cache.ts  _DRY · low · confidence:medium_
  - _Problem:_ models-dev-catalog.ts re-implements TTL freshness (`Date.parse` + `Number.isFinite` + `Date.now() - time < TTL`) as `isCacheFresh`, which is byte-for-byte the same logic as the unexported `isFresh` in disk-cache.ts (lines 20-23). models-dev-catalog intentionally does not consume withTtlAndFallback (its 3-tier snapshot fallback differs from the helper's 2-tier model, which is a justified divergence per D6), but the pure freshness predicate is identical and is the kind of shared, stable contract the disk-cache module already owns. Two occurrences only, so this is a borderline DRY note, not a mandate to extract.
  - _Fix:_ Export an `isEntryFresh(entry, ttlMs)` from disk-cache.ts and have both models-dev-catalog and the withTtlAndFallback internals call it, so TTL-freshness lives in one place. Leave inline if you prefer to wait for a third occurrence per the 3+ rule.
- **`xc-dry-arch#1`** `cli/server/src/shared/lib/ai/models-dev-catalog.ts:74-77` — Local isCacheFresh duplicates disk-cache's isFresh predicate  _DRY · low · confidence:high_
  - _Problem:_ isCacheFresh is a byte-for-byte reimplementation of the isFresh helper already living in disk-cache.ts (Date.parse(fetchedAt), Number.isFinite, Date.now() - time < ttl). Two copies of the same freshness rule is exactly the single-source-of-truth violation the shared cache module exists to prevent. (openrouter-models.ts has the same smell with its inline cacheValid computation, but that one is only used for log messaging, not control flow.)
  - _Fix:_ Drop isCacheFresh and rely on withTtlAndFallback (which calls the shared isFresh internally). If a standalone freshness check is genuinely still needed, export isFresh from disk-cache.ts and import it rather than re-declaring the rule.

### `libs/core/src/catalog/transform.test.ts` (7)

- **`r2-test-suite-gaps#3`** `libs/core/src/catalog/transform.test.ts:29-53` — freeTier family-selector branch of the free-tier resolver is entirely untested  _test-quality · low · confidence:high_
  - _Problem:_ isModelFreeToUse / matchesSelector (transform.ts:14-20) support a curated `freeTier: { families: [...] }` selector path (`model.family && selector.families?.includes(model.family)`), but every test in the isModelFreeToUse block exercises only the `ids` selector (gemini), the `'all'` selector (groq/cerebras), and the zero-price / hasFreeTier:false branches. The families branch — a documented part of the FreeTierSelector contract (design.md line 204, provider-overlay.ts:4) and the one irreducibly curated judgment — has no coverage, so a regression that breaks family matching (e.g. comparing against the wrong field) would not be caught. This is a missing edge-case the design's headline free-tier resolver depends on.
  - _Fix:_ Add an isModelFreeToUse case with an overlay whose freeTier is `{ families: ['gemini-flash'] }` (a priced model carrying that family) asserting tier 'free', plus a negative case where the model's family is absent or not listed asserting 'paid'.
- **`r2-test-suite-gaps#4`** `libs/core/src/catalog/transform.test.ts:55-69` — describeModel low-context branch (context < 1000, returns bare name) is uncovered  _test-quality · low · confidence:medium_
  - _Problem:_ describeModel (transform.ts:42-48) has two branches: context >= 1000 appends a formatted '… context.' suffix, otherwise it returns just the model name. catalogToModelInfo tests only assert the >=1000 path (`expect(flash.description).toContain('1M context')`). No test feeds a small/absent-context model (e.g. gemini-embedding-001, context 2048 — actually still >=1000) to confirm the bare-name fallback, so the description fallback for low/absent-context models (where description === name) is unverified. Given the description text is observable UI prose, the untested branch can silently regress.
  - _Fix:_ Add an assertion that a model with no `limit.context` (or context < 1000) yields description equal to its name (no ' — … context.' suffix).
- **`r4-test-suite-gaps#0`** `libs/core/src/catalog/transform.test.ts:55-83` — catalogToModelInfo never asserts an unknown-priced model renders as ModelInfo.tier 'paid'  _test-quality · low · confidence:high_
  - _Problem:_ The design's D2 contract has two orthogonal facts: internal pricingTier ('unknown' for absent cost) AND the public ModelInfo.tier collapse. The suite asserts pricingTierOf(gemini-embedding-001)==='unknown' (line 25), but no test asserts that this unknown-priced model surfaces as tier:'paid' through the public catalogToModelInfo output. In the ordering test, embedding-001 is merely listed in `paidIds` (line 74) and only its position relative to free models is checked — its actual `.tier` value is never asserted. So the unknown→paid collapse in toModelInfo (isModelFreeToUse false-path for a cost-less model) is unverified: a regression making unknown models render 'free' would pass.
  - _Fix:_ In the catalogToModelInfo describe block, add an explicit assertion: `expect(models.find(m => m.id === 'gemini-embedding-001')!.tier).toBe('paid')`, pinning the public collapse of an unknown-priced model alongside the existing free/paid cases.
- **`r5-test-suite-gaps#4`** `libs/core/src/catalog/transform.test.ts:62-65` — describeModel high-context branch only pins '1M context'; the K-formatted (1000–<1M) context branch is uncovered  _test-quality · low · confidence:medium_
  - _Problem:_ describeModel (transform.ts:42-48) has two formatting outcomes for context >= 1000: an 'M' label and a 'K' label, both routed through formatContextTokens. The only assertion exercises the 1M (>= 1,000,000) path via gemini-2.5-flash's '1M context'. A model whose context lands in the [1000, 999999] K-range (e.g. a 131K-context groq/cerebras model present in the fixtures) is never asserted to render its 'K context' description. Given the already-reported r4 boundary bug (950000–999999 rendering as '1000K'), the K-branch is exactly where a regression would hide and there is no test pinning it. (r2-test-suite-gaps#4 covers the <1000 bare-name branch — this is the distinct middle K-formatted branch.)
  - _Fix:_ Add a catalogToModelInfo/describeModel assertion on a sub-1M-context fixture model (e.g. a 131K groq model) verifying its description contains a 'K context' label.
- **`r6-test-suite-gaps#3`** `libs/core/src/catalog/transform.test.ts:55-69` — describeModel name-fallback branch (model with no name, returns bare id) is untested  _test-quality · low · confidence:medium_
  - _Problem:_ describeModel and toModelInfo both fall back to model.id when model.name is undefined (model.name ?? model.id), and ModelsDevModelSchema marks name optional, so an unnamed live model is a real input. Every fixture model in catalog.fixture.ts carries a name, so the fallback path (and the resulting ModelInfo.name === id) is never exercised. Distinct from the already-reported low-context branch (r2-test-suite-gaps#4) and K-context branch (r5-test-suite-gaps#4), which concern the context label; this concerns the name/description fallback when name is absent.
  - _Fix:_ Add a transform test feeding a model without a name and assert ModelInfo.name === model.id and description falls back to the id-based string.
- **`r7-test-suite-gaps#2`** `libs/core/src/catalog/transform.test.ts:85-115` — merge-by-id freshness tie-break never exercises the release_date fallback — every fixture model carries last_updated  _test-quality · low · confidence:high_
  - _Problem:_ freshness() in transform.ts is `model.last_updated ?? model.release_date ?? ""`. The merge test that 'keeps the freshest last_updated entry' gives every duplicate and non-duplicate model an explicit `last_updated`, so the `release_date` fallback (and the empty-string floor for models with neither date) is never taken. A model whose freshness must be decided by release_date alone — exactly the case the production design.md merge bug findings warn about — has zero coverage. The single behavior the test pins (last_updated beats last_updated) is the easy path; the fallback ranking that actually risks mis-ordering is untested.
  - _Fix:_ Add a tie-break case where the winning duplicate has only release_date (no last_updated) and must still be selected over a stale last_updated, plus a case with neither date to pin the empty-string-oldest behavior.
- **`xc-test-quality#1`** `libs/core/src/catalog/transform.test.ts:117-126` — Redundant single-source merge test is a wiring tautology, not a distinct behavior  _test-quality · low · confidence:medium_
  - _Problem:_ This test asserts that catalogToModelInfo("gemini") yields the same ids as mergeModelsAcrossSources(catalog, PROVIDER_OVERLAY.gemini.modelsDevIds). Because gemini declares exactly one source id (["google"]), there is nothing to merge: it only proves catalogToModelInfo internally calls mergeModelsAcrossSources over the overlay's ids — i.e. it tests the wiring/implementation. The genuine multi-source merge behavior (duplicate-id collapse, freshest-wins) is already fully covered by the preceding test (lines 85-115) with a synthetic two-source catalog. This adds maintenance cost with no incremental confidence and would break on a behavior-preserving refactor of how the public path composes the merge.
  - _Fix:_ Delete this test. The two-source merge test above already verifies merge-by-id/freshest-wins, and the ordering/tier behavior of catalogToModelInfo is covered by the other catalogToModelInfo tests. If multi-alias public-path coverage is wanted, give an overlay (or a fixture overlay) with 2+ modelsDevIds and assert the observable collapsed list instead of comparing against the helper it delegates to.

### `cli/server/src/features/config/router.test.ts` (6)

- **`r1-test-suite-gaps#3`** `cli/server/src/features/config/router.test.ts:34-41` — Router live-path fetch mock omits status, diverging from the suite's own Response shape  _test-quality · low · confidence:medium_
  - _Problem:_ The inline live-success mock supplies { ok: true, json } but no status, whereas the colocated models-dev-catalog.test.ts okResponse helper (line 13) returns { ok: true, status: 200, json }. status is read by production code on the non-ok path (models-dev-catalog.ts:46), so the omission is harmless here, but the inconsistent ad-hoc Response shapes across the two test files are duplicated scaffolding that will drift; a shared okResponse-style helper would keep the mocked boundary honest and uniform.
  - _Fix:_ Reuse a single shared okResponse(body) helper (with status:200) across router.test.ts and models-dev-catalog.test.ts instead of two divergent inline Response literals.
- **`r2-test-suite-gaps#5`** `cli/server/src/features/config/router.test.ts:53-61` — Router test asserts cached:false on the live path but never asserts cached/source on the snapshot fallback, leaving the cached flag's snapshot value unpinned  _test-quality · low · confidence:medium_
  - _Problem:_ The live-path test pins both source==='live' and cached===false, but the snapshot-fallback test only asserts source==='snapshot' and models.length>0 — it never asserts cached===false for the snapshot path. snapshotResult sets cached:false (models-dev-catalog.ts:88), and the schema-shape test (lines 79-87) confirms the key exists but not its value on this path. A regression that returns cached:true for a snapshot (misleading clients into thinking they got a real cache) would pass. Minor, but the cached flag is part of the response contract the client UI surfaces.
  - _Fix:_ Add `expect(body.cached).toBe(false)` to the snapshot-fallback assertion (and ideally assert cached===true on the fresh-cache path if a route-level cache test is added).
- **`r6-test-suite-gaps#1`** `cli/server/src/features/config/router.test.ts:46-50` — router.test.ts never asserts free-first ordering on the HTTP boundary despite ordering being a headline route contract  _test-quality · low · confidence:medium_
  - _Problem:_ design.md lists 'Ordering: derived Gemini order matches the pinned model-select-overlay test (free-first, deterministic)' as a testing requirement, and the route is what ships that ordered ModelInfo[] to every UI. The live-path test only asserts a gemini-2.5-flash/free row EXISTS via .some(...); it never asserts position/free-first ordering of the returned array. Deterministic ordering is verified only in pure transform.test.ts, so a regression in how the service/route serializes or re-sorts the list (e.g. losing the sort during Zod re-shaping) would pass every router test. Already-reported r2-test-suite-gaps#5 covers the cached/source flag on the snapshot path, not ordering.
  - _Fix:_ Assert the order of body.models ids (free models first) on the live and snapshot paths, mirroring the transform-level ordering test, pinning the route to preserve the deterministic free-first order end to end.
- **`r6-test-suite-gaps#2`** `cli/server/src/features/config/router.test.ts:33-51` — recommended flag (part of the ModelInfo contract) is verified only at the pure transform layer, never across the server/route boundary it is plumbed through  _test-quality · low · confidence:medium_
  - _Problem:_ ModelInfo.recommended (= model.id === overlay.recommendedModelId) is a documented field of the stable UI contract (design.md data-model section) that the route serializes for every provider. transform.test.ts pins recommended:true for gemini-2.5-flash at the pure layer, but no server, route, or UI test asserts the flag survives the getProviderModels service -> Zod re-validation -> HTTP serialization. ProviderModelsResponseSchema.safeParse (router.test line 85) only proves the shape is valid, not that recommended is populated. A service/schema regression that drops recommended during the slim re-projection would leave recommended-model UX silently broken with green tests.
  - _Fix:_ Assert the route returns recommended:true for the provider's recommendedModelId (gemini-2.5-flash) on the live path, pinning the flag end-to-end through service + schema.
- **`r7-test-suite-gaps#0`** `cli/server/src/features/config/router.test.ts:71-77` — Rate-limit route test asserts only the final 429, never that any request before the window succeeds with 200  _test-quality · low · confidence:high_
  - _Problem:_ The rate-limit test initializes `let lastStatus = 200` and fires 31 requests in a loop, overwriting `lastStatus` each iteration, then only asserts `expect(lastStatus).toBe(429)`. It never asserts that any pre-exhaustion request returned 200. A regression where the route 429s on the very FIRST request (e.g. an off-by-one bucket bug, or the shared OpenRouter bucket already being drained) would pass this test identically. The contract being verified is 'N allowed then blocked', but only the 'blocked' half is pinned — the 'allowed' half is unverified.
  - _Fix:_ Capture the status of the first request (or assert it is 200 before the loop) and assert the limit triggers at the expected boundary index, not merely that the 31st request is 429. e.g. assert request 1 is 200 and that the first 429 appears only after the documented window size.
- **`r8-test-suite-gaps#4`** `cli/server/src/features/config/router.test.ts:71-77` — Rate-limit test hardcodes the bucket size as a bare loop bound, duplicating the source's maxRequests:30 with no shared constant  _test-quality · low · confidence:medium_
  - _Problem:_ The route is configured with maxRequests:30 (router.ts:27) and the test loops `i < 31` to reach the 31st request that trips the limit. The magic 31 silently encodes 30+1; if the source limit changes the test breaks with no signal as to why, and the relationship between the two numbers is invisible. Combined with the already-reported gap that no request before the window is asserted to succeed with 200 (r7-test-suite-gaps#0), the test couples to an implementation constant rather than expressing the contract 'the (limit+1)th request in a window is rejected'.
  - _Fix:_ Derive the loop bound from the configured limit (import or re-export the maxRequests value) or assert the boundary explicitly (last allowed request -> 200, next -> 429) so the test documents the contract instead of mirroring a literal.

### `cli/server/src/shared/lib/ai/client.ts` (5)

- **`r1-anti-slop-and-deadcode#2`** `cli/server/src/shared/lib/ai/client.ts:53-56,99-102,118` — AI-voice / drift-narration comments restate SDK-version-drift handling three times in client.ts  _anti-slop · low · confidence:medium_
  - _Problem:_ Three multi-line comments narrate the same 'SDK version drift / narrow at runtime' rationale: the JSDoc on `isLanguageModel` (53-56), the 4-line OpenRouter block comment (99-102), and the inline cerebras comment (118). They restate what `isLanguageModel` plainly does and repeat the identical justification, including AI-voice phrasing ('Runtime narrowing for SDK-version drift', 'narrow the unknown shape at runtime'). The function name plus one comment carries the whole point; the other two are control-flow narration.
  - _Fix:_ Keep a single one-line note on `isLanguageModel` explaining the drift; delete the duplicated OpenRouter block comment and the inline cerebras comment.
- **`r1-completeness-and-deferrals#3`** `cli/server/src/shared/lib/ai/client.ts:76-103` — createLanguageModel falls back to an empty-string model id for OpenRouter when no model is supplied  _error-handling · low · confidence:low_
  - _Problem:_ `DEFAULT_MODELS` is derived from `overlay.defaultModel` for every provider, and the OpenRouter overlay deliberately sets `defaultModel: ""` ("user picks"). So `createLanguageModel({ provider: 'openrouter' })` with no `model` resolves `modelId = ""` and calls `openrouter.chat("")` — an empty model id passed straight to the SDK rather than a clear typed error. Every other enabled provider has a real default; OpenRouter is the one case where the derived default is structurally invalid, and the branch does not guard it (unlike the `!overlay.baseURL` guard on the groq/cerebras branch).
  - _Fix:_ Guard the openrouter branch (and/or the shared `modelId` resolution) for an empty model id and return a typed `MODEL_ERROR`/`UNSUPPORTED_PROVIDER` rather than forwarding `""` to `openrouter.chat`.
- **`r2-anti-slop-and-deadcode#3`** `cli/server/src/shared/lib/ai/client.ts:21-23` — Eager module-load full `Record<AIProvider,string>` built only to do single-key lookups  _YAGNI · low · confidence:medium_
  - _Problem:_ `DEFAULT_MODELS` materializes a complete provider->defaultModel record at module load via Object.fromEntries + an `as Record<AIProvider,string>` cast, but is only ever read as a single keyed lookup at line 76 (`DEFAULT_MODELS[provider]`). The createLanguageModel switch already has the `provider` in hand and could read `PROVIDER_OVERLAY[provider].defaultModel` inline, removing both the precomputed table and the `as` cast that papers over Object.fromEntries returning a loose record.
  - _Fix:_ Delete `DEFAULT_MODELS` and replace line 76 with `const modelId = model ?? PROVIDER_OVERLAY[provider].defaultModel;`. Removes the table and the type assertion.
- **`r2-anti-slop-and-deadcode#4`** `cli/server/src/shared/lib/ai/client.ts:75-119` — Inner `model` const shadows the destructured `config.model`, with two separate `as Parameters<...>` casts per branch  _type-safety · low · confidence:medium_
  - _Problem:_ `createLanguageModel` destructures `const { provider, apiKey, model } = config` (line 75), then the openrouter and groq/cerebras branches declare a NEW `const model: unknown = ...` (lines 103, 119) that shadows the outer `model`. The shadowing is legal but obscures which `model` is in scope and is the kind of name-collision that invites stale-reference bugs during edits. Combined with the per-branch `modelId as Parameters<typeof ...>[0]` casts, the SDK-drift handling is harder to read than necessary.
  - _Fix:_ Rename the inner narrowed-SDK-object to `languageModel`/`sdkModel` so it does not shadow the outer `model` config field.
- **`r7-anti-slop-and-deadcode#0`** `cli/server/src/shared/lib/ai/client.ts:139-141` — Defensive `if (!config.provider)` guard on a non-nullable required enum field in createAIClient  _anti-slop · low · confidence:high_
  - _Problem:_ `AIClientConfig.provider` is typed `provider: AIProvider` (required, non-optional, a closed string-literal enum). The runtime guard `if (!config.provider) return err(... 'AI provider is required')` is a defensive null/empty check on a value the type system guarantees is present. It can only fire if a caller already violated the type contract with an `as`-cast, and even then it sits AFTER `createLanguageModel` would be called normally. This is the defensive-over-coding pattern (Cat 3): a fallback that never legitimately triggers. The sibling `!config.apiKey` check is meaningful (empty string is a real runtime value), but `provider` being falsy is unreachable in typed code.
  - _Fix:_ Delete the `if (!config.provider)` block; rely on the `AIProvider` type plus the `default:` UNSUPPORTED_PROVIDER branch inside `createLanguageModel` for any genuinely-invalid provider value.

### `libs/core/src/catalog/transform.ts` (5)

- **`r1-anti-slop-and-deadcode#0`** `libs/core/src/catalog/transform.ts:9-12` — `pricingTierOf` is exported but has zero non-test production consumers — its only real caller is in-file  _dead-code · low · confidence:medium_
  - _Problem:_ `export function pricingTierOf` is consumed in production only on line 32 of the same file (`isModelFreeToUse`). Every other reference is a test (`transform.test.ts`, `index.test.ts`). The `export` keyword exists purely to let the test reach an internal helper, which is test-driven over-exposure of the module surface. Per the pre-release no-dead-surface rule, an internal one-line helper called once should not be a public catalog export.
  - _Fix:_ Drop the `export` and test `pricingTierOf` indirectly through `isModelFreeToUse`/`catalogToModelInfo` (its observable behavior), or inline it into `isModelFreeToUse` since it is a 2-line branch used in one place.
- **`r1-completeness-and-deferrals#1`** `libs/core/src/catalog/transform.ts:6-12` — pricingTierOf / PricingTier exported as public catalog API with no production consumer (D2 per-model price badge never built)  _dead-code · low · confidence:medium_
  - _Problem:_ Design D2 states `pricingTier` is "carried internally for an optional per-model price badge" and the public `ModelInfo` union stays 2-value. The badge was never built: `ModelInfo` has no pricingTier field, and a repo-wide search shows `pricingTierOf` and the `PricingTier` type have zero consumers outside `src/catalog/` (only `isModelFreeToUse` uses `pricingTierOf` internally, and `transform.test.ts` tests it). They are nonetheless re-exported through the `@diffgazer/core/catalog` barrel as public API. This is dangling public surface for an explicitly-deferred-and-never-built feature.
  - _Fix:_ Either drop `pricingTierOf`/`PricingTier` from the barrel export (keep them module-private, since only `isModelFreeToUse` needs `pricingTierOf`) or finish wiring the per-model price badge. Do not ship unused public exports.
- **`r3-deep-logic-correctness#3`** `libs/core/src/catalog/transform.ts:100-102` — Free-first ordering relies on locale-sensitive localeCompare, undermining the 'deterministic' / pinned-order guarantee across environments  _patterns · low · confidence:medium_
  - _Problem:_ catalogToModelInfo claims deterministic ordering (free-first, then by name, id as final tiebreak) and the design pins this against the model-select-overlay Gemini-order test. The name and id tiebreaks use String.prototype.localeCompare with no locale/options argument. localeCompare is locale- and ICU-data-dependent: ordering of names containing digits, punctuation, or mixed case (e.g. 'GLM-4.7' vs 'GLM-4.7-Flash', 'meta-llama/...') can differ between a developer machine, CI, and the bundled tsup TUI binary depending on the runtime's default locale and ICU build. The advertised determinism is therefore environment-dependent, and the pinned ordering test can pass locally yet order differently elsewhere.
  - _Fix:_ Use a locale-independent comparison for a stable artifact: plain `<`/`>` string comparison, or localeCompare with an explicit locale + numeric option, or a pinned Intl.Collator. Document that the order is locale-stable so the pinned test reflects production.
- **`r4-deep-logic-correctness#2`** `libs/core/src/catalog/transform.ts:37-40, 77` — Freshest-date merge tie-break compares last_updated of one model against release_date of another, so a model with only a release_date can outrank a model carrying a real last_updated  _patterns · low · confidence:low_
  - _Problem:_ mergeModelsAcrossSources picks the winning duplicate via `freshness(model) > freshness(existing)`, where freshness() = `last_updated ?? release_date ?? ''`. When the same model id appears in two alias source providers (the documented merge-by-id-across-aliases case) and one entry has only release_date while the other has last_updated, the comparison mixes two semantically different date fields as raw lexicographic strings. A stale entry whose release_date string happens to sort higher than the other entry's last_updated string will win, selecting the older/less-authoritative record's name, cost, and capability flags. models.dev also mixes date-only ("2025-01-15") and full-ISO formats, so the lexicographic `>` is not a reliable chronological comparison across heterogeneous formats. The final catalogToModelInfo sort re-orders the output, so this only affects WHICH duplicate's data survives, not list order — but that data drives tier/recommended/description.
  - _Fix:_ Compare like-for-like: parse to a timestamp (Date.parse) and compare numerically, and prefer last_updated as the dominant signal (e.g. compare (last_updated ?? release_date) only after normalizing to epoch ms, falling back deterministically when equal). At minimum, document that ties are resolved by first-source order so the outcome is reproducible across alias orderings.
- **`r6-deep-logic-correctness#3`** `libs/core/src/catalog/transform.ts:75-80` — Merge-by-id keys on the inner model.id field while the catalog record keys models by their map key, silently collapsing distinct map entries that share an inner id  _patterns · low · confidence:medium · ⚠ UNCERTAIN (needs human judgment)_
  - _Problem:_ parseModelsDevCatalog preserves each model under its record key (`models[modelId] = parsed.data`), but ModelsDevModelSchema does not enforce `model.id === modelId`. mergeModelsAcrossSources then dedupes on the inner `model.id` field, not the record key. If models.dev ever exposes two record entries under one provider that carry the same inner `id` but different keys (the schema permits it, and the openrouter snapshot block already shows `google/...`-prefixed ids living beside the top-level google provider's bare ids), one entry is silently dropped by the freshness tie-break rather than surfaced. The freshest-date tie-break (`>`, strict) keeps the first-seen on a tie, making which entry survives dependent on Object.values iteration order. Today's single-source overlays are unaffected, but the merge contract is keyed on an unvalidated invariant.
  - _Fix:_ Either assert/normalize that the record key equals model.id at parse time, or document that merge intentionally dedupes on inner id and key collisions across the same provider are expected to be impossible; pin a test for the cross-source same-id collapse to lock the intended winner.

### `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx` (4)

- **`r8-test-suite-gaps#2`** `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx:17-43` — TUI overlay description truncation (the only branching logic in ModelListItem) is never exercised by any test  _test-quality · low · confidence:medium_
  - _Problem:_ model-list-item.tsx contains real observable rendering logic — truncateDescription appends a U+2026 ellipsis and clamps to descMaxLen when description.length exceeds the width-derived budget. The only test feeding the overlay uses short fixtures ("1M ctx") that never overflow, so the truncation branch and the ellipsis output are uncovered. This is observable rendered output (what the user sees when a description is too wide for the terminal), not an internal detail, and it is the sole conditional in the rendered list item. A regression to the descMaxLen math or the slice would render garbled rows undetected.
  - _Fix:_ Add a case (or extend the fixture) with a description long enough to overflow a narrow contentWidth and assert the rendered frame contains the U+2026 truncation marker and not the full string.
- **`tui-consumers#5`** `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx:51-86` — Duplicated async-flush and provider test scaffolding across the two TUI slice test files  _test-quality · low · confidence:medium_
  - _Problem:_ `flush`, `flushUntil`, `makeQueryClient`, and the `Wrapper` (QueryClientProvider + ApiProvider with a vi.fn() getProviderModels boundary stub + CliThemeProvider) are duplicated essentially verbatim in model-select-overlay.test.tsx and model-step.test.tsx, with the same pattern echoed in the web tests. The mock is correctly placed at the api boundary (no internal vi.mock), so the discipline is fine; the issue is copy-paste of the harness. At exactly two occurrences in this slice it is below the 3+ extraction threshold, but no shared cli/diffgazer test-util exists to host it.
  - _Fix:_ When a third consumer test appears, extract a shared renderWithCatalog/Wrapper + flushUntil helper into a cli/diffgazer test-util module rather than copying it again.
- **`tui-consumers#6`** `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx:163-177` — Overlay navigation test comments narrate the internal setHighlightIndex formula  _anti-slop · low · confidence:low_
  - _Problem:_ The test asserts on rendered highlight position (observable, correct), but the inline comments spell out the implementation arithmetic: 'Pre-fix: setHighlightIndex((prev - 1 + len) % len) with stale prev=4 → (4 - 1 + 2) % 2 = 1 ... Post-fix: setHighlightIndex((safeHighlightIndex - 1 + len) % len)'. This couples the test's documentation to the exact internal expression; a behavior-preserving refactor of the clamp/wrap math would leave these comments stale/wrong even though the assertions still pass.
  - _Fix:_ Trim the comments to describe the user-observable expectation ('after shrinking to 2 paid models and pressing ArrowUp from the clamped last item, the first paid model is highlighted') and drop the modulo-arithmetic walkthrough.
- **`xc-test-quality#2`** `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx:107-177` — Test name and inline comments narrate internal hook state instead of behavior  _test-quality · low · confidence:medium_
  - _Problem:_ The single test's name and comment blocks describe internals (safeHighlightIndex, highlightIndex, and the literal pre-fix/post-fix expression setHighlightIndex((prev - 1 + len) % len)) rather than the observable behavior. The assertions themselves correctly verify rendered highlight position, so the test is valuable and should stay — but the name and narration couple the test to implementation variable names and a specific modulo formula, so a behavior-preserving rename/refactor of the component's index logic would make the test name and comments lie. Per test-behavior-not-implementation, a name containing internal symbol names is the implementation-detail smell.
  - _Fix:_ Rename to describe the user-visible behavior, e.g. "after the tier filter shrinks the list, ArrowUp moves the highlight one item back (does not stick on the last item)", and drop the modulo-arithmetic / internal-variable narration comments. Keep the frame-based highlight assertions as-is.

### `cli/server/src/features/config/service.ts` (4)

- **`r3-security-and-boundaries#0`** `cli/server/src/features/config/service.ts:259-261` — PROVIDER_DISABLED guard and its 404 mapping are unreachable by construction  _dead-code · low · confidence:high_
  - _Problem:_ getProviderModels rejects with PROVIDER_DISABLED when PROVIDER_OVERLAY[provider].enabled is false, and router.ts maps that code to HTTP 404. But the route param is validated by ProviderModelsParamSchema = z.object({ id: AIProviderSchema }), and AIProviderSchema is the closed enum of the 6 PROVIDER_OVERLAY entries — every one of which is enabled:true (verified at provider-overlay.ts lines 44,54,64,72,83,95). The only enabled:false overlays live in SURFACED_OVERLAYS, which are deliberately NOT enum members, so they can never pass AIProviderSchema and reach this guard. The disabled branch in the service and the `: 404` arm in router.ts (line 83) are therefore dead by construction today. This is distinct from the already-reported test-coverage gaps (r1-test-suite-gaps#0, service.test mutation) — the runtime code path itself can never fire. The design (design.md line 250) anticipates a future enum provider with enabled:false, but no such member exists, so the branch is currently defensive-over-coding with zero reachable input.
  - _Fix:_ Either (a) delete the PROVIDER_DISABLED service guard and the 404 mapping until an enum member can actually be enabled:false, or (b) add an explicit invariant test/comment that the guard is forward-looking. If kept, document that it is unreachable for the current enum to prevent false confidence that disabled-provider handling is exercised.
- **`r3-security-and-boundaries#2`** `cli/server/src/features/config/service.ts:262-263` — Server returns catalog model payload to the client without re-validating against ProviderModelsResponseSchema  _type-safety · low · confidence:medium_
  - _Problem:_ getProviderModels returns ok(await getProviderModelsFromCatalog(provider)) directly. getProviderModelsFromCatalog produces a ProviderModelsResult whose fetchedAt is typed as a bare z.string() (models-dev-catalog.ts cache schema line 22) and, on the cache path, is whatever bare string was persisted. The wire contract ProviderModelsResponseSchema requires fetchedAt: z.string().datetime() (models.ts line 45). Because the server never re-parses through ProviderModelsResponseSchema before c.json(result.value), a malformed/non-datetime fetchedAt loaded from a tampered or legacy disk cache is shipped to the client unvalidated; the only datetime enforcement happens on the client side via ProviderModelsResponseSchema.parse (api/config.ts line 49), which would then throw in the consumer rather than being caught at the boundary that owns the data. This is the response side of the boundary; while xc-security#1 flagged the absence of slim-Zod validation generally, the concrete datetime-contract mismatch flowing from the bare-string cache field to an unvalidated server response is the specific boundary defect.
  - _Fix:_ Validate the outgoing payload at the server boundary with ProviderModelsResponseSchema.parse before c.json, or align the cache schema's fetchedAt to z.string().datetime() so the contract is enforced where the data is produced rather than only in the remote consumer.
- **`r4-security-and-boundaries#0`** `cli/server/src/features/config/service.ts:94-121` — env-credential varName is validated against the global allowlist but not bound to the provider it is saved for (cross-provider credential binding)  _security · low · confidence:high_
  - _Problem:_ validateCredential() only checks that a `kind: "env"` credential's varName is a member of the global ALLOWED_CREDENTIAL_ENV_VARS set. It never checks that the varName is the env var that PROVIDER_OVERLAY assigns to input.provider. CredentialRefSchema (providers.ts:54) accepts any varName: z.string().min(1), and toSecretEntry()/secrets-store stores `{ kind: "env", varName }` verbatim, then resolveSecretEntry() later reads process.env[varName] for that provider. So a save request can bind, e.g., provider 'gemini' to varName 'OPENROUTER_API_KEY' (or any other allowed provider's var). The allowlist correctly blocks arbitrary env exfiltration, but the intended security invariant — a provider may only reference ITS OWN key var — is unenforced. This silently mis-routes credentials (gemini calls signed with the OpenRouter key) and lets one provider's secret be exercised under another provider's identity, with no validation error surfaced to the user. The overlay even documents per-provider env vars (provider-overlay.ts:9), implying a 1:1 binding that the code does not enforce.
  - _Fix:_ In validateCredential, take the target provider and assert apiKey.varName === PROVIDER_ENV_VARS[provider] (still also requiring allowlist membership), returning CREDENTIAL_INVALID otherwise. This makes the allowlist provider-scoped instead of global and restores the documented 1:1 env-var-to-provider invariant.
- **`xc-security#1`** `cli/server/src/features/config/service.ts:251-267` — Outgoing /provider/:id/models payload is not Zod-validated at runtime despite design contract 'slim Zod-validated'  _completeness · low · confidence:high_
  - _Problem:_ The design (Architecture table, HTTP endpoint row) and plan Task 18 (plan.md:3840 'slim-payload Zod guard') require the route to return a 'slim Zod-validated' payload. The service returns the raw ProviderModelsResult straight from the catalog (ok(await getProviderModelsFromCatalog(provider))) and the router emits it via c.json(result.value) with no ProviderModelsResponseSchema.parse(). The only schema touchpoint is router.test.ts:85 which merely asserts the existing shape happens to satisfy the schema — that is a behavioral check on the producer, not a runtime guard. The producer ProviderModelsResult and the schema are structurally identical today, so the payload is correct by construction; the gap is defense-in-depth: a future field added to ProviderModelsResult would silently leak through (the schema is non-strict in practice here) and a malformed transform would not be caught at the boundary. The EXECUTE.md P4 log claims the payload is 'validated by ProviderModelsResponseSchema', which is not what the code does — the protocol says not to trust that GREEN claim, and this re-derivation contradicts it.
  - _Fix:_ Either parse the catalog result through ProviderModelsResponseSchema before returning from getProviderModels (so the boundary strips/validates the slim payload as the design states), or downgrade the design/plan wording to 'type-checked slim payload'. If the strict-stripping is the intent, use the schema's parse so extra fields cannot leak.

### `libs/core/src/catalog/capabilities.test.ts` (4)

- **`catalog-capabilities#2`** `libs/core/src/catalog/capabilities.test.ts:28-35` — resolveTier free-only and paid-only branches are untested  _test-quality · low · confidence:medium_
  - _Problem:_ deriveCapabilities exposes `tier: "free"|"paid"|"mixed"` (capabilities.ts:23-34, 52), consumed by the provider filter (libs/core/src/providers/filter.ts:28,32). The tests cover only the `mixed` outcome (gemini). The pure-`paid` branch (e.g. zai-coding, hasFreeTier:false → every model paid) and the pure-`free` branch (e.g. groq/cerebras with freeTier:'all' and zero free-derivation, or a provider whose models are all free) are never asserted. The existing tierBadge test (line 32-35) checks the SEPARATE overlay.hasFreeTier-derived badge, not resolveTier's union. A regression flipping the hasFree/hasPaid logic in resolveTier would not be caught.
  - _Fix:_ Add assertions for the non-mixed branches, e.g. `expect(deriveCapabilities(catalog, "zai-coding").tier).toBe("paid")` and a free-only case, so all three resolveTier outcomes are pinned (this `tier` value drives the all/free/paid filter).
- **`r3-test-suite-gaps#3`** `libs/core/src/catalog/capabilities.test.ts:23-26` — formatContext 'Varies by model' branch (maxContext <= 0) is uncovered  _test-quality · low · confidence:medium_
  - _Problem:_ deriveCapabilities only asserts the populated-context branch (contextWindow contains '1M' for gemini). The fallback branch in capabilities.ts:18-20 — formatContext returns 'Varies by model' when maxContext <= 0 (a provider whose models carry no limit.context) — is never exercised. This is the exact graceful-degradation path the design's graceful-unknown capabilities requirement leans on, and it would silently regress to 'Up to NaN tokens' or similar without a test.
  - _Fix:_ Add a deriveCapabilities case with a fixture provider whose models omit limit.context and assert contextWindow === 'Varies by model'.
- **`r4-test-suite-gaps#2`** `libs/core/src/catalog/capabilities.test.ts:9-21` — deriveCapabilities costDescription paid-only branch (zai-coding) is never asserted  _test-quality · low · confidence:medium_
  - _Problem:_ costDescription is a 3-way branch in capabilities.ts (freeTierNote → free/paid generic → 'Paid usage; live pricing drives the per-model badge.'). The full-shape test only asserts `costDescription: expect.any(String)` (line 16), and the zai-coding test (line 34) asserts only its tierBadge, not its costDescription. The hasFreeTier:false branch — the one paid-only provider's cost prose, the case most likely to read wrong in the UI — is never assertion-pinned, so a regression swapping the paid string for the free string would pass.
  - _Fix:_ Add `expect(deriveCapabilities(catalog, 'zai-coding').costDescription).toMatch(/paid/i)` (and a matching free-tier assertion for a hasFreeTier:true provider) so the branch divergence in costDescription is covered, not just its type.
- **`r4-test-suite-gaps#3`** `libs/core/src/catalog/capabilities.test.ts:37-47` — jsonMode string branches in deriveCapabilities are untested despite differing on anyStructured  _test-quality · low · confidence:low_
  - _Problem:_ capabilities.ts emits two distinct jsonMode strings depending on anyStructured ('Supported (structured output / JSON schema)' when any model has structured_output:true, else 'Supported where the model offers JSON output'). The gemini test (anyStructured true) and zai test (anyStructured false) hit different branches, but neither asserts the actual string — the gemini test checks `caps.capabilities` contains 'JSON' (a separate field) and the zai test only checks `jsonMode.length > 0`. The branch that produces the weaker 'where the model offers' wording is therefore unverified; the two outputs could be swapped without failing.
  - _Fix:_ Assert the concrete jsonMode wording per branch: `expect(deriveCapabilities(catalog,'gemini').jsonMode).toMatch(/structured output/i)` and for zai assert the fallback phrasing, so the anyStructured ternary is pinned rather than only its non-emptiness.

### `libs/core/src/catalog/provider-overlay.ts` (4)

- **`catalog-overlay#0`** `libs/core/src/catalog/provider-overlay.ts:25` — `sdkKind` overlay field has no runtime consumer — it is dead curated data  _dead-code · low · confidence:high_
  - _Problem:_ `sdkKind: 'google' | 'openrouter' | 'zhipu' | 'openai-compatible'` is declared on the overlay type and set on all 9 rows, but nothing routes on it. `createLanguageModel` in cli/server/src/shared/lib/ai/client.ts:78 switches on the `provider` enum id (`case 'gemini' | 'zai' | 'zai-coding' | 'openrouter' | 'groq' | 'cerebras'`), never on `overlay.sdkKind`. A repo-wide grep shows `sdkKind` is read only by (a) provider-overlay.test.ts assertions that restate the literal, and (b) catalog-snapshot.test.ts where `sdkKind === 'openrouter'` is used purely as a stand-in for the openrouter provider id (which `id === 'openrouter'` would express directly). The design Data model lists the field, but the locked D3 wiring contract (EXECUTE P4) keys the SDK factory off `overlay.baseURL`, not `sdkKind`. So the field carries no behavior and is a maintenance burden (every new provider must set a value that nothing reads).
  - _Fix:_ Either delete `sdkKind` from the overlay type and all 9 rows (the provider-id switch already encodes the SDK kind), or — if it is meant to drive the `createLanguageModel` switch — refactor that switch to dispatch on `sdkKind` so the field becomes load-bearing. In catalog-snapshot.test.ts, replace the `sdkKind === 'openrouter'` proxy with `id === 'openrouter'`.
- **`r2-anti-slop-and-deadcode#1`** `libs/core/src/catalog/provider-overlay.ts:4` — `FreeTierSelector` exported from provider-overlay but consumed only inside its own module  _dead-code · low · confidence:medium_
  - _Problem:_ `FreeTierSelector` is re-exported through the catalog barrel (index.ts `export * from './provider-overlay.js'`) yet has no importer anywhere except its own file (the `freeTier?: FreeTierSelector` field and transform.ts reads it structurally via `overlay.freeTier`). It is a public API surface with no external consumer. matchesSelector in transform.ts narrows on `overlay.freeTier` directly and never references the exported type name. Pre-release, an unconsumed exported type is dead surface.
  - _Fix:_ Drop the `export` keyword (make it module-local) since only the in-file `ProviderOverlay.freeTier` field uses it. Re-export only when a consumer needs it.
- **`r5-anti-slop-and-deadcode#1`** `libs/core/src/catalog/provider-overlay.ts:105-132` — SURFACED_OVERLAYS entries carry the full ProviderOverlay shape but only `modelsDevIds` is read in production — the rest is dead curated data  _dead-code · low · confidence:medium_
  - _Problem:_ The three data-only overlays (mistral, huggingface, github-models) declare diffgazerEnvVar, defaultModel, hasFreeTier, sdkKind, baseURL, and enabled, but no production code reads any field other than modelsDevIds (consumed only by the snapshot generator at generate-catalog-snapshot.ts:11 to decide which source providers to bundle). The only other reads are two assertions in provider-overlay.test.ts checking diffgazerEnvVar. Because these ids are NOT AIProvider enum members, the credential/capabilities/client wiring can never reach them, so every non-modelsDevIds field is curated-but-unreachable data. This is distinct from the reported sdkKind-on-PROVIDER_OVERLAY dead-field finding (that was about the enabled record).
  - _Fix:_ Since only modelsDevIds drives bundling, narrow SURFACED_OVERLAYS to the data actually consumed (e.g. `Record<string, { modelsDevIds: string[] }>` or a `string[]` of source ids) instead of a full ProviderOverlay, so the type stops implying these fields are wired. If the full shape is intentional scaffolding for a future UI boundary, that is YAGNI pre-release per AGENTS.md.
- **`xc-security#2`** `libs/core/src/catalog/provider-overlay.ts:28` — resolveProviderDisplayName uses a non-null assertion on array indexing instead of validated access  _type-safety · low · confidence:medium_
  - _Problem:_ resolveProviderDisplayName (in capabilities.ts:28) indexes overlay.modelsDevIds[0]! with a non-null assertion. Every PROVIDER_OVERLAY row currently has a non-empty modelsDevIds, so this is safe today, but the assertion silently bypasses the empty-array case rather than encoding the invariant. This is the kind of as/!-assertion the audit flags: it would produce CATALOG_SNAPSHOT[undefined] (-> undefined name, falling through to humanize) without any signal if a future overlay row ever shipped an empty modelsDevIds.
  - _Fix:_ Either constrain modelsDevIds to a non-empty tuple type ([string, ...string[]]) so the primary id is statically guaranteed and the assertion is unnecessary, or read const [primaryId] = overlay.modelsDevIds and handle primaryId === undefined explicitly (fall through to humanize).

### `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx` (3)

- **`tui-consumers#1`** `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx:60-61` — Catalog query gated on isActive but OpenRouter query is not — inconsistent fetch behavior within the same component  _patterns · low · confidence:medium_
  - _Problem:_ useOpenRouterModels is enabled with `{ enabled: isOpenRouter }` (no isActive gate), but useProviderModels is enabled with `{ enabled: isActive && !isOpenRouter }`. For non-OpenRouter providers the catalog fetch will not begin until the step is focused (isActive true), whereas OpenRouter starts fetching as soon as the step mounts. Because guardQueryState returns loading() for a disabled-and-never-fetched query (TanStack v5: a disabled pending query has isLoading false, error null, data undefined → the data!==undefined check fails → loading()), a non-OpenRouter step that is rendered while focusArea==='nav' before any successful fetch shows the 'Loading models...' spinner with no fetch in flight. In the normal wizard flow the step is focused on entry so it self-heals, but the asymmetry between the two branches is unintentional.
  - _Fix:_ Gate both queries consistently — either drop the isActive condition from the catalog query (matching OpenRouter and the always-on web ModelStep which passes open=true), or apply the same isActive gate to OpenRouter. Prefer aligning with the mapped-hook consumers that key purely on whether the picker is shown.
- **`tui-consumers#4`** `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx:69,92` — Loading label ellipsis style differs between overlay (U+2026) and onboarding step (ASCII '...')  _naming · low · confidence:medium_
  - _Problem:_ model-select-overlay.tsx renders 'Loading models…' and 'Saving…' using a real ellipsis character (verified bytes e2 80 a6 at lines 49 and 243 — the P6 fix is intact, no literal escape sequence remains). The onboarding ModelStep uses ASCII three-dots: 'Loading OpenRouter models...' and 'Loading models...'. Cosmetic inconsistency in the same feature area; not a rendering bug.
  - _Fix:_ Pick one convention for spinner labels across the TUI (the real ellipsis used by the overlay) and apply it to model-step.tsx for consistency.
- **`tui-consumers#7`** `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx:44-50` — getSubtitle special-cases 'openrouter' although the caller already branches on isOpenRouter  _KISS · low · confidence:low_
  - _Problem:_ getSubtitle re-derives the OpenRouter case with a string compare (`provider === 'openrouter'`) returning a bespoke subtitle, while the component body already computes `isOpenRouter` (line 59) and branches on it. The subtitle is a single string per branch, so routing it through a helper that re-tests the same condition adds an extra indirection and a second source of the 'openrouter' literal.
  - _Fix:_ Inline the two subtitle strings into the respective isOpenRouter branches (or pass isOpenRouter into the helper) so the provider==='openrouter' literal is not duplicated against the existing isOpenRouter computation.

### `libs/core/src/api/hooks/use-provider-models.test.ts` (3)

- **`api-layer#0`** `libs/core/src/api/hooks/use-provider-models.test.ts:42-43` — Redundant assertion: toHaveBeenCalledWith duplicates the observable-data check  _test-quality · low · confidence:medium_
  - _Problem:_ In "fetches models for the requested provider", line 43 already asserts the observable result (data.models[0].id === "gemini"), which can only be "gemini" if the bound fn was called with "gemini" (makeResponse echoes the id). Line 42's spy assertion `expect(getProviderModels).toHaveBeenCalledWith("gemini")` therefore tests the same wiring through the mock's call args rather than adding confidence. Per test-behavior-not-implementation, call-arg assertions are implementation-detail unless the call itself is the contract; here the data assertion already covers it.
  - _Fix:_ Drop line 42 and keep the data assertion on line 43, which observably proves the provider id propagated through the query into the result.
- **`api-layer#1`** `libs/core/src/api/hooks/use-provider-models.test.ts:58-59` — Redundant assertion in rerender test mirrors line 42  _test-quality · low · confidence:medium_
  - _Problem:_ "refetches with the new provider id across rerender" already waits for data.models[0].id === "groq" on line 58, which observably proves the refetch ran with the new id (makeResponse echoes the id). Line 59's `toHaveBeenCalledWith("groq")` re-asserts the same fact via the mock's call args — the same implementation-detail duplication as the first test.
  - _Fix:_ Remove line 59; the waitFor on line 58 is the behavior assertion that proves the queryKey-includes-providerId refetch contract.
- **`xc-test-quality#4`** `libs/core/src/api/hooks/use-provider-models.test.ts:46-60` — useProviderModels tests largely re-verify TanStack Query framework guarantees  _test-quality · low · confidence:low · ⚠ UNCERTAIN (needs human judgment)_
  - _Problem:_ "does not fetch when disabled" and "refetches with the new provider id across rerender" exercise behavior owned by TanStack Query (enabled:false suppresses the queryFn; a changed queryKey triggers a refetch). The hook itself only spreads configQueries.providerModels(api, providerId) and the caller options, so these tests mostly prove the library works. The thin slice of real hook logic — that providerId lands in the queryKey and options pass through — is genuine but minimal; the tests as written read as framework re-tests ("Don't test what the framework already tests").
  - _Fix:_ Collapse the three tests into one behavior-focused test that fetches for a provider and asserts the returned data, plus (if you want regression protection on the queryKey) a single rerender-changes-provider assertion. Drop the standalone enabled:false test or fold it in — it adds little beyond re-proving TanStack's enabled flag.

### `libs/core/src/catalog/capabilities.ts` (3)

- **`catalog-capabilities#1`** `libs/core/src/catalog/capabilities.ts:38` — deriveCapabilities re-implements model gathering instead of reusing mergeModelsAcrossSources  _DRY · low · confidence:medium_
  - _Problem:_ deriveCapabilities gathers models via `overlay.modelsDevIds.flatMap((id) => Object.values(catalog[id]?.models ?? {}))`, a bespoke strategy that does NOT collapse duplicate model ids across alias sources. Its sibling catalogToModelInfo (transform.ts:94) uses the exported mergeModelsAcrossSources, which the P6 report (EXECUTE.md line 196) explicitly extracted as the DRY fix for exactly this multi-source merge concern. Two model-gathering strategies now coexist in the same catalog module. For the four facts derived here (some(tool_call), some(structured_output), some(reasoning), max(limit.context)) duplicates are idempotent, so there is no observable bug today — but the inconsistency is a maintenance trap: if any future per-model-weighted capability is added, the un-deduped path silently diverges from the canonical merge.
  - _Fix:_ Build the model list with the already-exported `mergeModelsAcrossSources(catalog, overlay.modelsDevIds)` so both transform and capabilities share one source-merge contract. Keeps a single, tested merge path.
- **`r1-deep-logic-correctness#3`** `libs/core/src/catalog/capabilities.ts:23-34` — resolveTier returns 'paid' for a provider with zero catalog models, contradicting its FREE tierBadge  _patterns · low · confidence:low_
  - _Problem:_ resolveTier iterates the provider's models and, with an empty list (modelsDevIds absent from the catalog, or a snapshot that trimmed a provider's models), leaves hasFree=false/hasPaid=false and falls through to return 'paid'. Meanwhile tierBadge is derived purely from overlay.hasFreeTier (line 53), so an enabled hasFreeTier:true provider with no models would render tierBadge:'FREE' next to tier:'paid' and a 'Free and paid tiers vary…' costDescription — three mutually inconsistent signals. All six enabled providers are currently present in the snapshot so it is not triggered today, but it is a latent inconsistency waiting on any future enabled provider whose id is missing or whose modelsDevIds is mistyped.
  - _Fix:_ When models is empty, return a tier consistent with overlay.hasFreeTier (or an explicit 'unknown'/'free' for hasFreeTier providers) instead of unconditionally defaulting to 'paid', so tier and tierBadge cannot contradict each other.
- **`r7-anti-slop-and-deadcode#4`** `libs/core/src/catalog/capabilities.ts:47-49` — Inline comment in deriveCapabilities narrates the JSON push instead of stating intent  _anti-slop · low · confidence:medium_
  - _Problem:_ The two-line comment above the unconditional `capabilities.push("JSON")` explains control flow in prose ('structured_output:null/undefined is a missing positive hint, never a suppressor — JSON mode is offered whenever the provider is a chat provider'). It is AI-voice explanatory narration restating why a line is unconditional. The already-reported capabilities findings (catalog-capabilities#0/#1, r3/r4 test gaps) cover the missing test and DRY issues, not this comment. The comment is also slightly misleading: the code does not check 'is a chat provider' anywhere — it pushes JSON unconditionally for every provider, so the comment asserts a guard the code does not implement.
  - _Fix:_ Replace with a terse intent line (e.g. 'JSON mode is always offered; structured_output only upgrades the jsonMode prose') or drop it, since `jsonMode` already encodes the structured-vs-plain distinction below.

### `libs/core/src/catalog/schema.ts` (3)

- **`catalog-schema#1`** `libs/core/src/catalog/schema.ts:51-53` — JSDoc claims provider-level skip behavior that no test exercises  _test-quality · low · confidence:medium_
  - _Problem:_ The parser's JSDoc states 'Providers that fail the provider-level shape entirely are skipped' (the `if (provider.success)` branch at line 71 silently drops a provider). No test covers a provider whose top-level shape is invalid (e.g. `models` being a non-object that survives the guard, or another required field failing) being skipped while sibling providers remain. The per-model skip is well tested, but the documented provider-level skip is unverified, so a regression there would pass CI.
  - _Fix:_ Add one test: a catalog with a valid provider plus a structurally-invalid provider object, asserting the valid one is present and the invalid one is absent (and siblings are unaffected). This pins the second documented contract.
- **`r4-anti-slop-and-deadcode#0`** `libs/core/src/catalog/schema.ts:43` — `ModelsDevProvider` type is exported but never imported — dead type export  _dead-code · low · confidence:high · ⚠ UNCERTAIN (needs human judgment)_
  - _Problem:_ `export type ModelsDevProvider = z.infer<typeof ModelsDevProviderSchema>` has zero importers across the entire repo. A full grep finds only its own definition line plus internal references to the `ModelsDevProviderSchema` constant (lines 36, 45, 70) — the *type* alias itself is consumed nowhere (production or test). The sibling types `ModelsDevModel` and `ModelsDevCatalog` are both imported and used; this one is a leftover public surface. Pre-first-release, unused exported types are dead code and should not be carried.
  - _Fix:_ Delete the `ModelsDevProvider` type export. The `ModelsDevProviderSchema` constant is used internally to build `ModelsDevCatalogSchema` and inside `parseModelsDevCatalog`; the inferred type alias has no consumer, so remove it (re-add only if/when a caller needs it).
- **`r7-anti-slop-and-deadcode#3`** `libs/core/src/catalog/schema.ts:48-53` — JSDoc on parseModelsDevCatalog narrates the control flow it sits above  _anti-slop · low · confidence:medium · ⚠ UNCERTAIN (needs human judgment)_
  - _Problem:_ The doc comment restates the implementation step-by-step ('parsed per-model', 'a structurally-invalid model is dropped, its valid siblings kept', 'Providers that fail the provider-level shape entirely are skipped') — each clause maps 1:1 to a `safeParse`/`continue` line directly below it. This is AI-voice control-flow narration (anti-slop Cat 1a/4): the code already self-documents the per-model loop and the provider-level `safeParse(...).success` guard. Note the same comment's 'Providers that fail the provider-level shape ... are skipped' claim is the subject of the already-reported untested-behavior finding (catalog-schema#1); the NEW issue here is the comment's redundant restatement of mechanics rather than the test gap.
  - _Fix:_ Reduce to a one-line intent statement (e.g. 'Defensive parse: drop invalid models/providers so one bad upstream entry can't empty the catalog') and delete the per-step narration.

### `libs/core/src/schemas/config/capabilities.ts` (3)

- **`r1-completeness-and-deferrals#4`** `libs/core/src/schemas/config/capabilities.ts:12-29` — humanize JSDoc example cites 'github-models', an id the enum-keyed resolver can never receive  _anti-slop · low · confidence:low_
  - _Problem:_ `resolveProviderDisplayName` is keyed over `AIProvider` (the 6 enabled enum members) and only reaches `humanize(provider)` as a last-resort fallback. The JSDoc advertises `"github-models" -> "Github Models"` as the example, but `github-models` is a SURFACED_OVERLAYS (data-only, non-enum) id that can never flow through this function. The comment documents a code path that does not exist for any real input, and every enum member resolves earlier via `displayName ?? modelsDevName`, making the humanize fallback effectively unreachable in practice.
  - _Fix:_ Use a real enum-member example (or note the fallback is for safety only), and confirm whether the humanize fallback is ever reachable given all 6 providers have either a curated displayName or a models.dev name in the bundled snapshot — if not, simplify.
- **`r5-anti-slop-and-deadcode#2`** `libs/core/src/schemas/config/capabilities.ts:10` — Magic string "openrouter" used in several callers despite the OPENROUTER_PROVIDER_ID constant existing to be the single source  _DRY · low · confidence:low_
  - _Problem:_ OPENROUTER_PROVIDER_ID is exported (capabilities.ts:10) and adopted by model-select-dialog.tsx, model-select-overlay.tsx, provider-details.tsx, use-provider-models-mapped.ts, and use-openrouter-models-mapped.ts. But several sibling callers compare against the raw literal "openrouter" instead: model-step.tsx (TUI) lines 45/59, page.tsx:165, use-wizard-state.ts:60, and provider-step.tsx:24. The constant exists precisely to avoid this magic-string scatter; mixing both forms is an inconsistent single-source-of-truth and a latent rename hazard.
  - _Fix:_ Use OPENROUTER_PROVIDER_ID everywhere the OpenRouter provider is special-cased, or drop the constant and standardize on the literal — pick one and apply it consistently across all consumers.
- **`schemas-config#1`** `libs/core/src/schemas/config/capabilities.ts:32-50` — PROVIDER_CAPABILITIES iterates all overlay keys while AVAILABLE_PROVIDERS filters enabled — latent divergence  _DRY · low · confidence:low_
  - _Problem:_ AVAILABLE_PROVIDERS is built from ENABLED_PROVIDER_IDS (overlay rows with enabled:true), but PROVIDER_CAPABILITIES is built from the raw Object.keys(PROVIDER_OVERLAY). Today these produce identical sets only because every member of PROVIDER_OVERLAY happens to be enabled:true (the disabled providers live in the separate SURFACED_OVERLAYS map). The spec (D3) explicitly anticipates promotions/demotions via the enabled flag; the moment an enum member is set enabled:false, PROVIDER_CAPABILITIES would still expose a capability card for a provider that is absent from the picker, an inconsistency between two derivations of the same concept.
  - _Fix:_ Decide on a single source of truth for the provider id set. Since PROVIDER_CAPABILITIES is typed Record<AIProvider, ...> it must stay exhaustive over the enum (so keep iterating all enum keys), but then add a short comment noting the exhaustiveness intent, OR derive both from one shared `ALL_PROVIDER_IDS = Object.keys(PROVIDER_OVERLAY) as AIProvider[]` and apply the enabled filter only at AVAILABLE_PROVIDERS, making the relationship explicit rather than incidental.

### `scripts/monorepo/artifacts/smoke-modelsdev.mjs` (3)

- **`scripts-docs#0`** `scripts/monorepo/artifacts/smoke-modelsdev.mjs:11-13` — assertCatalogProviders hardcodes "live models.dev catalog:" prefix in the throw, ignoring the injected source  _error-handling · low · confidence:high_
  - _Problem:_ The function takes a `source` parameter (e.g. "bundled snapshot" or "live models.dev") and uses it in the success line (`OK: ${provider} -> ... (${source})`), but the failure path throws a message with the literal prefix `live models.dev catalog:` regardless of which path is running. When the bundled-snapshot validation fails (the offline guarantee, which runs on EVERY invocation per design D6), the operator sees "live models.dev catalog: provider 'X' resolved to zero models" even though no network fetch happened. This misdirects debugging toward a network/live-data problem when the real fault is a bad snapshot regenerate. This is the exact LOW carried open from the P6 progress log.
  - _Fix:_ Interpolate the injected source into the thrown message so it matches the success line, e.g. `throw new Error(\`${source}: provider '${provider}' resolved to zero models\`);`. The snapshot-path test in smoke-modelsdev.test.mjs (lines 20-26) only matches /provider 'groq' resolved to zero models/, so the fix is safe and needs no test change.
- **`scripts-docs#1`** `scripts/monorepo/artifacts/smoke-modelsdev.mjs:1-7` — JSDoc on assertCatalogProviders restates the code and asserts a symmetry the code does not honor  _anti-slop · low · confidence:medium_
  - _Problem:_ The block comment is partly restating-code slop ("Assert that every provider resolves to at least one model and return one summary line per provider" mirrors the function name + body) and partly stale: it claims `resolve` is injected "so the offline snapshot and the live models.dev response run through identical assertions" — but the assertions are NOT identical, because the failure message is hardcoded to the live path (see the related finding). The comment promises a symmetry the code breaks.
  - _Fix:_ Trim to the one non-obvious fact (zero models => blank picker => hard failure; resolve injected for source-agnostic reuse) and drop the restating sentence. Once the throw prefix is interpolated with `source`, the 'identical assertions' claim becomes true and can stay.
- **`xc-completeness-tasks#3`** `scripts/monorepo/artifacts/smoke-modelsdev.mjs:11-12` — Smoke assertCatalogProviders hardcodes 'live models.dev catalog' prefix on the snapshot path despite an injected source  _completeness · low · confidence:high_
  - _Problem:_ This is the carried-open LOW from the EXECUTE.md P6 log, confirmed still unfixed. The function takes a `source` parameter and interpolates it into the OK line (`OK: ${provider} -> ... (${source})`) but ignores it in the error branch, where it throws a hardcoded `live models.dev catalog: ...` prefix. The bundled-snapshot caller passes source="bundled snapshot" (smoke-modelsdev.mjs:23), so a zero-models failure on the offline snapshot path would be reported as a live-API failure — misattributing the fault. All paths currently pass so it is cosmetic, but the asymmetry is a real inconsistency.
  - _Fix:_ Interpolate the injected source into the thrown message too: `throw new Error(`${source}: provider '${provider}' resolved to zero models`);` so the error attributes the failure to the actual catalog source.

### `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx` (2)

- **`r7-test-suite-gaps#3`** `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx:71-84` — Web dialog free-filter test relies on bare 'f' keypress with no element focused, coupling the test to global keyboard wiring rather than an accessible filter control  _test-quality · low · confidence:medium_
  - _Problem:_ The free-tier filter behavior is driven by `await user.keyboard("f")` with no prior focus action and no assertion that a filter tab/control is the accessible target. The dialog exposes ModelFilterTabs (a focusable, clickable tab group with getFilterButtonProps), yet the test bypasses that accessible control and pokes a global hotkey, asserting only that a paid radio disappears. This both (a) skips the accessible query priority (the filter UI has roles/labels that go unverified) and (b) makes the test pass/fail on document-level keyboard plumbing instead of the user-visible filter affordance. There is also no assertion of the filter's own state (e.g. the 'free' tab now reflecting the active selection).
  - _Fix:_ Drive the filter through its accessible control — click or focus+activate the free filter tab (getByRole tab/button by name) — and assert the tab's selected state in addition to the model list narrowing, so the test reflects how a user actually filters.
- **`r8-test-suite-gaps#3`** `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx:58-69` — Neither UI test asserts the paid tier badge renders — only the free badge is verified  _test-quality · low · confidence:medium_
  - _Problem:_ model-list-item.tsx renders a tier Badge whose text and variant switch on model.tier ('free' -> success/info, 'paid' -> neutral). The web dialog test asserts only that the free model 'has text content /free/i'; it never asserts that the paid model (gemini-3-pro-preview, present in the fixture) renders a visible 'paid' badge, and the TUI overlay test asserts neither. The free/paid badge is the headline visual contract of the D2 tiering work, yet the negative half (paid is shown as paid) is unpinned across both UI surfaces, so a badge that silently dropped or mislabeled paid models would pass.
  - _Fix:_ Add an assertion that the paid model's radio renders a visible 'paid' badge (e.g. toHaveTextContent(/paid/i) on the gemini-3-pro-preview radio) so both tier outputs are pinned at the UI boundary.

### `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.tsx` (2)

- **`web-consumers#2`** `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.tsx:116` — getCompatibilityLabel computed unconditionally for non-OpenRouter providers  _KISS · low · confidence:medium_
  - _Problem:_ `compatibilityLabel` is computed on every render from the OpenRouter hook result, but it is only rendered inside the `isOpenRouter &&` block (lines 154-160). For the catalog providers (gemini/zai/groq/cerebras/zai-coding) the OpenRouter hook returns EMPTY_STATE, so `getCompatibilityLabel` returns the misleading "No models available." string that is then discarded. The computation is cheap, so this is a clarity issue rather than a perf one: a reader sees a compatibility label being derived for providers that have no compatibility concept.
  - _Fix:_ Inline the call inside the `isOpenRouter &&` JSX block (or guard with `isOpenRouter ?`), so the OpenRouter-only label is only derived when it is actually shown. This keeps the OpenRouter-specific concern colocated with its render site.
- **`xc-react#1`** `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.tsx:37-52` — getCompatibilityLabel duplicated across web and CLI with no shared source  _DRY · low · confidence:medium_
  - _Problem:_ getCompatibilityLabel is defined inline in the web ModelSelectDialog (lines 37-52) and again, byte-for-byte identical, as an exported function in cli/diffgazer/.../model-select-helpers.ts (lines 1-16). Same signature, same four return strings, same OpenRouter structured-output prose. This is the third+ surface of OpenRouter compatibility prose (the underlying total/compatible/hasParams shape already lives in libs/core useOpenRouterModelsMapped), so it meets the extract threshold. Both web and CLI consume the identical OpenRouterModelsState shape from @diffgazer/core/providers, making libs/core the natural single source. The web copy is inline (not even reusing the CLI export), so the strings can silently drift between the two clients.
  - _Fix:_ Move getCompatibilityLabel into libs/core (e.g. beside useOpenRouterModelsMapped / openrouter-utils) and import it in both the web dialog and the CLI helper, deleting both copies. This is preexisting OpenRouter logic, but the slice edits both files, so consolidating now is cheap.

### `apps/web/src/features/providers/components/provider-details.test.tsx` (2)

- **`web-consumers#1`** `apps/web/src/features/providers/components/provider-details.test.tsx:25-52` — Test does not cover the spec's graceful-unknown capabilities path  _test-quality · low · confidence:medium · ⚠ UNCERTAIN (needs human judgment)_
  - _Problem:_ The slice focus and design.md line 251 call out the ProviderDetails "graceful-unknown path" as a behavior to verify. The test file covers only the two default-model placeholder branches (default-model present, OpenRouter "Model required", enabled-provider-with-no-default "No default model"). It never asserts the capabilities-missing fallback ("Unknown provider") nor the null-provider "Select a provider to view details" empty state. Combined with finding #1, the capabilities branch is both dead and untested, so there is no behavioral pin proving the graceful path renders rather than crashing on an index miss.
  - _Fix:_ Add a test for the null-provider empty state (the most likely real path) and, if the capabilities guard is kept as intentional defense, one that renders a provider whose capabilities resolve falsy. If the guard is removed per finding #1, the null-provider empty-state test is still worth adding since it is real, reachable behavior.
- **`xc-react#3`** `apps/web/src/features/providers/components/provider-details.test.tsx:14-23` — provider-details test uses an `as` cast that bypasses prop-type completeness  _type-safety · low · confidence:medium_
  - _Problem:_ makeProvider builds a partial object and returns it with `as ProviderWithStatus`, suppressing the compiler. If ProviderWithStatus gains a required field (plausible while this very feature reshapes provider data from the overlay), the cast hides the gap and the fixture silently goes stale rather than failing type-check. The factory pattern is fine; the cast is the issue.
  - _Fix:_ Drop the `as ProviderWithStatus` cast and type the base object as ProviderWithStatus directly (or `const base: ProviderWithStatus = {...}; return { ...base, ...overrides };`) so missing/renamed required fields are caught at compile time.

### `cli/server/src/features/config/router.ts` (2)

- **`r2-security-and-boundaries#0`** `cli/server/src/features/config/router.ts:27,64,75` — New /provider/:id/models route shares one global rate-limit bucket with the OpenRouter route  _security · low · confidence:high_
  - _Problem:_ `modelFetchLimit` is created once with the static key "config:models" (createRateLimitMiddleware bakes the key in at construction; the window Map is keyed purely by that string with no per-client/per-route/per-IP component). The new catalog route at line 75 reuses the *same* middleware instance as the pre-existing OpenRouter route at line 64. The two endpoints therefore consume one shared process-global 30-req/min counter: traffic to the models.dev catalog endpoint can exhaust the budget for the OpenRouter endpoint and vice-versa, and a single noisy caller throttles every caller of both routes. This coupling is newly introduced by wiring the second consumer onto the existing instance.
  - _Fix:_ Give the catalog route its own middleware instance with a distinct key (e.g. createRateLimitMiddleware("config:catalog-models", ...)), or compose the key with a per-route + per-client discriminator inside the middleware so the two endpoints (and distinct callers) get independent windows.
- **`server-route-client#2`** `cli/server/src/features/config/router.ts:80-85` — errorResponse silently buckets every non-VALIDATION/non-DISABLED catalog error into 500 including code-less paths  _error-handling · low · confidence:medium_
  - _Problem:_ The /provider/:id/models handler maps VALIDATION_ERROR->400, PROVIDER_DISABLED->404, else->500. getProviderModels (service.ts:251-267) can only return those three codes today, so the mapping is correct, but the service signature widens error.code to a bare string ({ message: string; code: string }), so the ternary compares a string against typed constants with no exhaustiveness guarantee. A future error code added to the service would silently fall through to 500 with no compile-time signal.
  - _Fix:_ Tighten getProviderModels' error type to a discriminated union of the codes it can actually return (CatalogErrorCode | ErrorCode.VALIDATION_ERROR | ErrorCode.INTERNAL_ERROR) so the router's status mapping is exhaustively checkable, or add a default-case comment documenting that 500 is the intentional catch-all for INTERNAL_ERROR.

### `cli/server/src/features/config/service.test.ts` (2)

- **`server-route-client#3`** `cli/server/src/features/config/service.test.ts:401-417` — PROVIDER_DISABLED service test mutates an imported module's live export in place  _test-quality · low · confidence:medium_
  - _Problem:_ The disabled-provider test reassigns overlayModule.PROVIDER_OVERLAY.groq = { ...original, enabled: false } and restores it in a finally. Because PROVIDER_OVERLAY is a real shared module-level object, this mutates global state for the duration of the test; correctness depends entirely on the try/finally restore running and on no other test in the same module graph reading PROVIDER_OVERLAY.groq concurrently. It also couples the test to the internal mutability of a core export rather than the route's observable behavior.
  - _Fix:_ Prefer asserting the disabled path against a provider whose overlay is genuinely enabled:false in the real overlay (e.g. mistral/huggingface/github-models are surfaced data-only) so no live-export mutation is needed; that exercises the same PROVIDER_DISABLED branch through real configuration and removes the fragile mutate/restore dance.
- **`xc-completeness-tasks#5`** `cli/server/src/features/config/service.test.ts:402-417` — Disabled-provider test mutates the shared imported PROVIDER_OVERLAY singleton  _test-quality · low · confidence:medium_
  - _Problem:_ The PROVIDER_DISABLED test reassigns a property on the live imported module object (`overlayModule.PROVIDER_OVERLAY.groq = { ...original, enabled: false }`) to simulate a disabled provider, restoring it in a finally block. This mutates internal module state shared across the whole test run; if any assertion throws before finally (or tests run concurrently against the same module instance) the mutation leaks. Because every real AIProvider enum member is enabled, there is no genuinely-disabled provider to exercise the branch, so this is a defensible workaround, but it depends on a try/finally for global-state hygiene rather than testing observable behavior through a fixture.
  - _Fix:_ Prefer injecting the overlay (or a disabled-provider fixture) into the service rather than mutating the imported singleton; if mutation is unavoidable, this is acceptable as-is but should be documented as the only way to reach the otherwise-unreachable disabled branch.

### `libs/core/scripts/generate-catalog-snapshot.ts` (2)

- **`catalog-snapshot#2`** `libs/core/scripts/generate-catalog-snapshot.ts:17-28` — Generator emits source-order keys with no sort, making the committed artifact's diffs non-deterministic across captures  _patterns · low · confidence:medium_
  - _Problem:_ Provider and model keys in the snapshot are emitted in `Object.entries()` iteration order of the source api.json (verified: snapshot provider order is mistral, huggingface, openrouter, github-models, groq, zai-coding-plan, zai, google, cerebras; google's models are non-alphabetical: gemini-2.5-flash-preview-tts, gemini-2.5-flash-image, gemini-3.1-flash-lite-preview...). JSON object key order is not a stable contract from models.dev, so a future capture that merely reorders keys regenerates a large noisy diff in the committed artifact with zero real data change. The plan (Task 5) frames this snapshot as committed and reviewed per change; non-deterministic ordering undermines that reviewability. The generator does no `.sort()`.
  - _Fix:_ Sort provider ids and per-model ids before serializing (build `trimmed` from sorted entries and sort each provider's `models` keys). This guarantees byte-stable output for unchanged data and scopes regeneration diffs to genuine changes.
- **`r7-completeness-and-deferrals#0`** `libs/core/scripts/generate-catalog-snapshot.ts:18-21` — D6 snapshot generator never trims to "used fields" — bundles modalities/knowledge/cache_read/cache_write that no consumer reads  _completeness · low · confidence:high_
  - _Problem:_ Design D6 (design.md line 120, 135, 149) explicitly specifies the bundled offline snapshot is "trimmed to overlay providers + used fields" and "GENERATED: ... (trimmed, TS not json)". The generator only trims at the PROVIDER level (`if (wantedSourceIds.has(id)) trimmed[id] = provider;`) and copies each provider object wholesale via `JSON.stringify(trimmed)`. It performs NO field-level trimming, so the committed catalog-snapshot.ts carries fields that no production transform/capability consumer reads: `modalities` and `knowledge` are referenced only in fixtures (verified: zero non-fixture, non-schema consumers across libs/core/src/catalog, cli/server, apps/web, cli/diffgazer), and `cache_read`/`cache_write` likewise appear only in fixtures. The half of D6 that says 'used fields' was never realized; only the provider-level half landed. This inflates the tsup-inlined bundle and the committed artifact with dead curated data and makes the snapshot's diff noisier on every regenerate.
  - _Fix:_ Either implement the specified field-level trim in the generator (map each model to only {id,name,family,cost:{input,output},limit:{context,output},tool_call,structured_output,reasoning,release_date,last_updated}) so the snapshot matches D6's "used fields", or update design.md D6 to drop the field-trimming claim if provider-level trimming is now considered sufficient. Reconcile the spec and the code so the deferral is closed, not silently carried.

### `libs/core/src/providers/models.ts` (2)

- **`providers-runtime#0`** `libs/core/src/providers/models.ts:7-15` — buildModels is dead code — zero production consumers after the migration  _dead-code · low · confidence:high · ⚠ UNCERTAIN (needs human judgment)_
  - _Problem:_ buildModels is exported but has no production caller anywhere in the repo. A repo-wide grep (excluding dist/node_modules) finds it referenced only by its own definition and models.test.ts. Before this change, the web ModelSelectDialog and TUI ModelSelectOverlay used getStaticModelsForProvider (now deleted) + useOpenRouterModelsMapped — never buildModels. After this change those consumers use useProviderModelsMapped + useOpenRouterModelsMapped. The real OpenRouter live mapping flows through useOpenRouterModelsMapped (which calls mapOpenRouterModels with isOpenRouterCompatible filtering), so buildModels's openrouter branch is never reached in production and its non-openrouter branch is a constant `return []`. AGENTS.md bans dead code / backwards-compat shims pre-first-release. The spec (design.md line 248) describes buildModels's intended new shape, but no code wires it into the catalog flow it documents, so its retention is YAGNI/dead-code.
  - _Fix:_ Delete buildModels (and its OpenRouterModel/AIProvider-only-for-buildModels imports if they become unused) and the corresponding describe('buildModels') block in models.test.ts. The OpenRouter mapping that the spec wanted 'kept' already lives in useOpenRouterModelsMapped via mapOpenRouterModels; keep that single source of truth. If a non-hook entry point is genuinely needed later, reintroduce it when a consumer exists.
- **`providers-runtime#1`** `libs/core/src/providers/models.ts:13` — buildModels OpenRouter branch duplicates mapOpenRouterModels but omits the compatibility filtering the real path applies  _DRY · low · confidence:high_
  - _Problem:_ buildModels('openrouter', models) returns mapOpenRouterModels(models) with no filtering, whereas the actual production OpenRouter path (useOpenRouterModelsMapped) first filters via isOpenRouterCompatible when supportedParameters are present before mapping. This is a second, divergent rendition of OpenRouter→ModelInfo logic. Because buildModels is dead it cannot cause a runtime bug today, but as a DRY/single-source-of-truth violation it is a latent trap: any future caller of buildModels would get an UNFILTERED OpenRouter list that silently disagrees with what the UI actually shows.
  - _Fix:_ Resolved by deleting buildModels (see prior finding). If kept, it must route through the same compatibility-filter logic as useOpenRouterModelsMapped so there is one OpenRouter mapping contract, not two.

### `libs/core/src/providers/use-provider-models-mapped.ts` (2)

- **`r1-deep-logic-correctness#2`** `libs/core/src/providers/use-provider-models-mapped.ts:30-34` — useProviderModelsMapped discards still-valid data on a transient background-refetch error  _error-handling · low · confidence:medium_
  - _Problem:_ The hook checks query.error before query.data. In TanStack Query v5, after a successful fetch followed by a FAILED background refetch, query.data retains the last good ModelInfo[] while query.error is populated simultaneously. Because the error branch (line 30) precedes the data branch (line 32), a transient refetch failure throws away the still-displayed model list and renders an error state with models:[] — even though good data is in hand. The server is resilient (3-tier fallback), but this client ordering defeats that resilience on the refetch path and can blank a working picker.
  - _Fix:_ Prefer existing data over a refetch error: check query.data first (return models when present), and only surface query.error when there is no data to show — e.g. `if (query.data) return {models: query.data.models, ...}; if (query.error) return error-state;`.
- **`r2-deep-logic-correctness#0`** `libs/core/src/providers/use-provider-models-mapped.ts:9-34` — `source` and `fetchedAt` resilience metadata is plumbed end-to-end but read by no consumer (dead plumbing)  _dead-code · low · confidence:high_
  - _Problem:_ The `source: "live"|"cache"|"snapshot"` field (and `fetchedAt`) is produced by getProviderModels, serialized over HTTP, declared in ProviderModelsResponseSchema, mapped into ProviderModelsState.source at line 34, then read by nobody. Grepping apps/web providers and cli/diffgazer providers|onboarding for `.source`/`fetchedAt` returns zero hits — both pickers consume only `.models`, `.loading`, `.error`. Design D6's resilience story (never a blank picker; surface live/cache/snapshot status so the user knows data may be stale/offline) is therefore not actually delivered: the catalog can silently serve a months-old bundled snapshot with no UI indication. The whole source channel is either premature plumbing (YAGNI) or an incomplete feature (the offline/snapshot indicator the design implies was never wired into the UI). It also masks a latent lie: snapshotResult reports `fetchedAt: new Date().toISOString()`, so the emergency offline printout claims to be fresh-as-of-now, misleading any future consumer that trusts fetchedAt.
  - _Fix:_ Either wire source/fetchedAt into the pickers as the offline/snapshot freshness indicator the design calls for, or drop them from ProviderModelsState and stop threading them through the mapped hook. If kept, fix snapshotResult to not stamp a now() timestamp on snapshot data.

### `libs/core/src/schemas/config/catalog-errors.ts` (2)

- **`r2-anti-slop-and-deadcode#0`** `libs/core/src/schemas/config/catalog-errors.ts:14` — `CatalogError` type alias is exported but never imported — dead export  _dead-code · low · confidence:high_
  - _Problem:_ `export type CatalogError = z.infer<typeof CatalogErrorSchema>` has zero importers across the entire repo. Only `CatalogErrorCode` (used at service.ts:260 as the createError type param) and `CatalogErrorSchema` (used in service.test.ts) are consumed. The sibling pattern `ReviewError` in schemas/review/issues.ts IS consumed (orchestrate.ts, stream-review.ts), so this is not a uniform 'always export the alias' convention — it is a genuinely unused public export. AGENTS.md line 27 mandates deleting dead code before first release rather than preserving it.
  - _Fix:_ Delete the `CatalogError` type alias. Keep `CatalogErrorCode` and `CatalogErrorSchema`, which have real consumers.
- **`r4-anti-slop-and-deadcode#3`** `libs/core/src/schemas/config/catalog-errors.ts:10` — `CATALOG_ERROR_CODES` runtime export is consumed only to derive its own type  _dead-code · low · confidence:high_
  - _Problem:_ `CATALOG_ERROR_CODES` is exported through the schemas/config barrel but has no external importer — the only reference is line 13 in the same file (`type CatalogErrorCode = (typeof CATALOG_ERROR_CODES)[number]`). The derived `CatalogErrorCode` type IS used (service.ts) and `CatalogErrorSchema` is used in a test, but the `CATALOG_ERROR_CODES` array does not need to be a public export to derive a local type. This is distinct from the already-reported dead `CatalogError` alias (r2-anti-slop#0); it is a separate over-exposed symbol. Exporting it widens the public API with no consumer.
  - _Fix:_ Drop the `export` keyword from `CATALOG_ERROR_CODES` (keep it a module-local const used to derive `CatalogErrorCode`). Export only the symbols with real consumers: the `CatalogErrorCode` type, `CatalogErrorSchema`, and `PROVIDER_DISABLED`.

### `package.json` (2)

- **`catalog-snapshot#1`** `package.json:27-28` — prepare:artifacts does not regenerate the committed snapshot (carried P5 LOW unresolved)  _completeness · low · confidence:high_
  - _Problem:_ Design D6 build-sequence step 5 requires "Generate `catalog-snapshot.ts` ... + a `prepare:artifacts` step that regenerates it." The `generate:catalog-snapshot` script exists only as a standalone libs/core script (libs/core/package.json:140) and is wired into neither `prepare:library-artifacts` nor `prepare:artifacts` (root package.json:27-28), nor into turbo.json. The committed offline snapshot therefore drifts from the live source indefinitely until someone manually runs the script — exactly the staleness rot this feature set out to eliminate. This is the carried P5 LOW and it remains unaddressed.
  - _Fix:_ Either chain `pnpm --filter @diffgazer/core generate:catalog-snapshot` into `prepare:library-artifacts`/`prepare:artifacts` (gated on source availability), or, if intentionally manual, document the decision and refresh cadence in the spec/EXECUTE log so the LOW can be formally closed rather than silently dropped.
- **`xc-completeness-design#0`** `package.json:27-28` — D6 snapshot regeneration is not wired into prepare:artifacts (manual-only)  _completeness · low · confidence:high_
  - _Problem:_ D6 binds: ship the offline snapshot as a generated TS module AND add 'a prepare:artifacts step that regenerates it' (design.md:120, build-sequence step 5: 'a prepare:artifacts step that regenerates it'). The generator exists as libs/core/scripts/generate-catalog-snapshot.ts and is exposed as the `generate:catalog-snapshot` script (libs/core/package.json:140), but it is invoked by NOTHING. Neither `prepare:artifacts` nor `prepare:library-artifacts` references it, and there is no turbo task for it. The committed catalog-snapshot.ts can therefore only ever be regenerated by a human running the script by hand with a manually-placed /tmp/modelsdev.json — exactly the hand-maintenance rot the feature set out to remove. EXECUTE.md P5 itself carried this open ('P6 should confirm the snapshot is intentionally committed or generated per Task 6').
  - _Fix:_ Add a `pnpm --filter @diffgazer/core generate:catalog-snapshot` step to `prepare:library-artifacts` (gated on a fetched api.json), or wire it as a turbo `prepare` task for @diffgazer/core, so the bundled snapshot is regenerated by the same gate that produces every other artifact. Alternatively, if the snapshot is intentionally a committed-and-rarely-refreshed asset, update design.md/D6 to drop the 'prepare:artifacts step that regenerates it' clause so spec and code agree.

### `cli/diffgazer/src/features/providers/components/model-select-overlay.tsx` (1)

- **`tui-consumers#3`** `cli/diffgazer/src/features/providers/components/model-select-overlay.tsx:90` — ModelSelectOverlay return type declares `| null` but the component never returns null  _dead-code · low · confidence:high_
  - _Problem:_ The signature is `): ReactElement | null {` but every code path returns the `<Dialog>` element (the `open` short-circuit lives inside Dialog itself, dialog.tsx:116). The `| null` arm is unreachable and misleads readers into thinking the overlay conditionally unmounts.
  - _Fix:_ Narrow the return type to `ReactElement`.

### `cli/server/src/shared/lib/ai/disk-cache.ts` (1)

- **`r3-anti-slop-and-deadcode#1`** `cli/server/src/shared/lib/ai/disk-cache.ts:25-40` — WithTtlAndFallbackOptions and DiskCacheResolution are exported but consumed only inside disk-cache.ts  _dead-code · low · confidence:high · ⚠ UNCERTAIN (needs human judgment)_
  - _Problem:_ Both interfaces are `export`ed, but a repo-wide grep shows the only references are their definitions and the `withTtlAndFallback` signature in the same file. The sole external caller (openrouter-models.ts) passes an inline object literal and destructures `resolution.value` structurally, never importing either named type. Exporting internal-only types widens the module's public surface with no consumer — the pre-release no-speculative-API rule applies.
  - _Fix:_ Drop the `export` keyword on both `WithTtlAndFallbackOptions` and `DiskCacheResolution` (keep them as file-local interfaces), or inline the options/return shapes into the function signature. Re-export only if a second caller needs to name the type.

### `cli/server/src/shared/lib/ai/models-dev-catalog.test.ts` (1)

- **`r7-test-suite-gaps#1`** `cli/server/src/shared/lib/ai/models-dev-catalog.test.ts:144-147` — "returns a valid ISO fetchedAt" test uses Date.parse, which does not pin the ISO-8601/datetime contract the response schema declares  _test-quality · low · confidence:high_
  - _Problem:_ The test named 'returns a valid ISO fetchedAt' only asserts `Number.isFinite(Date.parse(...fetchedAt))`. Date.parse accepts a huge range of non-ISO inputs (e.g. "December 17, 1995", "2025/01/01", even some locale strings), so this assertion passes for values that are NOT ISO-8601. The design contract (and ProviderModelsResponse) treats fetchedAt as a datetime string; the test name claims ISO but the assertion does not enforce it. Combined with the separately-reported disk-cache `fetchedAt: z.string()` (not `.datetime()`) typing, nothing in this suite actually pins the ISO format — a malformed-but-parseable date would ship undetected.
  - _Fix:_ Assert against an ISO/datetime predicate, e.g. `expect(ProviderModelsResponseSchema.shape.fetchedAt.safeParse(fetchedAt).success).toBe(true)` or a regex `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/`, matching what the router test already does on the HTTP boundary (line 50).

### `cli/server/src/shared/lib/ai/openrouter-models.test.ts` (1)

- **`server-cache#0`** `cli/server/src/shared/lib/ai/openrouter-models.test.ts:11-13,61-72` — OpenRouter test changed (persistOpenRouterModelCache removed) despite spec mandating it stay unchanged  _completeness · low · confidence:high_
  - _Problem:_ D6 / the slice contract states the disk-cache extraction must have ZERO behavior change to OpenRouter and that its test 'must be unchanged/green'. The working tree removes the `persistOpenRouterModelCache` import and its entire `describe("persistOpenRouterModelCache")` block, because the public `persistOpenRouterModelCache` export was deleted from openrouter-models.ts during the refactor. So the OpenRouter public surface and its test were both changed. This is a defensible dead-code removal (grep confirms zero remaining consumers of `persistOpenRouterModelCache` anywhere in the repo, and the EXECUTE P6 log records it as an intentional cleanup), but it is a deviation from the literal 'test unchanged' requirement and removes the only coverage that persistence writes the global OpenRouter file. The remaining 11 OpenRouter tests are otherwise untouched and the persist path is still exercised indirectly via getOpenRouterModelsWithCache's live-fetch persist assertion.
  - _Fix:_ Confirm with the spec owner that dropping the public `persistOpenRouterModelCache` export (and its direct test) is the accepted cleanup. If keeping it removed, the 'OpenRouter test unchanged' clause in the spec/EXECUTE notes should be reconciled so the deviation is explicit rather than contradicting D6.

### `cli/server/src/shared/lib/ai/openrouter-models.ts` (1)

- **`server-cache#1`** `cli/server/src/shared/lib/ai/openrouter-models.ts:144-157` — OpenRouter info-log message can change for fresh-but-unusable cache + fetch-fail path  _patterns · low · confidence:medium_
  - _Problem:_ The refactor onto withTtlAndFallback subtly alters which log line fires in one branch, so it is not a strict zero-behavior-change refactor. Previously, when a cache was TTL-fresh and key-matching but had no supportedParameters (isCacheUsable=false) and the live fetch then failed, the old code reached `if (cache && cacheKeyMatches)` and logged `fetch failed, using cache`. Now withTtlAndFallback returns cached=true, and because `cacheValid` is computed independently of isCacheUsable/keyMatches it is still true, so the `else if (cacheValid)` branch logs `cache hit` instead. The returned data (models/fetchedAt/cached) is identical; only the diagnostic console.info string differs. No test or consumer asserts on these log strings, so impact is cosmetic.
  - _Fix:_ If exact log parity matters, derive the log branch from the resolution outcome (e.g. distinguish 'served stale/unusable cache after fetch failure' from 'served fresh cache') rather than from the independently-recomputed `cacheValid`. Otherwise document that log-string parity is out of scope for the extraction.

### `libs/core/src/catalog/catalog-snapshot.test.ts` (1)

- **`catalog-snapshot#3`** `libs/core/src/catalog/catalog-snapshot.test.ts:15-17` — Snapshot test comment claims openrouter "may be empty by design" while the bundled snapshot is full  _test-quality · low · confidence:medium_
  - _Problem:_ The test documents an intent ("openrouter is served live; its snapshot source may be empty by design") that the actual generated artifact contradicts — openrouter is present with all 343 models and a populated `name`/`api`. The test never asserts openrouter is slim or absent; it only `continue`s past it, so the misleading comment can never be caught by the test. A reader trusting the comment would assume the snapshot is lean when it is the opposite.
  - _Fix:_ Once the generator excludes openrouter (first finding), either drop this comment or convert it into a real assertion (e.g. snapshot has no openrouter key, or the openrouter block has zero models). Tests should assert the design invariant they describe, not just skip it.

### `libs/core/src/catalog/format.ts` (1)

- **`r4-deep-logic-correctness#1`** `libs/core/src/catalog/format.ts:6-12` — formatContextTokens renders contexts in [950000, 999999] as "1000K" instead of "1M" (hard 1,000,000 boundary collides with K-rounding)  _patterns · low · confidence:high_
  - _Problem:_ The branch switches to the M-suffix only at context >= 1_000_000; everything below uses `Math.round(context / 1000) + "K"`. A context of e.g. 980_000 therefore renders as "980K" but 999_500 renders as "1000K" — an awkward four-digit-K label that should read "1M". Because this is the single shared formatter for both the per-model description (transform.describeModel) and the capability card (capabilities.formatContext), any future models.dev entry with a context in [950000, 999999] will display "1000K" in both surfaces. No current snapshot context falls in that window (verified: distinct contexts jump from 131K-class straight to >=1,000,000), so it is latent, but the function is documented as the source of truth that 'the two never disagree on the same number' and the 1000K label is simply wrong.
  - _Fix:_ Promote to the M-suffix when the rounded-K value would reach 1000 (e.g. branch on `context >= 950_000` or compute `Math.round(context/1000) >= 1000`), so 999_500 renders "1M" rather than "1000K".

### `libs/core/src/catalog/index.test.ts` (1)

- **`r4-anti-slop-and-deadcode#2`** `libs/core/src/catalog/index.test.ts:4-16` — Catalog barrel `index.test.ts` tests re-export wiring, not behavior  _test-quality · low · confidence:high · ⚠ UNCERTAIN (needs human judgment)_
  - _Problem:_ Every assertion in this test merely checks that the barrel re-exports a symbol (`typeof catalog.parseModelsDevCatalog === "function"`, `catalog.PROVIDER_OVERLAY` is defined, etc.). The test-behavior-not-implementation skill explicitly lists "Pure type files, constants, or re-export index files" under What NOT to Test: a barrel that does `export *` is module wiring guaranteed by the bundler/TypeScript, not observable behavior. If a re-export is dropped, downstream import sites and their own tests fail — this file adds maintenance cost with zero confidence. It also pins `SURFACED_OVERLAYS` (itself dead data) into the test surface.
  - _Fix:_ Delete `index.test.ts`. Re-export presence is enforced by real consumers and the type checker; a dedicated barrel smoke test is redundant.

### `libs/core/src/catalog/schema.test.ts` (1)

- **`catalog-schema#0`** `libs/core/src/catalog/schema.test.ts:43` — Test file uses unsafe `as Record<string, unknown>` cast to assert a dropped field is undefined  _test-quality · low · confidence:medium_
  - _Problem:_ The non-strict-drop test casts the parsed provider to `Record<string, unknown>` to read `unknownField`. This is a type workaround in test code: the parsed type `ModelsDevProvider` legitimately has no `unknownField`, so the cast exists only to bypass the type system and assert it is undefined. The assertion is also weak — `toBeUndefined()` passes trivially for any property name not on the type (it would pass even if parsing kept the field under a different key).
  - _Fix:_ Assert the observable shape directly instead of probing a phantom field: `expect(Object.keys(catalog["google"]!)).not.toContain("unknownField");` which checks the real behavior (the key was dropped) without a cast.

### `libs/core/src/providers/filter.ts` (1)

- **`r6-completeness-and-deferrals#0`** `libs/core/src/providers/filter.ts:26-33` — Provider free/paid filter keys off derived per-model tier (with new 'mixed') instead of the curated hasFreeTier that design D2 locks  _completeness · low · confidence:high_
  - _Problem:_ Design D2 (LOCKED) states the per-provider hasFreeTier boolean 'drives the provider-level FREE TIER badge AND the provider free/paid filter.' The implemented filter instead reads PROVIDER_CAPABILITIES[id].tier, a value derived by resolveTier() over per-model classification. Because resolveTier returns 'mixed' for any provider that has both a free and a paid model, every hasFreeTier:true provider that carries at least one paid model (gemini, groq, cerebras) resolves to 'mixed' and the 'paid' branch (tier === 'paid') excludes them entirely. The 'Paid' filter can therefore only ever surface zai-coding (the single hasFreeTier:false provider), even though gemini/groq/cerebras all expose paid models. This also creates a latent inconsistency: tierBadge is binary (FREE/PAID from hasFreeTier) while the filter keys off the 3-value tier, so a provider showing a FREE badge is classified 'mixed' for filtering. The filter.test.ts case 'filters by paid tier (excludes free and mixed)' freezes this divergence as if intended, masking that it contradicts the locked D2 contract (filter should be driven by hasFreeTier).
  - _Fix:_ Drive the provider free/paid filter from the curated overlay fact per D2: filter 'free' on PROVIDER_OVERLAY[p.id].hasFreeTier === true and 'paid' on hasFreeTier === false (or expose hasFreeTier through ProviderWithStatus). Reserve the derived free|paid|mixed tier strictly for the per-provider capability/badge display, not the filter, so the 'Paid' filter shows every provider without a curated free tier as the design intends.

### `libs/core/src/providers/models.test.ts` (1)

- **`providers-runtime#2`** `libs/core/src/providers/models.test.ts:78-108` — buildModels test asserts behavior of a dead function, giving false coverage confidence  _test-quality · low · confidence:high_
  - _Problem:_ The describe('buildModels') suite tests a function with no production consumer. Per test-behavior-not-implementation, a test should resemble how software is used; here nothing uses buildModels, so the suite tests an unused code path and must be maintained for zero confidence gain. The 'returns an empty list for non-openrouter providers' test also pins a trivial constant return ([]) — it documents the YAGNI placeholder rather than any real behavior.
  - _Fix:_ Delete this describe block together with buildModels. OpenRouter mapping is already covered where it is actually used (mapOpenRouterModels / useOpenRouterModelsMapped tests).

### `libs/core/src/providers/use-provider-models-mapped.test.ts` (1)

- **`providers-runtime#3`** `libs/core/src/providers/use-provider-models-mapped.test.ts:63-70` — Hook test asserts useProviderModels call arguments — testing wiring, not observable behavior  _test-quality · low · confidence:medium_
  - _Problem:_ Two cases assert mockUseProviderModels.toHaveBeenCalledWith(provider, { enabled: false }). Per test-behavior-not-implementation, asserting the exact arguments passed to an internal hook is an implementation-detail assertion: it couples the test to HOW disabling is wired (an { enabled } option object) rather than the observable contract (models stay empty / no fetch occurs when closed or for openrouter). A refactor that disables fetching differently but preserves the empty result would break these assertions despite identical behavior. The observable parts (result.current.models === []) are already asserted on the lines above and are sufficient.
  - _Fix:_ Drop the toHaveBeenCalledWith assertions and rely on the observable result (models empty, loading/error/source null) for the closed and openrouter cases. If the intent is to prove no network call fires when disabled, that is a property of the boundary hook itself and is already its own concern.

### `libs/core/src/schemas/config/models.ts` (1)

- **`r5-completeness-and-deferrals#1`** `libs/core/src/schemas/config/models.ts:43-48` — ProviderModelsResponse carries a `cached` boolean that is structurally redundant with `source` and read by no consumer  _completeness · low · confidence:high_
  - _Problem:_ The new catalog response schema declares BOTH `source: z.enum(['live','cache','snapshot'])` and `cached: z.boolean()`. These are not independent: in the producer (models-dev-catalog.ts) `cached` is `true` iff `source === 'cache'` (snapshot and live both set `cached:false`), so `cached` is fully derivable from `source`. The OpenRouter response legitimately needs `cached` because it has no `source` field, but the catalog response duplicates the same information in two fields. Moreover no consumer reads `cached` for the catalog path: `useProviderModelsMapped` reads `response.source` (line 34) but never `response.cached`, and no web/TUI component references it. This is distinct from the already-reported `source`/`fetchedAt` dead-plumbing finding — `cached` is specifically a redundant second encoding of `source`, plumbed end-to-end (server result -> schema -> client parse) for zero observable behavior. The design's HTTP-endpoint contract lists `{ models, fetchedAt, source, cached }`, so this redundancy traces to the design itself.
  - _Fix:_ Drop `cached` from ProviderModelsResponseSchema (and ProviderModelsResult in models-dev-catalog.ts) and let consumers derive `source === 'cache'` if ever needed; or, if a single freshness flag is wanted, drop `source` and keep `cached`. Do not ship two fields encoding the same fact with no reader.

### `libs/core/src/schemas/config/providers.ts` (1)

- **`schemas-config#0`** `libs/core/src/schemas/config/providers.ts:36-49` — Relaxed isValidModelForProvider keeps a now-dead provider parameter and one-call indirection  _YAGNI · low · confidence:medium_
  - _Problem:_ After the D5 relaxation, isValidModelForProvider no longer uses its first argument — it is prefixed `_provider` and the body is purely `model.trim().length > 0`. The named per-provider helper now adds indirection with zero behavioral value: it is invoked exactly once, inside the UserConfigSchema refine, and discards the provider it is handed. The per-provider signature is leftover from the old hard-switch design and misleads readers into thinking validation is provider-aware when it is not.
  - _Fix:_ Inline the check into the refine and drop the helper: `.refine((data) => data.model === undefined || data.model.trim().length > 0, { message: "Model must not be empty", path: ["model"] })`. This removes the dead `_provider` parameter and the misleading per-provider abstraction while preserving identical behavior and all current tests.

### `scripts/monorepo/smoke-modelsdev.mjs` (1)

- **`r7-completeness-and-deferrals#1`** `scripts/monorepo/smoke-modelsdev.mjs:9` — Smoke ENABLED_PROVIDERS is a hardcoded literal that has drifted from the overlay-derived enabled roster (single-source-of-truth gap)  _completeness · low · confidence:high_
  - _Problem:_ capabilities.ts derives the enabled provider roster from the overlay at runtime (`ENABLED_PROVIDER_IDS = Object.entries(PROVIDER_OVERLAY).filter(([, o]) => o.enabled)`), and the smoke script already imports from the same built `libs/core/dist/catalog/index.js` barrel (which re-exports PROVIDER_OVERLAY). Yet the smoke hardcodes `const ENABLED_PROVIDERS = ["gemini", "groq", "cerebras"]` — a literal that diverges from the actual enabled set of six (gemini, zai, zai-coding, openrouter, groq, cerebras). The design's never-blank-picker guarantee (D6) and the smoke's own assertCatalogProviders contract ("every enabled provider must resolve to at least one model") therefore go unverified for zai, zai-coding, and openrouter, and — more importantly going forward — when a 7th provider is promoted to enabled (each promotion is "one reviewable change" per D3) the smoke will silently never cover it because the list is not derived. This is the source-of-truth divergence behind the coverage gap: the enabled roster has exactly one canonical derivation (overlay.enabled) that the smoke declines to reuse.
  - _Fix:_ Derive the smoke's provider list from the imported overlay: `const ENABLED_PROVIDERS = Object.entries(PROVIDER_OVERLAY).filter(([, o]) => o.enabled).map(([id]) => id)` (the barrel already exports PROVIDER_OVERLAY). That closes the never-blank-picker coverage for all six providers today and auto-extends to any future enabled provider with no smoke edit.

---

## Appendix A — per-file finding map (for batching)

| File | High | Med | Low | Finding ids |
|---|:---:|:---:|:---:|---|
| `cli/server/src/shared/lib/ai/models-dev-catalog.ts` | 3 | 6 | 11 | xc-security#0, r5-security-and-boundaries#0, r6-deep-logic-correctness#1, xc-completeness-design#1, xc-dry-arch#0, xc-dry-arch#2, r3-deep-logic-correctness#1, r3-deep-logic-correctness#2, r8-deep-logic-correctness#0, server-cache#2, xc-dry-arch#1, r1-deep-logic-correctness#4, r1-security-and-boundaries#2, r3-deep-logic-correctness#4, r3-anti-slop-and-deadcode#2, r6-deep-logic-correctness#0, r6-anti-slop-and-deadcode#2, r6-anti-slop-and-deadcode#3, r7-security-and-boundaries#0, r8-anti-slop-and-deadcode#1 |
| `cli/server/src/features/config/service.ts` | 2 | 4 | 4 | server-route-client#0, xc-completeness-tasks#0, r1-completeness-and-deferrals#0, r1-security-and-boundaries#1, r5-deep-logic-correctness#0, r6-security-and-boundaries#0, xc-security#1, r3-security-and-boundaries#0, r3-security-and-boundaries#2, r4-security-and-boundaries#0 |
| `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx` | 1 | 2 | 4 | r5-test-suite-gaps#1, r2-test-suite-gaps#0, r5-test-suite-gaps#2, tui-consumers#5, tui-consumers#6, xc-test-quality#2, r8-test-suite-gaps#2 |
| `libs/core/src/catalog/capabilities.test.ts` | 1 | 1 | 4 | catalog-capabilities#0, r3-test-suite-gaps#0, catalog-capabilities#2, r3-test-suite-gaps#3, r4-test-suite-gaps#2, r4-test-suite-gaps#3 |
| `libs/core/src/catalog/provider-overlay.ts` | 1 | 1 | 4 | r2-completeness-and-deferrals#0, catalog-overlay#1, catalog-overlay#0, xc-security#2, r2-anti-slop-and-deadcode#1, r5-anti-slop-and-deadcode#1 |
| `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx` | 1 | 2 | 2 | r3-test-suite-gaps#2, r1-test-suite-gaps#1, r5-test-suite-gaps#0, r7-test-suite-gaps#3, r8-test-suite-gaps#3 |
| `cli/server/src/features/config/router.test.ts` |  | 1 | 6 | r1-test-suite-gaps#0, r1-test-suite-gaps#3, r2-test-suite-gaps#5, r6-test-suite-gaps#1, r6-test-suite-gaps#2, r7-test-suite-gaps#0, r8-test-suite-gaps#4 |
| `cli/server/src/shared/lib/ai/client.ts` |  | 2 | 5 | r1-anti-slop-and-deadcode#1, r1-anti-slop-and-deadcode#3, r1-completeness-and-deferrals#3, r1-anti-slop-and-deadcode#2, r2-anti-slop-and-deadcode#3, r2-anti-slop-and-deadcode#4, r7-anti-slop-and-deadcode#0 |
| `libs/core/src/schemas/config/capabilities.ts` |  | 2 | 3 | r1-deep-logic-correctness#0, r5-anti-slop-and-deadcode#0, schemas-config#1, r1-completeness-and-deferrals#4, r5-anti-slop-and-deadcode#2 |
| `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx` |  | 1 | 3 | tui-consumers#0, tui-consumers#1, tui-consumers#4, tui-consumers#7 |
| `cli/server/src/shared/lib/ai/models-dev-catalog.test.ts` |  | 3 | 1 | r2-test-suite-gaps#1, r2-test-suite-gaps#2, r8-test-suite-gaps#1, r7-test-suite-gaps#1 |
| `scripts/monorepo/smoke-modelsdev.mjs` |  | 2 | 1 | r2-completeness-and-deferrals#1, r4-completeness-and-deferrals#0, r7-completeness-and-deferrals#1 |
| `cli/server/src/shared/lib/ai/disk-cache.ts` |  | 1 | 1 | r3-deep-logic-correctness#0, r3-anti-slop-and-deadcode#1 |
| `cli/server/src/shared/lib/ai/openrouter-models.ts` |  | 1 | 1 | r1-completeness-and-deferrals#2, server-cache#1 |
| `libs/core/src/providers/use-provider-models-mapped.test.ts` |  | 1 | 1 | xc-react#0, providers-runtime#3 |
| `libs/core/src/schemas/config/providers.ts` |  | 1 | 1 | xc-completeness-tasks#2, schemas-config#0 |
| `apps/web/src/features/onboarding/components/steps/model-step.tsx` |  | 1 |  | r3-completeness-and-deferrals#1 |
| `cli/diffgazer/src/features/onboarding/components/steps/model-step.test.tsx` |  | 1 |  | tui-consumers#2 |
| `libs/core/src/api/hooks/match-query-state.ts` |  | 1 |  | r4-deep-logic-correctness#0 |
| `libs/core/src/catalog/transform.test.ts` |  |  | 7 | xc-test-quality#1, r2-test-suite-gaps#3, r2-test-suite-gaps#4, r4-test-suite-gaps#0, r5-test-suite-gaps#4, r6-test-suite-gaps#3, r7-test-suite-gaps#2 |
| `libs/core/src/catalog/transform.ts` |  |  | 5 | r1-completeness-and-deferrals#1, r1-anti-slop-and-deadcode#0, r3-deep-logic-correctness#3, r4-deep-logic-correctness#2, r6-deep-logic-correctness#3 |
| `libs/core/src/api/hooks/use-provider-models.test.ts` |  |  | 3 | api-layer#0, api-layer#1, xc-test-quality#4 |
| `libs/core/src/catalog/capabilities.ts` |  |  | 3 | catalog-capabilities#1, r1-deep-logic-correctness#3, r7-anti-slop-and-deadcode#4 |
| `libs/core/src/catalog/schema.ts` |  |  | 3 | catalog-schema#1, r4-anti-slop-and-deadcode#0, r7-anti-slop-and-deadcode#3 |
| `scripts/monorepo/artifacts/smoke-modelsdev.mjs` |  |  | 3 | scripts-docs#0, scripts-docs#1, xc-completeness-tasks#3 |
| `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.tsx` |  |  | 2 | web-consumers#2, xc-react#1 |
| `apps/web/src/features/providers/components/provider-details.test.tsx` |  |  | 2 | web-consumers#1, xc-react#3 |
| `cli/server/src/features/config/router.ts` |  |  | 2 | server-route-client#2, r2-security-and-boundaries#0 |
| `cli/server/src/features/config/service.test.ts` |  |  | 2 | server-route-client#3, xc-completeness-tasks#5 |
| `libs/core/scripts/generate-catalog-snapshot.ts` |  |  | 2 | catalog-snapshot#2, r7-completeness-and-deferrals#0 |
| `libs/core/src/providers/models.ts` |  |  | 2 | providers-runtime#0, providers-runtime#1 |
| `libs/core/src/providers/use-provider-models-mapped.ts` |  |  | 2 | r1-deep-logic-correctness#2, r2-deep-logic-correctness#0 |
| `libs/core/src/schemas/config/catalog-errors.ts` |  |  | 2 | r2-anti-slop-and-deadcode#0, r4-anti-slop-and-deadcode#3 |
| `package.json` |  |  | 2 | catalog-snapshot#1, xc-completeness-design#0 |
| `cli/diffgazer/src/features/providers/components/model-select-overlay.tsx` |  |  | 1 | tui-consumers#3 |
| `cli/server/src/shared/lib/ai/openrouter-models.test.ts` |  |  | 1 | server-cache#0 |
| `libs/core/src/catalog/catalog-snapshot.test.ts` |  |  | 1 | catalog-snapshot#3 |
| `libs/core/src/catalog/format.ts` |  |  | 1 | r4-deep-logic-correctness#1 |
| `libs/core/src/catalog/index.test.ts` |  |  | 1 | r4-anti-slop-and-deadcode#2 |
| `libs/core/src/catalog/schema.test.ts` |  |  | 1 | catalog-schema#0 |
| `libs/core/src/providers/filter.ts` |  |  | 1 | r6-completeness-and-deferrals#0 |
| `libs/core/src/providers/models.test.ts` |  |  | 1 | providers-runtime#2 |
| `libs/core/src/schemas/config/models.ts` |  |  | 1 | r5-completeness-and-deferrals#1 |

## Appendix B — full finding index (sorted by severity)

| id | sev | category | location | title |
|---|---|---|---|---|
| `r3-test-suite-gaps#2` | high | test-quality | `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx:45-53` | OpenRouter compatibility-label branch (D4) is untested in both the web dialog and TUI overlay — every UI test feeds only non-OpenRouter providers |
| `r5-test-suite-gaps#1` | high | test-quality | `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx:102-193` | TUI overlay: saving spinner and activate-mutation-error states are entirely untested |
| `server-route-client#0` | high | completeness | `cli/server/src/features/config/service.ts:156-199` | Server-side activateProvider model validation (Task 13 / D5) never implemented despite GREEN claim |
| `xc-completeness-tasks#0` | high | completeness | `cli/server/src/features/config/service.ts:177-190` | Task 13 server-side activateProvider model validation never implemented (false GREEN in EXECUTE.md) |
| `xc-security#0` | high | completeness | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:90-118` | Live fetch that drops a single provider serves an empty picker and poisons the disk cache (shrink-guard bypass) |
| `r5-security-and-boundaries#0` | high | error-handling | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:110-114` | A disk-write failure when persisting a successful live catalog fetch discards the result and leaks the cache file path to the HTTP client |
| `r6-deep-logic-correctness#1` | high | completeness | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:94-95` | Fresh-cache path serves an empty picker tagged source='cache' when the cached catalog lacks the requested provider's source id, never falling back to the snapshot |
| `catalog-capabilities#0` | high | test-quality | `libs/core/src/catalog/capabilities.test.ts:43-47` | Headline regression test for structured_output:null does not actually assert the contract |
| `r2-completeness-and-deferrals#0` | high | completeness | `libs/core/src/catalog/provider-overlay.ts:1-133` | Entire catalog pure layer (schema/overlay/transform/capabilities/snapshot) and catalog-errors.ts are untracked in git, while the in-scope edited files import them |
| `r3-completeness-and-deferrals#1` | medium | completeness | `apps/web/src/features/onboarding/components/steps/model-step.tsx:136-172` | Web onboarding CatalogModelList has no empty-state branch — a zero-model catalog response renders a dead, selectionless picker |
| `r1-test-suite-gaps#1` | medium | test-quality | `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx:57-85` | Web model-select-dialog integration test omits loading, error, and empty-state coverage |
| `r5-test-suite-gaps#0` | medium | test-quality | `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx:49` | Web dialog passes currentModel but never asserts the pre-checked radio (initial selection state untested) |
| `tui-consumers#2` | medium | test-quality | `cli/diffgazer/src/features/onboarding/components/steps/model-step.test.tsx:74-88` | TUI ModelStep/Overlay tests omit error-fallback and empty-state coverage that the resilience design relies on |
| `tui-consumers#0` | medium | DRY | `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx:60-109` | TUI ModelStep consumes catalog via raw query + guardQueryState while every sibling consumer uses the mapped hook |
| `r2-test-suite-gaps#0` | medium | test-quality | `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx:107-192` | No test exercises model selection — the central user behavior — in either the web dialog or the TUI overlay |
| `r5-test-suite-gaps#2` | medium | test-quality | `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx:108-117` | TUI overlay never feeds selectedId, leaving the current-model marker (isSelected) unverified |
| `r1-test-suite-gaps#0` | medium | test-quality | `cli/server/src/features/config/router.test.ts:32-88` | Router test never exercises the PROVIDER_DISABLED -> 404 HTTP contract |
| `r1-completeness-and-deferrals#0` | medium | completeness | `cli/server/src/features/config/service.ts:251-267` | D4 OpenRouter boundary is enforced only in client hooks, not in the server service that owns it |
| `r1-security-and-boundaries#1` | medium | security | `cli/server/src/features/config/service.ts:177-190` | activateProvider model-validation block is a vacuous control that accepts any non-empty model id for any provider |
| `r5-deep-logic-correctness#0` | medium | dead-code | `cli/server/src/features/config/service.ts:254-257` | Router pre-validates provider id, making the service-layer AIProviderSchema re-parse and its VALIDATION_ERROR/400 mapping unreachable |
| `r6-security-and-boundaries#0` | medium | security | `cli/server/src/features/config/service.ts:172-175` | activateProvider's 'API key required' guard is bypassed when the secret read errors (fails open) |
| `r1-anti-slop-and-deadcode#1` | medium | DRY | `cli/server/src/shared/lib/ai/client.ts:86,93` | zhipu `baseURL` hardcoded in client.ts duplicates the overlay value that exists precisely to be the single source of truth |
| `r1-anti-slop-and-deadcode#3` | medium | DRY | `cli/server/src/shared/lib/ai/client.ts:158-167,190-199` | Identical 10-line abort-signal construction block duplicated across `generate` and `generateStream` |
| `r3-deep-logic-correctness#0` | medium ⚠ | error-handling | `cli/server/src/shared/lib/ai/disk-cache.ts:49-64` | withTtlAndFallback fetch-failure fallback ignores isCacheUsable, serving a cache the predicate already rejected |
| `r2-test-suite-gaps#1` | medium | test-quality | `cli/server/src/shared/lib/ai/models-dev-catalog.test.ts:113-118` | "shrink-guarded fetch falls back to snapshot" test never actually triggers the shrink-guard |
| `r2-test-suite-gaps#2` | medium | test-quality | `cli/server/src/shared/lib/ai/models-dev-catalog.test.ts:80-87` | "live success persists the cache" only checks the file exists, never that the persisted content is valid / round-trips |
| `r8-test-suite-gaps#1` | medium | test-quality | `cli/server/src/shared/lib/ai/models-dev-catalog.test.ts:137-142` | "never returns an empty model list" omits two enabled providers (zai-coding, openrouter) despite asserting an every-enabled-provider contract |
| `xc-completeness-design#1` | medium | completeness | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:90-118` | models.dev cache path bypasses the shared withTtlAndFallback helper D6 mandated unifying onto |
| `xc-dry-arch#0` | medium | DRY | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:90-118` | models-dev catalog reimplements the cache-resolution flow inline instead of the shared withTtlAndFallback helper (D6 violation) |
| `xc-dry-arch#2` | medium | DRY | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:67-72` | ProviderModelsResult interface duplicates the Zod-derived ProviderModelsResponse contract |
| `r3-deep-logic-correctness#1` | medium | performance | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:90-96` | Fresh models.dev cache path re-reads and full-Zod-revalidates the entire ~2MB multi-provider catalog synchronously on every request |
| `r3-deep-logic-correctness#2` | medium | error-handling | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:55-64` | Shrink-guard counts only post-parse survivors, so a partially-corrupt upstream payload passes the guard and poisons/ratchets the cache |
| `r8-deep-logic-correctness#0` | medium | error-handling | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:92-118` | Corrupt or schema-invalid disk cache silently disables the shrink-guard baseline (degrades to first-run, accepts a degenerate live fetch) |
| `r1-completeness-and-deferrals#2` | medium | DRY | `cli/server/src/shared/lib/ai/openrouter-models.ts:124-126` | getOpenRouterModelsWithCache re-reads and re-parses the disk cache and re-derives freshness solely to drive log branches |
| `r4-deep-logic-correctness#0` | medium | patterns | `libs/core/src/api/hooks/match-query-state.ts:29-39` | guardQueryState renders a permanent fake loading spinner for a disabled (idle) query — TUI ModelStep shows "Loading models..." forever when focus is on nav |
| `r3-test-suite-gaps#0` | medium | test-quality | `libs/core/src/catalog/capabilities.test.ts:8-48` | deriveCapabilities is never tested for groq or cerebras — the freeTier:'all' tier path and freeTierNote costDescription branch are uncovered |
| `catalog-overlay#1` | medium | DRY | `libs/core/src/catalog/provider-overlay.ts:53,63` | zai/zai-coding `baseURL` duplicated: overlay value ignored by the zhipu SDK branch |
| `xc-react#0` | medium | test-quality | `libs/core/src/providers/use-provider-models-mapped.test.ts:9-13` | Hook test mocks an internal module instead of the API boundary |
| `r1-deep-logic-correctness#0` | medium | completeness | `libs/core/src/schemas/config/capabilities.ts:45-50` | Provider capabilities never derive from live/cached models.dev data — frozen to the bundled snapshot |
| `r5-anti-slop-and-deadcode#0` | medium | dead-code | `libs/core/src/schemas/config/capabilities.ts:36-43` | ProviderInfo.models is permanently-empty vestigial data, leaving dead UI branches after the catalog migration |
| `xc-completeness-tasks#2` | medium | completeness | `libs/core/src/schemas/config/providers.ts:31-38` | providers.ts comment promises activateProvider catalog validation that does not exist |
| `r2-completeness-and-deferrals#1` | medium | completeness | `scripts/monorepo/smoke-modelsdev.mjs:9,19-26` | Never-blank-picker smoke validates only 3 of the 6 enabled providers; zai and zai-coding are silently omitted despite the function's own 'every enabled provider' contract |
| `r4-completeness-and-deferrals#0` | medium | completeness | `scripts/monorepo/smoke-modelsdev.mjs:11-26` | Snapshot-bundling verification (design's tsup-inlining anti-regression test) was never realized |
| `r7-test-suite-gaps#3` | low | test-quality | `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx:71-84` | Web dialog free-filter test relies on bare 'f' keypress with no element focused, coupling the test to global keyboard wiring rather than an accessible filter control |
| `r8-test-suite-gaps#3` | low | test-quality | `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx:58-69` | Neither UI test asserts the paid tier badge renders — only the free badge is verified |
| `web-consumers#2` | low | KISS | `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.tsx:116` | getCompatibilityLabel computed unconditionally for non-OpenRouter providers |
| `xc-react#1` | low | DRY | `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.tsx:37-52` | getCompatibilityLabel duplicated across web and CLI with no shared source |
| `web-consumers#1` | low ⚠ | test-quality | `apps/web/src/features/providers/components/provider-details.test.tsx:25-52` | Test does not cover the spec's graceful-unknown capabilities path |
| `xc-react#3` | low | type-safety | `apps/web/src/features/providers/components/provider-details.test.tsx:14-23` | provider-details test uses an `as` cast that bypasses prop-type completeness |
| `tui-consumers#1` | low | patterns | `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx:60-61` | Catalog query gated on isActive but OpenRouter query is not — inconsistent fetch behavior within the same component |
| `tui-consumers#4` | low | naming | `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx:69,92` | Loading label ellipsis style differs between overlay (U+2026) and onboarding step (ASCII '...') |
| `tui-consumers#7` | low | KISS | `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx:44-50` | getSubtitle special-cases 'openrouter' although the caller already branches on isOpenRouter |
| `tui-consumers#5` | low | test-quality | `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx:51-86` | Duplicated async-flush and provider test scaffolding across the two TUI slice test files |
| `tui-consumers#6` | low | anti-slop | `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx:163-177` | Overlay navigation test comments narrate the internal setHighlightIndex formula |
| `xc-test-quality#2` | low | test-quality | `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx:107-177` | Test name and inline comments narrate internal hook state instead of behavior |
| `r8-test-suite-gaps#2` | low | test-quality | `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx:17-43` | TUI overlay description truncation (the only branching logic in ModelListItem) is never exercised by any test |
| `tui-consumers#3` | low | dead-code | `cli/diffgazer/src/features/providers/components/model-select-overlay.tsx:90` | ModelSelectOverlay return type declares `\| null` but the component never returns null |
| `r1-test-suite-gaps#3` | low | test-quality | `cli/server/src/features/config/router.test.ts:34-41` | Router live-path fetch mock omits status, diverging from the suite's own Response shape |
| `r2-test-suite-gaps#5` | low | test-quality | `cli/server/src/features/config/router.test.ts:53-61` | Router test asserts cached:false on the live path but never asserts cached/source on the snapshot fallback, leaving the cached flag's snapshot value unpinned |
| `r6-test-suite-gaps#1` | low | test-quality | `cli/server/src/features/config/router.test.ts:46-50` | router.test.ts never asserts free-first ordering on the HTTP boundary despite ordering being a headline route contract |
| `r6-test-suite-gaps#2` | low | test-quality | `cli/server/src/features/config/router.test.ts:33-51` | recommended flag (part of the ModelInfo contract) is verified only at the pure transform layer, never across the server/route boundary it is plumbed through |
| `r7-test-suite-gaps#0` | low | test-quality | `cli/server/src/features/config/router.test.ts:71-77` | Rate-limit route test asserts only the final 429, never that any request before the window succeeds with 200 |
| `r8-test-suite-gaps#4` | low | test-quality | `cli/server/src/features/config/router.test.ts:71-77` | Rate-limit test hardcodes the bucket size as a bare loop bound, duplicating the source's maxRequests:30 with no shared constant |
| `server-route-client#2` | low | error-handling | `cli/server/src/features/config/router.ts:80-85` | errorResponse silently buckets every non-VALIDATION/non-DISABLED catalog error into 500 including code-less paths |
| `r2-security-and-boundaries#0` | low | security | `cli/server/src/features/config/router.ts:27,64,75` | New /provider/:id/models route shares one global rate-limit bucket with the OpenRouter route |
| `server-route-client#3` | low | test-quality | `cli/server/src/features/config/service.test.ts:401-417` | PROVIDER_DISABLED service test mutates an imported module's live export in place |
| `xc-completeness-tasks#5` | low | test-quality | `cli/server/src/features/config/service.test.ts:402-417` | Disabled-provider test mutates the shared imported PROVIDER_OVERLAY singleton |
| `xc-security#1` | low | completeness | `cli/server/src/features/config/service.ts:251-267` | Outgoing /provider/:id/models payload is not Zod-validated at runtime despite design contract 'slim Zod-validated' |
| `r3-security-and-boundaries#0` | low | dead-code | `cli/server/src/features/config/service.ts:259-261` | PROVIDER_DISABLED guard and its 404 mapping are unreachable by construction |
| `r3-security-and-boundaries#2` | low | type-safety | `cli/server/src/features/config/service.ts:262-263` | Server returns catalog model payload to the client without re-validating against ProviderModelsResponseSchema |
| `r4-security-and-boundaries#0` | low | security | `cli/server/src/features/config/service.ts:94-121` | env-credential varName is validated against the global allowlist but not bound to the provider it is saved for (cross-provider credential binding) |
| `r1-completeness-and-deferrals#3` | low | error-handling | `cli/server/src/shared/lib/ai/client.ts:76-103` | createLanguageModel falls back to an empty-string model id for OpenRouter when no model is supplied |
| `r1-anti-slop-and-deadcode#2` | low | anti-slop | `cli/server/src/shared/lib/ai/client.ts:53-56,99-102,118` | AI-voice / drift-narration comments restate SDK-version-drift handling three times in client.ts |
| `r2-anti-slop-and-deadcode#3` | low | YAGNI | `cli/server/src/shared/lib/ai/client.ts:21-23` | Eager module-load full `Record<AIProvider,string>` built only to do single-key lookups |
| `r2-anti-slop-and-deadcode#4` | low | type-safety | `cli/server/src/shared/lib/ai/client.ts:75-119` | Inner `model` const shadows the destructured `config.model`, with two separate `as Parameters<...>` casts per branch |
| `r7-anti-slop-and-deadcode#0` | low | anti-slop | `cli/server/src/shared/lib/ai/client.ts:139-141` | Defensive `if (!config.provider)` guard on a non-nullable required enum field in createAIClient |
| `r3-anti-slop-and-deadcode#1` | low ⚠ | dead-code | `cli/server/src/shared/lib/ai/disk-cache.ts:25-40` | WithTtlAndFallbackOptions and DiskCacheResolution are exported but consumed only inside disk-cache.ts |
| `r7-test-suite-gaps#1` | low | test-quality | `cli/server/src/shared/lib/ai/models-dev-catalog.test.ts:144-147` | "returns a valid ISO fetchedAt" test uses Date.parse, which does not pin the ISO-8601/datetime contract the response schema declares |
| `server-cache#2` | low | DRY | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:74-77` | isCacheFresh duplicates the private isFresh helper in disk-cache.ts |
| `xc-dry-arch#1` | low | DRY | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:74-77` | Local isCacheFresh duplicates disk-cache's isFresh predicate |
| `r1-deep-logic-correctness#4` | low | type-safety | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:20-23` | Disk-cache fetchedAt typed z.string() but the response contract demands z.string().datetime() |
| `r1-security-and-boundaries#2` | low | security | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:42-62` | models.dev fetch guards against a too-small payload but never caps the size of the buffered response |
| `r3-deep-logic-correctness#4` | low | patterns | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:94-101` | DIFFGAZER_OFFLINE serves a stale-beyond-TTL cache tagged source='cache', indistinguishable from a fresh hit |
| `r3-anti-slop-and-deadcode#2` | low | dead-code | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:24` | ModelsDevCatalogCache type alias exported but only used as an in-file function parameter |
| `r6-deep-logic-correctness#0` | low | error-handling | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:74-77` | isCacheFresh treats any future-dated fetchedAt as permanently fresh (no upper bound) |
| `r6-anti-slop-and-deadcode#2` | low | dead-code | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:37-65` | `fetchModelsDevCatalog` exported despite having zero production consumers — test-only export widening |
| `r6-anti-slop-and-deadcode#3` | low | dead-code | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:20-24` | `ModelsDevCatalogCacheSchema` named export is consumed only by its own test; production uses it purely in-file |
| `r7-security-and-boundaries#0` | low | security | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:42` | models.dev fetch transparently follows cross-host redirects, then parses and persists the redirected body to a global on-disk cache |
| `r8-anti-slop-and-deadcode#1` | low | YAGNI | `cli/server/src/shared/lib/ai/models-dev-catalog.ts:79-117` | toResult threads a `cached` boolean that is always derivable from `source` |
| `server-cache#0` | low | completeness | `cli/server/src/shared/lib/ai/openrouter-models.test.ts:11-13,61-72` | OpenRouter test changed (persistOpenRouterModelCache removed) despite spec mandating it stay unchanged |
| `server-cache#1` | low | patterns | `cli/server/src/shared/lib/ai/openrouter-models.ts:144-157` | OpenRouter info-log message can change for fresh-but-unusable cache + fetch-fail path |
| `catalog-snapshot#2` | low | patterns | `libs/core/scripts/generate-catalog-snapshot.ts:17-28` | Generator emits source-order keys with no sort, making the committed artifact's diffs non-deterministic across captures |
| `r7-completeness-and-deferrals#0` | low | completeness | `libs/core/scripts/generate-catalog-snapshot.ts:18-21` | D6 snapshot generator never trims to "used fields" — bundles modalities/knowledge/cache_read/cache_write that no consumer reads |
| `api-layer#0` | low | test-quality | `libs/core/src/api/hooks/use-provider-models.test.ts:42-43` | Redundant assertion: toHaveBeenCalledWith duplicates the observable-data check |
| `api-layer#1` | low | test-quality | `libs/core/src/api/hooks/use-provider-models.test.ts:58-59` | Redundant assertion in rerender test mirrors line 42 |
| `xc-test-quality#4` | low ⚠ | test-quality | `libs/core/src/api/hooks/use-provider-models.test.ts:46-60` | useProviderModels tests largely re-verify TanStack Query framework guarantees |
| `catalog-capabilities#2` | low | test-quality | `libs/core/src/catalog/capabilities.test.ts:28-35` | resolveTier free-only and paid-only branches are untested |
| `r3-test-suite-gaps#3` | low | test-quality | `libs/core/src/catalog/capabilities.test.ts:23-26` | formatContext 'Varies by model' branch (maxContext <= 0) is uncovered |
| `r4-test-suite-gaps#2` | low | test-quality | `libs/core/src/catalog/capabilities.test.ts:9-21` | deriveCapabilities costDescription paid-only branch (zai-coding) is never asserted |
| `r4-test-suite-gaps#3` | low | test-quality | `libs/core/src/catalog/capabilities.test.ts:37-47` | jsonMode string branches in deriveCapabilities are untested despite differing on anyStructured |
| `catalog-capabilities#1` | low | DRY | `libs/core/src/catalog/capabilities.ts:38` | deriveCapabilities re-implements model gathering instead of reusing mergeModelsAcrossSources |
| `r1-deep-logic-correctness#3` | low | patterns | `libs/core/src/catalog/capabilities.ts:23-34` | resolveTier returns 'paid' for a provider with zero catalog models, contradicting its FREE tierBadge |
| `r7-anti-slop-and-deadcode#4` | low | anti-slop | `libs/core/src/catalog/capabilities.ts:47-49` | Inline comment in deriveCapabilities narrates the JSON push instead of stating intent |
| `catalog-snapshot#3` | low | test-quality | `libs/core/src/catalog/catalog-snapshot.test.ts:15-17` | Snapshot test comment claims openrouter "may be empty by design" while the bundled snapshot is full |
| `r4-deep-logic-correctness#1` | low | patterns | `libs/core/src/catalog/format.ts:6-12` | formatContextTokens renders contexts in [950000, 999999] as "1000K" instead of "1M" (hard 1,000,000 boundary collides with K-rounding) |
| `r4-anti-slop-and-deadcode#2` | low ⚠ | test-quality | `libs/core/src/catalog/index.test.ts:4-16` | Catalog barrel `index.test.ts` tests re-export wiring, not behavior |
| `catalog-overlay#0` | low | dead-code | `libs/core/src/catalog/provider-overlay.ts:25` | `sdkKind` overlay field has no runtime consumer — it is dead curated data |
| `xc-security#2` | low | type-safety | `libs/core/src/catalog/provider-overlay.ts:28` | resolveProviderDisplayName uses a non-null assertion on array indexing instead of validated access |
| `r2-anti-slop-and-deadcode#1` | low | dead-code | `libs/core/src/catalog/provider-overlay.ts:4` | `FreeTierSelector` exported from provider-overlay but consumed only inside its own module |
| `r5-anti-slop-and-deadcode#1` | low | dead-code | `libs/core/src/catalog/provider-overlay.ts:105-132` | SURFACED_OVERLAYS entries carry the full ProviderOverlay shape but only `modelsDevIds` is read in production — the rest is dead curated data |
| `catalog-schema#0` | low | test-quality | `libs/core/src/catalog/schema.test.ts:43` | Test file uses unsafe `as Record<string, unknown>` cast to assert a dropped field is undefined |
| `catalog-schema#1` | low | test-quality | `libs/core/src/catalog/schema.ts:51-53` | JSDoc claims provider-level skip behavior that no test exercises |
| `r4-anti-slop-and-deadcode#0` | low ⚠ | dead-code | `libs/core/src/catalog/schema.ts:43` | `ModelsDevProvider` type is exported but never imported — dead type export |
| `r7-anti-slop-and-deadcode#3` | low ⚠ | anti-slop | `libs/core/src/catalog/schema.ts:48-53` | JSDoc on parseModelsDevCatalog narrates the control flow it sits above |
| `xc-test-quality#1` | low | test-quality | `libs/core/src/catalog/transform.test.ts:117-126` | Redundant single-source merge test is a wiring tautology, not a distinct behavior |
| `r2-test-suite-gaps#3` | low | test-quality | `libs/core/src/catalog/transform.test.ts:29-53` | freeTier family-selector branch of the free-tier resolver is entirely untested |
| `r2-test-suite-gaps#4` | low | test-quality | `libs/core/src/catalog/transform.test.ts:55-69` | describeModel low-context branch (context < 1000, returns bare name) is uncovered |
| `r4-test-suite-gaps#0` | low | test-quality | `libs/core/src/catalog/transform.test.ts:55-83` | catalogToModelInfo never asserts an unknown-priced model renders as ModelInfo.tier 'paid' |
| `r5-test-suite-gaps#4` | low | test-quality | `libs/core/src/catalog/transform.test.ts:62-65` | describeModel high-context branch only pins '1M context'; the K-formatted (1000–<1M) context branch is uncovered |
| `r6-test-suite-gaps#3` | low | test-quality | `libs/core/src/catalog/transform.test.ts:55-69` | describeModel name-fallback branch (model with no name, returns bare id) is untested |
| `r7-test-suite-gaps#2` | low | test-quality | `libs/core/src/catalog/transform.test.ts:85-115` | merge-by-id freshness tie-break never exercises the release_date fallback — every fixture model carries last_updated |
| `r1-completeness-and-deferrals#1` | low | dead-code | `libs/core/src/catalog/transform.ts:6-12` | pricingTierOf / PricingTier exported as public catalog API with no production consumer (D2 per-model price badge never built) |
| `r1-anti-slop-and-deadcode#0` | low | dead-code | `libs/core/src/catalog/transform.ts:9-12` | `pricingTierOf` is exported but has zero non-test production consumers — its only real caller is in-file |
| `r3-deep-logic-correctness#3` | low | patterns | `libs/core/src/catalog/transform.ts:100-102` | Free-first ordering relies on locale-sensitive localeCompare, undermining the 'deterministic' / pinned-order guarantee across environments |
| `r4-deep-logic-correctness#2` | low | patterns | `libs/core/src/catalog/transform.ts:37-40, 77` | Freshest-date merge tie-break compares last_updated of one model against release_date of another, so a model with only a release_date can outrank a model carrying a real last_updated |
| `r6-deep-logic-correctness#3` | low ⚠ | patterns | `libs/core/src/catalog/transform.ts:75-80` | Merge-by-id keys on the inner model.id field while the catalog record keys models by their map key, silently collapsing distinct map entries that share an inner id |
| `r6-completeness-and-deferrals#0` | low | completeness | `libs/core/src/providers/filter.ts:26-33` | Provider free/paid filter keys off derived per-model tier (with new 'mixed') instead of the curated hasFreeTier that design D2 locks |
| `providers-runtime#2` | low | test-quality | `libs/core/src/providers/models.test.ts:78-108` | buildModels test asserts behavior of a dead function, giving false coverage confidence |
| `providers-runtime#0` | low ⚠ | dead-code | `libs/core/src/providers/models.ts:7-15` | buildModels is dead code — zero production consumers after the migration |
| `providers-runtime#1` | low | DRY | `libs/core/src/providers/models.ts:13` | buildModels OpenRouter branch duplicates mapOpenRouterModels but omits the compatibility filtering the real path applies |
| `providers-runtime#3` | low | test-quality | `libs/core/src/providers/use-provider-models-mapped.test.ts:63-70` | Hook test asserts useProviderModels call arguments — testing wiring, not observable behavior |
| `r1-deep-logic-correctness#2` | low | error-handling | `libs/core/src/providers/use-provider-models-mapped.ts:30-34` | useProviderModelsMapped discards still-valid data on a transient background-refetch error |
| `r2-deep-logic-correctness#0` | low | dead-code | `libs/core/src/providers/use-provider-models-mapped.ts:9-34` | `source` and `fetchedAt` resilience metadata is plumbed end-to-end but read by no consumer (dead plumbing) |
| `schemas-config#1` | low | DRY | `libs/core/src/schemas/config/capabilities.ts:32-50` | PROVIDER_CAPABILITIES iterates all overlay keys while AVAILABLE_PROVIDERS filters enabled — latent divergence |
| `r1-completeness-and-deferrals#4` | low | anti-slop | `libs/core/src/schemas/config/capabilities.ts:12-29` | humanize JSDoc example cites 'github-models', an id the enum-keyed resolver can never receive |
| `r5-anti-slop-and-deadcode#2` | low | DRY | `libs/core/src/schemas/config/capabilities.ts:10` | Magic string "openrouter" used in several callers despite the OPENROUTER_PROVIDER_ID constant existing to be the single source |
| `r2-anti-slop-and-deadcode#0` | low | dead-code | `libs/core/src/schemas/config/catalog-errors.ts:14` | `CatalogError` type alias is exported but never imported — dead export |
| `r4-anti-slop-and-deadcode#3` | low | dead-code | `libs/core/src/schemas/config/catalog-errors.ts:10` | `CATALOG_ERROR_CODES` runtime export is consumed only to derive its own type |
| `r5-completeness-and-deferrals#1` | low | completeness | `libs/core/src/schemas/config/models.ts:43-48` | ProviderModelsResponse carries a `cached` boolean that is structurally redundant with `source` and read by no consumer |
| `schemas-config#0` | low | YAGNI | `libs/core/src/schemas/config/providers.ts:36-49` | Relaxed isValidModelForProvider keeps a now-dead provider parameter and one-call indirection |
| `catalog-snapshot#1` | low | completeness | `package.json:27-28` | prepare:artifacts does not regenerate the committed snapshot (carried P5 LOW unresolved) |
| `xc-completeness-design#0` | low | completeness | `package.json:27-28` | D6 snapshot regeneration is not wired into prepare:artifacts (manual-only) |
| `scripts-docs#0` | low | error-handling | `scripts/monorepo/artifacts/smoke-modelsdev.mjs:11-13` | assertCatalogProviders hardcodes "live models.dev catalog:" prefix in the throw, ignoring the injected source |
| `scripts-docs#1` | low | anti-slop | `scripts/monorepo/artifacts/smoke-modelsdev.mjs:1-7` | JSDoc on assertCatalogProviders restates the code and asserts a symmetry the code does not honor |
| `xc-completeness-tasks#3` | low | completeness | `scripts/monorepo/artifacts/smoke-modelsdev.mjs:11-12` | Smoke assertCatalogProviders hardcodes 'live models.dev catalog' prefix on the snapshot path despite an injected source |
| `r7-completeness-and-deferrals#1` | low | completeness | `scripts/monorepo/smoke-modelsdev.mjs:9` | Smoke ENABLED_PROVIDERS is a hardcoded literal that has drifted from the overlay-derived enabled roster (single-source-of-truth gap) |

## Appendix C — methodology & provenance

- **Workflow:** 19 Opus finders (13 per-slice + 6 cross-cutting: completeness-vs-design D1–D6, completeness-vs-tasks, DRY+architecture-boundaries, security, test-quality, React) → adversarial per-file verification (false positives refuted/dropped) → completeness-critic loop (5 dimensions × up to 8 rounds, each round fed the accumulated findings to avoid re-reporting) → synthesis.
- **Convergence:** Round 1: 67 candidates → 54 confirmed. Critic rounds 1–8 added 18/14/13/11/10/10/10/6 confirmed. The loop ran the full 8-round cap WITHOUT hitting two consecutive dry rounds — i.e. each round still surfaced new (verified) issues. Most late additions are low-severity polish; the high/medium set stabilized early.
- **Every agent** ran as a read-only `Explore` subagent (Skill tool available, no Edit/Write) and was required to load `code-audit`, `anti-slop`, `clean-code`, `code-quality`, `test-behavior-not-implementation` (+ `sota` / `react-*` where relevant) before auditing.
- **Lenses:** `code-audit` (15 categories), `anti-slop` (7 categories), `code-quality` (DRY/KISS/YAGNI/SRP), `test-behavior-not-implementation`, `clean-code`, `sota`.
- **9 UNCERTAIN findings** are kept (not refuted) and flagged inline (⚠) — confirm with human judgment before acting.
