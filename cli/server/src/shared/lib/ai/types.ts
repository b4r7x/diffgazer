import type { AppError } from "@diffgazer/core/errors";
import type { Result } from "@diffgazer/core/result";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import type { SharedErrorCode } from "@diffgazer/core/schemas/errors";
import type { z } from "zod";
import type { SecretsStorageErrorCode } from "../config/types.js";

export type AIErrorCode =
  | SharedErrorCode
  | SecretsStorageErrorCode
  | "API_KEY_INVALID"
  | "MODEL_ERROR"
  | "NETWORK_ERROR"
  | "PARSE_ERROR"
  | "STREAM_ERROR"
  | "UNSUPPORTED_PROVIDER";

export type AIError = AppError<AIErrorCode>;

export interface AIClientConfig {
  apiKey: string;
  provider: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  timeoutMs?: number;
  /** The selected model's documented output-token limit, when known from the catalog. */
  outputLimit?: number;
  /** The selected model's documented context-window limit, when known from the catalog. */
  contextLimit?: number;
}

export interface AIClient {
  readonly provider: AIProvider;
  generate<T extends z.ZodType>(
    prompt: string,
    schema: T,
    options?: { signal?: AbortSignal },
  ): Promise<Result<z.infer<T>, AIError>>;
}
