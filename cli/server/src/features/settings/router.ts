import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { TrustConfigSchema } from "@diffgazer/core/schemas/config";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { errorResponse, zodErrorHandler } from "../../shared/lib/http/response.js";
import { createBodyLimitMiddleware } from "../../shared/middlewares/body-limit.js";
import {
  ensureProjectFile,
  getProjectInfo,
  getSettings,
  getTrust,
  listTrustedProjects,
  removeTrust,
  saveTrust,
  updateSettings,
} from "../../shared/lib/config/store.js";
import { getProjectRoot } from "../../shared/lib/http/request.js";
import { SettingsSchema } from "./schemas.js";

const settingsRouter = new Hono();

const bodyLimitMiddleware = createBodyLimitMiddleware(10);

settingsRouter.get("/", (c) => {
  return c.json(getSettings());
});

settingsRouter.post(
  "/",
  bodyLimitMiddleware,
  zValidator("json", SettingsSchema, zodErrorHandler),
  async (c) => {
    const patch = c.req.valid("json");
    const result = await updateSettings(patch);
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
    const project = getProjectInfo(projectRoot);
    if (!project.projectId) {
      return errorResponse(c, "Failed to resolve project identity", "PROJECT_ERROR", 500);
    }
    const trust = getTrust(project.projectId);
    if (!trust) {
      return errorResponse(c, "Trust not found for project", ErrorCode.NOT_FOUND, 404);
    }
    return c.json({ trust });
  }
);

settingsRouter.get("/trust/list", (c) => {
  const projectRoot = getProjectRoot(c);
  const project = getProjectInfo(projectRoot);
  const all = listTrustedProjects();
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
    const project = ensureProjectFile(projectRoot);
    if (!project.projectId) {
      return errorResponse(c, "Failed to resolve project identity", "PROJECT_ERROR", 500);
    }

    const existingTrust = getTrust(project.projectId);
    const trustConfig = {
      ...body,
      projectId: project.projectId,
      repoRoot: projectRoot,
      // Preserve trustedAt on edits; only generate on first grant
      trustedAt: existingTrust?.trustedAt ?? new Date().toISOString(),
    };

    const result = await saveTrust(trustConfig);
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
    const project = getProjectInfo(projectRoot);
    if (!project.projectId) {
      return errorResponse(c, "Failed to resolve project identity", "PROJECT_ERROR", 500);
    }
    const result = await removeTrust(project.projectId);
    if (!result.ok) {
      return errorResponse(c, result.error.message, result.error.code, 400);
    }
    return c.json({ removed: result.value });
  }
);

export { settingsRouter };
