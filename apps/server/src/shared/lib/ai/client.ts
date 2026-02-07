import { generateObject, streamText, type LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createZhipu } from "zhipu-ai-provider";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { z } from "zod";
import type {
  AIClient,
  AIClientConfig,
  StreamCallbacks,
  AIError,
  AIErrorCode,
} from "./types.js";
import { type Result, ok, err } from "@stargazer/core/result";
import { createError, toError, getErrorMessage } from "@stargazer/core/errors";
import { AVAILABLE_PROVIDERS, type AIProvider } from "@stargazer/schemas/config";
import { getActiveProvider, getProviderApiKey } from "../config/store.js";
import { classifyError, type ErrorRule } from "../errors.js";

const DEFAULT_MODELS = Object.fromEntries(
  AVAILABLE_PROVIDERS.map((p) => [p.id, p.defaultModel])
) as Record<AIProvider, string>;

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 65536;
const DEFAULT_MAX_RETRIES = 0;
const DEFAULT_TIMEOUT_MS = 300_000;

const AI_ERROR_RULES: ErrorRule<AIErrorCode>[] = [
  {
    patterns: ["quota", "insufficient", "billing", "exceeded your current quota", "insufficient_quota"],
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

function classifyApiError(error: unknown): AIError {
  const { code, message } = classifyError(error, AI_ERROR_RULES, {
    code: "MODEL_ERROR",
    message: (msg) => msg,
  });
  return createError<AIErrorCode>(code, message);
}

function createLanguageModel(config: AIClientConfig): Result<LanguageModel, AIError> {
  const { provider, apiKey, model } = config;
  const modelId = model ?? DEFAULT_MODELS[provider];

  switch (provider) {
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey });
      return ok(google(modelId as Parameters<typeof google>[0]));
    }
    case "zai": {
      const zhipu = createZhipu({
        apiKey,
        baseURL: "https://api.z.ai/api/paas/v4",
      });
      return ok(zhipu(modelId as Parameters<typeof zhipu>[0]));
    }
    case "zai-coding": {
      const zhipu = createZhipu({
        apiKey,
        baseURL: "https://api.z.ai/api/coding/paas/v4",
      });
      return ok(zhipu(modelId as Parameters<typeof zhipu>[0]));
    }
    case "openrouter": {
      const openrouter = createOpenRouter({ apiKey, compatibility: "strict" });
      // Double assertion: @openrouter/ai-sdk-provider returns a type incompatible
      // with Vercel AI SDK's LanguageModel due to SDK version mismatch. Functionally
      // compatible at runtime — the provider implements the same interface.
      return ok(openrouter.chat(modelId as Parameters<typeof openrouter.chat>[0]) as unknown as LanguageModel);
    }
    default:
      return err(
        createError<AIErrorCode>("UNSUPPORTED_PROVIDER", `Unsupported provider: ${provider}`)
      );
  }
}

export function createAIClient(config: AIClientConfig): Result<AIClient, AIError> {
  if (!config.apiKey) {
    return err(
      createError<AIErrorCode>("API_KEY_INVALID", `${config.provider} API key is required`)
    );
  }

  if (!config.provider) {
    return err(createError<AIErrorCode>("UNSUPPORTED_PROVIDER", "AI provider is required"));
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
      options?: { signal?: AbortSignal }
    ): Promise<Result<z.infer<T>, AIError>> {
      try {
        const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const timeoutSignal =
          timeoutMs > 0 && typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
            ? AbortSignal.timeout(timeoutMs)
            : undefined;
        const externalSignal = options?.signal;
        const abortSignal =
          timeoutSignal && externalSignal
            ? AbortSignal.any([timeoutSignal, externalSignal])
            : timeoutSignal ?? externalSignal;
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
      callbacks: StreamCallbacks
    ): Promise<void> {
      try {
        const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const result = streamText({
          model: languageModel,
          prompt,
          temperature: config.temperature ?? DEFAULT_TEMPERATURE,
          maxOutputTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
          timeout: timeoutMs > 0 ? { totalMs: timeoutMs, chunkMs: Math.min(5000, timeoutMs) } : undefined,
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
  const activeProvider = getActiveProvider();
  if (!activeProvider) {
    return err(createError<AIErrorCode>("UNSUPPORTED_PROVIDER", "AI provider not configured"));
  }

  if (!activeProvider.model) {
    return err(createError<AIErrorCode>("MODEL_ERROR", "Model selection is required"));
  }

  const apiKeyResult = getProviderApiKey(activeProvider.provider);
  if (!apiKeyResult.ok) {
    return err(createError<AIErrorCode>("MODEL_ERROR", apiKeyResult.error.message));
  }
  if (!apiKeyResult.value) {
    return err(
      createError<AIErrorCode>("API_KEY_MISSING", `API key not found for provider '${activeProvider.provider}'`)
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
