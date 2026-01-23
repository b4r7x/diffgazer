import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import type { AIClient, AIClientConfig, StreamCallbacks, GenerateStreamOptions } from "../types.js";
import type { Result } from "../../result.js";
import type { AIError, AIErrorCode } from "../errors.js";
import { ok, err } from "../../result.js";
import { createError, toError } from "../../errors.js";
import { safeParseJson } from "../../json.js";
import { createErrorClassifier } from "../../utils/error-classifier.js";
import { validateSchema } from "../../utils/validation.js";

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;

interface GenerationConfigOptions {
  json?: boolean;
  responseSchema?: Record<string, unknown>;
}

function getGenerationConfig(config: AIClientConfig, options: GenerationConfigOptions = {}) {
  return {
    temperature: config.temperature ?? DEFAULT_TEMPERATURE,
    maxOutputTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(options.json && { responseMimeType: "application/json" as const }),
    ...(options.responseSchema && {
      responseMimeType: "application/json" as const,
      responseSchema: options.responseSchema,
    }),
  };
}

const BLOCKED_FINISH_REASONS = new Set([
  "SAFETY",
  "RECITATION",
  "PROHIBITED_CONTENT",
  "SPII",
  "BLOCKLIST",
  "OTHER",
]);

function parseJsonSafe(text: string): Result<unknown, AIError> {
  return safeParseJson(text, (message) =>
    createError<AIErrorCode>("PARSE_ERROR", `Failed to parse JSON response: ${message}`, text.slice(0, 200))
  );
}

const classifyError = createErrorClassifier<AIErrorCode>(
  [
    { patterns: ["401", "api key"], code: "API_KEY_INVALID", message: "Invalid API key" },
    { patterns: ["429", "rate limit"], code: "RATE_LIMITED", message: "Rate limited" },
  ],
  "MODEL_ERROR",
  (msg) => msg
);

function classifyApiError(error: unknown): AIError {
  const { code, message } = classifyError(error);
  return createError<AIErrorCode>(code, message);
}

export function createGeminiClient(config: AIClientConfig): Result<AIClient, AIError> {
  if (!config.apiKey) {
    return err(createError<AIErrorCode>("API_KEY_MISSING", "Gemini API key is required"));
  }

  const client = new GoogleGenAI({ apiKey: config.apiKey });
  const model = config.model ?? DEFAULT_MODEL;

  const aiClient: AIClient = {
    provider: "gemini",

    async generate<T extends z.ZodType>(prompt: string, schema: T): Promise<Result<z.infer<T>, AIError>> {
      try {
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: getGenerationConfig(config, { json: true }),
        });

        const parseResult = parseJsonSafe(response.text ?? "");
        if (!parseResult.ok) return parseResult;

        return validateSchema(parseResult.value, schema, (message) =>
          createError<AIErrorCode>("PARSE_ERROR", "Invalid response structure", message)
        );
      } catch (error) {
        return err(classifyApiError(error));
      }
    },

    async generateStream(prompt: string, callbacks: StreamCallbacks, options?: GenerateStreamOptions): Promise<void> {
      try {
        const stream = await client.models.generateContentStream({
          model,
          contents: prompt,
          config: getGenerationConfig(config, { responseSchema: options?.responseSchema }),
        });

        const chunks: string[] = [];
        let finishReason: string | undefined;

        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            chunks.push(text);
            await callbacks.onChunk(text);
          }

          const candidate = chunk.candidates?.[0];
          if (candidate?.finishReason) {
            finishReason = candidate.finishReason;
            if (BLOCKED_FINISH_REASONS.has(finishReason)) {
              console.warn(`[Gemini] Response blocked with reason: ${finishReason}`);
            }
          }
        }

        const truncated = finishReason === "MAX_TOKENS";
        await callbacks.onComplete(chunks.join(""), { truncated, finishReason });
      } catch (error) {
        await callbacks.onError(toError(error));
      }
    },
  };

  return ok(aiClient);
}
