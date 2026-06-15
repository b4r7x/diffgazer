import { z } from "zod";

export const ErrorCode = {
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  FORBIDDEN: "FORBIDDEN",
  UNAUTHORIZED: "UNAUTHORIZED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
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
  CREDENTIAL_INVALID: "CREDENTIAL_INVALID",
  PROJECT_ERROR: "PROJECT_ERROR",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  PROVIDER_NOT_FOUND: "PROVIDER_NOT_FOUND",
  INVALID_RESPONSE: "INVALID_RESPONSE",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * The `{ error: { message, code? } }` envelope every server error response
 * carries. `code` stays a plain string because the server emits domain-specific
 * vocabularies the client does not model; clients narrow against `ErrorCode`
 * where they switch on known members.
 */
export const ApiErrorEnvelopeSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
  }),
});
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;

const SHARED_ERROR_CODES = ["INTERNAL_ERROR", "API_KEY_MISSING", "RATE_LIMITED"] as const;

export type SharedErrorCode = (typeof SHARED_ERROR_CODES)[number];

export function createDomainErrorCodes<const T extends readonly string[]>(specificCodes: T) {
  return [...SHARED_ERROR_CODES, ...specificCodes] as const;
}

export function createDomainErrorSchema<const T extends readonly string[]>(
  specificCodes: T,
  options?: { includeDetails?: boolean },
) {
  const allCodes = createDomainErrorCodes(specificCodes);
  const codeSchema = z.enum(allCodes);

  const base = z.object({
    message: z.string(),
    code: codeSchema,
  });

  return options?.includeDetails ? base.extend({ details: z.string().optional() }) : base;
}
