import type { AIClient } from "./ai/types.js";
import { createAIClient } from "./ai/sdk-client.js";
import { getActiveProvider, getProviderApiKey } from "./config-store/store.js";
import { ErrorCode, type ErrorCode as ErrorCodeType } from "@stargazer/schemas/errors";
import { type Result, ok, err } from "@stargazer/core";

interface AIClientError {
  message: string;
  code: ErrorCodeType;
}

export interface SSEWriter {
  writeSSE: (data: { event: string; data: string }) => Promise<void>;
}

export const initializeAIClient = (): Result<AIClient, AIClientError> => {
  const activeProvider = getActiveProvider();
  if (!activeProvider) {
    return err({ message: "AI provider not configured", code: ErrorCode.CONFIG_NOT_FOUND });
  }

  const apiKey = getProviderApiKey(activeProvider.provider);
  if (!apiKey) {
    return err({
      message: `API key not found for provider '${activeProvider.provider}'`,
      code: ErrorCode.API_KEY_MISSING,
    });
  }

  const clientResult = createAIClient({
    apiKey,
    provider: activeProvider.provider,
    model: activeProvider.model,
  });

  if (!clientResult.ok) {
    return err({ message: clientResult.error.message, code: ErrorCode.AI_CLIENT_ERROR });
  }

  return ok(clientResult.value);
};
