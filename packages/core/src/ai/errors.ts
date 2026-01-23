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

/** Union type of AI-specific error codes */
export type AISpecificCode = (typeof AI_SPECIFIC_CODES)[number];

/**
 * All error codes that can occur in AI operations.
 * Combines shared error codes (from schemas) with AI-specific codes.
 */
export type AIErrorCode = SharedErrorCode | AISpecificCode;

/**
 * Error type for AI-related operations.
 * Follows the AppError pattern with AIErrorCode as the code type.
 *
 * @example
 * ```typescript
 * const error: AIError = {
 *   code: "API_KEY_INVALID",
 *   message: "OpenAI API key not configured",
 * };
 * ```
 */
export type AIError = AppError<AIErrorCode>;
