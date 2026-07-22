import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { applyBenchmarkEnvDefaults, timeRequest } from "./benchmark-server.mjs";
import { runArgv } from "./smoke-shared/command.mjs";

test("benchmark-server defaults request logging to warn unless explicitly overridden", () => {
  const unsetEnv = {};
  const presetEnv = { DIFFGAZER_LOG_LEVEL: "debug" };

  applyBenchmarkEnvDefaults(unsetEnv);
  applyBenchmarkEnvDefaults(presetEnv);

  assert.equal(unsetEnv.DIFFGAZER_LOG_LEVEL, "warn");
  assert.equal(presetEnv.DIFFGAZER_LOG_LEVEL, "debug");
});

test("benchmark requests reject and release a connection that never ends", async () => {
  const server = createServer((_request, _response) => {});
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await assert.rejects(
      timeRequest(`http://127.0.0.1:${address.port}`, "/never-ends", undefined, {
        timeoutMs: 100,
      }),
      /GET \/never-ends timed out after 100ms/,
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

async function assertBenchmarkFailureCleanup({ runner, diagnostic }) {
  const isolatedTemp = mkdtempSync(join(tmpdir(), "dg-benchmark-cleanup-"));
  const before = new Set(readdirSync(isolatedTemp));
  const parentExitCode = process.exitCode;
  const benchmarkUrl = new URL("./benchmark-server.mjs", import.meta.url).href;
  const script = [
    `import { main } from ${JSON.stringify(benchmarkUrl)};`,
    `await main(${runner});`,
  ].join("\n");

  try {
    await assert.rejects(
      runArgv(process.execPath, ["--input-type=module", "-e", script], {
        env: { TEMP: isolatedTemp, TMP: isolatedTemp, TMPDIR: isolatedTemp },
        timeoutMs: 10_000,
      }),
      (error) => {
        assert.equal(error.exitCode, 1);
        assert.match(error.stderr, diagnostic);
        return true;
      },
    );
    const after = new Set(readdirSync(isolatedTemp));
    assert.deepEqual(after, before);
    assert.equal(process.exitCode, parentExitCode);
  } finally {
    rmSync(isolatedTemp, { recursive: true, force: true });
  }
}

for (const { name, runner, diagnostic } of [
  {
    name: "benchmark main cleans fixtures before a forced nonzero exit",
    runner: 'async () => ["forced functional gate"]',
    diagnostic: /Benchmark failed:\nforced functional gate/,
  },
  {
    name: "benchmark main cleans fixtures after a synchronous runner error",
    runner: '() => { throw new Error("forced sync runner failure"); }',
    diagnostic: /Error: forced sync runner failure/,
  },
  {
    name: "benchmark main cleans fixtures after a rejected runner promise",
    runner: '() => Promise.reject(new Error("forced rejected runner failure"))',
    diagnostic: /Error: forced rejected runner failure/,
  },
]) {
  test(name, () => assertBenchmarkFailureCleanup({ runner, diagnostic }));
}
