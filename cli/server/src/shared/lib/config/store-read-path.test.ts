import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "@diffgazer/core/schemas/config";
import { describe, expect, it, vi } from "vitest";
import {
  configPath,
  fsHooks,
  loadStore,
  readJson,
  secretsPath,
  writeJson,
} from "./store.test-support.js";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

const v2Config = (settings: Record<string, unknown> = {}) => ({
  schemaVersion: 2,
  settings,
  selectedConfigurationId: null,
  configurations: [],
});

const createGeminiAction = (value: string) =>
  ({
    action: "create",
    input: {
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: GEMINI_ENDPOINT,
      credential: { kind: "literal", value },
    },
  }) as const;

const recoveryPath = (): string => `${secretsPath()}.recovery`;

const v1Config = () => ({
  settings: { theme: "dark", secretsStorage: "file" },
  providers: [
    {
      provider: "gemini",
      [LEGACY_V1_HAS_API_KEY_PROPERTY]: true,
      isActive: true,
      model: "gemini-2.5-flash",
    },
  ],
});

const writeRecoveryJournal = (content: string): void => {
  writeFileSync(recoveryPath(), content, { mode: 0o600 });
};

// The journal holds the exact prior bytes of both files, so a reconciliation puts
// this config back on disk in place of whatever the store loaded.
const journalRestoringConfig = (config: unknown): string =>
  `${JSON.stringify({
    version: 2,
    previousConfig: {
      existed: true,
      base64: Buffer.from(`${JSON.stringify(config, null, 2)}\n`).toString("base64"),
    },
    previousSecrets: { existed: false, base64: null },
  })}\n`;

// A transaction lock is a directory holding one marker that names its owner; a marker
// naming a live pid is a lock every other holder has to wait out.
const holdForeignLock = (filePath: string): (() => void) => {
  const lockPath = `${filePath}.lock`;
  const ownerId = randomUUID();
  mkdirSync(lockPath, { recursive: true, mode: 0o700 });
  writeFileSync(
    join(lockPath, `${ownerId}.json`),
    `${JSON.stringify({ ownerId, pid: process.pid, createdAt: Date.now() })}\n`,
  );
  return () => rmSync(lockPath, { recursive: true, force: true });
};

