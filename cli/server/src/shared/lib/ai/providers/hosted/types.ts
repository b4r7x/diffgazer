import type { z } from "zod";
import type { AdapterExecuteRequest } from "../../types.js";

type HostedWireFamily = "google" | "openai-compatible" | "openrouter";

export type DispatchPacing = Readonly<{
  perDispatchWallTimeMs?: number;
  /** Idle budget: bounds the wait for answer bytes (keep-alive whitespace is not progress, probed 2026-09-02) and the headers phase of a gateway that commits headers only when generation ends (probed 2026-09-03); unset = the wall bounds both. */
  bodyIdleTimeoutMs?: number;
  maxParallelDispatches?: number;
  reasoning?: "may-reason";
}>;

/** The verified subset of OpenRouter's `provider` routing preferences the wire may send (docs: features/provider-routing). */
export type OpenRouterRoutingPreferences = Readonly<{
  preferred_max_latency: Readonly<Partial<Record<"p50" | "p75" | "p90" | "p99", number>>>;
}>;

export type HostedProductProfile = Readonly<{
  wireFamily: HostedWireFamily;
  structuredOutput: "strict-json-schema" | "json-object-local-validation";
  malformedOutputRetry: boolean;
  pacing?: DispatchPacing;
  routingPreferences?: OpenRouterRoutingPreferences;
}>;

export type HostedExecutionContext = Readonly<{
  credential: string;
  reviewSchema: z.ZodType;
  structuredOutputSchema?: Record<string, unknown>;
  /**
   * Per-dispatch override of the profile's structured-output posture. An
   * aggregator route that does not declare structured-output support degrades
   * to JSON mode with local validation for that model only.
   */
  structuredOutputMode?: HostedProductProfile["structuredOutput"];
  /**
   * The route declares OpenRouter's `reasoning` request control, so the wire
   * bounds reasoning spend the way the Gemini wire bounds thinking — without
   * it a reasoning-default route can burn the whole completion budget on
   * thought and return no content.
   */
  boundReasoning?: boolean;
  fetch?: typeof fetch;
  now?: () => Date;
}>;

export type HostedAdapterDependencies = Readonly<{
  resolveContext: (request: AdapterExecuteRequest) => Promise<HostedExecutionContext | null>;
}>;

export type HostedExecuteRequest = AdapterExecuteRequest &
  Readonly<{
    context: HostedExecutionContext;
  }>;
