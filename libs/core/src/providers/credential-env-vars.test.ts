import { describe, expect, it } from "vitest";
import { HOSTED_API_PRODUCT_IDS } from "../schemas/config/transports.js";
import { CREDENTIAL_ENV_VARS } from "./credential-env-vars.js";

const UPPER_SNAKE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

describe("credential environment variables", () => {
  it("covers every hosted-api product, the family whose setup offers the env method", () => {
    for (const productId of HOSTED_API_PRODUCT_IDS) {
      expect(CREDENTIAL_ENV_VARS[productId], productId).toMatch(UPPER_SNAKE);
    }
  });

  it("carries the canonical name for hosted products", () => {
    expect(CREDENTIAL_ENV_VARS.gemini).toBe("GOOGLE_API_KEY");
    expect(CREDENTIAL_ENV_VARS["ollama-cloud"]).toBe("OLLAMA_API_KEY");
    expect(CREDENTIAL_ENV_VARS["opencode-zen"]).toBe("OPENCODE_API_KEY");
  });
});
