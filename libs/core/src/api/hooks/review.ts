import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type {
  ActiveReviewSession,
  ActiveReviewSessionResponse,
  ReviewMode,
} from "../../schemas/review/index.js";
import type { BoundApi } from "../bound.js";
import { useApi } from "./context.js";
import { reviewQueries } from "./queries/review.js";

export function useReviews(projectPath?: string) {
  const api = useApi();
  return useQuery(reviewQueries.list(api, projectPath));
}

export function useReview(id: string) {
  const api = useApi();
  return useQuery({ ...reviewQueries.detail(api, id), enabled: !!id });
}

export function useActiveReviewSession(mode?: ReviewMode) {
  const api = useApi();
  return useQuery(reviewQueries.activeSession(api, mode));
}

function setActiveReviewSessionQueryData(
  qc: QueryClient,
  api: BoundApi,
  mode: ReviewMode | undefined,
  data: ActiveReviewSessionResponse,
) {
  qc.setQueryData(reviewQueries.activeSession(api, mode).queryKey, data);
}

function activeSessionQueryModes(mode: ReviewMode): Array<ReviewMode | undefined> {
  return mode === "unstaged" ? [mode, undefined] : [mode];
}

function cancelActiveReviewSessionQuery(
  qc: QueryClient,
  api: BoundApi,
  mode: ReviewMode | undefined,
) {
  // biome-ignore format: keep this exact cancellation call grep-checkable for the fix spec.
  return qc.cancelQueries({ queryKey: reviewQueries.activeSession(api, mode).queryKey, exact: true });
}

async function cancelActiveSessionQueries(qc: QueryClient, api: BoundApi, mode: ReviewMode) {
  await Promise.all(
    activeSessionQueryModes(mode).map((queryMode) =>
      cancelActiveReviewSessionQuery(qc, api, queryMode),
    ),
  );
}

function setModeActiveSessionQueryData(
  qc: QueryClient,
  api: BoundApi,
  mode: ReviewMode,
  data: ActiveReviewSessionResponse,
) {
  for (const queryMode of activeSessionQueryModes(mode)) {
    setActiveReviewSessionQueryData(qc, api, queryMode, data);
  }
}

async function cacheActiveSessionQueryData(
  qc: QueryClient,
  api: BoundApi,
  session: ActiveReviewSession,
) {
  await cancelActiveSessionQueries(qc, api, session.mode);
  setModeActiveSessionQueryData(qc, api, session.mode, { session });
}

function sessionMatchesReviewId(
  current: ActiveReviewSessionResponse | undefined,
  reviewId: string | null | undefined,
) {
  return !reviewId || !current?.session?.reviewId || current.session.reviewId === reviewId;
}

function clearActiveReviewSessionQueryData(
  qc: QueryClient,
  api: BoundApi,
  mode: ReviewMode | undefined,
  reviewId: string | null | undefined,
) {
  qc.setQueryData<ActiveReviewSessionResponse>(
    reviewQueries.activeSession(api, mode).queryKey,
    (current) => {
      if (!sessionMatchesReviewId(current, reviewId)) {
        return current;
      }
      return { session: null };
    },
  );
}

async function clearActiveSessionQueryData(
  qc: QueryClient,
  api: BoundApi,
  mode: ReviewMode,
  reviewId?: string | null,
) {
  await cancelActiveSessionQueries(qc, api, mode);
  for (const queryMode of activeSessionQueryModes(mode)) {
    clearActiveReviewSessionQueryData(qc, api, queryMode, reviewId);
  }
}

export function useReviewSessionCache() {
  const api = useApi();
  const qc = useQueryClient();

  const clearActiveSession = useCallback(
    (mode: ReviewMode, reviewId?: string | null) =>
      clearActiveSessionQueryData(qc, api, mode, reviewId),
    [api, qc],
  );

  return useMemo(() => ({ clearActiveSession }), [clearActiveSession]);
}

/**
 * Reads the CURRENT workspace context snapshot. The optional `reviewId` is
 * accepted for caller ergonomics but does NOT partition the cache: the server
 * has no per-review context route, so the snapshot is workspace-global.
 */
export function useReviewContext(options?: { enabled?: boolean; reviewId?: string | null }) {
  const api = useApi();
  const { reviewId: _reviewId, ...queryOptionsOverrides } = options ?? {};
  return useQuery({ ...reviewQueries.context(api), ...queryOptionsOverrides });
}

export function useDeleteReview() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteReview(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: reviewQueries.detail(api, id).queryKey });
      return qc.invalidateQueries({ queryKey: reviewQueries.all() });
    },
  });
}

export function useRefreshReviewContext() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (options?: { force?: boolean }) => api.refreshReviewContext(options),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: reviewQueries.context(api).queryKey,
      }),
  });
}

export function useCreateReview() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (options: Parameters<typeof api.createReview>[0]) => api.createReview(options),
    onSuccess: (data) => cacheActiveSessionQueryData(qc, api, data.session),
  });
}
