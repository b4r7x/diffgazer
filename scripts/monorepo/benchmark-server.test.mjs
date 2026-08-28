import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyBenchmarkEnvDefaults, timeRequest } from "./benchmark-server.mjs";
import { runArgv } from "./smoke-shared/command.mjs";

const benchmarkUrl = new URL("./benchmark-server.mjs", import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Regression: the benchmark imported SHUTDOWN_TOKEN_HEADER from core's `api/index.js`,
// which does not re-export it. The header name came out `undefined`, so every
// authenticated scenario 401'd and the run measured the rejection path instead of the
// endpoint. Read the specifier out of the benchmark's own source so pointing it back at a
// module without that export fails here.
test("the module the benchmark reads the shutdown-token header from actually exports it", async () => {
  const source = readFileSync(benchmarkUrl, "utf8");
  const importExpression = source.match(/SHUTDOWN_TOKEN_HEADER\s*}\s*=\s*await import\(([^;]+)\)/);
  assert.ok(importExpression, "benchmark-server.mjs must import SHUTDOWN_TOKEN_HEADER");
  const specifier = importExpression[1].match(/"([^"]+)"/)?.[1];
  assert.ok(specifier, `no module specifier in ${importExpression[1].trim()}`);

  const modulePath = resolve(repoRoot, specifier);
  assert.ok(
    existsSync(modulePath),
    `${specifier} is missing \u2014 it is build output; run \`pnpm run build\` before \`pnpm run test:scripts\``,
  );

  const module = await import(pathToFileURL(modulePath).href);
  assert.equal(typeof module.SHUTDOWN_TOKEN_HEADER, "string");
  assert.ok(module.SHUTDOWN_TOKEN_HEADER.length > 0);
});

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
  const script = [
    `import { main } from ${JSON.stringify(benchmarkUrl.href)};`,
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
