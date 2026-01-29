import { api } from "@/lib/api";
import type { Result } from "@repo/core";
import {
  streamTriage as sharedStreamTriage,
  streamTriageWithEvents as sharedStreamTriageWithEvents,
  type StreamTriageRequest,
  type StreamTriageOptions,
  type StreamTriageResult,
  type StreamTriageError,
} from "@repo/api";

export type { StreamTriageRequest, StreamTriageOptions, StreamTriageResult, StreamTriageError };

export async function streamTriage(options: StreamTriageRequest = {}): Promise<Response> {
  return sharedStreamTriage(api, options);
}

export async function streamTriageWithEvents(
  options: StreamTriageOptions
): Promise<Result<StreamTriageResult, StreamTriageError>> {
  return sharedStreamTriageWithEvents(api, options);
}
