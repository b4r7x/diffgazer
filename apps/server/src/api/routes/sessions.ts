import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createSession,
  readSession,
  listSessions,
  addMessage,
  deleteSession,
  getLastSession,
} from "@repo/core/storage";
import {
  CreateSessionRequestSchema,
  AddMessageRequestSchema,
} from "@repo/schemas/session";
import {
  errorResponse,
  successResponse,
  handleStoreError,
  zodErrorHandler,
} from "../../lib/response.js";
import { requireUuidParam, validateProjectPath } from "../../lib/validation.js";

export const sessions = new Hono();

sessions.get("/", async (c) => {
  const projectPath = validateProjectPath(c.req.query("projectPath"));
  const result = await listSessions(projectPath);
  if (!result.ok) return handleStoreError(c, result.error);

  return successResponse(c, {
    sessions: result.value.items,
    warnings: result.value.warnings.length > 0 ? result.value.warnings : undefined,
  });
});

sessions.get("/last", async (c) => {
  const projectPath = validateProjectPath(c.req.query("projectPath"));
  if (!projectPath) return errorResponse(c, "projectPath required", "VALIDATION_ERROR", 400);

  const result = await getLastSession(projectPath);
  if (!result.ok) return handleStoreError(c, result.error);
  if (!result.value) return errorResponse(c, "No sessions found", "NOT_FOUND", 404);

  return successResponse(c, { session: result.value });
});

sessions.get("/:id", async (c) => {
  const sessionId = requireUuidParam(c, "id");
  const result = await readSession(sessionId);
  if (!result.ok) return handleStoreError(c, result.error);

  return successResponse(c, { session: result.value });
});

sessions.post(
  "/",
  zValidator("json", CreateSessionRequestSchema, zodErrorHandler),
  async (c) => {
    const body = c.req.valid("json");
    const result = await createSession(body.projectPath, body.title);
    if (!result.ok) return handleStoreError(c, result.error);

    return successResponse(c, { session: result.value });
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

    return successResponse(c, { message: result.value });
  }
);

sessions.delete("/:id", async (c) => {
  const sessionId = requireUuidParam(c, "id");
  const result = await deleteSession(sessionId);
  if (!result.ok) return handleStoreError(c, result.error);

  return successResponse(c, { deleted: true });
});
