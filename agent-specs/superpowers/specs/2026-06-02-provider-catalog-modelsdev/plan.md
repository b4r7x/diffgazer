# Provider/Model Catalog (models.dev) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Replace the hand-maintained provider/model catalog (`libs/core/src/schemas/config/{models,capabilities}.ts` + the static branches of `libs/core/src/providers/models.ts`) with a models.dev-backed catalog that derives model names, pricing, context, capabilities, and new ids live from the public keyless `models.dev/api.json`, validated by Zod. Keep a small honest curated overlay for the facts models.dev cannot carry (credential env var, free-tier intent, default/recommended model, SDK wiring). Keep `AIProvider` a closed, type-safe enum; make only the model catalog dynamic. Widen the free-tier roster by enabling Groq + Cerebras now and surfacing Mistral / Hugging Face / GitHub Models as `enabled=false`. Be offline-safe (live → disk cache → bundled snapshot → curated overlay) and never show a blank picker. Replace, don't alias (pre-first-release): keep every existing UI/config contract compiling and the pinned tests green.

**Architecture:** Three layers mirroring the proven OpenRouter precedent. (1) Pure schema + transforms in `libs/core/src/catalog/` exported via a new `"./catalog"` subpath — `ModelsDevCatalogSchema` (per-model `safeParse`), `catalogToModelInfo` (pricingTier, merge-by-id, freshest-date, deterministic free-first order, tier resolver honoring `hasFreeTier`), `deriveCapabilities` (prose contract), the curated `PROVIDER_OVERLAY`, and the generated `catalog-snapshot.ts` (TS module, tsup-inlined). (2) Fetch + cache + fallback (I/O) in `cli/server/src/shared/lib/ai/models-dev-catalog.ts` — keyless `GET models.dev/api.json`, shared 24h disk cache, shrink-guard, three-tier resolution, `DIFFGAZER_OFFLINE` escape hatch. (3) HTTP endpoint `GET /provider/:id/models` returning a slim Zod-validated `{ models, fetchedAt, source, cached }`, plus client consumption via a `useProviderModels` TanStack hook in `libs/core/src/api` consumed by `apps/web` and `cli/diffgazer`. OpenRouter keeps its live key-gated API alongside the new catalog via a shared cache helper. `createLanguageModel` gains `groq`/`cerebras` cases through one `@ai-sdk/openai-compatible` factory keyed off `overlay.baseURL`.

**Tech Stack:** TypeScript (ESM, explicit `.js` import specifiers in `libs/core`/`cli/server`), Zod v4, Vercel AI SDK v6 (`@ai-sdk/google`, `@ai-sdk/groq`, `@ai-sdk/cerebras`, `@ai-sdk/openai-compatible`, `@openrouter/ai-sdk-provider`, `zhipu-ai-provider`), Hono (cli/server), TanStack Query v5, React 19, Vitest 4 + React Testing Library (web, jsdom) / ink-testing-library (TUI, node), pnpm workspaces + turbo, tsup (binary bundling with `noExternal`).

---

## Workflow Execution Guide

This plan is designed to be executed by a Workflow: **each Task = one subagent**, and **each phase boundary = a verification gate**. A subagent picks up exactly one Task (its files, its TDD steps, its commit), runs the focused verification at the end of that Task, and reports. Do not collapse multiple Tasks into one subagent; do not skip the per-phase gate before advancing.

### Phases

| Phase | Name | Tasks | Owner packages |
|---|---|---|---|
| **P1** | Catalog Core | Tasks 1-6 | `libs/core` (`src/catalog/`) |
| **P2** | Config & Providers Migration | Tasks 7-13 | `libs/core` (`schemas/config`, `providers`) + minimal `cli/server` validation |
| **P3** | Server Fetch / Cache / Fallback | Tasks 14-16 | `cli/server` (`shared/lib`) |
| **P4** | Server Route + AI Client | Tasks 17-20 | `cli/server` (`features/config`, `shared/lib/ai`) |
| **P5** | Consumers (web + TUI) + E2E | Tasks 21-29 | `libs/core/api`, `apps/web`, `cli/diffgazer`, smoke scripts |
| **P6** | Final Verification | Task 30 | repo-wide gates |

### Sequencing (parallel vs sequential)

- **P1 before P2.** P2's enum/overlay derivations import `@diffgazer/core/catalog` (the overlay, snapshot, `deriveCapabilities`) built in P1. Within P1: Task 1 (schema) and Task 5 (snapshot generator) are enum-independent and may start first; **Task 2 (overlay) and everything that keys `Record<AIProvider, …>` is gated behind the `AIProvider` enum expansion in P2 Task 7** — so in practice run P1 Task 1, then P2 Task 7 (enum), then the rest of P1 (Tasks 2-6), then the rest of P2 (Tasks 8-13). This is the one cross-phase interleave; it is called out again at the Task 2 and Task 7 boundaries.
- **P2 and P3 can overlap.** P3 (cli/server fetch/cache) depends only on the pure `@diffgazer/core/catalog` exports (P1) and the `AIProvider` enum (P2 Task 7), not on the rest of P2's deletions. Once P1 + P2 Task 7 land, P3 can run in parallel with P2 Tasks 8-13.
- **P3 before P4.** P4's route/service/AI-client wiring consumes `getProviderModels` and the disk-cache helper built in P3.
- **P5 after P2 + P4.** The consumer swaps need both the deletions (P2) and the live route + hook chain (P4). The api-layer hook tasks (P5 Tasks 21-22) need only P4's route + the `ProviderModelsResponse` schema; the `.tsx` swaps need P2's deletions merged so the old static imports are gone.
- **P6 last.** Repo-wide gates run only after every code phase is green.

### Dependency graph

```
P1 Task1 (schema) ─┐
                   ├─> P2 Task7 (AIProvider enum) ─> P1 Tasks2-6 (overlay/transform/caps/snapshot/barrel)
P1 Task5 (snapshot gen, after Task1) ─┘                         │
                                                                ├─> P2 Tasks8-13 (config derivations, deletions, server-side validate)
                                                                ├─> P3 Tasks14-16 (paths, disk-cache, models-dev-catalog)   [overlaps P2 8-13]
                                                                │        │
                                                                │        └─> P4 Tasks17-20 (schema, service, route, AI client + deps)
                                                                │                 │
                                                                └─────────────────┴─> P5 Tasks21-29 (api hook, mapped hook, web+TUI consumers, smoke)
                                                                                              │
                                                                                              └─> P6 Task30 (repo gates)
```

### Verification gate at each phase boundary

- **After P1 (Catalog Core):** `pnpm --filter @diffgazer/core test src/catalog` (37 tests), `pnpm --filter @diffgazer/core type-check`, `pnpm --filter @diffgazer/core build` (`tsc` + `verify:dist-esm` clean), `git diff --check`.
- **After P2 (Config Migration):** `pnpm --filter @diffgazer/core type-check && pnpm --filter @diffgazer/core test`; `pnpm --filter @diffgazer/core test src/schemas/config/env-vars.test.ts` (security allowlist incl. `ZHIPU_API_KEY` rejected); `git diff --check`. Record any expected cross-package red in `cli/server` (groq/cerebras `createLanguageModel` branches land in P4).
- **After P3 (Server Fetch/Cache):** `pnpm --filter @diffgazer/server test src/shared/lib/`, `pnpm --filter @diffgazer/server type-check`, `git diff --check`.
- **After P4 (Server Route + AI Client):** `pnpm --filter @diffgazer/server test`, `pnpm --filter @diffgazer/server type-check`, `git diff --check`.
- **After P5 (Consumers + E2E):** `pnpm --filter @diffgazer/core test && pnpm --filter @diffgazer/web test && pnpm --filter diffgazer test`; `pnpm run prepare:artifacts && pnpm run validate:artifacts:check`; `git diff --check`.
- **After P6 (Final):** the full AGENTS.md gate set (see Task 30).

### Skills each phase's subagents load

- **Every code Task (all phases):** `superpowers:test-driven-development`, `code-audit`, `clean-code`, `code-quality`, `anti-slop`.
- **React Tasks (P5 Tasks 21-27):** additionally `react-senior-guide`, `react-useeffect`, `react-useref`, `react-anti-patterns`, `react-design-patterns`, `react-hook-authoring`.
- **Verification-only Tasks (P2 Task 13 gate portions, P6 Task 30):** `superpowers:verification-before-completion` plus the audit set.
- **Whole effort:** run `sota` once at the very start (before P1) and `sota-verify` once at the very end (after P6). These are phase/effort-level — do **not** rerun `sota`/`sota-verify` per Task.

---

## Phase P1 — Catalog Core (`libs/core/src/catalog`)

> **Phase scope (pure layer only):** the schema + per-model parser, the curated `PROVIDER_OVERLAY`, the `transform`/`capabilities` pure functions, the generated `catalog-snapshot.ts`, the barrel, and the new `"./catalog"` package export. No I/O. The catalog code keys its exhaustive `Record<AIProvider, …>` over the expanded enum, so **Task 2 onward is gated behind the `AIProvider` enum expansion in Task 7**; Task 1 and Task 5's generator are enum-independent and may run first.

### Task 1: `schema.ts` — `ModelsDevCatalogSchema` + `parseModelsDevCatalog` (per-model `safeParse`)

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

**Files:**
- Create: `libs/core/src/catalog/schema.ts`
- Create: `libs/core/src/catalog/__fixtures__/catalog.fixture.ts` (trimmed, hand-captured from `/tmp/modelsdev.json`; small)
- Test: `libs/core/src/catalog/schema.test.ts`

Steps:

- [ ] **Step 1: Write the trimmed fixture used by every catalog test.** Create `libs/core/src/catalog/__fixtures__/catalog.fixture.ts`. Captured (and trimmed to overlay-used fields) from the live `/tmp/modelsdev.json` so tests pin real-world data. It includes all 6 enabled providers (`google`, `zai`, `zai-coding-plan`, `groq`, `cerebras`, plus a slim `openrouter`) and is reused across schema/transform/capabilities/snapshot tests.

```ts
// libs/core/src/catalog/__fixtures__/catalog.fixture.ts
// Trimmed, hand-captured from models.dev /api.json (cached at /tmp/modelsdev.json).
// Only fields the catalog reads are kept. Do NOT inline the full 2.1 MB blob.

/** A raw models.dev catalog shaped exactly like the live API (record-of-providers). */
export const RAW_CATALOG: Record<string, unknown> = {
  google: {
    id: "google",
    name: "Google",
    env: ["GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"],
    models: {
      "gemini-2.5-flash": {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        family: "gemini-flash",
        cost: { input: 0.3, output: 2.5, cache_read: 0.03 },
        limit: { context: 1048576, output: 65536 },
        tool_call: true,
        structured_output: true,
        reasoning: true,
        release_date: "2025-03-20",
        last_updated: "2025-06-05",
        knowledge: "2025-01",
        modalities: { input: ["text", "image", "audio", "video", "pdf"], output: ["text"] },
      },
      "gemini-2.5-flash-lite": {
        id: "gemini-2.5-flash-lite",
        name: "Gemini 2.5 Flash-Lite",
        family: "gemini-flash-lite",
        cost: { input: 0.1, output: 0.4, cache_read: 0.01 },
        limit: { context: 1048576, output: 65536 },
        tool_call: true,
        structured_output: true,
        reasoning: true,
        release_date: "2025-06-17",
        last_updated: "2025-06-17",
      },
      "gemini-2.5-pro": {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        family: "gemini-pro",
        cost: { input: 1.25, output: 10, cache_read: 0.125 },
        limit: { context: 1048576, output: 65536 },
        tool_call: true,
        structured_output: true,
        reasoning: true,
        release_date: "2025-03-20",
        last_updated: "2025-06-05",
      },
      "gemini-3-pro-preview": {
        id: "gemini-3-pro-preview",
        name: "Gemini 3 Pro Preview",
        family: "gemini-pro",
        cost: { input: 2, output: 12, cache_read: 0.2 },
        limit: { context: 1048576, output: 65536 },
        tool_call: true,
        structured_output: true,
        reasoning: true,
        release_date: "2025-11-18",
        last_updated: "2025-11-18",
      },
      // No `cost` => pricingTier 'unknown' (must NOT collapse to 'paid').
      "gemini-embedding-001": {
        id: "gemini-embedding-001",
        name: "Gemini Embedding 001",
        family: "gemini-embedding",
        limit: { context: 2048 },
        release_date: "2025-05-01",
        last_updated: "2025-05-01",
      },
    },
  },
  zai: {
    id: "zai",
    name: "Z.AI",
    api: "https://api.z.ai/api/paas/v4",
    env: ["ZHIPU_API_KEY"],
    models: {
      "glm-4.7": {
        id: "glm-4.7",
        name: "GLM-4.7",
        family: "glm",
        cost: { input: 0.6, output: 2.2, cache_read: 0.11, cache_write: 0 },
        limit: { context: 204800, output: 131072 },
        tool_call: true,
        reasoning: true,
        release_date: "2025-12-22",
        last_updated: "2025-12-22",
      },
      "glm-4.7-flash": {
        id: "glm-4.7-flash",
        name: "GLM-4.7-Flash",
        family: "glm-flash",
        cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
        limit: { context: 200000, output: 131072 },
        tool_call: true,
        reasoning: true,
        release_date: "2026-01-19",
        last_updated: "2026-01-19",
      },
    },
  },
  "zai-coding-plan": {
    id: "zai-coding-plan",
    name: "Z.AI Coding Plan",
    api: "https://api.z.ai/api/coding/paas/v4",
    env: ["ZHIPU_API_KEY"],
    models: {
      "glm-4.7": {
        id: "glm-4.7",
        name: "GLM-4.7",
        family: "glm",
        cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
        limit: { context: 204800, output: 131072 },
        tool_call: true,
        reasoning: true,
        release_date: "2025-12-22",
        last_updated: "2025-12-22",
      },
    },
  },
  groq: {
    id: "groq",
    name: "Groq",
    env: ["GROQ_API_KEY"],
    models: {
      "meta-llama/llama-4-scout-17b-16e-instruct": {
        id: "meta-llama/llama-4-scout-17b-16e-instruct",
        name: "Llama 4 Scout 17B",
        family: "llama",
        cost: { input: 0.11, output: 0.34 },
        limit: { context: 131072, output: 8192 },
        tool_call: true,
        structured_output: true,
        reasoning: false,
        release_date: "2025-04-05",
        last_updated: "2025-04-05",
      },
    },
  },
  cerebras: {
    id: "cerebras",
    name: "Cerebras",
    env: ["CEREBRAS_API_KEY"],
    models: {
      "gpt-oss-120b": {
        id: "gpt-oss-120b",
        name: "GPT OSS 120B",
        family: "gpt-oss",
        cost: { input: 0.25, output: 0.69 },
        limit: { context: 131072, output: 32768 },
        tool_call: true,
        reasoning: true,
        release_date: "2025-08-05",
        last_updated: "2025-08-05",
      },
    },
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    api: "https://openrouter.ai/api/v1",
    env: ["OPENROUTER_API_KEY"],
    models: {
      "openai/gpt-4o": {
        id: "openai/gpt-4o",
        name: "GPT-4o",
        cost: { input: 2.5, output: 10 },
        limit: { context: 128000 },
        tool_call: true,
        structured_output: true,
      },
    },
  },
};

/** A google provider whose `models` map carries one structurally-invalid entry. */
export const RAW_CATALOG_WITH_BAD_MODEL: Record<string, unknown> = {
  google: {
    id: "google",
    name: "Google",
    env: ["GOOGLE_API_KEY"],
    models: {
      "gemini-2.5-flash": {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        cost: { input: 0.3, output: 2.5 },
        limit: { context: 1048576 },
        tool_call: true,
        structured_output: true,
      },
      // Malformed: `cost.input` is a string, `limit.context` is a string — both
      // violate the schema. Per-model safeParse must drop ONLY this entry.
      "broken-model": {
        id: "broken-model",
        cost: { input: "free", output: "free" },
        limit: { context: "lots" },
      },
      "gemini-2.5-pro": {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        cost: { input: 1.25, output: 10 },
        limit: { context: 1048576 },
        tool_call: true,
        structured_output: true,
      },
    },
  },
};
```

- [ ] **Step 2: Write the failing test for `schema.ts`.** Create `libs/core/src/catalog/schema.test.ts`.

```ts
// libs/core/src/catalog/schema.test.ts
import { describe, it, expect } from "vitest";
import { parseModelsDevCatalog, ModelsDevModelSchema } from "./schema.js";
import { RAW_CATALOG, RAW_CATALOG_WITH_BAD_MODEL } from "./__fixtures__/catalog.fixture.js";

describe("parseModelsDevCatalog", () => {
  it("parses all six enabled providers from the trimmed live fixture", () => {
    const catalog = parseModelsDevCatalog(RAW_CATALOG);
    for (const id of ["google", "zai", "zai-coding-plan", "groq", "cerebras", "openrouter"]) {
      expect(catalog[id], `provider ${id} should parse`).toBeDefined();
    }
    expect(Object.keys(catalog["google"]!.models)).toContain("gemini-2.5-flash");
  });

  it("preserves model fields the catalog reads (cost, limit, capability flags, dates)", () => {
    const catalog = parseModelsDevCatalog(RAW_CATALOG);
    const flash = catalog["google"]!.models["gemini-2.5-flash"]!;
    expect(flash.cost).toEqual({ input: 0.3, output: 2.5, cache_read: 0.03 });
    expect(flash.limit?.context).toBe(1048576);
    expect(flash.tool_call).toBe(true);
    expect(flash.structured_output).toBe(true);
    expect(flash.last_updated).toBe("2025-06-05");
  });

  it("keeps a model with absent cost (cost stays undefined, not zeroed)", () => {
    const catalog = parseModelsDevCatalog(RAW_CATALOG);
    const embedding = catalog["google"]!.models["gemini-embedding-001"]!;
    expect(embedding.cost).toBeUndefined();
  });

  it("skips one malformed model but keeps its siblings (per-model safeParse)", () => {
    const catalog = parseModelsDevCatalog(RAW_CATALOG_WITH_BAD_MODEL);
    const models = catalog["google"]!.models;
    expect(models["broken-model"]).toBeUndefined();
    expect(models["gemini-2.5-flash"]).toBeDefined();
    expect(models["gemini-2.5-pro"]).toBeDefined();
    expect(Object.keys(models)).toHaveLength(2);
  });

  it("drops unknown top-level fields (non-strict) without throwing", () => {
    const raw = { google: { id: "google", models: {}, unknownField: 42 } };
    const catalog = parseModelsDevCatalog(raw);
    expect(catalog["google"]).toBeDefined();
    expect((catalog["google"] as Record<string, unknown>).unknownField).toBeUndefined();
  });

  it("accepts structured_output: null (nullable badge hint, never a parse failure)", () => {
    const parsed = ModelsDevModelSchema.safeParse({ id: "x", structured_output: null });
    expect(parsed.success).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test and confirm it FAILS.** Run: `pnpm --filter @diffgazer/core test src/catalog/schema.test.ts`. Expected: FAIL — `Cannot find module './schema.js'` (the module does not exist yet).

- [ ] **Step 4: Implement `schema.ts` (minimal, just enough to pass).** Create `libs/core/src/catalog/schema.ts`. Per-model `safeParse` is the core resilience contract: invalid models are dropped, valid siblings survive. Uses zod v4 and the `.js` ESM specifier convention.

```ts
// libs/core/src/catalog/schema.ts
import { z } from "zod";

export const ModelsDevModelSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  family: z.string().optional(),
  cost: z
    .object({
      input: z.number(),
      output: z.number(),
      cache_read: z.number().optional(),
      cache_write: z.number().optional(),
    })
    .optional(),
  limit: z
    .object({
      context: z.number().optional(),
      output: z.number().optional(),
    })
    .optional(),
  tool_call: z.boolean().optional(),
  structured_output: z.boolean().nullable().optional(),
  reasoning: z.boolean().optional(),
  modalities: z
    .object({
      input: z.array(z.string()).optional(),
      output: z.array(z.string()).optional(),
    })
    .optional(),
  release_date: z.string().optional(),
  last_updated: z.string().optional(),
  knowledge: z.string().optional(),
});
export type ModelsDevModel = z.infer<typeof ModelsDevModelSchema>;

export const ModelsDevProviderSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  api: z.string().nullable().optional(),
  env: z.array(z.string()).optional(),
  models: z.record(z.string(), ModelsDevModelSchema),
});
export type ModelsDevProvider = z.infer<typeof ModelsDevProviderSchema>;

export const ModelsDevCatalogSchema = z.record(z.string(), ModelsDevProviderSchema);
export type ModelsDevCatalog = z.infer<typeof ModelsDevCatalogSchema>;

/**
 * Parse a raw models.dev catalog defensively. Each provider's models are parsed
 * per-model: a structurally-invalid model is dropped, its valid siblings kept,
 * so one bad community entry can never empty a provider. Providers that fail the
 * provider-level shape entirely are skipped.
 */
export function parseModelsDevCatalog(raw: unknown): ModelsDevCatalog {
  const catalog: ModelsDevCatalog = {};
  if (!raw || typeof raw !== "object") return catalog;

  for (const [providerId, rawProvider] of Object.entries(raw as Record<string, unknown>)) {
    if (!rawProvider || typeof rawProvider !== "object") continue;
    const { models: rawModels, ...rest } = rawProvider as Record<string, unknown>;

    const models: Record<string, ModelsDevModel> = {};
    if (rawModels && typeof rawModels === "object") {
      for (const [modelId, rawModel] of Object.entries(rawModels as Record<string, unknown>)) {
        const parsed = ModelsDevModelSchema.safeParse(rawModel);
        if (parsed.success) models[modelId] = parsed.data;
      }
    }

    const provider = ModelsDevProviderSchema.safeParse({ ...rest, models });
    if (provider.success) catalog[providerId] = provider.data;
  }

  return catalog;
}
```

- [ ] **Step 5: Run the test and confirm it PASSES.** Run: `pnpm --filter @diffgazer/core test src/catalog/schema.test.ts`. Expected: PASS 6 tests.

- [ ] **Step 6: Type-check the package.** Run: `pnpm --filter @diffgazer/core type-check`. Expected: PASS.

- [ ] **Step 7: Commit.**
  ```
  git add libs/core/src/catalog/schema.ts libs/core/src/catalog/schema.test.ts libs/core/src/catalog/__fixtures__/catalog.fixture.ts
  git commit -m "$(cat <<'EOF'
feat(core/catalog): add models.dev schema + per-model safeParse parser

ModelsDevCatalogSchema (zod v4, non-strict) and parseModelsDevCatalog parse
each provider's models individually so one malformed model is dropped while its
siblings survive. Absent cost stays undefined (never zeroed). structured_output
is nullable (badge hint, never a parse failure).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 2: `provider-overlay.ts` — `ProviderOverlay` type + `PROVIDER_OVERLAY` (6 enabled) + `SURFACED_OVERLAYS` (3 surfaced)

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

> **Prerequisite (cross-phase):** This task keys `PROVIDER_OVERLAY` as `Record<AIProvider, ProviderOverlay>`, so the `AIProvider` enum must already contain `groq` + `cerebras`. **Run P2 Task 7 (enum expansion) before this task.** Per design D3/D5 the 3 surfaced providers (`mistral`, `huggingface`, `github-models`) are NOT enum members — they live in a separate `SURFACED_OVERLAYS: Record<string, ProviderOverlay>` so the exhaustive `Record<AIProvider, …>` stays sound.

**Files:**
- Create: `libs/core/src/catalog/provider-overlay.ts`
- Test: `libs/core/src/catalog/provider-overlay.test.ts`

Steps:

- [ ] **Step 1: Write the failing test for the overlay.** Create `libs/core/src/catalog/provider-overlay.test.ts`. It pins every curated fact from the design's overlay table.

