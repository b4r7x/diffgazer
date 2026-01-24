import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  sessionStore,
  createSession,
  listSessions,
  addMessage,
  getLastSession,
} from "@repo/core/storage";
import {
  CreateSessionRequestSchema,
  AddMessageRequestSchema,
} from "@repo/schemas/session";
import { ErrorCode } from "@repo/schemas/errors";
import {
  errorResponse,
  jsonOk,
  handleStoreError,
  zodErrorHandler,
} from "../../lib/response.js";
import { requireUuidParam, validateProjectPath } from "../../lib/validation.js";

export const sessions = new Hono();

sessions.get("/", async (c) => {
  const projectPath = validateProjectPath(c.req.query("projectPath"));
  const result = await listSessions(projectPath);
  if (!result.ok) return handleStoreError(c, result.error);

  return jsonOk(c, {
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

  return jsonOk(c, { session: result.value });
});

sessions.get("/:id", async (c) => {
  const sessionId = requireUuidParam(c, "id");
  const result = await sessionStore.read(sessionId);
  if (!result.ok) return handleStoreError(c, result.error);

  return jsonOk(c, { session: result.value });
});

sessions.post(
  "/",
  zValidator("json", CreateSessionRequestSchema, zodErrorHandler),
  async (c) => {
    const body = c.req.valid("json");
    const result = await createSession(body.projectPath, body.title);
    if (!result.ok) return handleStoreError(c, result.error);

    return jsonOk(c, { session: result.value });
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

    return jsonOk(c, { message: result.value });
  }
);

sessions.delete("/:id", async (c) => {
  const sessionId = requireUuidParam(c, "id");
  const result = await sessionStore.remove(sessionId);
  if (!result.ok) return handleStoreError(c, result.error);

  return jsonOk(c, { existed: result.value.existed });
});
