export { ApiProvider, useApi } from "./context.js";

export {
  useSettings,
  useInit,
  useConfigCheck,
  useProviderStatus,
  useOpenRouterModels,
  useSaveSettings,
  useSaveConfig,
  useActivateProvider,
  useDeleteProviderCredentials,
} from "./config.js";

export {
  useReviews,
  useReview,
  useActiveReviewSession,
  useReviewContext,
  useCreateReview,
  useDeleteReview,
  useRefreshReviewContext,
} from "./review.js";

export { useSaveTrust, useDeleteTrust } from "./trust.js";

export { useServerStatus, useShutdown } from "./server.js";

export {
  useReviewStart,
  type UseReviewStartOptions,
  type UseReviewStartResult,
} from "./use-review-start.js";

export { useReviewStream, type ReviewStreamState } from "./use-review-stream.js";
export type { StreamReviewError } from "../review.js";

export {
  useReviewCompletion,
  type UseReviewCompletionOptions,
  type UseReviewCompletionResult,
} from "./use-review-completion.js";

export {
  useReviewLifecycleBase,
  type UseReviewLifecycleBaseOptions,
  type UseReviewLifecycleBaseResult,
} from "./use-review-lifecycle-base.js";

export {
  useDiagnosticsData,
  type DiagnosticsData,
  type ContextStatus,
} from "./diagnostics.js";

export { matchQueryState, guardQueryState } from "./match-query-state.js";

export { configQueries } from "./queries/config.js";
