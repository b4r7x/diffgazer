import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { Context, Next } from "hono";
import { getSetupVerdict } from "../lib/config/setup-status.js";
import { errorResponse } from "../lib/http/response.js";
import { storeErrorStatus } from "../lib/http/store-error.js";

export const requireSetup = async (c: Context, next: Next): Promise<Response | undefined> => {
  const verdictResult = await getSetupVerdict();
  if (!verdictResult.ok) {
    return errorResponse(
      c,
      `Could not verify setup status. ${verdictResult.error.message}. Check secrets storage access and retry.`,
      verdictResult.error.code,
      storeErrorStatus(verdictResult.error.code),
    );
  }
  const verdict = verdictResult.value;
  if (!verdict.ready) {
    return errorResponse(
      c,
      `Setup incomplete (${verdict.status}): ${verdict.remediation.message}`,
      ErrorCode.SETUP_REQUIRED,
      503,
    );
  }
  await next();
  return undefined;
};
