import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "@diffgazer/core/schemas/config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { atomicWriteFile } from "../fs.js";
import { getConfigurationSecretName } from "./secrets-store.js";
import {
  configPath,
  diffgazerHome,
  fsHooks,
  keyring,
  loadStore,
  loadStoreFactory,
  readJson,
  secretsPath,
  writeJson,
} from "./store.test-support.js";

const migrationLog = vi.hoisted(() => vi.fn());
const credentialPathIo = vi.hoisted(() => ({
  watchedPaths: [] as string[],
  events: [] as string[],
}));

vi.mock("../log.js", () => ({ log: migrationLog }));
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  const isWatched = (target: unknown): target is string =>
    typeof target === "string" &&
    credentialPathIo.watchedPaths.some(
      (watchedPath) =>
        target === watchedPath ||
        target.startsWith(`${watchedPath}/`) ||
        target.startsWith(`${watchedPath}.`),
    );
  const tracked = <T extends (...args: never[]) => unknown>(operation: string, fn: T): T =>
    ((...args: unknown[]) => {
      const target = typeof args[0] === "string" ? args[0] : null;
      if (isWatched(target)) {
        credentialPathIo.events.push(operation);
      }
      return Reflect.apply(fn, actual, args);
    }) as unknown as T;
  const trackedOpen = (async (...args: Parameters<typeof actual.promises.open>) => {
    const watched = isWatched(args[0]);
    if (watched) credentialPathIo.events.push("open-async");
    const handle = await actual.promises.open(...args);
    if (!watched) return handle;
    return new Proxy(handle, {
      get(target, property) {
        const value = Reflect.get(target, property, target);
        if (typeof value !== "function") return value;
        return (...methodArgs: unknown[]) => {
          credentialPathIo.events.push(`file-handle-${String(property)}`);
          return Reflect.apply(value, target, methodArgs);
        };
      },
    });
  }) as typeof actual.promises.open;
  const trackedPromises = {
    ...actual.promises,
    chmod: tracked("chmod-async", actual.promises.chmod),
    lstat: tracked("lstat-async", actual.promises.lstat),
    mkdir: tracked("mkdir-async", actual.promises.mkdir),
    open: trackedOpen,
    readFile: tracked("read-async", actual.promises.readFile),
    readlink: tracked("readlink-async", actual.promises.readlink),
    realpath: tracked("realpath-async", actual.promises.realpath),
    rename: tracked("rename-async", actual.promises.rename),
    rm: tracked("rm-async", actual.promises.rm),
    rmdir: tracked("rmdir-async", actual.promises.rmdir),
    stat: tracked("stat-async", actual.promises.stat),
    unlink: tracked("unlink-async", actual.promises.unlink),
    writeFile: tracked("write-async", actual.promises.writeFile),
  };
  return {
    ...actual,
    chmodSync: tracked("chmod", actual.chmodSync),
    existsSync: tracked("exists", actual.existsSync),
    lstatSync: tracked("lstat", actual.lstatSync),
    mkdirSync: tracked("mkdir", actual.mkdirSync),
    openSync: tracked("open", actual.openSync),
    readFileSync: tracked("read", actual.readFileSync),
    readlinkSync: tracked("readlink", actual.readlinkSync),
    renameSync: tracked("rename", actual.renameSync),
    rmSync: tracked("rm", actual.rmSync),
    rmdirSync: tracked("rmdir", actual.rmdirSync),
    promises: trackedPromises,
    statSync: tracked("stat", actual.statSync),
    unlinkSync: tracked("unlink", actual.unlinkSync),
    writeFileSync: tracked("write", actual.writeFileSync),
  };
});
vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  const isWatched = (target: unknown): target is string =>
    typeof target === "string" &&
    credentialPathIo.watchedPaths.some(
      (watchedPath) =>
        target === watchedPath ||
        target.startsWith(`${watchedPath}/`) ||
        target.startsWith(`${watchedPath}.`),
    );
  const tracked = <T extends (...args: never[]) => unknown>(operation: string, fn: T): T =>
    ((...args: unknown[]) => {
      const target = typeof args[0] === "string" ? args[0] : null;
      if (isWatched(target)) {
        credentialPathIo.events.push(operation);
      }
      return Reflect.apply(fn, actual, args);
    }) as unknown as T;
  const trackedOpen = (async (...args: Parameters<typeof actual.open>) => {
    const watched = isWatched(args[0]);
    if (watched) credentialPathIo.events.push("open-async");
    const handle = await actual.open(...args);
    if (!watched) return handle;
    return new Proxy(handle, {
      get(target, property) {
        const value = Reflect.get(target, property, target);
        if (typeof value !== "function") return value;
        return (...methodArgs: unknown[]) => {
          credentialPathIo.events.push(`file-handle-${String(property)}`);
          return Reflect.apply(value, target, methodArgs);
        };
      },
    });
  }) as typeof actual.open;
  return {
    ...actual,
    chmod: tracked("chmod-async", actual.chmod),
    lstat: tracked("lstat-async", actual.lstat),
    mkdir: tracked("mkdir-async", actual.mkdir),
    open: trackedOpen,
    readFile: tracked("read-async", actual.readFile),
    readlink: tracked("readlink-async", actual.readlink),
    realpath: tracked("realpath-async", actual.realpath),
    rename: tracked("rename-async", actual.rename),
    stat: tracked("stat-async", actual.stat),
    unlink: tracked("unlink-async", actual.unlink),
    writeFile: tracked("write-async", actual.writeFile),
  };
});

beforeEach(() => {
  credentialPathIo.watchedPaths.length = 0;
  credentialPathIo.events.length = 0;
});

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const CREATED_AT = "2026-01-01T00:00:00.000Z";

const DEFAULT_BUDGET = {
  inputTokens: 200_000,
  outputTokens: 40_000,
  responseBytes: 8_000_000,
  wallTimeMs: 300_000,
  retries: 0,
  concurrency: 1,
  perReview: 5,
};

const v2Config = (
  records: unknown[],
  selectedConfigurationId: string | null = null,
  settings: Record<string, unknown> = {},
) => ({
  schemaVersion: 2,
  settings,
  selectedConfigurationId,
  configurations: records,
});

const v2Secrets = (bindings: unknown[] = []) => ({ schemaVersion: 2, bindings });

const supportedRecord = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 2,
  status: "supported",
  configurationId: "cfg-existing",
  revision: 1,
  transportFamily: "hosted-api",
  productId: "gemini",
  input: { transportFamily: "hosted-api", productId: "gemini", endpoint: GEMINI_ENDPOINT },
  selectedModelId: null,
  acknowledgement: { noticeId: "gemini-hosted-api", noticeVersion: 1, acceptedAt: null },
  evidenceReference: null,
  budget: DEFAULT_BUDGET,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  ...overrides,
});

const createGeminiAction = (
  credential: { kind: "literal"; value: string } | { kind: "environment" },
) =>
  ({
    action: "create",
    input: {
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: GEMINI_ENDPOINT,
      credential,
    },
  }) as const;

const updateGeminiAction = (configurationId: string, expectedRevision: number) =>
  ({
    action: "update",
    configurationId,
    expectedRevision,
    input: { transportFamily: "hosted-api", productId: "gemini", endpoint: GEMINI_ENDPOINT },
    acknowledgement: {
      status: "accepted",
      noticeId: "gemini-hosted-api",
      noticeVersion: 1,
      acceptedAt: "2026-01-02T00:00:00.000Z",
    },
  }) as const;

const literalSecretPathFor = (configurationId: string, revision: number): string =>
  join(diffgazerHome, "credentials", `${configurationId}-${revision}.key`);

