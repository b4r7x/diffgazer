import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  sessionStore,
  createSession,
  listSessions,
  addMessage,
  getLastSession,
} from "../../storage/index.js";
import { getErrorMessage } from "@repo/core";
import {
  CreateSessionRequestSchema,
  AddMessageRequestSchema,
} from "@repo/schemas/session";
import { ErrorCode } from "@repo/schemas/errors";
import {
  errorResponse,
  handleStoreError,
  zodErrorHandler,
} from "../../lib/response.js";
import { requireUuidParam, validateProjectPath } from "../../lib/validation.js";
import { writeSSEError } from "../../lib/sse-helpers.js";
import { prepareChatContext, saveUserMessage, streamChatToSSE } from "../../services/chat.js";

const ChatRequestSchema = z.object({
  message: z.string().min(1),
});

export const sessions = new Hono();

sessions.get("/", async (c) => {
  const projectPath = validateProjectPath(c.req.query("projectPath"));
  const result = await listSessions(projectPath);
  if (!result.ok) return handleStoreError(c, result.error);

  return c.json({
    sessions: result.value.items,
    warnings: result.value.warnings.length > 0 ? result.value.warnings : undefined,
  });
});

sessions.get("/last", async (c) => {
  const projectPath = validateProjectPath(c.req.query("projectPath"));
  if (!projectPath) return errorResponse(c, "projectPath required", ErrorCode.VALIDATION_ERROR, 400);

  const result = await getLastSession(projectPath);
  if (!result.ok) return handleStoreError(c, result.error);
  if (!result.value) return errorResponse(c, "No sessions found", ErrorCode.NOT_FOUND, 404);

  return c.json({ session: result.value });
});

sessions.get("/:id", async (c) => {
  const sessionId = requireUuidParam(c, "id");
  const result = await sessionStore.read(sessionId);
  if (!result.ok) return handleStoreError(c, result.error);

  return c.json({ session: result.value });
});

sessions.post(
  "/",
  zValidator("json", CreateSessionRequestSchema, zodErrorHandler),
  async (c) => {
    const body = c.req.valid("json");
    const result = await createSession(body.projectPath, body.title);
    if (!result.ok) return handleStoreError(c, result.error);

    return c.json({ session: result.value });
  }
);

sessions.post(
  "/:id/messages",
  zValidator("json", AddMessageRequestSchema, zodErrorHandler),
  async (c) => {
    const sessionId = requireUuidParam(c, "id");
    const body = c.req.valid("json");
    const result = await addMessage(sessionId, body.role, body.content);
    if (!result.ok) return handleStoreError(c, result.error);

    return c.json({ message: result.value });
  }
);

sessions.delete("/:id", async (c) => {
  const sessionId = requireUuidParam(c, "id");
  const result = await sessionStore.remove(sessionId);
  if (!result.ok) return handleStoreError(c, result.error);

  return c.json({ existed: result.value.existed });
});

sessions.post(
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

    return streamSSE(c, async (stream) => {
      try {
        await streamChatToSSE(sessionId, message, contextResult.value, stream);
      } catch (error) {
        try {
          await writeSSEError(stream, getErrorMessage(error), ErrorCode.INTERNAL_ERROR);
        } catch {
          // Stream already closed
        }
      }
    });
  }
);
