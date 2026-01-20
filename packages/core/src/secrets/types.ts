export interface SecretsError {
  code: string;
  message: string;
}

export function secretsError(code: string, message: string): SecretsError {
  return { code, message };
}
