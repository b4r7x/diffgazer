import { readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { atomicWriteFile } from "../../fs.js";
import { homePath } from "./persistence.test-support.js";

const encoder = new TextEncoder();

describe("V2 secrets persistence", () => {
  it("binds secret references to configuration identity and revision", async () => {
    const { decodeSecretsV2, serializeSecretsV2 } = await import("./secrets.js");
    const input = encoder.encode(
      '{"schemaVersion":2,"bindings":[{"configurationId":"gemini-primary","revision":3,"status":"active","kind":"environment-reference","varName":"GOOGLE_API_KEY"}]}\n',
    );

    const document = decodeSecretsV2(input);

    expect(document.bindings[0]).toMatchObject({
      status: "supported",
      binding: { configurationId: "gemini-primary", revision: 3 },
    });
    expect(serializeSecretsV2(document)).toEqual(input);
    expect(new TextDecoder().decode(serializeSecretsV2(document))).toContain(
      '"configurationId":"gemini-primary","revision":3',
    );
  });

  it("bounds malformed JSON errors without exposing credential-like bytes", async () => {
    const { decodeSecretsV2 } = await import("./secrets.js");
    const sentinel = "Q7X";
    const malformed = encoder.encode(`{"schemaVersion":2,"bindings":[{"keyId":${sentinel}}]}`);

    let thrown: unknown;
    try {
      decodeSecretsV2(malformed);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ message: "Secrets file contains invalid JSON" });
    const message = String(thrown);
    expect(message).not.toContain(sentinel);
    expect(message).not.toContain("Unexpected token");
    expect(message).not.toContain("is not valid JSON");
    expect(message).not.toMatch(/Expected .+ at position/);
  });

  it("bounds schema errors without exposing credential-like bytes", async () => {
    const { serializeSecretsV2 } = await import("./secrets.js");
    const sentinel = "sk-schema-mutation-7d2a";
    const invalidDocument = {
      schemaVersion: 2,
      bindings: [
        {
          status: "supported",
          binding: {
            configurationId: sentinel,
            revision: 1,
            status: "active",
            kind: "keyring-reference",
            keyId: 1,
          },
          rawBytes: encoder.encode("{}"),
        },
      ],
    } as unknown as Parameters<typeof serializeSecretsV2>[0];

    let thrown: unknown;
    try {
      serializeSecretsV2(invalidDocument);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ message: "Secret binding is invalid" });
    expect(String(thrown)).not.toContain(sentinel);
  });

  it("bounds secret binding getter failures without exposing schema details", async () => {
    const { serializeSecretsV2 } = await import("./secrets.js");
    const sentinel = "sk-deep-getter-mutation-4c8e";
    const binding = {
      configurationId: "getter-binding",
      revision: 1,
      status: "active",
      kind: "keyring-reference",
      keyId: "placeholder",
    };
    Object.defineProperty(binding, "keyId", {
      enumerable: true,
      get: () => {
        throw new Error(sentinel);
      },
    });
    const invalidDocument = {
      schemaVersion: 2,
      bindings: [{ status: "supported", binding, rawBytes: encoder.encode("{}") }],
    } as unknown as Parameters<typeof serializeSecretsV2>[0];

    let thrown: unknown;
    try {
      serializeSecretsV2(invalidDocument);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ message: "Secret binding is invalid" });
    const message = String(thrown);
    expect(message).not.toContain(sentinel);
    expect(message).not.toContain("keyId");
    expect(message).not.toContain("invalid_type");
    expect(message).not.toContain("expected");
  });

  it("persists an active binding beside its removed tombstone", async () => {
    const { decodeSecretsV2, serializeSecretsV2 } = await import("./secrets.js");
    const active = {
      configurationId: "rotated-configuration",
      revision: 2,
      status: "active",
      kind: "keyring-reference",
      keyId: "new-key",
    };
    const removed = { ...active, status: "removed", keyId: "old-key" };

    const document = decodeSecretsV2(
      encoder.encode(JSON.stringify({ schemaVersion: 2, bindings: [active, removed] })),
    );

    expect(document.bindings.map((entry) => entry.status)).toEqual(["supported", "removed"]);
    expect(JSON.parse(new TextDecoder().decode(serializeSecretsV2(document))).bindings).toEqual([
      active,
      removed,
    ]);
  });

  it("finds the active binding regardless of tombstone order", async () => {
    const { decodeSecretsV2, findSecretBinding } = await import("./secrets.js");
    const active = {
      configurationId: "rotated-configuration",
      revision: 2,
      status: "active",
      kind: "keyring-reference",
      keyId: "new-key",
    };
    const removed = { ...active, status: "removed", keyId: "old-key" };

    for (const bindings of [
      [removed, active],
      [active, removed],
    ]) {
      const document = decodeSecretsV2(
        encoder.encode(JSON.stringify({ schemaVersion: 2, bindings })),
      );
      expect(findSecretBinding(document, "rotated-configuration", 2)).toEqual(active);
    }

    const removedOnly = decodeSecretsV2(
      encoder.encode(JSON.stringify({ schemaVersion: 2, bindings: [removed] })),
    );
    expect(findSecretBinding(removedOnly, "rotated-configuration", 2)).toBeNull();
  });

  it("rejects every duplicate identity except an active and removed pair", async () => {
    const { decodeSecretsV2 } = await import("./secrets.js");
    const makeBinding = (status: "active" | "unknown" | "removed", keyId: string) => ({
      configurationId: "duplicate-configuration",
      revision: 1,
      status,
      kind: "keyring-reference" as const,
      keyId,
    });
    const invalidPairs = [
      ["active", "active"],
      ["removed", "removed"],
      ["unknown", "unknown"],
      ["active", "unknown"],
      ["unknown", "active"],
      ["removed", "unknown"],
      ["unknown", "removed"],
    ] as const;

    for (const [firstStatus, secondStatus] of invalidPairs) {
      const bindings = [
        makeBinding(firstStatus, "first-key"),
        makeBinding(secondStatus, "second-key"),
      ];
      expect(() =>
        decodeSecretsV2(encoder.encode(JSON.stringify({ schemaVersion: 2, bindings }))),
      ).toThrow("Duplicate secret binding identity");
    }

    const threeBindings = [
      makeBinding("active", "first-key"),
      makeBinding("removed", "second-key"),
      makeBinding("active", "third-key"),
    ];
    expect(() =>
      decodeSecretsV2(
        encoder.encode(JSON.stringify({ schemaVersion: 2, bindings: threeBindings })),
      ),
    ).toThrow("Duplicate secret binding identity");
  });

  it("retains removed and unknown bindings verbatim", async () => {
    const { decodeSecretsV2, serializeSecretsV2 } = await import("./secrets.js");
    const removed = {
      configurationId: "legacy-configuration",
      revision: 4,
      status: "removed",
      kind: "keyring-reference",
      keyId: "private-keyring-location",
    };
    const unknown = {
      configurationId: "future-configuration",
      revision: 9,
      status: "active",
      kind: "future-secret-store",
      secret: "must-not-leak",
    };
    const document = decodeSecretsV2(
      encoder.encode(JSON.stringify({ schemaVersion: 2, bindings: [removed, unknown] })),
    );

    expect(document.bindings.map((binding) => binding.status)).toEqual(["removed", "unknown"]);
    const serialized = new TextDecoder().decode(serializeSecretsV2(document));
    expect(serialized).toContain("future-secret-store");
    expect(serialized).toContain("must-not-leak");
  });

  it("preserves unknown binding bytes and order when a known binding changes", async () => {
    const { decodeSecretsV2, serializeSecretsV2 } = await import("./secrets.js");
    const unknownBytes =
      '{ "futureB": 2, "configurationId": "future-configuration", "futureA": [3, 1] }';
    const known = {
      configurationId: "gemini-primary",
      revision: 3,
      status: "active",
      kind: "environment-reference",
      varName: "OLD_KEY",
    } as const;
    const input = encoder.encode(
      `{"schemaVersion":2,"bindings":[${unknownBytes},${JSON.stringify(known)}]}`,
    );
    const decoded = decodeSecretsV2(input);
    const unknownBinding = decoded.bindings[0];
    if (!unknownBinding) throw new Error("unknown binding fixture was not decoded");
    const updatedKnown = { ...known, varName: "NEW_KEY" };
    const updated = {
      ...decoded,
      bindings: [
        unknownBinding,
        {
          status: "supported" as const,
          binding: updatedKnown,
          rawBytes: decoded.bindings[1]?.rawBytes ?? encoder.encode("{}"),
        },
      ],
    };

    expect(new TextDecoder().decode(serializeSecretsV2(updated))).toBe(
      `{"schemaVersion":2,"bindings":[${unknownBytes},${JSON.stringify(updatedKnown)}]}\n`,
    );
  });

  it("loads back a document written with the V2 codec", async () => {
    const { decodeSecretsV2, serializeSecretsV2 } = await import("./secrets.js");
    const document = decodeSecretsV2(
      encoder.encode(
        '{"schemaVersion":2,"bindings":[{"configurationId":"config-a","revision":2,"status":"active","kind":"none"}]}',
      ),
    );

    const path = homePath("secrets.json");
    await atomicWriteFile(path, new TextDecoder().decode(serializeSecretsV2(document)), 0o600);

    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(decodeSecretsV2(new Uint8Array(await readFile(path))).bindings[0]).toMatchObject({
      binding: { configurationId: "config-a", revision: 2, kind: "none" },
    });
  });
});

