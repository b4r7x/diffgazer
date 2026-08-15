import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertTempHome } from "../testing/temp-home.js";
import {
  bindWriteOnlySecret,
  createEnvironmentSecretBinding,
  createFileSecretBinding,
  createKeyringSecretBinding,
  createLocalBearerBinding,
  createNoneSecretBinding,
  deleteSecretBinding,
  type KeyringSecretStore,
  markSecretBindingRemoved,
  resolveSecretBinding,
  SecretBindingError,
  serializeSecretBinding,
  toSafeSecretBinding,
  writeSecretBinding,
} from "./secret-bindings.js";

const tempDirectories: string[] = [];

async function createTempDirectory(prefix = "diffgazer-secret-binding-"): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  tempDirectories.push(directory);
  return directory;
}

/** File-backed bindings only resolve inside the app-owned config directory. */
async function createCredentialDirectory(): Promise<string> {
  const home = await createTempDirectory();
  assertTempHome(home);
  process.env.DIFFGAZER_HOME = home;
  return join(home, "credentials");
}

// Binding reads and writes are awaited by every test and start no background writer, so the
// temp directories only have to fall before DIFFGAZER_HOME is dropped, which `paths.ts`
// re-reads per call.
afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
  delete process.env.DIFFGAZER_HOME;
});

function createMemoryKeyring(): KeyringSecretStore {
  const values = new Map<string, string>();
  return {
    read: (keyId) => values.get(keyId) ?? null,
    write: (keyId, value) => {
      values.set(keyId, value);
    },
    delete: (keyId) => values.delete(keyId),
  };
}

