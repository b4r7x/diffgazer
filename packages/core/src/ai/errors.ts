import { type SharedErrorCode } from "@repo/schemas";
import { type AppError } from "../errors.js";

/** AI-specific error codes (domain-specific) */
export const AI_SPECIFIC_CODES = [
  "API_KEY_INVALID",
  "MODEL_ERROR",
  "NETWORK_ERROR",
  "PARSE_ERROR",
  "STREAM_ERROR",
  "UNSUPPORTED_PROVIDER",
] as const;
export type AISpecificCode = (typeof AI_SPECIFIC_CODES)[number];

/** All AI error codes: shared + domain-specific */
export type AIErrorCode = SharedErrorCode | AISpecificCode;

export type AIError = AppError<AIErrorCode>;
