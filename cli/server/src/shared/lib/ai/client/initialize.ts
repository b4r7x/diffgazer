import { CATALOG_SNAPSHOT, findModelLimit } from "@diffgazer/core/catalog";
import { createError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import { getStore } from "../../config/store.js";
import { getProviderModels } from "../models-dev-catalog.js";
import { getOpenRouterModelsWithCache } from "../openrouter-models.js";
import type { AIClient, AIError, AIErrorCode } from "../types.js";
import { createAIClient } from "./create.js";

export interface AIExecutionFingerprint {
  readonly provider: AIClient["provider"];
  readonly model: string;
}

export interface InitializedAIClient extends AIClient {
  readonly executionFingerprint: AIExecutionFingerprint;
}

interface ModelLimits {
  output?: number;
  context?: number;
}

async function resolveSelectedModelLimits(
  provider: AIClient["provider"],
  model: string,
  apiKey: string,
): Promise<ModelLimits> {
  if (provider === "openrouter") {
    const catalogResult = await getOpenRouterModelsWithCache(apiKey);
    if (catalogResult.ok) {
      const currentModel = catalogResult.value.models.find((candidate) => candidate.id === model);
      if (currentModel) {
        return {
          output: currentModel.maxCompletionTokens,
          context: currentModel.contextLength > 0 ? currentModel.contextLength : undefined,
        };
      }
    }
    return findModelLimit(CATALOG_SNAPSHOT, provider, model);
  }

  const catalogResult = await getProviderModels(provider);
  const currentModel = catalogResult.models.find((candidate) => candidate.id === model);
  if (currentModel) {
    return {
      output: currentModel.maxOutputTokens,
      context: currentModel.contextLength,
    };
  }
  return findModelLimit(CATALOG_SNAPSHOT, provider, model);
}

export async function initializeAIClient(): Promise<Result<InitializedAIClient, AIError>> {
  const store = getStore();
  const activeProvider = store.getActiveProvider();
  if (!activeProvider) {
    return err(createError<AIErrorCode>("UNSUPPORTED_PROVIDER", "AI provider not configured"));
  }

  if (!activeProvider.model) {
    return err(createError<AIErrorCode>("MODEL_ERROR", "Model selection is required"));
  }

  const apiKeyResult = store.getProviderApiKey(activeProvider.provider);
  if (!apiKeyResult.ok) {
    return err(apiKeyResult.error);
  }
  if (!apiKeyResult.value) {
    return err(
      createError<AIErrorCode>(
        "API_KEY_MISSING",
        `API key not found for provider '${activeProvider.provider}'`,
      ),
    );
  }

  const limit = await resolveSelectedModelLimits(
    activeProvider.provider,
    activeProvider.model,
    apiKeyResult.value,
  );
  const clientResult = createAIClient({
    apiKey: apiKeyResult.value,
    provider: activeProvider.provider,
    model: activeProvider.model,
    outputLimit: limit.output,
    contextLimit: limit.context,
  });

  if (!clientResult.ok) {
    return err(clientResult.error);
  }

  return ok({
    ...clientResult.value,
    executionFingerprint: {
      provider: activeProvider.provider,
      model: activeProvider.model,
    },
  });
}
