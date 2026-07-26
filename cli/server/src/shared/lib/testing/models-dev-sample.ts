// Trimmed, hand-shaped like the live models.dev /api.json (record-of-providers).
// Only fields the schema/transform read are kept. NOT the full 2.1 MB blob.
// cli/server-local copy so server tests do not import a libs/core test fixture.

export const MODELS_DEV_SAMPLE: unknown = {
  google: {
    id: "google",
    name: "Google",
    env: ["GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"],
    models: {
      // Priced sticker, but in the curated freeTier selector => ModelInfo.tier 'free'.
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
      },
      // Priced and NOT in the freeTier selector => ModelInfo.tier 'paid'.
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
    },
  },
  groq: {
    id: "groq",
    name: "Groq",
    env: ["GROQ_API_KEY"],
    models: {
      // Priced, but freeTier 'all' => ModelInfo.tier 'free'.
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
      // Priced, but freeTier 'all' => ModelInfo.tier 'free'.
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
  zai: {
    id: "zai",
    name: "Z.AI",
    api: "https://api.z.ai/api/paas/v4",
    env: ["ZHIPU_API_KEY"],
    models: {
      // Zero list price, no curation needed => ModelInfo.tier 'free'.
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
      // Priced, no provider selector => ModelInfo.tier 'paid'.
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
    },
  },
};
