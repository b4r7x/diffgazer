import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context } from "hono";
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

const parseJsonOrEmptyBody = async (c: Context): Promise<unknown | null> => {
  const rawBody = await c.req.text();
  if (!rawBody.trim()) return {};

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
};

configRouter.get("/init", (c): Response => {
  const projectRoot = getProjectRoot(c);
  const data = getInitState(projectRoot);
  return c.json(data);
});

configRouter.get("/providers", (c): Response => {
  const data = getProvidersStatus();
  return c.json(data);
});

configRouter.post("/", zValidator("json", saveConfigSchema), (c): Response => {
  const body = c.req.valid("json");
  saveConfig(body);
  return c.json({ saved: true });
});

configRouter.post(
  "/provider/:providerId/activate",
  zValidator("param", providerParamSchema),
  async (c): Promise<Response> => {
    const { providerId } = c.req.valid("param");
    const payload = await parseJsonOrEmptyBody(c);
    if (payload === null) {
      return c.json({ error: { message: "Invalid JSON body", code: "INVALID_BODY" } }, 400);
    }

    const parsedBody = activateProviderBodySchema.safeParse(payload);
    if (!parsedBody.success) {
      return c.json({ error: { message: "Invalid request body", code: "INVALID_BODY" } }, 400);
    }

    const activated = activateProvider({ provider: providerId, model: parsedBody.data.model });
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
