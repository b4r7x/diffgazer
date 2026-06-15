import { PROJECT_ROOT_HEADER } from "@diffgazer/core/api/protocol";
import type { Context } from "hono";
import { isPackaged, resolveProjectRoot } from "../paths.js";

export const getProjectRoot = (c: Context): string =>
  resolveProjectRoot({
    header:
      !isPackaged() && process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT === "1"
        ? c.req.header(PROJECT_ROOT_HEADER)
        : undefined,
    env: process.env.DIFFGAZER_PROJECT_ROOT,
    cwd: process.cwd(),
  });