const seedPendingKeyringTombstone = (secretsStorage: "file" | "keyring" = "keyring") => {
  const oldKeyId = "diffgazer/cfg-existing/retired";
  const activeKeyId = getConfigurationSecretName("cfg-existing", 1);
  const keyringValues = new Map<string, string>([
    [oldKeyId, "sk-proj-retired"],
    [activeKeyId, "sk-proj-active"],
  ]);
  writeJson(configPath(), v2Config([supportedRecord()], "cfg-existing", { secretsStorage }));
  writeJson(
    secretsPath(),
    v2Secrets([
      {
        configurationId: "cfg-existing",
        revision: 1,
        kind: "keyring-reference",
        keyId: activeKeyId,
        status: "active",
      },
      {
        configurationId: "cfg-existing",
        revision: 1,
        kind: "keyring-reference",
        keyId: oldKeyId,
        status: "removed",
      },
    ]),
  );
  keyring.readKeyringSecret.mockImplementation((key: string) => ({
    ok: true,
    value: keyringValues.get(key) ?? null,
  }));
  keyring.deleteKeyringSecret.mockImplementation((key: string) => ({
    ok: true,
    value: keyringValues.delete(key),
  }));
  return { oldKeyId, activeKeyId, keyringValues };
};

const v1Config = (
  providers: unknown[],
  settings: Record<string, unknown> = { secretsStorage: "file" },
) => ({ settings, providers });

const v1Gemini = (overrides: Record<string, unknown> = {}) => ({
  provider: "gemini",
  [LEGACY_V1_HAS_API_KEY_PROPERTY]: true,
  isActive: true,
  model: "gemini-2.5-flash",
  ...overrides,
});

const fixedMigrationFailure = (message = "Legacy configuration requires manual migration") => ({
  ok: false,
  error: { code: "SECRETS_MIGRATION_FAILED", message, details: undefined },
});

const symlinkIdentity = (path: string) => {
  const stats = lstatSync(path);
  return {
    dev: stats.dev,
    ino: stats.ino,
    target: readlinkSync(path),
    isSymbolicLink: stats.isSymbolicLink(),
  };
};

const fileIdentity = (path: string) => {
  const bytes = readFileSync(path);
  const stats = lstatSync(path);
  return {
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    dev: stats.dev,
    ino: stats.ino,
    mode: stats.mode & 0o777,
    isSymbolicLink: stats.isSymbolicLink(),
  };
};

const storeArtifacts = (): string[] =>
  readdirSync(diffgazerHome)
    .filter(
      (name) => name.includes(".lock") || name.includes(".pending") || name.includes(".backup"),
    )
    .sort();

function collectStrings(value: unknown, seen = new WeakSet<object>()): string[] {
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object" || seen.has(value)) return [];

  seen.add(value);
  const strings: string[] = [];
  if (value instanceof Error) {
    strings.push(value.name, value.message);
    if (value.stack) strings.push(value.stack);
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) {
      strings.push(...collectStrings(descriptor.value, seen));
    }
  }
  return strings;
}

