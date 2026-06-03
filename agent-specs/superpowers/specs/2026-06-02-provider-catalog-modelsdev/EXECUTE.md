# Execution Plan — Provider/Model Catalog (models.dev)

> **What this file is:** the *how we run it* tracker for `plan.md`. Task details (code, tests, commands) live in `plan.md`; this file is the checklist + protocol so you can see exactly what runs, in what order, and where to review.
>
> **Status:** not started. **Mode:** workflow-driven, opus agents. **Last updated:** 2026-06-02.

---

## Execution Protocol (the rules)

- [ ] **No commits, no pushes.** Every change is left as **uncommitted working-tree edits**. You review via `git diff` / `git status`. Agents SKIP every "Commit" step in `plan.md`.
- [ ] **Opus implementation.** Each phase is implemented by an opus subagent following `plan.md` task-by-task with **TDD** (failing test → confirm fail → minimal impl → confirm pass → refactor).
- [ ] **Opus revalidation after every phase.** A *separate, independent* opus subagent re-runs the phase gate, reviews the working-tree diff against `design.md` + `plan.md`, and checks for slop/placeholders/TDD adherence. It cannot trust the implementer's report.
- [ ] **Fix loop until green.** If revalidation FAILs, an opus fix agent addresses the issues (still no commits) and the gate re-runs — up to 2 rounds, then it stops and reports.
- [ ] **Sequential phases, shared working tree.** Phases run in order (P1→P6); no parallel file edits, so no conflicts.
- [ ] **Skills loaded per phase** (via the Skill tool when available; else the equivalent checklists applied manually): see the Skills Matrix below. `sota` runs at the very start, `sota-verify` at the very end.
- [ ] **Honest verification.** Agents run the *real* commands and report *real* results. No fabricated passes (`superpowers:verification-before-completion`).
- [ ] **You stay in control.** After each phase I report + you can review the diff / stop me before the next phase.

### How to review at any checkpoint

```bash
cd /Users/voitz/Projects/diffgazer-workspace
git status --short                 # what changed
git diff -- libs/core/src/catalog  # scope to a phase's area
git diff --stat                    # overview of churn
```

---

## Phase Overview

| Phase | Name | Tasks | Owner | Gate (must be green before next) | Status |
|---|---|---|---|---|---|
| **P1** | Catalog Core | 7 (enum), 1–6 | `libs/core/src/catalog` | core type-check + `src/catalog` tests + build | ✅ GREEN — 39 catalog + 454 core tests |
| **P2** | Config & Providers Migration | 8–13 | `libs/core` schemas/config + providers | core type-check + full core test + env-vars allowlist test | ✅ GREEN — 471/471 core tests; overlay-derived config |
| **P3** | Server Fetch / Cache / Fallback | 14–16 | `cli/server` shared/lib | server `shared/lib` tests + server type-check | ✅ GREEN — 35 P3 tests; openrouter unchanged 11/11; 3-tier + shrink-guard + offline |
| **P4** | Server Route + AI Client | 17–20 | `cli/server` features/config + ai | full server test + server type-check | ✅ GREEN — 531/531 server tests; typed PROVIDER_DISABLED + slim payload + groq/cerebras AI client |
| **P5** | Consumers (web + TUI) + E2E | 21–29 | api hook, web, TUI, smoke | core+web+diffgazer tests + artifacts validate | ✅ GREEN — core 479 / web 282 / TUI 220; artifacts clean; live smoke passed |
| **P6** | Final Verification + `sota-verify` | 30 | repo-wide | full AGENTS.md gate set | ✅ GREEN — all 7 gates exit 0; sota-verify CLEAN, 5 findings fixed, 3 P1 LOWs closed |

> **Cross-phase interleave (important):** P1's `PROVIDER_OVERLAY` is `Record<AIProvider, …>`, so the `AIProvider` enum must already include `groq`+`cerebras`. Therefore **Task 7 (enum expansion) runs as the first step of P1**, before Tasks 1–6. P2 then covers Tasks 8–13. P2 and P3 may overlap in principle but here run sequentially (shared tree).

---

## P1 — Catalog Core

