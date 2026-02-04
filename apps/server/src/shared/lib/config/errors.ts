type SecretsStorageErrorCode =
  | "KEYRING_UNAVAILABLE"
  | "KEYRING_READ_FAILED"
  | "KEYRING_WRITE_FAILED"
  | "KEYRING_DELETE_FAILED"
  | "SECRET_NOT_FOUND"
  | "SECRETS_MIGRATION_FAILED";

export class SecretsStorageError extends Error {
  readonly code: SecretsStorageErrorCode;

  constructor(code: SecretsStorageErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
