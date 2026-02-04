import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { activateProvider, deleteProvider, getInitState, getProvidersStatus, saveConfig } from "./service.js";
import { getProjectRoot } from "../../shared/lib/request.js";

const configRouter = new Hono();

const saveConfigSchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().min(1),
  model: z.string().min(1).optional(),
});

const providerParamSchema = z.object({
  providerId: z.string().min(1),
});

const activateProviderBodySchema = z.object({
  model: z.string().min(1).optional(),
});

const invalidBodyResponse = (c: Context): Response =>
  c.json({ error: { message: "Invalid request body", code: "INVALID_BODY" } }, 400);

const bodyLimitMiddleware = bodyLimit({
  maxSize: 50 * 1024,
  onError: (c) =>
    c.json({ error: { message: "Request body too large", code: "PAYLOAD_TOO_LARGE" } }, 413),
});

configRouter.get("/init", (c): Response => {
  const projectRoot = getProjectRoot(c);
  const data = getInitState(projectRoot);
  return c.json(data);
});

configRouter.get("/providers", (c): Response => {
  const data = getProvidersStatus();
  return c.json(data);
});

configRouter.post(
  "/",
  bodyLimitMiddleware,
  zValidator("json", saveConfigSchema, (result, c) => {
    if (!result.success) return invalidBodyResponse(c);
  }),
  (c): Response => {
  const body = c.req.valid("json");
  saveConfig(body);
  return c.json({ saved: true });
  }
);

configRouter.post(
  "/provider/:providerId/activate",
  bodyLimitMiddleware,
  zValidator("param", providerParamSchema),
  zValidator("json", activateProviderBodySchema, (result, c) => {
    if (!result.success) return invalidBodyResponse(c);
  }),
  (c): Response => {
    const { providerId } = c.req.valid("param");
    const { model } = c.req.valid("json");
    const activated = activateProvider({ provider: providerId, model });
    if (!activated) {
      return c.json({ error: { message: "Provider not found", code: "PROVIDER_NOT_FOUND" } }, 404);
    }

    return c.json(activated);
  }
);

configRouter.delete("/provider/:providerId", zValidator("param", providerParamSchema), (c): Response => {
  const { providerId } = c.req.valid("param");
  const result = deleteProvider(providerId);
  return c.json(result);
});

export { configRouter };
