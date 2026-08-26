#!/usr/bin/env node

// Opt-in live review e2e: boots the real cli/server app on a localhost socket,
// seeds a provider configuration and repo trust over the HTTP API, runs one
// bounded single-lens review on a scratch git repo against a real provider,
// consumes the actual SSE stream, and asserts an honest terminal outcome plus
// fetchable persistence. Off by default — see the SKIP line for the opt-in
// envs. Run via `pnpm run smoke:review` (builds the server, uses the tsx
// loader so the Bundler-resolved @diffgazer/core dist loads).

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ENV } from "./lib/env.mjs";
import { errorMessage } from "./lib/error-message.mjs";
import {
  createSseFrameParser,
  E2E_LENS,
  E2E_OPT_IN_ENV,
  evaluateRun,
  finalizeE2eDisposition,
  HARD_TIMEOUT_MS,
  resolveE2eDisposition,
  skipLine,
} from "./lib/smoke-review.mjs";
import { networkAllowed } from "./smoke-shared/network.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SERVER_DIST = resolve(root, "cli/server/dist/app.js");
const PERSISTENCE_POLL_MS = 10_000;
const PERSISTENCE_POLL_INTERVAL_MS = 500;

// `@hono/node-server` is a dependency of cli/server, not the repo root, so
// resolve it through the server package rather than the root module graph.
const serverRequire = createRequire(resolve(root, "cli/server/package.json"));

// The harness boots the server in-process, so `DIFFGAZER_HOME` is the only
// thing between authenticated config-store writes and the developer's real
// `~/.diffgazer`. Mirrors `assertTempHome` in cli/server's test support,
// inlined because scripts/ must not import across that package boundary.
function assertTempPath(label, path) {
  const tempRoot = realpathSync.native(tmpdir());
  const resolved = realpathSync.native(path);
  if (resolved !== tempRoot && !resolved.startsWith(tempRoot + sep)) {
    throw new Error(`${label} must resolve under ${tempRoot}, got ${resolved}`);
  }
}

async function loadProviders() {
  return import(pathToFileURL(resolve(root, "libs/core/dist/providers/index.js")).href);
}

function git(cwd, args) {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

function createScratchRepo() {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), "diffgazer-e2e-repo-")));
  git(repo, ["init", "--quiet"]);
  git(repo, ["config", "user.email", "smoke-review@diffgazer.invalid"]);
  git(repo, ["config", "user.name", "Diffgazer Smoke Review"]);
  writeFileSync(
    join(repo, "greet.js"),
    'export function greet(name) {\n  return "Hello, " + name;\n}\n',
  );
  writeFileSync(
    join(repo, "math.js"),
    "export function add(a, b) {\n  return a + b;\n}\n\nexport function half(n) {\n  return n / 2;\n}\n",
  );
  git(repo, ["add", "."]);
  git(repo, ["commit", "--quiet", "-m", "seed"]);
  // A small honest bug in the uncommitted diff gives the lens something real.
  writeFileSync(
    join(repo, "math.js"),
    "export function add(a, b) {\n  return a - b;\n}\n\nexport function half(n) {\n  return n / 2;\n}\n\nexport function double(n) {\n  return n * 2;\n}\n",
  );
  return repo;
}

