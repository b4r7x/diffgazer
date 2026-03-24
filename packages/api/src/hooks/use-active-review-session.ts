import { useQuery } from "@tanstack/react-query";
import type { ReviewMode } from "@diffgazer/schemas/review";
import { reviewQueries } from "./queries/review.queries.js";
import { useApi } from "./context.js";

export function useActiveReviewSession(mode?: ReviewMode) {
  const api = useApi();
  return useQuery(reviewQueries.activeSession(api, mode));
}
