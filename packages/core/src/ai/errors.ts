import { type SharedErrorCode } from "@repo/schemas";
import { type AppError } from "../errors.js";

/**
 * AI-specific error codes for operations involving AI providers.
 *
 * - `API_KEY_INVALID`: The API key is missing, malformed, or rejected by the provider
 * - `MODEL_ERROR`: The requested model is unavailable or returned an unexpected error
 * - `NETWORK_ERROR`: Connection to the AI provider failed
 * - `PARSE_ERROR`: AI response could not be parsed (invalid JSON, unexpected format)
 * - `STREAM_ERROR`: Error during streaming response
 * - `UNSUPPORTED_PROVIDER`: The requested AI provider is not supported
 */
export const AI_SPECIFIC_CODES = [
  "API_KEY_INVALID",
  "MODEL_ERROR",
  "NETWORK_ERROR",
  "PARSE_ERROR",
  "STREAM_ERROR",
  "UNSUPPORTED_PROVIDER",
] as const;

export type AISpecificCode = (typeof AI_SPECIFIC_CODES)[number];

export type AIErrorCode = SharedErrorCode | AISpecificCode;

export type AIError = AppError<AIErrorCode>;