describe("config store V1 upgrade", () => {
  it("refuses a V1 file migration through a credential directory symlinked outside the app directory", async () => {
    const secret = "file-secret-sentinel";
    const external = mkdtempSync(join(tmpdir(), "diffgazer-v1-victim-"));
    const keyPath = literalSecretPathFor("cfg-v1-gemini", 1);
    const credentialDirectory = dirname(keyPath);
    const victimPath = join(external, basename(keyPath));
    const keyringSidecar = `${secretsPath()}.v1-migration`;
    const fileSidecar = `${secretsPath()}.v1-file-migration`;
    const keyringSidecarVictim = join(external, "keyring-sidecar-victim");
    const fileSidecarVictim = join(external, "file-sidecar-victim");
    const parkedCredentialDirectory = join(diffgazerHome, "credentials-before-swap");
    const parkedSentinelPath = join(parkedCredentialDirectory, "parked-credential-sentinel");
    try {
      writeJson(configPath(), v1Config([v1Gemini()], { theme: "dark", secretsStorage: "file" }));
      writeJson(secretsPath(), { providers: { gemini: secret } });
      const originalConfig = readFileSync(configPath());
      const originalSecrets = readFileSync(secretsPath());
      writeFileSync(victimPath, "external-victim", { mode: 0o600 });
      writeFileSync(keyringSidecarVictim, "stale-keyring-sidecar", { mode: 0o600 });
      writeFileSync(fileSidecarVictim, "stale-file-sidecar", { mode: 0o600 });
      mkdirSync(credentialDirectory, { recursive: true });
      writeFileSync(join(credentialDirectory, "parked-credential-sentinel"), "parked-exact-bytes", {
        mode: 0o600,
      });
      const directoryBeforeSwap = lstatSync(credentialDirectory);
      symlinkSync(keyringSidecarVictim, keyringSidecar);
      symlinkSync(fileSidecarVictim, fileSidecar);
      renameSync(credentialDirectory, parkedCredentialDirectory);
      symlinkSync(external, credentialDirectory);
      const originalLinks = {
        credentialDirectory: symlinkIdentity(credentialDirectory),
        keyringSidecar: symlinkIdentity(keyringSidecar),
        fileSidecar: symlinkIdentity(fileSidecar),
      };
      credentialPathIo.watchedPaths.push(credentialDirectory, keyringSidecar, fileSidecar);
      const store = await loadStore();

      const expected = fixedMigrationFailure();
      await expect(store.ready()).resolves.toEqual(expected);
      await expect(
        store.runConfigurationAction(createGeminiAction({ kind: "environment" })),
      ).resolves.toEqual(expected);
      const restarted = (await loadStoreFactory())();
      await expect(restarted.ready()).resolves.toEqual(expected);
      const externalIo = [...credentialPathIo.events];
      credentialPathIo.watchedPaths.length = 0;

      // `lstat` never resolves its final component, so classifying the swapped
      // credential directory is the only operation allowed to name it: anything
      // else would have reached the victim directory behind the symlink.
      expect(new Set(externalIo)).toEqual(new Set(["lstat-async"]));
      expect(readdirSync(external).sort()).toEqual(
        [basename(keyPath), "file-sidecar-victim", "keyring-sidecar-victim"].sort(),
      );
      expect(symlinkIdentity(credentialDirectory)).toEqual(originalLinks.credentialDirectory);
      expect(symlinkIdentity(keyringSidecar)).toEqual(originalLinks.keyringSidecar);
      expect(symlinkIdentity(fileSidecar)).toEqual(originalLinks.fileSidecar);
      const parkedDirectory = lstatSync(parkedCredentialDirectory);
      expect({ dev: parkedDirectory.dev, ino: parkedDirectory.ino }).toEqual({
        dev: directoryBeforeSwap.dev,
        ino: directoryBeforeSwap.ino,
      });
      expect(readdirSync(parkedCredentialDirectory)).toEqual(["parked-credential-sentinel"]);
      expect(readFileSync(parkedSentinelPath, "utf8")).toBe("parked-exact-bytes");
      expect(lstatSync(parkedSentinelPath).mode & 0o777).toBe(0o600);
      expect(readFileSync(configPath())).toEqual(originalConfig);
      expect(readFileSync(secretsPath())).toEqual(originalSecrets);
      expect(readFileSync(victimPath, "utf8")).toBe("external-victim");
      expect(readFileSync(keyringSidecarVictim, "utf8")).toBe("stale-keyring-sidecar");
      expect(readFileSync(fileSidecarVictim, "utf8")).toBe("stale-file-sidecar");
      expect(existsSync(keyringSidecar)).toBe(true);
      expect(existsSync(fileSidecar)).toBe(true);
      expect(existsSync(`${secretsPath()}.recovery`)).toBe(false);
      expect(keyring.isKeyringAvailable).not.toHaveBeenCalled();
      expect(keyring.readKeyringSecret).not.toHaveBeenCalled();
      expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
      expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
      const exposedStrings = collectStrings([migrationLog.mock.calls, expected]);
      expect(exposedStrings.every((value) => !value.includes(secret))).toBe(true);
      expect(exposedStrings.every((value) => !value.includes(victimPath))).toBe(true);
      expect(exposedStrings.every((value) => !value.includes(keyPath))).toBe(true);
    } finally {
      credentialPathIo.watchedPaths.length = 0;
      rmSync(external, { recursive: true, force: true });
    }
  });

  it.each([
    {
      name: "two active configurations",
      config: JSON.stringify(
        v1Config(
          [
            v1Gemini({ [LEGACY_V1_HAS_API_KEY_PROPERTY]: false }),
            v1Gemini({
              provider: "zai",
              model: undefined,
              [LEGACY_V1_HAS_API_KEY_PROPERTY]: false,
            }),
          ],
          { secretsStorage: "file", marker: "manual-active-conflict" },
        ),
      ),
      secrets: '{"providers":{}}',
      sentinel: "manual-active-conflict",
    },
    {
      name: "a file-backed API-key claim without a source",
      config: JSON.stringify(
        v1Config([v1Gemini()], {
          secretsStorage: "file",
          marker: "manual-missing-source",
        }),
      ),
      secrets: '{"providers":{}}',
      sentinel: "manual-missing-source",
    },
    {
      name: "an environment source with hasApiKey false",
      config: JSON.stringify(
        v1Config([v1Gemini({ [LEGACY_V1_HAS_API_KEY_PROPERTY]: false })], {
          secretsStorage: "file",
          marker: "manual-false-env",
        }),
      ),
      secrets: '{"providers":{"gemini":"env"}}',
      sentinel: "manual-false-env",
    },
    {
      name: "nested duplicate settings keys",
      config:
        '{"settings":{"secretsStorage":"file","attack-marker":"first","attack-marker":"second"},"providers":[]}',
      secrets: '{"providers":{}}',
      sentinel: "attack-marker",
    },
    {
      name: "escaped-equivalent duplicate provider keys",
      config:
        '{"settings":{"secretsStorage":"file"},"providers":[{"provider":"gemini","hasApiKey":true,"has\\u0041piKey":false,"isActive":true,"model":"gemini-2.5-flash"}]}',
      secrets: '{"providers":{}}',
      sentinel: "hasApiKey",
    },
    {
      name: "duplicate provider identity",
      config: JSON.stringify(
        v1Config(
          [
            v1Gemini({ isActive: false, [LEGACY_V1_HAS_API_KEY_PROPERTY]: false }),
            v1Gemini({ isActive: false, [LEGACY_V1_HAS_API_KEY_PROPERTY]: false }),
          ],
          { secretsStorage: "file", marker: "manual-duplicate-identity" },
        ),
      ),
      secrets: '{"providers":{}}',
      sentinel: "manual-duplicate-identity",
    },
    {
      name: "an orphan secret",
      config: JSON.stringify(v1Config([])),
      secrets: '{"providers":{"gemini":"orphan-secret-sentinel"}}',
      sentinel: "orphan-secret-sentinel",
    },
    {
      name: "a provider record this binary cannot decode",
      config:
        '{"settings":{"secretsStorage":"file"},"providers":[{"provider":"future","unknownField":"unknown-record-sentinel"}]}',
      secrets: '{"providers":{}}',
      sentinel: "unknown-record-sentinel",
    },
  ])("rejects $name before WAL or credential I/O and repeats byte-identically", async (fixture) => {
    const recoveryPath = `${secretsPath()}.recovery`;
    const credentialDirectory = join(diffgazerHome, "credentials");
    const keyringSidecar = `${secretsPath()}.v1-migration`;
    const fileSidecar = `${secretsPath()}.v1-file-migration`;
    writeFileSync(configPath(), fixture.config, { mode: 0o600 });
    writeFileSync(secretsPath(), fixture.secrets, { mode: 0o600 });
    writeFileSync(recoveryPath, "recovery-sentinel", { mode: 0o600 });
    const originalConfig = readFileSync(configPath());
    const originalSecrets = readFileSync(secretsPath());
    const originalRecovery = readFileSync(recoveryPath);
    migrationLog.mockClear();
    credentialPathIo.watchedPaths.push(
      recoveryPath,
      credentialDirectory,
      keyringSidecar,
      fileSidecar,
    );

    const store = await loadStore();
    await expect(store.ready()).resolves.toEqual(fixedMigrationFailure());
    const restarted = (await loadStoreFactory())();
    await expect(restarted.ready()).resolves.toEqual(fixedMigrationFailure());
    const prohibitedIo = [...credentialPathIo.events];
    credentialPathIo.watchedPaths.length = 0;

    expect(prohibitedIo).toEqual([]);
    expect(readFileSync(configPath())).toEqual(originalConfig);
    expect(readFileSync(secretsPath())).toEqual(originalSecrets);
    expect(readFileSync(recoveryPath)).toEqual(originalRecovery);
    expect(readdirSync(diffgazerHome).some((name) => name.includes(".backup"))).toBe(false);
    expect(keyring.isKeyringAvailable).not.toHaveBeenCalled();
    expect(keyring.readKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    const logStrings = collectStrings(migrationLog.mock.calls);
    expect(logStrings.every((value) => !value.includes(fixture.sentinel))).toBe(true);
    expect(logStrings.every((value) => !value.includes(diffgazerHome))).toBe(true);
  });

  it.each([
    "valid",
    "corrupt",
  ] as const)("makes blocked V1 dominant over a %s V2 recovery for fresh and previously-ready stores", async (recoveryKind) => {
    const createStore = await loadStoreFactory();
    writeJson(configPath(), v2Config([]));
    const store = createStore();
    await expect(store.ready()).resolves.toEqual({ ok: true, value: undefined });

    const priorV2Config = Buffer.from(
      `${JSON.stringify(v2Config([supportedRecord()], "cfg-existing"))}\n`,
    );
    const recoveryPath = `${secretsPath()}.recovery`;
    writeJson(
      configPath(),
      v1Config([v1Gemini()], { secretsStorage: "keyring", marker: "blocked-v1-recovery" }),
    );
    writeJson(secretsPath(), { providers: { gemini: "literal-recovery-secret" } });
    writeFileSync(
      recoveryPath,
      recoveryKind === "valid"
        ? `${JSON.stringify({
            version: 2,
            previousConfig: {
              existed: true,
              base64: priorV2Config.toString("base64"),
            },
            previousSecrets: { existed: false, base64: null },
          })}\n`
        : "corrupt-recovery-secret-sentinel",
      { mode: 0o600 },
    );
    chmodSync(configPath(), 0o600);
    chmodSync(secretsPath(), 0o600);

    const before = {
      config: fileIdentity(configPath()),
      secrets: fileIdentity(secretsPath()),
      recovery: fileIdentity(recoveryPath),
    };
    migrationLog.mockClear();
    keyring.isKeyringAvailable.mockClear();
    keyring.readKeyringSecret.mockClear();
    keyring.writeKeyringSecret.mockClear();
    keyring.deleteKeyringSecret.mockClear();
    credentialPathIo.watchedPaths.push(
      recoveryPath,
      `${configPath()}.lock`,
      `${secretsPath()}.lock`,
      join(diffgazerHome, "credentials"),
      join(diffgazerHome, "evidence"),
    );
    const expected = fixedMigrationFailure();
    const invalidEvidence = {} as Parameters<typeof store.recordConfigurationEvidence>[1];

    const assertBlockedOperations = async (target: typeof store): Promise<void> => {
      await expect(target.ready()).resolves.toEqual(expected);
      await expect(target.readCurrentState()).resolves.toEqual(expected);
      await expect(target.readConfigurationSnapshot()).resolves.toEqual(expected);
      await expect(target.updateSettings({ theme: "dark" })).resolves.toEqual(expected);
      await expect(
        target.runConfigurationAction({ action: "inspect", configurationId: "cfg-existing" }),
      ).resolves.toEqual(expected);
      await expect(
        target.runConfigurationAction({ action: "test", configurationId: "cfg-existing" }),
      ).resolves.toEqual(expected);
      await expect(
        target.recordConfigurationEvidence("cfg-existing", invalidEvidence),
      ).resolves.toEqual(expected);
      await expect(
        target.runConfigurationAction({ action: "future-action" } as never),
      ).resolves.toMatchObject({ ok: false, error: { code: "INVALID_ACTION" } });
    };

    await assertBlockedOperations(store);
    const restarted = createStore();
    await assertBlockedOperations(restarted);
    const prohibitedIo = [...credentialPathIo.events];
    credentialPathIo.watchedPaths.length = 0;

    expect(prohibitedIo).toEqual([]);
    expect(fileIdentity(configPath())).toEqual(before.config);
    expect(fileIdentity(secretsPath())).toEqual(before.secrets);
    expect(fileIdentity(recoveryPath)).toEqual(before.recovery);
    expect(storeArtifacts()).toEqual([]);
    expect(keyring.isKeyringAvailable).not.toHaveBeenCalled();
    expect(keyring.readKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    const exposed = collectStrings([migrationLog.mock.calls, expected]);
    for (const sentinel of [
      "blocked-v1-recovery",
      "literal-recovery-secret",
      "corrupt-recovery-secret-sentinel",
      diffgazerHome,
    ]) {
      expect(exposed.every((value) => !value.includes(sentinel))).toBe(true);
    }
  });

  it("rejects a blocked V1 recovery snapshot before creating document locks", async () => {
    const recoveryPath = `${secretsPath()}.recovery`;
    writeJson(configPath(), v2Config([]));
    writeJson(secretsPath(), v2Secrets([]));
    writeFileSync(
      recoveryPath,
      `${JSON.stringify({
        version: 2,
        previousConfig: {
          existed: true,
          base64: Buffer.from(
            JSON.stringify(
              v1Config([v1Gemini()], {
                secretsStorage: "keyring",
                marker: "blocked-recovery-config",
              }),
            ),
          ).toString("base64"),
        },
        previousSecrets: {
          existed: true,
          base64: Buffer.from(
            JSON.stringify({ providers: { gemini: "blocked-recovery-secret" } }),
          ).toString("base64"),
        },
      })}\n`,
      { mode: 0o600 },
    );
    const before = {
      config: fileIdentity(configPath()),
      secrets: fileIdentity(secretsPath()),
      recovery: fileIdentity(recoveryPath),
    };
    credentialPathIo.watchedPaths.push(
      `${configPath()}.lock`,
      `${secretsPath()}.lock`,
      join(diffgazerHome, "credentials"),
      join(diffgazerHome, "evidence"),
    );

    const createStore = await loadStoreFactory();
    const store = createStore();
    await expect(store.ready()).resolves.toEqual(fixedMigrationFailure());
    await expect(store.readCurrentState()).resolves.toEqual(fixedMigrationFailure());
    const prohibitedIo = [...credentialPathIo.events];
    credentialPathIo.watchedPaths.length = 0;

    expect(prohibitedIo).toEqual([]);
    expect(fileIdentity(configPath())).toEqual(before.config);
    expect(fileIdentity(secretsPath())).toEqual(before.secrets);
    expect(fileIdentity(recoveryPath)).toEqual(before.recovery);
    expect(storeArtifacts()).toEqual([]);
    expect(keyring.isKeyringAvailable).not.toHaveBeenCalled();
    expect(keyring.readKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    const exposed = collectStrings([migrationLog.mock.calls, fixedMigrationFailure()]);
    expect(exposed.every((value) => !value.includes("blocked-recovery-config"))).toBe(true);
    expect(exposed.every((value) => !value.includes("blocked-recovery-secret"))).toBe(true);
    expect(exposed.every((value) => !value.includes(diffgazerHome))).toBe(true);
  });

  it("refreshes a cached V2 snapshot after a verified manual repair", async () => {
    writeJson(configPath(), v2Config([]));
    const createStore = await loadStoreFactory();
    const store = createStore();
    await expect(store.ready()).resolves.toEqual({ ok: true, value: undefined });

    writeJson(configPath(), v1Config([v1Gemini()], { secretsStorage: "keyring" }));
    writeJson(secretsPath(), { providers: { gemini: "literal-repair-secret" } });
    await expect(store.readCurrentState()).resolves.toEqual(fixedMigrationFailure());

    writeJson(configPath(), v2Config([supportedRecord()], "cfg-existing"));
    writeJson(secretsPath(), v2Secrets([]));
    await expect(store.ready()).resolves.toEqual({ ok: true, value: undefined });
    await expect(store.readConfigurationSnapshot()).resolves.toMatchObject({
      ok: true,
      value: { selectedConfigurationId: "cfg-existing" },
    });
  });

  it.each([
    "missing",
    "malformed",
  ] as const)("preserves a verified V2 repair when the latched store finds a %s-config recovery", async (recoveryConfig) => {
    writeJson(configPath(), v2Config([]));
    const createStore = await loadStoreFactory();
    const store = createStore();
    await expect(store.ready()).resolves.toEqual({ ok: true, value: undefined });

    writeJson(configPath(), v1Config([v1Gemini()], { secretsStorage: "keyring" }));
    writeJson(secretsPath(), { providers: { gemini: "literal-latched-repair-secret" } });
    await expect(store.readCurrentState()).resolves.toEqual(fixedMigrationFailure());

    writeJson(configPath(), v2Config([supportedRecord()], "cfg-existing"));
    writeJson(secretsPath(), v2Secrets([]));
    const recoveryPath = `${secretsPath()}.recovery`;
    const previousConfig =
      recoveryConfig === "missing"
        ? { existed: false, base64: null }
        : {
            existed: true,
            base64: Buffer.from("{ malformed recovery config\n").toString("base64"),
          };
    writeFileSync(
      recoveryPath,
      `${JSON.stringify({
        version: 2,
        previousConfig,
        previousSecrets: { existed: false, base64: null },
      })}\n`,
      { mode: 0o600 },
    );
    const before = {
      config: fileIdentity(configPath()),
      secrets: fileIdentity(secretsPath()),
      recovery: fileIdentity(recoveryPath),
    };

    await expect(store.ready()).resolves.toEqual(fixedMigrationFailure());

    expect(fileIdentity(configPath())).toEqual(before.config);
    expect(fileIdentity(secretsPath())).toEqual(before.secrets);
    expect(fileIdentity(recoveryPath)).toEqual(before.recovery);
    expect(storeArtifacts()).toEqual([]);
    expect(keyring.isKeyringAvailable).not.toHaveBeenCalled();
    expect(keyring.readKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
  });

  it("fails an ambiguous keyring install that still holds a literal source, probing no key", async () => {
    const sourceKey = "api_key_gemini";
    const destinationKey = getConfigurationSecretName("cfg-v1-gemini", 1);
    const values = new Map([
      [sourceKey, "source-secret"],
      [destinationKey, "destination-secret"],
    ]);
    writeJson(configPath(), v1Config([v1Gemini()], { secretsStorage: "keyring" }));
    writeJson(secretsPath(), { providers: { gemini: "literal-must-not-leak" } });
    const originalConfig = readFileSync(configPath());
    const originalSecrets = readFileSync(secretsPath());
    keyring.readKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: values.get(key) ?? null,
    }));

    const store = await loadStore();
    await expect(store.ready()).resolves.toEqual(fixedMigrationFailure());
    const restarted = (await loadStoreFactory())();
    await expect(restarted.ready()).resolves.toEqual(fixedMigrationFailure());

    expect(readFileSync(configPath())).toEqual(originalConfig);
    expect(readFileSync(secretsPath())).toEqual(originalSecrets);
    expect(values.get(sourceKey)).toBe("source-secret");
    expect(values.get(destinationKey)).toBe("destination-secret");
    expect(keyring.isKeyringAvailable).not.toHaveBeenCalled();
    expect(keyring.readKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    expect(existsSync(`${secretsPath()}.recovery`)).toBe(false);
    expect(
      collectStrings(migrationLog.mock.calls).every(
        (value) => !value.includes("literal-must-not-leak"),
      ),
    ).toBe(true);
  });

  it("refuses to overwrite a canonical keyring key that already holds a different secret", async () => {
    const sourceKey = "api_key_gemini";
    const destinationKey = getConfigurationSecretName("cfg-v1-gemini", 1);
    const values = new Map([
      [sourceKey, "source-secret"],
      [destinationKey, "different-secret"],
    ]);
    writeJson(configPath(), v1Config([v1Gemini()], { secretsStorage: "keyring" }));
    writeJson(secretsPath(), { providers: {} });
    const originalConfig = readFileSync(configPath());
    const originalSecrets = readFileSync(secretsPath());
    keyring.readKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: values.get(key) ?? null,
    }));

    const store = await loadStore();
    await expect(store.ready()).resolves.toEqual(fixedMigrationFailure());
    const restarted = (await loadStoreFactory())();
    await expect(restarted.ready()).resolves.toEqual(fixedMigrationFailure());

    expect(readFileSync(configPath())).toEqual(originalConfig);
    expect(readFileSync(secretsPath())).toEqual(originalSecrets);
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    expect(values).toEqual(
      new Map([
        [sourceKey, "source-secret"],
        [destinationKey, "different-secret"],
      ]),
    );
    expect(existsSync(`${secretsPath()}.recovery`)).toBe(false);
    expect(
      collectStrings([migrationLog.mock.calls, fixedMigrationFailure()]).every(
        (value) => !value.includes("different-secret") && !value.includes("source-secret"),
      ),
    ).toBe(true);
  });

  it("upgrades file-mode environment and missing entries without credential I/O", async () => {
    writeJson(
      configPath(),
      v1Config(
        [
          v1Gemini(),
          v1Gemini({
            provider: "zai",
            isActive: false,
            model: undefined,
            [LEGACY_V1_HAS_API_KEY_PROPERTY]: false,
          }),
        ],
        { secretsStorage: "file" },
      ),
    );
    writeJson(secretsPath(), { providers: { gemini: "env" } });

    const store = await loadStore();
    await expect(store.ready()).resolves.toEqual({ ok: true, value: undefined });

    const persisted = readJson<{ bindings: Array<{ kind: string; varName?: string }> }>(
      secretsPath(),
    );
    expect(persisted.bindings).toEqual([
      expect.objectContaining({ kind: "environment-reference", varName: "GOOGLE_API_KEY" }),
      expect.objectContaining({ kind: "none" }),
    ]);
    expect(keyring.readKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
    expect(existsSync(dirname(literalSecretPathFor("cfg-v1-gemini", 1)))).toBe(false);
  });

  it("upgrades an install whose stored model is no longer selectable and asks for a new one", async () => {
    writeJson(
      configPath(),
      v1Config([v1Gemini({ model: "gemini-flash-latest" })], { secretsStorage: "file" }),
    );
    writeJson(secretsPath(), { providers: { gemini: "sk-v1-file-literal" } });

    const store = await loadStore();
    await expect(store.ready()).resolves.toEqual({ ok: true, value: undefined });

    expect(
      readJson<{ configurations: Array<{ selectedModelId: string | null }> }>(configPath())
        .configurations,
    ).toEqual([expect.objectContaining({ selectedModelId: null })]);
    expect(readFileSync(literalSecretPathFor("cfg-v1-gemini", 1), "utf8")).toBe(
      "sk-v1-file-literal",
    );
    expect(
      collectStrings(migrationLog.mock.calls).every(
        (value) => !value.includes("gemini-flash-latest"),
      ),
    ).toBe(true);
  });

  it("upgrades a file install by moving its literal into a contained 0600 credential file", async () => {
    writeJson(configPath(), v1Config([v1Gemini()], { secretsStorage: "file" }));
    writeJson(secretsPath(), { providers: { gemini: "sk-v1-file-literal" } });
    const keyPath = literalSecretPathFor("cfg-v1-gemini", 1);

    const store = await loadStore();
    await expect(store.ready()).resolves.toEqual({ ok: true, value: undefined });

    expect(readJson<{ bindings: unknown[] }>(secretsPath()).bindings).toEqual([
      {
        configurationId: "cfg-v1-gemini",
        revision: 1,
        kind: "file-0600",
        filePath: keyPath,
        status: "active",
      },
    ]);
    expect(readFileSync(keyPath, "utf8")).toBe("sk-v1-file-literal");
    expect(lstatSync(keyPath).mode & 0o777).toBe(0o600);
    expect(readJson<{ schemaVersion: number }>(configPath()).schemaVersion).toBe(2);
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();

    const restarted = (await loadStoreFactory())();
    await expect(restarted.ready()).resolves.toEqual({ ok: true, value: undefined });
    expect(readFileSync(keyPath, "utf8")).toBe("sk-v1-file-literal");
  });

  it("upgrades a keyring install by copying its legacy key to the canonical destination", async () => {
    const destinationKey = getConfigurationSecretName("cfg-v1-gemini", 1);
    const keyringValues = new Map([["api_key_gemini", "sk-v1-keyring-literal"]]);
    writeJson(configPath(), v1Config([v1Gemini()], { secretsStorage: "keyring" }));
    writeJson(secretsPath(), { providers: {} });
    keyring.readKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.get(key) ?? null,
    }));
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      keyringValues.set(key, value);
      return { ok: true, value: undefined };
    });

    const store = await loadStore();
    await expect(store.ready()).resolves.toEqual({ ok: true, value: undefined });

    expect(readJson<{ bindings: unknown[] }>(secretsPath()).bindings).toEqual([
      {
        configurationId: "cfg-v1-gemini",
        revision: 1,
        kind: "keyring-reference",
        keyId: destinationKey,
        status: "active",
      },
    ]);
    expect(keyringValues.get(destinationKey)).toBe("sk-v1-keyring-literal");
    // The legacy source stays readable: nothing proves the V2 copy is durable
    // until a later revision retires the binding through normal cleanup.
    expect(keyringValues.get("api_key_gemini")).toBe("sk-v1-keyring-literal");
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    expect(existsSync(dirname(literalSecretPathFor("cfg-v1-gemini", 1)))).toBe(false);
  });

  it("fails corrupt V1 secrets without quarantine, mutation, or disclosure", async () => {
    const corrupt = "{credential-sentinel:not-json";
    writeJson(configPath(), v1Config([v1Gemini()], { secretsStorage: "keyring" }));
    writeFileSync(secretsPath(), corrupt, { mode: 0o600 });
    const originalConfig = readFileSync(configPath());
    const originalSecrets = readFileSync(secretsPath());

    const store = await loadStore();
    await expect(store.ready()).resolves.toEqual(fixedMigrationFailure());
    const restarted = (await loadStoreFactory())();
    await expect(restarted.ready()).resolves.toEqual(fixedMigrationFailure());

    expect(readFileSync(configPath())).toEqual(originalConfig);
    expect(readFileSync(secretsPath())).toEqual(originalSecrets);
    expect(readdirSync(dirname(secretsPath())).some((name) => name.includes(".backup"))).toBe(
      false,
    );
    expect(keyring.readKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
    expect(
      collectStrings(migrationLog.mock.calls).every(
        (value) => !value.includes("credential-sentinel"),
      ),
    ).toBe(true);
  });
});

