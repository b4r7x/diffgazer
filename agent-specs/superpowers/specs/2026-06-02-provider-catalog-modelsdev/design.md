# Provider/Model Catalog from models.dev

> **Status:** specified, not yet implemented.
> **Scope:** replace the hand-maintained provider/model catalog (`libs/core/src/schemas/config/{models,capabilities}.ts` + the static branches of `libs/core/src/providers/models.ts`) with a models.dev-backed catalog. Keep `AIProvider` a curated, type-safe enum. Widen the free-tier roster (add Groq + Cerebras now; surface the rest).
> **Write scope:** `libs/core` (new `src/catalog/` + edits to `schemas/config` and `providers`), `cli/server` (fetch/cache/route + AI client wiring), `libs/core/src/api` (consumer hook), `apps/web` + `cli/diffgazer` providers/onboarding features, generated artifacts, colocated tests.
> **Out of scope:** publishing packages, redesigning the providers UI, moving OpenRouter off its live API, enabling providers beyond Groq + Cerebras in this cut, a standalone npm catalog package.

---

## Plain-language summary (read this first)

Diffgazer keeps a **hand-written phone book of AI models** today — name, price, context size, free/paid — typed by hand in three files. It rots: two of the current notes already lie about GLM prices whose promos ended.

[models.dev](https://models.dev/api.json) is a **public, always-current phone book** of thousands of models with real prices and capabilities (keyless, ~2.1 MB JSON). The plan: stop hand-writing our phone book and **read the relevant pages from the public one automatically**.

**The one rule that drives the whole design:** the public phone book lists each model's **sticker price**, and a sticker price of `0` does **not** mean a provider grants a free allowance. Google charges a sticker price for `gemini-2.5-flash` (input 0.3 / output 2.5) yet hands out a free monthly **quota** — so we display it as free. models.dev cannot know that.

So we keep **one tiny curated sticky-note per provider** (`PROVIDER_OVERLAY`) carrying only the facts the API can never supply: which API-key env var we use, whether the provider has a free tier, the default/recommended model, and how we wire its SDK. **Everything else** — names, prices, context, capabilities, new model ids — comes live from models.dev.

To survive offline / first-run: **public book (source of truth) → on-disk cache (photocopy) → bundled snapshot (emergency printout) → sticky notes (our private facts).**

---

## Problem

The catalog is fully hand-maintained and exhaustively keyed by a 4-value enum:

- `libs/core/src/schemas/config/providers.ts` — `AI_PROVIDERS = ["gemini","zai","zai-coding","openrouter"]` as a Zod enum; the discriminant for `UserConfig`, `SaveConfigRequest`, `ProviderStatus`, `Init/Current/ConfigCheck/Activate/DeleteProviderCredentials` responses, server input validation, and persisted-config sanitizing. `isValidModelForProvider()` hard-switches on hand model arrays.
- `libs/core/src/schemas/config/capabilities.ts` — `AVAILABLE_PROVIDERS` (identity/defaultModel), `PROVIDER_CAPABILITIES` (hand-written prose: toolCalling/jsonMode/streaming/contextWindow/tier/tierBadge/capabilities/costDescription), `PROVIDER_ENV_VARS` + `ALLOWED_CREDENTIAL_ENV_VARS` (a **security allowlist**).
- `libs/core/src/schemas/config/models.ts` — hand-curated `GEMINI_MODELS`/`GEMINI_MODEL_INFO`, `GLM_MODELS`/`GLM_MODEL_INFO`, each `tier: free|paid` set by hand (incl. stale "promo ended" prose).
- `libs/core/src/providers/models.ts` — `getStaticModelsForProvider()` returns those static catalogs; `buildModels()` combines static + dynamic OpenRouter.

Consequences: every model addition, price change, or context bump is a manual edit; the data goes stale; and the only dynamic precedent is OpenRouter (`cli/server/src/shared/lib/ai/openrouter-models.ts` — live fetch, sha256(key)-keyed 24h disk cache, graceful cache fallback).

The UI contract that must keep working is narrow and stable: consumers need only `ModelInfo {id,name,description,tier:"free"|"paid",recommended?}`, `ProviderInfo {id,name,defaultModel}` + status, and `PROVIDER_CAPABILITIES[id]` for 4 capability cards + cost prose + tier badge. (The legacy `ProviderInfo.models[]` array is dropped — runtime model lists come from the catalog route, never the static identity record.)

---

## Goals

1. Derive the per-provider **model list** (names, pricing, context, new ids) **live from models.dev** (served via `GET /provider/:id/models`), validated by Zod. Per-provider **capability prose** (`PROVIDER_CAPABILITIES`: tool calling / JSON mode / context window / tier) is stable, so it is derived once at module-load from the bundled `CATALOG_SNAPSHOT` rather than the live route — see D2.
2. Keep a **small, honest curated overlay** for the facts models.dev cannot carry (env var, free-tier intent, default/recommended model, SDK wiring).
3. Model "free" **without lying and without hand-maintenance rot** (curated `hasFreeTier` per provider + derived per-model price tier).
4. Keep `AIProvider` a **closed, type-safe enum**; make only the **model catalog** dynamic.
5. **Widen the free-tier roster**: enable Groq + Cerebras now; surface the rest as `enabled=false`.
6. Be **offline-safe and resilient**: live → disk cache → bundled snapshot; per-model `safeParse`; shrink-guard; never a blank picker.
7. **Replace, don't alias** (pre-first-release). Keep every existing UI/config contract compiling and the pinned tests green.
8. Respect the architecture boundaries: pure schema/transforms in `libs/core`; fetch/cache in `cli/server`; web/TUI consume via HTTP.

## Non-goals

- Making `AIProvider` an open `z.string()` (rejected — see D5).
- Moving OpenRouter onto models.dev (rejected — see D4).
- A standalone `@diffgazer/*` catalog package (rejected — see D1).
- Auto-exposing all ~50 zero-cost models.dev providers (no SDK/env wiring; breaks `Record` exhaustiveness).

---

## Decisions

### D1: The catalog lives as a new `@diffgazer/core/catalog` subpath, not a new package — **LOCKED (user)**

**Decision:** Add `libs/core/src/catalog/` exported via a new `"./catalog"` entry in `libs/core/package.json`. The network + filesystem half lives in `cli/server`. `apps/web` and the Ink TUI consume over HTTP only.

**Rationale:** `./providers` already exists as its own subpath, so a sibling `./catalog` names the cohesive external-data concept (schema + overlay + transforms + snapshot) without blurring the runtime filter/list module. It keeps the pure layer in `libs/core` (which "owns Zod schemas/types, provider filtering, API client factories") and the I/O in `cli/server` (the fs/network owner), with **zero** new-package governance overhead (build config, exports map, smoke, artifacts) — unjustified before first release.

**Alternatives considered:** (a) Extend `./providers` — mixes a large external schema into runtime code, blurs a real boundary. (b) `cli/server`-local only — no shared pure layer; web/TUI can't share transforms; violates the libs/core-owns-schemas boundary. (c) New `libs/*` package — heavy `PACKAGE_GOVERNANCE` overhead, not yet earned.

### D2: "Free" = curated `hasFreeTier` per provider + derived `pricingTier` per model — **LOCKED (user)**

**Decision:** Two orthogonal facts.
- **Per-provider** `hasFreeTier: boolean` (curated, in the overlay) → drives the provider-level **FREE TIER** badge and the provider free/paid filter.
- **Per-model** `pricingTier: 'free' | 'paid' | 'unknown'` (derived from models.dev `cost`): `cost` present and `input==0 && output==0` → `free`; present and `>0` → `paid`; **`cost` absent → `unknown`** (never silently collapsed to `paid`, as `buildModels` does today, nor to `free`).

The public `ModelInfo.tier` (the unchanged 2-value union, used by the all/free/paid filter) answers "can I run this without paying?" and is resolved by an explicit predicate:

```
pricingTier = cost ? (cost.input==0 && cost.output==0 ? 'free' : 'paid') : 'unknown'
isFreeToUse =
  provider.hasFreeTier && (                              // a paid-plan provider is NEVER free, even at a 0/0 sticker price (zai-coding)
       pricingTier === 'free'                            // genuinely zero list price (zai flash)
    || provider.freeTier === 'all'                       // whole provider on a free quota (groq, cerebras)
    || matchesSelector(model, provider.freeTier)         // priced-but-quota-free (gemini 2.5 family)
  )
ModelInfo.tier = isFreeToUse ? 'free' : 'paid'
```

The overlay's `freeTier` selector captures the **one irreducibly curated fact**: which *priced* models a provider's free quota covers (no API knows this). Everything else stays derived. Worked cases: `gemini-2.5-flash` → `free` (in the curated `freeTier.ids`) despite `cost.input=0.3`; `gemini-3-pro-preview` → `paid` (priced, not in the selector — the safe default never claims free when unsure); `zai glm-4.7-flash` → `free` (zero list price, no curation needed); `zai glm-4.7` → `paid`; `zai-coding` models → `paid` (`hasFreeTier:false`, despite `cost=0/0` subscription quota); `groq`/`cerebras` models → `free` (`freeTier:'all'`). New zero-priced models auto-classify `free`; new *priced* models default `paid` until a human adds them to the selector — exactly when a human *should* review. `pricingTier` is also carried internally for an optional per-model price badge. `freeTierNote` (e.g. "Cerebras: ~1M tokens/day") gives honest UI prose. Stale promotional prose is dropped — live cost drives the price badge so it can never contradict the data.

**Capability cards are snapshot-derived, not live.** `PROVIDER_CAPABILITIES` (the four capability cards + cost prose + provider tier badge) is built once at module-load by `deriveCapabilities(CATALOG_SNAPSHOT, provider)`, not from the live/cached catalog. Capability prose is per-provider and stable across model refreshes, so freezing it to the bundled snapshot keeps the cards synchronously available (no extra round-trip, no loading state) without lying: the data that actually moves — the per-model price/context/new-ids list — is the part served live via `GET /provider/:id/models`. Wiring capabilities through the live route is a deliberate non-goal here; if a provider's capability profile shifts, the snapshot regenerate (`prepare:artifacts`) carries it.

**Rationale:** models.dev carries list price only (verified: provider objects expose `[api,doc,env,id,models,name,npm]` — no free/tier flag). Deriving tier from price alone was **verified** to flip `gemini-2.5-flash → paid` and `zai-coding → free`, breaking the documented UX and the pinned Gemini-order test.

**Alternatives considered:** (a) Pure `cost==0` — rejected (mislabels Gemini and zai-coding). (b) Fully hand-curated tiers — reintroduces the exact rot we are removing.

### D3: Enable the 4 wired providers + Groq + Cerebras; surface the rest — **LOCKED (user)**

**Decision:** `enabled=true` (wired for review): `gemini`, `zai`, `zai-coding`, `openrouter`, **`groq`**, **`cerebras`**. `enabled=false` (data-only; not shown in pickers until a documented UI boundary): `mistral`, `huggingface`, `github-models`. Deferred (not surfaced yet): `nvidia` (non-standard `nvext guided_json`), `togetherai`/`nebius`/`siliconflow`/`chutes` (signup credits, not a perpetual free tier).

**Rationale:** The enable gate is **Vercel AI SDK `generateObject` compatibility**, not free-tier presence. Surfacing a provider is cheap (data); enabling needs a working adapter + verified structured-object support. Groq (`@ai-sdk/groq`, `GROQ_API_KEY`) and Cerebras (`@ai-sdk/cerebras`, `CEREBRAS_API_KEY`, ~1M tokens/day free) both have genuine free tiers, OpenAI-compatible endpoints, clean `@ai-sdk` adapters, and verified `json_schema`. Each later promotion is one reviewable change: overlay row + env var + id-map entry + `createLanguageModel` branch (one `@ai-sdk/openai-compatible` branch covers most) + a contract test.

**Initial default models** (chosen for verified/likely structured-output support; confirmed at enable time via `generateObject`, never trusted blindly from a `null` field):
- `groq` → `meta-llama/llama-4-scout-17b-16e-instruct` (`structured_output=true`, `tool_call=true`, 131k ctx).
- `cerebras` → `gpt-oss-120b` (`tool_call=true`, 131k ctx; structured output verified at enable time).

### D4: OpenRouter stays on its live key-gated API — recommended, taken unless vetoed

**Decision:** Keep `https://openrouter.ai/api/v1/models` with the existing sha256(key)-keyed 24h cache, `/provider/openrouter/models` route, and `useOpenRouterModels`/`useOpenRouterModelsMapped`. The models.dev catalog runs **alongside** via a shared cache helper.

**Rationale:** models.dev carries only ~343 OpenRouter models (a lagging subset, 25 zero-cost) **without** per-model `supported_parameters`, which Diffgazer already uses for `isOpenRouterCompatible` (structured_output/response_format) gating and the `require_parameters:true` strict path. The live endpoint is freshest, richest, and key-correlated.

**Alternatives considered:** Move to models.dev (breaks the structured-output gate); hybrid (complexity for marginal benefit — the live cache already degrades gracefully).

### D5: `AIProvider` stays a closed enum; only models are dynamic — recommended, taken unless vetoed

**Decision:** Keep `AIProvider` a closed `z.enum`, expanded by exactly two members (`groq`, `cerebras`). Relax `isValidModelForProvider` so every provider accepts any non-empty model string (OpenRouter already does), with server-side validation at `activateProvider`.

**Rationale:** The enum is the type-safety, config-validation, and security backbone — 6+ response schemas, the AI SDK switch, `PROVIDER_ENV_VARS`/`ALLOWED_CREDENTIAL_ENV_VARS` (security allowlist), and persisted-config sanitizing all rely on exhaustive `Record<AIProvider, …>` keying. Open `z.string()` destroys that and surfaces unwired providers as `UNSUPPORTED_PROVIDER` at review time. Relaxing model validation stops fresh ids (`glm-5.1`, `gemini-3-pro`) being rejected by stale arrays.

### D6: Generated TS snapshot + 24h disk cache + offline escape hatch — recommended, taken unless vetoed

**Decision:** Ship the offline fallback as a **generated TS module** (`catalog-snapshot.ts`, `export const CATALOG_SNAPSHOT = …`), trimmed to overlay providers + used fields. Single keyless 24h disk cache at `~/.diffgazer/models-dev.json`. Resolution order per request: fresh disk cache → live fetch (persist on success) → stale disk cache → bundled snapshot. `DIFFGAZER_OFFLINE` skips the fetch.

**Rationale:** `cli/server` builds with plain `tsc` (won't copy a `.json` asset) and the `diffgazer` binary is tsup-bundled with `noExternal` — a TS export is inlined, a runtime `.json` fs path would break. A bundled snapshot guarantees the picker is never blank on first run/offline (the opencode #4959 regression to avoid). Unify with the OpenRouter cache by extracting `loadCache`/`persistCache`/`withTtlAndFallback` parameterized by `(path, schema, ttl, optional keyHash)`; OpenRouter passes a `keyHash`, models.dev passes none.

**Cache-orchestration exception (amended):** models.dev shares the cache *primitives* (`loadDiskCacheState`/`persistDiskCache` and the `isEntryFresh` TTL predicate, the single source of truth for freshness) but keeps its own resolution orchestration in `getProviderModels` rather than routing through `withTtlAndFallback`. The helper models a two-tier (fresh-cache → fetch → stale-cache) flow; models.dev needs behavior the helper does not: a third bundled-snapshot tier, a per-provider non-empty fall-through so a structurally-valid-but-provider-missing cache never serves a blank picker, a single-provider-drop poison guard on persistence, a corrupt-cache quarantine that still seeds a shrink-guard baseline from the snapshot, and the `live|cache|snapshot` provenance tag. OpenRouter remains the helper's consumer. This records the deviation so the implementation and the binding decision stop diverging silently; forcing models.dev through `withTtlAndFallback` would regress those resilience guarantees.

**Alternatives considered:** JSON snapshot asset (not copied by `tsc`, breaks in the bundled binary); no bundled snapshot (blank picker on first run/offline — a regression vs today's always-present constants).

---

## Architecture

Three layers mirroring the proven OpenRouter precedent.

| Layer | Responsibility | Location | Depends on |
|---|---|---|---|
| **Schema + transforms (pure)** | Zod `ModelsDevCatalogSchema` (per-model `safeParse`); `catalogToModelInfo` (pricingTier, merge-by-id across alias ids, freshest-date, deterministic free-first order, tier resolver honoring `hasFreeTier`); `deriveCapabilities` (format `tool_call`/`structured_output`/`reasoning`/`limit.context` into the prose contract). No I/O, browser-safe ESM. | `libs/core/src/catalog/{schema,transform,capabilities}.ts` | `zod ^4`; `AIProvider`,`ModelInfo` from `@diffgazer/core/schemas/config` |
| **Curated overlay + bundled snapshot** | `PROVIDER_OVERLAY` (id map, env var, hasFreeTier, default/recommended model, sdkKind, baseURL?, enabled) — the human-judgement layer. Generated `catalog-snapshot.ts` (TS module, tsup-inlined). | `libs/core/src/catalog/{provider-overlay,catalog-snapshot}.ts` | `AIProvider` enum; schema types |
| **Fetch + cache + fallback (I/O)** | Keyless `GET models.dev/api.json` (`AbortSignal.timeout(10_000)`, per-model `safeParse`); shared 24h disk cache; shrink-guard; three-tier resolution; `getProviderModels(id)`; `DIFFGAZER_OFFLINE` escape hatch. | `cli/server/src/shared/lib/ai/models-dev-catalog.ts` + `paths.ts` | `@diffgazer/core/catalog`; `@diffgazer/core/result`+`errors`; `cli/server` `fs.ts`+`paths.ts` |
| **HTTP endpoint** | `GET /provider/:id/models` → slim Zod-validated `{ models: ModelInfo[], fetchedAt, source: 'live'\|'cache'\|'snapshot', cached }` (never the 2.1 MB blob). Rate-limited like the OpenRouter route; OpenRouter keeps its own key-scoped route. | `cli/server/src/features/config/{router,service}.ts` | `models-dev-catalog.ts`; existing rate-limit middleware |
| **Client consumption (web + TUI)** | `useProviderModels` TanStack hook beside `useOpenRouterModels`; web fetches over HTTP and runs pure `filterModels`/`cycleTierFilter`; TUI hits the same in-process `cli/server`. Both keep consuming unchanged `ModelInfo`/`ProviderWithStatus`/`PROVIDER_CAPABILITIES`. | `libs/core/src/api/{queries,hooks}/config.ts`; `apps/web` + `cli/diffgazer` providers features | `@diffgazer/core/api`; `@diffgazer/core/catalog` (pure transforms only) |

### File tree

```
libs/core/src/catalog/
  index.ts                 # barrel for @diffgazer/core/catalog
  schema.ts                # ModelsDevCatalogSchema (zod v4, tightened); ModelsDevModel/Provider types
  provider-overlay.ts      # ProviderOverlay type; PROVIDER_OVERLAY: Record<AIProvider, ProviderOverlay>
  transform.ts             # catalogToModelInfo(catalog, provider): ModelInfo[]; pricingTier; merge; ordering
  capabilities.ts          # deriveCapabilities(catalog, provider): ProviderCapabilities (prose contract)
  catalog-snapshot.ts      # GENERATED: export const CATALOG_SNAPSHOT = {...} (trimmed, TS not json)
  {schema,transform,capabilities}.test.ts

cli/server/src/shared/lib/ai/
  models-dev-catalog.ts    # fetch, per-model safeParse, shrink-guard, 24h cache, 3-tier fallback, getProviderModels
  models-dev-catalog.test.ts
cli/server/src/shared/lib/paths.ts          # + getGlobalModelsDevCatalogPath() -> ~/.diffgazer/models-dev.json
cli/server/src/features/config/router.ts    # + GET /provider/:id/models (rate-limited)
cli/server/src/features/config/service.ts   # + getProviderModels service

libs/core/src/api/
  queries/config.ts, hooks/config.ts, types.ts   # + providerModels query + useProviderModels hook

libs/core/package.json   # exports += "./catalog": { types: ./dist/catalog/index.d.ts, import: ./dist/catalog/index.js }
```

---

## Data model

### 1) `ModelsDevCatalogSchema` (raw external data, tightened from the tiny-spec reference)

Non-strict (unknown fields dropped). Carries only what the UI/pipeline use:

```ts
ModelsDevModelSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  family: z.string().optional(),
  cost: z.object({
    input: z.number(), output: z.number(),
    cache_read: z.number().optional(), cache_write: z.number().optional(),
  }).optional(),
  limit: z.object({ context: z.number().optional(), output: z.number().optional() }).optional(),
  tool_call: z.boolean().optional(),
  structured_output: z.boolean().nullable().optional(),
  reasoning: z.boolean().optional(),
  modalities: z.object({ input: z.array(z.string()).optional(), output: z.array(z.string()).optional() }).optional(),
  release_date: z.string().optional(),
  last_updated: z.string().optional(),
  knowledge: z.string().optional(),
});
ModelsDevProviderSchema = z.object({
  id: z.string(), name: z.string().optional(),
  api: z.string().nullable().optional(), env: z.array(z.string()).optional(),
  models: z.record(z.string(), ModelsDevModelSchema),
});
ModelsDevCatalogSchema = z.record(z.string(), ModelsDevProviderSchema);
```

Parsed **per-model** (`safeParse` each `provider.models[id]`, skip invalid, keep valid) — never catalog-wide all-or-nothing, so one malformed community entry can't empty a provider.

### 2) `ProviderOverlay` (curated — the only hand-maintained piece)

```ts
type FreeTierSelector = 'all' | { ids?: string[]; families?: string[] };

type ProviderOverlay = {
  modelsDevIds: string[];        // gemini->['google'], zai-coding->['zai-coding-plan']
  diffgazerEnvVar: string;       // keeps GOOGLE_API_KEY/ZAI_API_KEY — NEVER models.dev's ZHIPU_API_KEY
  displayName?: string;          // optional curated OVERRIDE; primary name comes from models.dev, fallback humanize(id)
  hasFreeTier: boolean;
  freeTier?: FreeTierSelector;   // which PRICED models the free quota covers (the one curated fact); omitted => only zero-cost models are free
  freeTierNote?: string;
  defaultModel: string;
  recommendedModelId?: string;
  sdkKind: 'google' | 'openrouter' | 'zhipu' | 'openai-compatible';
  baseURL?: string;
  enabled: boolean;
};
```

| id | modelsDevIds | env var | displayName | hasFreeTier | freeTier selector | defaultModel | sdkKind | enabled |
|---|---|---|---|---|---|---|---|---|
| gemini | `google` | GOOGLE_API_KEY | `"Google Gemini"` (override) | true | `{ ids: [gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.5-pro] }` | gemini-2.5-flash | google | ✅ |
| zai | `zai` | ZAI_API_KEY | (from models.dev) | true | — (only zero-cost models free) | glm-4.7 | zhipu (`…/paas/v4`) | ✅ |
| zai-coding | `zai-coding-plan` | ZAI_API_KEY | (from models.dev) | false | — | glm-4.7 | zhipu (`…/coding/paas/v4`) | ✅ |
| openrouter | `openrouter` | OPENROUTER_API_KEY | (from models.dev) | true | (live API, own path) | (user picks) | openrouter | ✅ |
| groq | `groq` | GROQ_API_KEY | (from models.dev) | true | `'all'` | meta-llama/llama-4-scout-17b-16e-instruct | openai-compatible | ✅ |
| cerebras | `cerebras` | CEREBRAS_API_KEY | (from models.dev) | true | `'all'` | gpt-oss-120b | openai-compatible | ✅ |
| mistral | `mistral` | MISTRAL_API_KEY | (from models.dev) | true | — | — | openai-compatible | ❌ data-only |
| huggingface | `huggingface` | HF_TOKEN | (from models.dev) | true | — | — | openai-compatible | ❌ data-only |
| github-models | `github-models` | GITHUB_TOKEN | (from models.dev) | true | — | — | openai-compatible | ❌ data-only |

The `freeTier` selector is the only place the priced-but-quota-free judgment lives. It is re-evaluated against live data every refresh, so prices/context/new models still auto-update — only the free/paid *classification of priced models* is curated.

**Display name** — the provider's human name is resolved `overlay.displayName ?? <models.dev provider `name` for the primary `modelsDevId`, from the catalog/`CATALOG_SNAPSHOT`> ?? humanize(id)`. The **primary** source is the models.dev provider `name` (`ModelsDevProviderSchema` already carries `name`, so the snapshot/catalog must retain provider-level `name`); `displayName` is a curated override only. Only `gemini` sets an override (`"Google Gemini"`, pinning the existing filter/keyboard/capabilities tests); every other provider — including new ones — derives its name from models.dev with no override, keeping new providers zero-maintenance.

`PROVIDER_ENV_VARS`, `ALLOWED_CREDENTIAL_ENV_VARS`, and `AVAILABLE_PROVIDERS` derive from the overlay.

### 3) Public `ModelInfo` (UNCHANGED contract)

`{ id, name, description, tier: 'free'|'paid', recommended? }`. The transform additively populates `description` (from name/context), resolves `tier` per D2, and sets `recommended = (model.id === overlay.recommendedModelId)`. An internal `pricingTier: 'free'|'paid'|'unknown'` is carried for the optional per-model price badge, but the public union stays 2-value so the UI and pinned tests keep compiling.

---

## Integration & migration (replace, don't alias)

- **Delete** from `schemas/config/models.ts`: `GEMINI_MODELS`, `GeminiModelSchema`, `GEMINI_MODEL_INFO`, `GLM_MODELS`, `GLMModelSchema`, `GLM_MODEL_INFO` (incl. stale promo prose). **Keep** `OpenRouterModelSchema`/cache schemas (live OpenRouter path).
- **Delete** from `providers/models.ts`: `getStaticModelsForProvider` and the static branches of `buildModels`. `buildModels` becomes: `openrouter → mapOpenRouterModels(live)`; all other providers → `ModelInfo[]` from the server catalog route. `filterModels`/`cycleTierFilter`/`TIER_FILTERS` stay.
- **Expand** `AIProvider` enum with `groq`, `cerebras` (preserves every config invariant). **Relax** `isValidModelForProvider` to non-empty-string per provider; validate at `activateProvider` server-side.
- **Typed error contract** (`GET /provider/:id/models`): an unknown `:id` fails `AIProviderSchema` validation and surfaces `ErrorCode.VALIDATION_ERROR` (HTTP 400) via the existing `zodErrorHandler`/`errorResponse`; an enum provider whose overlay is `enabled:false` returns the typed code `PROVIDER_DISABLED` (HTTP 404), defined through the repo's typed domain-error mechanism (`createDomainErrorCodes`/`createDomainErrorSchema` on a config/catalog domain union) — never an untyped ad-hoc string. (The pre-existing ad-hoc `"PROVIDER_NOT_FOUND"`/`"INVALID_BODY"` strings in the config service are an optional adjacent cleanup, not required by this change.)
- `PROVIDER_CAPABILITIES` → `deriveCapabilities(CATALOG_SNAPSHOT, provider)` at module-load, producing the same prose-shaped object from structured fields + overlay `costDescription`/`hasFreeTier`. Snapshot-derived, not live (see D2): the prose is stable per provider, only the model list is served live. `apps/web` `provider-details.tsx` already guards missing capabilities — extend that graceful-unknown path.
- `createLanguageModel` (cli/server) gains `groq`/`cerebras` cases via one `@ai-sdk/openai-compatible` factory keyed off `overlay.baseURL` (keep dedicated `google`/`openrouter`/`zhipu` factories). `DEFAULT_MODELS` derives from `overlay.defaultModel`.
- **Add deps** (cli/server): `@ai-sdk/groq`, `@ai-sdk/cerebras`, `@ai-sdk/openai-compatible` — runtime, server-only; update the lockfile via pnpm; justify as the wiring for D3.
- **Ripple together:** source, public registry JSON, docs/examples, generated bundles, and ALL app consumers; run `prepare:artifacts` + `validate:artifacts:check` (config schemas feed the handoff contract). The pinned `model-select-overlay` Gemini-order test is honored by the transform's deterministic free-first ordering.

---

## Build sequence

1. `catalog/schema.ts` — tightened `ModelsDevCatalogSchema` + types + per-model parser. Test against captured `api.json` (all 6 enabled providers parse; one bad model skipped, not fatal).
2. `catalog/provider-overlay.ts` — `ProviderOverlay` + `PROVIDER_OVERLAY` (6 enabled + 3 surfaced); rewire `PROVIDER_ENV_VARS`/`ALLOWED_CREDENTIAL_ENV_VARS`/`AVAILABLE_PROVIDERS` to derive from it.
3. `catalog/{transform,capabilities}.ts` — `catalogToModelInfo` (pricingTier, merge-by-id, freshest-date, free-first order, tier resolver) + `deriveCapabilities`. Test: gemini-2.5-flash stays `free`; zai-coding stays `paid`; Gemini order matches the pinned test.
4. Add `./catalog` to `package.json` exports; build `libs/core` (`tsc` + `verify:dist-esm`) to confirm `.js` specifiers and the subpath.
5. Generate `catalog-snapshot.ts` (trimmed TS from a captured `api.json`) + a `prepare:artifacts` step that regenerates it; build the `diffgazer` binary to verify tsup inlines it.
6. Expand `AIProvider` (groq, cerebras); relax `isValidModelForProvider`; delete GEMINI/GLM constants + static `buildModels` branches; fix all type-check breaks across the 4 packages.
7. cli/server: add `getGlobalModelsDevCatalogPath`; build `models-dev-catalog.ts` (fetch, per-model safeParse, shrink-guard, 24h cache, three-tier fallback, offline escape hatch); extract the shared cache helper and refactor `openrouter-models.ts` onto it.
8. cli/server: add `getProviderModels` service + `GET /provider/:id/models` route (rate-limited); add groq/cerebras `createLanguageModel` cases + one `openai-compatible` factory; overlay-derived `DEFAULT_MODELS`.
9. `@diffgazer/core/api`: `providerModels` query + `useProviderModels` hook; swap web + TUI providers features onto it (keep `ModelInfo`/`PROVIDER_CAPABILITIES` consumption unchanged); extend the provider-details graceful-unknown path.
10. Full Verification Gates (below).

---

## Testing plan

- **Schema resilience:** all 6 enabled providers parse; an injected malformed model leaves the provider's other models intact (per-model safeParse).
- **Id mapping:** `gemini→google`, `zai-coding→zai-coding-plan`; merge-by-id collapses duplicates across alias ids.
- **Free-tier resolver (headline regression):** `gemini-2.5-flash → tier:'free'` despite `cost.input=0.3` (in `freeTier.ids`); a priced Gemini model *not* in the selector (e.g. `gemini-3-pro-preview`) → `tier:'paid'`; `zai glm-4.7-flash → tier:'free'` (zero cost, no curation); `zai glm-4.7 → tier:'paid'`; `zai-coding glm-4.7 → tier:'paid'` despite `cost=0/0` (`hasFreeTier:false`); a `groq`/`cerebras` priced model → `tier:'free'` (`freeTier:'all'`).
- **pricingTier distinction:** explicit `0/0 → free`; `>0 → paid`; **absent cost → unknown** (assert google's no-cost models are `unknown`, not `paid`).
- **Ordering:** derived Gemini order matches the pinned `model-select-overlay` test (free-first, deterministic).
- **Capability derivation:** `deriveCapabilities` formats `tool_call`/`structured_output`/`reasoning`/`limit.context`; `structured_output:null` does NOT hide a model.
- **Three-tier fallback (cli/server):** fetch fails → disk cache; no disk cache → bundled snapshot; never empty. Shrink-guard rejects a catalog far smaller than baseline. **Baseline source:** the prior *trusted disk cache* (the freshness yardstick), not `CATALOG_SNAPSHOT` (which is the emergency floor only); first run has no baseline and accepts. Baselining on the multi-thousand-model snapshot would wrongly trip the guard on a legitimate trimmed live fetch.
- **Offline escape hatch:** `DIFFGAZER_OFFLINE` skips fetch, serves cache/snapshot.
- **HTTP route:** `GET /provider/:id/models` returns slim Zod-validated `ModelInfo[]` + source tag; rate limit enforced.
- **Defaults present:** `gemini-2.5-flash`, `glm-4.7`, and the groq/cerebras defaults exist in their derived lists.
- **AI client contract:** `createLanguageModel` returns a valid model for groq and cerebras (+ a `generateObject` smoke where feasible).
- **Config invariants:** `UserConfig` with a fresh id (`glm-5.1`) passes; `activateProvider` accepts/rejects appropriately.
- **Snapshot bundling:** build the `diffgazer` binary; assert the snapshot is inlined (no runtime fs json).

---

## Risks & mitigations

| Sev | Risk | Mitigation |
|---|---|---|
| high | Tier-from-price flips Gemini→paid / zai-coding→free | Tier = curated `hasFreeTier` + per-model `pricingTier` (explicit-zero vs absent); regression tests pin both. |
| high | Open `AIProvider` breaks exhaustive `Record` keying + security allowlist | Keep the enum closed; only models are dynamic (D5). |
| high | Adopting models.dev env names (`ZHIPU_API_KEY`) changes the credential allowlist | `diffgazerEnvVar` in overlay; `PROVIDER_ENV_VARS`/`ALLOWED_CREDENTIAL_ENV_VARS` derive from it; preserve the secrets-store legacy migration. |
| high | Over-trusting `structured_output==null` hides capable free models (zai 13/13 null) | `structured_output` is a positive badge hint only, never a filter; prove capability at enable time via `generateObject`. |
| med | JSON snapshot missing from the tsup binary → blank first-run picker | Generated TS module, tsup-inlined; test the binary build. |
| med | models.dev is a 2.1 MB external SPOF | Three-tier fallback + per-model safeParse + shrink-guard + offline hatch; serve a slim payload. |
| med | Newly enabled providers need real runtime wiring | `enabled` gates picker selection; only enabled providers get a `createLanguageModel` branch; per-provider contract test. |
| med | NVIDIA NIM `nvext guided_json` may not satisfy `generateObject` | Keep NVIDIA deferred (not surfaced) until a verified path. |
| low | New subpath + route touches build/exports/artifacts/smoke | Reuse existing boundaries (no new package); run the full gates. |

---

## Verification gates (from AGENTS.md)

- After core changes: `pnpm --filter @diffgazer/core type-check` + focused catalog/providers tests.
- After web changes: `pnpm --filter @diffgazer/web type-check` + focused providers tests.
- After registry/handoff changes: `pnpm run prepare:artifacts` + `pnpm run validate:artifacts:check`.
- Before declaring ready: `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check`, `… turbo run test`, `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke`, `pnpm run verify:monorepo`, `git diff --check`.

---

## Appendix: provenance

Designed via a 6-agent opus workflow (5 parallel research dossiers — current architecture, tiny-spec reference, models.dev + SOTA libraries, free-tier landscape, placement/boundaries — + synthesis), grounded in live models.dev data (cached `/tmp/modelsdev.json`) and the existing OpenRouter dynamic-catalog precedent. Reference pattern: `/Users/voitz/Projects/tiny-spec/src/engine/providers/models-dev.ts`.
