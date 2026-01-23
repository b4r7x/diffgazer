import { z } from "zod";

/**
 * Centralized error codes for the entire application.
 * All error codes should be defined here to ensure consistency
 * across the codebase and provide a single source of truth.
 */

// =============================================================================
// Error Code Constants
// =============================================================================

/**
 * General/shared error codes used across multiple domains.
 */
export const ErrorCode = {
  // General errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",

  // AI-related errors
  AI_ERROR: "AI_ERROR",
  AI_CLIENT_ERROR: "AI_CLIENT_ERROR",
  API_KEY_MISSING: "API_KEY_MISSING",
  RATE_LIMITED: "RATE_LIMITED",

  // Streaming errors
  STREAM_ERROR: "STREAM_ERROR",

  // Session/Chat errors
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  CONFIG_NOT_FOUND: "CONFIG_NOT_FOUND",
  MESSAGE_SAVE_ERROR: "MESSAGE_SAVE_ERROR",

  // Git errors
  GIT_NOT_FOUND: "GIT_NOT_FOUND",
  NOT_GIT_REPO: "NOT_GIT_REPO",
  COMMAND_FAILED: "COMMAND_FAILED",
  INVALID_PATH: "INVALID_PATH",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// =============================================================================
// Zod Schemas
// =============================================================================

/**
 * Zod schema for validating error codes.
 */
export const ErrorCodeSchema = z.enum([
  ErrorCode.INTERNAL_ERROR,
  ErrorCode.NOT_FOUND,
  ErrorCode.VALIDATION_ERROR,
  ErrorCode.AI_ERROR,
  ErrorCode.AI_CLIENT_ERROR,
  ErrorCode.API_KEY_MISSING,
  ErrorCode.RATE_LIMITED,
  ErrorCode.STREAM_ERROR,
  ErrorCode.SESSION_NOT_FOUND,
  ErrorCode.CONFIG_NOT_FOUND,
  ErrorCode.MESSAGE_SAVE_ERROR,
  ErrorCode.GIT_NOT_FOUND,
  ErrorCode.NOT_GIT_REPO,
  ErrorCode.COMMAND_FAILED,
  ErrorCode.INVALID_PATH,
]);

// =============================================================================
// Legacy Exports (for backward compatibility)
// =============================================================================

/**
 * @deprecated Use ErrorCode instead. This is kept for backward compatibility.
 */
export const SHARED_ERROR_CODES = [
  "INTERNAL_ERROR",
  "API_KEY_MISSING",
  "RATE_LIMITED",
] as const;

/**
 * @deprecated Use ErrorCodeSchema instead.
 */
export const SharedErrorCodeSchema = z.enum(SHARED_ERROR_CODES);

/**
 * @deprecated Use ErrorCode type instead.
 */
export type SharedErrorCode = (typeof SHARED_ERROR_CODES)[number];