describe("V1 secrets decoder", () => {
  it("decodes literal and provider-owned environment entries", async () => {
    const { decodeSecretsV1 } = await import("./secrets.js");
    const bytes = encoder.encode(
      JSON.stringify({
        providers: {
          gemini: "key-123",
          zai: "env",
          groq: { kind: "env", varName: "GROQ_API_KEY" },
        },
      }),
    );

    expect(decodeSecretsV1(bytes)).toEqual({
      providers: {
        gemini: "key-123",
        zai: { kind: "env", varName: "ZAI_API_KEY" },
        groq: { kind: "env", varName: "GROQ_API_KEY" },
      },
    });
  });

  it.each([
    ["malformed JSON", "{credential-sentinel:not-json"],
    ["unknown provider", JSON.stringify({ providers: { future: "credential-sentinel" } })],
    ["duplicate provider key", '{"providers":{"gemini":"first","gemini":"credential-sentinel"}}'],
    [
      "unknown reference",
      JSON.stringify({ providers: { gemini: { kind: "vault", path: "credential-sentinel" } } }),
    ],
    ["unknown root data", JSON.stringify({ providers: {}, future: "credential-sentinel" })],
  ])("fails closed for %s without disclosing or changing input", async (_label, input) => {
    const { decodeSecretsV1 } = await import("./secrets.js");
    const bytes = encoder.encode(input);
    const original = new Uint8Array(bytes);

    expect(() => decodeSecretsV1(bytes)).toThrow("Legacy configuration requires manual migration");
    try {
      decodeSecretsV1(bytes);
    } catch (error) {
      expect(String(error)).not.toContain("credential-sentinel");
    }
    expect(bytes).toEqual(original);
  });
});
