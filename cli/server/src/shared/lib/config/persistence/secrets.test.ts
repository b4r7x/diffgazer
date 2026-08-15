import * as fs from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { atomicWriteFile } from "../../fs.js";
import { homePath, tempHome } from "./persistence.test-support.js";

const { mockLog } = vi.hoisted(() => ({ mockLog: vi.fn() }));

// The structured logger is silent under Vitest, so assert the diagnostic fields
// at its process-visible boundary while keeping the client error opaque.
vi.mock("../../log.js", () => ({ log: mockLog }));
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    closeSync: actual.closeSync.bind(actual),
    fsyncSync: actual.fsyncSync.bind(actual),
    openSync: actual.openSync.bind(actual),
    unlinkSync: actual.unlinkSync.bind(actual),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

const encoder = new TextEncoder();

/**
 * The store reads the journal, clears blocked-V1 dominance, and only then
 * restores under both transaction locks. These tests own the restore half, so
 * they compose the same two exports instead of a shortcut that skips the gate.
 */
const restoreRecordedRecovery = async () => {
  const { readDocumentRecovery, restoreDocumentRecovery } = await import("./secrets-recovery.js");
  const recovery = readDocumentRecovery();
  if (recovery.kind !== "valid") throw new Error(`Recovery record is ${recovery.kind}`);
  return restoreDocumentRecovery(recovery.record);
};

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
    const { decodeSecretsV2, loadSecretsV2, serializeSecretsV2 } = await import("./secrets.js");
    const document = decodeSecretsV2(
      encoder.encode(
        '{"schemaVersion":2,"bindings":[{"configurationId":"config-a","revision":2,"status":"active","kind":"none"}]}',
      ),
    );

    const path = homePath("secrets.json");
    await atomicWriteFile(path, new TextDecoder().decode(serializeSecretsV2(document)), 0o600);

    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(loadSecretsV2().bindings[0]).toMatchObject({
      binding: { configurationId: "config-a", revision: 2, kind: "none" },
    });
  });

  it("returns an empty V2 document when no secrets file exists", async () => {
    const { loadSecretsV2 } = await import("./secrets.js");
    expect(loadSecretsV2()).toEqual({ schemaVersion: 2, bindings: [] });
  });

  it("resolves the secrets path per call so a changed DIFFGAZER_HOME is honored", async () => {
    const { loadSecretsV2 } = await import("./secrets.js");
    await atomicWriteFile(
      homePath("secrets.json"),
      '{"schemaVersion":2,"bindings":[{"configurationId":"config-first","revision":1,"status":"active","kind":"none"}]}\n',
      0o600,
    );
    expect(loadSecretsV2().bindings[0]).toMatchObject({
      binding: { configurationId: "config-first" },
    });

    const relocated = homePath("relocated");
    await mkdir(relocated, { recursive: true, mode: 0o700 });
    await atomicWriteFile(
      join(relocated, "secrets.json"),
      '{"schemaVersion":2,"bindings":[{"configurationId":"config-second","revision":1,"status":"active","kind":"none"}]}\n',
      0o600,
    );

    process.env.DIFFGAZER_HOME = relocated;
    try {
      expect(loadSecretsV2().bindings[0]).toMatchObject({
        binding: { configurationId: "config-second" },
      });
    } finally {
      process.env.DIFFGAZER_HOME = tempHome;
    }
  });

  it("restores both documents byte-for-byte from a mode-0600 recovery sidecar", async () => {
    const { getSecretsRecoveryPath, readDocumentRecovery, writeDocumentRecovery } = await import(
      "./secrets-recovery.js"
    );
    const configBefore =
      '{"schemaVersion":2,"settings":{"theme":"dark"},"selectedConfigurationId":null,"configurations":[]}\n';
    const secretsBefore =
      '{"schemaVersion":2,"bindings":[{"configurationId":"config-before","revision":7,"status":"removed","kind":"none"}]}\n';

    await writeDocumentRecovery({
      config: encoder.encode(configBefore),
      secrets: encoder.encode(secretsBefore),
    });
    expect((await stat(getSecretsRecoveryPath())).mode & 0o777).toBe(0o600);
    expect(readDocumentRecovery().kind).toBe("valid");

    await atomicWriteFile(
      homePath("config.json"),
      '{"schemaVersion":2,"settings":{},"selectedConfigurationId":null,"configurations":[]}\n',
      0o600,
    );
    await atomicWriteFile(homePath("secrets.json"), '{"schemaVersion":2,"bindings":[]}\n', 0o600);

    await expect(restoreRecordedRecovery()).resolves.toBeNull();

    const { loadSecretsV2 } = await import("./secrets.js");
    const { loadConfigV2 } = await import("./config.js");
    expect(loadSecretsV2().bindings[0]).toMatchObject({
      binding: { configurationId: "config-before", revision: 7 },
    });
    expect(loadConfigV2().settings).toEqual({ theme: "dark" });
    await expect(stat(getSecretsRecoveryPath())).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("durably clears the recovery record after restoring both documents", async () => {
    const { getSecretsRecoveryPath, writeDocumentRecovery } = await import("./secrets-recovery.js");
    await writeDocumentRecovery({
      config: encoder.encode('{"schemaVersion":2,"restored":"config"}\n'),
      secrets: encoder.encode('{"schemaVersion":2,"restored":"secrets"}\n'),
    });
    await atomicWriteFile(homePath("config.json"), "{}\n", 0o600);
    await atomicWriteFile(homePath("secrets.json"), "{}\n", 0o600);

    const events: string[] = [];
    const realRename = fs.promises.rename.bind(fs.promises);
    const realUnlink = fs.unlinkSync.bind(fs);
    const realOpen = fs.openSync.bind(fs);
    const realFsync = fs.fsyncSync.bind(fs);
    const realClose = fs.closeSync.bind(fs);
    vi.spyOn(fs.promises, "rename").mockImplementation(async (oldPath, newPath) => {
      events.push(`rename:${String(newPath)}`);
      return realRename(oldPath, newPath);
    });
    vi.spyOn(fs, "unlinkSync").mockImplementation((filePath) => {
      events.push(`unlink:${String(filePath)}`);
      return realUnlink(filePath);
    });
    vi.spyOn(fs, "openSync").mockImplementation((directoryPath, flags, mode) => {
      events.push(`open:${String(directoryPath)}:${String(flags)}:${String(mode)}`);
      return realOpen(directoryPath, flags, mode);
    });
    vi.spyOn(fs, "fsyncSync").mockImplementation((descriptor) => {
      events.push(`fsync:${String(descriptor)}`);
      return realFsync(descriptor);
    });
    vi.spyOn(fs, "closeSync").mockImplementation((descriptor) => {
      events.push(`close:${String(descriptor)}`);
      return realClose(descriptor);
    });

    await expect(restoreRecordedRecovery()).resolves.toBeNull();

    const recoveryUnlinkIndex = events.indexOf(`unlink:${getSecretsRecoveryPath()}`);
    const restoreRenameIndexes = events.flatMap((event, index) =>
      event.startsWith("rename:") ? [index] : [],
    );
    expect(restoreRenameIndexes).toHaveLength(2);
    expect(recoveryUnlinkIndex).toBeGreaterThan(restoreRenameIndexes[1] ?? -1);
    expect(
      events
        .slice(recoveryUnlinkIndex, recoveryUnlinkIndex + 4)
        .map((event) => event.split(":", 1)[0]),
    ).toEqual(["unlink", "open", "fsync", "close"]);
  });

  it("does not fsync the recovery directory when the record is absent", async () => {
    const { clearDocumentRecovery } = await import("./secrets-recovery.js");
    const fsync = vi.spyOn(fs, "fsyncSync");

    expect(() => clearDocumentRecovery()).not.toThrow();

    expect(fsync).not.toHaveBeenCalled();
  });

  it("reports a rollback failure when durable recovery cleanup cannot fsync", async () => {
    const { getSecretsRecoveryPath, writeDocumentRecovery } = await import("./secrets-recovery.js");
    await writeDocumentRecovery({ config: null, secrets: null });

    const fsyncError = Object.assign(new Error("recovery directory fsync failed"), {
      code: "EIO",
    });
    vi.spyOn(fs, "fsyncSync").mockImplementation(() => {
      throw fsyncError;
    });

    const recovered = await restoreRecordedRecovery();

    expect(recovered).toMatchObject({
      code: "ROLLBACK_FAILED",
      message: "Failed to restore secrets after a partial persistence failure",
    });
    expect(recovered?.message).not.toContain("recovery directory fsync failed");
    await expect(stat(getSecretsRecoveryPath())).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("restores snapshot bytes that are not valid UTF-8 without replacing them", async () => {
    const { writeDocumentRecovery } = await import("./secrets-recovery.js");
    // A newer binary may write bytes this one cannot decode; the WAL promises to
    // put them back exactly, not to round-trip them through a UTF-8 string.
    const configBytes = new Uint8Array([0x7b, 0xff, 0xfe, 0x7d, 0x0a]);
    const secretsBytes = new Uint8Array([0x7b, 0x80, 0x81, 0x7d, 0x0a]);

    await writeDocumentRecovery({ config: configBytes, secrets: secretsBytes });
    await atomicWriteFile(homePath("config.json"), "{}\n", 0o600);
    await atomicWriteFile(homePath("secrets.json"), "{}\n", 0o600);

    await expect(restoreRecordedRecovery()).resolves.toBeNull();

    expect(new Uint8Array(await readFile(homePath("config.json")))).toEqual(configBytes);
    expect(new Uint8Array(await readFile(homePath("secrets.json")))).toEqual(secretsBytes);
  });

  it("removes both files when the recovery snapshot records that neither existed", async () => {
    const { writeDocumentRecovery } = await import("./secrets-recovery.js");
    await atomicWriteFile(homePath("secrets.json"), '{"schemaVersion":2,"bindings":[]}\n', 0o600);
    await writeDocumentRecovery({ config: null, secrets: null });

    await expect(restoreRecordedRecovery()).resolves.toBeNull();

    await expect(stat(homePath("secrets.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("reports an invalid recovery sidecar without exposing its bytes or path", async () => {
    const { getSecretsRecoveryPath, readDocumentRecovery } = await import("./secrets-recovery.js");
    mockLog.mockClear();
    await atomicWriteFile(getSecretsRecoveryPath(), '{"version":1}\n', 0o600);

    const recovery = readDocumentRecovery();

    if (recovery.kind !== "invalid") throw new Error(`Recovery record is ${recovery.kind}`);
    expect(recovery.error).toMatchObject({
      code: "ROLLBACK_FAILED",
      message: "Failed to restore secrets after a partial persistence failure",
    });
    expect(recovery.error.message).not.toContain(tempHome);
    expect(recovery.error.message).not.toContain(".backup");
    expect(mockLog).toHaveBeenCalledWith("error", "secrets_rollback_failed", {
      error: expect.stringContaining("version"),
    });
    expect(mockLog).toHaveBeenCalledTimes(1);
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
