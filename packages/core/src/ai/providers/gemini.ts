import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import type { AIClient, AIClientConfig, StreamCallbacks, GenerateStreamOptions } from "../types.js";
import type { Result } from "../../result.js";
import type { AIError, AIErrorCode } from "../errors.js";
import { ok, err } from "../../result.js";
import { createError, getErrorMessage, toError } from "../../errors.js";

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
  try {
    return ok(JSON.parse(text));
  } catch {
    return err(createError<AIErrorCode>("PARSE_ERROR", "Failed to parse JSON response", text.slice(0, 200)));
  }
}

function classifyApiError(error: unknown): AIError {
  const message = getErrorMessage(error);
  if (message.includes("401") || message.includes("API key")) {
    return createError<AIErrorCode>("API_KEY_INVALID", "Invalid API key");
  }
  if (message.includes("429") || message.includes("rate limit")) {
    return createError<AIErrorCode>("RATE_LIMITED", "Rate limited");
  }
  return createError<AIErrorCode>("MODEL_ERROR", message);
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

        const validated = schema.safeParse(parseResult.value);
        if (!validated.success) {
          return err(createError<AIErrorCode>("PARSE_ERROR", "Invalid response structure", validated.error.message));
        }
        return ok(validated.data);
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
