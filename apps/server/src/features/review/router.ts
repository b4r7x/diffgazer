import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { ErrorCode } from "@repo/schemas/errors";
import { errorResponse } from "../../shared/lib/response.js";
import { writeSSEError } from "../../shared/lib/sse-helpers.js";
import { getErrorMessage } from "../../shared/lib/errors.js";
import { getProjectRoot } from "../../shared/lib/request.js";
import { initializeAIClient } from "../../shared/lib/ai-client.js";
import { streamReviewToSSE } from "./service.js";
import { requireRepoAccess } from "../../shared/lib/trust-guard.js";

const reviewRouter = new Hono();

reviewRouter.get("/stream", requireRepoAccess, async (c): Promise<Response> => {
  const clientResult = initializeAIClient();
  if (!clientResult.ok) {
    return errorResponse(c, clientResult.error.message, clientResult.error.code, 500);
  }

  const staged = c.req.query("staged") !== "false";
  const projectPath = getProjectRoot(c);

  return streamSSE(c, async (stream) => {
    try {
      await streamReviewToSSE(clientResult.value, staged, stream, projectPath);
    } catch (error) {
      try {
        await writeSSEError(stream, getErrorMessage(error), ErrorCode.INTERNAL_ERROR);
      } catch {
        // Stream already closed
      }
    }
  });
});

export { reviewRouter };
