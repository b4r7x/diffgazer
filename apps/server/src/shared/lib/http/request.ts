import type { Context } from "hono";
import { ErrorCode } from "@stargazer/schemas/errors";
import { PROJECT_ROOT_HEADER, resolveProjectRoot } from "../paths.js";
import { isValidProjectPath } from "../validation.js";
import { errorResponse } from "./response.js";

export const getProjectRoot = (c: Context): string =>
  resolveProjectRoot({
    header: c.req.header(PROJECT_ROOT_HEADER),
    env: process.env.STARGAZER_PROJECT_ROOT,
    cwd: process.cwd(),
  });

export const parseProjectPath = (
  c: Context,
  options: { required?: boolean } = {}
): { ok: true; value?: string } | { ok: false; response: Response } => {
  const projectPath = c.req.query("projectPath");
  if (!projectPath) {
    if (options.required) {
      return {
        ok: false,
        response: errorResponse(c, "projectPath required", ErrorCode.VALIDATION_ERROR, 400),
      };
    }
    return { ok: true, value: undefined };
  }

  if (!isValidProjectPath(projectPath)) {
    return {
      ok: false,
      response: errorResponse(
        c,
        "Invalid projectPath: contains path traversal or null bytes",
        ErrorCode.VALIDATION_ERROR,
        400
      ),
    };
  }

  return { ok: true, value: projectPath };
};
