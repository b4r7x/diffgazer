import type { RunnableProductId } from "../schemas/config/transports.js";

/**
 * The environment variable each product reads when a credential is supplied as
 * `{ kind: "environment" }`.
 *
 * This is the single copy: the server binds the credential from it
 * (`cli/server/src/shared/lib/config/store/actions.ts`) and the setup surfaces preview the
 * same name to the user. The names carry no secrets, so shipping them to clients
 * costs nothing and parity holds by construction.
 */
export const CREDENTIAL_ENV_VARS: Readonly<Record<RunnableProductId, string>> = {
  gemini: "GOOGLE_API_KEY",
  zai: "ZAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  qwen: "QWEN_API_KEY",
  moonshot: "MOONSHOT_API_KEY",
  minimax: "MINIMAX_API_KEY",
  "ollama-cloud": "OLLAMA_API_KEY",
  "opencode-zen": "OPENCODE_API_KEY",
};
