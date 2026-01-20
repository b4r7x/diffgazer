import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import type { AIClient, AIClientConfig, StreamCallbacks } from "../types.js";
import type { Result } from "../../result.js";
import type { AIError } from "../errors.js";
import { ok, err } from "../../result.js";
import { createAIError } from "../errors.js";
import { getErrorMessage, toError } from "../../errors.js";

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;

function getGenerationConfig(config: AIClientConfig, json = false) {
  return {
    temperature: config.temperature ?? DEFAULT_TEMPERATURE,
    maxOutputTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(json && { responseMimeType: "application/json" as const }),
  };
}

function parseJsonSafe(text: string): Result<unknown, AIError> {
  try {
    return ok(JSON.parse(text));
  } catch {
    return err(createAIError("PARSE_ERROR", "Failed to parse JSON response", text.slice(0, 200)));
  }
}

function classifyApiError(error: unknown): AIError {
  const message = getErrorMessage(error);
  if (message.includes("401") || message.includes("API key")) {
    return createAIError("API_KEY_INVALID", "Invalid API key");
  }
  if (message.includes("429") || message.includes("rate limit")) {
    return createAIError("RATE_LIMITED", "Rate limited");
  }
  return createAIError("MODEL_ERROR", message);
}

export function createGeminiClient(config: AIClientConfig): Result<AIClient, AIError> {
  if (!config.apiKey) {
    return err(createAIError("API_KEY_MISSING", "Gemini API key is required"));
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
          config: getGenerationConfig(config, true),
        });

        const parseResult = parseJsonSafe(response.text ?? "");
        if (!parseResult.ok) return parseResult;

        const validated = schema.safeParse(parseResult.value);
        if (!validated.success) {
          return err(createAIError("PARSE_ERROR", "Invalid response structure", validated.error.message));
        }
        return ok(validated.data);
      } catch (error) {
        return err(classifyApiError(error));
      }
    },

    async generateStream(prompt: string, callbacks: StreamCallbacks): Promise<void> {
      try {
        const stream = await client.models.generateContentStream({
          model,
          contents: prompt,
          config: getGenerationConfig(config),
        });

        const chunks: string[] = [];
        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            chunks.push(text);
            await callbacks.onChunk(text);
          }
        }
        await callbacks.onComplete(chunks.join(""));
      } catch (error) {
        await callbacks.onError(toError(error));
      }
    },
  };

  return ok(aiClient);
}
