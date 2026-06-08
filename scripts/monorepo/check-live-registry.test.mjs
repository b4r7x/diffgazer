import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertHeadOk,
  assertRegistryContentFresh,
  requiredEndpoints,
  sha256Hex,
} from "./check-live-registry.mjs";

test("required endpoints include the keys registry route", () => {
  assert.ok(requiredEndpoints.some((url) => url.includes("/r/keys/")));
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
