import { Hono } from "hono";
import { health } from "./health.js";

const routes = new Hono();

routes.route("/health", health);

export { routes };
