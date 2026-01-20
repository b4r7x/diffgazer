export const AI_ERROR_CODES = [
  "API_KEY_MISSING",
  "API_KEY_INVALID",
  "RATE_LIMITED",
  "MODEL_ERROR",
  "NETWORK_ERROR",
  "PARSE_ERROR",
  "STREAM_ERROR",
  "UNSUPPORTED_PROVIDER",
] as const;

export type AIErrorCode = typeof AI_ERROR_CODES[number];

export interface AIError {
  code: AIErrorCode;
  message: string;
  details?: string;
}

export function createAIError(code: AIErrorCode, message: string, details?: string): AIError {
  return { code, message, details };
}
