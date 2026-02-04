import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { AddMessageRequestSchema, CreateSessionRequestSchema } from "@stargazer/schemas/session";
import { ErrorCode } from "@stargazer/schemas/errors";
import { errorResponse, handleStoreError, zodErrorHandler } from "../../shared/lib/response.js";
import { getErrorMessage } from "../../shared/lib/errors.js";
import { writeSSEError } from "../../shared/lib/sse-helpers.js";
import { isValidProjectPath } from "../../shared/lib/validation.js";
import {
  addMessage,
  createSession,
  getLastSession,
  listSessions,
  sessionStore,
} from "./store.js";
import { ChatRequestSchema } from "./schemas.js";
import { prepareChatContext, saveUserMessage, streamChatToSSE } from "./service.js";

const sessionsRouter = new Hono();

const sessionIdParamSchema = z.object({
  id: z.string().uuid(),
});

const invalidProjectPathResponse = (c: Context): Response =>
  errorResponse(
    c,
    "Invalid projectPath: contains path traversal or null bytes",
    ErrorCode.VALIDATION_ERROR,
    400
  );

const parseProjectPath = (
  c: Context,
  options: { required?: boolean } = {}
): { ok: true; value?: string } | { ok: false; response: Response } => {
  const projectPath = c.req.query("projectPath");
  if (!projectPath) {
    if (options.required) {
      return {
        ok: false,
        response: errorResponse(
          c,
          "projectPath required",
          ErrorCode.VALIDATION_ERROR,
          400
        ),
      };
    }
    return { ok: true, value: undefined };
  }

  if (!isValidProjectPath(projectPath)) {
    return { ok: false, response: invalidProjectPathResponse(c) };
  }

  return { ok: true, value: projectPath };
};

sessionsRouter.get("/", async (c): Promise<Response> => {
  const projectPathResult = parseProjectPath(c);
  if (!projectPathResult.ok) return projectPathResult.response;

  const result = await listSessions(projectPathResult.value);
  if (!result.ok) return handleStoreError(c, result.error);

  return c.json({
    sessions: result.value.items,
    ...(result.value.warnings.length > 0 ? { warnings: result.value.warnings } : {}),
  });
});

sessionsRouter.get("/last", async (c): Promise<Response> => {
  const projectPathResult = parseProjectPath(c, { required: true });
  if (!projectPathResult.ok) return projectPathResult.response;

  const projectPath = projectPathResult.value;
  if (!projectPath) {
    return errorResponse(c, "projectPath required", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await getLastSession(projectPath);
  if (!result.ok) return handleStoreError(c, result.error);
  if (!result.value) {
    return errorResponse(c, "No sessions found", ErrorCode.NOT_FOUND, 404);
  }

  return c.json({ session: result.value });
});

sessionsRouter.get(
  "/:id",
  zValidator("param", sessionIdParamSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const result = await sessionStore.read(id);
    if (!result.ok) return handleStoreError(c, result.error);

    return c.json({ session: result.value });
  }
);

sessionsRouter.post(
  "/",
  zValidator("json", CreateSessionRequestSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const body = c.req.valid("json");
    if (!isValidProjectPath(body.projectPath)) {
      return invalidProjectPathResponse(c);
    }

    const result = await createSession(body.projectPath, body.title);
    if (!result.ok) return handleStoreError(c, result.error);

    return c.json({ session: result.value });
  }
);

sessionsRouter.post(
  "/:id/messages",
  zValidator("param", sessionIdParamSchema, zodErrorHandler),
  zValidator("json", AddMessageRequestSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const result = await addMessage(id, body.role, body.content);
    if (!result.ok) return handleStoreError(c, result.error);

    return c.json({ message: result.value });
  }
);

sessionsRouter.delete(
  "/:id",
  zValidator("param", sessionIdParamSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const result = await sessionStore.remove(id);
    if (!result.ok) return handleStoreError(c, result.error);

    return c.json({ existed: result.value.existed });
  }
);

sessionsRouter.post(
  "/:id/chat",
  zValidator("param", sessionIdParamSchema, zodErrorHandler),
  zValidator("json", ChatRequestSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const { message } = c.req.valid("json");

    const contextResult = await prepareChatContext(id);
    if (!contextResult.ok) {
      const status = contextResult.error.code === ErrorCode.SESSION_NOT_FOUND ? 404 : 400;
      return errorResponse(c, contextResult.error.message, contextResult.error.code, status);
    }

    const saveResult = await saveUserMessage(id, message);
    if (!saveResult.ok) {
      return errorResponse(c, saveResult.error.message, saveResult.error.code, 500);
    }

    return streamSSE(c, async (stream) => {
      try {
        await streamChatToSSE(id, message, contextResult.value, stream);
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

export { sessionsRouter };
