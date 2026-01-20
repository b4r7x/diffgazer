import type { AIClient, AIClientConfig, AIProvider } from "./types.js";
import type { Result } from "../result.js";
import type { AIError } from "./errors.js";
import { err } from "../result.js";
import { createAIError } from "./errors.js";
import { createGeminiClient } from "./providers/gemini.js";

export function createAIClient(provider: AIProvider, config: AIClientConfig): Result<AIClient, AIError> {
  switch (provider) {
    case "gemini":
      return createGeminiClient(config);

    default:
      return err(createAIError("UNSUPPORTED_PROVIDER", `Provider '${provider}' is not yet implemented`));
  }
}
