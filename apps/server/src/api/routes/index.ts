import { Hono } from "hono";
import { health } from "./health.js";
import { git } from "./git.js";
import { review } from "./review.js";
import { config } from "./config.js";
import { sessions } from "./sessions.js";
import { reviews } from "./reviews.js";
import { triage } from "./triage.js";
import { settings } from "./settings.js";
import { prReview } from "./pr-review.js";

const routes = new Hono();

routes.route("/health", health);
routes.route("/git", git);
routes.route("/review", review);
routes.route("/config", config);
routes.route("/sessions", sessions);
routes.route("/reviews", reviews);
routes.route("/triage", triage);
routes.route("/settings", settings);
routes.route("/pr-review", prReview);

export { routes };
