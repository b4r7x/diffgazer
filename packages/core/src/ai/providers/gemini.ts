import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import type { AIClient, AIClientConfig, StreamCallbacks } from "../types.js";
import type { Result } from "../../result.js";
import type { AIError } from "../errors.js";
import { ok, err } from "../../result.js";
import { createAIError } from "../errors.js";

const DEFAULT_MODEL = "gemini-2.5-flash";

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
          config: { temperature: config.temperature ?? 0.7, maxOutputTokens: config.maxTokens ?? 4096, responseMimeType: "application/json" },
        });

        const text = response.text ?? "";
        try {
          const parsed = JSON.parse(text);
          const validated = schema.safeParse(parsed);
          if (!validated.success) {
            return err(createAIError("PARSE_ERROR", "Invalid response structure", validated.error.message));
          }
          return ok(validated.data);
        } catch {
          return err(createAIError("PARSE_ERROR", "Failed to parse JSON response", text.slice(0, 200)));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("401") || message.includes("API key")) {
          return err(createAIError("API_KEY_INVALID", "Invalid API key"));
        }
        if (message.includes("429") || message.includes("rate")) {
          return err(createAIError("RATE_LIMITED", "Rate limited"));
        }
        return err(createAIError("MODEL_ERROR", message));
      }
    },

    async generateStream(prompt: string, callbacks: StreamCallbacks): Promise<void> {
      try {
        const stream = await client.models.generateContentStream({
          model,
          contents: prompt,
          config: { temperature: config.temperature ?? 0.7, maxOutputTokens: config.maxTokens ?? 4096 },
        });

        let fullContent = "";
        for await (const chunk of stream) {
          const text = chunk.text ?? "";
          if (text) {
            fullContent += text;
            await callbacks.onChunk(text);
          }
        }
        await callbacks.onComplete(fullContent);
      } catch (error) {
        await callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      }
    },
  };

  return ok(aiClient);
}
