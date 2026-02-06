import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { TrustConfigSchema } from "@stargazer/schemas/settings";
import { errorResponse, zodErrorHandler } from "../../shared/lib/http/response.js";
import { createBodyLimitMiddleware } from "../../shared/middlewares/body-limit.js";
import {
  getSettings,
  getTrust,
  listTrustedProjects,
  removeTrust,
  saveTrust,
  updateSettings,
} from "../../shared/lib/config/store.js";
import { settingsSchema, projectIdQuery } from "./schemas.js";

const settingsRouter = new Hono();

const bodyLimitMiddleware = createBodyLimitMiddleware(10);

settingsRouter.get("/", (c) => {
  return c.json(getSettings());
});

settingsRouter.post(
  "/",
  bodyLimitMiddleware,
  zValidator("json", settingsSchema, zodErrorHandler),
  (c) => {
    const patch = c.req.valid("json");
    const result = updateSettings(patch);
    if (!result.ok) {
      return errorResponse(c, result.error.message, result.error.code, 400);
    }
    return c.json(result.value);
  }
);

settingsRouter.get(
  "/trust",
  zValidator("query", projectIdQuery, zodErrorHandler),
  (c) => {
    const { projectId } = c.req.valid("query");
    const trust = getTrust(projectId);
    if (!trust) {
      return errorResponse(c, "Trust not found for project", "NOT_FOUND", 404);
    }
    return c.json({ trust });
  }
);

settingsRouter.get("/trust/list", (c) => {
  return c.json({ projects: listTrustedProjects() });
});

settingsRouter.post(
  "/trust",
  bodyLimitMiddleware,
  zValidator("json", TrustConfigSchema, zodErrorHandler),
  (c) => {
    const body = c.req.valid("json");
    return c.json({ trust: saveTrust(body) });
  }
);

settingsRouter.delete(
  "/trust",
  zValidator("query", projectIdQuery, zodErrorHandler),
  (c) => {
    const { projectId } = c.req.valid("query");
    return c.json({ removed: removeTrust(projectId) });
  }
);

export { settingsRouter };
