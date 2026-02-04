import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { getSettings, SecretsStorageError, updateSettings } from "../../shared/lib/config-store/index.js";
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

export { settingsRouter };
