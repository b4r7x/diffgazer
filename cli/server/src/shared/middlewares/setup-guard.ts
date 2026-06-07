import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { Context, Next } from "hono";
import { getSetupStatus } from "../lib/config/setup-status.js";
import { getProjectRoot } from "../lib/http/request.js";
import { errorResponse } from "../lib/http/response.js";

export const requireSetup = async (c: Context, next: Next): Promise<Response | undefined> => {
  const projectRoot = getProjectRoot(c);
  const status = getSetupStatus(projectRoot);

  if (!status.isReady) {
    return errorResponse(
      c,
      `Setup incomplete. Missing: ${status.missing.join(", ")}`,
      ErrorCode.SETUP_REQUIRED,
      503,
    );
  }

  await next();
  return undefined;
};
