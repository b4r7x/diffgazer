import { Hono } from "hono";
import { routes } from "./api/routes/index.js";

export function createServer(): Hono {
  const app = new Hono();

  app.route("/", routes);

  return app;
}
