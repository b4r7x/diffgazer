import type { ApiClientConfig } from "./types.js";
import { createApiClient } from "./client.js";
import { bindConfig } from "./config.js";
import { bindGit } from "./git.js";
import { bindPrReview } from "./pr-review.js";
import { bindReview } from "./review.js";
import { bindReviews } from "./reviews.js";
import { bindSessions } from "./sessions.js";
import { bindTriage } from "./triage.js";

export function createApi(config: ApiClientConfig) {
  const client = createApiClient(config);

  return {
    client,
    request: client.request,
    stream: client.stream,
    ...bindConfig(client),
    ...bindGit(client),
    ...bindSessions(client),
    ...bindReview(client),
    ...bindReviews(client),
    ...bindTriage(client),
    ...bindPrReview(client),
  };
}

export type BoundApi = ReturnType<typeof createApi>;
