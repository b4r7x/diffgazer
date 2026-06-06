import { TrustConfigSchema } from "@diffgazer/core/schemas/config";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { getStore } from "../../shared/lib/config/store.js";
import { getProjectRoot } from "../../shared/lib/http/request.js";
import { errorResponse, zodErrorHandler } from "../../shared/lib/http/response.js";
import { createBodyLimitMiddleware } from "../../shared/middlewares/body-limit.js";
import { SettingsSchema } from "./schemas.js";

const settingsRouter = new Hono();

const bodyLimitMiddleware = createBodyLimitMiddleware(10);

settingsRouter.get("/", (c) => {
  return c.json(getStore().getSettings());
});

settingsRouter.post(
  "/",
  bodyLimitMiddleware,
  zValidator("json", SettingsSchema, zodErrorHandler),
  async (c) => {
    const patch = c.req.valid("json");
    const result = await getStore().updateSettings(patch);
    if (!result.ok) {
      return errorResponse(c, result.error.message, result.error.code, 400);
    }
    return c.json(result.value);
  }
);

settingsRouter.get(
  "/trust",
  (c) => {
    const projectRoot = getProjectRoot(c);
    const project = getStore().getProjectInfo(projectRoot);
    if (!project.projectId) {
      return errorResponse(c, "Failed to resolve project identity", "PROJECT_ERROR", 500);
    }
    const trust = getStore().getTrust(project.projectId);
    if (!trust) {
      return errorResponse(c, "Trust not found for project", ErrorCode.NOT_FOUND, 404);
    }
    return c.json({ trust });
  }
);

settingsRouter.get("/trust/list", (c) => {
  const projectRoot = getProjectRoot(c);
  const project = getStore().getProjectInfo(projectRoot);
  const all = getStore().listTrustedProjects();
  const scoped = all.filter((t) => t.projectId === project.projectId);
  return c.json({ projects: scoped });
});

settingsRouter.post(
  "/trust",
  bodyLimitMiddleware,
  zValidator("json", TrustConfigSchema, zodErrorHandler),
  async (c) => {
    const body = c.req.valid("json");
    const projectRoot = getProjectRoot(c);

    // Server-derive identity fields -- never trust the client for these.
    const project = getStore().ensureProjectFile(projectRoot);
    if (!project.projectId) {
      return errorResponse(c, "Failed to resolve project identity", "PROJECT_ERROR", 500);
    }

    const existingTrust = getStore().getTrust(project.projectId);

    // Normalize capabilities: runCommands is not yet supported, always strip
    const capabilities = { ...body.capabilities, runCommands: false };

    const trustConfig = {
      ...body,
      capabilities,
      projectId: project.projectId,
      repoRoot: projectRoot,
      // Preserve trustedAt on edits; only generate on first grant
      trustedAt: existingTrust?.trustedAt ?? new Date().toISOString(),
    };

    const result = await getStore().saveTrust(trustConfig);
    if (!result.ok) {
      return errorResponse(c, result.error.message, result.error.code, 400);
    }
    return c.json({ trust: result.value });
  }
);

settingsRouter.delete(
  "/trust",
  async (c) => {
    const projectRoot = getProjectRoot(c);
    const project = getStore().getProjectInfo(projectRoot);
    if (!project.projectId) {
      return errorResponse(c, "Failed to resolve project identity", "PROJECT_ERROR", 500);
    }
    const result = await getStore().removeTrust(project.projectId);
    if (!result.ok) {
      return errorResponse(c, result.error.message, result.error.code, 400);
    }
    return c.json({ removed: result.value });
  }
);

export { settingsRouter };
