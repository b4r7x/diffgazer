import type { RunnableProductId } from "../schemas/config/transports.js";

/**
 * The environment variable each product reads when a credential is supplied as
 * `{ kind: "environment" }`.
 *
 * This is the single copy: the server binds the credential from it
 * (`cli/server/src/shared/lib/config/store/actions.ts`) and the setup surfaces preview the
 * same name to the user. The names carry no secrets, so shipping them to clients
 * costs nothing and parity holds by construction.
 *
 * Products that bind no credential variable — Ollama and the local CLIs, which
 * authenticate through the local runtime — are absent by design, which is why the
 * record is partial.
 */
export const CREDENTIAL_ENV_VARS: Readonly<Partial<Record<RunnableProductId, string>>> = {
  gemini: "GOOGLE_API_KEY",
  zai: "ZAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  qwen: "QWEN_API_KEY",
  moonshot: "MOONSHOT_API_KEY",
  mistral: "MISTRAL_API_KEY",
  "ollama-cloud": "OLLAMA_API_KEY",
  "local-openai": "OPENAI_API_KEY",
};

/** The canonical environment variable a hosted product reads for `{ kind: "environment" }`. */
export function resolveCredentialEnvironmentVariable(productId: RunnableProductId): string {
  const envVar = CREDENTIAL_ENV_VARS[productId];
  if (!envVar) {
    throw new Error(`No credential environment variable mapped for ${productId}`);
  }
  return envVar;
}
