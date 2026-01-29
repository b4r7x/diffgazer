import type { Result } from "@repo/core";
import { err } from "@repo/core";
import {
  buildTriageQueryParams,
  processTriageStream,
  type StreamTriageRequest,
  type StreamTriageOptions,
  type StreamTriageResult,
  type StreamTriageError,
} from "@repo/core/review/browser";
import type { ApiClient } from "./types.js";

export type { StreamTriageRequest, StreamTriageOptions, StreamTriageResult, StreamTriageError };

export async function streamTriage(
  client: ApiClient,
  { staged = true, files, lenses, profile, signal }: StreamTriageRequest = {}
): Promise<Response> {
  const params = buildTriageQueryParams({ staged, files, lenses, profile });
  return client.stream("/triage/stream", { params, signal });
}

export async function streamTriageWithEvents(
  client: ApiClient,
  options: StreamTriageOptions
): Promise<Result<StreamTriageResult, StreamTriageError>> {
  const { staged, files, lenses, profile, signal, ...handlers } = options;

  const response = await streamTriage(client, { staged, files, lenses, profile, signal });
  const reader = response.body?.getReader();

  if (!reader) {
    return err({ code: "STREAM_ERROR", message: "No response body" });
  }

  return processTriageStream(reader, handlers);
}