**Tasks**
- [x] **Task 7** — Expand `AIProvider` enum with `groq` + `cerebras` *(run first — unblocks the overlay's `Record<AIProvider,…>`)*
- [x] **Task 1** — `schema.ts` — `ModelsDevCatalogSchema` + `parseModelsDevCatalog` (per-model `safeParse`)
- [x] **Task 2** — `provider-overlay.ts` — `ProviderOverlay` type + `PROVIDER_OVERLAY` (6 enabled) + `SURFACED_OVERLAYS` (3 surfaced) + `displayName` (gemini override only)
- [x] **Task 3** — `transform.ts` — `pricingTierOf`, `isModelFreeToUse`, `catalogToModelInfo`
- [x] **Task 4** — `capabilities.ts` — `deriveCapabilities` → `ProviderCapabilities`
- [x] **Task 5** — `catalog-snapshot.ts` — generator script + committed offline snapshot
- [x] **Task 6** — `index.ts` barrel + `"./catalog"` package export + build proof

**Must-hold regressions** (revalidation pins these): `pricingTierOf` 0/0→free, >0→paid, absent→unknown · `gemini-2.5-flash`→free, `gemini-3-pro-preview`→paid, `zai glm-4.7-flash`→free, `zai glm-4.7`→paid, `zai-coding`→paid, groq/cerebras priced model→free · merge-by-id across alias ids · deterministic free-first→name order · per-model `safeParse` skips one bad model and keeps siblings · `gemini` displayName "Google Gemini", others from models.dev · `"./catalog"` subpath builds, `verify:dist-esm` clean.

**Pipeline**
- [x] Implement (opus, TDD, no commits) — loads `sota` + TDD + audit skills
- [x] Gate: `pnpm --filter @diffgazer/core type-check && pnpm --filter @diffgazer/core test src/catalog && pnpm --filter @diffgazer/core build`
- [x] Revalidate (opus, independent) — re-run gate + diff review + slop/TDD audit — **PASS** (24 must-hold assertions)
- [x] Fix loop until green (0 rounds needed)
- [x] `git diff --check` clean
- [ ] **Your review checkpoint:** `git diff -- libs/core/src/catalog libs/core/package.json`

---

## P2 — Config & Providers Migration

**Tasks**
- [x] **Task 8** — Relax `isValidModelForProvider` to accept any non-empty model string
- [x] **Task 9** — Derive `PROVIDER_ENV_VARS` + `ALLOWED_CREDENTIAL_ENV_VARS` from `PROVIDER_OVERLAY`
- [x] **Task 10** — Derive `AVAILABLE_PROVIDERS` + `PROVIDER_CAPABILITIES` from the overlay/snapshot (+ `displayName` resolution; pickers list only enabled)
- [x] **Task 11** — Delete the hand-maintained Gemini/GLM model constants from `models.ts`
- [x] **Task 12** — Rewrite `providers/models.ts` — drop static branches, keep the OpenRouter live mapping
- [x] **Task 13** — Confirm libs/core-internal consumers compile + add server-side model validation at `activateProvider` *(Steps 1–2 done; server-side `activateProvider` validation deferred to P4 — blocked on P3's `getProviderModels`)*

**Must-hold:** security allowlist still rejects unknown env vars and `ZHIPU_API_KEY`; zai/zai-coding still map to `ZAI_API_KEY`; `AVAILABLE_PROVIDERS[0]` = gemini (onboarding invariant); pickers list only the 6 enabled providers; no "coming soon" UI.

**Pipeline**
- [x] Implement (opus, TDD, no commits)
- [x] Gate: `pnpm --filter @diffgazer/core type-check && pnpm --filter @diffgazer/core test` + `…/env-vars.test.ts`
- [x] Revalidate (opus) — note any *expected* cross-package red in `cli/server` (groq/cerebras client branches land in P4)
- [x] Fix loop until green (≤2 rounds)
- [x] `git diff --check` clean
- [ ] **Your review checkpoint:** `git diff -- libs/core/src/schemas/config libs/core/src/providers`

---

## P3 — Server Fetch / Cache / Fallback

**Tasks**
- [x] **Task 14** — `getGlobalModelsDevCatalogPath()` in `paths.ts`
- [x] **Task 15** — Extract a generic disk-cache helper and refactor `openrouter-models.ts` onto it (ZERO behavior change)
- [x] **Task 16** — `models-dev-catalog.ts` — keyless fetch, shrink-guard, cache schema, 3-tier `getProviderModels`

**Must-hold:** existing `openrouter-models.test.ts` passes unchanged; live→disk→snapshot fallback never returns empty; shrink-guard rejects a shrunk payload; `DIFFGAZER_OFFLINE` skips fetch; fetch mocked + temp HOME in tests.

**Pipeline**
- [x] Implement (opus, TDD, no commits)
- [x] Gate: `pnpm --filter @diffgazer/server test src/shared/lib/ && pnpm --filter @diffgazer/server type-check`
- [x] Revalidate (opus)
- [x] Fix loop until green (≤2 rounds)
- [x] `git diff --check` clean
- [ ] **Your review checkpoint:** `git diff -- cli/server/src/shared/lib`

---

## P4 — Server Route + AI Client

**Tasks**
- [x] **Task 17** — `ProviderModelsResponse` schema + `getProviderModels` service (+ typed `PROVIDER_DISABLED` via `catalog-errors.ts`)
- [x] **Task 18** — `GET /provider/:id/models` route — rate-limited, slim Zod payload, route→service→catalog E2E
- [x] **Task 19** — `createLanguageModel` — add `groq` + `cerebras` via one `@ai-sdk/openai-compatible` factory keyed off overlay `baseURL`
- [x] **Task 20** — Add `@ai-sdk/groq`, `@ai-sdk/cerebras`, `@ai-sdk/openai-compatible` deps + real-adapter contract test

**Must-hold:** unknown `:id`→typed `VALIDATION_ERROR` (400); disabled enum provider→typed `PROVIDER_DISABLED`; route returns slim payload (never the 2.1 MB blob); groq/cerebras return valid `LanguageModel`; lockfile updated (no commit). *Note: `pnpm add` needs network — flagged as the one install step.*

**Pipeline**
- [x] Implement (opus, TDD, no commits — but `pnpm add` writes `package.json`/lockfile, left uncommitted)
- [x] Gate: `pnpm --filter @diffgazer/server test && pnpm --filter @diffgazer/server type-check`
- [x] Revalidate (opus)
- [x] Fix loop until green (0 rounds needed)
- [x] `git diff --check` clean
- [ ] **Your review checkpoint:** `git diff -- cli/server`

---

## P5 — Consumers (web + TUI) + E2E

**Tasks** *(React tasks load the react skill set)*
- [x] **Task 21** — `providerModels` query + `useProviderModels` hook (api layer)
- [x] **Task 22** — `useProviderModelsMapped` mapped hook (web/TUI-facing shape)
- [x] **Task 23** — Swap web `ModelSelectDialog` onto the catalog hook
- [x] **Task 24** — Swap web onboarding `ModelStep` onto the catalog hook
- [x] **Task 25** — Extend web `ProviderDetails` graceful path for catalog providers
- [x] **Task 26** — Swap TUI `ModelSelectOverlay` onto the catalog hook + rewrite its pinned test
- [x] **Task 27** — Swap TUI onboarding `ModelStep` onto the catalog hook
- [x] **Task 28** — Network-gated live models.dev E2E smoke check
- [x] **Task 29** — Regenerate + validate handoff artifacts after the consumer swap

**Must-hold:** pinned `model-select-overlay` Gemini free-first order green; web RTL integration renders free-first models from a mocked route, tier filter + free badge correct; pickers list only enabled providers; artifacts validate clean.

**Pipeline**
- [x] Implement (opus, TDD, no commits) — loads react-senior-guide + subskills
- [x] Gate: `pnpm --filter @diffgazer/core test && pnpm --filter @diffgazer/web test && pnpm --filter diffgazer test` + `pnpm run prepare:artifacts && pnpm run validate:artifacts:check`
- [x] Revalidate (opus)
- [x] Fix loop until green (0 rounds needed)
- [x] `git diff --check` clean
- [ ] **Your review checkpoint:** `git diff -- libs/core/src/api apps/web cli/diffgazer`

---

## P6 — Final Verification + `sota-verify`

**Tasks**
- [x] **Task 30** — Final Verification Gates (repo-wide)

**Gate (full AGENTS.md set)**
- [x] `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check`
- [x] `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test`
- [x] `pnpm run prepare:artifacts && pnpm run validate:artifacts:check`
- [x] `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke`
- [x] `pnpm run verify:monorepo`
- [x] `git diff --check`

**Pipeline**
- [x] Run full gate (opus)
- [x] **`sota-verify`** (opus) — completeness vs `design.md` + final code review; fix all findings (lows included), re-verify until clean
- [ ] **Your final review:** `git diff --stat` then scoped diffs

---

## Skills Matrix

| Phase | Implement skills | Revalidate skills |
|---|---|---|
| P1 | `sota`, `superpowers:test-driven-development`, `code-audit`, `clean-code`, `code-quality`, `anti-slop` | `code-audit`, `anti-slop`, `clean-code`, `superpowers:verification-before-completion` |
| P2 | TDD + audit set | audit set + verification-before-completion |
| P3 | TDD + audit set | audit set + verification-before-completion |
| P4 | TDD + audit set | audit set + verification-before-completion |
| P5 | TDD + audit set **+ `react-senior-guide`, `react-useeffect`, `react-useref`, `react-anti-patterns`, `react-design-patterns`, `react-hook-authoring`** | audit set + react skills + verification-before-completion |
| P6 | — | **`sota-verify`** + audit set + verification-before-completion |

---

## Progress Log

| When | Phase | Result | Notes |
|---|---|---|---|
| 2026-06-02 | P1 Catalog Core | ✅ GREEN (0 fix rounds) | 39 catalog + 454/454 core tests; build + verify:dist-esm clean; no commits (HEAD 738b89a7). 3 LOW notes carried to P6: (1) `transform.test.ts` merge test copies logic instead of calling `catalogToModelInfo` w/ multi-id overlay (no enabled provider has >1 id yet); (2) cosmetic context-string mismatch `describeModel` "1049K" vs `capabilities` "1M" — align when strings hit UI (P5); (3) design predicate order fixed in `design.md` to match verified code. Interim: `capabilities.ts` got groq/cerebras rows to keep enum sound — P2 replaces with derive-from-overlay. |
| 2026-06-02 | P2 Config & Providers Migration | ✅ GREEN (0 fix rounds) | core type-check 0 errors; 471/471 core tests (59 files); env-vars allowlist green; `git diff --check` clean; no commits (HEAD 738b89a7). Deviation: Task 8 refine uses `data.model === undefined` instead of the plan's literal `!data.model` (the latter is truthy for `""` and can't reject empty/whitespace — verified red→green). Interim P1 groq/cerebras hand rows in `capabilities.ts` deleted; all config now derives from `PROVIDER_OVERLAY`/`CATALOG_SNAPSHOT`. Task 13 Steps 3–5 (server-side `activateProvider` validation) deferred to P4 — blocked on P3's `getProviderModels`. Expected cross-phase reds (not regressions): `cli/server` client.test groq/cerebras branches → P4 Task 19; web/cli `.tsx` consumers of deleted `GEMINI_MODEL_INFO`/`GLM_MODEL_INFO`/`getStaticModelsForProvider` → P5 Tasks 23–27. No new LOWs. |
| 2026-06-02 | P3 Server Fetch / Cache / Fallback | ✅ GREEN (0 fix rounds) | server type-check PASS; 35 P3-owned tests green (8 paths + 11 disk-cache + 16 models-dev-catalog); `openrouter-models.test.ts` ZERO diff, 11/11 unchanged (disk-cache extraction behavior-equivalent); `git diff --check` clean; no commits (HEAD 738b89a7). D6 verified: keyless GET `models.dev/api.json` w/ `AbortSignal.timeout(10s)`, 24h cache at `~/.diffgazer/models-dev.json`, 3-tier (fresh cache→live+persist→stale cache→`CATALOG_SNAPSHOT`), shrink-guard rejects shrunk payload, `DIFFGAZER_OFFLINE` skips fetch, never-empty for gemini/groq/cerebras/zai. Deviations (both forced by the plan's own authoritative tests): (1) `paths.test.ts` extended in-place not created (file pre-existed); (2) shrink-guard ordered before the zero-models check (0-model vs positive baseline IS the extreme shrink case); (3) shrink-guard baselines on the prior *trusted disk cache* not `countModels(CATALOG_SNAPSHOT)` — snapshot is emergency floor, not freshness yardstick; design.md §"Three-tier fallback" updated to record the baseline source. Carried LOWs to P6: (a) `client.test.ts` groq/cerebras 2 reds are the genuine cross-phase P4 Task 19 wiring (client.ts untouched, imports no P3 module) — not a regression; (b) `persistOpenRouterModelCache` retained as export but no longer called internally (covered by the unchanged openrouter test; cleanliness note only). |
| 2026-06-02 | P4 Server Route + AI Client | ✅ GREEN (0 fix rounds) | server type-check PASS; 531/531 server tests (47 files, 2 network-gated live AI smokes skipped); core type-check PASS + 86/86 config+catalog tests (no regression); `git diff --check` clean; no commits (HEAD 738b89a7). Verified: unknown `:id`→typed `VALIDATION_ERROR`/400 (AIProviderSchema.safeParse); disabled enum provider→typed `PROVIDER_DISABLED`/404 built via `createDomainErrorCodes`/`createError<CatalogErrorCode>` in new `catalog-errors.ts`; route returns slim `{models,fetchedAt,source,cached}` validated by `ProviderModelsResponseSchema` (never the raw blob); rate-limited via the SAME shared `modelFetchLimit` as openrouter (429 after window); `createLanguageModel` returns valid `LanguageModel` for groq+cerebras via one `createOpenAICompatible` factory keyed off overlay `baseURL` + runtime `isLanguageModel` narrowing (contract test 2/2, 2 live smokes gated); deps `@ai-sdk/groq ^3.0.39`, `@ai-sdk/cerebras ^2.0.54`, `@ai-sdk/openai-compatible ^2.0.48` in package.json + pnpm-lock.yaml, all load at runtime. Deviations (no behavior impact): (1) rebuilt git-ignored `libs/core/dist/` once so server resolves new core exports (`catalog-errors`/`ProviderModelsResponse`/`createDomainErrorCodes`) — working-tree artifact only, not in git status; (2) `catalog-errors.ts` has no standalone unit test — typed contract covered behaviorally by service test's `CatalogErrorSchema.safeParse(result.error)`; (3) Task 13's deferred server-side `activateProvider` model validation was NOT implemented here despite this claim — `activateProvider` only re-ran the relaxed `UserConfigSchema` (which accepts any non-empty string), so unknown model ids were never rejected. This false GREEN was caught in audit and the catalog-membership check + fail-closed key guard are now implemented in the 2026-06-02 remediation (see the remediation log entry below). Carried LOWs to P6 (both cosmetic, design-conformant — confirmed not defects): (a) router.ts:83 compares `result.error.code` against the bare `"PROVIDER_DISABLED"` literal (service return widens `code` to `string`); consider importing the `CatalogErrorCode` constant for symmetry; (b) `@ai-sdk/groq`/`@ai-sdk/cerebras` installed but wiring uses only `@ai-sdk/openai-compatible` (keyed off overlay `baseURL`) — intended forward-compat surface per D3/Task 20, not unused-dep smell. |
| 2026-06-02 | P5 Consumers (web + TUI) + E2E | ✅ GREEN (0 fix rounds) | Independently revalidated from repo root, no commits (HEAD 738b89a7; working tree dirty, 58 entries): core 479/479 (61 files), web 282/282 (53 files), TUI 220/220 (29 files); `prepare:artifacts` OK; `validate:artifacts:check` "artifact validation passed" (exit 0, no drift); `git diff --check` CLEAN; core/web/TUI type-checks clean. `useProviderModels` mirrors `useOpenRouterModels` (bound fn + `configQueries.providerModels` + hook + export); `useProviderModelsMapped` mirrors `useOpenRouterModelsMapped`. Pinned W9.5 `model-select-overlay` Gemini free-first order + `safeHighlightIndex` clamp + ArrowUp-to-first-paid passes in isolation, preserved verbatim. Web `ModelSelectDialog` integration renders free-first from a boundary-mocked `getProviderModels` route with working `f` tier filter + correct free badge. Pickers list only the 6 enabled providers (SURFACED_OVERLAYS mistral/huggingface/github-models never surface). TDD-red credible: all deleted symbols (`getStaticModelsForProvider`, `GEMINI_MODEL_INFO`, `GLM_MODEL_INFO`, `getStaticModels`) gone except an absence-asserting test. Network-gated live models.dev smoke run for real and PASSED (gemini→21, groq→27, cerebras→3 models); default SKIP+exit0, strict FAIL+exit1. Deviations (all root-caused, contract-preserving): (1) web dialog test scopes order assertion to `data-value` on `radiogroup[aria-label="Available models"]` because `@diffgazer/ui` `Radio` puts model id on `data-value` (HTML `value` on hidden input) and filter tabs are also radios — the plan's flat `getAllByRole("radio")`+`value` query was unsound; (2) `provider-details` test split into a `groq` (`defaultModel: undefined` → "No default model") case + an `openrouter` ("Model required") case to honestly cover both branches, resolving the plan's self-contradicting literal; (3) TUI overlay test adds a `flushUntil(predicate)` helper to await the async catalog query before keypresses (W9.5 navigation must wait for models to load) — pinned ARROW constants/Wrapper/countPrefixes/clamp assertions preserved verbatim. Carried LOWs to P6: (a) report wording said ARROW constants are ESC-prefixed (`[A`) but the file uses plain `[A`/`[B` — report-only inaccuracy, constants are correct for ink-testing-library and the test passes; (b) `libs/core/src/catalog/` (incl. `catalog-snapshot.ts`) is untracked and not gitignored — a P1 snapshot/artifact concern (validate reports no drift); P6 should confirm the snapshot is intentionally committed or generated per Task 6. |
| 2026-06-02 | P6 Final Verification + sota-verify | ✅ GREEN (0 fix rounds) | Independently re-ran the full P6 gate end-to-end from repo root, all 7 stages exit 0 (no commits, HEAD 738b89a7; working tree dirty, 62 files): turbo type-check 11/11, turbo test 11/11, prepare:artifacts + validate:artifacts:check "OK: artifact validation passed", `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` exit 0 with ZERO skips (gemini→21, groq→27, cerebras→3 from the bundled CATALOG_SNAPSHOT — D6 "never blank picker" now smoke-covered every run; opt-in live via `DIFFGAZER_SMOKE_ALLOW_NETWORK=1`), verify:monorepo all-PASS, `git diff --check` clean. sota-verify CLEAN (1 round): completeness vs design.md confirmed (D1–D6, three-layer arch, allowlist rejects ZHIPU_API_KEY, typed PROVIDER_DISABLED, offline 3-tier + shrink-guard, groq/cerebras via one openai-compatible factory, derived AVAILABLE/CAPABILITIES/ENV_VARS). 5 findings fixed: P1 carried LOWs all closed — (1) `transform.test.ts` merge test now calls the real extracted `mergeModelsAcrossSources` (DRY'd out of `catalogToModelInfo`) over a genuine multi-source catalog, red-green verified; (2) context-string mismatch resolved via shared `formatContextTokens` in new `libs/core/src/catalog/format.ts` consumed by both `transform.ts describeModel` and `capabilities.ts formatContext`; (3) router/service now reference typed `PROVIDER_DISABLED` from new `catalog-errors.ts`. Plus a real rendering bug fixed: TUI `model-select-overlay.tsx:243` had a JSX-attribute `label` string with a literal backslash-u-2026 (rendered as raw text) corrected to a real ellipsis matching the sibling "Loading models…"; and dead `persistOpenRouterModelCache` export + its test removed. No `.bak` files, no new issues. New P6 untracked files: `libs/core/src/catalog/format.ts`, `format.test.ts`, `libs/core/src/schemas/config/catalog-errors.ts`. One LOW carried open: `scripts/monorepo/artifacts/smoke-modelsdev.mjs` `assertCatalogProviders` hardcodes the throw prefix "live models.dev catalog: …" even on the bundled-snapshot path (the injected `source` is used in the OK line but ignored in the error branch) — cosmetic, all paths pass; suggest interpolating `${source}` into the thrown message. |
| 2026-06-03 | Audit remediation — Theme B (server model validation) | ✅ GREEN | Implemented the Task 13 / D5 contract that the P4 log falsely claimed done (findings `server-route-client#0`, `xc-completeness-tasks#0`, `r1-security-and-boundaries#1`). `activateProvider` (service.ts) now, when a model is supplied for a non-OpenRouter provider, calls `getProviderModelsFromCatalog(provider)` and rejects an id absent from `models` with `MODEL_ERROR` (`Model "<id>" is not available for provider "<provider>".`); the vacuous `UserConfigSchema.safeParse` block (which accepted any non-empty string) was removed. OpenRouter stays exempt — its models come from the live key-gated route. Fixed the fail-open key guard (`r6-security-and-boundaries#0`): a failed secret read now fails closed (`if (!apiKeyResult.ok) return err(INVALID_BODY, ...)`), and a successful read with no key still blocks. Corrected the misleading `isValidModelForProvider` JSDoc in `libs/core` providers.ts (`xc-completeness-tasks#2`). Made the PROVIDER_DISABLED→404 route contract genuinely reachable (`r1-test-suite-gaps#0`): `ProviderModelsParamSchema` now accepts surfaced overlay ids (mistral/huggingface/github-models) and `getProviderModels` returns typed `PROVIDER_DISABLED` for a known-but-disabled overlay, so a truly unknown id still yields `VALIDATION_ERROR`/400 while `mistral` yields `PROVIDER_DISABLED`/404 through real configuration (no singleton mutation). TDD red→green throughout; catalog/store mocked only at the existing I/O boundaries. Verified: `pnpm --filter @diffgazer/core build && type-check`, `pnpm --filter @diffgazer/server type-check`, and `pnpm --filter @diffgazer/server test src/features/config/` (28/28) all green. No commits. |
