import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertHeadOk,
  assertRegistryContentFresh,
  publicRegistryIsGated,
  requiredEndpoints,
  sha256Hex,
} from "./check-live-registry.mjs";

test("required endpoints include the keys registry route", () => {
  assert.ok(requiredEndpoints.some((url) => url.includes("/r/keys/")));
});

test("required endpoints include the published editor schema", () => {
  assert.ok(requiredEndpoints.some((url) => url.endsWith("/schema/diffgazer.json")));
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
