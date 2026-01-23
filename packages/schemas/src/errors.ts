import { z } from "zod";

/** All error codes used across the application */
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

// Generate schema from ErrorCode object to avoid duplication
const errorCodeValues = Object.values(ErrorCode) as [ErrorCode, ...ErrorCode[]];
export const ErrorCodeSchema = z.enum(errorCodeValues);

/** Base error codes for composition with domain-specific codes */
export const SHARED_ERROR_CODES = [
  "INTERNAL_ERROR",
  "API_KEY_MISSING",
  "RATE_LIMITED",
] as const;

export type SharedErrorCode = (typeof SHARED_ERROR_CODES)[number];
export const SharedErrorCodeSchema = z.enum(SHARED_ERROR_CODES);
