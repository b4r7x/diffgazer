import type { Hono } from "hono";
import { configRouter } from "./features/config/router.js";
import { healthRouter } from "./features/health/router.js";
import { reviewsRouter } from "./features/reviews/router.js";
import { settingsRouter } from "./features/settings/router.js";

const ROUTES: Array<[string, Hono]> = [
  ["/", healthRouter],
  ["/api", healthRouter],
  ["/api/config", configRouter],
  ["/api/settings", settingsRouter],
  ["/api/reviews", reviewsRouter],
];

export const registerRoutes = (app: Hono): void => {
  for (const [path, router] of ROUTES) {
    app.route(path, router);
  }
};
