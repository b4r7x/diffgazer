import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  selectedIdentitySurfaces,
  verifySelectedSourceTags,
  waitForSourceTag,
} from "./verify-deployed-source-tags.mjs";

const SOURCE_TAG = "a".repeat(40);

describe("deployed source identity", () => {
  it("maps each deploy target to exactly its HTML surfaces", () => {
    assert.deepEqual(selectedIdentitySurfaces("docs-registry"), ["docs"]);
    assert.deepEqual(selectedIdentitySurfaces("landing"), ["landing"]);
    assert.deepEqual(selectedIdentitySurfaces("all"), ["docs", "landing"]);
    assert.throws(() => selectedIdentitySurfaces("unknown"), /Unknown deploy target/);
  });

  it("does not accept a stale source tag before the requested tag appears", async () => {
    const responses = ["b".repeat(40), SOURCE_TAG];
    const requestedUrls = [];

    await waitForSourceTag({
      surface: "docs",
      origin: "https://docs.example.com",
      expected: SOURCE_TAG,
      fetchImpl: async (url) => {
        requestedUrls.push(String(url));
        return new Response(responses.shift(), { status: 200 });
      },
      sleep: async () => {},
      now: () => 0,
      timeoutMs: 1_000,
    });

    assert.equal(requestedUrls.length, 2);
    assert.match(requestedUrls[0], /\/source-tag\?expected=/);
  });

  it("fails closed when an endpoint never reports the exact tag", async () => {
    let time = 0;
    await assert.rejects(
      waitForSourceTag({
        surface: "landing",
        origin: "https://landing.example.com",
        expected: SOURCE_TAG,
        fetchImpl: async () => new Response(`${SOURCE_TAG}-stale`, { status: 200 }),
        sleep: async (intervalMs) => {
          time += intervalMs;
        },
        now: () => time,
        timeoutMs: 20,
        intervalMs: 10,
      }),
      /landing did not report source tag/,
    );
  });

  it("fails closed when a rollback image has no source-tag endpoint", async () => {
    let time = 0;
    await assert.rejects(
      waitForSourceTag({
        surface: "docs",
        origin: "https://docs.example.com",
        expected: SOURCE_TAG,
        fetchImpl: async () => new Response("Not found", { status: 404 }),
        sleep: async (intervalMs) => {
          time += intervalMs;
        },
        now: () => time,
        timeoutMs: 20,
        intervalMs: 10,
      }),
      /docs did not report source tag/,
    );
  });

  it("checks every selected surface", async () => {
    const origins = [];
    await verifySelectedSourceTags({
      target: "all",
      expected: SOURCE_TAG,
      origins: {
        docs: "https://docs.example.com",
        landing: "https://landing.example.com",
      },
      fetchImpl: async (url) => {
        origins.push(new URL(url).origin);
        return new Response(SOURCE_TAG, { status: 200 });
      },
    });

    assert.deepEqual(origins.sort(), ["https://docs.example.com", "https://landing.example.com"]);
  });

  it("exits nonzero with an Unknown deploy target diagnostic when spawned directly", () => {
    const child = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("./verify-deployed-source-tags.mjs", import.meta.url))],
      {
        encoding: "utf8",
        env: { ...process.env, SOURCE_TAG, DEPLOY_TARGET: "unknown" },
      },
    );

    assert.notEqual(child.status, 0);
    assert.match(child.stderr, /Unknown deploy target/);
  });
});
