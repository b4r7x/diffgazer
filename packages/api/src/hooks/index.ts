// Context
export { ApiProvider, useApi } from "./context.js";

// Config domain
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

// Review domain
export {
  useReviews,
  useReview,
  useActiveReviewSession,
  useReviewContext,
  useDeleteReview,
  useRefreshReviewContext,
} from "./review.js";

// Trust domain
export { useSaveTrust, useDeleteTrust } from "./trust.js";

// Server domain
export { useServerStatus, type ServerState, useShutdown } from "./server.js";

// Streaming hook
export { useReviewStream, type ReviewStreamState } from "./use-review-stream.js";

// Utilities
export { matchQueryState } from "./match-query-state.js";

// Query factory (used externally by ConfigProvider)
export { configQueries } from "./queries/config.js";
