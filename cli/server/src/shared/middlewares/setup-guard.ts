import { canAttemptReview } from "@diffgazer/core/schemas/config";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { Context, Next } from "hono";
import { getSetupVerdict } from "../lib/config/setup-status.js";
import { V1_MIGRATION_FAILED_MESSAGE } from "../lib/config/types.js";
import { errorResponse } from "../lib/http/response.js";
import { storeErrorStatus } from "../lib/http/store-error.js";

export const requireSetup = async (c: Context, next: Next): Promise<Response | undefined> => {
  const verdictResult = await getSetupVerdict();
  if (!verdictResult.ok) {
    if (verdictResult.error.code === "SECRETS_MIGRATION_FAILED") {
      return errorResponse(
        c,
        V1_MIGRATION_FAILED_MESSAGE,
        verdictResult.error.code,
        storeErrorStatus(verdictResult.error.code),
      );
    }
    return errorResponse(
      c,
      `Could not verify setup status. ${verdictResult.error.message}. Check secrets storage access and retry.`,
      verdictResult.error.code,
      storeErrorStatus(verdictResult.error.code),
    );
  }
  const verdict = verdictResult.value;
  // Structured-output conformance is proven by running a review, so a config
  // whose only open item is conformance passes through to admission, which
  // either attempts it inline or answers with the tuple-precise fast-fail.
  if (!canAttemptReview(verdict.status)) {
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
