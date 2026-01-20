import { Hono } from "hono";
import { health } from "./health.js";
import { git } from "./git.js";
import { review } from "./review.js";
import { config } from "./config.js";

const routes = new Hono();

routes.route("/health", health);
routes.route("/git", git);
routes.route("/review", review);
routes.route("/config", config);

export { routes };
