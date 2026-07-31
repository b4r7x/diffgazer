import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { homePath, readJson, tempHome, writeJson } from "./persistence.test-support.js";

import "./persistence.test-support.js";

const encoder = new TextEncoder();

describe("V2 secrets persistence", () => {
  it("binds secret references to configuration identity and revision", () => {
    return import("./secrets.js").then(({ decodeSecretsV2, serializeSecretsV2 }) => {
      const input = encoder.encode(
        '{"schemaVersion":2,"bindings":[{"configurationId":"gemini-primary","revision":3,"status":"active","kind":"environment-reference","varName":"GOOGLE_API_KEY"}]}\n',
      );

      const document = decodeSecretsV2(input);

      expect(document.bindings[0]).toMatchObject({
        status: "supported",
        binding: { configurationId: "gemini-primary", revision: 3 },
      });
      expect(new TextDecoder().decode(serializeSecretsV2(document))).toContain(
        '"configurationId":"gemini-primary","revision":3',
      );
    });
  });

  it("retains removed and unknown bindings without making unknown data client-visible", async () => {
    const { decodeSecretsV2, serializeSecretsV2, toSafeSecretsV2 } = await import("./secrets.js");
    const removed = {
      configurationId: "legacy-zai-coding",
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
    const safe = JSON.stringify(toSafeSecretsV2(document));
    expect(safe).toContain("legacy-zai-coding");
    expect(safe).not.toContain("private-keyring-location");
    expect(safe).not.toContain("future-configuration");
    expect(safe).not.toContain("must-not-leak");
  });

  it("writes atomically with mode 0600 and loads the same bindings", async () => {
    const { decodeSecretsV2, loadSecretsV2, persistSecretsV2 } = await import("./secrets.js");
    const document = decodeSecretsV2(
      encoder.encode(
        '{"schemaVersion":2,"bindings":[{"configurationId":"config-a","revision":2,"status":"active","kind":"none"}]}',
      ),
    );

    await persistSecretsV2(document);

    const path = homePath("secrets.json");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(loadSecretsV2().bindings[0]).toMatchObject({
      binding: { configurationId: "config-a", revision: 2, kind: "none" },
    });
  });

  it("returns an empty V2 document when no secrets file exists", async () => {
    const { loadSecretsV2 } = await import("./secrets.js");
    expect(loadSecretsV2()).toEqual({ schemaVersion: 2, bindings: [] });
  });

  it("recovers the prior V2 binding document from a mode-0600 sidecar", async () => {
    const { decodeSecretsV2, loadSecretsV2, persistSecretsV2 } = await import("./secrets.js");
    const {
      getSecretsRecoveryPath,
      readSecretsRecoveryV2,
      reconcileSecretsRecoveryV2AtStartup,
      writeSecretsRecoveryV2,
    } = await import("./secrets-recovery.js");
    const previous = decodeSecretsV2(
      encoder.encode(
        '{"schemaVersion":2,"bindings":[{"configurationId":"config-before","revision":7,"status":"removed","kind":"none"}]}',
      ),
    );
    await writeSecretsRecoveryV2(previous);
    expect((await stat(getSecretsRecoveryPath())).mode & 0o777).toBe(0o600);
    const read = readSecretsRecoveryV2();
    expect(read.kind).toBe("valid");
    if (read.kind !== "valid") return;
    expect(read.previousSecrets?.bindings[0]).toMatchObject({
      status: "removed",
      binding: { configurationId: "config-before", revision: 7 },
    });

    await persistSecretsV2(
      decodeSecretsV2(
        encoder.encode(
          '{"schemaVersion":2,"bindings":[{"configurationId":"config-after","revision":8,"status":"active","kind":"none"}]}',
        ),
      ),
    );
    await expect(reconcileSecretsRecoveryV2AtStartup()).resolves.toBeNull();
    expect(loadSecretsV2().bindings[0]).toMatchObject({
      binding: { configurationId: "config-before", revision: 7 },
    });
    await expect(stat(getSecretsRecoveryPath())).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("secrets persistence", () => {
  it("loads default secrets when no file exists", async () => {
    const { loadSecrets } = await import("./secrets.js");
    expect(loadSecrets()).toEqual({ providers: {} });
  });

  it("loads file-backed secrets", async () => {
    await writeJson("secrets.json", { providers: { gemini: "key-123" } });
    const { loadSecrets } = await import("./secrets.js");

    expect(loadSecrets()).toEqual({ providers: { gemini: "key-123" } });
  });

  it("keeps empty literals opaque while preserving whitespace around a nonempty literal", async () => {
    await writeJson("secrets.json", {
      providers: {
        gemini: "",
        groq: "   ",
        openrouter: "  key-with-padding  ",
      },
    });
    const { loadSecrets, persistSecretsAsync } = await import("./secrets.js");

    const secrets = loadSecrets();

    expect(secrets).toEqual({
      providers: { openrouter: "  key-with-padding  " },
      unknownSecrets: { gemini: "", groq: "   " },
    });
    await persistSecretsAsync(secrets);
    await expect(
      readJson<{ providers: Record<string, unknown> }>(homePath("secrets.json")),
    ).resolves.toEqual({
      providers: {
        gemini: "",
        groq: "   ",
        openrouter: "  key-with-padding  ",
      },
    });
  });

  it("keeps known secrets loadable when one entry uses an unknown ref kind", async () => {
    await writeJson("secrets.json", {
      providers: {
        gemini: "real-key",
        zai: { kind: "vault", path: "secret/zai" },
      },
    });
    const { loadSecrets, persistSecretsAsync } = await import("./secrets.js");

    const secrets = loadSecrets();
    const files = await readdir(tempHome);
    expect(files.some((file) => /^secrets\.json\..+\.backup$/.test(file))).toBe(false);
    expect(secrets.providers).toEqual({ gemini: "real-key" });

    await persistSecretsAsync(secrets);
    const persisted = await readJson<{ providers: Record<string, unknown> }>(
      homePath("secrets.json"),
    );
    expect(persisted.providers.zai).toEqual({ kind: "vault", path: "secret/zai" });
    expect(persisted.providers.gemini).toBe("real-key");
  });

  it("loads only provider-owned env refs and preserves foreign records opaquely", async () => {
    const foreignOpenRouterRef = { kind: "env", varName: "AWS_SECRET_ACCESS_KEY" };
    const futureProviderRef = { kind: "env", varName: "FUTURE_PROVIDER_API_KEY" };
    const futureEnvRef = {
      kind: "env",
      varName: "GROQ_API_KEY",
      source: "future-secret-store",
    };
    await writeJson("secrets.json", {
      providers: {
        gemini: { kind: "env", varName: "GOOGLE_API_KEY" },
        groq: futureEnvRef,
        openrouter: foreignOpenRouterRef,
        "future-provider": futureProviderRef,
      },
    });
    const { loadSecrets, persistSecretsAsync } = await import("./secrets.js");

    const secrets = loadSecrets();

    expect(secrets).toEqual({
      providers: {
        gemini: { kind: "env", varName: "GOOGLE_API_KEY" },
      },
      unknownSecrets: {
        groq: futureEnvRef,
        openrouter: foreignOpenRouterRef,
        "future-provider": futureProviderRef,
      },
    });

    await persistSecretsAsync(secrets);
    await expect(
      readJson<{ providers: Record<string, unknown> }>(homePath("secrets.json")),
    ).resolves.toEqual({
      providers: {
        groq: futureEnvRef,
        openrouter: foreignOpenRouterRef,
        "future-provider": futureProviderRef,
        gemini: { kind: "env", varName: "GOOGLE_API_KEY" },
      },
    });
  });

  it("quarantines a JSON-corrupt secrets.json and returns defaults", async () => {
    await writeFile(homePath("secrets.json"), "{not json", "utf-8");
    const { loadSecrets } = await import("./secrets.js");

    expect(loadSecrets()).toEqual({ providers: {} });
    const files = await readdir(tempHome);
    expect(files.some((file) => /^secrets\.json\..+\.backup$/.test(file))).toBe(true);
  });

  it.each([
    { invalidRoot: null, label: "null secrets root" },
    { invalidRoot: ["invalid"], label: "array secrets root" },
  ])("quarantines a $label and preserves its backup after a normal persist", async ({
    invalidRoot,
  }) => {
    await writeJson("secrets.json", invalidRoot);
    const filePath = homePath("secrets.json");
    const original = await readFile(filePath, "utf-8");
    const { loadSecrets, persistSecretsAsync } = await import("./secrets.js");

    loadSecrets();
    await persistSecretsAsync({ providers: { gemini: "key" } });

    const backupName = (await readdir(tempHome)).find((candidate) =>
      /^secrets\.json\..+\.backup$/.test(candidate),
    );
    expect(backupName).toBeDefined();
    if (!backupName) return;
    await expect(readFile(homePath(backupName), "utf-8")).resolves.toBe(original);
    await expect(readFile(filePath, "utf-8")).resolves.not.toBe(original);
  });

  it("persists secrets as a real JSON file", async () => {
    const { persistSecretsAsync } = await import("./secrets.js");

    await persistSecretsAsync({ providers: { gemini: "key" } });

    await expect(readJson(homePath("secrets.json"))).resolves.toEqual({
      providers: { gemini: "key" },
    });
  });

  it("removes the secrets file once the last secret is cleared", async () => {
    await writeJson("secrets.json", { providers: { gemini: "key" } });
    const { persistSecretsAsync } = await import("./secrets.js");

    await persistSecretsAsync({ providers: {} }, { providers: { gemini: "key" } });

    await expect(stat(homePath("secrets.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("syncs providers with file secrets and ignores file secrets for keyring storage", async () => {
    const { syncProvidersWithSecrets } = await import("./secrets.js");
    const providers = [{ provider: "gemini" as const, hasApiKey: false, isActive: false }];
    const secrets = { providers: { gemini: "key", zai: "key2" } };

    expect(syncProvidersWithSecrets(providers, secrets, "file")).toEqual([
      { provider: "gemini", hasApiKey: true, isActive: false },
      { provider: "zai", hasApiKey: true, isActive: false },
    ]);
    expect(syncProvidersWithSecrets(providers, secrets, "keyring")).toEqual(providers);
  });
});
