import { getEndpointPoolContext, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { describe, expect, it } from "vitest";
import { decodeConfigV2, selectConfigV2, serializeConfigV2 } from "./persistence/config.js";
import {
  decodeProviderConfigurationRecord,
  ProviderConfigurationConflictError,
  type SupportedProviderConfigurationRecord,
  SupportedProviderConfigurationRecordSchema,
} from "./provider-config.js";

const encoder = new TextEncoder();

const budget = {
  inputTokens: 32_000,
  responseBytes: 65_536,
  wallTimeMs: 60_000,
  retries: 2,
  concurrency: 1,
  perReview: 40_000,
};

const supportedRecord = (): SupportedProviderConfigurationRecord => ({
  schemaVersion: 2,
  status: "supported",
  configurationId: "gemini-primary",
  revision: 3,
  productId: "gemini",
  transportFamily: "hosted-api",
  input: {
    transportFamily: "hosted-api",
    productId: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
  },
  selectedModelId: "gemini-2.5-flash",
  acknowledgement: {
    noticeId: "gemini-hosted-api",
    noticeVersion: 1,
    acceptedAt: "2026-07-31T12:00:00.000Z",
  },
  evidenceReference: "evidence-gemini-3",
  budget,
  createdAt: "2026-07-31T11:00:00.000Z",
  updatedAt: "2026-07-31T12:00:00.000Z",
});

describe("server V2 provider configuration records", () => {
  it("round-trips every supported non-secret field", () => {
    const record = supportedRecord();
    expect(SupportedProviderConfigurationRecordSchema.parse(record)).toEqual(record);

    const input = encoder.encode(
      `{"schemaVersion":2,"settings":{},"selectedConfigurationId":null,"configurations":[${JSON.stringify(record)}]}\n`,
    );
    const decoded = decodeConfigV2(input);
    expect(decoded.configurations[0]).toMatchObject({ status: "supported", record });
    expect(decoded.selectedConfigurationId).toBeNull();
    const encoded = serializeConfigV2(decoded);
    expect(new TextDecoder().decode(encoded)).not.toContain("credential");
    expect(new TextDecoder().decode(encoded)).not.toContain("bearerToken");
  });

  it("preserves unknown raw bytes and their relative order through an unrelated update", () => {
    const firstUnknown = '{ "schemaVersion": 9, "future": [3, 2, 1], "order": "first" }';
    const secondUnknown = '{"schemaVersion":9,"future":{"order":"second"}}';
    const known = JSON.stringify(supportedRecord());
    const bytes = encoder.encode(
      `{"schemaVersion":2,"settings":{},"selectedConfigurationId":null,"configurations":[${firstUnknown},${known},${secondUnknown}]}`,
    );

    const decoded = decodeConfigV2(bytes);
    const selected = selectConfigV2(decoded, "gemini-primary");
    const serialized = new TextDecoder().decode(serializeConfigV2(selected));
    expect(serialized).toContain(firstUnknown);
    expect(serialized).toContain(secondUnknown);
    expect(serialized.indexOf(firstUnknown)).toBeLessThan(serialized.indexOf(secondUnknown));
    expect(selected.selectedConfigurationId).toBe("gemini-primary");
  });

  it("keeps an unrecognized record opaque and refuses to select it", () => {
    const unknown = '{"schemaVersion":2,"status":"experimental","configurationId":"future-config"}';
    expect(decodeProviderConfigurationRecord(encoder.encode(unknown)).status).toBe("unknown");

    const decodedFile = decodeConfigV2(
      encoder.encode(
        `{"schemaVersion":2,"settings":{},"selectedConfigurationId":null,"configurations":[${unknown}]}`,
      ),
    );
    expect(new TextDecoder().decode(serializeConfigV2(decodedFile))).toContain(unknown);
    expect(() => selectConfigV2(decodedFile, "future-config")).toThrow(
      ProviderConfigurationConflictError,
    );
  });

  it("backfills a missing acknowledgement noticeId from the product registry", () => {
    const legacyRecord = {
      schemaVersion: 2,
      status: "supported",
      configurationId: "cfg-v1-zai",
      revision: 1,
      productId: "zai",
      transportFamily: "hosted-api",
      input: {
        transportFamily: "hosted-api",
        productId: "zai",
        endpoint: "https://api.z.ai/api/paas/v4",
      },
      selectedModelId: null,
      acknowledgement: { noticeVersion: 1, acceptedAt: null },
      evidenceReference: null,
      budget,
      createdAt: "2026-07-31T11:00:00.000Z",
      updatedAt: "2026-07-31T12:00:00.000Z",
    };

    const decoded = decodeProviderConfigurationRecord(encoder.encode(JSON.stringify(legacyRecord)));
    expect(decoded.status).toBe("supported");
    if (decoded.status !== "supported") return;
    expect(decoded.record.acknowledgement).toEqual({
      noticeId: PRODUCT_REGISTRY.zai.notice.id,
      noticeVersion: 1,
      acceptedAt: null,
    });

    const unknownProduct = decodeProviderConfigurationRecord(
      encoder.encode(JSON.stringify({ ...legacyRecord, productId: "retired-product" })),
    );
    expect(unknownProduct.status).toBe("unknown");
  });

  it("strips the retired outputTokens budget from a persisted record on read", () => {
    const persisted = { ...supportedRecord(), budget: { ...budget, outputTokens: 8_192 } };

    const decoded = decodeProviderConfigurationRecord(encoder.encode(JSON.stringify(persisted)));
    expect(decoded.status).toBe("supported");
    if (decoded.status !== "supported") return;
    expect(decoded.record.budget).toEqual(budget);
    expect("outputTokens" in decoded.record.budget).toBe(false);
  });

  it.each([
    [0, 1],
    [2, 2],
  ])("floors a persisted retries: %i budget to %i on read", (persistedRetries, expectedRetries) => {
    const persisted = { ...supportedRecord(), budget: { ...budget, retries: persistedRetries } };

    const decoded = decodeProviderConfigurationRecord(encoder.encode(JSON.stringify(persisted)));
    expect(decoded.status).toBe("supported");
    if (decoded.status !== "supported") return;
    expect(decoded.record.budget).toEqual({ ...budget, retries: expectedRetries });
  });

  it("decodes a legacy qwen record carrying region and workspace transport fields to unknown", () => {
    // Written by a build whose qwen transport still bound region/workspace; the
    // strict transport input schema rejects the extra keys instead of parsing a
    // shape this build cannot honor.
    const legacyQwen = {
      ...supportedRecord(),
      configurationId: "qwen-legacy",
      productId: "qwen",
      input: {
        transportFamily: "hosted-api",
        productId: "qwen",
        endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        region: "international",
        workspace: "ws-default",
      },
      selectedModelId: "qwen3-coder-flash",
      acknowledgement: {
        noticeId: "qwen-international-payg",
        noticeVersion: 1,
        acceptedAt: "2026-07-31T12:00:00.000Z",
      },
      evidenceReference: null,
    };

    const decoded = decodeProviderConfigurationRecord(encoder.encode(JSON.stringify(legacyQwen)));
    expect(decoded.status).toBe("unknown");
    if (decoded.status !== "unknown") return;
    expect(decoded.configurationId).toBe("qwen-legacy");
  });

  it("parses an opencode-zen record written before pool support and adds no persisted field", () => {
    // A record in the shape a pre-pool build wrote: pool membership is derived
    // from the already-persisted endpoint, so the shape must still be the one
    // this build writes and reads back unchanged.
    const prePoolRecord = {
      schemaVersion: 2,
      status: "supported",
      configurationId: "opencode-primary",
      revision: 4,
      productId: "opencode-zen",
      transportFamily: "hosted-api",
      input: {
        transportFamily: "hosted-api",
        productId: "opencode-zen",
        endpoint: "https://opencode.ai/zen/v1",
      },
      selectedModelId: "deepseek-v4-flash",
      acknowledgement: {
        noticeId: "opencode-zen-hosted-api",
        noticeVersion: 2,
        acceptedAt: "2026-07-31T12:00:00.000Z",
      },
      evidenceReference: "evidence-opencode-4",
      budget,
      createdAt: "2026-07-31T11:00:00.000Z",
      updatedAt: "2026-07-31T12:00:00.000Z",
    };

    const decoded = decodeProviderConfigurationRecord(
      encoder.encode(JSON.stringify(prePoolRecord)),
    );
    expect(decoded.status).toBe("supported");
    if (decoded.status !== "supported") return;
    expect(decoded.record).toEqual(prePoolRecord);
    expect(Object.keys(SupportedProviderConfigurationRecordSchema.shape).sort()).toEqual([
      "acknowledgement",
      "budget",
      "configurationId",
      "createdAt",
      "evidenceReference",
      "input",
      "productId",
      "revision",
      "schemaVersion",
      "selectedModelId",
      "status",
      "transportFamily",
      "updatedAt",
    ]);
    expect(Object.keys(decoded.record.input).sort()).toEqual([
      "endpoint",
      "productId",
      "transportFamily",
    ]);
  });

  it("reads a go-bound opencode-zen record exactly like a zen-bound one", () => {
    // The pool is the persisted endpoint and nothing else: a Go-bound record
    // differs from a Zen-bound one in that one string, and the pool it bills is
    // derived back out of it on read rather than stored beside it.
    const goRecord = {
      ...supportedRecord(),
      configurationId: "opencode-go",
      productId: "opencode-zen",
      input: {
        transportFamily: "hosted-api",
        productId: "opencode-zen",
        endpoint: "https://opencode.ai/zen/go/v1",
      },
      // A model both pools serve, so the paired zen record below is a
      // combination that can really exist.
      selectedModelId: "deepseek-v4-flash",
      acknowledgement: {
        noticeId: "opencode-zen-hosted-api",
        noticeVersion: 2,
        acceptedAt: "2026-07-31T12:00:00.000Z",
      },
      evidenceReference: "evidence-opencode-go-4",
    };
    const zenRecord = {
      ...goRecord,
      input: { ...goRecord.input, endpoint: "https://opencode.ai/zen/v1" },
    };

    const go = decodeProviderConfigurationRecord(encoder.encode(JSON.stringify(goRecord)));
    const zen = decodeProviderConfigurationRecord(encoder.encode(JSON.stringify(zenRecord)));
    expect(go.status).toBe("supported");
    expect(zen.status).toBe("supported");
    if (go.status !== "supported" || zen.status !== "supported") return;
    expect(go.record).toEqual(goRecord);
    expect(go.record).toEqual({
      ...zen.record,
      input: { ...zen.record.input, endpoint: goRecord.input.endpoint },
    });
    // The derivation the round-trip exists to protect: the same two records
    // report the pool they bill purely from the endpoint they stored.
    expect(
      getEndpointPoolContext(go.record.input.productId, go.record.input.endpoint)?.bound.id,
    ).toBe("go");
    expect(
      getEndpointPoolContext(zen.record.input.productId, zen.record.input.endpoint)?.bound.id,
    ).toBe("zen");
  });

  it("does not accept a supported record carrying secret input", () => {
    expect(
      SupportedProviderConfigurationRecordSchema.safeParse({
        ...supportedRecord(),
        input: { ...supportedRecord().input, credential: { kind: "literal", value: "secret" } },
      }).success,
    ).toBe(false);
  });
});
