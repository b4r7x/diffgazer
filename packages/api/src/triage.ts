import type { Result } from "@repo/core";
import { err } from "@repo/core";
import {
  buildTriageQueryParams,
  processTriageStream,
  type StreamTriageRequest,
  type StreamTriageOptions,
  type StreamTriageResult,
  type StreamTriageError,
} from "@repo/core/review";
import type { ApiClient } from "./types.js";
import type { SavedTriageReview, ReviewMode } from "@repo/schemas/triage-storage";

export type { StreamTriageRequest, StreamTriageOptions, StreamTriageResult, StreamTriageError };
export type { SavedTriageReview };

export async function streamTriage(
  client: ApiClient,
  { mode = "unstaged", files, lenses, profile, signal }: StreamTriageRequest = {}
): Promise<Response> {
  const params = buildTriageQueryParams({ mode, files, lenses, profile });
  return client.stream("/triage/stream", { params, signal });
}

export async function streamTriageWithEvents(
  client: ApiClient,
  options: StreamTriageOptions
): Promise<Result<StreamTriageResult, StreamTriageError>> {
  const { mode, files, lenses, profile, signal, ...handlers } = options;

  const response = await streamTriage(client, { mode, files, lenses, profile, signal });

  const reader = response.body?.getReader();

  if (!reader) {
    return err({ code: "STREAM_ERROR", message: "No response body" });
  }

  return processTriageStream(reader, handlers);
}

export interface ResumeTriageOptions {
  reviewId: string;
  signal?: AbortSignal;
  onAgentEvent?: StreamTriageOptions["onAgentEvent"];
  onStepEvent?: StreamTriageOptions["onStepEvent"];
}

export async function resumeTriageStream(
  client: ApiClient,
  options: ResumeTriageOptions
): Promise<Result<void, StreamTriageError>> {
  const { reviewId, signal, ...handlers } = options;

  const response = await client.stream(`/reviews/${reviewId}/stream`, { signal });

  if (!response.ok) {
    return err({ code: "NOT_FOUND", message: "Session not found" });
  }

  const reader = response.body?.getReader();

  if (!reader) {
    return err({ code: "STREAM_ERROR", message: "No response body" });
  }

  const result = await processTriageStream(reader, handlers);

  if (!result.ok) {
    return err(result.error);
  }

  return { ok: true, value: undefined };
}

export async function getTriageReview(
  client: ApiClient,
  reviewId: string
): Promise<{ review: SavedTriageReview }> {
  return client.get<{ review: SavedTriageReview }>(`/triage/reviews/${reviewId}`);
}
