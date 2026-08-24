import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
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
      configurationId: "cfg-v1-groq",
      revision: 1,
      productId: "groq",
      transportFamily: "hosted-api",
      input: {
        transportFamily: "hosted-api",
        productId: "groq",
        endpoint: "https://api.groq.com/openai/v1",
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
      noticeId: PRODUCT_REGISTRY.groq.notice.id,
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

  it("does not accept a supported record carrying secret input", () => {
    expect(
      SupportedProviderConfigurationRecordSchema.safeParse({
        ...supportedRecord(),
        input: { ...supportedRecord().input, credential: { kind: "literal", value: "secret" } },
      }).success,
    ).toBe(false);
  });
});
