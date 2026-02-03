import type { ApiClientConfig } from "./types.js";
import { createApiClient } from "./client.js";
import { bindConfig } from "./config.js";
import { bindReviews } from "./reviews.js";

export function createApi(config: ApiClientConfig) {
  const client = createApiClient(config);

  return {
    client,
    request: client.request,
    stream: client.stream,
    ...bindConfig(client),
    ...bindReviews(client),
  };
}

export type BoundApi = ReturnType<typeof createApi>;
