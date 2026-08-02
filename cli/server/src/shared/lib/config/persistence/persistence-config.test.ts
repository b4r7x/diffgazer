import { chmod, readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { atomicWriteFile } from "../../fs.js";
import {
  decodeConfigV1,
  decodeConfigV2,
  loadConfigV2,
  selectConfigV2,
  serializeConfigV2,
} from "./config.js";
import { homePath, tempHome } from "./persistence.test-support.js";

import "./persistence.test-support.js";

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

const supportedRecord = {
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
  acknowledgement: { noticeVersion: 1, acceptedAt: "2026-07-31T12:00:00.000Z" },
  evidenceReference: "evidence-gemini-3",
  budget,
  createdAt: "2026-07-31T11:00:00.000Z",
  updatedAt: "2026-07-31T12:00:00.000Z",
} as const;

const removedRecord = {
  schemaVersion: 2,
  status: "removed",
  configurationId: "legacy-zai-coding",
  revision: 4,
  productId: "zai-coding",
  transportFamily: "hosted-api",
  selectedModelId: null,
  acknowledgement: null,
  evidenceReference: null,
  budget: null,
  createdAt: "2026-07-31T11:00:00.000Z",
  updatedAt: "2026-07-31T12:00:00.000Z",
} as const;

describe("V2 configuration persistence", () => {
  it("round-trips a V2 document byte-for-byte, including revisions, evidence, acknowledgement, and budgets", () => {
    const input = encoder.encode(
      `{"schemaVersion":2,"settings":{"futureSetting":{"keep":[3,2,1]},"theme":"dark"},"selectedConfigurationId":"gemini-primary","configurations":[${JSON.stringify(supportedRecord)}]}\n`,
    );

    const decoded = decodeConfigV2(input);
    expect(serializeConfigV2(decoded)).toEqual(input);
    expect(decoded.configurations[0]).toMatchObject({
      status: "supported",
      record: {
        configurationId: "gemini-primary",
        revision: 3,
        acknowledgement: { noticeVersion: 1 },
        evidenceReference: "evidence-gemini-3",
        budget,
      },
    });
  });

  it("preserves unknown record bytes and relative order after an unrelated selection update", () => {
    const firstUnknown = '{ "schemaVersion": 9, "future": [3, 2, 1], "order": "first" }';
    const secondUnknown = '{"schemaVersion":9,"future":{"order":"second"}}';
    const input = encoder.encode(
      `{"schemaVersion":2,"settings":{},"selectedConfigurationId":null,"configurations":[${firstUnknown},${JSON.stringify(supportedRecord)},${secondUnknown}]}`,
    );

    const updated = selectConfigV2(decodeConfigV2(input), "gemini-primary");
    const output = new TextDecoder().decode(serializeConfigV2(updated));
    expect(output).toContain(firstUnknown);
    expect(output).toContain(secondUnknown);
    expect(output.indexOf(firstUnknown)).toBeLessThan(output.indexOf(secondUnknown));
    expect(output).toContain('"selectedConfigurationId":"gemini-primary"');
  });

  it("decodes V1 hasApiKey only as an explicit migration record and classifies zai-coding as removed", () => {
    const input = encoder.encode(
      JSON.stringify({
        settings: { theme: "dark" },
        providers: [
          { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
          { provider: "zai-coding", hasApiKey: true, isActive: false },
        ],
      }),
    );

    const decoded = decodeConfigV1(input);
    expect(decoded.providers[0]).toMatchObject({
      status: "migrate-v1",
      record: { provider: "gemini", hasApiKey: true },
    });
    expect(decoded.providers[1]).toMatchObject({
      status: "removed",
      record: { provider: "zai-coding", hasApiKey: true },
    });
  });

  it("never emits hasApiKey in a V2 supported record", () => {
    const recordBytes = encoder.encode(JSON.stringify(supportedRecord));
    const document = decodeConfigV2(
      encoder.encode(
        `{"schemaVersion":2,"settings":{},"selectedConfigurationId":null,"configurations":[${new TextDecoder().decode(recordBytes)}]}`,
      ),
    );
    const output = new TextDecoder().decode(serializeConfigV2(document));
    expect(output).not.toContain("hasApiKey");
  });

  it("writes V2 atomically with restrictive permissions and loads the same document", async () => {
    const document = decodeConfigV2(
      encoder.encode(
        `{"schemaVersion":2,"settings":{},"selectedConfigurationId":null,"configurations":[${JSON.stringify(removedRecord)}]}`,
      ),
    );

    const path = homePath("config.json");
    await atomicWriteFile(path, new TextDecoder().decode(serializeConfigV2(document)), 0o600);
    const [written, metadata] = await Promise.all([readFile(path), stat(path)]);
    expect(new Uint8Array(written)).toEqual(serializeConfigV2(document));
    expect(metadata.mode & 0o777).toBe(0o600);
    await chmod(path, 0o600);
    expect(loadConfigV2().configurations[0]).toMatchObject({
      status: "removed",
      record: { productId: "zai-coding", revision: 4 },
    });
  });

  it("returns an empty V2 document when no config file exists", () => {
    expect(loadConfigV2()).toEqual({
      schemaVersion: 2,
      settings: {},
      selectedConfigurationId: null,
      configurations: [],
    });
    expect(tempHome).toBeTruthy();
  });
});
