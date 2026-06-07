import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { PROVIDER_OVERLAY } from "@diffgazer/core/catalog";
import { createError, toError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject, type LanguageModel, streamText } from "ai";
import { createZhipu } from "zhipu-ai-provider";
import type { z } from "zod";
import { getStore } from "../config/store.js";
import { classifyError, type ErrorRule } from "../errors.js";
import type { AIClient, AIClientConfig, AIError, AIErrorCode, StreamCallbacks } from "./types.js";

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 65536;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 300_000;

const AI_ERROR_RULES: ErrorRule<AIErrorCode>[] = [
  {
    patterns: [
      "quota",
      "insufficient",
      "billing",
      "exceeded your current quota",
      "insufficient_quota",
    ],
    code: "RATE_LIMITED",
    message: "Quota exceeded",
  },
  {
    patterns: ["401", "api key", "invalid_api_key", "authentication"],
    code: "API_KEY_INVALID",
    message: "Invalid API key",
  },
  {
    patterns: ["429", "rate limit", "too many requests"],
    code: "RATE_LIMITED",
    message: "Rate limited",
  },
  {
    patterns: ["network", "fetch", "econnrefused", "etimedout"],
    code: "NETWORK_ERROR",
    message: "Network error",
  },
];

// Some provider SDKs export a LanguageModel type that drifts from `ai`'s own;
// narrow the returned object structurally instead of trusting the static type.
function isLanguageModel(value: unknown): value is LanguageModel {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).doGenerate === "function" &&
    typeof (value as Record<string, unknown>).doStream === "function"
  );
}

function classifyApiError(error: unknown): AIError {
  const { code, message } = classifyError(error, AI_ERROR_RULES, {
    code: "MODEL_ERROR",
    message: (msg) => msg,
  });
  return createError<AIErrorCode>(code, message);
}

function resolveAbortSignal(
  config: AIClientConfig,
  externalSignal?: AbortSignal,
): AbortSignal | undefined {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutSignal =
    timeoutMs > 0 && typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(timeoutMs)
      : undefined;
  if (timeoutSignal && externalSignal) {
    return AbortSignal.any([timeoutSignal, externalSignal]);
  }
  return timeoutSignal ?? externalSignal;
}

function createLanguageModel(config: AIClientConfig): Result<LanguageModel, AIError> {
  const { provider, apiKey, model } = config;
  const overlay = PROVIDER_OVERLAY[provider];
  if (!overlay) {
    return err(
      createError<AIErrorCode>("UNSUPPORTED_PROVIDER", `Unsupported provider: ${provider}`),
    );
  }

  const modelId = model ?? overlay.defaultModel;
  if (!modelId) {
    return err(
      createError<AIErrorCode>("MODEL_ERROR", `A model id is required for provider "${provider}"`),
    );
  }

  switch (provider) {
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey });
      return ok(google(modelId as Parameters<typeof google>[0]));
    }
    case "zai":
    case "zai-coding": {
      if (!overlay.baseURL) {
        return err(
          createError<AIErrorCode>(
            "UNSUPPORTED_PROVIDER",
            `Provider "${provider}" is missing a baseURL`,
          ),
        );
      }
      const zhipu = createZhipu({ apiKey, baseURL: overlay.baseURL });
      return ok(zhipu(modelId as Parameters<typeof zhipu>[0]));
    }
    case "openrouter": {
      const openrouter = createOpenRouter({
        apiKey,
        compatibility: "strict",
        extraBody: { provider: { require_parameters: true } },
      });
      const sdkModel: unknown = openrouter.chat(modelId as Parameters<typeof openrouter.chat>[0]);
      if (!isLanguageModel(sdkModel)) {
        return err(
          createError<AIErrorCode>(
            "MODEL_ERROR",
            `OpenRouter model "${modelId}" does not implement LanguageModel interface`,
          ),
        );
      }
      return ok(sdkModel);
    }
    case "groq":
    case "cerebras": {
      if (!overlay.baseURL) {
        return err(
          createError<AIErrorCode>(
            "UNSUPPORTED_PROVIDER",
            `Provider "${provider}" is missing a baseURL`,
          ),
        );
      }
      const compatible = createOpenAICompatible({
        name: provider,
        apiKey,
        baseURL: overlay.baseURL,
      });
      const sdkModel: unknown = compatible.chatModel(modelId);
      if (!isLanguageModel(sdkModel)) {
        return err(
          createError<AIErrorCode>(
            "MODEL_ERROR",
            `${provider} model "${modelId}" does not implement LanguageModel interface`,
          ),
        );
      }
      return ok(sdkModel);
    }
  }
}

export function createAIClient(config: AIClientConfig): Result<AIClient, AIError> {
  if (!config.apiKey) {
    return err(
      createError<AIErrorCode>("API_KEY_INVALID", `${config.provider} API key is required`),
    );
  }

  const languageModelResult = createLanguageModel(config);
  if (!languageModelResult.ok) {
    return err(languageModelResult.error);
  }
  const languageModel = languageModelResult.value;

  const aiClient: AIClient = {
    provider: config.provider,

    async generate<T extends z.ZodType>(
      prompt: string,
      schema: T,
      options?: { signal?: AbortSignal },
    ): Promise<Result<z.infer<T>, AIError>> {
      try {
        const abortSignal = resolveAbortSignal(config, options?.signal);
        const result = await generateObject({
          model: languageModel,
          prompt,
          schema,
          temperature: config.temperature ?? DEFAULT_TEMPERATURE,
          maxOutputTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
          maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
          abortSignal,
        });

        return ok(result.object as z.infer<T>);
      } catch (error) {
        return err(classifyApiError(error));
      }
    },

    async generateStream(
      prompt: string,
      callbacks: StreamCallbacks,
      options?: { signal?: AbortSignal },
    ): Promise<void> {
      try {
        const abortSignal = resolveAbortSignal(config, options?.signal);
        const result = streamText({
          model: languageModel,
          prompt,
          temperature: config.temperature ?? DEFAULT_TEMPERATURE,
          maxOutputTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
          abortSignal,
        });

        const chunks: string[] = [];

        for await (const chunk of result.textStream) {
          if (chunk) {
            chunks.push(chunk);
            await callbacks.onChunk(chunk);
          }
        }

        const finishReason = await result.finishReason;

        const truncated = finishReason === "length";
        await callbacks.onComplete(chunks.join(""), { truncated, finishReason });
      } catch (error) {
        await callbacks.onError(toError(error));
      }
    },
  };

  return ok(aiClient);
}

export function initializeAIClient(): Result<AIClient, AIError> {
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
    return err(createError<AIErrorCode>("MODEL_ERROR", apiKeyResult.error.message));
  }
  if (!apiKeyResult.value) {
    return err(
      createError<AIErrorCode>(
        "API_KEY_MISSING",
        `API key not found for provider '${activeProvider.provider}'`,
      ),
    );
  }

  const clientResult = createAIClient({
    apiKey: apiKeyResult.value,
    provider: activeProvider.provider,
    model: activeProvider.model,
  });

  if (!clientResult.ok) {
    return err(clientResult.error);
  }

  return ok(clientResult.value);
}
