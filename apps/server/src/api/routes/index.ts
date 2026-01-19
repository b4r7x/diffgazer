import { Hono } from "hono";
import { health } from "./health.js";
import { git } from "./git.js";

const routes = new Hono();

routes.route("/health", health);
routes.route("/git", git);

export { routes };
