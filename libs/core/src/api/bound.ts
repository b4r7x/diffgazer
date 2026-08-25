import { createApiClient } from "./client.js";
import { bindConfig } from "./config.js";
import { bindGit } from "./git.js";
import { bindReview } from "./review.js";
import { bindSettings } from "./settings.js";
import { bindShutdown } from "./shutdown.js";
import type { ApiClientConfig } from "./types.js";

export function createApi(config: ApiClientConfig) {
  const client = createApiClient(config);

  return {
    request: client.request,
    ...bindConfig(client),
    ...bindSettings(client),
    ...bindGit(client),
    ...bindReview(client),
    ...bindShutdown(client),
  };
}

export type BoundApi = ReturnType<typeof createApi>;
