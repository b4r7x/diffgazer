import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { TrustConfigSchema } from "@stargazer/schemas/settings";
import { ErrorCode } from "@stargazer/schemas/errors";
import {
  getSettings,
  getTrust,
  listTrustedProjects,
  removeTrust,
  saveTrust,
  updateSettings,
} from "../../shared/lib/config-store/store.js";
import { SecretsStorageError } from "../../shared/lib/config-store/errors.js";
import { errorResponse } from "../../shared/lib/error-response.js";

const settingsRouter = new Hono();

const settingsSchema = z.object({
  theme: z.enum(["auto", "dark", "light", "terminal"]).optional(),
  defaultLenses: z.array(z.string()).optional(),
  defaultProfile: z.string().nullable().optional(),
  severityThreshold: z.string().optional(),
  secretsStorage: z.enum(["file", "keyring"]).nullable().optional(),
});

const invalidBodyResponse = (c: Context): Response =>
  errorResponse(c, "Invalid request body", "INVALID_BODY", 400);

const bodyLimitMiddleware = bodyLimit({
  maxSize: 10 * 1024,
  onError: (c) =>
    errorResponse(c, "Request body too large", "PAYLOAD_TOO_LARGE", 413),
});

const parseProjectId = (
  c: Context
): { ok: true; value: string } | { ok: false; response: Response } => {
  const projectId = c.req.query("projectId");
  if (!projectId) {
    return {
      ok: false,
      response: errorResponse(
        c,
        "projectId query parameter required",
        ErrorCode.VALIDATION_ERROR,
        400
      ),
    };
  }
  return { ok: true, value: projectId };
};

settingsRouter.get("/", (c): Response => {
  const settings = getSettings();
  return c.json(settings);
});

settingsRouter.post(
  "/",
  bodyLimitMiddleware,
  zValidator("json", settingsSchema, (result, c) => {
    if (!result.success) return invalidBodyResponse(c);
    return;
  }),
  (c): Response => {
    const patch = c.req.valid("json");
    try {
      const settings = updateSettings(patch);
      return c.json(settings);
    } catch (error) {
      if (error instanceof SecretsStorageError) {
        return errorResponse(c, error.message, error.code, 400);
      }
      throw error;
    }
  }
);

settingsRouter.get("/trust", (c): Response => {
  const projectIdResult = parseProjectId(c);
  if (!projectIdResult.ok) return projectIdResult.response;

  const trust = getTrust(projectIdResult.value);
  if (!trust) {
    return errorResponse(c, "Trust not found for project", ErrorCode.NOT_FOUND, 404);
  }

  return c.json({ trust });
});

settingsRouter.get("/trust/list", (c): Response => {
  return c.json({ projects: listTrustedProjects() });
});

settingsRouter.post(
  "/trust",
  bodyLimitMiddleware,
  zValidator("json", TrustConfigSchema, (result, c) => {
    if (!result.success) return invalidBodyResponse(c);
    return;
  }),
  (c): Response => {
    const body = c.req.valid("json");
    const trust = saveTrust(body);
    return c.json({ trust });
  }
);

settingsRouter.delete("/trust", (c): Response => {
  const projectIdResult = parseProjectId(c);
  if (!projectIdResult.ok) return projectIdResult.response;

  const removed = removeTrust(projectIdResult.value);
  return c.json({ removed });
});

export { settingsRouter };
