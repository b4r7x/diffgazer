import { chmod, readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { atomicWriteFile } from "../../fs.js";
import {
  decodeConfigFile,
  decodeConfigV1,
  decodeConfigV2,
  parseSettingsRecord,
  selectConfigV2,
  serializeConfigV2,
} from "./config.js";
import { homePath } from "./persistence.test-support.js";

const encoder = new TextEncoder();

const collectStrings = (value: unknown, seen = new WeakSet<object>()): string[] => {
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object" || seen.has(value)) return [];

  seen.add(value);
  const strings: string[] = [];
  if (value instanceof Error) {
    strings.push(value.name, value.message);
    if (value.stack) strings.push(value.stack);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "string") strings.push(key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) {
      strings.push(...collectStrings(descriptor.value, seen));
    }
  }
  return strings;
};

const captureError = (action: () => unknown): Error => {
  try {
    action();
  } catch (cause) {
    if (cause instanceof Error) return cause;
  }
  throw new Error("Expected action to throw an Error");
};

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
  acknowledgement: {
    noticeId: "gemini-hosted-api",
    noticeVersion: 1,
    acceptedAt: "2026-07-31T12:00:00.000Z",
  },
  evidenceReference: "evidence-gemini-3",
  budget,
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
        acknowledgement: { noticeId: "gemini-hosted-api", noticeVersion: 1 },
        evidenceReference: "evidence-gemini-3",
        budget,
      },
    });
  });

  it("decodes a pre-noticeId document as supported and round-trips it byte-identically", () => {
    const legacyRecord = {
      ...supportedRecord,
      configurationId: "cfg-v1-groq",
      productId: "groq",
      input: {
        transportFamily: "hosted-api",
        productId: "groq",
        endpoint: "https://api.groq.com/openai/v1",
      },
      selectedModelId: null,
      acknowledgement: { noticeVersion: 1, acceptedAt: "2026-08-10T09:00:00.000Z" },
      evidenceReference: null,
    };
    const removedRecord =
      '{"schemaVersion":2,"status":"removed","configurationId":"cfg-v1-retired"}';
    const input = encoder.encode(
      `{"schemaVersion":2,"settings":{},"selectedConfigurationId":"cfg-v1-groq","configurations":[${JSON.stringify(legacyRecord)},${removedRecord}]}\n`,
    );

    const decoded = decodeConfigFile(input);
    expect(decoded.schemaVersion).toBe(2);
    if (decoded.schemaVersion !== 2) return;
    expect(decoded.selectedConfigurationId).toBe("cfg-v1-groq");
    expect(decoded.configurations[0]).toMatchObject({
      status: "supported",
      record: {
        configurationId: "cfg-v1-groq",
        acknowledgement: {
          noticeId: "groq-hosted-api",
          noticeVersion: 1,
          acceptedAt: "2026-08-10T09:00:00.000Z",
        },
      },
    });
    expect(decoded.configurations[1]?.status).toBe("unknown");
    expect(serializeConfigV2(decoded)).toEqual(input);
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

  it("decodes supported V1 hasApiKey only as an explicit migration record", () => {
    const input = encoder.encode(
      JSON.stringify({
        settings: { theme: "dark" },
        providers: [
          { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
        ],
      }),
    );

    const decoded = decodeConfigV1(input);
    expect(decoded.providers[0]).toMatchObject({
      status: "migrate-v1",
      record: { provider: "gemini", hasApiKey: true },
    });
  });

  it("rejects unknown V1 records with one fixed migration diagnostic", () => {
    const sentinel = "future-provider-attacker-value";
    const input = encoder.encode(
      JSON.stringify({
        settings: {},
        providers: [{ provider: sentinel, hasApiKey: true, isActive: false }],
      }),
    );

    const cause = captureError(() => decodeConfigV1(input));

    expect(cause.message).toBe("Legacy configuration requires manual migration");
    expect(collectStrings(cause).join("\n")).not.toContain(sentinel);
  });

  it("rejects V1 root data that cannot be represented in V2", () => {
    const input = encoder.encode(
      JSON.stringify({ settings: {}, providers: [], futureState: { mustRemain: true } }),
    );

    expect(() => decodeConfigV1(input)).toThrow("Legacy configuration requires manual migration");
  });

  it.each([
    ['{"schemaVersion":1,"schema\\u0056ersion":2,"settings":{},"providers":[]}', "schemaVersion"],
    ['{"settings":{"theme":"dark","th\\u0065me":"light"},"providers":[]}', "theme"],
    [
      '{"settings":{},"providers":[{"provider":"gemini","hasApiKey":true,"has\\u0041piKey":false,"isActive":true,"model":"gemini-2.5-flash"}]}',
      "hasApiKey",
    ],
  ])("rejects nested and escaped-equivalent V1 duplicate keys through version dispatch", (raw, sentinel) => {
    const cause = captureError(() => decodeConfigFile(encoder.encode(raw)));

    expect(cause.message).toBe("Legacy configuration requires manual migration");
    const errorText = collectStrings(cause).join("\n");
    expect(errorText).not.toContain(sentinel);
    expect(errorText).not.toContain("position");
  });

  it.each([
    {
      name: "settings",
      raw: '{"settings":{"schemaVersion":2,"credential-sentinel":"first","credential\\u002dsentinel":"second"},"providers":[]}',
    },
    {
      name: "provider",
      raw: '{"settings":{},"providers":[{"schemaVersion":2,"provider":"gemini","hasApiKey":false,"has\\u0041piKey":true,"isActive":false}]}',
    },
    {
      name: "future value",
      raw: '{"settings":{},"providers":[],"future":{"schemaVersion":2,"future-sentinel":1,"future\\u002dsentinel":2}}',
    },
  ])("classifies a V1-shaped document with a nested V2 marker and duplicate $name data as V1", ({
    raw,
  }) => {
    const input = encoder.encode(raw);
    const original = new Uint8Array(input);

    const cause = captureError(() => decodeConfigFile(input));

    expect(cause.message).toBe("Legacy configuration requires manual migration");
    expect(input).toEqual(original);
    const errorText = collectStrings(cause).join("\n");
    for (const sentinel of [
      "credential-sentinel",
      "future-sentinel",
      "hasApiKey",
      "Unexpected token",
      "position",
    ]) {
      expect(errorText).not.toContain(sentinel);
    }
  });

  it.each([
    '{"schemaVersion":1,"schemaVersion":2,"settings":{},"providers":[]}',
    '{"schemaVersion":2,"schema\\u0056ersion":1,"settings":{},"providers":[]}',
    '{"schemaVersion":2,"schemaVersion":2,"settings":{},"providers":[]}',
  ])("classifies duplicate top-level version claims as V1 migration failures", (raw) => {
    const input = encoder.encode(raw);
    const original = new Uint8Array(input);

    const cause = captureError(() => decodeConfigFile(input));

    expect(cause.message).toBe("Legacy configuration requires manual migration");
    expect(input).toEqual(original);
    expect(collectStrings(cause).join("\n")).not.toContain("schemaVersion");
  });

  it("uses the unique top-level version instead of nested version values", () => {
    const input = encoder.encode(
      JSON.stringify({
        schemaVersion: 2,
        settings: { schemaVersion: 1 },
        selectedConfigurationId: null,
        configurations: [],
      }),
    );

    expect(decodeConfigFile(input)).toMatchObject({ schemaVersion: 2, configurations: [] });
  });

  it("rejects a config file that is not valid UTF-8 without touching its bytes", () => {
    const input = new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]);
    const original = new Uint8Array(input);

    const cause = captureError(() => decodeConfigFile(input));

    expect(cause.message).toBe("Configuration file is not valid UTF-8");
    expect(input).toEqual(original);
  });

  it("classifies duplicate nested data under a unique top-level V2 marker as invalid V2", () => {
    const raw =
      '{"schemaVersion":2,"settings":{"secret-sentinel":"first","secret\\u002dsentinel":"second"},"selectedConfigurationId":null,"configurations":[]}';
    const input = encoder.encode(raw);
    const original = new Uint8Array(input);

    const cause = captureError(() => decodeConfigFile(input));

    expect(cause.message).toBe("Configuration file contains invalid JSON");
    expect(input).toEqual(original);
    const errorText = collectStrings(cause).join("\n");
    expect(errorText).not.toContain("secret-sentinel");
    expect(errorText).not.toContain("duplicate");
    expect(errorText).not.toContain("position");
  });

  it("keeps a unique top-level V2 marker when another root property is duplicated", () => {
    const raw =
      '{"schemaVersion":2,"settings":{"secret-sentinel":1},"s\\u0065ttings":{},"selectedConfigurationId":null,"configurations":[]}';

    const cause = captureError(() => decodeConfigFile(encoder.encode(raw)));

    expect(cause.message).toBe("Configuration file contains invalid JSON");
    expect(collectStrings(cause).join("\n")).not.toContain("secret-sentinel");
  });

  it("finds a unique top-level V2 marker after another duplicate root property", () => {
    const raw =
      '{"settings":{"secret-sentinel":1},"s\\u0065ttings":{},"schemaVersion":2,"selectedConfigurationId":null,"configurations":[]}';

    const cause = captureError(() => decodeConfigFile(encoder.encode(raw)));

    expect(cause.message).toBe("Configuration file contains invalid JSON");
    expect(collectStrings(cause).join("\n")).not.toContain("secret-sentinel");
  });

  it("recognizes an escaped unique top-level V2 marker", () => {
    const raw =
      '{"schema\\u0056ersion":2,"settings":{"secret-sentinel":1,"secret\\u002dsentinel":2},"selectedConfigurationId":null,"configurations":[]}';

    const cause = captureError(() => decodeConfigFile(encoder.encode(raw)));

    expect(cause.message).toBe("Configuration file contains invalid JSON");
    expect(collectStrings(cause).join("\n")).not.toContain("secret-sentinel");
  });

  it("keeps a unique top-level V2 marker when later JSON is unclosed", () => {
    const complete = JSON.stringify({
      schemaVersion: 2,
      settings: { credential: "secret-sentinel" },
      selectedConfigurationId: null,
      configurations: [],
    });
    const input = encoder.encode(complete.slice(0, complete.indexOf('"secret-sentinel"')));
    const original = new Uint8Array(input);

    const cause = captureError(() => decodeConfigFile(input));

    expect(cause.message).toBe("Configuration file contains invalid JSON");
    expect(input).toEqual(original);
    expect(collectStrings(cause).join("\n")).not.toContain("secret-sentinel");
  });

  it("allows the same property name in sibling V1 objects", () => {
    const input = encoder.encode(
      JSON.stringify({
        settings: { first: { shared: 1 }, second: { shared: 2 } },
        providers: [],
      }),
    );

    expect(decodeConfigFile(input)).toMatchObject({
      schemaVersion: 1,
      settings: { first: { shared: 1 }, second: { shared: 2 } },
    });
  });

  it("bounds malformed V1 dispatch errors without native JSON, path, or input detail", () => {
    const sentinel = "credential-sentinel";
    const absolutePath = "/private/credential/path";
    const complete = JSON.stringify({
      settings: { path: absolutePath },
      providers: [{ secret: sentinel }],
    });
    const input = encoder.encode(complete.replace(JSON.stringify(sentinel), sentinel));

    const cause = captureError(() => decodeConfigFile(input));

    expect(cause.message).toBe("Legacy configuration requires manual migration");
    const errorText = collectStrings(cause).join("\n");
    expect(errorText).not.toContain(sentinel);
    expect(errorText).not.toContain(absolutePath);
    expect(errorText).not.toContain("Unexpected token");
    expect(errorText).not.toContain("position");
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
        `{"schemaVersion":2,"settings":{},"selectedConfigurationId":null,"configurations":[${JSON.stringify(supportedRecord)}]}`,
      ),
    );

    const path = homePath("config.json");
    await atomicWriteFile(path, new TextDecoder().decode(serializeConfigV2(document)), 0o600);
    const [written, metadata] = await Promise.all([readFile(path), stat(path)]);
    expect(new Uint8Array(written)).toEqual(serializeConfigV2(document));
    expect(metadata.mode & 0o777).toBe(0o600);
    await chmod(path, 0o600);
    expect(decodeConfigV2(new Uint8Array(written)).configurations[0]).toMatchObject({
      status: "supported",
      record: { productId: "gemini", revision: 3 },
    });
  });

  it("round-trips prototype-named settings keys into unknown instead of throwing", () => {
    const raw = JSON.parse(
      '{"__proto__":{"theme":"dark"},"theme":"dark","constructor":1}',
    ) as Record<string, unknown>;
    const parsed = parseSettingsRecord(raw);
    expect(parsed.settings.theme).toBe("dark");
    expect(Object.hasOwn(parsed.unknown, "__proto__")).toBe(true);
    expect(Object.hasOwn(parsed.unknown, "constructor")).toBe(true);
    expect(parsed.unknown.__proto__).toEqual({ theme: "dark" });
    expect(parsed.unknown.constructor).toBe(1);

    const roundTripped = parseSettingsRecord({
      ...parsed.unknown,
      ...parsed.settings,
    });
    expect(Object.hasOwn(roundTripped.unknown, "__proto__")).toBe(true);
    expect(roundTripped.unknown.__proto__).toEqual({ theme: "dark" });
    expect(roundTripped.settings.theme).toBe("dark");
  });

  it("preserves malformed known settings values with diagnostics", () => {
    const parsed = parseSettingsRecord({
      theme: "auto",
      agentExecution: "turbo",
    });

    expect(parsed.settings.agentExecution).toBe("sequential");
    expect(parsed.unknown.agentExecution).toBe("turbo");
    expect(parsed.diagnostics).toEqual([{ field: "agentExecution", code: "invalid-value" }]);
  });
});
