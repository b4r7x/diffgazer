import type { Context, Next } from "hono";
import { ErrorCode } from "@diffgazer/schemas/errors";
import { getSetupStatus } from "../../features/config/service.js";
import { getProjectRoot } from "../lib/http/request.js";
import { errorResponse } from "../lib/http/response.js";

export const requireSetup = async (c: Context, next: Next): Promise<Response | void> => {
  const projectRoot = getProjectRoot(c);
  const status = getSetupStatus(projectRoot);

  if (!status.isReady) {
    return errorResponse(
      c,
      `Setup incomplete. Missing: ${status.missing.join(", ")}`,
      ErrorCode.SETUP_REQUIRED,
      503
    );
  }

  await next();
};
