import { type AppError, createError } from "../errors.js";

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

export const secretsError = (code: SecretsErrorCode, message: string) =>
  createError(code, message);
