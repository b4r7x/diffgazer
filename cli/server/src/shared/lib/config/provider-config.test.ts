import { describe, expect, it } from "vitest";
import {
  assertConfigurationIdentity,
  assertExpectedRevision,
  decodeProviderConfigurationFile,
  decodeProviderConfigurationRecord,
  encodeProviderConfigurationFile,
  ProviderConfigurationConflictError,
  type ProviderConfigurationFile,
  replaceProviderConfiguration,
  type SupportedProviderConfigurationRecord,
  SupportedProviderConfigurationRecordSchema,
  selectProviderConfiguration,
} from "./provider-config.js";

const encoder = new TextEncoder();

const budget = {
  inputTokens: 32_000,
  outputTokens: 8_000,
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
    noticeVersion: 1,
    acceptedAt: "2026-07-31T12:00:00.000Z",
  },
  evidenceReference: "evidence-gemini-3",
  budget,
  createdAt: "2026-07-31T11:00:00.000Z",
  updatedAt: "2026-07-31T12:00:00.000Z",
});

function fileWith(...records: ProviderConfigurationFile["records"]): ProviderConfigurationFile {
  return {
    schemaVersion: 2,
    selectedConfigurationId: null,
    records,
  };
}

describe("server V2 provider configuration records", () => {
  it("round-trips every supported non-secret field", () => {
    const record = supportedRecord();
    expect(SupportedProviderConfigurationRecordSchema.parse(record)).toEqual(record);

    const encoded = encodeProviderConfigurationFile(fileWith({ status: "supported", record }));
    const decoded = decodeProviderConfigurationFile(encoded);
    expect(decoded.records).toEqual([{ status: "supported", record }]);
    expect(decoded.selectedConfigurationId).toBeNull();
    expect(new TextDecoder().decode(encoded)).not.toContain("credential");
    expect(new TextDecoder().decode(encoded)).not.toContain("bearerToken");
  });

  it("preserves unknown raw bytes and their relative order through an unrelated update", () => {
    const firstUnknown = '{ "schemaVersion": 9, "future": [3, 2, 1], "order": "first" }';
    const secondUnknown = '{"schemaVersion":9,"future":{"order":"second"}}';
    const known = JSON.stringify(supportedRecord());
    const bytes = encoder.encode(
      `{"schemaVersion":2,"selectedConfigurationId":null,"configurations":[${firstUnknown},${known},${secondUnknown}]}`,
    );

    const decoded = decodeProviderConfigurationFile(bytes);
    const selected = selectProviderConfiguration(decoded, "gemini-primary");
    const serialized = new TextDecoder().decode(encodeProviderConfigurationFile(selected));
    const canonicalKnown = JSON.stringify(
      (decoded.records[1] as { status: "supported"; record: SupportedProviderConfigurationRecord })
        .record,
    );
    expect(serialized.indexOf(firstUnknown)).toBeLessThan(serialized.indexOf(canonicalKnown));
    expect(serialized.indexOf(canonicalKnown)).toBeLessThan(serialized.indexOf(secondUnknown));
    expect(serialized).toContain(firstUnknown);
    expect(serialized).toContain(secondUnknown);
    expect(selected.selectedConfigurationId).toBe("gemini-primary");
  });

  it("keeps an unrecognized record opaque and refuses to select it", () => {
    const unknown = '{"schemaVersion":2,"status":"experimental","configurationId":"future-config"}';
    expect(decodeProviderConfigurationRecord(encoder.encode(unknown)).status).toBe("unknown");

    const decodedFile = decodeProviderConfigurationFile(
      encoder.encode(
        `{"schemaVersion":2,"selectedConfigurationId":null,"configurations":[${unknown}]}`,
      ),
    );
    expect(new TextDecoder().decode(encodeProviderConfigurationFile(decodedFile))).toContain(
      unknown,
    );
    expect(() => selectProviderConfiguration(decodedFile, "future-config")).toThrow(
      ProviderConfigurationConflictError,
    );
  });

  it("rejects id and revision conflicts before replacing or selecting records", () => {
    const record = supportedRecord();
    expect(() => assertConfigurationIdentity(record, "other-id")).toThrow(
      ProviderConfigurationConflictError,
    );
    expect(() => assertExpectedRevision(record, 2)).toThrow(ProviderConfigurationConflictError);

    const file = fileWith({ status: "supported", record });
    const mismatched = { ...record, configurationId: "other-id" };
    expect(() =>
      replaceProviderConfiguration(
        file,
        { configurationId: record.configurationId, revision: 3 },
        mismatched,
      ),
    ).toThrow(ProviderConfigurationConflictError);
    expect(() => selectProviderConfiguration(file, "missing-id")).toThrow(
      ProviderConfigurationConflictError,
    );
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
