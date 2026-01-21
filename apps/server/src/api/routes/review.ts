import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { createAIClient } from "@repo/core/ai";
import { readConfig, saveReview } from "@repo/core/storage";
import { getApiKey } from "@repo/core/secrets";
import { reviewDiff } from "../../services/review.js";
import { createGitService } from "../../services/git.js";
import { ReviewResultSchema, type ReviewResult } from "@repo/schemas/review";
import { errorResponse } from "../../lib/response.js";

const review = new Hono();

review.get("/stream", async (c) => {
  const configResult = await readConfig();
  if (!configResult.ok) {
    return errorResponse(c, "AI provider not configured. Please configure in settings.", "API_KEY_MISSING", 500);
  }

  const config = configResult.value;
  const apiKeyResult = await getApiKey(config.provider);

  if (!apiKeyResult.ok || !apiKeyResult.value) {
    return errorResponse(c, `API key not found for provider '${config.provider}'. Please configure in settings.`, "API_KEY_MISSING", 500);
  }

  const clientResult = createAIClient(config.provider, {
    apiKey: apiKeyResult.value,
    model: config.model,
  });

  if (!clientResult.ok) {
    return errorResponse(c, clientResult.error.message, "AI_ERROR", 500);
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
        let result: ReviewResult = { summary: content, issues: [] };
        let parseWarning: string | undefined;
        try {
          const parsed = JSON.parse(content);
          const validated = ReviewResultSchema.safeParse(parsed);
          if (validated.success) {
            result = validated.data;
          } else {
            parseWarning = "AI response failed schema validation, using raw content";
          }
        } catch {
          parseWarning = "AI response was not valid JSON, using raw content";
        }

        // Auto-save review (fire-and-forget - errors are silently ignored)
        const gitService = createGitService();
        gitService.getStatus().then((status) => {
          const fileCount = staged
            ? status.files.staged.length
            : status.files.unstaged.length;

          saveReview(process.cwd(), staged, result, {
            branch: status.branch,
            fileCount,
          });
        }).catch(() => {
          // Silently ignore - auto-save is best-effort
        });

        await stream.writeSSE({
          event: "complete",
          data: JSON.stringify({ type: "complete", result, parseWarning }),
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
