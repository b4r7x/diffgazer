import { api } from "@/lib/api";
import type { Result } from "@repo/core";
import {
  streamTriage as sharedStreamTriage,
  streamTriageWithEvents as sharedStreamTriageWithEvents,
  resumeTriageStream as sharedResumeTriageStream,
  type StreamTriageRequest,
  type StreamTriageOptions,
  type StreamTriageResult,
  type StreamTriageError,
  type ResumeTriageOptions,
} from "@repo/api";

export type { StreamTriageRequest, StreamTriageOptions, StreamTriageResult, StreamTriageError, ResumeTriageOptions };

export async function streamTriage(options: StreamTriageRequest = {}): Promise<Response> {
  return sharedStreamTriage(api, options);
}

export async function streamTriageWithEvents(
  options: StreamTriageOptions
): Promise<Result<StreamTriageResult, StreamTriageError>> {
  return sharedStreamTriageWithEvents(api, options);
}

export async function resumeTriageStream(
  options: ResumeTriageOptions
): Promise<Result<void, StreamTriageError>> {
  return sharedResumeTriageStream(api, options);
}