function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not determine e2e server address"));
        return;
      }
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function requestJson(baseUrl, headers, method, path, body) {
  const response = await fetch(baseUrl + path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} -> HTTP ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function consumeStream(baseUrl, headers, reviewId) {
  const controller = new AbortController();
  const state = { sawNonTerminalEvent: false, terminal: null, timedOut: false, failedLenses: [] };
  const watchdog = setTimeout(() => {
    state.timedOut = true;
    controller.abort();
  }, HARD_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/api/review/reviews/${reviewId}/stream`, {
      headers,
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`stream -> HTTP ${response.status}`);
    }
    const parser = createSseFrameParser();
    const decoder = new TextDecoder();
    for await (const chunk of response.body) {
      for (const frame of parser.feed(decoder.decode(chunk, { stream: true }))) {
        const event = JSON.parse(frame.data);
        if (event.type === "complete" || event.type === "error") {
          state.terminal = event;
        } else {
          state.sawNonTerminalEvent = true;
          if (event.type === "agent_error") {
            state.failedLenses.push(`${event.agent}: ${event.error}`);
          }
        }
      }
      if (state.terminal) break;
    }
  } catch (error) {
    if (!state.timedOut) throw error;
  } finally {
    clearTimeout(watchdog);
    controller.abort();
  }

  if (state.timedOut) {
    await requestJson(baseUrl, headers, "DELETE", `/api/review/sessions/${reviewId}`).catch(
      () => {},
    );
  }
  return state;
}

async function pollPersistence(baseUrl, headers, reviewId) {
  const deadline = Date.now() + PERSISTENCE_POLL_MS;
  let persisted = false;
  while (!persisted && Date.now() < deadline) {
    persisted = await requestJson(baseUrl, headers, "GET", `/api/review/reviews/${reviewId}`)
      .then((body) => body?.review?.metadata?.id === reviewId)
      .catch(() => false);
    if (!persisted) {
      await new Promise((resolveSleep) => setTimeout(resolveSleep, PERSISTENCE_POLL_INTERVAL_MS));
    }
  }
  const listed = await requestJson(baseUrl, headers, "GET", "/api/review/reviews")
    .then((body) => (body?.reviews ?? []).some((review) => review.id === reviewId))
    .catch(() => false);
  return { persisted, listed };
}

async function runLiveE2e(disposition, providers) {
  const { PRODUCT_REGISTRY, acceptNotice } = providers;
  const product = PRODUCT_REGISTRY[disposition.productId];

  const home = mkdtempSync(join(tmpdir(), "diffgazer-e2e-home-"));
  const repo = createScratchRepo();
  assertTempPath("Live e2e DIFFGAZER_HOME", home);
  assertTempPath("Live e2e project root", repo);
  process.env.DIFFGAZER_HOME = home;
  process.env.DIFFGAZER_PROJECT_ROOT = repo;
  process.env.DIFFGAZER_SHUTDOWN_TOKEN = "smoke-review-shutdown-token";
  if (!process.env.DIFFGAZER_LOG_LEVEL) process.env.DIFFGAZER_LOG_LEVEL = "warn";

  const { createApp } = await import(pathToFileURL(SERVER_DIST).href);
  const { createAdaptorServer } = await import(
    pathToFileURL(serverRequire.resolve("@hono/node-server")).href
  );
  // Workspace packages are not linked under scripts/, so import the built dist.
  const { SHUTDOWN_TOKEN_HEADER } = await import(
    pathToFileURL(resolve(root, "libs/core/dist/api/protocol.js")).href
  );
  if (!SHUTDOWN_TOKEN_HEADER) throw new Error("SHUTDOWN_TOKEN_HEADER missing from core dist");

  const server = createAdaptorServer({ fetch: createApp().fetch, hostname: "127.0.0.1" });
  try {
    const baseUrl = await listen(server);
    const headers = {
      [SHUTDOWN_TOKEN_HEADER]: process.env.DIFFGAZER_SHUTDOWN_TOKEN,
      "content-type": "application/json",
    };

    const health = await fetch(`${baseUrl}/health`);
    if (!health.ok) throw new Error(`GET /health -> HTTP ${health.status}`);

    // Seed over the HTTP surface a real client uses: trust, then configuration
    // create (with the product notice acknowledged) and model select.
    await requestJson(baseUrl, headers, "POST", "/api/settings/trust", {
      trustMode: "persistent",
      capabilities: { readFiles: true },
    });
    const created = await requestJson(baseUrl, headers, "POST", "/api/config/actions", {
      action: "create",
      input: {
        transportFamily: "hosted-api",
        productId: disposition.productId,
        endpoint: product.configuration.endpoints[0].endpoint,
        credential: { kind: "literal", value: process.env[disposition.credentialEnv] },
      },
      acknowledgement: acceptNotice(product.notice),
    });
    const configurationId = created?.configuration?.configurationId;
    if (!configurationId) throw new Error("configuration create returned no configurationId");
    await requestJson(baseUrl, headers, "POST", "/api/config/actions", {
      action: "select",
      configurationId,
      modelId: disposition.modelId,
    });

    const startedAt = Date.now();
    const createdReview = await requestJson(baseUrl, headers, "POST", "/api/review/reviews", {
      mode: "unstaged",
      lenses: [E2E_LENS],
    });
    const reviewId = createdReview?.reviewId;
    if (!reviewId) throw new Error("review create returned no reviewId");
    console.log(
      `live review e2e: ${disposition.productId}/${disposition.modelId}, review ${reviewId}`,
    );

    const stream = await consumeStream(baseUrl, headers, reviewId);
    const persistence =
      stream.terminal?.type === "complete"
        ? await pollPersistence(baseUrl, headers, reviewId)
        : { persisted: false, listed: false };

    const { verdict, lines } = evaluateRun({ ...stream, ...persistence });
    for (const line of lines) console.log(line);
    console.log(`live review e2e wall time: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
    return verdict === "pass" ? 0 : 1;
  } finally {
    await new Promise((resolveClose) => server.close(() => resolveClose()));
    // `paths.ts` re-reads DIFFGAZER_HOME per call, so the env vars stay in
    // place: clearing them would re-point a still-draining write at the real
    // `~/.diffgazer`.
    rmSync(home, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  }
}

async function run() {
  const optedIn = process.env[E2E_OPT_IN_ENV] === "1";
  const network = networkAllowed();
  let providers = null;
  if (optedIn && network) {
    // Importing the core dist is itself a prerequisite; the pnpm script's build
    // segment normally guarantees it.
    providers = await loadProviders().catch(() => null);
  }

  const disposition = resolveE2eDisposition({
    env: process.env,
    networkEnabled: network,
    credentialEnvFor: (id) => providers?.CREDENTIAL_ENV_VARS[id],
    suggestedModelFor: (id) => {
      const modelPolicy = providers?.PRODUCT_REGISTRY[id]?.modelPolicy;
      return modelPolicy && "suggestedModelId" in modelPolicy ? modelPolicy.suggestedModelId : null;
    },
    hasServerDist: providers !== null && existsSync(SERVER_DIST),
  });

  if (disposition.kind !== "run") {
    console.log(skipLine(disposition));
    finalizeE2eDisposition(disposition, process.env[ENV.smokeStrictSkips] === "1");
    return 0;
  }
  return runLiveE2e(disposition, providers);
}

// Explicit exit: the review stream store keeps maintenance timers that would
// otherwise hold the event loop open after the verdict.
run()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`FAIL: live review e2e — ${errorMessage(error)}`);
    process.exit(1);
  });
