import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { ErrorCode } from "@stargazer/schemas/errors";
import { errorResponse } from "../../shared/lib/http/response.js";
import { writeSSEError } from "../../shared/lib/http/sse.js";
import { getErrorMessage } from "@stargazer/core";
import { getProjectRoot } from "../../shared/lib/http/request.js";
import { initializeAIClient } from "../../shared/lib/ai/client.js";
import { streamReviewToSSE } from "./service.js";
import { requireRepoAccess } from "../../shared/middlewares/trust-guard.js";

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
