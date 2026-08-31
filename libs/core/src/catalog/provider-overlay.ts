import type { RunnableProductId } from "../schemas/config/transports.js";

export type ProviderOverlay = {
  readonly modelsDevIds: readonly string[];
  /**
   * Same-vendor models.dev sources whose identical model key may lend ONLY a
   * display name to a live-only row. Never cost, tier, or limits: those differ
   * per plan, and these sources neither enable products nor withhold rows.
   */
  readonly nameSourceIds?: readonly string[];
  /**
   * Present only when the product's endpoint profiles are separate billing
   * pools: maps EndpointProfile.id -> the models.dev source id publishing that
   * pool's models. Its presence is THE feature gate for pool semantics
   * (dual-list membership, sibling exclusion, pool-named failures).
   */
  readonly endpointSources?: Readonly<Record<string, string>>;
};

export const PROVIDER_OVERLAY: Partial<Record<RunnableProductId, ProviderOverlay>> = {
  gemini: { modelsDevIds: ["google"] },
  zai: { modelsDevIds: ["zai"], nameSourceIds: ["zai-coding-plan", "zhipuai-coding-plan"] },
  openrouter: { modelsDevIds: ["openrouter"] },
  deepseek: { modelsDevIds: ["deepseek"] },
  qwen: { modelsDevIds: ["alibaba"] },
  moonshot: { modelsDevIds: ["moonshotai"] },
  minimax: { modelsDevIds: ["minimax"] },
  "ollama-cloud": { modelsDevIds: ["ollama-cloud"] },
  // `opencode` first: on the ids both sources publish, first-source-wins dedup
  // keeps the Zen pay-as-you-go price — the price the default endpoint bills.
  "opencode-zen": {
    modelsDevIds: ["opencode", "opencode-go"],
    endpointSources: { zen: "opencode", go: "opencode-go" },
  },
};
