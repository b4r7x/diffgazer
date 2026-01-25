import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  loadSettings,
  saveSettings,
  loadTrust,
  listTrustedProjects,
  saveTrust,
  removeTrust,
} from "@repo/core/storage";
import { SettingsConfigSchema, TrustConfigSchema } from "@repo/schemas/settings";
import { ErrorCode } from "@repo/schemas/errors";
import {
  errorResponse,
  jsonOk,
  handleStoreError,
  zodErrorHandler,
} from "../../lib/response.js";

export const settings = new Hono();

settings.get("/", async (c) => {
  const result = await loadSettings();
  if (!result.ok) return handleStoreError(c, result.error);

  if (result.value === null) {
    return errorResponse(c, "Settings not configured", ErrorCode.NOT_FOUND, 404);
  }

  return jsonOk(c, { settings: result.value });
});

settings.post(
  "/",
  zValidator("json", SettingsConfigSchema, zodErrorHandler),
  async (c) => {
    const body = c.req.valid("json");
    const result = await saveSettings(body);
    if (!result.ok) return handleStoreError(c, result.error);

    return jsonOk(c, { settings: body });
  }
);

settings.get("/trust", async (c) => {
  const projectId = c.req.query("projectId");
  if (!projectId) {
    return errorResponse(c, "projectId query parameter required", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await loadTrust(projectId);
  if (!result.ok) return handleStoreError(c, result.error);

  if (result.value === null) {
    return errorResponse(c, "Trust not found for project", ErrorCode.NOT_FOUND, 404);
  }

  return jsonOk(c, { trust: result.value });
});

settings.get("/trust/list", async (c) => {
  const result = await listTrustedProjects();
  if (!result.ok) return handleStoreError(c, result.error);

  return jsonOk(c, { projects: result.value });
});

settings.post(
  "/trust",
  zValidator("json", TrustConfigSchema, zodErrorHandler),
  async (c) => {
    const body = c.req.valid("json");
    const result = await saveTrust(body);
    if (!result.ok) return handleStoreError(c, result.error);

    return jsonOk(c, { trust: body });
  }
);

settings.delete("/trust", async (c) => {
  const projectId = c.req.query("projectId");
  if (!projectId) {
    return errorResponse(c, "projectId query parameter required", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await removeTrust(projectId);
  if (!result.ok) return handleStoreError(c, result.error);

  return jsonOk(c, { removed: result.value });
});
