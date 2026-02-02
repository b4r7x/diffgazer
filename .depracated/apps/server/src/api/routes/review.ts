import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { streamReviewToSSE } from "../../services/review.js";
import { initializeAIClient } from "../../lib/ai-client.js";
import { errorResponse } from "../../lib/response.js";
import { writeSSEError } from "../../lib/sse-helpers.js";
import { getErrorMessage } from "@repo/core";
import { ErrorCode } from "@repo/schemas/errors";
import { type ProjectEnv, getProjectPath } from "../../context/project.js";

const review = new Hono<ProjectEnv>();

review.get("/stream", async (c) => {
  const clientResult = await initializeAIClient();
  if (!clientResult.ok) {
    return errorResponse(c, clientResult.error.message, clientResult.error.code, 500);
  }

  const staged = c.req.query("staged") !== "false";
  const projectPath = getProjectPath(c);

  return streamSSE(c, async (stream) => {
    try {
      await streamReviewToSSE(clientResult.value, staged, stream, projectPath);
    } catch (error) {
      try {
        await writeSSEError(stream, getErrorMessage(error), ErrorCode.INTERNAL_ERROR);
      } catch {
        // Stream already closed, cannot send error
      }
    }
  });
});

export { review };