```ts
// libs/core/src/catalog/provider-overlay.test.ts
import { describe, it, expect } from "vitest";
import { AI_PROVIDERS } from "@diffgazer/core/schemas/config";
import { PROVIDER_OVERLAY, SURFACED_OVERLAYS } from "./provider-overlay.js";

describe("PROVIDER_OVERLAY", () => {
  it("has exactly one row per AIProvider enum member (exhaustive)", () => {
    expect(Object.keys(PROVIDER_OVERLAY).sort()).toEqual([...AI_PROVIDERS].sort());
  });

  it("maps gemini -> ['google'] with GOOGLE_API_KEY and curated free-tier ids", () => {
    const o = PROVIDER_OVERLAY.gemini;
    expect(o.modelsDevIds).toEqual(["google"]);
    expect(o.diffgazerEnvVar).toBe("GOOGLE_API_KEY");
    expect(o.displayName).toBe("Google Gemini");
    expect(o.hasFreeTier).toBe(true);
    expect(o.freeTier).toEqual({
      ids: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"],
    });
    expect(o.defaultModel).toBe("gemini-2.5-flash");
    expect(o.recommendedModelId).toBe("gemini-2.5-flash");
    expect(o.sdkKind).toBe("google");
    expect(o.enabled).toBe(true);
  });

  it("only gemini carries a curated displayName override (others derive from models.dev)", () => {
    expect(PROVIDER_OVERLAY.gemini.displayName).toBe("Google Gemini");
    for (const [id, o] of Object.entries(PROVIDER_OVERLAY)) {
      if (id === "gemini") continue;
      expect(o.displayName, `${id} should derive its name from models.dev`).toBeUndefined();
    }
  });

  it("keeps zai on ZAI_API_KEY (never models.dev's ZHIPU_API_KEY) with no free selector", () => {
    const o = PROVIDER_OVERLAY.zai;
    expect(o.modelsDevIds).toEqual(["zai"]);
    expect(o.diffgazerEnvVar).toBe("ZAI_API_KEY");
    expect(o.hasFreeTier).toBe(true);
    expect(o.freeTier).toBeUndefined();
    expect(o.sdkKind).toBe("zhipu");
    expect(o.baseURL).toBe("https://api.z.ai/api/paas/v4");
  });

  it("maps zai-coding -> ['zai-coding-plan'] with hasFreeTier false and the coding baseURL", () => {
    const o = PROVIDER_OVERLAY["zai-coding"];
    expect(o.modelsDevIds).toEqual(["zai-coding-plan"]);
    expect(o.diffgazerEnvVar).toBe("ZAI_API_KEY");
    expect(o.hasFreeTier).toBe(false);
    expect(o.freeTier).toBeUndefined();
    expect(o.sdkKind).toBe("zhipu");
    expect(o.baseURL).toBe("https://api.z.ai/api/coding/paas/v4");
  });

  it("keeps openrouter on its own live path (enabled, openrouter sdkKind)", () => {
    const o = PROVIDER_OVERLAY.openrouter;
    expect(o.modelsDevIds).toEqual(["openrouter"]);
    expect(o.diffgazerEnvVar).toBe("OPENROUTER_API_KEY");
    expect(o.sdkKind).toBe("openrouter");
    expect(o.enabled).toBe(true);
  });

  it("enables groq with freeTier 'all' and the scout default model", () => {
    const o = PROVIDER_OVERLAY.groq;
    expect(o.modelsDevIds).toEqual(["groq"]);
    expect(o.diffgazerEnvVar).toBe("GROQ_API_KEY");
    expect(o.hasFreeTier).toBe(true);
    expect(o.freeTier).toBe("all");
    expect(o.defaultModel).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
    expect(o.sdkKind).toBe("openai-compatible");
    expect(o.baseURL).toBe("https://api.groq.com/openai/v1");
    expect(o.enabled).toBe(true);
  });

  it("enables cerebras with freeTier 'all', gpt-oss-120b default, and a free-tier note", () => {
    const o = PROVIDER_OVERLAY.cerebras;
    expect(o.modelsDevIds).toEqual(["cerebras"]);
    expect(o.diffgazerEnvVar).toBe("CEREBRAS_API_KEY");
    expect(o.hasFreeTier).toBe(true);
    expect(o.freeTier).toBe("all");
    expect(o.defaultModel).toBe("gpt-oss-120b");
    expect(o.sdkKind).toBe("openai-compatible");
    expect(o.baseURL).toBe("https://api.cerebras.ai/v1");
    expect(o.freeTierNote).toContain("1M");
    expect(o.enabled).toBe(true);
  });
});

describe("SURFACED_OVERLAYS (data-only, not AIProvider members)", () => {
  it("surfaces mistral, huggingface, github-models as disabled", () => {
    expect(Object.keys(SURFACED_OVERLAYS).sort()).toEqual(
      ["github-models", "huggingface", "mistral"].sort(),
    );
    for (const row of Object.values(SURFACED_OVERLAYS)) {
      expect(row.enabled).toBe(false);
    }
    expect(SURFACED_OVERLAYS.mistral!.diffgazerEnvVar).toBe("MISTRAL_API_KEY");
    expect(SURFACED_OVERLAYS.huggingface!.diffgazerEnvVar).toBe("HF_TOKEN");
    expect(SURFACED_OVERLAYS["github-models"]!.diffgazerEnvVar).toBe("GITHUB_TOKEN");
  });
});
```

- [ ] **Step 2: Run the test and confirm it FAILS.** Run: `pnpm --filter @diffgazer/core test src/catalog/provider-overlay.test.ts`. Expected: FAIL — `Cannot find module './provider-overlay.js'`.

- [ ] **Step 3: Implement `provider-overlay.ts`.** Create `libs/core/src/catalog/provider-overlay.ts`. Every value comes straight from the design's overlay table. The `freeTier` selector is the one irreducibly-curated fact (which *priced* models a free quota covers). `gemini` is the first key so `Object.keys(PROVIDER_OVERLAY)[0] === "gemini"` (consumed by `AVAILABLE_PROVIDERS` ordering in Task 11).

```ts
// libs/core/src/catalog/provider-overlay.ts
import type { AIProvider } from "@diffgazer/core/schemas/config";

/** Which PRICED models a provider's free quota covers. `'all'` = whole provider. */
export type FreeTierSelector = "all" | { ids?: string[]; families?: string[] };

export type ProviderOverlay = {
  /** models.dev provider id(s) merged into this Diffgazer provider. */
  modelsDevIds: string[];
  /** Diffgazer's credential env var — NEVER models.dev's (e.g. ZHIPU_API_KEY). */
  diffgazerEnvVar: string;
  /**
   * Optional curated OVERRIDE for the human display name. The PRIMARY source is
   * the models.dev provider `name`; this only overrides it (today: gemini ->
   * "Google Gemini"). Omit to derive from models.dev (then humanize(id)).
   */
  displayName?: string;
  /** Provider-level free-tier badge + free/paid provider filter. */
  hasFreeTier: boolean;
  /** Curated: which priced models the free quota covers. Omit => only zero-cost models are free. */
  freeTier?: FreeTierSelector;
  /** Honest UI prose for the free tier (e.g. daily token cap). */
  freeTierNote?: string;
  defaultModel: string;
  recommendedModelId?: string;
  sdkKind: "google" | "openrouter" | "zhipu" | "openai-compatible";
  /** Required for zhipu + openai-compatible SDK factories. */
  baseURL?: string;
  /** Gates picker selection + createLanguageModel wiring. */
  enabled: boolean;
};

export const PROVIDER_OVERLAY: Record<AIProvider, ProviderOverlay> = {
  gemini: {
    modelsDevIds: ["google"],
    diffgazerEnvVar: "GOOGLE_API_KEY",
    // Curated override: pins the existing "Google Gemini" copy (filter / keyboard /
    // capabilities tests). All other providers derive their name from models.dev.
    displayName: "Google Gemini",
    hasFreeTier: true,
    freeTier: { ids: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"] },
    defaultModel: "gemini-2.5-flash",
    recommendedModelId: "gemini-2.5-flash",
    sdkKind: "google",
    enabled: true,
  },
  zai: {
    modelsDevIds: ["zai"],
    diffgazerEnvVar: "ZAI_API_KEY",
    hasFreeTier: true,
    defaultModel: "glm-4.7",
    recommendedModelId: "glm-4.7",
    sdkKind: "zhipu",
    baseURL: "https://api.z.ai/api/paas/v4",
    enabled: true,
  },
  "zai-coding": {
    modelsDevIds: ["zai-coding-plan"],
    diffgazerEnvVar: "ZAI_API_KEY",
    hasFreeTier: false,
    defaultModel: "glm-4.7",
    recommendedModelId: "glm-4.7",
    sdkKind: "zhipu",
    baseURL: "https://api.z.ai/api/coding/paas/v4",
    enabled: true,
  },
  openrouter: {
    modelsDevIds: ["openrouter"],
    diffgazerEnvVar: "OPENROUTER_API_KEY",
    hasFreeTier: true,
    defaultModel: "",
    sdkKind: "openrouter",
    enabled: true,
  },
  groq: {
    modelsDevIds: ["groq"],
    diffgazerEnvVar: "GROQ_API_KEY",
    hasFreeTier: true,
    freeTier: "all",
    defaultModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    recommendedModelId: "meta-llama/llama-4-scout-17b-16e-instruct",
    sdkKind: "openai-compatible",
    baseURL: "https://api.groq.com/openai/v1",
    enabled: true,
  },
  cerebras: {
    modelsDevIds: ["cerebras"],
    diffgazerEnvVar: "CEREBRAS_API_KEY",
    hasFreeTier: true,
    freeTier: "all",
    freeTierNote: "Cerebras free tier: ~1M tokens/day.",
    defaultModel: "gpt-oss-120b",
    recommendedModelId: "gpt-oss-120b",
    sdkKind: "openai-compatible",
    baseURL: "https://api.cerebras.ai/v1",
    enabled: true,
  },
};

/**
 * Catalog-data-only providers. These are NOT AIProvider enum members (the enum
 * stays closed; only enabled, wired providers are members), so they live outside
 * the exhaustive PROVIDER_OVERLAY record. They are catalog data, NOT shown in any
 * picker until a documented UI boundary exists.
 */
export const SURFACED_OVERLAYS: Record<string, ProviderOverlay> = {
  mistral: {
    modelsDevIds: ["mistral"],
    diffgazerEnvVar: "MISTRAL_API_KEY",
    hasFreeTier: true,
    defaultModel: "",
    sdkKind: "openai-compatible",
    enabled: false,
  },
  huggingface: {
    modelsDevIds: ["huggingface"],
    diffgazerEnvVar: "HF_TOKEN",
    hasFreeTier: true,
    defaultModel: "",
    sdkKind: "openai-compatible",
    baseURL: "https://router.huggingface.co/v1",
    enabled: false,
  },
  "github-models": {
    modelsDevIds: ["github-models"],
    diffgazerEnvVar: "GITHUB_TOKEN",
    hasFreeTier: true,
    defaultModel: "",
    sdkKind: "openai-compatible",
    baseURL: "https://models.github.ai/inference",
    enabled: false,
  },
};
```

- [ ] **Step 4: Run the test and confirm it PASSES.** Run: `pnpm --filter @diffgazer/core test src/catalog/provider-overlay.test.ts`. Expected: PASS 9 tests.

- [ ] **Step 5: Type-check.** Run: `pnpm --filter @diffgazer/core type-check`. Expected: PASS — `Record<AIProvider, ProviderOverlay>` is exhaustive over the 6 enum members.

- [ ] **Step 6: Commit.**
  ```
  git add libs/core/src/catalog/provider-overlay.ts libs/core/src/catalog/provider-overlay.test.ts
  git commit -m "$(cat <<'EOF'
feat(core/catalog): add curated PROVIDER_OVERLAY for 6 enabled + 3 surfaced

PROVIDER_OVERLAY carries the human-judgement facts models.dev cannot supply:
id map, credential env var (ZAI_API_KEY, not ZHIPU_API_KEY), the optional
displayName override (gemini -> "Google Gemini"), hasFreeTier, the
priced-but-quota-free freeTier selector, default/recommended model, SDK kind +
baseURL, and the enabled gate. Surfaced (data-only) providers live in a
separate constant so the AIProvider-keyed record stays exhaustive and closed.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 3: `transform.ts` — `pricingTierOf`, `isModelFreeToUse`, `catalogToModelInfo`

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

**Files:**
- Create: `libs/core/src/catalog/transform.ts`
- Test: `libs/core/src/catalog/transform.test.ts`

Steps:

- [ ] **Step 1: Write the failing test for the transform.** Create `libs/core/src/catalog/transform.test.ts`. Pins every headline tier regression from the design plus the deterministic free-first Gemini order the `model-select-overlay` test depends on.

```ts
// libs/core/src/catalog/transform.test.ts
import { describe, it, expect } from "vitest";
import { parseModelsDevCatalog } from "./schema.js";
import { PROVIDER_OVERLAY } from "./provider-overlay.js";
import { pricingTierOf, isModelFreeToUse, catalogToModelInfo } from "./transform.js";
import { RAW_CATALOG } from "./__fixtures__/catalog.fixture.js";

const catalog = parseModelsDevCatalog(RAW_CATALOG);
const byId = (id: string, provider: keyof typeof PROVIDER_OVERLAY) =>
  catalog[PROVIDER_OVERLAY[provider].modelsDevIds[0]!]!.models[id]!;

describe("pricingTierOf", () => {
  it("returns 'free' for explicit zero cost (input 0, output 0)", () => {
    expect(pricingTierOf(byId("glm-4.7-flash", "zai"))).toBe("free");
  });
  it("returns 'paid' for any positive cost", () => {
    expect(pricingTierOf(byId("gemini-2.5-flash", "gemini"))).toBe("paid");
    expect(pricingTierOf(byId("glm-4.7", "zai"))).toBe("paid");
  });
  it("returns 'unknown' when cost is absent (never collapses to paid)", () => {
    expect(pricingTierOf(byId("gemini-embedding-001", "gemini"))).toBe("unknown");
  });
});

describe("isModelFreeToUse", () => {
  it("gemini-2.5-flash is free despite a positive sticker price (in freeTier.ids)", () => {
    expect(isModelFreeToUse(byId("gemini-2.5-flash", "gemini"), PROVIDER_OVERLAY.gemini)).toBe(true);
  });
  it("gemini-3-pro-preview is paid (priced and NOT in the freeTier selector)", () => {
    expect(isModelFreeToUse(byId("gemini-3-pro-preview", "gemini"), PROVIDER_OVERLAY.gemini)).toBe(false);
  });
  it("zai glm-4.7-flash is free (zero list price, no curation needed)", () => {
    expect(isModelFreeToUse(byId("glm-4.7-flash", "zai"), PROVIDER_OVERLAY.zai)).toBe(true);
  });
  it("zai glm-4.7 is paid (priced, no provider selector)", () => {
    expect(isModelFreeToUse(byId("glm-4.7", "zai"), PROVIDER_OVERLAY.zai)).toBe(false);
  });
  it("zai-coding glm-4.7 is paid despite cost 0/0 (hasFreeTier: false)", () => {
    expect(isModelFreeToUse(byId("glm-4.7", "zai-coding"), PROVIDER_OVERLAY["zai-coding"])).toBe(false);
  });
  it("groq priced model is free (freeTier: 'all')", () => {
    expect(
      isModelFreeToUse(byId("meta-llama/llama-4-scout-17b-16e-instruct", "groq"), PROVIDER_OVERLAY.groq),
    ).toBe(true);
  });
  it("cerebras priced model is free (freeTier: 'all')", () => {
    expect(isModelFreeToUse(byId("gpt-oss-120b", "cerebras"), PROVIDER_OVERLAY.cerebras)).toBe(true);
  });
});

