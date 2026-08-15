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
  LOCAL_OPENAI_PRESET_ENDPOINTS,
  LOCAL_OPENAI_PRESET_IDS,
  LoopbackHttpEndpointSchema,
  matchesHostedApiTransportTuple,
  matchesLocalHttpTransportTuple,
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

  it("partitions exactly 13 runnable product identities", () => {
    expect(RUNNABLE_PRODUCT_IDS).toEqual([
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
    ]);
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
    "https://api.deepseek.com/v1",
  ])("accepts a normalized hosted HTTPS endpoint: %s", (endpoint) => {
    expect(HostedApiEndpointSchema.parse(endpoint)).toBe(endpoint);
  });

  it.each([
    "http://api.deepseek.com/v1",
    "https://user:secret@api.deepseek.com/v1",
    "https://api.deepseek.com:8443/v1",
    "https://api.deepseek.com/v1?region=eu",
    "https://api.deepseek.com/v1#models",
    "https://API.DEEPSEEK.COM/v1",
    "https://api.deepseek.com/v1/../v1",
  ])("rejects an unsafe or non-normalized hosted endpoint: %s", (endpoint) => {
    expect(HostedApiEndpointSchema.safeParse(endpoint).success).toBe(false);
  });

  it.each([
    "http://localhost:11434",
    "http://127.0.0.1:11434",
    "http://127.10.20.30:9000/v1",
    "http://[::1]:8080/v1",
  ])("accepts a normalized HTTP loopback endpoint: %s", (endpoint) => {
    expect(LoopbackHttpEndpointSchema.parse(endpoint)).toBe(endpoint);
  });

  it.each([
    "https://127.0.0.1:11434",
    "http://0.0.0.0:11434",
    "http://192.168.1.2:11434",
    "http://example.com:11434",
    "http://user:secret@localhost:11434",
    "http://localhost:11434/v1?token=secret",
    "http://LOCALHOST:11434",
  ])("rejects a non-loopback or unsafe local endpoint: %s", (endpoint) => {
    expect(LoopbackHttpEndpointSchema.safeParse(endpoint).success).toBe(false);
  });
});

describe("endpoint tuple authority", () => {
  it("centralizes hosted region/workspace and local preset matching", () => {
    const qwenTuple = getHostedApiEndpointTuple(
      "qwen",
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      "international",
    );
    expect(qwenTuple && "workspaceBound" in qwenTuple ? qwenTuple.workspaceBound : undefined).toBe(
      true,
    );
    expect(
      matchesHostedApiTransportTuple({
        productId: "qwen",
        endpoint: qwenTuple?.endpoint ?? "",
        region: "international",
        workspace: "workspace-reference",
      }),
    ).toBe(true);
    expect(
      matchesHostedApiTransportTuple({
        productId: "qwen",
        endpoint: qwenTuple?.endpoint ?? "",
        region: "international",
      }),
    ).toBe(false);
    expect(
      matchesLocalHttpTransportTuple({
        productId: "local-openai",
        endpoint: LOCAL_OPENAI_PRESET_ENDPOINTS["lm-studio"],
        presetId: "lm-studio",
      }),
    ).toBe(true);
    expect(
      matchesLocalHttpTransportTuple({
        productId: "local-openai",
        endpoint: LOCAL_OPENAI_PRESET_ENDPOINTS["llama-cpp"],
        presetId: "lm-studio",
      }),
    ).toBe(false);
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
            ...("region" in endpoint ? { region: endpoint.region } : {}),
            ...("workspaceBound" in endpoint ? { workspace: "workspace-reference" } : {}),
          }).success,
        ).toBe(true);
      }
    }
  });
});

