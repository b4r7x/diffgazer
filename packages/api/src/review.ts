import type { ApiClient } from "./types.js";

export async function streamReview(
  client: ApiClient,
  options: { staged?: boolean; signal?: AbortSignal } = {}
): Promise<Response> {
  const params: Record<string, string> = {};
  if (options.staged !== undefined) {
    params.staged = String(options.staged);
  }

  return client.stream("/api/review/stream", { params, signal: options.signal });
}

export const bindReview = (client: ApiClient) => ({
  streamReview: (options?: { staged?: boolean; signal?: AbortSignal }) =>
    streamReview(client, options),
});
