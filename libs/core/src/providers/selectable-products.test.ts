import { describe, expect, it } from "vitest";
import { CANDIDATE_PRODUCT_IDS } from "../schemas/config/transports.js";
import { projectClientProduct } from "./client-metadata.js";
import { SELECTABLE_PRODUCT_IDS as AUTHORITY_PRODUCT_IDS } from "./product-registry.js";
import * as selectableProducts from "./selectable-products.js";

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
    expect(selectableProducts.SELECTABLE_PRODUCTS.map((product) => product.productId)).toEqual(
      SELECTABLE_PRODUCT_IDS,
    );
    expect(selectableProducts.SELECTABLE_PRODUCTS.every((product) => product.selectable)).toBe(
      true,
    );
  });

  it("matches the canonical safe projection for every selectable product", () => {
    expect(selectableProducts.SELECTABLE_PRODUCTS).toEqual(
      AUTHORITY_PRODUCT_IDS.map(projectClientProduct),
    );
  });

  it("does not expose rejected products", () => {
    const productIds = selectableProducts.SELECTABLE_PRODUCTS.map((product) => product.productId);

    expect(productIds).not.toContain("github-models");
  });

  it("does not expose credential environment maps", () => {
    expect(Object.keys(selectableProducts)).toEqual(["SELECTABLE_PRODUCTS"]);
    expect(selectableProducts).not.toHaveProperty("PROVIDER_ENV_VARS");
    expect(selectableProducts).not.toHaveProperty("ALLOWED_CREDENTIAL_ENV_VARS");
  });

  it("provides no setup action for any excluded candidate", () => {
    const presentation = JSON.stringify(selectableProducts.SELECTABLE_PRODUCTS);

    for (const candidateId of CANDIDATE_PRODUCT_IDS) {
      expect(presentation).not.toContain(candidateId);
    }
    for (const product of selectableProducts.SELECTABLE_PRODUCTS) {
      expect(product).not.toHaveProperty("actions");
    }
  });
});
