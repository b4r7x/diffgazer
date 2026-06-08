#!/usr/bin/env node

// Load/latency benchmark for the embedded Diffgazer API server (cli/server).
// It boots the real Hono app, drives concurrent requests against representative
// endpoints, computes latency percentiles + throughput with perf_hooks, and
// exits non-zero when a measured percentile breaches its SLO.
//
// Scenarios:
//   - GET /health             — unauthenticated liveness probe (always runs).
//   - GET /api/config/init     — authenticated, pure-local read that exercises
//                                the real request path (host check → shutdown-token
//                                middleware → CORS → router → config-store read →
//                                JSON). No subprocess, so latency is deterministic
//                                (always runs).
//
// Failure modes are split so the bench can gate in CI without flaking:
//   - Functional failures (non-200, crash, auth 403, setup error) ALWAYS hard-fail
//     (exit 1). These are machine-independent regression guards.
//   - Latency/throughput SLO breaches hard-fail only under strict mode
//     (DIFFGAZER_SMOKE_STRICT_SKIPS=1); otherwise they report-and-warn, so a loaded
//     CI runner does not fail the build on timing alone.
// The server is always closed and the temp fixtures removed in `finally`.
//
// Scope: a self-contained driver with no extra dependencies (the AGENTS.md
// dependency policy rules out adding autocannon/k6 for this). The hand-rolled
// worker pool is sufficient for percentile + throughput SLOs on a single-process
// local server. Run via `pnpm run bench`, which builds the dependency graph and
// uses the same tsx loader as the server's serve entry so the Bundler-resolved
// `@diffgazer/core` dist loads correctly.

import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { checkSlo, summarizeStatuses } from "./artifacts/benchmark-slo.mjs";
import { ENV } from "./artifacts/env.mjs";

const root = process.cwd();

// `@hono/node-server` is a dependency of cli/server, not the repo root, so
// resolve it through the server package rather than the root module graph.
const serverRequire = createRequire(resolve(root, "cli/server/package.json"));

// The embedded server reads these BEFORE its config-store singleton initializes,
// so they must be set prior to importing the built server modules below.
const fixtureHome = mkdtempSync(join(tmpdir(), "diffgazer-bench-home-"));
const fixtureProject = realpathSync(mkdtempSync(join(tmpdir(), "diffgazer-bench-project-")));
const shutdownToken = "benchmark-shutdown-token";

// The server's project-root resolver only admits paths under the OS home or that
// contain a `.git` directory; a marker dir is enough (it never shells out to git).
mkdirSync(join(fixtureProject, ".git"), { recursive: true });

process.env.DIFFGAZER_HOME = fixtureHome;
// The server resolves the project root from this env var (the packaged-mode
// path), so requests need no project-root header and bypass the header-only
// allowed-path check that would reject a temp directory.
process.env.DIFFGAZER_PROJECT_ROOT = fixtureProject;
process.env.DIFFGAZER_SHUTDOWN_TOKEN = shutdownToken;
// Bench latency should measure the request path, not thousands of stdout writes
// from the standalone server's default per-request info logger. Match the
// packaged/default quietness unless the caller explicitly asked for another
// level.
if (!process.env.DIFFGAZER_LOG_LEVEL) {
  process.env.DIFFGAZER_LOG_LEVEL = "warn";
}

// Service Level Objectives. Conservative starting targets for a local,
// single-process server; tighten once real CI baselines exist.
const SLO = {
  health: { p95Ms: 50, p99Ms: 100, minRequestsPerSecond: 500 },
  configInit: { p95Ms: 75, p99Ms: 150, minRequestsPerSecond: 300 },
};

const SERVER_DIST = resolve(root, "cli/server/dist/app.js");

function percentile(sortedMs, fraction) {
  if (sortedMs.length === 0) return 0;
  const index = Math.ceil(fraction * sortedMs.length) - 1;
  return sortedMs[Math.min(sortedMs.length - 1, Math.max(0, index))];
}

function summarize(durations) {
  const sorted = [...durations].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted.at(-1) ?? 0,
  };
}

