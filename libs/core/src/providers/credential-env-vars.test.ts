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
});
