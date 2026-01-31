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

  console.log("[API:STREAM_START]", { staged, files, lenses, profile });

  const response = await streamTriage(client, { staged, files, lenses, profile, signal });

  console.log("[API:RESPONSE]", {
    status: response.status,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries()),
    hasBody: !!response.body,
  });

  const reader = response.body?.getReader();

  if (!reader) {
    console.error("[API:NO_READER] response.body is null");
    return err({ code: "STREAM_ERROR", message: "No response body" });
  }

  console.log("[API:READER_CREATED] starting processTriageStream");
  const result = await processTriageStream(reader, handlers);
  console.log("[API:STREAM_RESULT]", result.ok ? "ok" : "err", result.ok ? { reviewId: result.value.reviewId, events: result.value.agentEvents.length } : result.error);

  return result;
}
