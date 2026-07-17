import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { Context, Next } from "hono";
import { getSetupStatus } from "../lib/config/setup-status.js";
import { getProjectRoot } from "../lib/http/request.js";
import { errorResponse } from "../lib/http/response.js";
import { storeErrorStatus } from "../lib/http/store-error.js";

export const requireSetup = async (c: Context, next: Next): Promise<Response | undefined> => {
  const projectRoot = getProjectRoot(c);
  const statusResult = getSetupStatus(projectRoot);
  if (!statusResult.ok) {
    return errorResponse(
      c,
      `Could not verify configured credentials. ${statusResult.error.message}. Check secrets storage access and retry.`,
      statusResult.error.code,
      storeErrorStatus(statusResult.error.code),
    );
  }
  const status = statusResult.value;

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