describe("catalogToModelInfo", () => {
  it("produces ModelInfo with derived tier, name, description, and recommended flag", () => {
    const models = catalogToModelInfo(catalog, "gemini");
    const flash = models.find((m) => m.id === "gemini-2.5-flash")!;
    expect(flash.tier).toBe("free");
    expect(flash.recommended).toBe(true);
    expect(flash.name).toBe("Gemini 2.5 Flash");
    expect(flash.description.length).toBeGreaterThan(0);
    const pro3 = models.find((m) => m.id === "gemini-3-pro-preview")!;
    expect(pro3.tier).toBe("paid");
    expect(pro3.recommended).toBeUndefined();
  });

  it("orders Gemini free-first, then deterministically by name (pinned overlay order)", () => {
    const ids = catalogToModelInfo(catalog, "gemini").map((m) => m.id);
    const freeIds = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"];
    const paidIds = ["gemini-3-pro-preview", "gemini-embedding-001"];
    expect(new Set(ids.slice(0, 3))).toEqual(new Set(freeIds));
    for (const free of freeIds) {
      for (const paid of paidIds) {
        expect(ids.indexOf(free)).toBeLessThan(ids.indexOf(paid));
      }
    }
    // Ordering is stable across runs (deterministic).
    expect(catalogToModelInfo(catalog, "gemini").map((m) => m.id)).toEqual(ids);
  });

  it("merges by id across alias modelsDevIds, keeping the freshest last_updated entry", () => {
    // Two source providers carry the same model id; the newer last_updated wins.
    const aliased = parseModelsDevCatalog({
      google: {
        id: "google",
        models: {
          "dup-model": { id: "dup-model", name: "Old Name", cost: { input: 1, output: 1 }, last_updated: "2024-01-01" },
        },
      },
      "google-extra": {
        id: "google-extra",
        models: {
          "dup-model": { id: "dup-model", name: "New Name", cost: { input: 2, output: 2 }, last_updated: "2025-12-01" },
        },
      },
    });
    // Collapse the two source maps the same way the transform does, freshest wins.
    const merged = new Map<string, { name: string; last_updated: string }>();
    for (const sourceId of ["google", "google-extra"]) {
      for (const model of Object.values(aliased[sourceId]!.models)) {
        const existing = merged.get(model.id);
        if (!existing || (model.last_updated ?? "") > existing.last_updated) {
          merged.set(model.id, { name: model.name ?? model.id, last_updated: model.last_updated ?? "" });
        }
      }
    }
    expect(merged.get("dup-model")!.name).toBe("New Name");
    expect(merged.size).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test and confirm it FAILS.** Run: `pnpm --filter @diffgazer/core test src/catalog/transform.test.ts`. Expected: FAIL — `Cannot find module './transform.js'`.

- [ ] **Step 3: Implement `transform.ts`.** Create `libs/core/src/catalog/transform.ts`. Implements the D2 predicate exactly: `pricingTier` from explicit-zero vs absent cost; `isModelFreeToUse` honoring `hasFreeTier` + `'all'` + the id/family selector; `catalogToModelInfo` merging across alias ids (freshest `last_updated`/`release_date` wins), then deterministic free-first then name ordering.

```ts
// libs/core/src/catalog/transform.ts
import type { AIProvider, ModelInfo } from "@diffgazer/core/schemas/config";
import type { ModelsDevCatalog, ModelsDevModel } from "./schema.js";
import { PROVIDER_OVERLAY, type ProviderOverlay } from "./provider-overlay.js";

export type PricingTier = "free" | "paid" | "unknown";

/** Derived from the models.dev sticker price only. Absent cost => 'unknown'. */
export function pricingTierOf(model: ModelsDevModel): PricingTier {
  if (!model.cost) return "unknown";
  return model.cost.input === 0 && model.cost.output === 0 ? "free" : "paid";
}

function matchesSelector(model: ModelsDevModel, overlay: ProviderOverlay): boolean {
  const selector = overlay.freeTier;
  if (!selector || selector === "all") return false;
  if (selector.ids?.includes(model.id)) return true;
  if (model.family && selector.families?.includes(model.family)) return true;
  return false;
}

/**
 * Resolve the public 2-value tier. A model is free to use when it is genuinely
 * zero-priced, OR the provider's whole free quota covers it ('all'), OR it is a
 * priced model the curated selector explicitly covers. Priced models not in the
 * selector default to paid — the safe choice that never falsely claims free.
 */
export function isModelFreeToUse(model: ModelsDevModel, overlay: ProviderOverlay): boolean {
  if (pricingTierOf(model) === "free") return true;
  if (!overlay.hasFreeTier) return false;
  if (overlay.freeTier === "all") return true;
  return matchesSelector(model, overlay);
}

/** Freshest of last_updated then release_date; missing dates sort oldest. */
function freshness(model: ModelsDevModel): string {
  return model.last_updated ?? model.release_date ?? "";
}

function describeModel(model: ModelsDevModel): string {
  const context = model.limit?.context;
  if (context && context >= 1000) {
    return `${model.name ?? model.id} — ${Math.round(context / 1000)}K context.`;
  }
  return model.name ?? model.id;
}

function toModelInfo(model: ModelsDevModel, overlay: ProviderOverlay): ModelInfo {
  const recommended = model.id === overlay.recommendedModelId;
  return {
    id: model.id,
    name: model.name ?? model.id,
    description: describeModel(model),
    tier: isModelFreeToUse(model, overlay) ? "free" : "paid",
    ...(recommended ? { recommended: true } : {}),
  };
}

/**
 * Merge every source provider in overlay.modelsDevIds into one ModelInfo[].
 * Duplicate ids collapse to the freshest entry. Output is deterministic:
 * free models first, then by name (case-insensitive), id as the final tiebreak.
 */
export function catalogToModelInfo(catalog: ModelsDevCatalog, provider: AIProvider): ModelInfo[] {
  const overlay = PROVIDER_OVERLAY[provider];
  const merged = new Map<string, ModelsDevModel>();

  for (const sourceId of overlay.modelsDevIds) {
    const source = catalog[sourceId];
    if (!source) continue;
    for (const model of Object.values(source.models)) {
      const existing = merged.get(model.id);
      if (!existing || freshness(model) > freshness(existing)) {
        merged.set(model.id, model);
      }
    }
  }

  return [...merged.values()]
    .map((model) => toModelInfo(model, overlay))
    .sort((a, b) => {
      const aFree = a.tier === "free" ? 0 : 1;
      const bFree = b.tier === "free" ? 0 : 1;
      if (aFree !== bFree) return aFree - bFree;
      const byName = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      if (byName !== 0) return byName;
      return a.id.localeCompare(b.id);
    });
}
```

- [ ] **Step 4: Run the test and confirm it PASSES.** Run: `pnpm --filter @diffgazer/core test src/catalog/transform.test.ts`. Expected: PASS 13 tests.

- [ ] **Step 5: Type-check.** Run: `pnpm --filter @diffgazer/core type-check`. Expected: PASS.

- [ ] **Step 6: Commit.**
  ```
  git add libs/core/src/catalog/transform.ts libs/core/src/catalog/transform.test.ts
  git commit -m "$(cat <<'EOF'
feat(core/catalog): add transform (pricingTier, free-tier resolver, ModelInfo)

pricingTierOf derives free/paid/unknown from the sticker price alone (absent
cost stays unknown). isModelFreeToUse implements the D2 predicate honoring
hasFreeTier + 'all' + the curated priced-but-quota-free selector.
catalogToModelInfo merges across alias ids (freshest wins) and emits a
deterministic free-first, then-by-name order.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 4: `capabilities.ts` — `deriveCapabilities` → `ProviderCapabilities`

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

**Files:**
- Create: `libs/core/src/catalog/capabilities.ts`
- Test: `libs/core/src/catalog/capabilities.test.ts`

Steps:

- [ ] **Step 1: Write the failing test for `deriveCapabilities`.** Create `libs/core/src/catalog/capabilities.test.ts`. It pins the prose-contract shape (same as today's `PROVIDER_CAPABILITIES` values), the aggregate context window (max `limit.context`), the `mixed` tier when both free and paid models exist, the `tierBadge` from `hasFreeTier`, capability flags derived from any model, and the rule that `structured_output: null` never suppresses the JSON capability.

```ts
// libs/core/src/catalog/capabilities.test.ts
import { describe, it, expect } from "vitest";
import { parseModelsDevCatalog } from "./schema.js";
import { deriveCapabilities } from "./capabilities.js";
import { RAW_CATALOG } from "./__fixtures__/catalog.fixture.js";

const catalog = parseModelsDevCatalog(RAW_CATALOG);

describe("deriveCapabilities", () => {
  it("returns the full ProviderCapabilities prose shape", () => {
    const caps = deriveCapabilities(catalog, "gemini");
    expect(caps).toMatchObject({
      toolCalling: expect.any(String),
      jsonMode: expect.any(String),
      streaming: expect.any(String),
      contextWindow: expect.any(String),
      costDescription: expect.any(String),
    });
    expect(["free", "paid", "mixed"]).toContain(caps.tier);
    expect(["FREE", "PAID"]).toContain(caps.tierBadge);
    expect(Array.isArray(caps.capabilities)).toBe(true);
  });

  it("reports the max limit.context across the provider's models", () => {
    const caps = deriveCapabilities(catalog, "gemini");
    expect(caps.contextWindow).toContain("1M");
  });

  it("sets tier 'mixed' when the provider has both free and paid models", () => {
    expect(deriveCapabilities(catalog, "gemini").tier).toBe("mixed");
  });

  it("derives tierBadge FREE from hasFreeTier true, PAID otherwise", () => {
    expect(deriveCapabilities(catalog, "gemini").tierBadge).toBe("FREE");
    expect(deriveCapabilities(catalog, "zai-coding").tierBadge).toBe("PAID");
  });

  it("derives capability flags from any model exposing tool_call / structured_output / reasoning", () => {
    const caps = deriveCapabilities(catalog, "gemini");
    expect(caps.capabilities).toContain("TOOLS");
    expect(caps.capabilities).toContain("JSON");
  });

  it("does not let structured_output: null hide JSON capability for an otherwise-capable provider", () => {
    const caps = deriveCapabilities(catalog, "zai");
    expect(caps.jsonMode.length).toBeGreaterThan(0);
    expect(caps.toolCalling.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test and confirm it FAILS.** Run: `pnpm --filter @diffgazer/core test src/catalog/capabilities.test.ts`. Expected: FAIL — `Cannot find module './capabilities.js'`.

- [ ] **Step 3: Implement `capabilities.ts`.** Create `libs/core/src/catalog/capabilities.ts`. Produces the same `ProviderCapabilities` shape the current `PROVIDER_CAPABILITIES` values use. Context window is the max `limit.context`. Tier is `mixed` when both free and paid models exist. `tierBadge` comes from `hasFreeTier`. Capability flags are derived from any model's positive flags; `structured_output: null/undefined` is a missing positive hint, never a suppressor.

```ts
// libs/core/src/catalog/capabilities.ts
import type { AIProvider } from "@diffgazer/core/schemas/config";
import type { ModelsDevCatalog, ModelsDevModel } from "./schema.js";
import { PROVIDER_OVERLAY } from "./provider-overlay.js";
import { isModelFreeToUse } from "./transform.js";

export type ProviderCapabilities = {
  toolCalling: string;
  jsonMode: string;
  streaming: string;
  contextWindow: string;
  tier: "free" | "paid" | "mixed";
  tierBadge: "FREE" | "PAID";
  capabilities: string[];
  costDescription: string;
};

function formatContext(maxContext: number): string {
  if (maxContext <= 0) return "Varies by model";
  if (maxContext >= 1_000_000) {
    return `Up to ${(maxContext / 1_000_000).toFixed(maxContext % 1_000_000 === 0 ? 0 : 1)}M tokens`;
  }
  return `Up to ${Math.round(maxContext / 1000)}K tokens`;
}

function resolveTier(models: ModelsDevModel[], provider: AIProvider): "free" | "paid" | "mixed" {
  const overlay = PROVIDER_OVERLAY[provider];
  let hasFree = false;
  let hasPaid = false;
  for (const model of models) {
    if (isModelFreeToUse(model, overlay)) hasFree = true;
    else hasPaid = true;
  }
  if (hasFree && hasPaid) return "mixed";
  if (hasFree) return "free";
  return "paid";
}

export function deriveCapabilities(catalog: ModelsDevCatalog, provider: AIProvider): ProviderCapabilities {
  const overlay = PROVIDER_OVERLAY[provider];
  const models = overlay.modelsDevIds.flatMap((id) => Object.values(catalog[id]?.models ?? {}));

  const maxContext = models.reduce((max, m) => Math.max(max, m.limit?.context ?? 0), 0);
  const anyToolCall = models.some((m) => m.tool_call === true);
  const anyStructured = models.some((m) => m.structured_output === true);
  const anyReasoning = models.some((m) => m.reasoning === true);

  const capabilities: string[] = [];
  if (anyToolCall) capabilities.push("TOOLS");
  // structured_output:null/undefined is a missing positive hint, never a
  // suppressor — JSON mode is offered whenever the provider is a chat provider.
  capabilities.push("JSON");
  if (anyReasoning) capabilities.push("REASONING");

  const tier = resolveTier(models, provider);
  const tierBadge: "FREE" | "PAID" = overlay.hasFreeTier ? "FREE" : "PAID";

  const costDescription = overlay.freeTierNote
    ? `${overlay.freeTierNote} Live pricing per model.`
    : overlay.hasFreeTier
      ? "Free and paid tiers vary by model; live pricing drives the per-model badge."
      : "Paid usage; live pricing drives the per-model badge.";

  return {
    toolCalling: anyToolCall ? "Supported (tool / function calling)" : "Varies by model",
    jsonMode: anyStructured
      ? "Supported (structured output / JSON schema)"
      : "Supported where the model offers JSON output",
    streaming: "Supported (model-dependent)",
    contextWindow: formatContext(maxContext),
    tier,
    tierBadge,
    capabilities,
    costDescription,
  };
}
```

- [ ] **Step 4: Run the test and confirm it PASSES.** Run: `pnpm --filter @diffgazer/core test src/catalog/capabilities.test.ts`. Expected: PASS 6 tests.

- [ ] **Step 5: Type-check.** Run: `pnpm --filter @diffgazer/core type-check`. Expected: PASS.

- [ ] **Step 6: Commit.**
  ```
  git add libs/core/src/catalog/capabilities.ts libs/core/src/catalog/capabilities.test.ts
  git commit -m "$(cat <<'EOF'
feat(core/catalog): add deriveCapabilities producing the prose contract

deriveCapabilities formats tool_call/structured_output/reasoning/limit.context
into the same ProviderCapabilities shape the legacy PROVIDER_CAPABILITIES used:
aggregate context = max limit.context, tier 'mixed' when both free and paid
models exist, tierBadge from overlay.hasFreeTier, capability flags from any
model's positive flags, and a curated/derived costDescription.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 5: `catalog-snapshot.ts` — generator script + committed offline snapshot

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

> **Why a TS module, not JSON (design D6):** `cli/server` builds with plain `tsc` (won't copy a `.json` asset) and the `diffgazer` binary is tsup-bundled with `noExternal` — a TS `export const` is inlined, a runtime `.json` fs path would break. The generator reads a captured `api.json` and emits a trimmed-to-overlay-providers TS module. The snapshot is committed (it is the bundled offline emergency fallback, NOT deterministic generated docs/registry data, so it is exempt from the "do not commit generated" rule and explicitly belongs with the source).
>
> **Enum-independence note:** the generator depends only on `parseModelsDevCatalog` (Task 1) and `PROVIDER_OVERLAY`/`SURFACED_OVERLAYS` (Task 2). The generator script itself can be authored after Task 1; running it to produce the committed snapshot requires Task 2. The snapshot test below imports the overlay, so this task runs after Task 2 + Task 3.

**Files:**
- Create: `libs/core/scripts/generate-catalog-snapshot.ts`
- Create: `libs/core/src/catalog/catalog-snapshot.ts` (GENERATED, committed)
- Create: `libs/core/src/catalog/catalog-snapshot.test.ts`
- Modify: `libs/core/package.json` (add a `generate:catalog-snapshot` script)

Steps:

- [ ] **Step 1: Write the failing test for the snapshot.** Create `libs/core/src/catalog/catalog-snapshot.test.ts`. It asserts the snapshot parses through the schema and covers every enabled provider's default model — so the offline picker is never blank and always has a usable default.

```ts
// libs/core/src/catalog/catalog-snapshot.test.ts
import { describe, it, expect } from "vitest";
import { CATALOG_SNAPSHOT } from "./catalog-snapshot.js";
import { ModelsDevCatalogSchema } from "./schema.js";
import { PROVIDER_OVERLAY } from "./provider-overlay.js";
import { catalogToModelInfo } from "./transform.js";
import type { AIProvider } from "@diffgazer/core/schemas/config";

describe("CATALOG_SNAPSHOT", () => {
  it("conforms to ModelsDevCatalogSchema", () => {
    expect(ModelsDevCatalogSchema.safeParse(CATALOG_SNAPSHOT).success).toBe(true);
  });

  it("covers every enabled provider's source ids", () => {
    for (const overlay of Object.values(PROVIDER_OVERLAY)) {
      if (!overlay.enabled) continue;
      // openrouter is served live; its snapshot source may be empty by design.
      if (overlay.sdkKind === "openrouter") continue;
      for (const sourceId of overlay.modelsDevIds) {
        expect(CATALOG_SNAPSHOT[sourceId], `snapshot missing source ${sourceId}`).toBeDefined();
      }
    }
  });

  it("retains provider-level `name` (the primary display-name source, Decision A)", () => {
    // Without overlay.displayName, AVAILABLE_PROVIDERS resolves the name from the
    // models.dev provider `name` in the snapshot, so it must survive the trim.
    for (const overlay of Object.values(PROVIDER_OVERLAY)) {
      if (!overlay.enabled || overlay.sdkKind === "openrouter") continue;
      const sourceId = overlay.modelsDevIds[0]!;
      expect(CATALOG_SNAPSHOT[sourceId]?.name, `snapshot ${sourceId} must keep name`).toBeTruthy();
    }
  });

  it("includes every enabled provider's default model in its derived list", () => {
    const enabled = (Object.entries(PROVIDER_OVERLAY) as [AIProvider, (typeof PROVIDER_OVERLAY)[AIProvider]][])
      .filter(([, o]) => o.enabled && o.defaultModel && o.sdkKind !== "openrouter");
    for (const [provider, overlay] of enabled) {
      const ids = catalogToModelInfo(CATALOG_SNAPSHOT, provider).map((m) => m.id);
      expect(ids, `${provider} snapshot must include default ${overlay.defaultModel}`).toContain(
        overlay.defaultModel,
      );
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm it FAILS.** Run: `pnpm --filter @diffgazer/core test src/catalog/catalog-snapshot.test.ts`. Expected: FAIL — `Cannot find module './catalog-snapshot.js'`.

- [ ] **Step 3: Write the generator script.** Create `libs/core/scripts/generate-catalog-snapshot.ts`. It reads a captured `api.json` (path via `MODELSDEV_SOURCE` env, default `/tmp/modelsdev.json`), trims to overlay source ids + used fields via `parseModelsDevCatalog`, and emits the TS module. Reusing the parser guarantees the snapshot is shaped exactly like live-parsed data.

```ts
// libs/core/scripts/generate-catalog-snapshot.ts
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseModelsDevCatalog, type ModelsDevCatalog } from "../src/catalog/schema.js";
import { PROVIDER_OVERLAY, SURFACED_OVERLAYS } from "../src/catalog/provider-overlay.js";

const SOURCE = process.env.MODELSDEV_SOURCE ?? "/tmp/modelsdev.json";
const OUT = resolve(import.meta.dirname, "..", "src", "catalog", "catalog-snapshot.ts");

const wantedSourceIds = new Set<string>([
  ...Object.values(PROVIDER_OVERLAY).flatMap((o) => o.modelsDevIds),
  ...Object.values(SURFACED_OVERLAYS).flatMap((o) => o.modelsDevIds),
]);

const raw = JSON.parse(readFileSync(SOURCE, "utf-8")) as unknown;
const parsed = parseModelsDevCatalog(raw);

const trimmed: ModelsDevCatalog = {};
for (const [id, provider] of Object.entries(parsed)) {
  if (wantedSourceIds.has(id)) trimmed[id] = provider;
}

const header = [
  "// GENERATED by libs/core/scripts/generate-catalog-snapshot.ts — DO NOT EDIT BY HAND.",
  "// Offline emergency fallback for the models.dev catalog (design D6).",
  "// Regenerate: pnpm --filter @diffgazer/core generate:catalog-snapshot",
  'import type { ModelsDevCatalog } from "./schema.js";',
  "",
  `export const CATALOG_SNAPSHOT: ModelsDevCatalog = ${JSON.stringify(trimmed, null, 2)};`,
  "",
].join("\n");

writeFileSync(OUT, header, "utf-8");
console.info(`[catalog-snapshot] wrote ${Object.keys(trimmed).length} providers to ${OUT}`);
```

- [ ] **Step 4: Add the generate script to `package.json`.** Modify `libs/core/package.json` `scripts`, placing it next to `verify:dist-esm`:

```jsonc
"generate:catalog-snapshot": "node --import tsx scripts/generate-catalog-snapshot.ts",
```

- [ ] **Step 5: Generate the committed snapshot.** Run: `MODELSDEV_SOURCE=/tmp/modelsdev.json pnpm --filter @diffgazer/core generate:catalog-snapshot`. Expected: stdout `[catalog-snapshot] wrote 9 providers to .../catalog-snapshot.ts` and a new committed `libs/core/src/catalog/catalog-snapshot.ts`. (If `/tmp/modelsdev.json` is absent, fetch it first: `curl -s https://models.dev/api.json -o /tmp/modelsdev.json`.)

- [ ] **Step 6: Run the test and confirm it PASSES.** Run: `pnpm --filter @diffgazer/core test src/catalog/catalog-snapshot.test.ts`. Expected: PASS 4 tests.

- [ ] **Step 7: Type-check.** Run: `pnpm --filter @diffgazer/core type-check`. Expected: PASS.

- [ ] **Step 8: Commit.**
  ```
  git add libs/core/scripts/generate-catalog-snapshot.ts libs/core/src/catalog/catalog-snapshot.ts libs/core/src/catalog/catalog-snapshot.test.ts libs/core/package.json
  git commit -m "$(cat <<'EOF'
feat(core/catalog): generate + commit offline CATALOG_SNAPSHOT (TS module)

generate-catalog-snapshot.ts reads a captured models.dev api.json, trims it to
overlay source ids via parseModelsDevCatalog, and emits a TS export const so the
tsup-bundled diffgazer binary inlines it (a runtime .json fs path would break).
The committed snapshot is the offline emergency fallback (design D6): it covers
every enabled provider and includes each provider's default model.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 6: `index.ts` barrel + `"./catalog"` package export + build proof

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

**Files:**
- Create: `libs/core/src/catalog/index.ts`
- Modify: `libs/core/package.json` (add `"./catalog"` to `exports`)
- Test: `libs/core/src/catalog/index.test.ts`

Steps:

- [ ] **Step 1: Write the failing barrel test.** Create `libs/core/src/catalog/index.test.ts`.

```ts
// libs/core/src/catalog/index.test.ts
import { describe, it, expect } from "vitest";
import * as catalog from "./index.js";

describe("@diffgazer/core/catalog barrel", () => {
  it("re-exports the schema, parser, overlay, transform, capabilities, and snapshot", () => {
    expect(typeof catalog.parseModelsDevCatalog).toBe("function");
    expect(typeof catalog.pricingTierOf).toBe("function");
    expect(typeof catalog.isModelFreeToUse).toBe("function");
    expect(typeof catalog.catalogToModelInfo).toBe("function");
    expect(typeof catalog.deriveCapabilities).toBe("function");
    expect(catalog.PROVIDER_OVERLAY).toBeDefined();
    expect(catalog.SURFACED_OVERLAYS).toBeDefined();
    expect(catalog.CATALOG_SNAPSHOT).toBeDefined();
    expect(catalog.ModelsDevCatalogSchema).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test and confirm it FAILS.** Run: `pnpm --filter @diffgazer/core test src/catalog/index.test.ts`. Expected: FAIL — `Cannot find module './index.js'`.

- [ ] **Step 3: Implement the barrel.** Create `libs/core/src/catalog/index.ts`.

```ts
// libs/core/src/catalog/index.ts
export * from "./schema.js";
export * from "./provider-overlay.js";
export * from "./transform.js";
export * from "./capabilities.js";
export * from "./catalog-snapshot.js";
```

- [ ] **Step 4: Run the test and confirm it PASSES.** Run: `pnpm --filter @diffgazer/core test src/catalog/index.test.ts`. Expected: PASS 1 test.

- [ ] **Step 5: Add the `"./catalog"` subpath export.** Modify `libs/core/package.json` `exports`, immediately after the `"./providers"` entry (mirroring its shape):

```jsonc
"./catalog": {
  "types": "./dist/catalog/index.d.ts",
  "import": "./dist/catalog/index.js"
},
```

- [ ] **Step 6: Build the package to prove the subpath + `.js` specifiers.** `build` runs `tsc` then `verify:dist-esm`, which fails if any emitted relative specifier lacks `.js`. Run: `pnpm --filter @diffgazer/core build`. Expected: PASS — `tsc` emits `dist/catalog/index.js` + `dist/catalog/*.js` and `verify:dist-esm` reports no offenders (exit 0).

- [ ] **Step 7: Verify the subpath resolves from built dist.** Run from the `libs/core` package dir so the workspace export map resolves: `pnpm --filter @diffgazer/core exec node --input-type=module -e "import { PROVIDER_OVERLAY, catalogToModelInfo, CATALOG_SNAPSHOT } from '@diffgazer/core/catalog'; console.log(Object.keys(PROVIDER_OVERLAY).length, catalogToModelInfo(CATALOG_SNAPSHOT, 'gemini').length > 0);"`. Expected: prints `6 true`.

- [ ] **Step 8: Run the full catalog test suite.** Run: `pnpm --filter @diffgazer/core test src/catalog`. Expected: PASS — schema (6) + overlay (8) + transform (13) + capabilities (6) + snapshot (3) + barrel (1) = 37 tests.

- [ ] **Step 9: Commit.**
  ```
  git add libs/core/src/catalog/index.ts libs/core/src/catalog/index.test.ts libs/core/package.json
  git commit -m "$(cat <<'EOF'
feat(core/catalog): add barrel + "./catalog" subpath export

index.ts re-exports schema/overlay/transform/capabilities/snapshot, and
package.json exposes the "./catalog" subpath (mirroring "./providers"). The
tsc build + verify:dist-esm gate proves dist emits explicit .js specifiers so
the new subpath resolves for direct ESM and bundled consumers.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Phase P1 verification gate (run after Tasks 1-6)

- [ ] Run: `pnpm --filter @diffgazer/core test src/catalog` → Expected: PASS 37 tests.
- [ ] Run: `pnpm --filter @diffgazer/core type-check` → Expected: PASS.
- [ ] Run: `pnpm --filter @diffgazer/core build` → Expected: PASS (`tsc` + `verify:dist-esm` clean).
- [ ] Run: `git diff --check` → Expected: no whitespace/conflict errors.

---

## Phase P2 — Config & Providers Migration (`libs/core/src/schemas/config` + `providers`)

> **Position:** design items D2/D5 + "Integration & migration", build step 6. **Task 7 (enum) is the cross-phase prerequisite for P1 Task 2 and everything that keys `Record<AIProvider, …>` — run it immediately after P1 Task 1.** Tasks 8-13 then run after P1 is complete (they import `@diffgazer/core/catalog`).
>
> **Invariant discipline:** every config schema/response/security-allowlist invariant must stay green. The enum expansion auto-ripples into `cli/server/src/shared/lib/config/state.ts` (`DEFAULT_PROVIDERS = AI_PROVIDERS.map(...)`) and `cli/server/src/shared/lib/ai/client.test.ts` (`it.each([...AI_PROVIDERS])`). Those are owned by P4 (`createLanguageModel` branches); P2 guarantees `libs/core` stays correct and lists the cross-package breaks explicitly so nothing is dropped.

### Task 7: Expand `AIProvider` enum with `groq` + `cerebras`

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

**Files:**
- Modify: `libs/core/src/schemas/config/providers.ts` (the `AI_PROVIDERS` tuple, ~line 8)
- Test (new): `libs/core/src/schemas/config/provider-enum.test.ts`

Steps:

- [ ] **Step 1: Write the failing test.** Create `libs/core/src/schemas/config/provider-enum.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { AI_PROVIDERS, AIProviderSchema } from "./providers.js";

describe("AI_PROVIDERS enum membership", () => {
  it("includes the four original providers plus groq and cerebras", () => {
    expect([...AI_PROVIDERS]).toEqual([
      "gemini",
      "zai",
      "zai-coding",
      "openrouter",
      "groq",
      "cerebras",
    ]);
  });

  it("parses groq and cerebras as valid providers", () => {
    expect(AIProviderSchema.safeParse("groq").success).toBe(true);
    expect(AIProviderSchema.safeParse("cerebras").success).toBe(true);
  });

  it("rejects an unknown provider id", () => {
    expect(AIProviderSchema.safeParse("anthropic").success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it & confirm FAIL.** Run: `pnpm --filter @diffgazer/core test src/schemas/config/provider-enum.test.ts`. Expected: FAIL — the deep-equal assertion fails (tuple is the original 4).

- [ ] **Step 3: Minimal implementation.** In `libs/core/src/schemas/config/providers.ts`, change the tuple from `["gemini", "zai", "zai-coding", "openrouter"] as const` to `["gemini", "zai", "zai-coding", "openrouter", "groq", "cerebras"] as const`.

- [ ] **Step 4: Run & confirm PASS.** Run: `pnpm --filter @diffgazer/core test src/schemas/config/provider-enum.test.ts`. Expected: PASS 3 tests.

- [ ] **Step 5: Commit.**
  ```
  git add libs/core/src/schemas/config/providers.ts libs/core/src/schemas/config/provider-enum.test.ts
  git commit -m "$(cat <<'EOF'
feat(core): expand AIProvider enum with groq and cerebras

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

> **Cross-package ripple (handed to P4, listed so it is not dropped):**
> - `cli/server/src/shared/lib/config/state.ts` — `DEFAULT_PROVIDERS = AI_PROVIDERS.map(...)` now seeds groq/cerebras rows automatically (P4 confirms persisted-config normalization round-trips them).
> - `cli/server/src/shared/lib/ai/client.test.ts` — `it.each([...AI_PROVIDERS])` now iterates groq/cerebras; those cases pass only once P4 adds the `createLanguageModel` branches. **Expected temporary red in `cli/server` until P4 lands.**

### Task 8: Relax `isValidModelForProvider` to accept any non-empty model string

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

**Files:**
- Modify: `libs/core/src/schemas/config/providers.ts` (drop the `models.js` import; the function; the `.refine`)
- Modify (test): `libs/core/src/schemas/config/providers.test.ts` (the pinned `UserConfigSchema` refine suite)

Steps:

- [ ] **Step 1: Update the pinned test to assert the relaxed contract.** In `libs/core/src/schemas/config/providers.test.ts`, replace the `it.each` table so it asserts that every provider accepts any non-empty model id, fresh ids validate, and empty/whitespace-only models are rejected:

```ts
describe("UserConfigSchema refine — model/provider validation", () => {
  it.each<{ name: string; overrides: Record<string, unknown>; success: boolean }>([
    { name: "gemini with a known gemini model", overrides: { model: "gemini-2.5-flash" }, success: true },
    { name: "gemini with a fresh (catalog-supplied) id", overrides: { model: "gemini-3-pro" }, success: true },
    { name: "zai with a fresh GLM id", overrides: { provider: "zai", model: "glm-5.1" }, success: true },
    { name: "zai-coding with a GLM id", overrides: { provider: "zai-coding", model: "glm-4.7" }, success: true },
    { name: "openrouter with arbitrary model id", overrides: { provider: "openrouter", model: "any-model-id/whatever" }, success: true },
    { name: "groq with a fresh id", overrides: { provider: "groq", model: "meta-llama/llama-4-scout-17b-16e-instruct" }, success: true },
    { name: "cerebras with a fresh id", overrides: { provider: "cerebras", model: "gpt-oss-120b" }, success: true },
    { name: "any provider with model omitted", overrides: {}, success: true },
    { name: "any provider with an empty model string", overrides: { model: "" }, success: false },
    { name: "any provider with a whitespace-only model string", overrides: { model: "   " }, success: false },
  ])("$name → success=$success", ({ overrides, success }) => {
    const result = UserConfigSchema.safeParse({ ...baseConfig, ...overrides });
    expect(result.success).toBe(success);
  });
});
```

> Keep the existing `baseConfig` test fixture in this file (provider `gemini` by default). If it is not already present, define it at the top of the suite with the minimum required `UserConfig` fields.

- [ ] **Step 2: Run it & confirm FAIL.** Run: `pnpm --filter @diffgazer/core test src/schemas/config/providers.test.ts`. Expected: FAIL — the fresh-id rows fail (current refine rejects `gemini-3-pro`/`glm-5.1`) and the whitespace-only row fails (current refine accepts `"   "`). At least 4 failing rows.

- [ ] **Step 3: Minimal implementation.** In `libs/core/src/schemas/config/providers.ts`: delete the `import { GEMINI_MODELS, GLM_MODELS } from "./models.js";` line, and replace `isValidModelForProvider` with:

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

> The `UserConfigSchema.refine` stays exactly as written — `!data.model || isValidModelForProvider(...)` — so an omitted model still passes and a present-but-empty model now fails.

- [ ] **Step 4: Run & confirm PASS.** Run: `pnpm --filter @diffgazer/core test src/schemas/config/providers.test.ts`. Expected: PASS 10 tests.

- [ ] **Step 5: Commit.**
  ```
  git add libs/core/src/schemas/config/providers.ts libs/core/src/schemas/config/providers.test.ts
  git commit -m "$(cat <<'EOF'
feat(core): relax isValidModelForProvider to non-empty string

Models are now supplied live by the catalog, so config validation no longer
gates on hand-maintained model arrays. Empty/whitespace model ids are still
rejected; server-side activateProvider validates against the live list.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 9: Derive `PROVIDER_ENV_VARS` + `ALLOWED_CREDENTIAL_ENV_VARS` from `PROVIDER_OVERLAY`

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

**Files:**
- Modify: `libs/core/src/schemas/config/capabilities.ts` (`PROVIDER_ENV_VARS` + `ALLOWED_CREDENTIAL_ENV_VARS`)
- Test (new): `libs/core/src/schemas/config/env-vars.test.ts`

Steps:

- [ ] **Step 1: Write the failing test** (the security allowlist regression guard). Create `libs/core/src/schemas/config/env-vars.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PROVIDER_ENV_VARS, ALLOWED_CREDENTIAL_ENV_VARS } from "./capabilities.js";
import { AI_PROVIDERS } from "./providers.js";

describe("PROVIDER_ENV_VARS (security allowlist source)", () => {
  it("maps every provider in the enum to an env var (exhaustive)", () => {
    for (const id of AI_PROVIDERS) {
      expect(PROVIDER_ENV_VARS[id], `missing env var for ${id}`).toBeTruthy();
    }
  });

  it("keeps zai and zai-coding on ZAI_API_KEY, never models.dev's ZHIPU_API_KEY", () => {
    expect(PROVIDER_ENV_VARS.zai).toBe("ZAI_API_KEY");
    expect(PROVIDER_ENV_VARS["zai-coding"]).toBe("ZAI_API_KEY");
    expect(Object.values(PROVIDER_ENV_VARS)).not.toContain("ZHIPU_API_KEY");
  });

  it("keeps the original provider env vars unchanged", () => {
    expect(PROVIDER_ENV_VARS.gemini).toBe("GOOGLE_API_KEY");
    expect(PROVIDER_ENV_VARS.openrouter).toBe("OPENROUTER_API_KEY");
  });

  it("adds GROQ_API_KEY and CEREBRAS_API_KEY for the new providers", () => {
    expect(PROVIDER_ENV_VARS.groq).toBe("GROQ_API_KEY");
    expect(PROVIDER_ENV_VARS.cerebras).toBe("CEREBRAS_API_KEY");
  });
});

describe("ALLOWED_CREDENTIAL_ENV_VARS (security allowlist)", () => {
  it("admits exactly the provider env vars", () => {
    expect(ALLOWED_CREDENTIAL_ENV_VARS.has("GOOGLE_API_KEY")).toBe(true);
    expect(ALLOWED_CREDENTIAL_ENV_VARS.has("ZAI_API_KEY")).toBe(true);
    expect(ALLOWED_CREDENTIAL_ENV_VARS.has("GROQ_API_KEY")).toBe(true);
    expect(ALLOWED_CREDENTIAL_ENV_VARS.has("CEREBRAS_API_KEY")).toBe(true);
  });

  it("rejects unknown env vars", () => {
    expect(ALLOWED_CREDENTIAL_ENV_VARS.has("ZHIPU_API_KEY")).toBe(false);
    expect(ALLOWED_CREDENTIAL_ENV_VARS.has("PATH")).toBe(false);
    expect(ALLOWED_CREDENTIAL_ENV_VARS.has("AWS_SECRET_ACCESS_KEY")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it & confirm FAIL.** Run: `pnpm --filter @diffgazer/core test src/schemas/config/env-vars.test.ts`. Expected: FAIL — `PROVIDER_ENV_VARS.groq` is `undefined` (the hand-written record lacks groq/cerebras). At least 2 failing.

- [ ] **Step 3: Minimal implementation.** In `libs/core/src/schemas/config/capabilities.ts`, add the catalog import at the top:

```ts
import { PROVIDER_OVERLAY, type ProviderOverlay } from "@diffgazer/core/catalog";
```

and replace the hand-written `PROVIDER_ENV_VARS` + `ALLOWED_CREDENTIAL_ENV_VARS` block with:

```ts
export const PROVIDER_ENV_VARS = Object.fromEntries(
  (Object.entries(PROVIDER_OVERLAY) as [AIProvider, ProviderOverlay][]).map(
    ([id, overlay]) => [id, overlay.diffgazerEnvVar],
  ),
) as Record<AIProvider, string>;

/** The set of env var names valid for `CredentialRef` with `kind: "env"`. */
export const ALLOWED_CREDENTIAL_ENV_VARS: ReadonlySet<string> = new Set(
  Object.values(PROVIDER_ENV_VARS),
);
```

- [ ] **Step 4: Run & confirm PASS.** Run: `pnpm --filter @diffgazer/core test src/schemas/config/env-vars.test.ts`. Expected: PASS 6 tests.

- [ ] **Step 5: Commit.**
  ```
  git add libs/core/src/schemas/config/capabilities.ts libs/core/src/schemas/config/env-vars.test.ts
  git commit -m "$(cat <<'EOF'
feat(core): derive provider env-var allowlist from PROVIDER_OVERLAY

Keeps zai/zai-coding on ZAI_API_KEY (never models.dev's ZHIPU_API_KEY) and
adds GROQ_API_KEY/CEREBRAS_API_KEY. The credential security allowlist stays
exhaustive over the enum and still rejects unknown env vars.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 10: Derive `AVAILABLE_PROVIDERS` + `PROVIDER_CAPABILITIES` from the overlay/snapshot

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

**Files:**
- Modify: `libs/core/src/schemas/config/capabilities.ts` (imports, `resolveProviderDisplayName`, `AVAILABLE_PROVIDERS`, `PROVIDER_CAPABILITIES`)
- Test (new): `libs/core/src/schemas/config/capabilities.test.ts`

> `PROVIDER_CAPABILITIES` and `AVAILABLE_PROVIDERS` are consumed **synchronously as static module values** by `providers/filter.ts`, `providers/list.ts`, `onboarding/defaults.ts`, and web/CLI components. `deriveCapabilities(catalog, provider)` needs a catalog, so these statics are built once at module load from the always-present bundled `CATALOG_SNAPSHOT` (never a network call). `gemini` stays first (the first `PROVIDER_OVERLAY` key) so `AVAILABLE_PROVIDERS[0]` = gemini. `AVAILABLE_PROVIDERS` includes only `enabled` providers (the 6 wired) so the onboarding picker shows exactly the selectable set.

> **Display-name resolution (Decision A):** the provider's human name is resolved `overlay.displayName ?? <models.dev provider `name` for the primary `modelsDevId`, read from `CATALOG_SNAPSHOT`> ?? humanize(id)`. The PRIMARY source is the models.dev provider `name`; `displayName` is a curated override only (today only `gemini` -> `"Google Gemini"`). This replaces a hand-written name map, so new providers are zero-maintenance. The resolver lives in `capabilities.ts` (the AVAILABLE_PROVIDERS derivation already imports `PROVIDER_OVERLAY` + `CATALOG_SNAPSHOT`); no separate presentation map is created.

Steps:

- [ ] **Step 1: Write the failing test.** Create `libs/core/src/schemas/config/capabilities.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { AVAILABLE_PROVIDERS, PROVIDER_CAPABILITIES, OPENROUTER_PROVIDER_ID } from "./capabilities.js";
import { AI_PROVIDERS } from "./providers.js";

describe("AVAILABLE_PROVIDERS (derived from overlay)", () => {
  it("lists gemini first to preserve the onboarding default", () => {
    expect(AVAILABLE_PROVIDERS[0]?.id).toBe("gemini");
  });

  it("lists only the six enabled providers (no disabled/surfaced providers in the picker)", () => {
    // Decision C: pickers render ONLY enabled providers; surfaced data-only
    // providers (mistral/huggingface/github-models) are catalog data, not picker rows.
    const ids = AVAILABLE_PROVIDERS.map((p) => p.id);
    expect(ids).toEqual(["gemini", "zai", "zai-coding", "openrouter", "groq", "cerebras"]);
    for (const surfaced of ["mistral", "huggingface", "github-models"]) {
      expect(ids).not.toContain(surfaced);
    }
  });

  it("carries each enabled provider's default model from the overlay", () => {
    expect(AVAILABLE_PROVIDERS.find((p) => p.id === "gemini")?.defaultModel).toBe("gemini-2.5-flash");
    expect(AVAILABLE_PROVIDERS.find((p) => p.id === "groq")?.defaultModel).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
  });

  it("resolves the curated displayName override for gemini", () => {
    expect(AVAILABLE_PROVIDERS.find((p) => p.id === "gemini")?.name).toBe("Google Gemini");
  });

  it("resolves names from the models.dev snapshot when there is no override", () => {
    // groq/cerebras carry no overlay.displayName, so the name comes from the
    // models.dev provider `name` in CATALOG_SNAPSHOT.
    expect(AVAILABLE_PROVIDERS.find((p) => p.id === "groq")?.name).toBe("Groq");
    expect(AVAILABLE_PROVIDERS.find((p) => p.id === "cerebras")?.name).toBe("Cerebras");
  });

  it("keeps OPENROUTER_PROVIDER_ID resolvable", () => {
    expect(OPENROUTER_PROVIDER_ID).toBe("openrouter");
  });
});

describe("PROVIDER_CAPABILITIES (derived from snapshot)", () => {
  it("exposes a capability card for every provider in the enum", () => {
    for (const id of AI_PROVIDERS) {
      const cap = PROVIDER_CAPABILITIES[id];
      expect(cap, `missing capabilities for ${id}`).toBeTruthy();
      expect(typeof cap.toolCalling).toBe("string");
      expect(typeof cap.jsonMode).toBe("string");
      expect(typeof cap.streaming).toBe("string");
      expect(typeof cap.contextWindow).toBe("string");
      expect(["free", "paid", "mixed"]).toContain(cap.tier);
      expect(["FREE", "PAID"]).toContain(cap.tierBadge);
      expect(Array.isArray(cap.capabilities)).toBe(true);
      expect(typeof cap.costDescription).toBe("string");
    }
  });

  it("marks free-tier providers with a FREE badge", () => {
    expect(PROVIDER_CAPABILITIES.gemini.tierBadge).toBe("FREE");
    expect(PROVIDER_CAPABILITIES.groq.tierBadge).toBe("FREE");
    expect(PROVIDER_CAPABILITIES.cerebras.tierBadge).toBe("FREE");
  });

  it("marks zai-coding as paid (no free tier)", () => {
    expect(PROVIDER_CAPABILITIES["zai-coding"].tierBadge).toBe("PAID");
  });
});
```

- [ ] **Step 2: Run it & confirm FAIL.** Run: `pnpm --filter @diffgazer/core test src/schemas/config/capabilities.test.ts`. Expected: FAIL — `includes the six enabled providers` fails (current list has 4) and `PROVIDER_CAPABILITIES.groq` is `undefined`. At least 4 failing.

- [ ] **Step 3: Rewrite the two statics in `capabilities.ts` with the display-name resolver.** Replace the hand-written `AVAILABLE_PROVIDERS` and `PROVIDER_CAPABILITIES` (and remove any now-unused `GEMINI_MODELS`/`GLM_MODELS` import) with overlay/snapshot derivations. The provider name is resolved `overlay.displayName ?? <models.dev `name`> ?? humanize(id)` (Decision A) — no separate presentation map:

```ts
import type { AIProvider, ProviderInfo } from "./providers.js";
import {
  PROVIDER_OVERLAY,
  type ProviderOverlay,
  type ProviderCapabilities,
  deriveCapabilities,
  CATALOG_SNAPSHOT,
} from "@diffgazer/core/catalog";

export const OPENROUTER_PROVIDER_ID: AIProvider = "openrouter";

/** "google" -> "Google"; "github-models" -> "Github Models". Last-resort fallback. */
function humanize(id: string): string {
  return id
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Resolve a provider's human display name. PRIMARY source is the models.dev
 * provider `name` (from CATALOG_SNAPSHOT for the overlay's primary modelsDevId);
 * `overlay.displayName` is a curated OVERRIDE (today only gemini); humanize(id)
 * is the last-resort fallback.
 */
export function resolveProviderDisplayName(provider: AIProvider): string {
  const overlay = PROVIDER_OVERLAY[provider];
  const modelsDevName = CATALOG_SNAPSHOT[overlay.modelsDevIds[0]!]?.name;
  return overlay.displayName ?? modelsDevName ?? humanize(provider);
}

const ENABLED_PROVIDER_IDS = (Object.entries(PROVIDER_OVERLAY) as [AIProvider, ProviderOverlay][])
  .filter(([, overlay]) => overlay.enabled)
  .map(([id]) => id);

export const AVAILABLE_PROVIDERS: ProviderInfo[] = ENABLED_PROVIDER_IDS.map((id) => ({
  id,
  name: resolveProviderDisplayName(id),
  defaultModel: PROVIDER_OVERLAY[id].defaultModel,
  // Runtime model lists come from the catalog route; the static array is no
  // longer the source of truth.
  models: [],
}));

export const PROVIDER_CAPABILITIES = Object.fromEntries(
  (Object.keys(PROVIDER_OVERLAY) as AIProvider[]).map((id) => [
    id,
    deriveCapabilities(CATALOG_SNAPSHOT, id),
  ]),
) as Record<AIProvider, ProviderCapabilities>;
```

> Keep the `Object.fromEntries` block AND the `import { PROVIDER_OVERLAY, type ProviderOverlay } from "@diffgazer/core/catalog";` added in Task 9 deduplicated into the single import shown above (merge, don't double-import).

- [ ] **Step 4: Run & confirm PASS.** Run: `pnpm --filter @diffgazer/core test src/schemas/config/capabilities.test.ts`. Expected: PASS 9 tests.

- [ ] **Step 5: Commit.**
  ```
  git add libs/core/src/schemas/config/capabilities.ts libs/core/src/schemas/config/capabilities.test.ts
  git commit -m "$(cat <<'EOF'
feat(core): derive AVAILABLE_PROVIDERS and PROVIDER_CAPABILITIES from catalog

AVAILABLE_PROVIDERS enumerates the enabled overlay providers (gemini first) and
PROVIDER_CAPABILITIES is derived from the bundled CATALOG_SNAPSHOT via
deriveCapabilities, replacing the hand-written prose record. Provider display
names resolve from models.dev (overlay.displayName override -> models.dev name
-> humanize(id)); only gemini keeps the "Google Gemini" override.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 11: Delete the hand-maintained Gemini/GLM model constants from `models.ts`

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

**Files:**
- Modify: `libs/core/src/schemas/config/models.ts` (delete `GEMINI_MODELS`, `GeminiModelSchema`, `GeminiModel`, `GEMINI_MODEL_INFO`, `GLM_MODELS`, `GLMModelSchema`, `GLMModel`, `GLM_MODEL_INFO`; **keep** `ModelInfoSchema`/`ModelInfo` and all OpenRouter schemas)
- Test (new): `libs/core/src/schemas/config/models.test.ts`

> By this point `providers.ts` (Task 8) and `capabilities.ts` (Task 10) no longer import the Gemini/GLM constants, so deleting them only breaks `providers/models.ts` (Task 12) and app consumers (P5).

Steps:

- [ ] **Step 1: Write the failing test.** Create `libs/core/src/schemas/config/models.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as models from "./models.js";
import { OpenRouterModelSchema, OpenRouterModelCacheSchema } from "./models.js";

describe("schemas/config/models exports", () => {
  it("no longer exports the hand-maintained Gemini/GLM constants", () => {
    expect("GEMINI_MODELS" in models).toBe(false);
    expect("GEMINI_MODEL_INFO" in models).toBe(false);
    expect("GLM_MODELS" in models).toBe(false);
    expect("GLM_MODEL_INFO" in models).toBe(false);
  });

  it("keeps the OpenRouter schemas for the live OpenRouter path", () => {
    expect(
      OpenRouterModelSchema.safeParse({
        id: "openai/gpt-4o", name: "GPT-4o", contextLength: 128000,
        pricing: { prompt: "0", completion: "0" }, isFree: false,
      }).success,
    ).toBe(true);
    expect(
      OpenRouterModelCacheSchema.safeParse({ models: [], fetchedAt: new Date().toISOString() }).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run it & confirm FAIL.** Run: `pnpm --filter @diffgazer/core test src/schemas/config/models.test.ts`. Expected: FAIL — `GEMINI_MODELS` still present.

- [ ] **Step 3: Delete the constants.** In `libs/core/src/schemas/config/models.ts`, delete `GEMINI_MODELS`/`GeminiModelSchema`/`GeminiModel`/`GEMINI_MODEL_INFO` and `GLM_MODELS`/`GLMModelSchema`/`GLMModel`/`GLM_MODEL_INFO` (incl. stale "promo ended" prose). Keep `ModelInfoSchema`/`ModelInfo` and the full OpenRouter block (`OpenRouterModelSchema`, `OpenRouterModelCacheSchema`, `OpenRouterModelsResponseSchema`, and their inferred types).

- [ ] **Step 4: Run & confirm PASS.** Run: `pnpm --filter @diffgazer/core test src/schemas/config/models.test.ts`. Expected: PASS 2 tests.

- [ ] **Step 5: Commit.**
  ```
  git add libs/core/src/schemas/config/models.ts libs/core/src/schemas/config/models.test.ts
  git commit -m "$(cat <<'EOF'
feat(core): delete hand-maintained Gemini/GLM model constants

Models now come live from the catalog. Removes GEMINI_MODELS/GEMINI_MODEL_INFO
and GLM_MODELS/GLM_MODEL_INFO (incl. stale promo prose); keeps OpenRouter
schemas (live OpenRouter path) and the public ModelInfo schema.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 12: Rewrite `providers/models.ts` — drop static branches, keep the OpenRouter live mapping

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

**Files:**
- Modify: `libs/core/src/providers/models.ts` (delete `getStaticModelsForProvider`; rewrite `buildModels`; keep `filterModels`/`cycleTierFilter`/`TIER_FILTERS`)
- Modify (test): `libs/core/src/providers/models.test.ts`

> Non-OpenRouter model lists are now produced by the server route via `catalogToModelInfo`; web/TUI pull them through `useProviderModels` (P5). `buildModels` therefore only owns the OpenRouter live mapping. `filterModels`/`cycleTierFilter`/`TIER_FILTERS` are unchanged pure UI-side primitives.

Steps:

- [ ] **Step 1: Update the test file.** In `libs/core/src/providers/models.test.ts`: remove `getStaticModelsForProvider` from imports + its `describe` block; delete the two static-model `buildModels` cases; keep the OpenRouter case; add an empty-list assertion for non-openrouter providers:

```ts
describe("buildModels", () => {
  it("maps OpenRouter models for openrouter provider", () => {
    const openRouterModels: OpenRouterModel[] = [
      { id: "or/free-model", name: "Free Model", description: "A free model", contextLength: 8000, pricing: { prompt: "0", completion: "0" }, isFree: true },
      { id: "or/paid-model", name: "Paid Model", description: "A paid model", contextLength: 16000, pricing: { prompt: "1", completion: "1" }, isFree: false },
    ];
    const result = buildModels("openrouter", openRouterModels);
    expect(result.map((m) => m.id)).toEqual(["or/free-model", "or/paid-model"]);
    expect(result.map((m) => m.tier)).toEqual(["free", "paid"]);
  });

  it("returns an empty list for non-openrouter providers (no static fallback)", () => {
    expect(buildModels("gemini", [])).toEqual([]);
    expect(buildModels("zai", [])).toEqual([]);
    expect(buildModels("groq", [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it & confirm FAIL.** Run: `pnpm --filter @diffgazer/core test src/providers/models.test.ts`. Expected: FAIL — the new empty-list case fails (current `buildModels("gemini", [])` returns static gemini models) and/or the deleted-import compile break.

- [ ] **Step 3: Rewrite.** Replace the imports + `getStaticModelsForProvider` + `buildModels` in `libs/core/src/providers/models.ts` with:

```ts
import type { AIProvider, ModelInfo, OpenRouterModel } from "@diffgazer/core/schemas/config";
import { mapOpenRouterModels } from "../api/openrouter-utils.js";

export const TIER_FILTERS = ["all", "free", "paid"] as const;
export type TierFilter = (typeof TIER_FILTERS)[number];

/**
 * Builds the model list for a provider. OpenRouter is mapped from its live API
 * response; every other provider's models are supplied by the catalog route
 * (ModelInfo[] over HTTP), so there is nothing to build client-side here.
 */
export function buildModels(providerId: AIProvider, openRouterModels: OpenRouterModel[]): ModelInfo[] {
  if (providerId === "openrouter") return mapOpenRouterModels(openRouterModels);
  return [];
}
```

Keep `filterModels` and `cycleTierFilter` exactly as they are.

> Verify `mapOpenRouterModels` is the correct existing helper path. If `buildModels` already maps OpenRouter inline rather than via `mapOpenRouterModels`, preserve that exact mapping logic instead of introducing a new import — do not change OpenRouter behavior.

- [ ] **Step 4: Run & confirm PASS.** Run: `pnpm --filter @diffgazer/core test src/providers/models.test.ts`. Expected: PASS (`filterModels` + `cycleTierFilter` + `buildModels` cases).

- [ ] **Step 5: Commit.**
  ```
  git add libs/core/src/providers/models.ts libs/core/src/providers/models.test.ts
  git commit -m "$(cat <<'EOF'
feat(core): drop static provider model branches from buildModels

getStaticModelsForProvider is removed and buildModels now only maps the live
OpenRouter response; all other providers receive ModelInfo[] from the catalog
route. filterModels/cycleTierFilter/TIER_FILTERS are unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 13: Confirm libs/core-internal consumers compile + add server-side model validation at `activateProvider`

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

> **Scope split (stated so nothing is dropped):** the `.tsx` web/TUI consumer swaps and their tests are owned by **P5 (Tasks 23-27)** — they depend on the `useProviderModels` hook (P5 Task 21) and must merge alongside the deletions. This Task owns only (a) confirming the libs/core-internal consumers still compile after the deletions, and (b) the server-side `activateProvider` model validation required by design D5. The `activateProvider` validation depends on `getProviderModels` (P3 Task 16), so the concrete test wiring lands once P3 is merged; the requirement and exact code are recorded here.

**Files:**
- Modify: `cli/server/src/features/config/service.ts` (`activateProvider` model validation)
- Modify (test): `cli/server/src/features/config/service.test.ts`

Steps:

- [ ] **Step 1: Confirm the libs/core-internal consumers compile.** The remaining libs/core consumers (`onboarding/defaults.ts`, `onboarding/use-wizard-state.ts`, `onboarding/save-wizard.ts`, `providers/list.ts`, `providers/filter.ts`) consume only `AVAILABLE_PROVIDERS`/`PROVIDER_ENV_VARS`/`PROVIDER_CAPABILITIES`, which still exist (now derived). Run: `pnpm --filter @diffgazer/core type-check`. Expected: PASS (0 errors). If `providers/filter.ts` errors on the `tier` shape, confirm `ProviderCapabilities.tier` is `'free'|'paid'|'mixed'` (it is, per Task 4) — no change needed.

- [ ] **Step 2: Run the full libs/core suite to confirm config invariants are green.** Run: `pnpm --filter @diffgazer/core test`. Expected: PASS — including `provider-enum`, `providers`, `env-vars`, `capabilities`, `models`, `providers/models`, `onboarding/defaults`, `onboarding/use-wizard-state`.

- [ ] **Step 3: Add server-side model validation at `activateProvider`.** In `cli/server/src/features/config/service.ts`, in the `activateProvider` service path, when a model is supplied, fetch the provider's live catalog models and reject an unknown id (OpenRouter exempt — its catalog is the live key-gated route). Concrete code (depends on `getProviderModels` from P3 Task 16 + `ErrorCode` already used in this file):

```ts
import { getProviderModels } from "../../shared/lib/ai/models-dev-catalog.js";

// inside activateProvider, after provider validation, when `model` is present:
if (model && providerId !== "openrouter") {
  const { models } = await getProviderModels(providerId);
  const known = models.some((m) => m.id === model);
  if (!known) {
    return err(createError(ErrorCode.MODEL_ERROR, `Model "${model}" is not available for provider "${providerId}".`));
  }
}
```

> If `ErrorCode.MODEL_ERROR` is not a member of the repo `ErrorCode` enum, use the bare-string form `createError("MODEL_ERROR", ...)` matching the existing `activateProvider` `createError("PROVIDER_NOT_FOUND", ...)` convention in the same file (verify by reading the file before editing).

- [ ] **Step 4: Add a focused service test** mirroring the existing credential-validation tests in `cli/server/src/features/config/service.test.ts`: with the `models-dev-catalog.js` module mocked, a known model activates and an unknown one is rejected. (This test depends on P3; if P3 is not yet merged when this Task runs, record it as a P3-blocked sub-step and complete it during P4.)

- [ ] **Step 5: Run the focused server test.** Run: `pnpm --filter @diffgazer/server test src/features/config/service.test.ts`. Expected: PASS (or, if P3 not yet merged, recorded as blocked and completed in P4).

- [ ] **Step 6: Commit.**
  ```
  git add cli/server/src/features/config/service.ts cli/server/src/features/config/service.test.ts
  git commit -m "$(cat <<'EOF'
feat(server): validate activated model against the live catalog

activateProvider now rejects a model id absent from the provider's live
catalog list (OpenRouter exempt — live key-gated route). Closes design D5's
server-side validation requirement against the relaxed config contract.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Phase P2 verification gate (run after Tasks 7-13)

- [ ] Run: `pnpm --filter @diffgazer/core type-check` → Expected: PASS (no deleted-symbol references in libs/core).
- [ ] Run: `pnpm --filter @diffgazer/core test` → Expected: PASS (all config + providers suites).
- [ ] Run: `pnpm --filter @diffgazer/core test src/schemas/config/env-vars.test.ts` → Expected: PASS 6 (incl. `ZHIPU_API_KEY` rejected).
- [ ] Run: `pnpm --filter @diffgazer/core test src/schemas/config/providers.test.ts -t "fresh"` → Expected: PASS (`gemini-3-pro`, `glm-5.1` validate).
- [ ] Run: `git diff --check` → Expected: clean.
- [ ] **Record remaining cross-phase reds:** until P4 lands, `cli/server` type-check and `client.test.ts` (`it.each([...AI_PROVIDERS])`) remain red on groq/cerebras. Report as a dependency on P4; do not claim feature-ready.

---

## Phase P3 — Server Fetch + Cache + Fallback (`cli/server`)

> **Layer (I/O):** keyless `GET models.dev/api.json`, shared 24h disk cache, shrink-guard, three-tier resolution (`fresh disk → live(persist) → stale disk → CATALOG_SNAPSHOT`), `DIFFGAZER_OFFLINE` escape hatch, `getProviderModels(id)`. Pure transforms/schema/overlay/snapshot are consumed from `@diffgazer/core/catalog` (P1). **Depends on P1 complete + P2 Task 7 (enum). May overlap P2 Tasks 8-13.**
> **Reference precedent (read before editing):** `cli/server/src/shared/lib/ai/openrouter-models.ts`, `cli/server/src/shared/lib/ai/openrouter-models.test.ts`, `cli/server/src/shared/lib/paths.ts`, `cli/server/src/shared/lib/fs.ts`. ESM with explicit `.js` specifiers; `Result` from `@diffgazer/core/result`; `getErrorMessage` from `@diffgazer/core/errors`; `readJsonFileSync`/`writeJsonFileSync` (atomic, `0o600`) from `../fs.js`; cache dir via `getGlobalDiffgazerDir()` (honors `DIFFGAZER_HOME`); `AbortSignal.timeout(10_000)`; tests stub `globalThis.fetch` with `vi.spyOn` and a `mkdtempSync` temp dir assigned to `process.env.DIFFGAZER_HOME` (mirrors the OpenRouter test harness).

### Task 14: `getGlobalModelsDevCatalogPath()` in `paths.ts`

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

**Files:**
- Modify: `cli/server/src/shared/lib/paths.ts` (add export beside `getGlobalOpenRouterModelsPath`)
- Test (new): `cli/server/src/shared/lib/paths.test.ts`

Steps:

- [ ] **Step 1: Write the failing test.** Create `cli/server/src/shared/lib/paths.test.ts`:

```ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getGlobalModelsDevCatalogPath } from "./paths.js";

let testHome: string;

beforeEach(() => {
  testHome = fs.mkdtempSync(path.join(os.tmpdir(), "dg-paths-"));
  process.env.DIFFGAZER_HOME = testHome;
});

afterEach(() => {
  delete process.env.DIFFGAZER_HOME;
  fs.rmSync(testHome, { recursive: true, force: true });
});

describe("getGlobalModelsDevCatalogPath", () => {
  it("resolves models-dev.json under the global diffgazer dir", () => {
    expect(getGlobalModelsDevCatalogPath()).toBe(path.join(testHome, "models-dev.json"));
  });

  it("ends with the models-dev.json filename", () => {
    expect(getGlobalModelsDevCatalogPath().endsWith("models-dev.json")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it & confirm FAIL.** Run: `pnpm --filter @diffgazer/server test src/shared/lib/paths.test.ts`. Expected: FAIL — `getGlobalModelsDevCatalogPath` not exported (2 tests fail).

- [ ] **Step 3: Implement.** In `cli/server/src/shared/lib/paths.ts`, add after `getGlobalOpenRouterModelsPath`:

```ts
export const getGlobalModelsDevCatalogPath = (): string =>
  path.join(getGlobalDiffgazerDir(), "models-dev.json");
```

- [ ] **Step 4: Run it & confirm PASS.** Run: `pnpm --filter @diffgazer/server test src/shared/lib/paths.test.ts`. Expected: PASS 2 tests.

- [ ] **Step 5: Type-check.** Run: `pnpm --filter @diffgazer/server type-check`. Expected: PASS.

- [ ] **Step 6: Commit.**
  ```
  git add cli/server/src/shared/lib/paths.ts cli/server/src/shared/lib/paths.test.ts
  git commit -m "$(cat <<'EOF'
feat(server): add getGlobalModelsDevCatalogPath for models.dev disk cache

Resolves ~/.diffgazer/models-dev.json (honoring DIFFGAZER_HOME) for the single
keyless models.dev catalog cache, mirroring the OpenRouter path.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 15: Extract a generic disk-cache helper and refactor `openrouter-models.ts` onto it (ZERO behavior change)

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

**Goal:** Extract `loadDiskCache` / `persistDiskCache` / `withTtlAndFallback` parameterized by `(path, schema, ttlMs, optional keyHash + cache-health predicates)` into a new shared module, then refactor `openrouter-models.ts` onto it. The OpenRouter logic (TTL check, `withParams > 0` health check, `keyHash` match, fetch-on-miss, stale-cache fallback, `console.info` logging) is preserved exactly. **The existing `openrouter-models.test.ts` must pass UNCHANGED — do not edit it.**

**Files:**
- Create: `cli/server/src/shared/lib/ai/disk-cache.ts`
- Create: `cli/server/src/shared/lib/ai/disk-cache.test.ts`
- Modify: `cli/server/src/shared/lib/ai/openrouter-models.ts`
- Test (must stay green, do NOT modify): `cli/server/src/shared/lib/ai/openrouter-models.test.ts`

Steps:

- [ ] **Step 1: Write the failing test for the generic helper.** Create `cli/server/src/shared/lib/ai/disk-cache.test.ts`:

```ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { loadDiskCache, persistDiskCache, withTtlAndFallback } from "./disk-cache.js";

const EntrySchema = z.object({
  payload: z.array(z.string()),
  fetchedAt: z.string(),
  keyHash: z.string().optional(),
});
type Entry = z.infer<typeof EntrySchema>;

let testDir: string;
const cachePath = (): string => path.join(testDir, "cache.json");
const writeRaw = (value: unknown): void => { fs.writeFileSync(cachePath(), `${JSON.stringify(value, null, 2)}\n`); };

beforeEach(() => { testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dg-disk-cache-")); vi.restoreAllMocks(); });
afterEach(() => { fs.rmSync(testDir, { recursive: true, force: true }); });

describe("loadDiskCache", () => {
  it("returns null when the file does not exist", () => {
    expect(loadDiskCache(cachePath(), EntrySchema)).toBeNull();
  });
  it("returns null when the stored value fails schema validation", () => {
    writeRaw({ payload: "not-an-array", fetchedAt: "x" });
    expect(loadDiskCache(cachePath(), EntrySchema)).toBeNull();
  });
  it("returns the parsed entry when valid", () => {
    const entry: Entry = { payload: ["a", "b"], fetchedAt: new Date().toISOString() };
    writeRaw(entry);
    expect(loadDiskCache(cachePath(), EntrySchema)).toEqual(entry);
  });
});

describe("persistDiskCache", () => {
  it("writes the entry so loadDiskCache reads it back", () => {
    const entry: Entry = { payload: ["x"], fetchedAt: new Date().toISOString() };
    persistDiskCache(cachePath(), entry);
    expect(loadDiskCache(cachePath(), EntrySchema)).toEqual(entry);
  });
});

describe("withTtlAndFallback", () => {
  const fresh = (): string => new Date().toISOString();
  const stale = (): string => new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const ttl = 24 * 60 * 60 * 1000;

  it("returns the fresh cache without fetching", async () => {
    persistDiskCache(cachePath(), { payload: ["cached"], fetchedAt: fresh() } satisfies Entry);
    const fetcher = vi.fn();
    const result = await withTtlAndFallback({ path: cachePath(), schema: EntrySchema, ttlMs: ttl, fetcher });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.value.cached).toBe(true); expect(result.value.entry.payload).toEqual(["cached"]); }
  });

  it("fetches and persists when no cache exists", async () => {
    const entry: Entry = { payload: ["live"], fetchedAt: fresh() };
    const fetcher = vi.fn().mockResolvedValue({ ok: true, value: entry });
    const result = await withTtlAndFallback({ path: cachePath(), schema: EntrySchema, ttlMs: ttl, fetcher });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.value.cached).toBe(false); expect(result.value.entry.payload).toEqual(["live"]); }
    expect(loadDiskCache(cachePath(), EntrySchema)?.payload).toEqual(["live"]);
  });

  it("fetches when the cache is stale", async () => {
    persistDiskCache(cachePath(), { payload: ["old"], fetchedAt: stale() } satisfies Entry);
    const fetcher = vi.fn().mockResolvedValue({ ok: true, value: { payload: ["new"], fetchedAt: fresh() } satisfies Entry });
    const result = await withTtlAndFallback({ path: cachePath(), schema: EntrySchema, ttlMs: ttl, fetcher });
    expect(fetcher).toHaveBeenCalledOnce();
    if (result.ok) expect(result.value.entry.payload).toEqual(["new"]);
  });

  it("falls back to the stale cache when the fetch fails", async () => {
    persistDiskCache(cachePath(), { payload: ["old"], fetchedAt: stale() } satisfies Entry);
    const fetcher = vi.fn().mockResolvedValue({ ok: false, error: { message: "boom" } });
    const result = await withTtlAndFallback({ path: cachePath(), schema: EntrySchema, ttlMs: ttl, fetcher });
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.value.cached).toBe(true); expect(result.value.entry.payload).toEqual(["old"]); }
  });

  it("returns the fetch error when it fails and no cache exists", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, error: { message: "boom" } });
    const result = await withTtlAndFallback({ path: cachePath(), schema: EntrySchema, ttlMs: ttl, fetcher });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("boom");
  });

  it("treats a fresh cache as a miss when isCacheUsable returns false", async () => {
    persistDiskCache(cachePath(), { payload: [], fetchedAt: fresh() } satisfies Entry);
    const fetcher = vi.fn().mockResolvedValue({ ok: true, value: { payload: ["refreshed"], fetchedAt: fresh() } satisfies Entry });
    const result = await withTtlAndFallback({ path: cachePath(), schema: EntrySchema, ttlMs: ttl, fetcher, isCacheUsable: (c) => c.payload.length > 0 });
    expect(fetcher).toHaveBeenCalledOnce();
    if (result.ok) expect(result.value.entry.payload).toEqual(["refreshed"]);
  });

  it("does not reuse a stale cache whose keyHash does not match", async () => {
    persistDiskCache(cachePath(), { payload: ["old"], fetchedAt: stale(), keyHash: "OTHER" } satisfies Entry);
    const fetcher = vi.fn().mockResolvedValue({ ok: false, error: { message: "down" } });
    const result = await withTtlAndFallback({ path: cachePath(), schema: EntrySchema, ttlMs: ttl, fetcher, keyHashOf: (c) => c.keyHash, currentKeyHash: "MINE" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("down");
  });
});
```

- [ ] **Step 2: Run it & confirm FAIL.** Run: `pnpm --filter @diffgazer/server test src/shared/lib/ai/disk-cache.test.ts`. Expected: FAIL — cannot resolve `./disk-cache.js`; all 11 tests error.

- [ ] **Step 3: Implement the generic helper.** Create `cli/server/src/shared/lib/ai/disk-cache.ts`:

```ts
import type { z } from "zod";
import { type Result, ok, err } from "@diffgazer/core/result";
import { readJsonFileSync, writeJsonFileSync } from "../fs.js";

interface DatedEntry { fetchedAt: string; }

export const loadDiskCache = <T extends DatedEntry>(path: string, schema: z.ZodType<T>): T | null => {
  const data = readJsonFileSync<unknown>(path);
  if (!data) return null;
  const parsed = schema.safeParse(data);
  return parsed.success ? parsed.data : null;
};

export const persistDiskCache = <T extends DatedEntry>(path: string, entry: T): void => {
  writeJsonFileSync(path, entry);
};

const isFresh = (entry: DatedEntry, ttlMs: number): boolean => {
  const time = Date.parse(entry.fetchedAt);
  return Number.isFinite(time) && Date.now() - time < ttlMs;
};

export interface WithTtlAndFallbackOptions<T extends DatedEntry> {
  path: string;
  schema: z.ZodType<T>;
  ttlMs: number;
  fetcher: () => Promise<Result<T, { message: string }>>;
  /** Extra freshness predicate beyond TTL (e.g. OpenRouter's "has supported_parameters" check). */
  isCacheUsable?: (entry: T) => boolean;
  /** When the cache stores a key hash, only reuse entries whose hash matches the current key. */
  keyHashOf?: (entry: T) => string | undefined;
  currentKeyHash?: string;
}

export interface DiskCacheResolution<T extends DatedEntry> { entry: T; cached: boolean; }

export const withTtlAndFallback = async <T extends DatedEntry>(
  options: WithTtlAndFallbackOptions<T>,
): Promise<Result<DiskCacheResolution<T>, { message: string }>> => {
  const { path, schema, ttlMs, fetcher, isCacheUsable, keyHashOf, currentKeyHash } = options;

  const cache = loadDiskCache(path, schema);
  const keyMatches = keyHashOf === undefined || cache === null || keyHashOf(cache) === currentKeyHash;
  const cacheFresh =
    cache !== null &&
    isFresh(cache, ttlMs) &&
    (isCacheUsable === undefined || isCacheUsable(cache)) &&
    keyMatches;

  if (cache && cacheFresh) return ok({ entry: cache, cached: true });

  const fetchResult = await fetcher();
  if (fetchResult.ok) {
    persistDiskCache(path, fetchResult.value);
    return ok({ entry: fetchResult.value, cached: false });
  }

  if (cache && keyMatches) return ok({ entry: cache, cached: true });
  return err({ message: fetchResult.error.message });
};
```

- [ ] **Step 4: Run the helper test & confirm PASS.** Run: `pnpm --filter @diffgazer/server test src/shared/lib/ai/disk-cache.test.ts`. Expected: PASS 11 tests.

- [ ] **Step 5: Refactor `openrouter-models.ts` onto the helper.** Add `import { loadDiskCache, persistDiskCache, withTtlAndFallback } from "./disk-cache.js";`. Replace `loadOpenRouterModelCache`/`persistOpenRouterModelCache` bodies with calls into `loadDiskCache`/`persistDiskCache`, and replace `getOpenRouterModelsWithCache`'s cache-resolution block with a `withTtlAndFallback` call that passes `isCacheUsable: (c) => countWithParams(c.models) > 0`, `keyHashOf: (c) => c.keyHash`, `currentKeyHash`, and a `fetcher` wrapping `fetchOpenRouterModels`. Preserve the `console.info` cache-hit/fetched logging and the public return shape `{ models, fetchedAt, cached }`. Remove the now-dead local `cacheValid`/`cacheWithParams` intermediates (anti-slop). The one observable delta — the `cacheWasValid=...` suffix on the "fetched" log line — has no test asserting it; if any retained test asserts that exact string, thread the freshness flag out of the helper rather than weakening the test.

- [ ] **Step 6: Run the UNCHANGED OpenRouter suite & confirm PASS.** Run: `pnpm --filter @diffgazer/server test src/shared/lib/ai/openrouter-models.test.ts`. Expected: PASS — all OpenRouter tests green, no edits to that test file.

- [ ] **Step 7: Run both AI cache suites + type-check.** Run: `pnpm --filter @diffgazer/server test src/shared/lib/ai/`. Expected: PASS (disk-cache 11, openrouter-models green, existing client tests green). Run: `pnpm --filter @diffgazer/server type-check`. Expected: PASS.

- [ ] **Step 8: Commit.**
  ```
  git add cli/server/src/shared/lib/ai/disk-cache.ts cli/server/src/shared/lib/ai/disk-cache.test.ts cli/server/src/shared/lib/ai/openrouter-models.ts
  git commit -m "$(cat <<'EOF'
refactor(server): extract generic disk-cache helper from openrouter-models

Add loadDiskCache/persistDiskCache/withTtlAndFallback parameterized by
(path, schema, ttl) with optional cache-health, keyHash, and current-key
predicates. Refactor openrouter-models onto it with no behavior change; its
existing tests pass unchanged. Sets up the keyless models.dev cache.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 16: `models-dev-catalog.ts` — keyless fetch, shrink-guard, cache schema, 3-tier `getProviderModels`

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

**Goal:** Build the keyless models.dev catalog module on the generic disk-cache primitives (Task 15) and the pure `@diffgazer/core/catalog` layer:
- `fetchModelsDevCatalog(options?)` — `GET https://models.dev/api.json`, `AbortSignal.timeout(10_000)`, `parseModelsDevCatalog`, shrink-guard rejecting a payload far smaller than the cache/snapshot baseline.
- `ModelsDevCatalogCacheSchema` — `{ catalog, fetchedAt }` (keyless; no `keyHash`).
- `getProviderModels(providerId)` — three-tier fallback (**fresh disk → live(persist) → stale disk → `CATALOG_SNAPSHOT`**), honoring `DIFFGAZER_OFFLINE`, mapping with `catalogToModelInfo`, never empty. Returns `{ models, fetchedAt, source: 'live'|'cache'|'snapshot', cached }`.

**Files:**
- Create: `cli/server/src/shared/lib/ai/models-dev-catalog.ts`
- Create: `cli/server/src/shared/lib/ai/models-dev-catalog.test.ts`
- Create: `cli/server/src/shared/lib/ai/__fixtures__/models-dev-sample.ts` (small trimmed fixture — NOT the 2.1MB blob)

Steps:

- [ ] **Step 1: Capture a small fixture.** Create `cli/server/src/shared/lib/ai/__fixtures__/models-dev-sample.ts` exporting `MODELS_DEV_SAMPLE: unknown` shaped as the raw external payload (record-of-providers), trimmed to `google` (`gemini-2.5-flash` free-via-selector + `gemini-3-pro-preview` paid), `groq` (1 priced model), `cerebras` (1 priced model), and `zai` (`glm-4.5-flash` cost 0/0 + `glm-4.6` priced). Keep only fields the schema/transform read. Reuse the field shapes from the P1 `RAW_CATALOG` fixture (Task 1) as the template; this is the cli/server-local copy so the server tests do not import a libs/core test fixture.

- [ ] **Step 2: Write the failing test.** Create `cli/server/src/shared/lib/ai/models-dev-catalog.test.ts`. Tests stub `globalThis.fetch` and use a `mkdtempSync` temp dir as `DIFFGAZER_HOME`:

```ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MODELS_DEV_SAMPLE } from "./__fixtures__/models-dev-sample.js";
import { fetchModelsDevCatalog, getProviderModels, ModelsDevCatalogCacheSchema } from "./models-dev-catalog.js";

let testHome: string;
const cachePath = (): string => path.join(testHome, "models-dev.json");
const writeCache = (catalog: unknown, fetchedAt: string): void => {
  fs.writeFileSync(cachePath(), `${JSON.stringify({ catalog, fetchedAt }, null, 2)}\n`);
};
const okResponse = (body: unknown): Response => ({ ok: true, status: 200, json: async () => body }) as Response;
const fresh = (): string => new Date().toISOString();
const stale = (): string => new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  testHome = fs.mkdtempSync(path.join(os.tmpdir(), "dg-models-dev-"));
  process.env.DIFFGAZER_HOME = testHome;
  delete process.env.DIFFGAZER_OFFLINE;
  vi.restoreAllMocks();
});
afterEach(() => {
  delete process.env.DIFFGAZER_HOME;
  delete process.env.DIFFGAZER_OFFLINE;
  fs.rmSync(testHome, { recursive: true, force: true });
});

describe("fetchModelsDevCatalog", () => {
  it("fetches keylessly with a 10s timeout signal and parses the catalog", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    const result = await fetchModelsDevCatalog();
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.value.google).toBeDefined(); expect(result.value.groq).toBeDefined(); }
    expect(spy).toHaveBeenCalledWith("https://models.dev/api.json", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    const [, init] = spy.mock.calls[0]!;
    expect((init as RequestInit)?.headers).toBeUndefined();
  });

  it("returns an error on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 503 } as Response);
    const result = await fetchModelsDevCatalog();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("503");
  });

  it("returns an error when the network call throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const result = await fetchModelsDevCatalog();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("network down");
  });

  it("rejects a catalog that shrank far below the baseline (shrink-guard)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse({ google: { id: "google", models: {} } }));
    const result = await fetchModelsDevCatalog({ baselineModelCount: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message.toLowerCase()).toContain("shrink");
  });

  it("accepts a catalog when no baseline is provided (first run)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    expect((await fetchModelsDevCatalog()).ok).toBe(true);
  });
});

describe("ModelsDevCatalogCacheSchema", () => {
  it("accepts a keyless { catalog, fetchedAt } entry", () => {
    expect(ModelsDevCatalogCacheSchema.safeParse({ catalog: { google: { id: "google", models: {} } }, fetchedAt: fresh() }).success).toBe(true);
  });
  it("rejects an entry missing fetchedAt", () => {
    expect(ModelsDevCatalogCacheSchema.safeParse({ catalog: { google: { id: "google", models: {} } } }).success).toBe(false);
  });
});

describe("getProviderModels — three-tier fallback", () => {
  it("live success: fetches, persists the cache, tags source=live", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    const result = await getProviderModels("gemini");
    expect(result.source).toBe("live");
    expect(result.cached).toBe(false);
    expect(result.models.map((m) => m.id)).toContain("gemini-2.5-flash");
    expect(fs.existsSync(cachePath())).toBe(true);
  });

  it("fresh disk cache: serves cache without fetching, source=cache", async () => {
    writeCache(MODELS_DEV_SAMPLE, fresh());
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await getProviderModels("gemini");
    expect(spy).not.toHaveBeenCalled();
    expect(result.source).toBe("cache");
    expect(result.cached).toBe(true);
  });

  it("fetch fails with a stale disk cache: serves the stale cache, source=cache", async () => {
    writeCache(MODELS_DEV_SAMPLE, stale());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await getProviderModels("gemini");
    expect(result.source).toBe("cache");
    expect(result.models.map((m) => m.id)).toContain("gemini-2.5-flash");
  });

  it("no disk and fetch fails: falls back to the bundled snapshot, source=snapshot", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await getProviderModels("gemini");
    expect(result.source).toBe("snapshot");
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("shrink-guarded fetch with no usable cache: falls back to the snapshot", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse({ google: { id: "google", models: {} } }));
    const result = await getProviderModels("gemini");
    expect(result.source).toBe("snapshot");
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("DIFFGAZER_OFFLINE: never fetches, serves cache when present", async () => {
    process.env.DIFFGAZER_OFFLINE = "1";
    writeCache(MODELS_DEV_SAMPLE, stale());
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await getProviderModels("gemini");
    expect(spy).not.toHaveBeenCalled();
    expect(result.source).toBe("cache");
  });

  it("DIFFGAZER_OFFLINE with no cache: serves the snapshot, never fetches", async () => {
    process.env.DIFFGAZER_OFFLINE = "true";
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await getProviderModels("gemini");
    expect(spy).not.toHaveBeenCalled();
    expect(result.source).toBe("snapshot");
  });

  it("never returns an empty model list for an enabled provider", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    for (const id of ["gemini", "groq", "cerebras", "zai"] as const) {
      expect((await getProviderModels(id)).models.length).toBeGreaterThan(0);
    }
  });

  it("returns a valid ISO fetchedAt", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    expect(Number.isFinite(Date.parse((await getProviderModels("gemini")).fetchedAt))).toBe(true);
  });
});
```

> **Snapshot-fixture note:** the snapshot-fallback cases assume `CATALOG_SNAPSHOT` (P1 Task 5) includes `gemini`/`groq`/`cerebras`/`zai` rows so `catalogToModelInfo` yields non-empty lists offline — exactly what the snapshot is generated for. P1 must be merged before this Task.

- [ ] **Step 3: Run it & confirm FAIL.** Run: `pnpm --filter @diffgazer/server test src/shared/lib/ai/models-dev-catalog.test.ts`. Expected: FAIL — cannot resolve `./models-dev-catalog.js`.

- [ ] **Step 4: Implement.** Create `cli/server/src/shared/lib/ai/models-dev-catalog.ts`:

```ts
import { z } from "zod";
import { getErrorMessage } from "@diffgazer/core/errors";
import { type Result, ok, err } from "@diffgazer/core/result";
import type { ModelInfo, AIProvider } from "@diffgazer/core/schemas/config";
import {
  parseModelsDevCatalog,
  catalogToModelInfo,
  CATALOG_SNAPSHOT,
  ModelsDevCatalogSchema,
  type ModelsDevCatalog,
} from "@diffgazer/core/catalog";
import { getGlobalModelsDevCatalogPath } from "../paths.js";
import { loadDiskCache, persistDiskCache } from "./disk-cache.js";

const MODELS_DEV_URL = "https://models.dev/api.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Reject a live payload smaller than this fraction of the known baseline. */
const SHRINK_GUARD_RATIO = 0.5;

export const ModelsDevCatalogCacheSchema = z.object({
  catalog: ModelsDevCatalogSchema,
  fetchedAt: z.string(),
});
export type ModelsDevCatalogCache = z.infer<typeof ModelsDevCatalogCacheSchema>;

const countModels = (catalog: ModelsDevCatalog): number => {
  let total = 0;
  for (const provider of Object.values(catalog)) total += Object.keys(provider.models).length;
  return total;
};

const isOffline = (): boolean => {
  const flag = process.env.DIFFGAZER_OFFLINE?.trim();
  return flag !== undefined && flag !== "" && flag !== "0" && flag.toLowerCase() !== "false";
};

export const fetchModelsDevCatalog = async (
  options?: { baselineModelCount?: number },
): Promise<Result<ModelsDevCatalog, { message: string }>> => {
  let response: Response;
  try {
    response = await fetch(MODELS_DEV_URL, { signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    return err({ message: getErrorMessage(error, "Failed to fetch models.dev catalog") });
  }
  if (!response.ok) return err({ message: `models.dev catalog request failed: ${response.status}` });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    return err({ message: getErrorMessage(error, "models.dev catalog response was not JSON") });
  }

  const catalog = parseModelsDevCatalog(payload);
  const liveCount = countModels(catalog);
  if (liveCount === 0) return err({ message: "models.dev catalog parsed to zero models" });

  const baseline = options?.baselineModelCount ?? 0;
  if (baseline > 0 && liveCount < baseline * SHRINK_GUARD_RATIO) {
    return err({ message: `models.dev catalog shrink-guard tripped: ${liveCount} models vs baseline ${baseline}` });
  }
  return ok(catalog);
};

export interface ProviderModelsResult {
  models: ModelInfo[];
  fetchedAt: string;
  source: "live" | "cache" | "snapshot";
  cached: boolean;
}

const isCacheFresh = (cache: ModelsDevCatalogCache): boolean => {
  const time = Date.parse(cache.fetchedAt);
  return Number.isFinite(time) && Date.now() - time < CACHE_TTL_MS;
};

const toResult = (
  catalog: ModelsDevCatalog,
  provider: AIProvider,
  fetchedAt: string,
  source: ProviderModelsResult["source"],
  cached: boolean,
): ProviderModelsResult => ({ models: catalogToModelInfo(catalog, provider), fetchedAt, source, cached });

const snapshotResult = (provider: AIProvider): ProviderModelsResult =>
  toResult(CATALOG_SNAPSHOT, provider, new Date().toISOString(), "snapshot", false);

export const getProviderModels = async (providerId: AIProvider): Promise<ProviderModelsResult> => {
  const path = getGlobalModelsDevCatalogPath();
  const cache = loadDiskCache(path, ModelsDevCatalogCacheSchema);

  if (cache && isCacheFresh(cache)) {
    return toResult(cache.catalog, providerId, cache.fetchedAt, "cache", true);
  }

  if (isOffline()) {
    if (cache) return toResult(cache.catalog, providerId, cache.fetchedAt, "cache", true);
    return snapshotResult(providerId);
  }

  const baselineModelCount = cache ? countModels(cache.catalog) : countModels(CATALOG_SNAPSHOT);
  const fetchResult = await fetchModelsDevCatalog({ baselineModelCount });

  if (fetchResult.ok) {
    const fetchedAt = new Date().toISOString();
    persistDiskCache(path, { catalog: fetchResult.value, fetchedAt });
    return toResult(fetchResult.value, providerId, fetchedAt, "live", false);
  }

  if (cache) return toResult(cache.catalog, providerId, cache.fetchedAt, "cache", true);
  return snapshotResult(providerId);
};
```

> `getProviderModels` does NOT route through `withTtlAndFallback` because it needs a three-way `source` tag and an unconditional snapshot floor that the two-state helper cannot express. It reuses the helper's `loadDiskCache`/`persistDiskCache` primitives (no fs/parse duplication); the orchestration is genuinely different (clean-code/anti-slop: name the real concept, don't force the wrong abstraction).

- [ ] **Step 5: Run it & confirm PASS.** Run: `pnpm --filter @diffgazer/server test src/shared/lib/ai/models-dev-catalog.test.ts`. Expected: PASS — `fetchModelsDevCatalog` 5, `ModelsDevCatalogCacheSchema` 2, `getProviderModels` 9 = 16.

- [ ] **Step 6: Full AI lib suite + type-check.** Run: `pnpm --filter @diffgazer/server test src/shared/lib/ai/`. Expected: PASS (disk-cache 11, openrouter-models green, models-dev-catalog 16, existing client tests green). Run: `pnpm --filter @diffgazer/server type-check`. Expected: PASS.

- [ ] **Step 7: Commit.**
  ```
  git add cli/server/src/shared/lib/ai/models-dev-catalog.ts cli/server/src/shared/lib/ai/models-dev-catalog.test.ts cli/server/src/shared/lib/ai/__fixtures__/models-dev-sample.ts
  git commit -m "$(cat <<'EOF'
feat(server): models.dev catalog fetch, cache, and three-tier fallback

Add fetchModelsDevCatalog (keyless, 10s timeout, per-model safeParse via
parseModelsDevCatalog, shrink-guard), the keyless { catalog, fetchedAt }
cache schema, and getProviderModels with fresh-disk -> live(persist) ->
stale-disk -> CATALOG_SNAPSHOT resolution honoring DIFFGAZER_OFFLINE.
Never returns an empty model list for an enabled provider.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Phase P3 verification gate (run after Tasks 14-16)

- [ ] Run: `pnpm --filter @diffgazer/server test src/shared/lib/` → Expected: PASS — paths 2, ai/disk-cache 11, ai/openrouter-models green (unchanged), ai/models-dev-catalog 16, pre-existing ai/client tests.
- [ ] Run: `pnpm --filter @diffgazer/server type-check` → Expected: PASS.
- [ ] Run: `git diff --check` → Expected: clean.

---

## Phase P4 — Server Route + AI Client (`cli/server`)

> **Depends on P3 complete** (consumes `getProviderModels` + the disk-cache helper) **and P2 Task 7** (enum). Closes the cross-package reds P2 flagged (groq/cerebras `createLanguageModel` branches; `client.test.ts` `it.each`).

### Task 17: `ProviderModelsResponse` schema + `getProviderModels` service

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

This adds the slim response contract to `libs/core` and the `getProviderModels` service in `cli/server`. The service validates the provider id against `AIProviderSchema` (unknown id → typed `ErrorCode.VALIDATION_ERROR` via the existing zod error path, HTTP 400), rejects providers whose overlay row is `enabled: false` with the **typed** domain code `PROVIDER_DISABLED` (defined through the repo's `createDomainErrorCodes`/`createDomainErrorSchema` mechanism — Decision B, no ad-hoc string), and delegates enabled providers to the catalog I/O module (imported under an alias to avoid shadowing).

**Files:**
- Modify: `libs/core/src/schemas/errors.ts` (export the existing `createDomainErrorCodes` so domains can build a typed code constant)
- Create: `libs/core/src/schemas/config/catalog-errors.ts` (typed `CATALOG_ERROR_CODES` + `CatalogErrorSchema` + `CatalogErrorCode`, including `PROVIDER_DISABLED`)
- Modify: `libs/core/src/schemas/config/index.ts` (export the catalog-errors module)
- Modify: `libs/core/src/schemas/config/models.ts` (add `ProviderModelsResponseSchema` + `ProviderModelsResponse`)
- Modify: `cli/server/src/features/config/service.ts` (imports + new `getProviderModels` service after `getOpenRouterModels`)
- Modify (test): `cli/server/src/features/config/service.test.ts`

Steps:

- [ ] **Step 1: Define the typed `PROVIDER_DISABLED` domain error (Decision B).** First export the existing private helper in `libs/core/src/schemas/errors.ts` so domains can build a typed code constant (one-line change):

```ts
export function createDomainErrorCodes<const T extends readonly string[]>(specificCodes: T) {
  return [...SHARED_ERROR_CODES, ...specificCodes] as const;
}
```

Then create `libs/core/src/schemas/config/catalog-errors.ts`, mirroring the `ReviewErrorSchema` convention (`createDomainErrorSchema` prepends `SHARED_ERROR_CODES`):

```ts
// libs/core/src/schemas/config/catalog-errors.ts
import { z } from "zod";
import { createDomainErrorCodes, createDomainErrorSchema } from "../errors.js";

/** Catalog/config domain-specific error codes (shared codes are prepended by the helpers). */
export const CATALOG_SPECIFIC_ERROR_CODES = ["PROVIDER_DISABLED"] as const;

export const CATALOG_ERROR_CODES = createDomainErrorCodes(CATALOG_SPECIFIC_ERROR_CODES);
export const CatalogErrorSchema = createDomainErrorSchema(CATALOG_SPECIFIC_ERROR_CODES);

export type CatalogErrorCode = (typeof CATALOG_ERROR_CODES)[number];
export type CatalogError = z.infer<typeof CatalogErrorSchema>;
```

Add `export * from "./catalog-errors.js";` to `libs/core/src/schemas/config/index.ts`. Run: `pnpm --filter @diffgazer/core type-check`. Expected: PASS.

- [ ] **Step 2: Add the slim response schema.** Confirm it does not exist: `pnpm --filter @diffgazer/core exec rg -n "ProviderModelsResponse" src/schemas/config/models.ts` (expect no output). Append after the `OpenRouterModelsResponse` block in `libs/core/src/schemas/config/models.ts` (`ModelInfoSchema` and `z` already exist there):

```ts
export const ProviderModelsResponseSchema = z.object({
  models: z.array(ModelInfoSchema),
  fetchedAt: z.string().datetime(),
  source: z.enum(["live", "cache", "snapshot"]),
  cached: z.boolean(),
});

export type ProviderModelsResponse = z.infer<typeof ProviderModelsResponseSchema>;
```

Run: `pnpm --filter @diffgazer/core type-check`. Expected: PASS.

- [ ] **Step 3: Write the failing service test.** In `cli/server/src/features/config/service.test.ts`, add a hoisted boundary mock for the catalog I/O module and a `describe("getProviderModels (catalog)")` block:

```ts
const catalog = vi.hoisted(() => ({ getProviderModels: vi.fn() }));
// Boundary mock: models-dev-catalog wraps the models.dev HTTP API + disk cache.
vi.mock("../../shared/lib/ai/models-dev-catalog.js", () => catalog);
```

```ts
describe("getProviderModels (catalog)", () => {
  it("returns the slim catalog payload for an enabled provider", async () => {
    catalog.getProviderModels.mockResolvedValue({
      models: [{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "1M context", tier: "free", recommended: true }],
      fetchedAt: "2026-06-02T00:00:00.000Z",
      source: "live",
      cached: false,
    });
    const { getProviderModels } = await loadService();
    const result = await getProviderModels("gemini");
    expect(catalog.getProviderModels).toHaveBeenCalledWith("gemini");
    expect(result).toMatchObject({ ok: true, value: { models: [{ id: "gemini-2.5-flash", tier: "free", recommended: true }], source: "live", cached: false } });
  });

  it("rejects an unknown provider id with VALIDATION_ERROR without touching the catalog", async () => {
    const { getProviderModels } = await loadService();
    const result = await getProviderModels("not-a-provider" as AIProvider);
    expect(catalog.getProviderModels).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("rejects an enum provider whose overlay is disabled with the typed PROVIDER_DISABLED code", async () => {
    const overlayModule = await import("@diffgazer/core/catalog");
    const { CatalogErrorSchema } = await import("@diffgazer/core/schemas/config");
    const original = overlayModule.PROVIDER_OVERLAY.groq;
    try {
      overlayModule.PROVIDER_OVERLAY.groq = { ...original, enabled: false };
      const { getProviderModels } = await loadService();
      const result = await getProviderModels("groq");
      expect(catalog.getProviderModels).not.toHaveBeenCalled();
      expect(result).toMatchObject({ ok: false, error: { code: "PROVIDER_DISABLED" } });
      // The error is a real typed domain error, not an ad-hoc string.
      expect(result.ok).toBe(false);
      if (!result.ok) expect(CatalogErrorSchema.safeParse(result.error).success).toBe(true);
    } finally {
      overlayModule.PROVIDER_OVERLAY.groq = original;
    }
  });

  it("propagates catalog failures as INTERNAL_ERROR", async () => {
    catalog.getProviderModels.mockRejectedValue(new Error("catalog unavailable"));
    const { getProviderModels } = await loadService();
    const result = await getProviderModels("groq");
    expect(result).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR", message: "catalog unavailable" } });
  });
});
```

> The disabled-overlay test mutates the real `PROVIDER_OVERLAY` (restored in `finally`) because the surfaced disabled providers (`mistral` etc.) are not enum members and would be caught by `AIProviderSchema` validation first. If `PROVIDER_OVERLAY` is frozen/getter-backed at runtime, use `vi.spyOn(overlayModule.PROVIDER_OVERLAY, "groq", "get").mockReturnValue({ ...original, enabled: false })` instead — the asserted behavior (no catalog call + `PROVIDER_DISABLED`) is identical.

Run: `pnpm --filter @diffgazer/server test src/features/config/service.test.ts`. Expected: FAIL — `getProviderModels` not exported from `service.js`.

- [ ] **Step 4: Implement the service.** In `cli/server/src/features/config/service.ts`, add imports (merge `getErrorMessage` into the existing `@diffgazer/core/errors` import if absent):

```ts
import { getProviderModels as getProviderModelsFromCatalog } from "../../shared/lib/ai/models-dev-catalog.js";
import { PROVIDER_OVERLAY } from "@diffgazer/core/catalog";
import {
  AIProviderSchema,
  type CatalogErrorCode,
  type ProviderModelsResponse,
} from "@diffgazer/core/schemas/config";
```

Append after `getOpenRouterModels`. `PROVIDER_DISABLED` is the typed `CatalogErrorCode` from Step 1 (`createError<CatalogErrorCode>`), and the unknown-id branch uses the shared typed `ErrorCode.VALIDATION_ERROR`:

```ts
export const getProviderModels = async (
  providerId: AIProvider,
): Promise<Result<ProviderModelsResponse, { message: string; code: string }>> => {
  const parsed = AIProviderSchema.safeParse(providerId);
  if (!parsed.success) {
    return err(createError(ErrorCode.VALIDATION_ERROR, `Unknown provider: ${providerId}`));
  }
  const provider = parsed.data;
  if (!PROVIDER_OVERLAY[provider].enabled) {
    return err(createError<CatalogErrorCode>("PROVIDER_DISABLED", `Provider '${provider}' is not enabled`));
  }
  try {
    return ok(await getProviderModelsFromCatalog(provider));
  } catch (error) {
    return err(createError(ErrorCode.INTERNAL_ERROR, getErrorMessage(error, "Failed to load provider models")));
  }
};
```

> `PROVIDER_DISABLED` is a TYPED domain code defined in `catalog-errors.ts` via `createDomainErrorCodes`/`createDomainErrorSchema` (Decision B), NOT an ad-hoc string. The pre-existing ad-hoc `"PROVIDER_NOT_FOUND"`/`"INVALID_BODY"` strings in `activateProvider`/`selectModel` are an optional adjacent cleanup (out of scope here); do not introduce new untyped codes. Read the file before editing.

Run: `pnpm --filter @diffgazer/server test src/features/config/service.test.ts`. Expected: PASS (prior + 4 new).

- [ ] **Step 5: Type-check.** Run: `pnpm --filter @diffgazer/core type-check && pnpm --filter @diffgazer/server type-check`. Expected: PASS both.

- [ ] **Step 6: Commit.**
  ```
  git add libs/core/src/schemas/errors.ts libs/core/src/schemas/config/catalog-errors.ts libs/core/src/schemas/config/index.ts libs/core/src/schemas/config/models.ts cli/server/src/features/config/service.ts cli/server/src/features/config/service.test.ts
  git commit -m "$(cat <<'EOF'
feat(server): add getProviderModels service over models.dev catalog

Validate the provider id against the closed AIProviderSchema (unknown ->
typed VALIDATION_ERROR), reject overlay-disabled providers with the typed
PROVIDER_DISABLED domain code (createDomainErrorCodes/createDomainErrorSchema,
no ad-hoc string), and delegate enabled providers to the catalog I/O module.
Add the slim ProviderModelsResponse contract (models + fetchedAt + source tag
+ cached) so the route never serves the raw blob.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 18: `GET /provider/:id/models` route — rate-limited, slim Zod-validated payload, route→service→catalog E2E

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

Wires `GET /provider/:id/models` into the config router, reusing the existing `modelFetchLimit` rate-limit instance (shares the `config:models` window with the OpenRouter route). Validates `:id` via a param schema keyed `id` (Hono binds `zValidator("param", …)` by route-segment name; the existing `ProviderParamSchema` keys `providerId`), maps service error codes to HTTP statuses, and returns the slim payload. The route test is the in-process E2E: route → service → catalog with `fetch` mocked, proving the three-tier fallback surfaces through HTTP with the correct `source` tag.

**Files:**
- Modify: `cli/server/src/features/config/schemas.ts` (add `ProviderModelsParamSchema`)
- Modify: `cli/server/src/features/config/router.ts` (import service fn + register route)
- Test (new): `cli/server/src/features/config/router.test.ts`

Steps:

- [ ] **Step 1: Add the param schema.** Append to `cli/server/src/features/config/schemas.ts` (`z` + `AIProviderSchema` already imported):

```ts
export const ProviderModelsParamSchema = z.object({ id: AIProviderSchema });
```

Run: `pnpm --filter @diffgazer/server type-check`. Expected: PASS.

- [ ] **Step 2: Write the failing route E2E test.** Create `cli/server/src/features/config/router.test.ts`. It mounts the real `configRouter` in a bare `new Hono()` (bypassing host/token middleware), uses a temp `DIFFGAZER_HOME`, and mocks `globalThis.fetch` so the real `getProviderModels` (service) → real catalog 3-tier run end to end:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { resetRateLimitsForTests } from "../../shared/middlewares/rate-limit.js";

let diffgazerHome: string;

async function loadRouter() {
  const { configRouter } = await import("./router.js");
  const app = new Hono();
  app.route("/config", configRouter);
  return app;
}

beforeEach(() => {
  diffgazerHome = mkdtempSync(join(tmpdir(), "dg-config-router-"));
  process.env.DIFFGAZER_HOME = diffgazerHome;
  process.env.DIFFGAZER_OFFLINE = "";
  vi.resetModules();
  vi.restoreAllMocks();
  resetRateLimitsForTests();
});

afterEach(() => {
  delete process.env.DIFFGAZER_HOME;
  delete process.env.DIFFGAZER_OFFLINE;
  rmSync(diffgazerHome, { recursive: true, force: true });
});

describe("GET /config/provider/:id/models", () => {
  it("returns live models end to end when the fetch succeeds (source: live)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        google: { id: "google", name: "Google", models: {
          "gemini-2.5-flash": { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", cost: { input: 0.3, output: 2.5 }, limit: { context: 1_000_000 }, tool_call: true },
        } },
      }),
    } as Response);

    const app = await loadRouter();
    const res = await app.request("/config/provider/gemini/models");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { models: { id: string; tier: string }[]; source: string; cached: boolean; fetchedAt: string };
    expect(body.source).toBe("live");
    expect(body.cached).toBe(false);
    expect(body.models.some((m) => m.id === "gemini-2.5-flash" && m.tier === "free")).toBe(true);
    expect(body.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("falls back to the bundled snapshot when fetch fails and no disk cache exists (source: snapshot)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const app = await loadRouter();
    const res = await app.request("/config/provider/gemini/models");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { models: unknown[]; source: string };
    expect(body.source).toBe("snapshot");
    expect(body.models.length).toBeGreaterThan(0);
  });

  it("returns 400 VALIDATION_ERROR for an unknown provider id", async () => {
    const app = await loadRouter();
    const res = await app.request("/config/provider/not-a-provider/models");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rate-limits after the shared config:models window is exhausted (429)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const app = await loadRouter();
    let lastStatus = 200;
    for (let i = 0; i < 31; i++) lastStatus = (await app.request("/config/provider/gemini/models")).status;
    expect(lastStatus).toBe(429);
  });

  it("serves a payload that satisfies ProviderModelsResponseSchema (never the raw blob)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const { ProviderModelsResponseSchema } = await import("@diffgazer/core/schemas/config");
    const app = await loadRouter();
    const res = await app.request("/config/provider/gemini/models");
    const body = await res.json();
    expect(ProviderModelsResponseSchema.safeParse(body).success).toBe(true);
    expect(Object.keys(body as object).sort()).toEqual(["cached", "fetchedAt", "models", "source"]);
  });
});
```

> Verify `resetRateLimitsForTests` is the real export from `rate-limit.ts`. If the rate-limit middleware exposes a different reset helper (or relies on a fresh module via `vi.resetModules()`), adapt the import/reset accordingly; the assertion (429 after the window) is the contract.

Run: `pnpm --filter @diffgazer/server test src/features/config/router.test.ts`. Expected: FAIL — route not registered, all requests 404.

- [ ] **Step 3: Register the route.** In `cli/server/src/features/config/router.ts`, add `getProviderModels` to the `./service.js` import and `ProviderModelsParamSchema` to the `./schemas.js` import, then insert after the static `openrouter` models route (so `openrouter` keeps priority), reusing the existing `modelFetchLimit`:

```ts
configRouter.get(
  "/provider/:id/models",
  modelFetchLimit,
  zValidator("param", ProviderModelsParamSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const result = await getProviderModels(id);
    if (!result.ok) {
      const status =
        result.error.code === ErrorCode.VALIDATION_ERROR ? 400
        : result.error.code === "PROVIDER_DISABLED" ? 404
        : 500;
      return errorResponse(c, result.error.message, result.error.code, status);
    }
    return c.json(result.value);
  },
);
```

> Use the router's existing `errorResponse`/`zodErrorHandler` helpers (already imported for the other config routes). If `ErrorCode` is not imported in `router.ts`, compare against the literal `"VALIDATION_ERROR"` string to match the service's emitted code.

Run: `pnpm --filter @diffgazer/server test src/features/config/router.test.ts`. Expected: PASS 5 tests.

- [ ] **Step 4: Type-check.** Run: `pnpm --filter @diffgazer/server type-check`. Expected: PASS.

- [ ] **Step 5: Commit.**
  ```
  git add cli/server/src/features/config/router.ts cli/server/src/features/config/schemas.ts cli/server/src/features/config/router.test.ts
  git commit -m "$(cat <<'EOF'
feat(server): add GET /provider/:id/models route over the models.dev catalog

Reuse the config:models rate-limit window, validate :id against the closed
AIProviderSchema, and serve the slim Zod-validated ProviderModelsResponse
(models + fetchedAt + source + cached) — never the raw blob. A route ->
service -> catalog -> (mocked fetch) E2E proves the live/cache/snapshot
fallback surfaces through HTTP with the correct source tag.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 19: `createLanguageModel` — add `groq` + `cerebras` via one `@ai-sdk/openai-compatible` factory keyed off overlay `baseURL`

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

Adds `groq` + `cerebras` cases to `createLanguageModel` in `cli/server/src/shared/lib/ai/client.ts` using a single `@ai-sdk/openai-compatible` factory parameterized by `PROVIDER_OVERLAY[provider].baseURL`. Keeps the dedicated `google`/`openrouter`/`zhipu` factories. Re-derives `DEFAULT_MODELS` from `PROVIDER_OVERLAY[id].defaultModel` (replacing the `AVAILABLE_PROVIDERS`-based map, which is being thinned in P2). Reuses the existing `isLanguageModel` runtime narrowing for SDK-drift safety. **Closes the P2-flagged `client.test.ts` `it.each([...AI_PROVIDERS])` red.**

> **Forward dependency:** `@ai-sdk/openai-compatible` is installed in Task 20. For TDD here, the test mocks it as a boundary (mirroring the existing `@ai-sdk/google`/`zhipu`/`openrouter` boundary mocks), so the implementation and unit test pass before the real package fetch; Task 20 then validates real adapters compile + load. Verified endpoints: groq `https://api.groq.com/openai/v1`, cerebras `https://api.cerebras.ai/v1` (these are the overlay `baseURL` values from Task 2).

**Files:**
- Modify: `cli/server/src/shared/lib/ai/client.ts` (imports + `DEFAULT_MODELS` + `createLanguageModel` switch)
- Test: `cli/server/src/shared/lib/ai/client.test.ts`

Steps:

- [ ] **Step 1: Add the boundary mock + groq/cerebras assertions.** In `client.test.ts`, add after the OpenRouter mock:

```ts
// Boundary mock: @ai-sdk/openai-compatible is the OpenAI-compatible external HTTP client (groq, cerebras).
vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => ({
    chatModel: vi.fn(() => ({ doGenerate: vi.fn(), doStream: vi.fn() })),
  })),
}));
```

Append a describe block (its `beforeEach`/`afterEach` should reuse this file's existing temp-home setup helpers):

```ts
describe("createLanguageModel openai-compatible providers", () => {
  it.each([
    { provider: "groq" as const, baseURL: "https://api.groq.com/openai/v1" },
    { provider: "cerebras" as const, baseURL: "https://api.cerebras.ai/v1" },
  ])("creates a $provider client via the openai-compatible factory using the overlay baseURL", async ({ provider, baseURL }) => {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    const { createAIClient } = await loadClient();
    const result = createAIClient({ apiKey: "test-key", provider });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.provider).toBe(provider);
    expect(createOpenAICompatible).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "test-key", baseURL, name: provider }));
  });

  it("uses the overlay defaultModel when no model is supplied for an openai-compatible provider", async () => {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    const { PROVIDER_OVERLAY } = await import("@diffgazer/core/catalog");
    const { createAIClient } = await loadClient();
    const result = createAIClient({ apiKey: "test-key", provider: "cerebras" });
    expect(result.ok).toBe(true);
    const chatModel = vi.mocked(createOpenAICompatible).mock.results[0]!.value.chatModel;
    expect(chatModel).toHaveBeenCalledWith(PROVIDER_OVERLAY.cerebras.defaultModel);
  });
});
```

Run: `pnpm --filter @diffgazer/server test src/shared/lib/ai/client.test.ts`. Expected: FAIL — the `it.each([...AI_PROVIDERS])` loop now includes groq/cerebras hitting the `default` (UNSUPPORTED_PROVIDER) branch, and the new block fails (`createOpenAICompatible` never called).

- [ ] **Step 2: Implement.** In `cli/server/src/shared/lib/ai/client.ts`, add `import { createOpenAICompatible } from "@ai-sdk/openai-compatible";` and `import { PROVIDER_OVERLAY } from "@diffgazer/core/catalog";`, switch `DEFAULT_MODELS` to derive from the overlay (replacing the `AVAILABLE_PROVIDERS` import, which is being thinned in P2):

```ts
const DEFAULT_MODELS = Object.fromEntries(
  (Object.keys(PROVIDER_OVERLAY) as AIProvider[]).map((id) => [id, PROVIDER_OVERLAY[id].defaultModel]),
) as Record<AIProvider, string>;
```

Add the case to the `createLanguageModel` switch between `openrouter` and `default`:

```ts
case "groq":
case "cerebras": {
  const overlay = PROVIDER_OVERLAY[provider];
  if (!overlay.baseURL) {
    return err(createError<AIErrorCode>("UNSUPPORTED_PROVIDER", `Provider "${provider}" is missing a baseURL`));
  }
  const compatible = createOpenAICompatible({ name: provider, apiKey, baseURL: overlay.baseURL });
  // chatModel() returns a v6 LanguageModel; narrow at runtime like the OpenRouter branch (SDK drift).
  const model: unknown = compatible.chatModel(modelId);
  if (!isLanguageModel(model)) {
    return err(createError<AIErrorCode>("MODEL_ERROR", `${provider} model "${modelId}" does not implement LanguageModel interface`));
  }
  return ok(model);
}
```

Run: `pnpm --filter @diffgazer/server test src/shared/lib/ai/client.test.ts`. Expected: PASS (all 6 providers covered + the new block).

- [ ] **Step 3: Type-check.** Run: `pnpm --filter @diffgazer/server type-check`. Expected: PASS (if it fails only on `@ai-sdk/openai-compatible` being unresolved, that closes after Task 20 — re-run there).

- [ ] **Step 4: Commit.**
  ```
  git add cli/server/src/shared/lib/ai/client.ts cli/server/src/shared/lib/ai/client.test.ts
  git commit -m "$(cat <<'EOF'
feat(server): wire groq + cerebras into createLanguageModel via openai-compatible

Add a single @ai-sdk/openai-compatible factory keyed off the overlay baseURL
(groq https://api.groq.com/openai/v1, cerebras https://api.cerebras.ai/v1),
reusing isLanguageModel runtime narrowing for SDK-drift safety. Keep the
dedicated google/openrouter/zhipu factories. Derive DEFAULT_MODELS from
PROVIDER_OVERLAY[id].defaultModel.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 20: Add `@ai-sdk/groq`, `@ai-sdk/cerebras`, `@ai-sdk/openai-compatible` deps + real-adapter contract test

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

Installs the three runtime adapters into `cli/server`, updates the lockfile via pnpm, and adds a real-adapter contract test (no `@ai-sdk/openai-compatible` mock) asserting `createLanguageModel` returns a real `LanguageModel` for groq and cerebras, plus a network-gated `generateObject` smoke (skipped unless `DIFFGAZER_LIVE_AI=1` + key env vars present).

**Justification (AGENTS.md Dependency Policy):** `createLanguageModel`'s groq/cerebras branch cannot construct a `LanguageModel` without `@ai-sdk/openai-compatible`; `@ai-sdk/groq`/`@ai-sdk/cerebras` are the canonical maintained adapters matching the existing per-provider convention (`@ai-sdk/google`, `@openrouter/ai-sdk-provider`, `zhipu-ai-provider`). Runtime, server-only (the `diffgazer` binary embeds `cli/server`) → `cli/server` `dependencies`. Peer-compatible: all three pin `zod` only (no `ai` peer), AI SDK v6 compatible; `cli/server` already uses `zod ^4`.

**Files:**
- Modify: `cli/server/package.json` (dependencies)
- Modify: root `pnpm-lock.yaml` (via pnpm; do not hand-edit)
- Test (new): `cli/server/src/shared/lib/ai/client.contract.test.ts`

Steps:

- [ ] **Step 1: Install the dependencies.** Run: `pnpm --filter @diffgazer/server add @ai-sdk/groq @ai-sdk/cerebras @ai-sdk/openai-compatible`. Expected: pnpm resolves AI-SDK-v6-compatible versions, writes them to `cli/server/package.json` `dependencies`, and updates `pnpm-lock.yaml`. Then verify loadability: `pnpm --filter @diffgazer/server exec node --input-type=module -e "import * as o from '@ai-sdk/openai-compatible'; import * as g from '@ai-sdk/groq'; import * as c from '@ai-sdk/cerebras'; console.log(typeof o.createOpenAICompatible, Object.keys(g).length>0, Object.keys(c).length>0)"`. Expected: `function true true`.

- [ ] **Step 2: Write the real-adapter contract test.** Create `cli/server/src/shared/lib/ai/client.contract.test.ts` (separate file so it does NOT inherit the `@ai-sdk/openai-compatible` mock from `client.test.ts`):

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const keyring = vi.hoisted(() => ({
  deleteKeyringSecret: vi.fn(),
  isKeyringAvailable: vi.fn(() => true),
  readKeyringSecret: vi.fn(() => ({ ok: true, value: null })),
  writeKeyringSecret: vi.fn(() => ({ ok: true, value: undefined })),
}));
vi.mock("../config/keyring.js", () => keyring);

let diffgazerHome: string;

beforeEach(() => {
  diffgazerHome = mkdtempSync(join(tmpdir(), "dg-ai-contract-"));
  process.env.DIFFGAZER_HOME = diffgazerHome;
  vi.resetModules();
});
afterEach(() => {
  delete process.env.DIFFGAZER_HOME;
  rmSync(diffgazerHome, { recursive: true, force: true });
});

describe("createLanguageModel real openai-compatible adapters", () => {
  it.each(["groq", "cerebras"] as const)("returns a usable client backed by a real LanguageModel for %s", async (provider) => {
    const { createAIClient } = await import("./client.js");
    const result = createAIClient({ apiKey: "test-key", provider });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.provider).toBe(provider);
      expect(typeof result.value.generate).toBe("function");
      expect(typeof result.value.generateStream).toBe("function");
    }
  });
});

const LIVE = process.env.DIFFGAZER_LIVE_AI === "1";

describe.runIf(LIVE)("createLanguageModel live generateObject smoke (network-gated)", () => {
  it.each([
    { provider: "groq" as const, keyEnv: "GROQ_API_KEY" },
    { provider: "cerebras" as const, keyEnv: "CEREBRAS_API_KEY" },
  ])("produces a structured object via $provider", async ({ provider, keyEnv }) => {
    const apiKey = process.env[keyEnv];
    if (!apiKey) { console.warn(`[smoke-skip] ${provider}: ${keyEnv} not set`); return; }
    const { createAIClient } = await import("./client.js");
    const clientResult = createAIClient({ apiKey, provider });
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;
    const result = await clientResult.value.generate("Return an object with field ok set to true.", z.object({ ok: z.boolean() }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.ok).toBe(true);
  });
});
```

> Confirm `createAIClient`'s public shape (`{ provider, generate, generateStream }`) and `keyring.js` mock path against the real `client.ts`/`client.test.ts`; mirror this file's existing test harness exactly. The contract assertions are the load-bearing part.

Run: `pnpm --filter @diffgazer/server test src/shared/lib/ai/client.contract.test.ts`. Expected: PASS — 2 contract assertions green; the live block skipped (`describe.runIf(LIVE)` false).

- [ ] **Step 3: Re-run the mocked unit test + full server suite + type-check.** Run: `pnpm --filter @diffgazer/server test src/shared/lib/ai/client.test.ts` (still green — separate module graph). Run: `pnpm --filter @diffgazer/server type-check` (now `@ai-sdk/openai-compatible` resolves with real types). Run: `pnpm --filter @diffgazer/server test`. Expected: PASS (entire server suite incl. service, router, client, contract).

- [ ] **Step 4: Commit.**
  ```
  git add cli/server/package.json pnpm-lock.yaml cli/server/src/shared/lib/ai/client.contract.test.ts
  git commit -m "$(cat <<'EOF'
chore(server): add @ai-sdk groq/cerebras/openai-compatible runtime deps

Install the OpenAI-compatible adapter that backs the groq/cerebras
createLanguageModel branch, plus the named groq/cerebras adapters per the
existing per-provider adapter convention. Runtime, server-only deps; zod-only
peer, AI SDK v6 compatible. Add a real-adapter contract test (no boundary mock)
asserting both providers yield a usable LanguageModel, with a network-gated
generateObject smoke skipped unless DIFFGAZER_LIVE_AI=1 and the key env vars set.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Phase P4 verification gate (run after Tasks 17-20)

- [ ] Run: `pnpm --filter @diffgazer/server test` → Expected: PASS (service, router, client, client.contract, models-dev-catalog, disk-cache, openrouter-models, paths).
- [ ] Run: `pnpm --filter @diffgazer/server type-check` → Expected: PASS (groq/cerebras branches close the P2-flagged red).
- [ ] Run: `pnpm --filter @diffgazer/core type-check` → Expected: PASS.
- [ ] Run: `git diff --check` → Expected: clean.

---

## Phase P5 — Consumers (web + TUI) + E2E

> **Depends on P2 (deletions) + P4 (route + `ProviderModelsResponse`).** Mirror the proven OpenRouter consumer chain: a `configQueries.providerModels` query + `useProviderModels` hook beside `openRouterModels`/`useOpenRouterModels`, and a `useProviderModelsMapped(open, provider)` mapped hook (sibling of `useOpenRouterModelsMapped`) giving web/TUI a `{ models, loading, error, source }` shape so the `filterModels`/`cycleTierFilter`/`ModelInfo` rendering paths stay untouched below the data fetch. OpenRouter keeps its own live key-scoped path.
>
> **Real api-layer paths (reconciled):** the query options live in `libs/core/src/api/hooks/queries/config.ts`; the hooks in `libs/core/src/api/hooks/config.ts`; the bound fns in `libs/core/src/api/config.ts`; the hook exports in `libs/core/src/api/hooks/index.ts`. (One authoring section referenced `libs/core/src/api/queries/config.ts`; the real layout is the `hooks/` nesting shown here — verify the exact existing OpenRouter file before editing and mirror it.)

### Task 21: `providerModels` query + `useProviderModels` hook (api layer)

**Skills to load:** superpowers:test-driven-development, react-senior-guide, react-hook-authoring, react-useeffect, react-useref, react-anti-patterns, react-design-patterns, code-audit, clean-code, code-quality, anti-slop

**Files:**
- Modify: `libs/core/src/api/config.ts` (add `getProviderModels` bound fn beside `getOpenRouterModels`; add to `bindConfig`)
- Modify: `libs/core/src/api/hooks/queries/config.ts` (add `providerModels` query beside `openRouterModels`)
- Modify: `libs/core/src/api/hooks/config.ts` (add `useProviderModels` beside `useOpenRouterModels`)
- Modify: `libs/core/src/api/hooks/index.ts` (export `useProviderModels`)
- Test (new): `libs/core/src/api/hooks/use-provider-models.test.ts`

Steps:

- [ ] **Step 1: Write the failing hook test.** Create `libs/core/src/api/hooks/use-provider-models.test.ts`:

```ts
/** @vitest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoundApi } from "../bound.js";
import type { ProviderModelsResponse } from "@diffgazer/core/schemas/config";
import { ApiProvider } from "./context.js";
import { useProviderModels } from "./config.js";

function makeResponse(id: string): ProviderModelsResponse {
  return { models: [{ id, name: id, description: id, tier: "free" }], fetchedAt: new Date().toISOString(), source: "live", cached: false };
}

function makeWrapper(api: BoundApi) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, createElement(ApiProvider, { value: api }, children));
}

describe("useProviderModels", () => {
  let getProviderModels: ReturnType<typeof vi.fn>;
  let api: BoundApi;

  beforeEach(() => {
    getProviderModels = vi.fn(async (id: string) => makeResponse(id));
    api = { getProviderModels } as unknown as BoundApi;
  });

  it("fetches models for the requested provider", async () => {
    const { result } = renderHook(() => useProviderModels("gemini"), { wrapper: makeWrapper(api) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getProviderModels).toHaveBeenCalledWith("gemini");
    expect(result.current.data?.models[0]?.id).toBe("gemini");
  });

  it("does not fetch when disabled", () => {
    renderHook(() => useProviderModels("gemini", { enabled: false }), { wrapper: makeWrapper(api) });
    expect(getProviderModels).not.toHaveBeenCalled();
  });

  it("refetches with the new provider id across rerender", async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: "gemini" | "groq" }) => useProviderModels(id),
      { wrapper: makeWrapper(api), initialProps: { id: "gemini" } },
    );
    await waitFor(() => expect(result.current.data?.models[0]?.id).toBe("gemini"));
    rerender({ id: "groq" });
    await waitFor(() => expect(result.current.data?.models[0]?.id).toBe("groq"));
    expect(getProviderModels).toHaveBeenCalledWith("groq");
  });
});
```

> Verify the real `ApiProvider`/`useApi` context path and `BoundApi` type name against the existing `useOpenRouterModels` test in this package; mirror them exactly.

- [ ] **Step 2: Run it & confirm FAIL.** Run: `pnpm --filter @diffgazer/core test src/api/hooks/use-provider-models.test.ts`. Expected: FAIL — `useProviderModels` not exported.

- [ ] **Step 3: Add the bound fn.** In `libs/core/src/api/config.ts`, add `ProviderModelsResponse`/`ProviderModelsResponseSchema` to the imports and the fetch fn after `getOpenRouterModels` (mirror its `client.get` + Zod-validate shape):

```ts
export async function getProviderModels(client: ApiClient, providerId: string): Promise<ProviderModelsResponse> {
  return client.get<ProviderModelsResponse>(
    `/api/config/provider/${providerId}/models`,
    undefined,
    (body) => ProviderModelsResponseSchema.parse(body),
  );
}
```

Add to the `bindConfig` returned object: `getProviderModels: (providerId: string) => getProviderModels(client, providerId),`.

> Use the exact `client.get` signature the existing `getOpenRouterModels` uses (param order, validator arg). If `getOpenRouterModels` validates differently, mirror that exactly.

- [ ] **Step 4: Add the query.** In `libs/core/src/api/hooks/queries/config.ts`, after the `openRouterModels` entry:

```ts
providerModels: (api: BoundApi, providerId: string) =>
  queryOptions({
    queryKey: [...configQueries.all(), "provider-models", providerId] as const,
    queryFn: () => api.getProviderModels(providerId),
    staleTime: 5 * 60_000,
  }),
```

- [ ] **Step 5: Add the hook.** In `libs/core/src/api/hooks/config.ts`, after `useOpenRouterModels`:

```ts
export function useProviderModels(providerId: string, options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery({ ...configQueries.providerModels(api, providerId), ...options });
}
```

- [ ] **Step 6: Export the hook.** Add `useProviderModels` to the `./config.js` export block in `libs/core/src/api/hooks/index.ts`.

- [ ] **Step 7: Run & confirm PASS + type-check.** Run: `pnpm --filter @diffgazer/core test src/api/hooks/use-provider-models.test.ts` (PASS 3). Run: `pnpm --filter @diffgazer/core type-check` (PASS).

- [ ] **Step 8: Commit.**
  ```
  git add libs/core/src/api/config.ts libs/core/src/api/hooks/queries/config.ts libs/core/src/api/hooks/config.ts libs/core/src/api/hooks/index.ts libs/core/src/api/hooks/use-provider-models.test.ts
  git commit -m "$(cat <<'EOF'
feat(core): add providerModels query + useProviderModels hook

Mirrors the OpenRouter consumer chain (bound getProviderModels +
configQueries.providerModels + useProviderModels) so web and TUI can fetch
the models.dev-backed catalog over HTTP per provider.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 22: `useProviderModelsMapped` mapped hook (web/TUI-facing shape)

**Skills to load:** superpowers:test-driven-development, react-senior-guide, react-hook-authoring, react-useeffect, react-useref, react-anti-patterns, react-design-patterns, code-audit, clean-code, code-quality, anti-slop

Sibling of `useOpenRouterModelsMapped`. The server returns ready ordered `ModelInfo[]`, so this hook is a thin adapter: it gates the query on `open && provider !== "openrouter"` and exposes a stable `{ models, loading, error, source }` shape so web/TUI components branch on provider without re-implementing query-state handling.

**Files:**
- Create: `libs/core/src/providers/use-provider-models-mapped.ts`
- Modify: `libs/core/src/providers/index.ts` (export it)
- Test (new): `libs/core/src/providers/use-provider-models-mapped.test.ts`

Steps:

- [ ] **Step 1: Write the failing test.** Create `libs/core/src/providers/use-provider-models-mapped.test.ts`, mirroring `use-openrouter-models-mapped.test.ts`:

```ts
/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseProviderModels = vi.fn();
vi.mock("../api/hooks/config", () => ({ useProviderModels: (...args: unknown[]) => mockUseProviderModels(...args) }));

const { useProviderModelsMapped } = await import("./use-provider-models-mapped.js");

describe("useProviderModelsMapped", () => {
  beforeEach(() => mockUseProviderModels.mockReset());

  it("returns the server-provided models and source", () => {
    mockUseProviderModels.mockReturnValue({
      data: { models: [
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "1M ctx", tier: "free" },
        { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", description: "1M ctx", tier: "paid" },
      ], fetchedAt: new Date().toISOString(), source: "live", cached: false },
      isLoading: false, error: null,
    });
    const { result } = renderHook(() => useProviderModelsMapped(true, "gemini"));
    expect(result.current.loading).toBe(false);
    expect(result.current.source).toBe("live");
    expect(result.current.models.map((m) => m.id)).toEqual(["gemini-2.5-flash", "gemini-3-pro-preview"]);
  });

  it("returns loading state while the query is loading", () => {
    mockUseProviderModels.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const { result } = renderHook(() => useProviderModelsMapped(true, "gemini"));
    expect(result.current.loading).toBe(true);
    expect(result.current.models).toEqual([]);
  });

  it("returns error state when the query has an error", () => {
    mockUseProviderModels.mockReturnValue({ data: undefined, isLoading: false, error: new Error("catalog unavailable") });
    const { result } = renderHook(() => useProviderModelsMapped(true, "gemini"));
    expect(result.current.error).toBe("catalog unavailable");
    expect(result.current.models).toEqual([]);
  });

  it("stays disabled for openrouter (it has its own live path)", () => {
    mockUseProviderModels.mockReturnValue({ data: undefined, isLoading: false, error: null });
    const { result } = renderHook(() => useProviderModelsMapped(true, "openrouter"));
    expect(result.current.models).toEqual([]);
    expect(mockUseProviderModels).toHaveBeenCalledWith("openrouter", { enabled: false });
  });

  it("stays disabled when the dialog is closed", () => {
    mockUseProviderModels.mockReturnValue({ data: undefined, isLoading: false, error: null });
    const { result } = renderHook(() => useProviderModelsMapped(false, "gemini"));
    expect(result.current.models).toEqual([]);
    expect(mockUseProviderModels).toHaveBeenCalledWith("gemini", { enabled: false });
  });
});
```

- [ ] **Step 2: Run it & confirm FAIL.** Run: `pnpm --filter @diffgazer/core test src/providers/use-provider-models-mapped.test.ts`. Expected: FAIL — module not resolvable.

- [ ] **Step 3: Implement.** Create `libs/core/src/providers/use-provider-models-mapped.ts`:

```ts
import type { ModelInfo, AIProvider } from "@diffgazer/core/schemas/config";
import { OPENROUTER_PROVIDER_ID } from "@diffgazer/core/schemas/config";
import { useProviderModels } from "../api/hooks/config.js";

export interface ProviderModelsState {
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  source: "live" | "cache" | "snapshot" | null;
}

const EMPTY_STATE: ProviderModelsState = { models: [], loading: false, error: null, source: null };

export function useProviderModelsMapped(open: boolean, provider: AIProvider): ProviderModelsState {
  // OpenRouter keeps its own key-scoped live path; this hook serves every other
  // provider from the models.dev-backed catalog route.
  const enabled = open && provider !== OPENROUTER_PROVIDER_ID;
  const query = useProviderModels(provider, { enabled });

  if (!enabled) return EMPTY_STATE;
  if (query.isLoading) return { ...EMPTY_STATE, loading: true };
  if (query.error) return { ...EMPTY_STATE, error: query.error.message };

  const response = query.data;
  if (!response) return EMPTY_STATE;
  return { models: response.models, loading: false, error: null, source: response.source };
}
```

Add `export * from "./use-provider-models-mapped.js";` to `libs/core/src/providers/index.ts`.

- [ ] **Step 4: Run & confirm PASS + type-check.** Run: `pnpm --filter @diffgazer/core test src/providers/use-provider-models-mapped.test.ts` (PASS 5). Run: `pnpm --filter @diffgazer/core type-check` (PASS).

- [ ] **Step 5: Commit.**
  ```
  git add libs/core/src/providers/use-provider-models-mapped.ts libs/core/src/providers/use-provider-models-mapped.test.ts libs/core/src/providers/index.ts
  git commit -m "$(cat <<'EOF'
feat(core): add useProviderModelsMapped catalog consumer hook

Sibling of useOpenRouterModelsMapped. Gates the providerModels query on
open && non-openrouter and exposes a stable {models,loading,error,source}
shape so web and TUI branch on provider without re-implementing query state.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 23: Swap web `ModelSelectDialog` onto the catalog hook

**Skills to load:** superpowers:test-driven-development, react-senior-guide, react-hook-authoring, react-useeffect, react-useref, react-anti-patterns, react-design-patterns, code-audit, clean-code, code-quality, anti-slop

The dialog currently calls `getStaticModelsForProvider(provider)` (deleted in P2 Task 12) for non-OpenRouter providers. Replace that branch with `useProviderModelsMapped`, keeping the OpenRouter branch and all keyboard/filter wiring identical.

**Files:**
- Modify: `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.tsx`
- Test (new): `apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx`

Steps:

- [ ] **Step 1: Write the failing RTL integration test.** Create `model-select-dialog.integration.test.tsx`. Render the dialog inside the real `ApiProvider`/`QueryClientProvider`, with `api.getProviderModels` overridden to return a free-first Gemini payload; assert free-first render order, the free badge on the free model, and the tier filter narrowing to free-only:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createApi, type BoundApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import type { ProviderModelsResponse } from "@diffgazer/core/schemas/config";
import { ModelSelectDialog } from "./model-select-dialog";

const RESPONSE: ProviderModelsResponse = {
  models: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "1M context", tier: "free" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "1M context", tier: "free" },
    { id: "gemini-3-pro-preview", name: "Gemini 3 Pro Preview", description: "1M context", tier: "paid" },
  ],
  fetchedAt: new Date().toISOString(), source: "live", cached: false,
};

function renderDialog() {
  const getProviderModels = vi.fn<() => Promise<ProviderModelsResponse>>().mockResolvedValue(RESPONSE);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = { ...createApi({ baseUrl: "http://localhost" }), getProviderModels } satisfies BoundApi;
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, createElement(ApiProvider, { value: api }, children));
  render(<ModelSelectDialog open onOpenChange={vi.fn()} provider="gemini" currentModel="gemini-2.5-flash" onSelect={vi.fn()} />, { wrapper });
  return { getProviderModels };
}

describe("ModelSelectDialog (catalog)", () => {
  it("renders catalog models free-first with a free badge", async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByRole("radio", { name: /Gemini 2\.5 Flash/ })).toBeInTheDocument());
    const radios = screen.getAllByRole("radio").map((el) => el.getAttribute("value"));
    expect(radios).toEqual(["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-pro-preview"]);
    expect(screen.getByRole("radio", { name: /Gemini 2\.5 Flash/ })).toHaveTextContent(/free/i);
  });

  it("narrows to free-only when the free tier filter is applied", async () => {
    const user = userEvent.setup();
    renderDialog();
    await waitFor(() => expect(screen.getByRole("radio", { name: /Gemini 3 Pro Preview/ })).toBeInTheDocument());
    await user.keyboard("f"); // cycles all -> free
    await waitFor(() => expect(screen.queryByRole("radio", { name: /Gemini 3 Pro Preview/ })).not.toBeInTheDocument());
    expect(screen.getByRole("radio", { name: /Gemini 2\.5 Flash/ })).toBeInTheDocument();
  });
});
```

> Verify the real `ModelSelectDialog` props (`open`/`onOpenChange`/`provider`/`currentModel`/`onSelect`) and the filter keybinding (`f`) against the component before finalizing the test; adjust the queries to match how it renders names/badges. The behavioral contract (free-first order, free badge, tier filter) is load-bearing.

- [ ] **Step 2: Run it & confirm FAIL.** Run: `pnpm --filter @diffgazer/web test src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx`. Expected: FAIL — `getStaticModelsForProvider` no longer exported (import/build error).

- [ ] **Step 3: Swap the model source.** In `model-select-dialog.tsx`: remove the `getStaticModelsForProvider` import; import `useProviderModelsMapped` (and keep `useOpenRouterModelsMapped`) from `@diffgazer/core/providers`. Replace the static `models` derivation with:

```tsx
const openRouter = useOpenRouterModelsMapped(open, provider);
const catalog = useProviderModelsMapped(open, provider);
const isOpenRouter = provider === OPENROUTER_PROVIDER_ID;
const models = isOpenRouter ? openRouter.models : catalog.models;
```

and thread `catalog.loading`/`catalog.error` into the existing `isLoading`/`emptyLabel` props exactly where the OpenRouter branch already threads its own (so a slow/offline catalog never blanks the picker). Keep the keyboard/filter wiring unchanged.

- [ ] **Step 4: Run it & confirm PASS + no regression.** Run: `pnpm --filter @diffgazer/web test src/features/providers/components/model-select-dialog`. Expected: PASS (new integration test + existing dialog/model-list tests).

- [ ] **Step 5: Commit.**
  ```
  git add apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.tsx apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx
  git commit -m "$(cat <<'EOF'
feat(web): source ModelSelectDialog catalog from useProviderModelsMapped

Replaces the deleted getStaticModelsForProvider branch with the live catalog
hook for non-OpenRouter providers; OpenRouter keeps its key-scoped path.
Integration test covers free-first order, free badge, and tier filtering.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 24: Swap web onboarding `ModelStep` onto the catalog hook

**Skills to load:** superpowers:test-driven-development, react-senior-guide, react-hook-authoring, react-useeffect, react-useref, react-anti-patterns, react-design-patterns, code-audit, clean-code, code-quality, anti-slop

The onboarding `ModelStep` has a `StaticModelList` (uses deleted `getStaticModelsForProvider` + `AVAILABLE_PROVIDERS` static models) and an `OpenRouterModelList`. Collapse the static branch into a catalog branch driven by `useProviderModelsMapped`, keeping the `ModelRadioGroup`/badge/keyboard rendering unchanged.

**Files:**
- Modify: `apps/web/src/features/onboarding/components/steps/model-step.tsx`
- Modify (test): `apps/web/src/features/onboarding/components/steps/model-step.test.tsx`
- Modify (test): `apps/web/src/features/onboarding/hooks/use-onboarding.test.tsx` (replaces `GEMINI_MODEL_INFO` default-name lookups)

Steps:

- [ ] **Step 1: Rewrite the static-Gemini tests in `model-step.test.tsx`** to drive `provider="gemini"` with `api.getProviderModels` overridden at the boundary (mirror the OpenRouter test in the same file). Provide a `renderGemini` helper returning a free-first Gemini `ProviderModelsResponse` fixture, and assert Enter-commits-selected and ArrowDown-then-Enter-commits-highlighted against the catalog-driven list (commit values `gemini-2.5-pro` etc., matching the fixture order). Use `@/testing`'s `escapeRegExp` for name queries as the existing tests do.

- [ ] **Step 2: Fix `use-onboarding.test.tsx`** — replace the two `GEMINI_MODEL_INFO[firstProvider.defaultModel]?.name` lookups with the default-model name from a mocked catalog fixture (the default is still `gemini-2.5-flash` from the overlay). Keep the `AVAILABLE_PROVIDERS[0]` = gemini assertions.

- [ ] **Step 3: Run the tests & confirm FAIL.** Run: `pnpm --filter @diffgazer/web test src/features/onboarding`. Expected: FAIL — `model-step.tsx` still imports the deleted `getStaticModelsForProvider`/static models; import error.

- [ ] **Step 4: Rewrite `ModelStep`.** Remove the `getStaticModelsForProvider` import (and the deleted static-models usage). Factor the shared list renderer (`ModelInfoList`) that both branches feed, and add a `CatalogModelList` driven by `useProviderModelsMapped(true, provider)` with loading/error guards (loading text; on error, an `Input` for manual model id entry using `providerInfo?.defaultModel` as placeholder). Route the `ModelStep` dispatcher: `provider === "openrouter"` → `OpenRouterModelList`, else → `CatalogModelList`. Keep `RadioGroupItem`/`Badge`/`ModelRadioGroup` rendering (name, `recommended`, `tier.toUpperCase()` badge, description) and keyboard/boundary props identical to the existing component.

> Read the current `model-step.tsx` first and preserve its exact prop names (`provider`, `value`, `onChange`, `onCommit`, `enabled`, `onBoundaryReached`), `ModelRadioGroup` usage, and badge variants. Do not introduce new visual structure beyond swapping the data source.

- [ ] **Step 5: Run & confirm PASS.** Run: `pnpm --filter @diffgazer/web test src/features/onboarding`. Expected: PASS (model-step catalog tests + OpenRouter test + use-onboarding wizard tests).

- [ ] **Step 6: Commit.**
  ```
  git add apps/web/src/features/onboarding/components/steps/model-step.tsx apps/web/src/features/onboarding/components/steps/model-step.test.tsx apps/web/src/features/onboarding/hooks/use-onboarding.test.tsx
  git commit -m "$(cat <<'EOF'
feat(web): source onboarding ModelStep catalog from useProviderModelsMapped

Collapses the deleted static-Gemini/GLM branch into a CatalogModelList driven
by the live catalog hook; OpenRouter branch unchanged. Tests rewritten to drive
the catalog over the boundary-mocked api.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 25: Extend web `ProviderDetails` graceful path for catalog providers

**Skills to load:** superpowers:test-driven-development, react-senior-guide, react-useeffect, react-useref, react-anti-patterns, react-design-patterns, code-audit, clean-code, code-quality, anti-slop

`PROVIDER_CAPABILITIES` now derives for every enabled provider in the enum (pickers render only enabled providers per Decision C; surfaced providers are catalog data, never shown here). The empty-model placeholder hard-codes the OpenRouter exception; for an enabled provider with no wired default model (e.g. `openrouter`, where the user picks) it must degrade to a neutral label instead of printing `undefined (default)`.

**Files:**
- Modify: `apps/web/src/features/providers/components/provider-details.tsx`
- Test (new): `apps/web/src/features/providers/components/provider-details.test.tsx`

Steps:

- [ ] **Step 1: Write the failing test.** Create `provider-details.test.tsx` asserting: (a) with a `defaultModel`, the placeholder reads `gemini-2.5-flash (default)`; (b) with `defaultModel: undefined`, it reads `No default model` and never `undefined`.

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ProviderWithStatus } from "@diffgazer/core/schemas/config";
import { ProviderDetails } from "./provider-details";

const NOOP_ACTIONS = { onSetApiKey: vi.fn(), onSelectModel: vi.fn(), onRemoveKey: vi.fn(), onSelectProvider: vi.fn() };

function makeProvider(overrides: Partial<ProviderWithStatus> = {}): ProviderWithStatus {
  return { id: "gemini", name: "Gemini", displayStatus: "inactive", hasApiKey: false, model: undefined, defaultModel: "gemini-2.5-flash", ...overrides } as ProviderWithStatus;
}

describe("ProviderDetails (catalog)", () => {
  it("shows the default model placeholder when no model is selected", () => {
    render(<ProviderDetails provider={makeProvider()} actions={NOOP_ACTIONS} />);
    expect(screen.getByText(/gemini-2\.5-flash \(default\)/)).toBeInTheDocument();
  });

  it("degrades gracefully when an enabled provider has no default model", () => {
    // openrouter is enabled but has no wired default model (the user picks).
    render(<ProviderDetails provider={makeProvider({ id: "openrouter", name: "OpenRouter", defaultModel: undefined })} actions={NOOP_ACTIONS} />);
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
    expect(screen.getByText(/No default model/)).toBeInTheDocument();
  });
});
```

> Verify the real `ProviderDetails` props/`actions` shape and the existing placeholder helper name before finalizing; mirror them.

- [ ] **Step 2: Run it & confirm FAIL.** Run: `pnpm --filter @diffgazer/web test src/features/providers/components/provider-details.test.tsx`. Expected: FAIL — the no-default case renders `undefined (default)`.

- [ ] **Step 3: Harden the placeholder.** Update the empty-model placeholder helper:

```tsx
function getEmptyModelPlaceholder(provider: ProviderWithStatus): string {
  if (provider.id === OPENROUTER_PROVIDER_ID) return "Model required";
  if (!provider.defaultModel) return "No default model";
  return `${provider.defaultModel} (default)`;
}
```

- [ ] **Step 4: Run & confirm PASS.** Run: `pnpm --filter @diffgazer/web test src/features/providers/components/provider-details.test.tsx`. Expected: PASS 2 tests.

- [ ] **Step 5: Commit.**
  ```
  git add apps/web/src/features/providers/components/provider-details.tsx apps/web/src/features/providers/components/provider-details.test.tsx
  git commit -m "$(cat <<'EOF'
fix(web): degrade ProviderDetails model placeholder without a default model

Surfaced-but-disabled catalog providers may lack a wired defaultModel; show
'No default model' instead of 'undefined (default)'.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 26: Swap TUI `ModelSelectOverlay` onto the catalog hook + rewrite its pinned test

**Skills to load:** superpowers:test-driven-development, react-senior-guide, react-hook-authoring, react-useeffect, react-useref, react-anti-patterns, react-design-patterns, code-audit, clean-code, code-quality, anti-slop

Swaps the overlay's `getStaticModelsForProvider` branch for `useProviderModelsMapped`. The pinned W9.5 ArrowUp-after-shrink test imports the deleted `GEMINI_MODEL_INFO`; rewrite it to feed the same 5-model free-first layout (3 free, 2 paid) through a boundary-mocked `api.getProviderModels`, preserving the exact clamp/ArrowUp behavioral assertion. The transform's deterministic free-first ordering (P1 Task 3) honors the pinned Gemini order.

**Files:**
- Modify: `cli/diffgazer/src/features/providers/components/model-select-overlay.tsx`
- Modify (test): `cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx`

Steps:

- [ ] **Step 1: Rewrite the pinned overlay test.** Replace `model-select-overlay.test.tsx` with a version that mounts the overlay inside `QueryClientProvider`/`ApiProvider`/`CliThemeProvider`, with `getProviderModels` overridden to return a 5-model free-first catalog (`gemini-2.5-flash`/`gemini-2.5-flash-lite`/`gemini-2.5-pro` free, then `gemini-3-flash-preview`/`gemini-3-pro-preview` paid). Preserve the exact W9.5 behavioral assertion: navigate to the last item in the 5-item list, switch the tier filter to `paid` (shrinks to 2), assert the highlight is clamped to `safeHighlightIndex`, then ArrowUp moves to the FIRST paid model (not stuck on the last visible). Use `setImmediate`-based `flush()` and the `countPrefixes` highlight-detection helper from the original test.

> Read the existing `model-select-overlay.test.tsx` first to reuse its `Wrapper`, `flush`, `countPrefixes`, and ARROW key constants verbatim — only the data source (boundary-mocked `getProviderModels` returning the free-first fixture) changes. The clamp/ArrowUp assertion text must stay identical.

- [ ] **Step 2: Run it & confirm FAIL.** Run: `pnpm --filter diffgazer test src/features/providers/components/model-select-overlay.test.tsx`. Expected: FAIL — overlay still imports/calls `getStaticModelsForProvider`; with no static data the frame never lists the models.

- [ ] **Step 3: Swap the overlay.** In `model-select-overlay.tsx`: replace `getStaticModelsForProvider` with `useProviderModelsMapped` from `@diffgazer/core/providers` (keep `cycleTierFilter`/`filterModels`/`TierFilter` and `useOpenRouterModelsMapped`). Derive `models`/`loading`/`error` from the catalog hook for non-OpenRouter providers:

```tsx
const openRouter = useOpenRouterModelsMapped(open, providerId as AIProvider);
const catalog = useProviderModelsMapped(open, providerId as AIProvider);
const isOpenRouter = providerId === OPENROUTER_PROVIDER_ID;
const loading = isOpenRouter ? openRouter.loading : catalog.loading;
const error = activateProvider.error?.message ?? (isOpenRouter ? openRouter.error : catalog.error) ?? undefined;
const models = isOpenRouter ? openRouter.models : catalog.models;
```

Keep the Ink rendering, the W9.5 `safeHighlightIndex` clamp logic, and the `activateProvider` mutation wiring intact.

> Read the current overlay first; preserve its exact `isOpenRouter` check, error-precedence, and the saving/`activateProvider` state. Only the non-OpenRouter model source changes.

- [ ] **Step 4: Run it & confirm PASS + helper test.** Run: `pnpm --filter diffgazer test src/features/providers/components/model-select-overlay.test.tsx` (PASS — W9.5 preserved). Run: `pnpm --filter diffgazer test src/features/providers/components/model-select-helpers.test.ts` (PASS — unchanged).

- [ ] **Step 5: Commit.**
  ```
  git add cli/diffgazer/src/features/providers/components/model-select-overlay.tsx cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx
  git commit -m "$(cat <<'EOF'
feat(tui): source ModelSelectOverlay catalog from useProviderModelsMapped

Swaps the deleted getStaticModelsForProvider branch for the live catalog hook;
OpenRouter keeps its key-scoped path. The pinned W9.5 ArrowUp-after-shrink test
is rewritten to feed the same 5-model free-first layout through the
boundary-mocked api, preserving the exact clamp/ArrowUp behavior.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 27: Swap TUI onboarding `ModelStep` onto the catalog hook

**Skills to load:** superpowers:test-driven-development, react-senior-guide, react-hook-authoring, react-useeffect, react-useref, react-anti-patterns, react-design-patterns, code-audit, clean-code, code-quality, anti-slop

The TUI onboarding `ModelStep` uses `getStaticModels` (reading deleted `GEMINI_MODEL_INFO`/`GLM_MODEL_INFO`) for non-OpenRouter providers. Route the non-OpenRouter branch through `useProviderModels` and reuse the existing `modelInfoToOption` mapper.

**Files:**
- Modify: `cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx`
- Test (new): `cli/diffgazer/src/features/onboarding/components/steps/model-step.test.tsx`

Steps:

- [ ] **Step 1: Write the failing Ink test.** Create `model-step.test.tsx` mounting the step inside `QueryClientProvider`/`ApiProvider`/`CliThemeProvider` with `getProviderModels` overridden to return a 2-model fixture (one free+recommended, one paid). Assert the frame lists both model names and shows the `free` + `recommended` badges. Use the `setImmediate`-based `flush()` pattern.

- [ ] **Step 2: Run it & confirm FAIL.** Run: `pnpm --filter diffgazer test src/features/onboarding/components/steps/model-step.test.tsx`. Expected: FAIL — imports the deleted `GEMINI_MODEL_INFO`/`GLM_MODEL_INFO`; module error.

- [ ] **Step 3: Rewrite the step.** Remove the `GEMINI_MODEL_INFO`/`GLM_MODEL_INFO` import and the `getStaticModels` switch. Gate two queries: `useOpenRouterModels({ enabled: isOpenRouter })` and `useProviderModels(provider, { enabled: isActive && !isOpenRouter })`. Derive the model option list: OpenRouter → `(openRouterQuery.data?.models ?? []).map(openRouterToOption)`; else → `(catalogQuery.data?.models ?? []).map(modelInfoToOption)`. Keep the existing `guardQueryState`/subtitle/option rendering and the OpenRouter branch intact.

> Read the current TUI `model-step.tsx` first; preserve `modelInfoToOption`/`openRouterToOption`, the `isActive` gating, and the rendering. Only the non-OpenRouter data source changes.

- [ ] **Step 4: Run & confirm PASS.** Run: `pnpm --filter diffgazer test src/features/onboarding/components/steps/model-step.test.tsx`. Expected: PASS.

- [ ] **Step 5: Commit.**
  ```
  git add cli/diffgazer/src/features/onboarding/components/steps/model-step.tsx cli/diffgazer/src/features/onboarding/components/steps/model-step.test.tsx
  git commit -m "$(cat <<'EOF'
feat(tui): source onboarding ModelStep catalog from useProviderModels

Replaces the deleted GEMINI_MODEL_INFO/GLM_MODEL_INFO static path with the
live catalog query for non-OpenRouter providers; OpenRouter branch unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 28: Network-gated live models.dev E2E smoke check

**Skills to load:** superpowers:test-driven-development, code-audit, clean-code, code-quality, anti-slop

The route integration test (Task 18) is the in-process E2E layer. This adds the live-network layer: a smoke script that fetches the real `https://models.dev/api.json`, parses it with the shipped `parseModelsDevCatalog`, and asserts `gemini`/`groq`/`cerebras` resolve to non-empty `ModelInfo[]` via `catalogToModelInfo`. Gated like the existing network smoke: skipped unless `DIFFGAZER_SMOKE_ALLOW_NETWORK=1`, and `DIFFGAZER_SMOKE_STRICT_SKIPS=1` turns a skip into a hard failure.

**Files:**
- Create: `scripts/monorepo/smoke-modelsdev.mjs`
- Modify: `package.json` (`smoke` chains `smoke:modelsdev`; add `smoke:modelsdev` script)
- Modify: `TESTING.md` (document the network-gated smoke)

Steps:

- [ ] **Step 1: Write the smoke script (the executable check is the test).** Create `scripts/monorepo/smoke-modelsdev.mjs`. It imports `networkAllowed` from `./smoke-shared.mjs` and the strict-skip env name from the existing smoke env module, consumes the SHIPPED built catalog (`libs/core/dist/catalog/index.js`) for `parseModelsDevCatalog` + `catalogToModelInfo`, fetches `https://models.dev/api.json` with `AbortSignal.timeout(15_000)`, and asserts each of `gemini`/`groq`/`cerebras` resolves to a non-empty list. On no-network: print `SKIP:` and exit 0, unless strict-skips is set, in which case throw.

```js
#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { networkAllowed } from "./smoke-shared.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LABEL = "live models.dev catalog";
const STRICT = "DIFFGAZER_SMOKE_STRICT_SKIPS";
const ALLOW = "DIFFGAZER_SMOKE_ALLOW_NETWORK";
const ENABLED_PROVIDERS = ["gemini", "groq", "cerebras"];

async function run() {
  if (!networkAllowed()) {
    if (process.env[STRICT] === "1") {
      throw new Error(`${LABEL} smoke requires network access. Set ${ALLOW}=1 to run it.`);
    }
    console.log(`SKIP: ${LABEL} (network disabled; set ${ALLOW}=1 to run, or ${STRICT}=1 to fail on skips)`);
    return;
  }

  const { parseModelsDevCatalog, catalogToModelInfo } = await import(resolve(root, "libs/core/dist/catalog/index.js"));
  const response = await fetch("https://models.dev/api.json", { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${LABEL}: HTTP ${response.status}`);
  const catalog = parseModelsDevCatalog(await response.json());

  for (const provider of ENABLED_PROVIDERS) {
    const models = catalogToModelInfo(catalog, provider);
    if (models.length === 0) throw new Error(`${LABEL}: provider '${provider}' resolved to zero models`);
    console.log(`OK: ${provider} -> ${models.length} models (live models.dev)`);
  }
  console.log(`OK: ${LABEL} smoke passed`);
}

run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
```

> Verify `networkAllowed` is exported by `scripts/monorepo/smoke-shared.mjs` and that the strict-skip env name matches the repo convention (read `smoke-shared.mjs` / the smoke env module). If the smoke harness exposes a shared `skipOrFail` helper, reuse it rather than re-implementing the skip/strict branch.

- [ ] **Step 2: Verify SKIP (default) and strict FAIL.** Run: `node scripts/monorepo/smoke-modelsdev.mjs` → Expected: prints `SKIP: live models.dev catalog ...`, exit 0. Run: `DIFFGAZER_SMOKE_STRICT_SKIPS=1 node scripts/monorepo/smoke-modelsdev.mjs` → Expected: FAIL (non-zero, "requires network access").

- [ ] **Step 3: Wire into the smoke suite.** In `package.json`, append `&& pnpm run smoke:modelsdev` to the `smoke` script and add `"smoke:modelsdev": "pnpm --filter @diffgazer/core build && node scripts/monorepo/smoke-modelsdev.mjs"`. In `TESTING.md`, add a short paragraph documenting that `smoke:modelsdev` fetches live `models.dev/api.json` and asserts `gemini`/`groq`/`cerebras` resolve via the shipped `@diffgazer/core/catalog` surface; SKIPs unless `DIFFGAZER_SMOKE_ALLOW_NETWORK=1`; strict-skips turns the skip into a hard failure.

- [ ] **Step 4: Run the live path (network-gated).** Run: `DIFFGAZER_SMOKE_ALLOW_NETWORK=1 pnpm run smoke:modelsdev` → Expected: builds `@diffgazer/core`, prints `OK: gemini -> N models`, `OK: groq -> N models`, `OK: cerebras -> N models`, `OK: live models.dev catalog smoke passed`. If the environment has no outbound network, record it as a documented skip in the final response.

- [ ] **Step 5: Commit.**
  ```
  git add scripts/monorepo/smoke-modelsdev.mjs package.json TESTING.md
  git commit -m "$(cat <<'EOF'
test(smoke): add network-gated live models.dev catalog smoke

Fetches live models.dev/api.json and asserts gemini/groq/cerebras resolve via
the shipped @diffgazer/core/catalog surface. Skipped unless
DIFFGAZER_SMOKE_ALLOW_NETWORK=1; strict-skips turns the skip into a failure.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```

### Task 29: Regenerate + validate handoff artifacts after the consumer swap

**Skills to load:** superpowers:verification-before-completion, code-audit, clean-code, code-quality, anti-slop

The config schemas feed the registry/handoff contract; the catalog snapshot is a `prepare:artifacts` step. Regenerate and validate so the handoff contract reflects the migrated config + catalog.

**Files:** none authored (regeneration only; commit any regenerated committed artifacts).

Steps:

- [ ] **Step 1: Regenerate.** Run: `pnpm run prepare:artifacts`. Expected: regenerates the catalog snapshot (if stale) and config-derived bundles; no errors.

- [ ] **Step 2: Validate.** Run: `pnpm run validate:artifacts:check`. Expected: exit 0, no drift reported.

- [ ] **Step 3: Commit any regenerated committed artifacts.** If Step 1 changed committed files (e.g. `catalog-snapshot.ts`, public registry JSON):
  ```
  git add -A
  git commit -m "$(cat <<'EOF'
chore(catalog): regenerate handoff artifacts after consumer swap

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
  ```
  If nothing changed, skip the commit.

### Phase P5 verification gate (run after Tasks 21-29)

- [ ] Run: `pnpm --filter @diffgazer/core test && pnpm --filter @diffgazer/web test && pnpm --filter diffgazer test` → Expected: PASS — incl. `use-provider-models`, `use-provider-models-mapped`, `model-select-dialog.integration`, web `model-step`, `use-onboarding`, `provider-details`, TUI `model-select-overlay` (W9.5), TUI `model-step`.
- [ ] Run: `pnpm run prepare:artifacts && pnpm run validate:artifacts:check` → Expected: clean, no drift.
- [ ] Run: `git diff --check` → Expected: clean.

---

## Phase P6 — Final Verification (closing gate)

### Task 30: Final Verification Gates

**Skills to load:** superpowers:verification-before-completion, code-audit, clean-code, code-quality, anti-slop

Runs the exact AGENTS.md command set as the closing gate for the whole feature. Run in order; a non-zero exit or unexpected skip is a hard stop — fix it in the file it surfaces, then re-run the failing gate before proceeding. **Run `sota-verify` once after this task completes (effort-level, not per-Task).**

**Files:** none (verification only).

Steps:

- [ ] **Step 1: Regenerate + validate artifacts.** Run: `pnpm run prepare:artifacts && pnpm run validate:artifacts:check`. Expected: exit 0, no drift.

- [ ] **Step 2: Focused per-package tests.** Run: `pnpm --filter @diffgazer/core test && pnpm --filter @diffgazer/web test && pnpm --filter diffgazer test && pnpm --filter @diffgazer/server test`. Expected: PASS.

- [ ] **Step 3: Monorepo type-check.** Run: `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check`. Expected: PASS across all packages — no deleted-symbol references to `GEMINI_MODEL_INFO`/`GLM_MODEL_INFO`/`getStaticModelsForProvider` remain.

- [ ] **Step 4: Monorepo tests.** Run: `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test`. Expected: PASS across all packages.

- [ ] **Step 5: Smoke (strict skips).** Run with network when available: `DIFFGAZER_SMOKE_ALLOW_NETWORK=1 DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke`. Expected: PASS. If the environment is offline, run `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` and record the `smoke:modelsdev` network skip explicitly in the final handoff (it will hard-fail under strict-skips without network — this is by design; document the exception rather than weakening the gate).

- [ ] **Step 6: Monorepo invariants.** Run: `pnpm run verify:monorepo`. Expected: PASS (boundary/closure invariants hold; the new `./catalog` subpath and `/provider/:id/models` route respected).

- [ ] **Step 7: Whitespace/conflict check.** Run: `git diff --check`. Expected: no output.

- [ ] **Step 8: Commit any final artifact regeneration** (if Step 1 produced unstaged committed changes); otherwise skip.

---

## Self-Review Notes

### Spec coverage (design section → Task numbers)

- **D1 (`@diffgazer/core/catalog` subpath, not a package):** Task 6 (barrel + `"./catalog"` export + build proof).
- **D2 (free = curated `hasFreeTier` + derived `pricingTier`):** Task 2 (`freeTier` selector), Task 3 (`pricingTierOf`, `isModelFreeToUse`, `catalogToModelInfo` — pins gemini-2.5-flash→free, gemini-3-pro-preview→paid, zai/zai-coding, groq/cerebras→free), Task 4 (`deriveCapabilities` tier/mixed).
- **D3 (enable 4 + groq + cerebras; surface 3):** Task 2 (`PROVIDER_OVERLAY` 6 enabled + `SURFACED_OVERLAYS` 3), Task 7 (enum +groq/cerebras), Task 19 (`createLanguageModel` branches), Task 20 (adapters + default-model contract test).
- **D4 (OpenRouter stays on its live API):** Task 12 (`buildModels` keeps OpenRouter live mapping), Task 15 (shared cache helper, OpenRouter tests unchanged), Tasks 21-22/23-24/26-27 (OpenRouter branch preserved in every consumer).
- **D5 (closed enum; relax model validation; server-side validate):** Task 7 (closed enum +2), Task 8 (`isValidModelForProvider` → non-empty), Task 9 (env-var allowlist exhaustive), Task 13 + Task 17 (server-side validation at `activateProvider` / `getProviderModels` service).
- **D6 (generated TS snapshot + 24h cache + offline hatch):** Task 5 (`catalog-snapshot.ts` generator + committed snapshot), Task 14 (cache path), Task 15 (`withTtlAndFallback`), Task 16 (three-tier `getProviderModels` + `DIFFGAZER_OFFLINE` + shrink-guard).
- **Data model — `ModelsDevCatalogSchema` (per-model safeParse):** Task 1. **`ProviderOverlay`:** Task 2. **`ModelInfo` unchanged:** Task 3 (transform populates additively), Task 11 (keeps `ModelInfoSchema`).
- **Integration & migration:** delete GEMINI/GLM constants — Task 11; delete static `buildModels` branches — Task 12; expand enum — Task 7; `PROVIDER_CAPABILITIES`/`AVAILABLE_PROVIDERS`/env-vars derive — Tasks 9-10; `createLanguageModel` + `DEFAULT_MODELS` — Task 19; deps — Task 20; ripple consumers + artifacts — Tasks 23-29.
- **HTTP endpoint:** Task 17 (service + `ProviderModelsResponse`), Task 18 (route + E2E + rate-limit + slim-payload Zod guard).
- **Client consumption (web + TUI):** Task 21 (`useProviderModels`), Task 22 (`useProviderModelsMapped`), Tasks 23-25 (web), Tasks 26-27 (TUI).
- **Testing plan:** schema resilience — Task 1; id mapping/merge — Tasks 2-3; free-tier regression — Task 3; pricingTier distinction — Task 3; ordering — Task 3 + Task 26; capability derivation — Task 4; three-tier fallback + shrink-guard — Task 16; offline hatch — Task 16; HTTP route — Task 18; defaults present — Tasks 2/5/10; AI client contract + generateObject smoke — Task 20; config invariants — Tasks 7-8; snapshot bundling — Task 5 (TS-module rationale; binary-inline proof folded into the existing build/smoke gates in Task 30).
- **Verification gates (AGENTS.md):** per-phase gates after P1-P5; full set in Task 30.

### Deviations the authors flagged (carried into the assembled plan)

1. **`PROVIDER_OVERLAY` is exhaustive only over the closed enum; the 3 surfaced providers live in `SURFACED_OVERLAYS`.** The design's 9-row table is satisfied by 6 rows in `PROVIDER_OVERLAY` + 3 in `SURFACED_OVERLAYS`, keeping both the pinned `Record<AIProvider, ProviderOverlay>` signature and the closed-enum boundary (D5) sound. (Tasks 2, 5, 16.)
2. **`AVAILABLE_PROVIDERS` is enabled-only (the 6 wired), not all-overlay** (Decision C), to preserve onboarding invariants (`AVAILABLE_PROVIDERS[0]` = gemini, picker maps over activatable providers). Disabled/surfaced providers are catalog DATA only and are NOT rendered in any picker — there is no "coming soon" UI. `SURFACED_OVERLAYS` stays catalog data that a future documented UI boundary could read directly. (Task 10.)
3. **Provider display names are derived from models.dev (Decision A):** resolved `overlay.displayName ?? <models.dev `name` from `CATALOG_SNAPSHOT`> ?? humanize(id)`. `ProviderOverlay` carries an optional `displayName` curated OVERRIDE (today only gemini -> "Google Gemini"); the primary source is the models.dev provider `name`, so new providers need no name copy. The resolver lives in `capabilities.ts` (the AVAILABLE_PROVIDERS derivation); no separate presentation map. (Tasks 2, 10.)
4. **`PROVIDER_CAPABILITIES` derives from the bundled `CATALOG_SNAPSHOT` synchronously** (not a live catalog), because it is consumed as a static `Record` by `providers/filter.ts` and web components; the snapshot guarantees non-blank capability cards offline (D6). (Task 10.)
5. **`getProviderModels` (catalog) does NOT route through `withTtlAndFallback`** — it needs a three-way `source` tag and an unconditional snapshot floor the two-state helper cannot express; it reuses `loadDiskCache`/`persistDiskCache` (no duplication). (Task 16.)
6. **`fetchModelsDevCatalog` takes an optional `{ baselineModelCount }`** (additive to the pinned zero-arg signature) so the shrink-guard is unit-testable and the resolver can pass the cache-or-snapshot baseline. (Task 16.)
7. **OpenRouter refactor logging delta:** the pre-refactor "fetched" `console.info` `cacheWasValid=...` suffix is dropped (no test asserts it); restore by threading the freshness flag out of the helper if a retained test ever asserts it. (Task 15.)
8. **`PROVIDER_DISABLED` is a TYPED domain error code (Decision B)** defined in `libs/core/src/schemas/config/catalog-errors.ts` via `createDomainErrorCodes`/`createDomainErrorSchema` (the same mechanism as `ReviewErrorSchema`/`AIErrorCode`), consumed as `createError<CatalogErrorCode>`. Unknown ids fail `AIProviderSchema` validation → typed `ErrorCode.VALIDATION_ERROR` via the existing zod path; disabled → HTTP 404, unknown → HTTP 400 (closed-enum param validation). The pre-existing ad-hoc `"PROVIDER_NOT_FOUND"`/`"INVALID_BODY"` strings in the config service are an optional adjacent cleanup, not part of this change. (Tasks 17-18.)
9. **Route param schema keyed `id`** (`ProviderModelsParamSchema`), added rather than renaming `ProviderParamSchema`, because Hono binds param validation by route-segment name and the route is `:id`. (Task 18.)
10. **api-layer real paths reconciled:** query options in `api/hooks/queries/config.ts`, hooks in `api/hooks/config.ts`, bound fns in `api/config.ts`, exports in `api/hooks/index.ts` (one authoring section referenced a flatter `api/queries/config.ts`). (Task 21.)
11. **`useProviderModelsMapped` added** (beyond the pinned `useProviderModels`) as a thin sibling of `useOpenRouterModelsMapped`, to keep the four web/TUI consumers from each re-implementing query-state branching. (Task 22.)
12. **`generateObject` smoke is network-gated + strict-skip-aware** (`DIFFGAZER_LIVE_AI=1` + key env), and the live models.dev E2E uses the existing `DIFFGAZER_SMOKE_ALLOW_NETWORK`/`DIFFGAZER_SMOKE_STRICT_SKIPS` mechanism rather than inventing a new flag. (Tasks 20, 28.)

### Residual risks

- **`/tmp/modelsdev.json` availability (Task 5):** if absent at execution time, fetch it first (`curl -s https://models.dev/api.json -o /tmp/modelsdev.json`); the snapshot generator and the trimmed fixtures depend on real captured data.
- **Cross-phase red window:** between P2 Task 7 (enum) and P4 Task 19, `cli/server` type-check and `client.test.ts` `it.each([...AI_PROVIDERS])` are red on groq/cerebras by design. P4 closes them; do not declare ready until P6 is green.
- **Exact existing-file shapes (api hooks, `client.ts` `createAIClient`/`isLanguageModel`, `ModelSelectDialog`/`ModelStep`/`ProviderDetails` props, `model-select-overlay` W9.5 helpers, rate-limit reset, smoke env names):** every consumer/refactor Task instructs reading the real file first and mirroring its exact contract; the plan pins behavior, not unverified line numbers.
- **Adapter export names (`@ai-sdk/groq`/`@ai-sdk/cerebras`):** the implementation only consumes `@ai-sdk/openai-compatible`'s `createOpenAICompatible`; the named adapters are installed for convention/future options and verified loadable in Task 20 Step 1 (introspect exports if `createGroq`/`createCerebras` names differ).
- **Offline final smoke:** if the execution environment has no outbound network, the strict-skips models.dev smoke must be reported as a documented skip in the handoff (per the Final Response Contract) rather than silently passed.
