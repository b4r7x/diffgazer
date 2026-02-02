import { Hono } from "hono";

const shutdown = new Hono();

shutdown.post("/", (c) => {
  setTimeout(() => process.kill(process.pid, "SIGTERM"), 100);
  return c.json({ ok: true });
});

export { shutdown };
