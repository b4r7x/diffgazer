import type {
  ApiClient,
  ReviewMode,
  TriageReviewsResponse,
  TriageReviewResponse,
  DrilldownResponse,
} from "./types.js";

export interface StreamTriageOptions {
  mode?: ReviewMode;
  staged?: boolean;
  files?: string[];
  lenses?: string[];
  profile?: string;
  signal?: AbortSignal;
}

export async function streamTriage(
  client: ApiClient,
  options: StreamTriageOptions = {}
): Promise<Response> {
  const params: Record<string, string> = {};
  if (options.mode) {
    params.mode = options.mode;
  } else if (options.staged !== undefined) {
    params.staged = String(options.staged);
  }
  if (options.files?.length) params.files = options.files.join(",");
  if (options.lenses?.length) params.lenses = options.lenses.join(",");
  if (options.profile) params.profile = options.profile;

  return client.stream("/api/triage/stream", { params, signal: options.signal });
}

export async function getTriageReviews(
  client: ApiClient,
  projectPath?: string
): Promise<TriageReviewsResponse> {
  const params = projectPath ? { projectPath } : undefined;
  return client.get<TriageReviewsResponse>("/api/triage/reviews", params);
}

export async function getTriageReview(
  client: ApiClient,
  id: string
): Promise<TriageReviewResponse> {
  return client.get<TriageReviewResponse>(`/api/triage/reviews/${id}`);
}

export async function deleteTriageReview(
  client: ApiClient,
  id: string
): Promise<{ existed: boolean }> {
  return client.delete<{ existed: boolean }>(`/api/triage/reviews/${id}`);
}

export async function runTriageDrilldown(
  client: ApiClient,
  reviewId: string,
  issueId: string
): Promise<DrilldownResponse> {
  return client.post<DrilldownResponse>(`/api/triage/reviews/${reviewId}/drilldown`, {
    issueId,
  });
}

export const bindTriage = (client: ApiClient) => ({
  streamTriage: (options?: StreamTriageOptions) => streamTriage(client, options),
  getTriageReviews: (projectPath?: string) => getTriageReviews(client, projectPath),
  getTriageReview: (id: string) => getTriageReview(client, id),
  deleteTriageReview: (id: string) => deleteTriageReview(client, id),
  runTriageDrilldown: (reviewId: string, issueId: string) =>
    runTriageDrilldown(client, reviewId, issueId),
});
