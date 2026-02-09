import type { z } from "zod";
import type { AIProvider } from "@diffgazer/schemas/config";
import type { SharedErrorCode } from "@diffgazer/schemas/errors";
import type { Result } from "@diffgazer/core/result";
import type { AppError } from "@diffgazer/core/errors";

export type AIErrorCode =
  | SharedErrorCode
  | "API_KEY_INVALID"
  | "MODEL_ERROR"
  | "NETWORK_ERROR"
  | "PARSE_ERROR"
  | "STREAM_ERROR"
  | "UNSUPPORTED_PROVIDER";

export type AIError = AppError<AIErrorCode>;

export interface StreamMetadata {
  truncated: boolean;
  finishReason?: string;
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void | Promise<void>;
  onComplete: (fullContent: string, metadata: StreamMetadata) => void | Promise<void>;
  onError: (error: Error) => void | Promise<void>;
}

export interface AIClientConfig {
  apiKey: string;
  provider: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface AIClient {
  readonly provider: AIProvider;
  generate<T extends z.ZodType>(prompt: string, schema: T, options?: { signal?: AbortSignal }): Promise<Result<z.infer<T>, AIError>>;
  generateStream(
    prompt: string,
    callbacks: StreamCallbacks
  ): Promise<void>;
}
