import * as fs from "node:fs";
import { readFile, stat } from "node:fs/promises";
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

describe("document recovery sidecar", () => {
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

    const { decodeSecretsV2 } = await import("./secrets.js");
    const { decodeConfigV2 } = await import("./config.js");
    expect(
      decodeSecretsV2(new Uint8Array(await readFile(homePath("secrets.json")))).bindings[0],
    ).toMatchObject({
      binding: { configurationId: "config-before", revision: 7 },
    });
    expect(
      decodeConfigV2(new Uint8Array(await readFile(homePath("config.json")))).settings,
    ).toEqual({ theme: "dark" });
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
