import { useQuery } from "@tanstack/react-query";
import { reviewQueries } from "./queries/review.queries.js";
import { useApi } from "./context.js";

export function useReviewContext() {
  const api = useApi();
  return useQuery(reviewQueries.context(api));
}
