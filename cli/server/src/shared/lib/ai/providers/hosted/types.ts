import type { z } from "zod";
import type { AdapterExecuteRequest } from "../../types.js";

type HostedWireFamily = "google" | "openai-compatible" | "openrouter";

export type HostedProductProfile = Readonly<{
  wireFamily: HostedWireFamily;
  structuredOutput: "strict-json-schema" | "json-object-local-validation";
  usageContract: "optional" | "required-terminal";
  malformedOutputRetry: boolean;
}>;

export type HostedExecutionContext = Readonly<{
  credential: string;
  reviewSchema: z.ZodType;
  structuredOutputSchema?: Record<string, unknown>;
  workspaceAccountId?: string | null;
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
