import { api } from "@/lib/api";
import type { Result } from "@stargazer/core";
import {
  streamReview as sharedStreamReview,
  streamReviewWithEvents as sharedStreamReviewWithEvents,
  resumeReviewStream as sharedResumeReviewStream,
  getReviewContext as sharedGetReviewContext,
  refreshReviewContext as sharedRefreshReviewContext,
  type StreamReviewRequest,
  type FullStreamReviewOptions,
  type StreamReviewResult,
  type StreamReviewError,
  type ResumeReviewOptions,
} from "@stargazer/api";

export type { StreamReviewRequest, StreamReviewResult, StreamReviewError, ResumeReviewOptions };
export type StreamReviewOptions = FullStreamReviewOptions;

export async function streamReview(options: StreamReviewRequest = {}): Promise<Response> {
  return sharedStreamReview(api.client, options);
}

export async function streamReviewWithEvents(
  options: StreamReviewOptions
): Promise<Result<StreamReviewResult, StreamReviewError>> {
  return sharedStreamReviewWithEvents(api.client, options);
}

export async function resumeReviewStream(
  options: ResumeReviewOptions
): Promise<Result<void, StreamReviewError>> {
  return sharedResumeReviewStream(api.client, options);
}

export async function getReviewContext() {
  return sharedGetReviewContext(api.client);
}

export async function refreshReviewContext(options?: { force?: boolean }) {
  return sharedRefreshReviewContext(api.client, options);
}
