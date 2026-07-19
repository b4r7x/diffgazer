import {
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type {
  ActiveReviewSession,
  ActiveReviewSessionResponse,
  ReviewListWarning,
  ReviewMode,
} from "../../schemas/review/index.js";
import type { BoundApi } from "../bound.js";
import { useApi } from "./context.js";
import { reviewQueries } from "./queries/review.js";

function reviewWarningKey(warning: ReviewListWarning): string {
  switch (warning.kind) {
    case "unreadable_review":
      return `${warning.kind}:${warning.reviewId}`;
    case "invalid_issues_dropped":
      return `${warning.kind}:${warning.reviewId}`;
    case "index_build_failed":
    case "index_rewrite_failed":
      return warning.kind;
    default: {
      const unhandledWarning: never = warning;
      return unhandledWarning;
    }
  }
}

function dedupeReviewWarnings(warnings: readonly ReviewListWarning[]): ReviewListWarning[] {
  const warningsByKey = new Map<string, ReviewListWarning>();
  for (const warning of warnings) {
    const key = reviewWarningKey(warning);
    const existing = warningsByKey.get(key);
    if (existing?.kind === "invalid_issues_dropped" && warning.kind === "invalid_issues_dropped") {
      warningsByKey.set(key, { ...warning, count: Math.max(existing.count, warning.count) });
    } else if (!existing) {
      warningsByKey.set(key, warning);
    }
  }
  return [...warningsByKey.values()];
}

export function useReviews(projectPath?: string) {
  const api = useApi();
  return useInfiniteQuery({
    ...reviewQueries.list(api, projectPath),
    select: (data) => {
      const reviewsById = new Map(
        data.pages.flatMap((page) => page.reviews).map((review) => [review.id, review]),
      );
      const warnings = dedupeReviewWarnings(data.pages.flatMap((page) => page.warnings ?? []));
      return {
        reviews: [...reviewsById.values()],
        nextCursor: data.pages.at(-1)?.nextCursor ?? null,
        ...(warnings.length > 0 ? { warnings } : {}),
      };
    },
  });
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
  return qc.cancelQueries({
    queryKey: reviewQueries.activeSession(api, mode).queryKey,
    exact: true,
  });
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

/** Reads the current workspace-global context snapshot. */
export function useReviewContext(options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery({ ...reviewQueries.context(api), ...options });
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
