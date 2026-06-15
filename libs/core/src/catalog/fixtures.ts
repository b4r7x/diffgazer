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
      // `limit.output: 1` marks it as an embedding model the review picker filters out.
      "gemini-embedding-001": {
        id: "gemini-embedding-001",
        name: "Gemini Embedding 001",
        family: "gemini-embedding",
        limit: { context: 2048, output: 1 },
        modalities: { input: ["text"], output: ["text"] },
        release_date: "2025-05-01",
        last_updated: "2025-05-01",
      },
      // Audio output (TTS): a usable output limit but no text output, so the
      // review picker filters it via `modalities.output`, not the floor.
      "gemini-2.5-flash-preview-tts": {
        id: "gemini-2.5-flash-preview-tts",
        name: "Gemini 2.5 Flash Preview TTS",
        family: "gemini-flash",
        cost: { input: 0.5, output: 10 },
        limit: { context: 8192, output: 16384 },
        modalities: { input: ["text"], output: ["audio"] },
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
