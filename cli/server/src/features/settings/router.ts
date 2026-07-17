import { SHUTDOWN_TOKEN_HEADER } from "@diffgazer/core/api/protocol";
import { SaveTrustRequestSchema } from "@diffgazer/core/schemas/config";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { zValidator } from "@hono/zod-validator";
import { type Context, Hono, type Next } from "hono";
import { getStore } from "../../shared/lib/config/store.js";
import { safeTokenMatch } from "../../shared/lib/crypto.js";
import { getProjectRoot } from "../../shared/lib/http/request.js";
import { errorResponse, zodErrorHandler } from "../../shared/lib/http/response.js";
import { storeErrorStatus } from "../../shared/lib/http/store-error.js";
import { revokeProjectSessions } from "../../shared/lib/session-registry.js";
import { createBodyLimitMiddleware } from "../../shared/middlewares/body-limit.js";
import { SettingsSchema } from "./schemas.js";

const settingsRouter = new Hono();

const bodyLimitMiddleware = createBodyLimitMiddleware(10);

const requireTrustRouteToken = async (c: Context, next: Next): Promise<Response | undefined> => {
  const token = process.env.DIFFGAZER_SHUTDOWN_TOKEN?.trim();
  if (!token || !safeTokenMatch(c.req.header(SHUTDOWN_TOKEN_HEADER), token)) {
    return errorResponse(c, "Unauthorized", ErrorCode.UNAUTHORIZED, 401);
  }
  await next();
  return undefined;
};

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
      return errorResponse(
        c,
        result.error.message,
        result.error.code,
        storeErrorStatus(result.error.code),
      );
    }
    return c.json(result.value);
  },
);

settingsRouter.get("/trust", requireTrustRouteToken, (c) => {
  const projectRoot = getProjectRoot(c);
  const project = getStore().getProjectInfo(projectRoot);
  if (!project.projectId) {
    return errorResponse(c, "Failed to resolve project identity", ErrorCode.PROJECT_ERROR, 500);
  }
  const trust = getStore().getTrust(project.projectId);
  if (!trust) {
    return errorResponse(c, "Trust not found for project", ErrorCode.NOT_FOUND, 404);
  }
  return c.json({ trust });
});

settingsRouter.post(
  "/trust",
  requireTrustRouteToken,
  bodyLimitMiddleware,
  zValidator("json", SaveTrustRequestSchema, zodErrorHandler),
  async (c) => {
    const body = c.req.valid("json");
    const projectRoot = getProjectRoot(c);

    // Server-derive identity fields -- never trust the client for these.
    const project = getStore().ensureProjectFile(projectRoot);
    if (!project.projectId) {
      return errorResponse(c, "Failed to resolve project identity", ErrorCode.PROJECT_ERROR, 500);
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
      return errorResponse(
        c,
        result.error.message,
        result.error.code,
        storeErrorStatus(result.error.code),
      );
    }
    if (existingTrust?.capabilities.readFiles && !trustConfig.capabilities.readFiles) {
      revokeProjectSessions(projectRoot, {
        message: "Review session cancelled because repository trust was revoked.",
        reason: "trust_revoked",
      });
    }
    return c.json({ trust: result.value });
  },
);

settingsRouter.delete("/trust", requireTrustRouteToken, async (c) => {
  const projectRoot = getProjectRoot(c);
  const project = getStore().getProjectInfo(projectRoot);
  if (!project.projectId) {
    return errorResponse(c, "Failed to resolve project identity", ErrorCode.PROJECT_ERROR, 500);
  }
  const result = await getStore().removeTrust(project.projectId);
  if (!result.ok) {
    return errorResponse(
      c,
      result.error.message,
      result.error.code,
      storeErrorStatus(result.error.code),
    );
  }
  if (result.value) {
    revokeProjectSessions(projectRoot, {
      message: "Review session cancelled because repository trust was revoked.",
      reason: "trust_revoked",
    });
  }
  return c.json({ removed: result.value });
});

export { settingsRouter };