describe("config store read path", () => {
  it("serves a read from memory while a foreign process holds the document lock", async () => {
    writeJson(configPath(), v2Config({ theme: "dark" }));
    const store = await loadStore();
    expect(await store.ready()).toEqual({ ok: true, value: undefined });

    // Released twice on the happy path: the mutation below has to be let go before it
    // can finish, and the finally still covers an assertion that throws before that.
    const release = holdForeignLock(configPath());
    try {
      await expect(store.readSettings()).resolves.toMatchObject({
        ok: true,
        value: { theme: "dark" },
      });

      // The same lock stops a mutation, so the read above passed by never taking it.
      // Proven by the mutation staying pending under the lock and completing once it
      // lifts, rather than by waiting out the five-second lock timeout.
      const blocked = store.updateSettings({ theme: "light" });
      await expect(Promise.race([blocked, delay(50, "pending")])).resolves.toBe("pending");
      release();
      await expect(blocked).resolves.toMatchObject({ ok: true, value: { theme: "light" } });
    } finally {
      release();
    }
  });

  it("observes settings written to the config file by an external writer", async () => {
    writeJson(configPath(), v2Config({ theme: "dark" }));
    const store = await loadStore();
    await expect(store.readSettings()).resolves.toMatchObject({
      ok: true,
      value: { theme: "dark" },
    });

    writeJson(configPath(), v2Config({ theme: "light" }));

    await expect(store.readSettings()).resolves.toMatchObject({
      ok: true,
      value: { theme: "light" },
    });
  });

  it("never pairs an unchanged config with a stale secrets document", async () => {
    writeJson(configPath(), v2Config());
    const store = await loadStore();
    const created = await store.runConfigurationAction(createGeminiAction("read-path-key"));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    const before = await store.readCurrentState();
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.value.secrets.bindings).toHaveLength(1);

    // Only the secrets document is replaced: the config file keeps the fingerprint the
    // reader loaded it under, so nothing but the secrets fingerprint can force a reload.
    writeJson(secretsPath(), { schemaVersion: 2, bindings: [] });

    const after = await store.readCurrentState();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.secrets.bindings).toHaveLength(0);
    expect(after.value.config.configurations).toHaveLength(1);
  });

  it("reconciles a journal that appears while both documents stay untouched", async () => {
    writeJson(configPath(), v2Config({ theme: "dark" }));
    const store = await loadStore();
    expect(await store.ready()).toEqual({ ok: true, value: undefined });
    await expect(store.readSettings()).resolves.toMatchObject({
      ok: true,
      value: { theme: "dark" },
    });

    // Neither document moves, so only the journal's own fingerprint can send this read
    // down the locked path — the one path allowed to replay a half-finished commit.
    writeRecoveryJournal(journalRestoringConfig(v2Config({ theme: "terminal" })));

    await expect(store.readSettings()).resolves.toMatchObject({
      ok: true,
      value: { theme: "terminal" },
    });
    expect(readJson<{ settings: { theme: string } }>(configPath()).settings.theme).toBe("terminal");
    expect(existsSync(recoveryPath())).toBe(false);
  });

  it("keeps refusing reads after a malformed journal latches a rollback failure", async () => {
    writeJson(configPath(), v2Config({ theme: "dark" }));
    const store = await loadStore();
    expect(await store.ready()).toEqual({ ok: true, value: undefined });

    writeRecoveryJournal("{ not a journal\n");

    await expect(store.readSettings()).resolves.toMatchObject({
      ok: false,
      error: { code: "ROLLBACK_FAILED" },
    });

    // Quarantine moved the malformed journal aside without touching either document, so
    // all three files are back to the bytes the store loaded them under. Only the latched
    // failure can still keep this read off the in-memory documents.
    expect(existsSync(recoveryPath())).toBe(false);
    expect(readJson<{ settings: { theme: string } }>(configPath()).settings.theme).toBe("dark");

    await expect(store.readSettings()).resolves.toMatchObject({
      ok: false,
      error: { code: "ROLLBACK_FAILED" },
    });
  });

  it("upgrades a V1 document a failed commit reloaded instead of serving its settings-only projection", async () => {
    writeJson(configPath(), v2Config({ theme: "dark" }));
    const store = await loadStore();
    expect(await store.ready()).toEqual({ ok: true, value: undefined });

    // The rollback reload is the one path that loads a document without upgrading it,
    // and it latches nothing when it succeeds. An older binary replacing both files
    // while this commit is writing its journal therefore leaves the store holding the
    // settings-only projection of a V1 config: no configurations, and no latch to keep
    // a read off it.
    const hookedWrites: string[] = [];
    fsHooks.atomicWriteFileHook = async (filePath) => {
      hookedWrites.push(filePath);
      fsHooks.atomicWriteFileHook = null;
      writeJson(configPath(), v1Config());
      writeJson(secretsPath(), { providers: { gemini: "sk-v1-file-literal" } });
      throw new Error("Injected journal write failure");
    };
    await expect(store.updateSettings({ theme: "light" })).resolves.toMatchObject({
      ok: false,
      error: { code: "PERSIST_FAILED" },
    });
    expect(hookedWrites).toEqual([recoveryPath()]);

    const current = await store.readCurrentState();
    expect(current.ok).toBe(true);
    if (!current.ok) return;
    expect(
      current.value.config.configurations.map((entry) =>
        entry.status === "unknown" ? entry.configurationId : entry.record.configurationId,
      ),
    ).toEqual(["cfg-v1-gemini"]);
  });

  it("keeps refusing reads after a failed upgrade persist, even once disk holds a valid V2 pair", async () => {
    writeJson(configPath(), v2Config({ theme: "dark" }));
    const store = await loadStore();
    expect(await store.ready()).toEqual({ ok: true, value: undefined });

    // An older binary puts a V1 pair back on disk, and the upgrade the next read runs
    // cannot commit it.
    writeJson(configPath(), v1Config());
    writeJson(secretsPath(), { providers: { gemini: "sk-v1-file-literal" } });
    const { atomicWriteFile } = await vi.importActual<typeof import("../fs.js")>("../fs.js");
    fsHooks.atomicWriteFileHook = async (filePath, content, mode) => {
      if (filePath !== configPath()) return atomicWriteFile(filePath, content, mode);
      fsHooks.atomicWriteFileHook = null;
      throw new Error("Injected upgrade persist failure");
    };
    await expect(store.readSettings()).resolves.toMatchObject({
      ok: false,
      error: { code: "PERSIST_FAILED" },
    });

    // The repair clears every other reason to refuse: the reload below drops the pending
    // V1 document and the load failure, and leaves both files at the fingerprints it
    // loaded them under. Only the latched upgrade failure can still keep a read off them.
    writeJson(configPath(), v2Config({ theme: "light" }));
    writeJson(secretsPath(), { schemaVersion: 2, bindings: [] });
    await expect(store.readSettings()).resolves.toMatchObject({
      ok: false,
      error: { code: "PERSIST_FAILED" },
    });

    // Not a duplicate: the read above went through the locked reload (fingerprints
    // still differed), which refreshed them to match disk. THIS read is the first
    // one documentsMatchDisk could serve from memory — the latched upgrade error
    // is the only term refusing it, so this assertion is the guard's discriminator.
    await expect(store.readSettings()).resolves.toMatchObject({
      ok: false,
      error: { code: "PERSIST_FAILED" },
    });
  });
});
