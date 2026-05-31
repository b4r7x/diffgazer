import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { zodErrorHandler } from "../../shared/lib/http/response.js";
import { createBodyLimitMiddleware, DEFAULT_BODY_LIMIT_KB } from "../../shared/middlewares/body-limit.js";
import { createRateLimitMiddleware } from "../../shared/middlewares/rate-limit.js";
import { requireSetup } from "../../shared/middlewares/setup-guard.js";
import { requireRepoAccess } from "../../shared/middlewares/trust-guard.js";
import {
  ActiveSessionQuerySchema,
  ContextRefreshSchema,
  CreateReviewBodySchema,
  DrilldownRequestSchema,
  ReviewIdParamSchema,
} from "./schemas.js";
import {
  cancelSessionHandler,
  createReviewHandler,
  deleteReviewHandler,
  drilldownHandler,
  getActiveSessionHandler,
  getReviewHandler,
  listReviewsHandler,
} from "./review-routes.js";
import { resumeStreamById } from "./session-resume.js";
import { getContextHandler, refreshContextHandler } from "./context-routes.js";

const reviewRouter = new Hono();

const bodyLimitMiddleware = createBodyLimitMiddleware(DEFAULT_BODY_LIMIT_KB);
const reviewCreationLimit = createRateLimitMiddleware("review:create", { maxRequests: 10, windowMs: 60_000 });
const drilldownLimit = createRateLimitMiddleware("review:drilldown", { maxRequests: 20, windowMs: 60_000 });

reviewRouter.post(
  "/reviews",
  bodyLimitMiddleware,
  reviewCreationLimit,
  requireSetup,
  requireRepoAccess,
  zValidator("json", CreateReviewBodySchema, zodErrorHandler),
  (c) => createReviewHandler(c, c.req.valid("json")),
);

reviewRouter.get(
  "/reviews/:id/stream",
  requireSetup,
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, zodErrorHandler),
  resumeStreamById,
);

reviewRouter.get(
  "/sessions/active",
  requireSetup,
  requireRepoAccess,
  zValidator("query", ActiveSessionQuerySchema, zodErrorHandler),
  (c) => {
    const query = c.req.valid("query");
    return getActiveSessionHandler(c, {
      mode: query.mode ?? "unstaged",
      profile: query.profile,
      lenses: query.lenses,
      files: query.files,
    });
  },
);

reviewRouter.delete(
  "/sessions/:id",
  requireSetup,
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, zodErrorHandler),
  (c) => cancelSessionHandler(c, c.req.valid("param").id),
);

reviewRouter.get(
  "/context",
  requireSetup,
  requireRepoAccess,
  getContextHandler,
);

reviewRouter.post(
  "/context/refresh",
  bodyLimitMiddleware,
  requireSetup,
  requireRepoAccess,
  zValidator("json", ContextRefreshSchema, zodErrorHandler),
  (c) => refreshContextHandler(c, c.req.valid("json")),
);

reviewRouter.get("/reviews", requireRepoAccess, listReviewsHandler);

reviewRouter.get(
  "/reviews/:id",
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, zodErrorHandler),
  (c) => getReviewHandler(c, c.req.valid("param").id),
);

reviewRouter.delete(
  "/reviews/:id",
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, zodErrorHandler),
  (c) => deleteReviewHandler(c, c.req.valid("param").id),
);

reviewRouter.post(
  "/reviews/:id/drilldown",
  bodyLimitMiddleware,
  drilldownLimit,
  requireSetup,
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, zodErrorHandler),
  zValidator("json", DrilldownRequestSchema, zodErrorHandler),
  (c) =>
    drilldownHandler(c, c.req.valid("param").id, c.req.valid("json")),
);

export { reviewRouter };
