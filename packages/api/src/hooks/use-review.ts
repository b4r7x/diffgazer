import { useQuery } from "@tanstack/react-query";
import { reviewQueries } from "./queries/review.queries.js";
import { useApi } from "./context.js";

export function useReview(id: string) {
  const api = useApi();
  return useQuery({ ...reviewQueries.detail(api, id), enabled: !!id });
}
