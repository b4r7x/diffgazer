import type { ApiClientConfig } from "./types";
import { createApiClient } from "./client";
import { bindConfig } from "./config";
import { bindGit } from "./git";
import { bindReview } from "./review";
import { bindShutdown } from "./shutdown";

export function createApi(config: ApiClientConfig) {
  const client = createApiClient(config);

  return {
    client,
    request: client.request,
    ...bindConfig(client),
    ...bindGit(client),
    ...bindReview(client),
    ...bindShutdown(client),
  };
}

export type BoundApi = ReturnType<typeof createApi>;
