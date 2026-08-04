import { readdir, stat, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { atomicWriteFile } from "../../fs.js";
import { homePath, tempHome, writeJson } from "./persistence.test-support.js";

import "./persistence.test-support.js";

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
    expect(new TextDecoder().decode(serializeSecretsV2(document))).toContain(
      '"configurationId":"gemini-primary","revision":3',
    );
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

  it("restores both documents byte-for-byte from a mode-0600 recovery sidecar", async () => {
    const {
      getSecretsRecoveryPath,
      readDocumentRecovery,
      reconcileDocumentRecoveryAtStartup,
      writeDocumentRecovery,
    } = await import("./secrets-recovery.js");
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

    await expect(reconcileDocumentRecoveryAtStartup()).resolves.toBeNull();

    const { loadSecretsV2 } = await import("./secrets.js");
    const { loadConfigV2 } = await import("./config.js");
    expect(loadSecretsV2().bindings[0]).toMatchObject({
      binding: { configurationId: "config-before", revision: 7 },
    });
    expect(loadConfigV2().settings).toEqual({ theme: "dark" });
    await expect(stat(getSecretsRecoveryPath())).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("removes both files when the recovery snapshot records that neither existed", async () => {
    const { reconcileDocumentRecoveryAtStartup, writeDocumentRecovery } = await import(
      "./secrets-recovery.js"
    );
    await atomicWriteFile(homePath("secrets.json"), '{"schemaVersion":2,"bindings":[]}\n', 0o600);
    await writeDocumentRecovery({ config: null, secrets: null });

    await expect(reconcileDocumentRecoveryAtStartup()).resolves.toBeNull();

    await expect(stat(homePath("secrets.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("V1 secrets loader", () => {
  it("loads default secrets when no file exists", async () => {
    const { loadSecretsV1 } = await import("./secrets.js");
    expect(loadSecretsV1()).toEqual({ providers: {} });
  });

  it("loads file-backed secrets", async () => {
    await writeJson("secrets.json", { providers: { gemini: "key-123" } });
    const { loadSecretsV1 } = await import("./secrets.js");

    expect(loadSecretsV1()).toEqual({ providers: { gemini: "key-123" } });
  });

  it("keeps empty literals opaque while preserving whitespace around a nonempty literal", async () => {
    await writeJson("secrets.json", {
      providers: {
        gemini: "",
        groq: "   ",
        openrouter: "  key-with-padding  ",
      },
    });
    const { loadSecretsV1 } = await import("./secrets.js");

    expect(loadSecretsV1()).toEqual({
      providers: { openrouter: "  key-with-padding  " },
      unknownSecrets: { gemini: "", groq: "   " },
    });
  });

  it("keeps known secrets loadable when one entry uses an unknown ref kind", async () => {
    await writeJson("secrets.json", {
      providers: {
        gemini: "real-key",
        zai: { kind: "vault", path: "secret/zai" },
      },
    });
    const { loadSecretsV1 } = await import("./secrets.js");

    const secrets = loadSecretsV1();

    const files = await readdir(tempHome);
    expect(files.some((file) => /^secrets\.json\..+\.backup$/.test(file))).toBe(false);
    expect(secrets.providers).toEqual({ gemini: "real-key" });
    expect(secrets.unknownSecrets).toEqual({ zai: { kind: "vault", path: "secret/zai" } });
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
    const { loadSecretsV1 } = await import("./secrets.js");

    expect(loadSecretsV1()).toEqual({
      providers: {
        gemini: { kind: "env", varName: "GOOGLE_API_KEY" },
      },
      unknownSecrets: {
        groq: futureEnvRef,
        openrouter: foreignOpenRouterRef,
        "future-provider": futureProviderRef,
      },
    });
  });

  it("quarantines a JSON-corrupt secrets.json and returns defaults", async () => {
    await writeFile(homePath("secrets.json"), "{not json", "utf-8");
    const { loadSecretsV1 } = await import("./secrets.js");

    expect(loadSecretsV1()).toEqual({ providers: {} });
    const files = await readdir(tempHome);
    expect(files.some((file) => /^secrets\.json\..+\.backup$/.test(file))).toBe(true);
  });
});
