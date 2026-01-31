import type { AIClient } from "../ai/index.js";
import { createAIClient } from "../ai/index.js";
import { configStore } from "../storage/index.js";
import { getApiKey } from "../secrets/index.js";
import { ErrorCode, type ErrorCode as ErrorCodeType } from "@repo/schemas/errors";
import type { Result } from "@repo/core";
import { ok, err } from "@repo/core";

export interface AIClientError {
  message: string;
  code: ErrorCodeType;
}

export interface SSEWriter {
  writeSSE: (data: { event: string; data: string }) => Promise<void>;
}

export async function initializeAIClient(): Promise<Result<AIClient, AIClientError>> {
  const configResult = await configStore.read();
  if (!configResult.ok) {
    return err({ message: "AI provider not configured", code: ErrorCode.CONFIG_NOT_FOUND });
  }

  const apiKeyResult = await getApiKey(configResult.value.provider);
  if (!apiKeyResult.ok || !apiKeyResult.value) {
    return err({
      message: `API key not found for provider '${configResult.value.provider}'`,
      code: ErrorCode.API_KEY_MISSING,
    });
  }

  const clientResult = createAIClient({
    apiKey: apiKeyResult.value,
    provider: configResult.value.provider,
    model: configResult.value.model,
  });
  if (!clientResult.ok) {
    return err({ message: clientResult.error.message, code: ErrorCode.AI_CLIENT_ERROR });
  }

  return ok(clientResult.value);
}
