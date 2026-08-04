import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  bindWriteOnlySecret,
  createEnvironmentSecretBinding,
  createFileSecretBinding,
  createKeyringSecretBinding,
  createLocalBearerBinding,
  createNoneSecretBinding,
  deleteSecretBinding,
  deleteSecretBindingTransactional,
  type KeyringSecretStore,
  markSecretBindingRemoved,
  resolveSecretBinding,
  SecretBindingError,
  serializeSecretBinding,
  toSafeSecretBinding,
  writeSecretBinding,
} from "./secret-bindings.js";

const tempDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "diffgazer-secret-binding-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
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
    const directory = await createTempDirectory();
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
    const directory = await createTempDirectory();
    const filePath = join(directory, "file-secret");
    const binding = createFileSecretBinding("config-a", 1, filePath);

    await writeSecretBinding(binding, "file-value");
    await expect(stat(filePath)).resolves.toMatchObject({ mode: expect.any(Number) });
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    await expect(resolveSecretBinding(binding)).resolves.toBe("file-value");

    await chmod(filePath, 0o644);
    await expect(resolveSecretBinding(binding)).rejects.toMatchObject({ code: "FILE_MODE_UNSAFE" });
  });

  it("accepts owner-only modes stricter than 0600 and rejects any group or other access", async () => {
    const directory = await createTempDirectory();
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

  it("deletes only after revoke, cancellation, and descendant drain", async () => {
    const directory = await createTempDirectory();
    const filePath = join(directory, "deletable-secret");
    const binding = createFileSecretBinding("config-a", 3, filePath);
    await writeFile(filePath, "secret", { mode: 0o600 });
    const events: string[] = [];

    await deleteSecretBindingTransactional(binding, {
      revoke: () => {
        events.push("revoke");
      },
      cancel: () => {
        events.push("cancel");
      },
      drain: () => {
        events.push("drain");
      },
    });
    events.push("deleted");
    expect(events).toEqual(["revoke", "cancel", "drain", "deleted"]);
    await expect(stat(filePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not delete a binding when cancellation or drain fails", async () => {
    const directory = await createTempDirectory();
    const filePath = join(directory, "retained-secret");
    const binding = createFileSecretBinding("config-a", 3, filePath);
    await writeFile(filePath, "secret", { mode: 0o600 });

    const events: string[] = [];
    await expect(
      deleteSecretBindingTransactional(binding, {
        revoke: () => {
          events.push("revoke");
        },
        cancel: () => {
          throw new Error("cancelled work could not drain");
        },
        drain: () => {
          events.push("drain");
        },
      }),
    ).rejects.toThrow("cancelled work could not drain");
    expect(events).toEqual(["revoke"]);
    await expect(stat(filePath)).resolves.toBeDefined();
    await expect(deleteSecretBinding(binding)).resolves.toBe(true);
  });
});
