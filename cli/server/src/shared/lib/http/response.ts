import type { CatalogErrorCode } from "@diffgazer/core/schemas/config";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
// `@hono/zod-validator`'s Hook surfaces zod's internal `$ZodError`, which is a
// distinct type from the public `ZodError` (it lacks `format`/`flatten`/etc.).
// The validator callback below must match that internal type exactly.
import type { core } from "zod";
import type { AIErrorCode } from "../ai/types.js";
import type { SecretsStorageErrorCode } from "../config/types.js";
import type {
  ConfigServiceErrorCode,
  ProviderModelsErrorCode,
  StoreErrorCode,
} from "./error-codes.js";

/**
 * Every error code that may appear in an `{ error: { code } }` wire envelope.
 * Typing `errorResponse` against this closed union makes an out-of-vocabulary
 * code a compile error at the emission site instead of silently shipping a code
 * no client switch can match.
 */
export type WireErrorCode =
  | ErrorCode
  | (typeof ReviewErrorCode)[keyof typeof ReviewErrorCode]
  | CatalogErrorCode
  | AIErrorCode
  | SecretsStorageErrorCode
  | StoreErrorCode
  | ConfigServiceErrorCode
  | ProviderModelsErrorCode
  // The drilldown path emits this review-feature code alongside AIErrorCode.
  | "ISSUE_NOT_FOUND";

const VALID_ERROR_STATUSES = {
  400: 400,
  401: 401,
  403: 403,
  404: 404,
  409: 409,
  413: 413,
  422: 422,
  429: 429,
  500: 500,
  502: 502,
  503: 503,
} satisfies Record<number, ContentfulStatusCode>;

export type ErrorStatus = keyof typeof VALID_ERROR_STATUSES;

export const errorResponse = (
  ctx: Context,
  message: string,
  code: WireErrorCode,
  status: ErrorStatus,
): Response => ctx.json({ error: { message, code } }, VALID_ERROR_STATUSES[status]);

export const zodErrorHandler = <T>(
  result: { success: true; data: T } | { success: false; error: core.$ZodError },
  ctx: Context,
): Response | undefined => {
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const message = firstIssue?.message ?? "Invalid body";
    return errorResponse(ctx, message, ErrorCode.VALIDATION_ERROR, 400);
  }
  return undefined;
};
