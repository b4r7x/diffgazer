#!/usr/bin/env node

// Opt-in live review e2e: boots the real cli/server app on a localhost socket,
// seeds a provider configuration and repo trust over the HTTP API, runs one
// bounded single-lens review on a scratch git repo against a real provider,
// consumes the actual SSE stream, and asserts an honest terminal outcome plus
// fetchable persistence. Off by default — see the SKIP line for the opt-in
// envs. Run via `pnpm run smoke:review` (builds the server, uses the tsx
// loader so the Bundler-resolved @diffgazer/core dist loads).

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ENV } from "./lib/env.mjs";
import { errorMessage } from "./lib/error-message.mjs";
import {
  BATCHING_CALL_TOKEN_CAP,
  buildDiffFixture,
  SCENARIO_FIXTURES,
} from "./lib/smoke-review/diff-fixtures.mjs";
import {
  E2E_OPT_IN_ENV,
  E2E_SCENARIO_ENV,
  entitlementFallback,
  expandScenarioCells,
  finalizeE2eDispositions,
  findActiveLocalBinding,
  modelOverrideNotice,
  parseScenarioIds,
  resolveE2eDispositions,
  reviewWallCapMs,
  runFailureLine,
  singleProductModelOverride,
  skipLine,
} from "./lib/smoke-review/dispositions.mjs";
import { createSseFrameParser } from "./lib/smoke-review/sse-frames.mjs";
import {
  E2E_LENS,
  evaluateBatchingProof,
  evaluateRun,
  fallbackLine,
  HARD_TIMEOUT_MS,
  labelCellLines,
} from "./lib/smoke-review/verdicts.mjs";
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

