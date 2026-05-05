import { z } from "zod";

export const ErrorCode = {
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AI_ERROR: "AI_ERROR",
  AI_CLIENT_ERROR: "AI_CLIENT_ERROR",
  API_KEY_MISSING: "API_KEY_MISSING",
  RATE_LIMITED: "RATE_LIMITED",
  STREAM_ERROR: "STREAM_ERROR",
  CONFIG_NOT_FOUND: "CONFIG_NOT_FOUND",
  GIT_NOT_FOUND: "GIT_NOT_FOUND",
  NOT_GIT_REPO: "NOT_GIT_REPO",
  COMMAND_FAILED: "COMMAND_FAILED",
  INVALID_PATH: "INVALID_PATH",
  TRUST_REQUIRED: "TRUST_REQUIRED",
  SETUP_REQUIRED: "SETUP_REQUIRED",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ErrorCodeSchema = z.enum(
  Object.values(ErrorCode) as [ErrorCode, ...ErrorCode[]]
);

export const SHARED_ERROR_CODES = [
  "INTERNAL_ERROR",
  "API_KEY_MISSING",
  "RATE_LIMITED",
] as const;

export type SharedErrorCode = (typeof SHARED_ERROR_CODES)[number];

export const UuidSchema = z.string().uuid();

export const timestampFields = {
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
} as const;

export const createdAtField = {
  createdAt: z.string().datetime(),
} as const;

export function createDomainErrorCodes<const T extends readonly string[]>(
  specificCodes: T
): [string, ...string[]] {
  return [...SHARED_ERROR_CODES, ...specificCodes] as [string, ...string[]];
}

export function createDomainErrorSchema<const T extends readonly string[]>(
  specificCodes: T,
  options?: { includeDetails?: boolean }
) {
  const allCodes = createDomainErrorCodes(specificCodes);
  const codeSchema = z.enum(allCodes);

  const base = z.object({
    message: z.string(),
    code: codeSchema,
  });

  return options?.includeDetails ? base.extend({ details: z.string().optional() }) : base;
}
