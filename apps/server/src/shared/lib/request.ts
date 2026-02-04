import type { Context } from "hono";
import { PROJECT_ROOT_HEADER, resolveProjectRoot } from "./paths.js";

export const getProjectRoot = (c: Context): string =>
  resolveProjectRoot({
    header: c.req.header(PROJECT_ROOT_HEADER),
    env: process.env.STARGAZER_PROJECT_ROOT,
    cwd: process.cwd(),
  });