describe("config store settings persistence", () => {
  it("migrates existing file-backed bindings when secrets storage switches to keyring", async () => {
    const keyPath = literalSecretPathFor("cfg-existing", 1);
    writeJson(
      configPath(),
      v2Config([supportedRecord({ selectedModelId: "gemini-2.5-flash" })], "cfg-existing", {
        theme: "auto",
        secretsStorage: "file",
      }),
    );
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: keyPath,
          status: "active",
        },
      ]),
    );
    mkdirSync(dirname(keyPath), { recursive: true });
    writeFileSync(keyPath, "sk-proj-existing", { mode: 0o600 });
    const store = await loadStore();

    await expect(store.updateSettings({ theme: "dark" })).resolves.toMatchObject({ ok: true });
    await expect(store.updateSettings({ secretsStorage: "keyring" })).resolves.toMatchObject({
      ok: true,
    });

    const persistedConfig = readJson<{
      schemaVersion: number;
      settings: Record<string, unknown>;
      selectedConfigurationId: string | null;
      configurations: Array<{ configurationId: string; selectedModelId: string | null }>;
    }>(configPath());
    expect(persistedConfig.schemaVersion).toBe(2);
    expect(persistedConfig.settings).toMatchObject({ theme: "dark", secretsStorage: "keyring" });
    expect(persistedConfig.selectedConfigurationId).toBe("cfg-existing");
    expect(persistedConfig.configurations).toEqual([
      expect.objectContaining({
        configurationId: "cfg-existing",
        selectedModelId: "gemini-2.5-flash",
      }),
    ]);
    expect(readJson<{ schemaVersion: number; bindings: unknown[] }>(secretsPath())).toEqual({
      schemaVersion: 2,
      bindings: [
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "keyring-reference",
          keyId: expect.stringContaining("cfg-existing"),
          status: "active",
        },
      ],
    });
    expect(existsSync(keyPath)).toBe(false);
    await expect(store.readSettings()).resolves.toMatchObject({
      ok: true,
      value: { theme: "dark", secretsStorage: "keyring" },
    });
  });

  it("keeps the old credential readable when a secrets-storage migration persist fails", async () => {
    const keyPath = literalSecretPathFor("cfg-existing", 1);
    writeJson(
      configPath(),
      v2Config([supportedRecord({ selectedModelId: "gemini-2.5-flash" })], "cfg-existing", {
        theme: "auto",
        secretsStorage: "file",
      }),
    );
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: keyPath,
          status: "active",
        },
      ]),
    );
    mkdirSync(dirname(keyPath), { recursive: true });
    writeFileSync(keyPath, "sk-proj-existing", { mode: 0o600 });
    const keyringValues = new Map<string, string>();
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      keyringValues.set(key, value);
      return { ok: true, value: undefined };
    });
    keyring.deleteKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.delete(key),
    }));
    const store = await loadStore();

    fsHooks.atomicWriteFileHook = async (filePath) => {
      if (filePath === secretsPath() || filePath === configPath()) {
        fsHooks.atomicWriteFileHook = null;
        throw new Error("Injected secrets-storage migration persist failure");
      }
    };

    const result = await store.updateSettings({ secretsStorage: "keyring" });

    expect(result).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(readFileSync(keyPath, "utf8")).toBe("sk-proj-existing");
    expect(readJson<{ settings: { secretsStorage: string } }>(configPath()).settings).toMatchObject(
      { secretsStorage: "file" },
    );
    expect(
      readJson<{ bindings: Array<{ kind: string; filePath?: string }> }>(secretsPath()),
    ).toEqual({
      schemaVersion: 2,
      bindings: [
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: keyPath,
          status: "active",
        },
      ],
    });
    expect(keyringValues.size).toBe(0);
    await expect(store.readSettings()).resolves.toMatchObject({
      ok: true,
      value: { secretsStorage: "file" },
    });
  });

  it("keeps old and new migration credentials when rollback-tombstone WAL cleanup cannot be completed", async () => {
    const keyPath = literalSecretPathFor("cfg-existing", 1);
    const destinationKey = getConfigurationSecretName("cfg-existing", 1);
    const keyringValues = new Map<string, string>();
    writeJson(
      configPath(),
      v2Config([supportedRecord()], "cfg-existing", { secretsStorage: "file" }),
    );
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: keyPath,
          status: "active",
        },
      ]),
    );
    mkdirSync(dirname(keyPath), { recursive: true });
    writeFileSync(keyPath, "sk-proj-existing", { mode: 0o600 });
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      keyringValues.set(key, value);
      return { ok: true, value: undefined };
    });
    keyring.readKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.get(key) ?? null,
    }));
    const store = await loadStore();
    const recoveryPath = `${secretsPath()}.recovery`;
    const configBefore = readFileSync(configPath(), "utf8");
    const secretsBefore = readFileSync(secretsPath(), "utf8");
    let journalWrites = 0;
    let mainSecretsWriteFailed = false;
    let journalClearAttempts = 0;
    fsHooks.atomicWriteFileHook = async (filePath, content, mode) => {
      if (filePath === recoveryPath) journalWrites += 1;
      if (filePath === secretsPath() && !mainSecretsWriteFailed) {
        mainSecretsWriteFailed = true;
        throw new Error("Injected initial migration persist failure");
      }
      return atomicWriteFile(filePath, content, mode);
    };
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath) {
        journalClearAttempts += 1;
        if (journalClearAttempts >= 2) {
          throw new Error("Injected persistent recovery unlink failure");
        }
        unlinkSync(filePath);
      }
      return false;
    };
    keyring.deleteKeyringSecret.mockClear();

    const failed = await store.updateSettings({ secretsStorage: "keyring" });

    expect(failed).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(journalWrites).toBe(2);
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    expect(keyringValues.get(destinationKey)).toBe("sk-proj-existing");
    expect(readFileSync(keyPath, "utf8")).toBe("sk-proj-existing");
    expect(readFileSync(configPath(), "utf8")).toBe(configBefore);
    expect(readFileSync(secretsPath(), "utf8")).toBe(secretsBefore);
    expect(existsSync(recoveryPath)).toBe(true);
    expect(readJson<{ bindings: unknown[] }>(secretsPath()).bindings).toEqual([
      {
        configurationId: "cfg-existing",
        revision: 1,
        kind: "file-0600",
        filePath: keyPath,
        status: "active",
      },
    ]);
  });

  it("cleans up a new migration credential after a one-shot rollback-tombstone WAL failure", async () => {
    const keyPath = literalSecretPathFor("cfg-existing", 1);
    const destinationKey = getConfigurationSecretName("cfg-existing", 1);
    const keyringValues = new Map<string, string>();
    writeJson(
      configPath(),
      v2Config([supportedRecord()], "cfg-existing", { secretsStorage: "file" }),
    );
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: keyPath,
          status: "active",
        },
      ]),
    );
    mkdirSync(dirname(keyPath), { recursive: true });
    writeFileSync(keyPath, "sk-proj-existing", { mode: 0o600 });
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      keyringValues.set(key, value);
      return { ok: true, value: undefined };
    });
    keyring.readKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.get(key) ?? null,
    }));
    keyring.deleteKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.delete(key),
    }));
    const store = await loadStore();
    const recoveryPath = `${secretsPath()}.recovery`;
    const configBefore = readFileSync(configPath(), "utf8");
    const secretsBefore = readFileSync(secretsPath(), "utf8");
    let journalWrites = 0;
    let mainSecretsWriteFailed = false;
    let journalClearAttempts = 0;
    fsHooks.atomicWriteFileHook = async (filePath, content, mode) => {
      if (filePath === recoveryPath) journalWrites += 1;
      if (filePath === secretsPath() && !mainSecretsWriteFailed) {
        mainSecretsWriteFailed = true;
        throw new Error("Injected initial migration persist failure");
      }
      return atomicWriteFile(filePath, content, mode);
    };
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath) {
        journalClearAttempts += 1;
        if (journalClearAttempts === 2) {
          fsHooks.removeFileSyncDurableHook = null;
          throw new Error("Injected one-shot recovery unlink failure");
        }
        unlinkSync(filePath);
      }
      return false;
    };
    keyring.deleteKeyringSecret.mockClear();

    const failed = await store.updateSettings({ secretsStorage: "keyring" });

    expect(failed).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(journalWrites).toBe(2);
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledTimes(1);
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith(destinationKey);
    expect(keyringValues.has(destinationKey)).toBe(false);
    expect(readFileSync(keyPath, "utf8")).toBe("sk-proj-existing");
    expect(readFileSync(configPath(), "utf8")).toBe(configBefore);
    expect(readFileSync(secretsPath(), "utf8")).toBe(secretsBefore);
    expect(existsSync(recoveryPath)).toBe(false);
  });

  it("does not report settings success when post-commit tombstone clearing latches ROLLBACK_FAILED", async () => {
    const { oldKeyId, activeKeyId, keyringValues } = seedPendingKeyringTombstone();
    keyring.deleteKeyringSecret.mockImplementation(() => ({
      ok: false,
      error: { code: "KEYRING_UNAVAILABLE", message: "keyring is locked" },
    }));
    const store = await loadStore();
    await expect(store.ready()).resolves.toMatchObject({ ok: true });
    await vi.waitFor(() => expect(keyring.deleteKeyringSecret).toHaveBeenCalled());
    keyring.deleteKeyringSecret.mockClear();
    keyring.deleteKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.delete(key),
    }));

    const recoveryPath = `${secretsPath()}.recovery`;
    let journalWrites = 0;
    let journalClearAttempts = 0;
    fsHooks.atomicWriteFileHook = async (filePath, content, mode) => {
      if (filePath === recoveryPath) journalWrites += 1;
      return atomicWriteFile(filePath, content, mode);
    };
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath) {
        journalClearAttempts += 1;
        if (journalClearAttempts >= 2) {
          throw new Error("Injected persistent tombstone-clear unlink failure");
        }
        unlinkSync(filePath);
      }
      return false;
    };

    const failed = await store.updateSettings({ theme: "dark" });

    expect(failed).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(journalWrites).toBe(2);
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledTimes(1);
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith(oldKeyId);
    expect(keyringValues.has(oldKeyId)).toBe(false);
    expect(keyringValues.has(activeKeyId)).toBe(true);
    expect(existsSync(recoveryPath)).toBe(true);
    expect(
      readJson<{ bindings: Array<{ keyId?: string; status: string }> }>(secretsPath()).bindings,
    ).toEqual([
      expect.objectContaining({ keyId: activeKeyId, status: "active" }),
      expect.objectContaining({ keyId: oldKeyId, status: "removed" }),
    ]);

    const later = await store.updateSettings({ theme: "light" });
    expect(later).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(journalWrites).toBe(2);
  });

  it("stops a storage migration when preflight tombstone clearing cannot be finalized", async () => {
    const { oldKeyId, activeKeyId, keyringValues } = seedPendingKeyringTombstone("file");
    keyring.deleteKeyringSecret.mockImplementation(() => ({
      ok: false,
      error: { code: "KEYRING_UNAVAILABLE", message: "keyring is locked" },
    }));
    const store = await loadStore();
    await expect(store.ready()).resolves.toMatchObject({ ok: true });
    await vi.waitFor(() => expect(keyring.deleteKeyringSecret).toHaveBeenCalled());
    keyring.deleteKeyringSecret.mockClear();
    keyring.deleteKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.delete(key),
    }));

    const recoveryPath = `${secretsPath()}.recovery`;
    let journalWrites = 0;
    fsHooks.atomicWriteFileHook = async (filePath, content, mode) => {
      if (filePath === recoveryPath) journalWrites += 1;
      return atomicWriteFile(filePath, content, mode);
    };
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath)
        throw new Error("Injected persistent preflight unlink failure");
      return false;
    };

    const failed = await store.updateSettings({ secretsStorage: "keyring" });

    expect(failed).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(journalWrites).toBe(1);
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledTimes(1);
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith(oldKeyId);
    expect(keyringValues.has(oldKeyId)).toBe(false);
    expect(keyringValues.has(activeKeyId)).toBe(true);
    expect(existsSync(recoveryPath)).toBe(true);
    expect(readJson<{ settings: { secretsStorage: string } }>(configPath()).settings).toMatchObject(
      {
        secretsStorage: "file",
      },
    );
    expect(
      readJson<{ bindings: Array<{ keyId?: string; status: string }> }>(secretsPath()).bindings,
    ).toEqual([
      expect.objectContaining({ keyId: activeKeyId, status: "active" }),
      expect.objectContaining({ keyId: oldKeyId, status: "removed" }),
    ]);
  });

  it("retries a failed keyring cleanup from its persisted tombstone after restart", async () => {
    const oldKeyId = "diffgazer/cfg-existing/1";
    const keyringValues = new Map<string, string>([[oldKeyId, "sk-proj-existing"]]);
    writeJson(
      configPath(),
      v2Config([supportedRecord()], "cfg-existing", { secretsStorage: "keyring" }),
    );
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "keyring-reference",
          keyId: oldKeyId,
          status: "active",
        },
      ]),
    );
    keyring.readKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.get(key) ?? null,
    }));
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      keyringValues.set(key, value);
      return { ok: true, value: undefined };
    });
    keyring.deleteKeyringSecret.mockImplementation((key: string) => {
      if (key === oldKeyId) {
        return { ok: false, error: { code: "KEYRING_UNAVAILABLE", message: "keyring is locked" } };
      }
      return { ok: true, value: keyringValues.delete(key) };
    });
    const store = await loadStore();

    const migrated = await store.updateSettings({ secretsStorage: "file" });

    expect(migrated).toMatchObject({ ok: true, value: { secretsStorage: "file" } });
    expect(keyringValues.get(oldKeyId)).toBe("sk-proj-existing");
    expect(readJson<{ bindings: unknown[] }>(secretsPath())).toEqual({
      schemaVersion: 2,
      bindings: [
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: literalSecretPathFor("cfg-existing", 1),
          status: "active",
        },
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "keyring-reference",
          keyId: oldKeyId,
          status: "removed",
        },
      ],
    });
    expect(readFileSync(literalSecretPathFor("cfg-existing", 1), "utf8")).toBe("sk-proj-existing");

    keyring.deleteKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.delete(key),
    }));
    const restarted = (await loadStoreFactory())();
    await expect(restarted.ready()).resolves.toMatchObject({ ok: true });
    await vi.waitFor(() => {
      expect(keyringValues.has(oldKeyId)).toBe(false);
      expect(readJson<{ bindings: unknown[] }>(secretsPath()).bindings).toEqual([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: literalSecretPathFor("cfg-existing", 1),
          status: "active",
        },
      ]);
    });
    expect(readFileSync(literalSecretPathFor("cfg-existing", 1), "utf8")).toBe("sk-proj-existing");
  });

  it("never deletes a canonical keyring target shared by an active binding and tombstone", async () => {
    const keyId = getConfigurationSecretName("cfg-existing", 1);
    const keyringValues = new Map([[keyId, "active-secret"]]);
    writeJson(
      configPath(),
      v2Config([supportedRecord()], "cfg-existing", { secretsStorage: "keyring" }),
    );
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "keyring-reference",
          keyId,
          status: "active",
        },
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "keyring-reference",
          keyId,
          status: "removed",
        },
      ]),
    );
    keyring.readKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.get(key) ?? null,
    }));

    const restarted = (await loadStoreFactory())();
    await expect(restarted.ready()).resolves.toMatchObject({ ok: true });
    await vi.waitFor(() => {
      expect(readJson<{ bindings: unknown[] }>(secretsPath()).bindings).toEqual([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "keyring-reference",
          keyId,
          status: "active",
        },
      ]);
    });

    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    expect(keyringValues.get(keyId)).toBe("active-secret");
  });

  it("retries a failed file cleanup from its persisted tombstone after restart", async () => {
    const keyPath = literalSecretPathFor("cfg-existing", 1);
    writeJson(
      configPath(),
      v2Config([supportedRecord()], "cfg-existing", { secretsStorage: "file" }),
    );
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: keyPath,
          status: "active",
        },
      ]),
    );
    mkdirSync(dirname(keyPath), { recursive: true });
    writeFileSync(keyPath, "sk-proj-existing", { mode: 0o600 });
    const keyringValues = new Map<string, string>();
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      keyringValues.set(key, value);
      return { ok: true, value: undefined };
    });
    const store = await loadStore();

    chmodSync(dirname(keyPath), 0o500);
    try {
      const migrated = await store.updateSettings({ secretsStorage: "keyring" });

      expect(migrated).toMatchObject({ ok: true, value: { secretsStorage: "keyring" } });
      expect(readFileSync(keyPath, "utf8")).toBe("sk-proj-existing");
      expect(readJson<{ bindings: unknown[] }>(secretsPath())).toEqual({
        schemaVersion: 2,
        bindings: [
          {
            configurationId: "cfg-existing",
            revision: 1,
            kind: "keyring-reference",
            keyId: expect.stringContaining("cfg-existing"),
            status: "active",
          },
          {
            configurationId: "cfg-existing",
            revision: 1,
            kind: "file-0600",
            filePath: keyPath,
            status: "removed",
          },
        ],
      });
    } finally {
      chmodSync(dirname(keyPath), 0o700);
    }

    // No polling: `ready()` drains the startup tombstone retry, so the cleanup has already
    // run by the time it resolves. Work that outlives `ready()` escapes the temp home.
    const restarted = (await loadStoreFactory())();
    await expect(restarted.ready()).resolves.toMatchObject({ ok: true });
    expect(existsSync(keyPath)).toBe(false);
    expect(readJson<{ bindings: unknown[] }>(secretsPath()).bindings).toEqual([
      {
        configurationId: "cfg-existing",
        revision: 1,
        kind: "keyring-reference",
        keyId: expect.stringContaining("cfg-existing"),
        status: "active",
      },
    ]);
    expect(keyringValues.size).toBe(1);
  });

  it("retains a rollback-created binding tombstone when its cleanup also fails", async () => {
    const keyPath = literalSecretPathFor("cfg-existing", 1);
    const newKeyId = getConfigurationSecretName("cfg-existing", 1);
    writeJson(
      configPath(),
      v2Config([supportedRecord()], "cfg-existing", { secretsStorage: "file" }),
    );
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: keyPath,
          status: "active",
        },
      ]),
    );
    mkdirSync(dirname(keyPath), { recursive: true });
    writeFileSync(keyPath, "sk-proj-existing", { mode: 0o600 });
    const keyringValues = new Map<string, string>();
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      keyringValues.set(key, value);
      return { ok: true, value: undefined };
    });
    keyring.deleteKeyringSecret.mockImplementation((key: string) => {
      if (key === newKeyId) {
        return { ok: false, error: { code: "KEYRING_UNAVAILABLE", message: "keyring is locked" } };
      }
      return { ok: true, value: keyringValues.delete(key) };
    });
    const store = await loadStore();

    fsHooks.atomicWriteFileHook = async (filePath) => {
      if (filePath === configPath() || filePath === secretsPath()) {
        fsHooks.atomicWriteFileHook = null;
        throw new Error("Injected settings commit failure");
      }
    };

    const failed = await store.updateSettings({ secretsStorage: "keyring" });

    expect(failed).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(keyringValues.get(newKeyId)).toBe("sk-proj-existing");
    expect(readFileSync(keyPath, "utf8")).toBe("sk-proj-existing");
    expect(readJson<{ settings: { secretsStorage: string } }>(configPath()).settings).toMatchObject(
      {
        secretsStorage: "file",
      },
    );
    expect(readJson<{ bindings: unknown[] }>(secretsPath())).toEqual({
      schemaVersion: 2,
      bindings: [
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: keyPath,
          status: "active",
        },
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "keyring-reference",
          keyId: newKeyId,
          status: "removed",
        },
      ],
    });

    keyring.deleteKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.delete(key),
    }));
    const restarted = (await loadStoreFactory())();
    await expect(restarted.ready()).resolves.toMatchObject({ ok: true });
    expect(keyringValues.has(newKeyId)).toBe(false);
    expect(readJson<{ bindings: unknown[] }>(secretsPath()).bindings).toEqual([
      {
        configurationId: "cfg-existing",
        revision: 1,
        kind: "file-0600",
        filePath: keyPath,
        status: "active",
      },
    ]);
    expect(readFileSync(keyPath, "utf8")).toBe("sk-proj-existing");
  });

  it("preserves settings fields this binary does not know", async () => {
    writeJson(configPath(), v2Config([], null, { theme: "auto", futureSetting: { nested: true } }));
    const store = await loadStore();

    await expect(store.updateSettings({ theme: "dark" })).resolves.toMatchObject({ ok: true });

    expect(readJson<{ settings: Record<string, unknown> }>(configPath()).settings).toMatchObject({
      theme: "dark",
      futureSetting: { nested: true },
    });
  });

  it("refuses to clear secrets storage once it is configured", async () => {
    writeJson(configPath(), v2Config([], null, { secretsStorage: "file" }));
    const store = await loadStore();

    await expect(store.updateSettings({ secretsStorage: null })).resolves.toMatchObject({
      ok: false,
      error: { code: "STORAGE_NOT_CONFIGURED" },
    });
    expect(readJson<{ settings: { secretsStorage: string } }>(configPath()).settings).toMatchObject(
      {
        secretsStorage: "file",
      },
    );
  });

  it("refuses keyring storage when the keyring is unavailable", async () => {
    keyring.isKeyringAvailable.mockReturnValue(false);
    writeJson(configPath(), v2Config([], null, { secretsStorage: "file" }));
    const store = await loadStore();

    await expect(store.updateSettings({ secretsStorage: "keyring" })).resolves.toMatchObject({
      ok: false,
      error: { code: "KEYRING_UNAVAILABLE" },
    });
  });

  it("updates unrelated settings on a keyring install without probing the keyring", async () => {
    writeJson(configPath(), v2Config([], null, { secretsStorage: "keyring", theme: "auto" }));
    const store = await loadStore();
    keyring.isKeyringAvailable.mockReturnValue(false);
    keyring.isKeyringAvailable.mockClear();

    await expect(store.updateSettings({ theme: "dark" })).resolves.toMatchObject({ ok: true });

    expect(keyring.isKeyringAvailable).not.toHaveBeenCalled();
    expect(readJson<{ settings: Record<string, unknown> }>(configPath()).settings).toMatchObject({
      secretsStorage: "keyring",
      theme: "dark",
    });
  });

  it("reports a failed settings commit and leaves the prior document byte-identical", async () => {
    writeJson(configPath(), v2Config([supportedRecord()], null, { theme: "auto" }));
    const store = await loadStore();
    const before = readFileSync(configPath(), "utf8");
    fsHooks.removeFileSyncHook = (filePath) => {
      if (filePath !== secretsPath()) return false;
      fsHooks.removeFileSyncHook = null;
      throw new Error("Injected secrets removal failure");
    };

    const result = await store.updateSettings({ theme: "dark" });

    expect(result).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(readFileSync(configPath(), "utf8")).toBe(before);
    await expect(store.readSettings()).resolves.toMatchObject({
      ok: true,
      value: { theme: "auto" },
    });
  });
});

