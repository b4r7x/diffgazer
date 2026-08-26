import { describe, expect, it } from "vitest";
import { PRODUCT_ENDPOINT_TUPLES } from "../../providers/product-endpoints.js";
import { PRODUCT_REGISTRY } from "../../providers/product-registry.js";
import { ClientConfigurationInputSchema } from "./provider-config.js";
import {
  CANDIDATE_PRODUCT_IDS,
  DEFERRED_PRODUCT_IDS,
  EXPERIMENTAL_PRODUCT_IDS,
  getHostedApiEndpointTuple,
  HOSTED_API_PRODUCT_IDS,
  HostedApiEndpointSchema,
  REJECTED_PRODUCT_IDS,
  RUNNABLE_PRODUCT_IDS,
  RunnableProductIdSchema,
  TRANSPORT_FAMILIES,
  TransportFamilySchema,
} from "./transports.js";

describe("transport family contract", () => {
  it("contains exactly the three supported families", () => {
    expect(TRANSPORT_FAMILIES).toEqual(["hosted-api", "local-http", "local-cli"]);

    for (const family of TRANSPORT_FAMILIES) {
      expect(TransportFamilySchema.parse(family)).toBe(family);
    }
    expect(TransportFamilySchema.safeParse("sdk").success).toBe(false);
  });

  it("keeps every runnable product hosted", () => {
    expect(RUNNABLE_PRODUCT_IDS).toEqual([
      "gemini",
      "zai",
      "openrouter",
      "deepseek",
      "qwen",
      "moonshot",
      "minimax",
      "ollama-cloud",
      "opencode-zen",
    ]);
    expect(RUNNABLE_PRODUCT_IDS).toEqual(HOSTED_API_PRODUCT_IDS);
  });

  it("keeps every experimental, deferred, and rejected candidate non-runnable", () => {
    expect(CANDIDATE_PRODUCT_IDS).toEqual([
      ...EXPERIMENTAL_PRODUCT_IDS,
      ...DEFERRED_PRODUCT_IDS,
      ...REJECTED_PRODUCT_IDS,
    ]);

    for (const productId of CANDIDATE_PRODUCT_IDS) {
      expect(RunnableProductIdSchema.safeParse(productId).success).toBe(false);
    }
  });
});

describe("endpoint contracts", () => {
  it.each([
    "https://generativelanguage.googleapis.com/v1beta",
    "https://api.z.ai/api/paas/v4",
  ])("accepts a normalized hosted HTTPS endpoint: %s", (endpoint) => {
    expect(HostedApiEndpointSchema.parse(endpoint)).toBe(endpoint);
  });

  it.each([
    "http://api.z.ai/api/paas/v4",
    "https://user:secret@api.z.ai/api/paas/v4",
    "https://api.z.ai:8443/api/paas/v4",
    "https://api.z.ai/api/paas/v4?region=eu",
    "https://api.z.ai/api/paas/v4#models",
    "https://API.Z.AI/api/paas/v4",
    "https://api.z.ai/api/paas/v4/../v4",
  ])("rejects an unsafe or non-normalized hosted endpoint: %s", (endpoint) => {
    expect(HostedApiEndpointSchema.safeParse(endpoint).success).toBe(false);
  });
});

describe("endpoint tuple authority", () => {
  it("centralizes hosted endpoint matching", () => {
    expect(getHostedApiEndpointTuple("zai", "https://api.z.ai/api/paas/v4")?.id).toBe(
      "general-payg",
    );
    expect(
      getHostedApiEndpointTuple("zai", "https://generativelanguage.googleapis.com/v1beta"),
    ).toBeUndefined();
  });

  it("keeps transport validation and product presentation on the same profiles", () => {
    for (const productId of RUNNABLE_PRODUCT_IDS) {
      expect(PRODUCT_REGISTRY[productId].configuration.endpoints).toBe(
        PRODUCT_ENDPOINT_TUPLES[productId],
      );
    }

    for (const productId of HOSTED_API_PRODUCT_IDS) {
      for (const endpoint of PRODUCT_ENDPOINT_TUPLES[productId]) {
        expect(
          ClientConfigurationInputSchema.safeParse({
            transportFamily: "hosted-api",
            productId,
            endpoint: endpoint.endpoint,
          }).success,
        ).toBe(true);
      }
    }
  });
});

describe("hosted configuration input", () => {
  const hostedInput = {
    transportFamily: "hosted-api" as const,
    productId: "zai" as const,
    endpoint: "https://api.z.ai/api/paas/v4",
  };

  it("accepts one closed hosted input shape", () => {
    expect(ClientConfigurationInputSchema.parse(hostedInput)).toEqual(hostedInput);
  });

  it.each([
    { ...hostedInput, installationId: "codex-installation-1" },
    { ...hostedInput, transportFamily: "local-http" },
    { ...hostedInput, productId: "ollama" },
    { ...hostedInput, productId: "groq" },
    // A pre-removal qwen record still carrying region/workspace transport
    // fields must fail the strict shape, not ride back in with the restored id.
    {
      transportFamily: "hosted-api",
      productId: "qwen",
      endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      region: "international",
      workspace: "workspace-reference",
    },
  ])("rejects a retired transport family, product, or foreign field", (input) => {
    expect(ClientConfigurationInputSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    { ...hostedInput, endpoint: "https://generativelanguage.googleapis.com/v1beta" },
    {
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
      region: "global",
    },
    {
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
      workspace: "workspace-reference",
    },
    {
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
      account: "account-reference",
    },
  ])("rejects a hosted endpoint tuple outside its product contract", (input) => {
    expect(ClientConfigurationInputSchema.safeParse(input).success).toBe(false);
  });

  it("keeps the exact normalized hosted tuple valid", () => {
    expect(ClientConfigurationInputSchema.parse(hostedInput)).toEqual(hostedInput);
    expect(HostedApiEndpointSchema.parse(hostedInput.endpoint)).toBe(hostedInput.endpoint);
  });
});
