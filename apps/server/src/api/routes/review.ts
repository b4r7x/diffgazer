import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { createAIClient } from "@repo/core/ai";
import { readConfig } from "@repo/core/storage";
import { getApiKey } from "@repo/core/secrets";
import { reviewDiff } from "../../services/review.js";
import { ReviewResultSchema } from "@repo/schemas/review";

const review = new Hono();

review.get("/stream", async (c) => {
  const configResult = await readConfig();
  if (!configResult.ok) {
    return c.json(
      {
        success: false,
        error: {
          message: "AI provider not configured. Please configure in settings.",
          code: "API_KEY_MISSING",
        },
      },
      500
    );
  }

  const config = configResult.value;
  const apiKeyResult = await getApiKey(config.provider);

  if (!apiKeyResult.ok || !apiKeyResult.value) {
    return c.json(
      {
        success: false,
        error: {
          message: `API key not found for provider '${config.provider}'. Please configure in settings.`,
          code: "API_KEY_MISSING",
        },
      },
      500
    );
  }

  const clientResult = createAIClient(config.provider, {
    apiKey: apiKeyResult.value,
    model: config.model,
  });

  if (!clientResult.ok) {
    return c.json(
      {
        success: false,
        error: { message: clientResult.error.message, code: "AI_ERROR" },
      },
      500
    );
  }

  const staged = c.req.query("staged") !== "false";

  return streamSSE(c, async (stream) => {
    await reviewDiff(clientResult.value, staged, {
      onChunk: async (chunk) => {
        await stream.writeSSE({
          event: "chunk",
          data: JSON.stringify({ type: "chunk", content: chunk }),
        });
      },
      onComplete: async (content) => {
        let result: { summary: string; issues: unknown[] } = { summary: content, issues: [] };
        try {
          const parsed = JSON.parse(content);
          const validated = ReviewResultSchema.safeParse(parsed);
          if (validated.success) {
            result = validated.data;
          }
        } catch {}
        await stream.writeSSE({
          event: "complete",
          data: JSON.stringify({ type: "complete", result }),
        });
        stream.close();
      },
      onError: async (error) => {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            type: "error",
            error: { message: error.message, code: "AI_ERROR" },
          }),
        });
        stream.close();
      },
    });
  });
});

export { review };
