import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { streamReviewToSSE } from "../../services/review.js";
import { initializeAIClient } from "../../lib/ai-client.js";
import { errorResponse } from "../../lib/response.js";

const review = new Hono();

review.get("/stream", async (c) => {
  const clientResult = await initializeAIClient();
  if (!clientResult.ok) {
    return errorResponse(c, clientResult.error.message, clientResult.error.code, 500);
  }

  const staged = c.req.query("staged") !== "false";

  return streamSSE(c, (stream) => streamReviewToSSE(clientResult.value, staged, stream));
});

export { review };
