import { api } from "@/lib/api";
import type { Result } from "@repo/core";
import {
  buildTriageQueryParams,
  processTriageStream,
  type StreamTriageRequest,
  type StreamTriageOptions,
  type StreamTriageResult,
  type StreamTriageError,
} from "@repo/core/review";
import { err } from "@repo/core";

export type { StreamTriageRequest, StreamTriageOptions, StreamTriageResult, StreamTriageError };

export async function streamTriage({
  staged = true,
  files,
  lenses,
  profile,
  signal,
}: StreamTriageRequest = {}): Promise<Response> {
  const params = buildTriageQueryParams({ staged, files, lenses, profile });
  return api.stream("/triage/stream", { params, signal });
}

export async function streamTriageWithEvents(
  options: StreamTriageOptions
): Promise<Result<StreamTriageResult, StreamTriageError>> {
  const { staged, files, lenses, profile, signal, ...handlers } = options;

  const response = await streamTriage({ staged, files, lenses, profile, signal });
  const reader = response.body?.getReader();

  if (!reader) {
    return err({ code: "STREAM_ERROR", message: "No response body" });
  }

  return processTriageStream(reader, handlers);
}
