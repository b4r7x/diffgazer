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
  useDeleteReview,
  useRefreshReviewContext,
} from "./review.js";

export { useSaveTrust, useDeleteTrust } from "./trust.js";

export { useServerStatus, useShutdown } from "./server.js";

// Review start (shared lifecycle hook)
export {
  useReviewStart,
  type UseReviewStartOptions,
  type UseReviewStartResult,
} from "./use-review-start.js";

// Streaming hook
export { useReviewStream, type ReviewStreamState } from "./use-review-stream.js";
export type { StreamReviewError } from "../review.js";

// Review completion hook
export {
  useReviewCompletion,
  type UseReviewCompletionOptions,
  type UseReviewCompletionResult,
} from "./use-review-completion.js";

// Diagnostics (composed hook)
export {
  useDiagnosticsData,
  type DiagnosticsData,
  type ContextStatus,
} from "./diagnostics.js";

// Utilities

export { matchQueryState } from "./match-query-state.js";

export { configQueries } from "./queries/config.js";