describe("transport-specific configuration", () => {
  const hostedInput = {
    transportFamily: "hosted-api" as const,
    productId: "qwen" as const,
    endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    region: "international",
    workspace: "workspace-reference",
  };
  const localHttpInput = {
    transportFamily: "local-http" as const,
    productId: "ollama" as const,
    endpoint: "http://localhost:11434",
    authentication: "none" as const,
  };
  const localCliInput = {
    transportFamily: "local-cli" as const,
    productId: "codex-cli" as const,
    installationId: "codex-installation-1",
  };

  it("accepts one closed input shape for each transport family", () => {
    expect(ClientConfigurationInputSchema.parse(hostedInput)).toEqual(hostedInput);
    expect(ClientConfigurationInputSchema.parse(localHttpInput)).toEqual(localHttpInput);
    expect(ClientConfigurationInputSchema.parse(localCliInput)).toEqual(localCliInput);
  });

  it.each([
    { ...hostedInput, installationId: "codex-installation-1" },
    { ...localHttpInput, region: "international" },
    { ...localCliInput, endpoint: "http://localhost:11434" },
    { ...localHttpInput, productId: "gemini" },
    { ...localCliInput, productId: "ollama" },
  ])("rejects fields or products from another transport family", (input) => {
    expect(ClientConfigurationInputSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    {
      transportFamily: "local-http",
      productId: "ollama",
      endpoint: "http://localhost:11434",
    },
    {
      transportFamily: "local-cli",
      productId: "codex-cli",
    },
  ])("rejects a transport missing a family-required field", (input) => {
    expect(ClientConfigurationInputSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    {
      ...hostedInput,
      endpoint: "https://api.moonshot.ai/v1",
      region: "international",
    },
    { ...hostedInput, region: "mainland" },
    { ...hostedInput, workspace: undefined },
    {
      transportFamily: "hosted-api",
      productId: "moonshot",
      endpoint: "https://api.moonshot.cn/v1",
      region: "international",
    },
    {
      transportFamily: "hosted-api",
      productId: "mistral",
      endpoint: "https://api.mistral.ai/v1",
    },
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

  it.each([
    {
      transportFamily: "hosted-api",
      productId: "moonshot",
      endpoint: "https://api.moonshot.cn/v1",
      region: "mainland",
    },
    {
      transportFamily: "hosted-api",
      productId: "moonshot",
      endpoint: "https://api.moonshot.ai/v1",
      region: "international",
    },
    {
      transportFamily: "hosted-api",
      productId: "mistral",
      endpoint: "https://api.mistral.ai/v1",
      region: "global",
    },
    {
      transportFamily: "hosted-api",
      productId: "mistral",
      endpoint: "https://api.eu.mistral.ai/v1",
      region: "eu",
    },
  ])("accepts an exact regional endpoint tuple", (input) => {
    expect(ClientConfigurationInputSchema.parse(input)).toEqual(input);
  });

  it("binds local-openai presets to their exact identities and URLs", () => {
    expect(LOCAL_OPENAI_PRESET_IDS).toEqual(["lm-studio", "llama-cpp"]);
    expect(LOCAL_OPENAI_PRESET_ENDPOINTS).toEqual({
      "lm-studio": "http://127.0.0.1:1234/v1",
      "llama-cpp": "http://127.0.0.1:8080/v1",
    });

    for (const presetId of LOCAL_OPENAI_PRESET_IDS) {
      const endpoint = LOCAL_OPENAI_PRESET_ENDPOINTS[presetId];
      expect(
        ClientConfigurationInputSchema.parse({
          transportFamily: "local-http",
          productId: "local-openai",
          endpoint,
          authentication: "none",
          presetId,
        }),
      ).toEqual({
        transportFamily: "local-http",
        productId: "local-openai",
        endpoint,
        authentication: "none",
        presetId,
      });
    }
  });

  it("rejects a mismatched local-openai preset and an Ollama preset", () => {
    expect(
      ClientConfigurationInputSchema.safeParse({
        transportFamily: "local-http",
        productId: "local-openai",
        endpoint: LOCAL_OPENAI_PRESET_ENDPOINTS["llama-cpp"],
        authentication: "none",
        presetId: "lm-studio",
      }).success,
    ).toBe(false);
    expect(
      ClientConfigurationInputSchema.safeParse({
        ...localHttpInput,
        presetId: "lm-studio",
      }).success,
    ).toBe(false);
  });

  it("rejects control characters in opaque region and workspace references", () => {
    const controlCharacters = [
      "\u0000",
      "\u0007",
      "\u0009",
      "\u000a",
      "\u000d",
      "\u001b",
      "\u001f",
      "\u007f",
      "\u0085",
      "\u009f",
      "\u2028",
      "\u2029",
    ];

    for (const controlCharacter of controlCharacters) {
      expect(
        ClientConfigurationInputSchema.safeParse({
          ...hostedInput,
          workspace: `workspace${controlCharacter}reference`,
        }).success,
      ).toBe(false);
      expect(
        ClientConfigurationInputSchema.safeParse({
          ...hostedInput,
          region: `international${controlCharacter}`,
        }).success,
      ).toBe(false);
    }
  });

  it("keeps printable opaque references and exact normalized tuples valid", () => {
    const input = {
      ...hostedInput,
      workspace: "référence-équipe_01",
    } as const;
    expect(ClientConfigurationInputSchema.parse(input)).toEqual(input);
    expect(HostedApiEndpointSchema.parse(input.endpoint)).toBe(input.endpoint);
  });
});
