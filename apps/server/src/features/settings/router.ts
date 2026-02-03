import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { getSettings, saveSettings } from "./service.js";

const settingsRouter = new Hono();

const settingsSchema = z.object({
  theme: z.enum(["auto", "dark", "light", "terminal"]).optional(),
  defaultLenses: z.array(z.string()).optional(),
  defaultProfile: z.string().nullable().optional(),
  severityThreshold: z.string().optional(),
});

settingsRouter.get("/", (c): Response => {
  const settings = getSettings();
  return c.json(settings);
});

settingsRouter.post("/", zValidator("json", settingsSchema), (c): Response => {
  const patch = c.req.valid("json");
  const settings = saveSettings(patch);
  return c.json(settings);
});

export { settingsRouter };
