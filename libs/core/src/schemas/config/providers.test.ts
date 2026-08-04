import { describe, expect, it } from "vitest";
import {
  ConfigurationListResponseSchema,
  ConfigurationStatusSchema,
  decodeProviderConfigurationRecord,
  LegacyProviderConfigV1Schema,
} from "./index.js";

const encoder = new TextEncoder();

const hostedSummary = {
  configurationId: "configuration-1",
  revision: 1,
  status: "supported" as const,
  transportFamily: "hosted-api" as const,
  productId: "gemini" as const,
  endpoint: "https://generativelanguage.googleapis.com/v1beta",
  selectedModelId: "gemini-2.5-flash",
  notices: [],
  availableActions: ["inspect", "select", "test", "update", "delete"] as const,
};

const skippedReadiness = {
  status: "skipped" as const,
  ready: false as const,
  evidenceStatus: "skipped" as const,
  checkedAt: "2026-07-31T12:00:00.000Z",
  acknowledgement: { status: "not-applicable" as const },
  action: "test" as const,
  explanation: "The live readiness check was intentionally skipped." as const,
  remediation: {
    code: "enable-live-probe" as const,
    message: "Satisfy the live-check prerequisites, then test the configuration again." as const,
  },
};

describe("V2 provider configuration facade", () => {
  it("exposes no hasApiKey or secret field in V2 summaries", () => {
    const configurationStatus = ConfigurationStatusSchema.parse({
      configuration: hostedSummary,
      readiness: skippedReadiness,
    });
    const response = ConfigurationListResponseSchema.parse({
      schemaVersion: 2,
      configurations: [configurationStatus],
      selectedConfigurationId: hostedSummary.configurationId,
    });
    const serialized = JSON.stringify(response);

    expect(serialized).not.toContain("hasApiKey");
    expect(serialized).not.toContain("secret");
    expect(
      ConfigurationStatusSchema.safeParse({
        configuration: { ...hostedSummary, hasApiKey: true },
        readiness: skippedReadiness,
      }).success,
    ).toBe(false);
    expect(
      ConfigurationStatusSchema.safeParse({
        configuration: { ...hostedSummary, secret: "not-client-safe" },
        readiness: skippedReadiness,
      }).success,
    ).toBe(false);
  });
});

describe("legacy provider record decoder", () => {
  it("retains the explicit V1 migration shape for runnable providers", () => {
    const legacyRecord = {
      provider: "gemini",
      hasApiKey: true,
      isActive: true,
      model: "gemini-2.5-flash",
    };

    expect(LegacyProviderConfigV1Schema.parse(legacyRecord)).toEqual(legacyRecord);
    expect(decodeProviderConfigurationRecord(encoder.encode(JSON.stringify(legacyRecord)))).toEqual(
      { status: "migrate-v1", record: legacyRecord },
    );
  });

  it("rejects duplicate provider keys instead of relabeling one provider as another", () => {
    const rawBytes = encoder.encode(
      '{"provider":"gemini","provider":"zai","hasApiKey":true,"isActive":true}',
    );

    expect(decodeProviderConfigurationRecord(rawBytes)).toEqual({
      status: "unknown",
      rawBytes,
    });
  });

  it("preserves unknown bytes through the public decoder contract", () => {
    const rawBytes = encoder.encode(
      '{ "schemaVersion" : 9, "future" : [3, 2, 1], "spacing" : true }\n',
    );
    const decoded = decodeProviderConfigurationRecord(rawBytes);

    expect(decoded).toEqual({ status: "unknown", rawBytes });
    rawBytes.fill(0);
    expect(decoded.status === "unknown" ? decoded.rawBytes : null).toEqual(
      encoder.encode('{ "schemaVersion" : 9, "future" : [3, 2, 1], "spacing" : true }\n'),
    );
  });
});
