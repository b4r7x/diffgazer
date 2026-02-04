import type { Hono } from "hono";
import { configRouter } from "./features/config/router.js";
import { gitRouter } from "./features/git/router.js";
import { healthRouter } from "./features/health/router.js";
import { prReviewRouter } from "./features/pr-review/router.js";
import { reviewRouter } from "./features/review/router.js";
import { reviewsRouter } from "./features/reviews/router.js";
import { sessionsRouter } from "./features/sessions/router.js";
import { settingsRouter } from "./features/settings/router.js";
import { triageRouter } from "./features/triage/router.js";

export const registerRoutes = (app: Hono): void => {
  app.route("/", healthRouter);
  app.route("/api", healthRouter);
  app.route("/api/config", configRouter);
  app.route("/api/settings", settingsRouter);
  app.route("/api/git", gitRouter);
  app.route("/api/sessions", sessionsRouter);
  app.route("/api/review", reviewRouter);
  app.route("/api/reviews", reviewsRouter);
  app.route("/api/triage", triageRouter);
  app.route("/api/pr-review", prReviewRouter);
};
