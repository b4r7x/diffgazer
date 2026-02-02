export { createAIClient } from "./sdk-client.js";
export type {
  AIClient,
  AIClientConfig,
  AIProvider,
  StreamCallbacks,
  StreamMetadata,
  GenerateStreamOptions,
  AIError,
  AIErrorCode,
} from "./types.js";
export { PROVIDER_ENV_VARS, getEnvVarForProvider } from "./provider-config.js";
