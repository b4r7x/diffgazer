import type { RunnableProductId } from "../schemas/config/product-ids.js";
export interface EndpointProfile {
  readonly id: string;
  readonly label: string;
  readonly endpoint: string;
  readonly region?: string;
  readonly workspaceBound?: true;
}

type ProductEndpointTupleRegistry = {
  readonly [ProductId in RunnableProductId]: readonly EndpointProfile[];
};

export const PRODUCT_ENDPOINT_TUPLES = {
  gemini: [
    {
      id: "global",
      label: "Global",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
    },
  ],
  zai: [
    {
      id: "general-payg",
      label: "General Open Platform PAYG",
      endpoint: "https://api.z.ai/api/paas/v4",
    },
  ],
  openrouter: [{ id: "api", label: "OpenRouter API", endpoint: "https://openrouter.ai/api/v1" }],
  groq: [{ id: "global", label: "Global", endpoint: "https://api.groq.com/openai/v1" }],
  cerebras: [{ id: "global", label: "Global", endpoint: "https://api.cerebras.ai/v1" }],
  deepseek: [{ id: "payg", label: "Open Platform PAYG", endpoint: "https://api.deepseek.com/v1" }],
  qwen: [
    {
      id: "international",
      label: "International",
      endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      region: "international",
      workspaceBound: true,
    },
  ],
  moonshot: [
    {
      id: "mainland",
      label: "Mainland China",
      endpoint: "https://api.moonshot.cn/v1",
      region: "mainland",
    },
    {
      id: "international",
      label: "International",
      endpoint: "https://api.moonshot.ai/v1",
      region: "international",
    },
  ],
  mistral: [
    {
      id: "global",
      label: "Global",
      endpoint: "https://api.mistral.ai/v1",
      region: "global",
    },
    {
      id: "eu",
      label: "European Union",
      endpoint: "https://api.eu.mistral.ai/v1",
      region: "eu",
    },
  ],
  "ollama-cloud": [{ id: "cloud", label: "Ollama Cloud", endpoint: "https://ollama.com/v1" }],
  ollama: [{ id: "default", label: "Default loopback", endpoint: "http://127.0.0.1:11434" }],
  "local-openai": [
    {
      id: "lm-studio",
      label: "LM Studio",
      endpoint: "http://127.0.0.1:1234/v1",
    },
    {
      id: "llama-cpp",
      label: "llama.cpp",
      endpoint: "http://127.0.0.1:8080/v1",
    },
  ],
  "codex-cli": [],
  "copilot-cli": [],
} as const satisfies ProductEndpointTupleRegistry;
