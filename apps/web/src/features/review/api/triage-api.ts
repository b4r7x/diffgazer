import { api } from "@/lib/api";
import type { Result } from "@stargazer/core";
import {
  streamTriage as sharedStreamTriage,
  streamTriageWithEvents as sharedStreamTriageWithEvents,
  resumeTriageStream as sharedResumeTriageStream,
  type StreamTriageRequest,
  type FullStreamTriageOptions,
  type StreamTriageResult,
  type StreamTriageError,
  type ResumeTriageOptions,
} from "@stargazer/api";

export type { StreamTriageRequest, StreamTriageResult, StreamTriageError, ResumeTriageOptions };
export type StreamTriageOptions = FullStreamTriageOptions;

export async function streamTriage(options: StreamTriageRequest = {}): Promise<Response> {
  return sharedStreamTriage(api.client, options);
}

export async function streamTriageWithEvents(
  options: StreamTriageOptions
): Promise<Result<StreamTriageResult, StreamTriageError>> {
  return sharedStreamTriageWithEvents(api.client, options);
}

export async function resumeTriageStream(
  options: ResumeTriageOptions
): Promise<Result<void, StreamTriageError>> {
  return sharedResumeTriageStream(api.client, options);
}
