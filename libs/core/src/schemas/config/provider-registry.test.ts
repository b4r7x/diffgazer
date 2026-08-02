import { describe, expect, it } from "vitest";
import { projectClientProduct } from "../../providers/client-metadata.js";
import { SELECTABLE_PRODUCT_IDS as AUTHORITY_PRODUCT_IDS } from "../../providers/product-registry.js";
import * as providerRegistry from "./provider-registry.js";
import { REMOVED_PRODUCT_ID } from "./providers.js";
import { CANDIDATE_PRODUCT_IDS } from "./transports.js";

const SELECTABLE_PRODUCT_IDS = [
  "gemini",
  "zai",
  "openrouter",
  "groq",
  "cerebras",
  "deepseek",
  "qwen",
  "moonshot",
  "mistral",
  "ollama",
  "local-openai",
  "codex-cli",
  "copilot-cli",
];

describe("selectable product presentation", () => {
  it("exposes exactly the 13 selectable products from product authority", () => {
    expect(providerRegistry.SELECTABLE_PRODUCTS.map((product) => product.productId)).toEqual(
      SELECTABLE_PRODUCT_IDS,
    );
    expect(providerRegistry.SELECTABLE_PRODUCTS.every((product) => product.selectable)).toBe(true);
  });

  it("matches the canonical safe projection for every selectable product", () => {
    expect(providerRegistry.SELECTABLE_PRODUCTS).toEqual(
      AUTHORITY_PRODUCT_IDS.map(projectClientProduct),
    );
  });

  it("does not expose removed or rejected products", () => {
    const productIds = providerRegistry.SELECTABLE_PRODUCTS.map((product) => product.productId);

    expect(productIds).not.toContain(REMOVED_PRODUCT_ID);
    expect(productIds).not.toContain("github-models");
  });

  it("does not expose credential environment maps", () => {
    expect(Object.keys(providerRegistry)).toEqual(["SELECTABLE_PRODUCTS"]);
    expect(providerRegistry).not.toHaveProperty("PROVIDER_ENV_VARS");
    expect(providerRegistry).not.toHaveProperty("ALLOWED_CREDENTIAL_ENV_VARS");
  });

  it("provides no setup action for any excluded candidate", () => {
    const presentation = JSON.stringify(providerRegistry.SELECTABLE_PRODUCTS);

    for (const candidateId of CANDIDATE_PRODUCT_IDS) {
      expect(presentation).not.toContain(candidateId);
    }
    for (const product of providerRegistry.SELECTABLE_PRODUCTS) {
      expect(product).not.toHaveProperty("actions");
    }
  });
});