describe("configuration-bound secret bindings", () => {
  it("keeps write-only values out of serialized and safe projections", async () => {
    const directory = await createCredentialDirectory();
    const filePath = join(directory, "secret");
    const binding = await bindWriteOnlySecret(
      "config-a",
      1,
      {
        kind: "literal",
        value: "literal-never-serialized",
      },
      { filePath },
    );

    expect(serializeSecretBinding(binding)).not.toContain("literal-never-serialized");
    expect(JSON.stringify(toSafeSecretBinding(binding))).not.toContain("literal-never-serialized");
    expect(JSON.stringify(toSafeSecretBinding(binding))).not.toContain(filePath);
    await expect(readFile(filePath, "utf8")).resolves.toBe("literal-never-serialized");
  });

  it("isolates configuration IDs and binding revisions during resolution", async () => {
    const binding = createEnvironmentSecretBinding("config-a", 2, "DIFFGAZER_TEST_SECRET");
    const env = { DIFFGAZER_TEST_SECRET: "environment-value" };

    await expect(
      resolveSecretBinding(binding, { env }, { configurationId: "config-a", revision: 2 }),
    ).resolves.toBe("environment-value");
    await expect(
      resolveSecretBinding(binding, { env }, { configurationId: "config-b", revision: 2 }),
    ).rejects.toMatchObject({
      code: "BINDING_MISMATCH",
    });
    await expect(
      resolveSecretBinding(binding, { env }, { configurationId: "config-a", revision: 1 }),
    ).rejects.toMatchObject({
      code: "BINDING_MISMATCH",
    });
  });

  it("writes literal file secrets with mode 0600 and refuses unsafe files", async () => {
    const directory = await createCredentialDirectory();
    const filePath = join(directory, "file-secret");
    const binding = createFileSecretBinding("config-a", 1, filePath);

    await writeSecretBinding(binding, "file-value");
    await expect(stat(filePath)).resolves.toMatchObject({ mode: expect.any(Number) });
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    await expect(resolveSecretBinding(binding)).resolves.toBe("file-value");

    await chmod(filePath, 0o644);
    await expect(resolveSecretBinding(binding)).rejects.toMatchObject({ code: "FILE_MODE_UNSAFE" });
  });

  it("tightens a pre-existing group-readable credential file before writing the secret", async () => {
    const directory = await createCredentialDirectory();
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const filePath = join(directory, "preexisting-secret");
    await writeFile(filePath, "stale", { mode: 0o644 });
    const binding = createFileSecretBinding("config-a", 1, filePath);

    await writeSecretBinding(binding, "rotated-value");

    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    await expect(resolveSecretBinding(binding)).resolves.toBe("rotated-value");
  });

  it("accepts owner-only modes stricter than 0600 and rejects any group or other access", async () => {
    const directory = await createCredentialDirectory();
    const filePath = join(directory, "hardened-secret");
    const binding = createFileSecretBinding("config-a", 1, filePath);
    await writeSecretBinding(binding, "hardened-value");

    // A hardened install may drop the owner write bit; the file is still private.
    await chmod(filePath, 0o400);
    await expect(resolveSecretBinding(binding)).resolves.toBe("hardened-value");

    await chmod(filePath, 0o640);
    await expect(resolveSecretBinding(binding)).rejects.toMatchObject({ code: "FILE_MODE_UNSAFE" });

    await chmod(filePath, 0o666);
    await expect(resolveSecretBinding(binding)).rejects.toMatchObject({ code: "FILE_MODE_UNSAFE" });
  });

  it("reads file secrets on Windows without applying the POSIX group/other gate", async () => {
    const platformSpy = vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    const directory = await createCredentialDirectory();
    const filePath = join(directory, "win32-secret");
    const binding = createFileSecretBinding("config-a", 1, filePath);
    await writeSecretBinding(binding, "win32-value");
    await chmod(filePath, 0o666);

    await expect(resolveSecretBinding(binding)).resolves.toBe("win32-value");
    platformSpy.mockRestore();
  });

  it("refuses to read, write, or delete a file binding pointing outside the app directory", async () => {
    await createCredentialDirectory();
    const outside = await createTempDirectory("diffgazer-secret-binding-victim-");
    const victimPath = join(outside, "victim.key");
    await writeFile(victimPath, "external-victim", { mode: 0o600 });
    const before = await lstat(victimPath);
    const binding = createFileSecretBinding("config-a", 1, victimPath);

    await expect(writeSecretBinding(binding, "must-not-land")).rejects.toMatchObject({
      code: "BINDING_UNAVAILABLE",
    });
    await expect(resolveSecretBinding(binding)).rejects.toMatchObject({
      code: "BINDING_UNAVAILABLE",
    });
    await expect(deleteSecretBinding(binding)).rejects.toMatchObject({ code: "DELETE_FAILED" });

    await expect(readFile(victimPath, "utf8")).resolves.toBe("external-victim");
    expect(await readdir(outside)).toEqual(["victim.key"]);
    expect((await lstat(victimPath)).ino).toBe(before.ino);
  });

  it("refuses a file binding naming another app-owned file in the Diffgazer home", async () => {
    const credentials = await createCredentialDirectory();
    const home = dirname(credentials);
    const configPath = join(home, "config.json");
    await writeFile(configPath, '{"schemaVersion":2}', { mode: 0o600 });
    const binding = createFileSecretBinding("config-a", 1, configPath);

    await expect(resolveSecretBinding(binding)).rejects.toMatchObject({
      code: "BINDING_UNAVAILABLE",
    });
    await expect(deleteSecretBinding(binding)).rejects.toMatchObject({ code: "DELETE_FAILED" });

    await expect(readFile(configPath, "utf8")).resolves.toBe('{"schemaVersion":2}');
  });

  it("refuses a credential file that is a symlink to a target outside the app directory", async () => {
    const directory = await createCredentialDirectory();
    const outside = await createTempDirectory("diffgazer-secret-binding-victim-");
    const victimPath = join(outside, "victim.key");
    await writeFile(victimPath, "external-victim", { mode: 0o600 });
    const seed = createFileSecretBinding("config-a", 1, join(directory, "seed"));
    await writeSecretBinding(seed, "seed-value");

    const linkPath = join(directory, "linked-secret");
    await symlink(victimPath, linkPath);
    const binding = createFileSecretBinding("config-a", 1, linkPath);

    await expect(resolveSecretBinding(binding)).rejects.toMatchObject({
      code: "BINDING_UNAVAILABLE",
    });
    await expect(writeSecretBinding(binding, "must-not-land")).rejects.toMatchObject({
      code: "BINDING_UNAVAILABLE",
    });
    await expect(readFile(victimPath, "utf8")).resolves.toBe("external-victim");
  });

  it("supports keyring, environment, none, and optional local bearer bindings", async () => {
    const keyring = createMemoryKeyring();
    const keyringBinding = createKeyringSecretBinding("config-a", 1, "config-a/1/credential");
    await writeSecretBinding(keyringBinding, "keyring-value", { keyring });
    await expect(resolveSecretBinding(keyringBinding, { keyring })).resolves.toBe("keyring-value");

    const environmentBinding = createEnvironmentSecretBinding(
      "config-a",
      1,
      "DIFFGAZER_ENV_SECRET",
    );
    await expect(
      resolveSecretBinding(environmentBinding, { env: { DIFFGAZER_ENV_SECRET: "env-value" } }),
    ).resolves.toBe("env-value");

    const noneBinding = createNoneSecretBinding("config-a", 1);
    await expect(resolveSecretBinding(noneBinding)).resolves.toBeNull();

    const bearerBinding = createLocalBearerBinding(
      "config-a",
      1,
      "keyring-reference",
      "config-a/1/bearer",
    );
    await writeSecretBinding(bearerBinding, "bearer-value", { keyring });
    await expect(resolveSecretBinding(bearerBinding, { keyring })).resolves.toBe("bearer-value");
    await expect(
      writeSecretBinding(
        createLocalBearerBinding("config-a", 1, "environment-reference", "DIFFGAZER_ENV_SECRET"),
        "must-not-write",
        { env: { DIFFGAZER_ENV_SECRET: "existing" } },
      ),
    ).rejects.toMatchObject({ code: "READ_ONLY_REFERENCE" });
  });

  it("retains unknown and removed bindings without making them executable", async () => {
    const active = createKeyringSecretBinding("legacy-removed-zai-plan", 4, "legacy/4");
    const unknown = createKeyringSecretBinding("legacy-removed-zai-plan", 4, "legacy/4", "unknown");
    const removed = markSecretBindingRemoved(active);

    expect(JSON.parse(serializeSecretBinding(unknown))).toMatchObject({
      configurationId: "legacy-removed-zai-plan",
      revision: 4,
      status: "unknown",
    });
    expect(JSON.parse(serializeSecretBinding(removed))).toMatchObject({
      configurationId: "legacy-removed-zai-plan",
      revision: 4,
      status: "removed",
    });
    await expect(
      resolveSecretBinding(unknown, { keyring: createMemoryKeyring() }),
    ).rejects.toMatchObject({
      code: "BINDING_UNAVAILABLE",
    });
    await expect(
      resolveSecretBinding(removed, { keyring: createMemoryKeyring() }),
    ).rejects.toMatchObject({
      code: "BINDING_UNAVAILABLE",
    });
    expect(serializeSecretBinding(removed)).not.toContain('"productId":"zai"');
  });

  it("never relabels or sends a removed-product binding", async () => {
    const keyring = createMemoryKeyring();
    const removed = markSecretBindingRemoved(
      createKeyringSecretBinding("legacy-removed-zai-plan", 1, "legacy-removed-zai-plan/1"),
    );

    await expect(resolveSecretBinding(removed, { keyring })).rejects.toBeInstanceOf(
      SecretBindingError,
    );
    expect(await keyring.read("legacy-removed-zai-plan/1")).toBeNull();
    expect(toSafeSecretBinding(removed)).toMatchObject({
      configurationId: "legacy-removed-zai-plan",
      status: "removed",
    });
  });
});
