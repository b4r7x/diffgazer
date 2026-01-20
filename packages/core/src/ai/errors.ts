import { type AppError, createError } from "../errors.js";

export type AIErrorCode =
  | "API_KEY_MISSING"
  | "API_KEY_INVALID"
  | "RATE_LIMITED"
  | "MODEL_ERROR"
  | "NETWORK_ERROR"
  | "PARSE_ERROR"
  | "STREAM_ERROR"
  | "UNSUPPORTED_PROVIDER";

export type AIError = AppError<AIErrorCode>;

export const createAIError = (code: AIErrorCode, message: string, details?: string) =>
  createError(code, message, details);
