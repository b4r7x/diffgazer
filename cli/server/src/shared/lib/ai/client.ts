import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { CATALOG_SNAPSHOT, findModelLimit, PROVIDER_OVERLAY } from "@diffgazer/core/catalog";
import { createError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, type LanguageModel, NoObjectGeneratedError, Output } from "ai";
import { createZhipu } from "zhipu-ai-provider";
import type { z } from "zod";
import { getStore } from "../config/store.js";
import { classifyError, type ErrorRule } from "../errors.js";
import { log } from "../log.js";
import type { AIClient, AIClientConfig, AIError, AIErrorCode } from "./types.js";

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

/** Rough token estimate (≈4 chars/token), matching the review pipeline's heuristic. */
function estimatePromptTokens(prompt: string): number {
  return Math.ceil(prompt.length / 4);
}

/** Resolve the output budget for a request, clamped to the model's documented limit when known. */
function resolveMaxOutputTokens(config: AIClientConfig): number {
  const requested = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  return config.outputLimit !== undefined ? Math.min(requested, config.outputLimit) : requested;
}

/** Parse the first JSON object out of raw model text (tolerating surrounding prose / code fences). */
function extractJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return undefined;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

/**
 * Recover a usable object from raw model text after strict validation rejected it.
 * Validates the envelope, then — for review-shaped objects carrying an `issues`
 * array — keeps only the issues that pass the schema, dropping the rest. Mirrors
 * the pipeline's per-issue salvage so one bad issue can't void a whole paid review.
 */
function recoverObject<T extends z.ZodType>(
  schema: T,
  rawText: string | undefined,
): { value: z.infer<T>; dropped: number } | null {
  if (!rawText) return null;
  const parsed = extractJsonObject(rawText);
  if (parsed === undefined) return null;

  const full = schema.safeParse(parsed);
  if (full.success) return { value: full.data, dropped: 0 };

  if (!parsed || typeof parsed !== "object") return null;
  const envelope = parsed as Record<string, unknown>;
  if (!Array.isArray(envelope.issues)) return null;

  const allIssues = envelope.issues;
  const keptIssues = allIssues.filter(
    (issue) => schema.safeParse({ ...envelope, issues: [issue] }).success,
  );
  if (keptIssues.length === 0) return null;

  const salvaged = schema.safeParse({ ...envelope, issues: keptIssues });
  if (!salvaged.success) return null;

  return { value: salvaged.data, dropped: allIssues.length - keptIssues.length };
}

function salvageTruncatedOutput<T extends z.ZodType>(
  schema: T,
  rawText: string | undefined,
  config: AIClientConfig,
): Result<z.infer<T>, AIError> | null {
  const recovered = recoverObject(schema, rawText);
  if (!recovered) return null;
  if (recovered.dropped > 0) {
    log("warn", "ai-client.recovered-issues", {
      provider: config.provider,
      model: config.model,
      droppedIssues: recovered.dropped,
    });
  }
  return ok(recovered.value);
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
      const maxOutputTokens = resolveMaxOutputTokens(config);

      // A request whose prompt plus output budget exceeds the model's context
      // window deterministically 400s with opaque provider text; refuse it up
      // front with a message naming the model and its limit.
      if (config.contextLimit !== undefined) {
        const projectedTokens = estimatePromptTokens(prompt) + maxOutputTokens;
        if (projectedTokens > config.contextLimit) {
          return err(
            createError<AIErrorCode>(
              "MODEL_ERROR",
              `The prompt is too large for ${config.model ?? config.provider} (needs ~${projectedTokens} tokens, model context limit is ${config.contextLimit}). Choose a model with a larger context window or review a smaller diff.`,
            ),
          );
        }
      }

      try {
        const abortSignal = resolveAbortSignal(config, options?.signal);
        const result = await generateText({
          model: languageModel,
          prompt,
          output: Output.object<z.infer<T>>({ schema }),
          temperature: config.temperature ?? DEFAULT_TEMPERATURE,
          maxOutputTokens,
          maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
          abortSignal,
        });

        // `.output` only resolves when finishReason is "stop"; any other finish
        // reason (e.g. a truncated response) throws a bare NoOutputGeneratedError
        // with no salvageable text attached. Check finishReason directly so a
        // truncated response can still be salvaged from the raw text.
        if (result.finishReason === "length") {
          const salvaged = salvageTruncatedOutput(schema, result.text, config);
          if (salvaged) return salvaged;
          return err(
            createError<AIErrorCode>(
              "MODEL_ERROR",
              `The model response was cut off at its output limit (${maxOutputTokens} tokens) before producing valid results. Try a model with a larger output limit or review a smaller diff.`,
            ),
          );
        }

        return ok(result.output);
      } catch (error) {
        if (NoObjectGeneratedError.isInstance(error)) {
          const salvaged = salvageTruncatedOutput(schema, error.text, config);
          if (salvaged) return salvaged;
        }
        return err(classifyApiError(error));
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

  const limit = findModelLimit(CATALOG_SNAPSHOT, activeProvider.provider, activeProvider.model);
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

  return ok(clientResult.value);
}
