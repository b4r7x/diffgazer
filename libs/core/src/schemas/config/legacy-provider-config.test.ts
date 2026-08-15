import { describe, expect, it } from "vitest";
import {
  ConfigurationListResponseSchema,
  ConfigurationStatusSchema,
  decodeLegacyProviderConfigurationRecord,
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
      unrecognizedConfigurations: [],
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
    expect(
      decodeLegacyProviderConfigurationRecord(encoder.encode(JSON.stringify(legacyRecord))),
    ).toEqual({ status: "migrate-v1", record: legacyRecord });
  });

  it("rejects duplicate provider keys instead of relabeling one provider as another", () => {
    const rawBytes = encoder.encode(
      '{"provider":"gemini","provider":"zai","hasApiKey":true,"isActive":true}',
    );

    expect(decodeLegacyProviderConfigurationRecord(rawBytes)).toEqual({
      status: "unknown",
      rawBytes,
    });
  });

  it("preserves unknown bytes through the public decoder contract", () => {
    const rawBytes = encoder.encode(
      '{ "schemaVersion" : 9, "future" : [3, 2, 1], "spacing" : true }\n',
    );
    const decoded = decodeLegacyProviderConfigurationRecord(rawBytes);

    expect(decoded).toEqual({ status: "unknown", rawBytes });
    rawBytes.fill(0);
    expect(decoded.status === "unknown" ? decoded.rawBytes : null).toEqual(
      encoder.encode('{ "schemaVersion" : 9, "future" : [3, 2, 1], "spacing" : true }\n'),
    );
  });

  // The decoder's own per-record limits: 64 KiB, fatal UTF-8, and JSON depth 32.
  const oversizedRecord = () => {
    const padding = "x".repeat(64 * 1024);
    return encoder.encode(
      `{"provider":"gemini","hasApiKey":true,"isActive":true,"model":"${padding}"}`,
    );
  };
  const tooDeepRecord = () => encoder.encode(`${"[".repeat(33)}0${"]".repeat(33)}`);
  const malformedUtf8Record = () => Uint8Array.from([0x7b, 0xff, 0xfe, 0x7d]);

  it.each([
    { name: "a record over the 64 KiB byte limit", makeBytes: oversizedRecord },
    { name: "a record that is not valid UTF-8", makeBytes: malformedUtf8Record },
    { name: "a record nested deeper than the depth limit", makeBytes: tooDeepRecord },
  ])("fails closed to owned unknown bytes for $name", ({ makeBytes }) => {
    const rawBytes = makeBytes();
    const decoded = decodeLegacyProviderConfigurationRecord(rawBytes);

    expect(decoded.status).toBe("unknown");
    rawBytes.fill(0);
    expect(decoded.status === "unknown" ? decoded.rawBytes : null).toEqual(makeBytes());
  });
});
