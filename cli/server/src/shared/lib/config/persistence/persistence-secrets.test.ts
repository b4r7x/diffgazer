import { readdir, readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { homePath, readJson, tempHome, writeJson } from "./persistence.test-support.js";

import "./persistence.test-support.js";

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
    const { loadSecrets, persistSecrets } = await import("./secrets.js");

    const secrets = loadSecrets();

    expect(secrets).toEqual({
      providers: { openrouter: "  key-with-padding  " },
      unknownSecrets: { gemini: "", groq: "   " },
    });
    persistSecrets(secrets);
    await expect(readJson<{ providers: Record<string, unknown> }>(homePath("secrets.json"))).resolves.toEqual(
      {
        providers: {
          gemini: "",
          groq: "   ",
          openrouter: "  key-with-padding  ",
        },
      },
    );
  });

  it("keeps known secrets loadable when one entry uses an unknown ref kind", async () => {
    await writeJson("secrets.json", {
      providers: {
        gemini: "real-key",
        zai: { kind: "vault", path: "secret/zai" },
      },
    });
    const { loadSecrets, persistSecrets } = await import("./secrets.js");

    const secrets = loadSecrets();
    const files = await readdir(tempHome);
    expect(files.some((file) => /^secrets\.json\..+\.backup$/.test(file))).toBe(false);
    expect(secrets.providers).toEqual({ gemini: "real-key" });

    persistSecrets(secrets);
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
    const { loadSecrets, persistSecrets } = await import("./secrets.js");

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

    persistSecrets(secrets);
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
    const { loadSecrets, persistSecrets } = await import("./secrets.js");

    persistSecrets(loadSecrets());

    const backupName = (await readdir(tempHome)).find((candidate) =>
      /^secrets\.json\..+\.backup$/.test(candidate),
    );
    expect(backupName).toBeDefined();
    if (!backupName) return;
    await expect(readFile(homePath(backupName), "utf-8")).resolves.toBe(original);
    await expect(readFile(filePath, "utf-8")).resolves.not.toBe(original);
  });

  it("persists secrets as a real JSON file", async () => {
    const { persistSecrets } = await import("./secrets.js");

    persistSecrets({ providers: { gemini: "key" } });

    await expect(readJson(homePath("secrets.json"))).resolves.toEqual({
      providers: { gemini: "key" },
    });
  });

  it("removes the secrets file when it exists", async () => {
    await writeJson("secrets.json", { providers: { gemini: "key" } });
    const { removeSecretsFile } = await import("./secrets.js");

    expect(removeSecretsFile()).toBe(true);
    expect(removeSecretsFile()).toBe(false);
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
