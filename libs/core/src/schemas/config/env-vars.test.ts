import { describe, it, expect } from "vitest";
import { PROVIDER_ENV_VARS, ALLOWED_CREDENTIAL_ENV_VARS } from "./capabilities.js";
import { AI_PROVIDERS } from "./providers.js";

describe("PROVIDER_ENV_VARS (security allowlist source)", () => {
  it("maps every provider in the enum to an env var (exhaustive)", () => {
    for (const id of AI_PROVIDERS) {
      expect(PROVIDER_ENV_VARS[id], `missing env var for ${id}`).toBeTruthy();
    }
  });

  it("keeps zai and zai-coding on ZAI_API_KEY, never models.dev's ZHIPU_API_KEY", () => {
    expect(PROVIDER_ENV_VARS.zai).toBe("ZAI_API_KEY");
    expect(PROVIDER_ENV_VARS["zai-coding"]).toBe("ZAI_API_KEY");
    expect(Object.values(PROVIDER_ENV_VARS)).not.toContain("ZHIPU_API_KEY");
  });

  it("keeps the original provider env vars unchanged", () => {
    expect(PROVIDER_ENV_VARS.gemini).toBe("GOOGLE_API_KEY");
    expect(PROVIDER_ENV_VARS.openrouter).toBe("OPENROUTER_API_KEY");
  });

  it("adds GROQ_API_KEY and CEREBRAS_API_KEY for the new providers", () => {
    expect(PROVIDER_ENV_VARS.groq).toBe("GROQ_API_KEY");
    expect(PROVIDER_ENV_VARS.cerebras).toBe("CEREBRAS_API_KEY");
  });
});

describe("ALLOWED_CREDENTIAL_ENV_VARS (security allowlist)", () => {
  it("admits exactly the provider env vars", () => {
    expect(ALLOWED_CREDENTIAL_ENV_VARS.has("GOOGLE_API_KEY")).toBe(true);
    expect(ALLOWED_CREDENTIAL_ENV_VARS.has("ZAI_API_KEY")).toBe(true);
    expect(ALLOWED_CREDENTIAL_ENV_VARS.has("GROQ_API_KEY")).toBe(true);
    expect(ALLOWED_CREDENTIAL_ENV_VARS.has("CEREBRAS_API_KEY")).toBe(true);
  });

  it("rejects unknown env vars", () => {
    expect(ALLOWED_CREDENTIAL_ENV_VARS.has("ZHIPU_API_KEY")).toBe(false);
    expect(ALLOWED_CREDENTIAL_ENV_VARS.has("PATH")).toBe(false);
    expect(ALLOWED_CREDENTIAL_ENV_VARS.has("AWS_SECRET_ACCESS_KEY")).toBe(false);
  });
});
