export type { StreamReviewError } from "../review.js";

export {
  useActivateProvider,
  useConfigCheck,
  useDeleteProviderCredentials,
  useInit,
  useOpenRouterModels,
  useProviderModels,
  useProviderStatus,
  useSaveConfig,
  useSaveSettings,
  useSettings,
} from "./config.js";
export { ApiProvider, useApi } from "./context.js";
export {
  type ContextStatus,
  type DiagnosticsActions,
  type DiagnosticsActionsInput,
  type DiagnosticsData,
  type DiagnosticsPresentation,
  deriveDiagnosticsActions,
  getContextActionLabel,
  getContextPresentation,
  getServerStatusPresentation,
  getSetupPresentation,
  refreshAllDiagnostics,
  type SetupPresentationInput,
  useDiagnosticsData,
} from "./diagnostics.js";
export { guardQueryState, matchQueryState } from "./match-query-state.js";
export { configQueries } from "./queries/config.js";
export {
  useActiveReviewSession,
  useCreateReview,
  useRefreshReviewContext,
  useReview,
  useReviewContext,
  useReviewSessionCache,
  useReviews,
} from "./review.js";
export { useServerStatus, useShutdown } from "./server.js";
export { useDeleteTrust, useSaveTrust } from "./trust.js";
export {
  type UseReviewCompletionOptions,
  type UseReviewCompletionResult,
  useReviewCompletion,
} from "./use-review-completion.js";
export {
  deriveReviewGate,
  type ReviewGate,
  type UseReviewLifecycleBaseOptions,
  type UseReviewLifecycleBaseResult,
  useReviewLifecycleBase,
} from "./use-review-lifecycle-base.js";
export {
  type UseReviewStartOptions,
  type UseReviewStartResult,
  useReviewStart,
} from "./use-review-start.js";
export { type ReviewStreamState, useReviewStream } from "./use-review-stream.js";
export {
  TRUST_EDITOR_MESSAGES,
  type UseTrustEditorCallbacks,
  type UseTrustEditorResult,
  useTrustEditor,
} from "./use-trust-editor.js";
