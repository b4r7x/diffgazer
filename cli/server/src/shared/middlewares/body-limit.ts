import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { bodyLimit } from "hono/body-limit";
import { errorResponse } from "../lib/http/response.js";

/** Default request-body cap (KB) for JSON API routes. */
export const DEFAULT_BODY_LIMIT_KB = 50;
/** Covers 200 paths of 500 JSON-escaped characters plus the review request envelope. */
export const CREATE_REVIEW_BODY_LIMIT_KB = 1024;

export const createBodyLimitMiddleware = (maxSizeKB: number) =>
  bodyLimit({
    maxSize: maxSizeKB * 1024,
    onError: (c) => errorResponse(c, "Request body too large", ErrorCode.PAYLOAD_TOO_LARGE, 413),
  });
