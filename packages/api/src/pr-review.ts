import type { ApiClient, PRReviewResponse } from "./types.js";

export interface PRReviewRequest {
  diff: string;
  lenses?: string[];
  profile?: string;
  baseRef?: string;
  headRef?: string;
}

export async function runPrReview(
  client: ApiClient,
  input: PRReviewRequest
): Promise<PRReviewResponse> {
  return client.post<PRReviewResponse>("/api/pr-review", input);
}

export const bindPrReview = (client: ApiClient) => ({
  runPrReview: (input: PRReviewRequest) => runPrReview(client, input),
});
