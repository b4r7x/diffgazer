import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { createAIClient } from "@repo/core/ai";
import { configStore, saveReview } from "@repo/core/storage";
import { getApiKey } from "@repo/core/secrets";
import { reviewDiff } from "../../services/review.js";
import { createGitService } from "../../services/git.js";
import { ReviewResultSchema, type ReviewResult } from "@repo/schemas/review";
import { ErrorCode } from "@repo/schemas/errors";
import { errorResponse } from "../../lib/response.js";

const review = new Hono();

/**
 * Parse raw AI content into a validated ReviewResult.
 * Falls back to using raw content as summary if parsing fails.
 */
function parseReviewContent(content: string): ReviewResult {
  try {
    const parsed = JSON.parse(content);
    const validated = ReviewResultSchema.safeParse(parsed);
    if (validated.success) {
      return validated.data;
    }
    console.warn("AI response failed schema validation, using raw content as summary");
  } catch {
    console.warn("AI response was not valid JSON, using raw content as summary");
  }
  return { summary: content, issues: [], overallScore: null };
}

review.get("/stream", async (c) => {
  const configResult = await configStore.read();
  if (!configResult.ok) {
    return errorResponse(c, "AI provider not configured. Please configure in settings.", ErrorCode.API_KEY_MISSING, 500);
  }

  const config = configResult.value;
  const apiKeyResult = await getApiKey(config.provider);

  if (!apiKeyResult.ok || !apiKeyResult.value) {
    return errorResponse(c, `API key not found for provider '${config.provider}'. Please configure in settings.`, ErrorCode.API_KEY_MISSING, 500);
  }

  const clientResult = createAIClient({
    apiKey: apiKeyResult.value,
    model: config.model,
  });

  if (!clientResult.ok) {
    return errorResponse(c, clientResult.error.message, ErrorCode.AI_ERROR, 500);
  }

  const staged = c.req.query("staged") !== "false";

  return streamSSE(c, async (stream) => {
    try {
      await reviewDiff(clientResult.value, staged, {
        onChunk: async (chunk) => {
          await stream.writeSSE({
            event: "chunk",
            data: JSON.stringify({ type: "chunk", content: chunk }),
          });
        },
        onComplete: async (content) => {
          const result = parseReviewContent(content);
          const gitService = createGitService();
          gitService.getStatus().then((status) => {
            const fileCount = staged
              ? status.files.staged.length
              : status.files.unstaged.length;

            saveReview(process.cwd(), staged, result, {
              branch: status.branch,
              fileCount,
            });
          }).catch(() => {});

          await stream.writeSSE({
            event: "complete",
            data: JSON.stringify({ type: "complete", result }),
          });
        },
        onError: async (error) => {
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({
              type: "error",
              error: { message: error.message, code: ErrorCode.AI_ERROR },
            }),
          });
        },
      });
    } catch (error) {
      // Catch any errors from the review process that weren't handled by onError
      // This ensures a terminal event is always sent
      console.error("[Review] Unexpected error during review:", error);
      try {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            type: "error",
            error: {
              message: error instanceof Error ? error.message : "An unexpected error occurred",
              code: ErrorCode.INTERNAL_ERROR
            },
          }),
        });
      } catch (writeError) {
        // Stream might already be closed, log and continue
        console.error("[Review] Failed to write error event:", writeError);
      }
    }
  });
});

export { review };
