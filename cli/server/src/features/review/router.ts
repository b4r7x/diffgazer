import { Hono } from "hono";
import { contextRouter } from "./router/context.js";
import { historyRouter } from "./router/history.js";
import { sessionsRouter } from "./router/sessions.js";

const reviewRouter = new Hono()
  .route("/", sessionsRouter)
  .route("/", contextRouter)
  .route("/", historyRouter);

export { reviewRouter };
