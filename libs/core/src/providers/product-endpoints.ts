import type { RunnableProductId } from "../schemas/config/product-ids.js";
export interface EndpointProfile {
  readonly id: string;
  readonly label: string;
  readonly endpoint: string;
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
  deepseek: [{ id: "payg", label: "Open Platform PAYG", endpoint: "https://api.deepseek.com/v1" }],
  qwen: [
    {
      id: "international",
      label: "International",
      endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    },
  ],
  // International first: the quick-setup default binds `endpoints[0]`.
  moonshot: [
    { id: "international", label: "International", endpoint: "https://api.moonshot.ai/v1" },
    { id: "mainland", label: "Mainland China", endpoint: "https://api.moonshot.cn/v1" },
  ],
  minimax: [{ id: "international", label: "International", endpoint: "https://api.minimax.io/v1" }],
  "ollama-cloud": [{ id: "cloud", label: "Ollama Cloud", endpoint: "https://ollama.com/v1" }],
  // Zen first: the quick-setup default binds `endpoints[0]`, and pay-as-you-go
  // credits are the tier every key can bill; Go serves only subscribers.
  "opencode-zen": [
    { id: "zen", label: "OpenCode Zen", endpoint: "https://opencode.ai/zen/v1" },
    { id: "go", label: "OpenCode Go", endpoint: "https://opencode.ai/zen/go/v1" },
  ],
} as const satisfies ProductEndpointTupleRegistry;