describe("config store V2 documents", () => {
  it("unknown future records keep their exact bytes when a neighboring record is deleted", async () => {
    const unknownRecord =
      '{"schemaVersion":99,"configurationId":"cfg-future","futureField":{"nested":true},"oddValue":"\\u0041"}';
    const recordA = JSON.stringify(supportedRecord({ configurationId: "cfg-a" }));
    mkdirSync(dirname(configPath()), { recursive: true });
    writeFileSync(
      configPath(),
      `{"schemaVersion":2,"settings":{},"selectedConfigurationId":null,"configurations":[${recordA},${unknownRecord}]}\n`,
    );
    const store = await loadStore();

    const deleted = await store.runConfigurationAction({
      action: "delete",
      configurationId: "cfg-a",
      expectedRevision: 1,
    });
    expect(deleted).toMatchObject({ ok: true, value: { action: "delete", status: "succeeded" } });

    const text = readFileSync(configPath(), "utf8");
    expect(text).toContain(unknownRecord);
    const persisted = readJson<{
      schemaVersion: number;
      configurations: Array<{ configurationId: string }>;
    }>(configPath());
    expect(persisted.schemaVersion).toBe(2);
    expect(persisted.configurations).toHaveLength(1);
    expect(persisted.configurations[0]?.configurationId).toBe("cfg-future");
  });

  it("V2 store actions never write [LEGACY_V1_HAS_API_KEY_PROPERTY] into config.json", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-no-hasapikey" }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");
    await store.runConfigurationAction({
      action: "select",
      configurationId,
      modelId: "gemini-2.5-flash",
    });
    await store.runConfigurationAction(updateGeminiAction(configurationId, 1));

    const configText = readFileSync(configPath(), "utf8");
    expect(configText).not.toContain(LEGACY_V1_HAS_API_KEY_PROPERTY);
    expect(readFileSync(secretsPath(), "utf8")).not.toContain(LEGACY_V1_HAS_API_KEY_PROPERTY);
  });
});
