import type { ApiClientConfig } from "./types.js";
import { createApiClient } from "./client.js";
import { bindConfig } from "./config.js";
import { bindGit } from "./git.js";
import { bindReview } from "./review.js";
import { bindShutdown } from "./shutdown.js";

export function createApi(config: ApiClientConfig) {
  const client = createApiClient(config);

  return {
    client,
    request: client.request,
    stream: client.stream,
    ...bindConfig(client),
    ...bindGit(client),
    ...bindReview(client),
    ...bindShutdown(client),
  };
}

export type BoundApi = ReturnType<typeof createApi>;
