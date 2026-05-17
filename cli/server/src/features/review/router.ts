import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { zodErrorHandler } from "../../shared/lib/http/response.js";
import { createBodyLimitMiddleware } from "../../shared/middlewares/body-limit.js";
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

const bodyLimitMiddleware = createBodyLimitMiddleware(50);

reviewRouter.post(
  "/reviews",
  bodyLimitMiddleware,
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
  (c) => getActiveSessionHandler(c, c.req.valid("query").mode ?? "unstaged"),
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
  requireSetup,
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, zodErrorHandler),
  zValidator("json", DrilldownRequestSchema, zodErrorHandler),
  (c) =>
    drilldownHandler(c, c.req.valid("param").id, c.req.valid("json")),
);

export { reviewRouter };