function timeRequest(baseUrl, path, headers) {
  return new Promise((resolveRequest, reject) => {
    const start = performance.now();
    const req = httpRequest(new URL(path, baseUrl), { headers }, (res) => {
      res.resume();
      res.on("end", () =>
        resolveRequest({ ms: performance.now() - start, status: res.statusCode }),
      );
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

async function runScenario(baseUrl, { path, headers, totalRequests, concurrency }) {
  const durations = [];
  const statuses = [];
  let issued = 0;

  async function worker() {
    while (issued < totalRequests) {
      issued += 1;
      const { ms, status } = await timeRequest(baseUrl, path, headers);
      durations.push(ms);
      statuses.push(status);
    }
  }

  const wallStart = performance.now();
  await Promise.all(Array.from({ length: concurrency }, worker));
  const wallMs = performance.now() - wallStart;

  return {
    ...summarize(durations),
    ...summarizeStatuses(statuses),
    requestsPerSecond: (durations.length / wallMs) * 1000,
  };
}

function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not determine benchmark server address"));
        return;
      }
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

function report(label, result) {
  console.log(
    `${label}: ${result.count} reqs | p50 ${result.p50.toFixed(2)}ms | p95 ${result.p95.toFixed(2)}ms | ` +
      `p99 ${result.p99.toFixed(2)}ms | max ${result.max.toFixed(2)}ms | ${result.requestsPerSecond.toFixed(0)} req/s`,
  );
}

async function main() {
  if (!existsSync(SERVER_DIST)) {
    throw new Error(
      `Server build not found at ${SERVER_DIST}. Run \`pnpm --filter @diffgazer/server build\` first.`,
    );
  }

  const { createApp } = await import(pathToFileURL(SERVER_DIST).href);
  const { createAdaptorServer } = await import(
    pathToFileURL(serverRequire.resolve("@hono/node-server")).href
  );
  // Workspace packages are not linked under scripts/, and core's subpath exports
  // are import-only (no CJS require condition), so import the built dist directly.
  const { SHUTDOWN_TOKEN_HEADER } = await import(
    pathToFileURL(resolve(root, "libs/core/dist/api/index.js")).href
  );

  const authHeaders = {
    [SHUTDOWN_TOKEN_HEADER]: shutdownToken,
    host: "127.0.0.1",
  };

  const app = createApp();
  const server = createAdaptorServer({ fetch: app.fetch, hostname: "127.0.0.1" });
  const functionalFailures = [];
  const latencyBreaches = [];
  const collectors = { functionalFailures, latencyBreaches };

  try {
    const baseUrl = await listen(server);

    // Warm up so JIT / first-request costs do not skew the percentiles.
    await runScenario(baseUrl, { path: "/health", totalRequests: 50, concurrency: 5 });
    await runScenario(baseUrl, {
      path: "/api/config/init",
      headers: authHeaders,
      totalRequests: 50,
      concurrency: 5,
    });

    const health = await runScenario(baseUrl, {
      path: "/health",
      totalRequests: 2000,
      concurrency: 50,
    });
    report("GET /health", health);
    checkSlo(collectors, "GET /health", health, SLO.health);

    const configInit = await runScenario(baseUrl, {
      path: "/api/config/init",
      headers: authHeaders,
      totalRequests: 1000,
      concurrency: 40,
    });
    report("GET /api/config/init", configInit);
    checkSlo(collectors, "GET /api/config/init", configInit, SLO.configInit);
  } finally {
    await new Promise((resolveClose) => server.close(() => resolveClose()));
  }

  // Functional regressions always gate. Latency breaches gate only in strict
  // mode; otherwise warn so machine-dependent timings do not fail CI by default.
  const strict = process.env[ENV.smokeStrictSkips] === "1";
  if (latencyBreaches.length > 0) {
    const heading = strict
      ? "Benchmark SLO breach (strict):"
      : "WARN: benchmark latency below SLO (not gating):";
    (strict ? console.error : console.warn)([heading, ...latencyBreaches].join("\n"));
  }
  const gating = [...functionalFailures, ...(strict ? latencyBreaches : [])];
  if (gating.length > 0) {
    console.error(["Benchmark failed:", ...gating].join("\n"));
    process.exit(1);
  }

  console.log("OK: server benchmark functional checks passed");
}

// The fixtures are created at module load, so clean them up here to cover
// failures that occur before main() enters its own try (e.g. import errors).
try {
  await main();
} finally {
  rmSync(fixtureHome, { recursive: true, force: true });
  rmSync(fixtureProject, { recursive: true, force: true });
}
