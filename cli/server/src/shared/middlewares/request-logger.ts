import { randomUUID } from "node:crypto";
import { createMiddleware } from "hono/factory";
import { log } from "../lib/log.js";

const REQUEST_ID_HEADER = "X-Request-Id";

export type RequestLoggerEnv = {
  Variables: {
    requestId: string;
    startTime: number;
  };
};

function levelForStatus(status: number): "info" | "warn" | "error" {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
}

/**
 * Assigns a request id, times the request, exposes the id via response header,
 * and logs one structured line per completed request with latency and a
 * 4xx/5xx-aware level. Runs first so rejections (auth/host/CORS) are logged too.
 */
export const requestLogger = createMiddleware<RequestLoggerEnv>(async (c, next) => {
  const requestId = randomUUID();
  const startTime = performance.now();
  c.set("requestId", requestId);
  c.set("startTime", startTime);

  await next();

  c.res.headers.set(REQUEST_ID_HEADER, requestId);
  const durationMs = Math.round((performance.now() - startTime) * 1000) / 1000;
  log(levelForStatus(c.res.status), "request", {
    requestId,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    status: c.res.status,
    durationMs,
  });
});
