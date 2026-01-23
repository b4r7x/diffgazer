import type { AppError } from "../errors.js";

/**
 * Error codes for secrets management operations.
 *
 * - `KEYRING_UNAVAILABLE`: System keyring is not available or could not be initialized
 * - `SECRET_NOT_FOUND`: The requested secret does not exist
 * - `READ_FAILED`: Failed to read from the secrets store
 * - `WRITE_FAILED`: Failed to write to the secrets store
 * - `PERMISSION_ERROR`: Insufficient permissions to access secrets
 * - `VAULT_READ_ERROR`: Failed to read from the encrypted vault file
 * - `VAULT_WRITE_ERROR`: Failed to write to the encrypted vault file
 * - `PARSE_ERROR`: Failed to parse vault data (corrupted or invalid format)
 */
export type SecretsErrorCode =
  | "KEYRING_UNAVAILABLE"
  | "SECRET_NOT_FOUND"
  | "READ_FAILED"
  | "WRITE_FAILED"
  | "PERMISSION_ERROR"
  | "VAULT_READ_ERROR"
  | "VAULT_WRITE_ERROR"
  | "PARSE_ERROR";

export type SecretsError = AppError<SecretsErrorCode>;