function readJsonOrNull(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

// Workspace packages are not linked under scripts/, so read the product
// registry and the wire schemas the live stream is judged against from the
// built core dist.
async function loadCore() {
  const [providers, events, review] = await Promise.all(
    ["providers/index.js", "schemas/events/index.js", "schemas/review/index.js"].map(
      (entry) => import(pathToFileURL(resolve(root, "libs/core/dist", entry)).href),
    ),
  );
  return {
    PRODUCT_REGISTRY: providers.PRODUCT_REGISTRY,
    CREDENTIAL_ENV_VARS: providers.CREDENTIAL_ENV_VARS,
    acceptNotice: providers.acceptNotice,
    FullReviewStreamEventSchema: events.FullReviewStreamEventSchema,
    ReviewResultSchema: review.ReviewResultSchema,
  };
}

function schemaError(label, error) {
  const issue = error.issues[0];
  const path = issue.path.join(".");
  return `${label}${path ? `.${path}` : ""}: ${issue.message}`;
}

function git(cwd, args) {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

function createScratchRepo(repo) {
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
}

// A fixture scenario's repo mirrors the small idiom: commit one-line seeds,
// then overwrite with the deterministic fixture so the diff stays unstaged.
function createFixtureScratchRepo(repo, fixture) {
  git(repo, ["init", "--quiet"]);
  git(repo, ["config", "user.email", "smoke-review@diffgazer.invalid"]);
  git(repo, ["config", "user.name", "Diffgazer Smoke Review"]);
  const files = buildDiffFixture(fixture);
  for (const file of files) writeFileSync(join(repo, file.path), file.seedContent);
  git(repo, ["add", "."]);
  git(repo, ["commit", "--quiet", "-m", "seed"]);
  for (const file of files) writeFileSync(join(repo, file.path), file.modifiedContent);
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

async function consumeStream(baseUrl, headers, reviewId, core, timeoutMs) {
  const controller = new AbortController();
  const state = {
    sawNonTerminalEvent: false,
    terminal: null,
    timedOut: false,
    failedLenses: [],
    schemaErrors: [],
    sizeWarnings: [],
  };
  const watchdog = setTimeout(() => {
    state.timedOut = true;
    controller.abort();
  }, timeoutMs);

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
        const parsed = core.FullReviewStreamEventSchema.safeParse(event);
        if (!parsed.success) {
          state.schemaErrors.push(schemaError(String(event?.type), parsed.error));
        }
        if (event.type === "complete" || event.type === "error") {
          state.terminal = event;
        } else {
          state.sawNonTerminalEvent = true;
          if (event.type === "agent_error") {
            state.failedLenses.push(`${event.agent}: ${event.error}`);
          }
          if (event.type === "review_size_warning") {
            state.sizeWarnings.push(event.warning);
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
    // Dropping the SSE client only unsubscribes; DELETE is the one route that
    // cancels the detached pipeline, so any exit without a terminal event
    // cancels here — before the cell's server closes and the run outlives it.
    if (!state.terminal) {
      await requestJson(baseUrl, headers, "DELETE", `/api/review/sessions/${reviewId}`).catch(
        () => {},
      );
    }
  }
  if (state.terminal?.type === "complete") {
    // The report the run produced is pinned to the published report contract
    // directly, so a loosened `complete` event member cannot hide drift.
    const result = core.ReviewResultSchema.safeParse(state.terminal.result);
    if (!result.success) {
      state.schemaErrors.push(schemaError("complete.result", result.error));
    }
  }
  return state;
}

async function pollPersistence(baseUrl, headers, reviewId) {
  const deadline = Date.now() + PERSISTENCE_POLL_MS;
  let review = null;
  while (!review && Date.now() < deadline) {
    review = await requestJson(baseUrl, headers, "GET", `/api/review/reviews/${reviewId}`)
      .then((body) => (body?.review?.metadata?.id === reviewId ? body.review : null))
      .catch(() => null);
    if (!review) {
      await new Promise((resolveSleep) => setTimeout(resolveSleep, PERSISTENCE_POLL_INTERVAL_MS));
    }
  }
  const listed = await requestJson(baseUrl, headers, "GET", "/api/review/reviews")
    .then((body) => (body?.reviews ?? []).some((entry) => entry.id === reviewId))
    .catch(() => false);
  return { persisted: review !== null, listed, review };
}

// Reads the secret named by the cell's credential-source descriptor (REQ-009).
// Failure messages carry the mechanism only — file path or env var name, never
// content (REQ-010).
function resolveCredentialLiteral(cell) {
  const source = cell.credentialSource;
  if (source.source === "local-file") {
    let literal;
    try {
      literal = readFileSync(source.filePath, "utf8").trim();
    } catch {
      throw new Error(`could not read credential file ${source.filePath}`);
    }
    if (!literal) throw new Error(`credential file ${source.filePath} is empty`);
    return literal;
  }
  const varName = source.source === "local-env" ? source.varName : cell.credentialEnv;
  const literal = process.env[varName];
  if (!literal) throw new Error(`credential env var ${varName} is empty`);
  return literal;
}

// The server resolves its paths from DIFFGAZER_HOME per call, except two it
// pins at first use: the reviews directory when the dist is imported
// (storage/project-index.js) and the trust file when the config store is
// created. Both are primed here against one invocation-scoped home that
// outlives every cell, so a later cell's trust or review write cannot
// re-create a home an earlier cell already removed — and neither pin can land
// in the real `~/.diffgazer`.
async function loadServerRuntime() {
  const pinnedHome = mkdtempSync(join(tmpdir(), "diffgazer-e2e-pinned-"));
  assertTempPath("Live e2e pinned home", pinnedHome);
  process.env.DIFFGAZER_HOME = pinnedHome;
  process.env.DIFFGAZER_SHUTDOWN_TOKEN = "smoke-review-shutdown-token";
  if (!process.env.DIFFGAZER_LOG_LEVEL) process.env.DIFFGAZER_LOG_LEVEL = "warn";
  try {
    const { createApp } = await import(pathToFileURL(SERVER_DIST).href);
    const { getStore } = await import(
      pathToFileURL(resolve(root, "cli/server/dist/shared/lib/config/store.js")).href
    );
    const { shutdownSessions } = await import(
      pathToFileURL(resolve(root, "cli/server/dist/features/review/stream/store.js")).href
    );
    const { createAdaptorServer } = await import(
      pathToFileURL(serverRequire.resolve("@hono/node-server")).href
    );
    // Workspace packages are not linked under scripts/, so import the built dist.
    const { SHUTDOWN_TOKEN_HEADER } = await import(
      pathToFileURL(resolve(root, "libs/core/dist/api/protocol.js")).href
    );
    if (!SHUTDOWN_TOKEN_HEADER) throw new Error("SHUTDOWN_TOKEN_HEADER missing from core dist");
    // Store creation is the trust-file pin.
    getStore();
    return { pinnedHome, createApp, createAdaptorServer, SHUTDOWN_TOKEN_HEADER, shutdownSessions };
  } catch (error) {
    rmSync(pinnedHome, { recursive: true, force: true });
    throw error;
  }
}

async function runLiveE2e(cell, core, runtime, multiCell, modelOverride) {
  const { PRODUCT_REGISTRY, acceptNotice } = core;
  const product = PRODUCT_REGISTRY[cell.productId];

  const fixture = SCENARIO_FIXTURES[cell.scenarioId] ?? null;
  const timeoutMs = fixture?.timeoutMs ?? HARD_TIMEOUT_MS;

  const home = mkdtempSync(join(tmpdir(), "diffgazer-e2e-home-"));
  let repo = null;
  let server = null;
  try {
    // Made here rather than in the seeder so `repo` is assigned before any git
    // call can throw and the finally below owns the directory either way.
    repo = realpathSync(mkdtempSync(join(tmpdir(), "diffgazer-e2e-repo-")));
    if (fixture) createFixtureScratchRepo(repo, fixture);
    else createScratchRepo(repo);
    assertTempPath("Live e2e DIFFGAZER_HOME", home);
    assertTempPath("Live e2e project root", repo);
    process.env.DIFFGAZER_HOME = home;
    process.env.DIFFGAZER_PROJECT_ROOT = repo;

    server = runtime.createAdaptorServer({
      fetch: runtime.createApp().fetch,
      hostname: "127.0.0.1",
    });
    const baseUrl = await listen(server);
    const headers = {
      [runtime.SHUTDOWN_TOKEN_HEADER]: process.env.DIFFGAZER_SHUTDOWN_TOKEN,
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
    // Hermetic-server-only settings patch. Every cell caps the review wall
    // under its watchdog so the engine ends with a terminal event instead of
    // the harness cancelling it. The schema-minimum call token cap (REQ-118)
    // forces a fixture to partition into >= fixture.minBatches batches; small
    // stays on the default cap.
    await requestJson(baseUrl, headers, "POST", "/api/settings", {
      reviewWallTimeCapMs: reviewWallCapMs(timeoutMs),
      ...(fixture ? { effectiveCallTokenCap: BATCHING_CALL_TOKEN_CAP } : {}),
    });
    const credentialValue = resolveCredentialLiteral(cell);
    const created = await requestJson(baseUrl, headers, "POST", "/api/config/actions", {
      action: "create",
      input: {
        transportFamily: "hosted-api",
        productId: cell.productId,
        endpoint: product.configuration.endpoints[0].endpoint,
        credential: { kind: "literal", value: credentialValue },
      },
      acknowledgement: acceptNotice(product.notice),
    });
    const configurationId = created?.configuration?.configurationId;
    if (!configurationId) throw new Error("configuration create returned no configurationId");
    await requestJson(baseUrl, headers, "POST", "/api/config/actions", {
      action: "select",
      configurationId,
      modelId: cell.modelId,
    });

    const startedAt = Date.now();
    const createdReview = await requestJson(baseUrl, headers, "POST", "/api/review/reviews", {
      mode: "unstaged",
      lenses: [E2E_LENS],
    });
    const reviewId = createdReview?.reviewId;
    if (!reviewId) throw new Error("review create returned no reviewId");
    console.log(`live review e2e: ${cell.productId}/${cell.modelId}, review ${reviewId}`);

    const stream = await consumeStream(baseUrl, headers, reviewId, core, timeoutMs);
    const fallbackModelId = entitlementFallback({ terminal: stream.terminal, cell, modelOverride });
    const persistence =
      stream.terminal?.type === "complete"
        ? await pollPersistence(baseUrl, headers, reviewId)
        : { persisted: false, listed: false, review: null };

    // A cell headed for its fallback prints why and nothing else: evaluateRun's
    // FAIL and the batching proof would judge an attempt this run supersedes.
    const evaluations = [];
    if (!fallbackModelId) {
      evaluations.push(evaluateRun({ ...stream, ...persistence, timeoutMs }));
      // A red run already prints its FAIL and has no lens stats for the proof to judge.
      if (fixture && evaluations[0].verdict === "pass") {
        evaluations.push(
          evaluateBatchingProof({
            sizeWarnings: stream.sizeWarnings,
            lensStats: persistence.review?.lensStats ?? [],
            minBatchCount: fixture.minBatches,
          }),
        );
      }
    }
    const lines = fallbackModelId
      ? [fallbackLine(cell, fallbackModelId)]
      : evaluations.flatMap((evaluation) => evaluation.lines);
    for (const line of multiCell ? labelCellLines(lines, cell) : lines) {
      console.log(line);
    }
    console.log(`live review e2e wall time: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
    // The empty `evaluations` of a superseded attempt passes `every`, which is
    // the point: the retry cell, not this one, carries the verdict.
    return {
      failures: evaluations.every((evaluation) => evaluation.verdict === "pass") ? 0 : 1,
      fallbackModelId,
    };
  } finally {
    if (server) await new Promise((resolveClose) => server.close(() => resolveClose()));
    // `paths.ts` re-reads DIFFGAZER_HOME per call, so the env vars stay in
    // place: clearing them would re-point a still-draining write at the real
    // `~/.diffgazer`.
    rmSync(home, { recursive: true, force: true });
    if (repo) rmSync(repo, { recursive: true, force: true });
  }
}

async function run() {
  const optedIn = process.env[E2E_OPT_IN_ENV] === "1";
  const network = networkAllowed();
  let core = null;
  let coreDistError = null;
  if (optedIn && network) {
    // Importing the core dist is itself a prerequisite; the pnpm script's build
    // segment normally guarantees it.
    core = await loadCore().catch((error) => {
      coreDistError = errorMessage(error);
      return null;
    });
  }

  // The credential fallback (REQ-009) reads the developer's real ~/.diffgazer,
  // captured before any cell re-points DIFFGAZER_HOME at a temp home, and only
  // when the e2e can actually run — the same gate as loadCore. Reads only —
  // the lookup returns mechanism descriptors (binding kind, file path), never
  // a secret value.
  const realHome = process.env.DIFFGAZER_HOME ?? join(homedir(), ".diffgazer");
  const configDoc = optedIn && network ? readJsonOrNull(join(realHome, "config.json")) : null;
  const secretsDoc = optedIn && network ? readJsonOrNull(join(realHome, "secrets.json")) : null;
  const localBindingFor = (productId) =>
    findActiveLocalBinding({ configDoc, secretsDoc, productId });
  const suggestedModelFor = (id) => {
    const modelPolicy = core?.PRODUCT_REGISTRY[id]?.modelPolicy;
    return modelPolicy && "suggestedModelId" in modelPolicy ? modelPolicy.suggestedModelId : null;
  };

  const dispositions = resolveE2eDispositions({
    env: process.env,
    networkEnabled: network,
    credentialEnvFor: (id) => core?.CREDENTIAL_ENV_VARS[id],
    suggestedModelFor,
    hasCoreDist: core !== null,
    coreDistError,
    hasServerDist: existsSync(SERVER_DIST),
    localBindingFor,
  });
  const scenarioIds = parseScenarioIds(process.env[E2E_SCENARIO_ENV]);
  const modelOverride = singleProductModelOverride({ env: process.env });
  const cells = expandScenarioCells({
    dispositions,
    scenarioIds,
    modelOverride,
    suggestedModelFor,
    env: process.env,
    localBindingFor,
  });

  const notice = modelOverrideNotice(process.env);
  if (notice) console.log(notice);

  // Every requested cell runs before a strict-skips failure is raised, so one
  // missing key — or one cell's harness throwing — does not hide the verdicts
  // of the cells that could run. Verdict lines carry a (product/scenario)
  // label only when more than one RUN cell exists — blocked dispositions do
  // not count, so a lone run beside a skip keeps the legacy unlabeled
  // single-cell output (REQ-017).
  const multiCell = cells.filter((cell) => cell.kind === "run").length > 1;
  const runtime = cells.some((cell) => cell.kind === "run") ? await loadServerRuntime() : null;
  let failures = 0;
  for (const cell of cells) {
    if (cell.kind !== "run") {
      // Blocked-product dispositions pass through expansion without a scenario
      // set; attach the requested one so the rerun command reproduces the run.
      console.log(skipLine({ scenarioIds, ...cell }));
      continue;
    }
    try {
      const result = await runLiveE2e(cell, core, runtime, multiCell, modelOverride);
      failures += result.failures;
      // The retry boots fresh like any cell; its header line names the fallback
      // model, so the record shows which model actually produced the verdict.
      if (result.fallbackModelId) {
        const retry = await runLiveE2e(
          { ...cell, modelId: result.fallbackModelId, fallbackFrom: cell.modelId },
          core,
          runtime,
          multiCell,
          modelOverride,
        );
        failures += retry.failures;
      }
    } catch (error) {
      const lines = [runFailureLine(cell.productId, errorMessage(error))];
      for (const line of multiCell ? labelCellLines(lines, cell) : lines) console.log(line);
      failures += 1;
    }
  }
  if (runtime) {
    // A cancelled cell's partial review write is fire-and-forget on the server
    // side; its own bounded drain lands it before the pinned home goes.
    await runtime.shutdownSessions();
    rmSync(runtime.pinnedHome, { recursive: true, force: true });
  }
  finalizeE2eDispositions(cells, process.env[ENV.smokeStrictSkips] === "1");
  return failures === 0 ? 0 : 1;
}

// Explicit exit: the review stream store keeps maintenance timers that would
// otherwise hold the event loop open after the verdict.
run()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`FAIL: live review e2e — ${errorMessage(error)}`);
    process.exit(1);
  });
