import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertHeadOk,
  assertRegistryContentFresh,
  publicRegistryIsGated,
  registryFreshnessTargets,
  requiredEndpoints,
  sha256Hex,
} from "./check-live-registry.mjs";

test("required endpoints include the keys registry route", () => {
  assert.ok(requiredEndpoints.some((url) => url.includes("/r/keys/")));
});

test("required endpoints include the published editor schema", () => {
  assert.ok(requiredEndpoints.some((url) => url.endsWith("/schema/diffgazer.json")));
});

test("every required endpoint maps to a committed freshness artifact", () => {
  assert.deepEqual(
    requiredEndpoints.slice().sort(),
    registryFreshnessTargets.map((target) => target.url).sort(),
  );
});

test("assertHeadOk rejects non-200 responses", async () => {
  await assert.rejects(
    () =>
      assertHeadOk("https://r.b4r7.dev/r/keys/missing-route.json", async () => ({
        status: 404,
      })),
    /returned 404/,
  );
});

test("publicRegistryIsGated reads the PUBLISH_GATED literal", async () => {
  const dir = mkdtempSync(join(tmpdir(), "publish-gated-"));
  try {
    const gatedFile = join(dir, "gated.ts");
    writeFileSync(gatedFile, "export const PUBLISH_GATED = true;\n");
    assert.equal(await publicRegistryIsGated(gatedFile), true);

    const ungatedFile = join(dir, "ungated.ts");
    writeFileSync(ungatedFile, "export const PUBLISH_GATED = false;\n");
    assert.equal(await publicRegistryIsGated(ungatedFile), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("publicRegistryIsGated fails loudly when the literal is gone", async () => {
  const dir = mkdtempSync(join(tmpdir(), "publish-gated-"));
  try {
    const doctored = join(dir, "doctored.ts");
    writeFileSync(doctored, "export const SOMETHING_ELSE = true;\n");
    await assert.rejects(() => publicRegistryIsGated(doctored), /PUBLISH_GATED/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("assertRegistryContentFresh rejects promoted SHA drift", async () => {
  const localBody = '{"name":"local"}\n';
  const liveBody = '{"name":"live"}\n';

  await assert.rejects(
    () =>
      assertRegistryContentFresh(async () => ({
        ok: true,
        text: async () => liveBody,
      })),
    /SHA mismatch/,
  );

  assert.equal(sha256Hex(localBody), sha256Hex('{"name":"local"}\n'));
  assert.notEqual(sha256Hex(localBody), sha256Hex(liveBody));
});

test("assertRegistryContentFresh resolves when every mapped body matches its source", async () => {
  const bodyByUrl = new Map(
    registryFreshnessTargets.map((target) => [target.url, readFileSync(target.path, "utf8")]),
  );

  await assertRegistryContentFresh(async (url) => ({
    ok: true,
    text: async () => bodyByUrl.get(url),
  }));
});

test("assertRegistryContentFresh catches drift on a non-UI-index endpoint", async () => {
  const bodyByUrl = new Map(
    registryFreshnessTargets.map((target) => [target.url, readFileSync(target.path, "utf8")]),
  );
  const keysUrl = "https://r.b4r7.dev/r/keys/navigation.json";

  await assert.rejects(
    () =>
      assertRegistryContentFresh(async (url) => ({
        ok: true,
        text: async () => (url === keysUrl ? "stale\n" : bodyByUrl.get(url)),
      })),
    /SHA mismatch for .*keys\/navigation\.json/,
  );
});
