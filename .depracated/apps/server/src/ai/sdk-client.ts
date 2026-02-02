import { generateObject, streamText, type LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createZhipu } from "zhipu-ai-provider";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { z } from "zod";
import type { AIClient, AIClientConfig, StreamCallbacks, GenerateStreamOptions, AIError, AIErrorCode } from "./types.js";
import type { Result } from "@repo/core";
import { ok, err, createError, toError, getErrorMessage } from "@repo/core";

const DEFAULT_MODELS = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
  glm: "glm-4.7",
  openrouter: "",
} as const;

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 65536;

const ERROR_RULES: Array<{ patterns: string[]; code: AIErrorCode; message: string }> = [
  { patterns: ["401", "api key", "invalid_api_key", "authentication"], code: "API_KEY_INVALID", message: "Invalid API key" },
  { patterns: ["429", "rate limit", "too many requests"], code: "RATE_LIMITED", message: "Rate limited" },
  { patterns: ["network", "fetch", "econnrefused", "etimedout"], code: "NETWORK_ERROR", message: "Network error" },
];

function classifyError(error: unknown): { code: AIErrorCode; message: string } {
  const msg = getErrorMessage(error).toLowerCase();
  for (const rule of ERROR_RULES) {
    if (rule.patterns.some((p) => msg.includes(p))) {
      return { code: rule.code, message: rule.message };
    }
  }
  return { code: "MODEL_ERROR", message: getErrorMessage(error) };
}

function classifyApiError(error: unknown): AIError {
  const { code, message } = classifyError(error);
  return createError<AIErrorCode>(code, message);
}

function createLanguageModel(config: AIClientConfig): LanguageModel {
  const { provider, apiKey, model, glmEndpoint } = config;
  const modelId = model ?? DEFAULT_MODELS[provider];

  switch (provider) {
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(modelId);
    }
    case "openai": {
      const openai = createOpenAI({ apiKey });
      return openai(modelId);
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(modelId);
    }
    case "glm": {
      const zhipu = createZhipu({
        apiKey,
        baseURL: glmEndpoint === "standard"
          ? "https://open.bigmodel.cn/api/paas/v4"
          : "https://api.z.ai/api/coding/paas/v4",
      });
      return zhipu(modelId);
    }
    case "openrouter": {
      const openrouter = createOpenRouter({
        apiKey,
      });
      // Type assertion needed due to version mismatch between @openrouter/ai-sdk-provider and ai package
      return openrouter(modelId) as unknown as LanguageModel;
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export function createAIClient(config: AIClientConfig): Result<AIClient, AIError> {
  if (!config.apiKey) {
    return err(createError<AIErrorCode>("API_KEY_MISSING", `${config.provider} API key is required`));
  }

  if (!config.provider) {
    return err(createError<AIErrorCode>("UNSUPPORTED_PROVIDER", "AI provider is required"));
  }

  let languageModel: LanguageModel;
  try {
    languageModel = createLanguageModel(config);
  } catch (error) {
    return err(createError<AIErrorCode>("UNSUPPORTED_PROVIDER", `Failed to create ${config.provider} client`));
  }

  const aiClient: AIClient = {
    provider: config.provider,

    async generate<T extends z.ZodType>(prompt: string, schema: T): Promise<Result<z.infer<T>, AIError>> {
      try {
        const result = await generateObject({
          model: languageModel,
          prompt,
          schema,
          temperature: config.temperature ?? DEFAULT_TEMPERATURE,
          maxOutputTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
        });

        return ok(result.object);
      } catch (error) {
        return err(classifyApiError(error));
      }
    },

    async generateStream(prompt: string, callbacks: StreamCallbacks, _options?: GenerateStreamOptions): Promise<void> {
      try {
        const result = streamText({
          model: languageModel,
          prompt,
          temperature: config.temperature ?? DEFAULT_TEMPERATURE,
          maxOutputTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
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
