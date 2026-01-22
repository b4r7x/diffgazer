import { Hono } from "hono";
import { health } from "./health.js";
import { git } from "./git.js";
import { review } from "./review.js";
import { config } from "./config.js";
import { sessions } from "./sessions.js";
import { reviews } from "./reviews.js";

const routes = new Hono();

routes.route("/health", health);
routes.route("/git", git);
routes.route("/review", review);
routes.route("/config", config);
routes.route("/sessions", sessions);
routes.route("/reviews", reviews);

export { routes };
