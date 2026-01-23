export { createAIClient } from "./client.js";
export type {
  AIClient,
  AIClientConfig,
  AIProvider,
  StreamCallbacks,
  StreamMetadata,
  GenerateStreamOptions,
} from "./types.js";
export type { AIError, AIErrorCode } from "./errors.js";
export {
  FILE_REVIEW_PROMPT,
  BATCH_REVIEW_PROMPT,
  buildFileReviewPrompt,
  buildBatchReviewPrompt,
} from "./prompts.js";
