import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { ErrorCode } from "@repo/schemas/errors";
import { zodErrorHandler, errorResponse } from "../../lib/response.js";
import { requireUuidParam } from "../../lib/validation.js";
import { prepareChatContext, saveUserMessage, streamChatToSSE } from "../../services/chat.js";

const ChatRequestSchema = z.object({
  message: z.string().min(1),
});

export const chat = new Hono();

chat.post(
  "/:id/chat",
  zValidator("json", ChatRequestSchema, zodErrorHandler),
  async (c) => {
    const sessionId = requireUuidParam(c, "id");
    const { message } = c.req.valid("json");

    const contextResult = await prepareChatContext(sessionId);
    if (!contextResult.ok) {
      const status = contextResult.error.code === ErrorCode.SESSION_NOT_FOUND ? 404 : 400;
      return errorResponse(c, contextResult.error.message, contextResult.error.code, status);
    }

    const saveResult = await saveUserMessage(sessionId, message);
    if (!saveResult.ok) {
      return errorResponse(c, saveResult.error.message, saveResult.error.code, 500);
    }

    return streamSSE(c, (stream) => streamChatToSSE(sessionId, message, contextResult.value, stream));
  }
);
