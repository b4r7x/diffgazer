import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSseFrameParser,
  DEFAULT_E2E_PRODUCT,
  DEFAULT_OPENROUTER_E2E_MODEL,
  E2E_MODEL_ENV,
  E2E_OPT_IN_ENV,
  E2E_PRODUCT_ENV,
  evaluateRun,
  finalizeE2eDispositions,
  modelOverrideNotice,
  resolveE2eDispositions,
  runFailureLine,
  skipLine,
} from "./smoke-review.mjs";

const CREDENTIAL_ENVS = {
  openrouter: "OPENROUTER_API_KEY",
  gemini: "GOOGLE_API_KEY",
  zai: "ZAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
};
const SUGGESTED_MODELS = {
  openrouter: null,
  gemini: "gemini-2.5-flash",
  zai: "glm-5-turbo",
  deepseek: "deepseek-v4-flash",
};

function resolveAll({
  env = {},
  networkEnabled = true,
  hasCoreDist = true,
  coreDistError = null,
  hasServerDist = true,
} = {}) {
  return resolveE2eDispositions({
    env,
    networkEnabled,
    credentialEnvFor: (id) => CREDENTIAL_ENVS[id],
    suggestedModelFor: (id) => SUGGESTED_MODELS[id] ?? null,
    hasCoreDist,
    coreDistError,
    hasServerDist,
  });
}

function resolve(options) {
  const dispositions = resolveAll(options);
  assert.equal(dispositions.length, 1);
  return dispositions[0];
}

test("no envs -> not requested (live-e2e-disabled)", () => {
  assert.deepEqual(resolve({ networkEnabled: false }), {
    kind: "not-requested",
    reason: "live-e2e-disabled",
  });
});

test("network alone does not request the e2e", () => {
  assert.deepEqual(resolve(), { kind: "not-requested", reason: "live-e2e-disabled" });
});

test("opt-in without network -> not requested (network-disabled)", () => {
  assert.deepEqual(resolve({ env: { [E2E_OPT_IN_ENV]: "1" }, networkEnabled: false }), {
    kind: "not-requested",
    reason: "network-disabled",
  });
});

test("opt-in + network without a key -> unavailable (credential-missing)", () => {
  const disposition = resolve({ env: { [E2E_OPT_IN_ENV]: "1" } });
  assert.deepEqual(disposition, {
    kind: "unavailable",
    reason: "credential-missing",
    productId: "openrouter",
    credentialEnv: "OPENROUTER_API_KEY",
  });
});

test("unknown product id -> unavailable (unknown-product)", () => {
  const disposition = resolve({
    env: { [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "not-a-product" },
  });
  assert.deepEqual(disposition, {
    kind: "unavailable",
    reason: "unknown-product",
    productId: "not-a-product",
  });
});

test("product without a suggested model and no model env -> unavailable (model-unresolved)", () => {
  const [disposition] = resolveE2eDispositions({
    env: { [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "gemini", GOOGLE_API_KEY: "k" },
    networkEnabled: true,
    credentialEnvFor: (id) => CREDENTIAL_ENVS[id],
    suggestedModelFor: () => null,
    hasCoreDist: true,
    hasServerDist: true,
  });
  assert.deepEqual(disposition, {
    kind: "unavailable",
    reason: "model-unresolved",
    productId: "gemini",
    credentialEnv: "GOOGLE_API_KEY",
  });
});

test("unimportable core dist -> unavailable (core-dist-missing) keeping the import error", () => {
  const disposition = resolve({
    env: { [E2E_OPT_IN_ENV]: "1" },
    hasCoreDist: false,
    coreDistError: "Cannot find module 'libs/core/dist/providers/index.js'",
  });
  assert.deepEqual(disposition, {
    kind: "unavailable",
    reason: "core-dist-missing",
    coreDistError: "Cannot find module 'libs/core/dist/providers/index.js'",
  });

  const line = skipLine(disposition);
  assert.match(line, /libs\/core dist not importable \(Cannot find module/);
  assert.match(line, /--filter=@diffgazer\/core/);
  assert.throws(
    () => finalizeE2eDispositions([disposition], true),
    /libs\/core dist not importable/,
  );
});

test("missing server dist -> unavailable (server-dist-missing)", () => {
  assert.deepEqual(resolve({ env: { [E2E_OPT_IN_ENV]: "1" }, hasServerDist: false }), {
    kind: "unavailable",
    reason: "server-dist-missing",
  });
});

test("all set -> run with the openrouter default model constant", () => {
  const disposition = resolve({ env: { [E2E_OPT_IN_ENV]: "1", OPENROUTER_API_KEY: "k" } });
  assert.deepEqual(disposition, {
    kind: "run",
    productId: DEFAULT_E2E_PRODUCT,
    modelId: DEFAULT_OPENROUTER_E2E_MODEL,
    credentialEnv: "OPENROUTER_API_KEY",
  });
  assert.equal(DEFAULT_E2E_PRODUCT, "openrouter");
});

test("model env override wins over the suggested model", () => {
  const disposition = resolve({
    env: {
      [E2E_OPT_IN_ENV]: "1",
      [E2E_PRODUCT_ENV]: "gemini",
      [E2E_MODEL_ENV]: "gemini-3-pro",
      GOOGLE_API_KEY: "k",
    },
  });
  assert.deepEqual(disposition, {
    kind: "run",
    productId: "gemini",
    modelId: "gemini-3-pro",
    credentialEnv: "GOOGLE_API_KEY",
  });
});

test("suggested model is the default for non-openrouter products", () => {
  const disposition = resolve({
    env: { [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "gemini", GOOGLE_API_KEY: "k" },
  });
  assert.equal(disposition.modelId, "gemini-2.5-flash");
});

test("a comma list resolves one disposition per product, in order", () => {
  const dispositions = resolveAll({
    env: {
      [E2E_OPT_IN_ENV]: "1",
      [E2E_PRODUCT_ENV]: " openrouter , zai ,deepseek",
      OPENROUTER_API_KEY: "k",
      ZAI_API_KEY: "k",
      DEEPSEEK_API_KEY: "k",
    },
  });
  assert.deepEqual(
    dispositions.map((disposition) => [
      disposition.kind,
      disposition.productId,
      disposition.modelId,
    ]),
    [
      ["run", "openrouter", DEFAULT_OPENROUTER_E2E_MODEL],
      ["run", "zai", "glm-5-turbo"],
      ["run", "deepseek", "deepseek-v4-flash"],
    ],
  );
});

test("the model override is ignored for a multi-product matrix", () => {
  const env = {
    [E2E_OPT_IN_ENV]: "1",
    [E2E_PRODUCT_ENV]: "gemini,zai",
    [E2E_MODEL_ENV]: "gemini-3-pro",
    GOOGLE_API_KEY: "k",
    ZAI_API_KEY: "k",
  };
  assert.deepEqual(
    resolveAll({ env }).map((disposition) => disposition.modelId),
    ["gemini-2.5-flash", "glm-5-turbo"],
  );
  assert.match(modelOverrideNotice(env), /^NOTE: DIFFGAZER_LIVE_E2E_MODEL ignored/);
});

test("a single requested product honors the model override with no notice", () => {
  const env = {
    [E2E_OPT_IN_ENV]: "1",
    [E2E_PRODUCT_ENV]: "gemini",
    [E2E_MODEL_ENV]: "gemini-3-pro",
    GOOGLE_API_KEY: "k",
  };
  assert.equal(resolve({ env }).modelId, "gemini-3-pro");
  assert.equal(modelOverrideNotice(env), null);
});

test("no notice without the override or without opt-in", () => {
  assert.equal(
    modelOverrideNotice({ [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "gemini,zai" }),
    null,
  );
  assert.equal(
    modelOverrideNotice({ [E2E_PRODUCT_ENV]: "gemini,zai", [E2E_MODEL_ENV]: "gemini-3-pro" }),
    null,
  );
});

test("a product whose harness throws gets an honest FAIL line", () => {
  assert.equal(
    runFailureLine("zai", "connect ECONNREFUSED"),
    "FAIL: live review e2e (zai) — connect ECONNREFUSED",
  );
});

test("a repeated product runs once", () => {
  const dispositions = resolveAll({
    env: { [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "zai,zai", ZAI_API_KEY: "k" },
  });
  assert.equal(dispositions.length, 1);
});

test("each matrix product carries its own credential disposition", () => {
  const dispositions = resolveAll({
    env: { [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "zai,deepseek", ZAI_API_KEY: "k" },
  });
  assert.equal(dispositions[0].kind, "run");
  assert.deepEqual(dispositions[1], {
    kind: "unavailable",
    reason: "credential-missing",
    productId: "deepseek",
    credentialEnv: "DEEPSEEK_API_KEY",
  });
});

test("a blocking gate collapses the matrix to one disposition", () => {
  assert.deepEqual(
    resolveAll({
      env: { [E2E_OPT_IN_ENV]: "1", [E2E_PRODUCT_ENV]: "openrouter,zai" },
      hasServerDist: false,
    }),
    [{ kind: "unavailable", reason: "server-dist-missing" }],
  );
});

test("not-requested dispositions pass under strict skips", () => {
  finalizeE2eDispositions(
    [
      { kind: "not-requested", reason: "live-e2e-disabled" },
      { kind: "not-requested", reason: "network-disabled" },
    ],
    true,
  );
});

test("unavailable dispositions fail under strict skips and pass otherwise", () => {
  const disposition = {
    kind: "unavailable",
    reason: "credential-missing",
    productId: "openrouter",
    credentialEnv: "OPENROUTER_API_KEY",
  };
  finalizeE2eDispositions([disposition], false);
  assert.throws(() => finalizeE2eDispositions([disposition], true), /credential-missing/);
});

test("one unavailable product in a matrix fails strict skips", () => {
  const dispositions = resolveAll({
    env: {
      [E2E_OPT_IN_ENV]: "1",
      [E2E_PRODUCT_ENV]: "openrouter,zai",
      OPENROUTER_API_KEY: "k",
    },
  });
  finalizeE2eDispositions(dispositions, false);
  assert.throws(() => finalizeE2eDispositions(dispositions, true), /ZAI_API_KEY/);
});

test("skip line carries the full copy-pastable command", () => {
  const line = skipLine({ kind: "not-requested", reason: "live-e2e-disabled" });
  assert.match(
    line,
    /DIFFGAZER_SMOKE_ALLOW_NETWORK=1 DIFFGAZER_LIVE_E2E=1 OPENROUTER_API_KEY=\.\.\. pnpm run smoke:review/,
  );
  assert.match(line, /^SKIP: /);
});

test("credential-missing skip line names the product's credential env", () => {
  const line = skipLine({
    kind: "unavailable",
    reason: "credential-missing",
    productId: "gemini",
    credentialEnv: "GOOGLE_API_KEY",
  });
  assert.match(line, /set GOOGLE_API_KEY/);
  assert.match(
    line,
    /DIFFGAZER_LIVE_E2E_PRODUCT=gemini GOOGLE_API_KEY=\.\.\. pnpm run smoke:review/,
  );
});

test("SSE parser reassembles a frame split across chunks", () => {
  const parser = createSseFrameParser();
  assert.deepEqual(parser.feed("event: complete\nda"), []);
  assert.deepEqual(parser.feed('ta: {"a":1}\n\n'), [{ event: "complete", data: '{"a":1}' }]);
});

test("SSE parser emits multiple frames from one chunk", () => {
  const parser = createSseFrameParser();
  const frames = parser.feed(
    'event: step_start\ndata: {"a":1}\n\nevent: complete\ndata: {"b":2}\n\n',
  );
  assert.deepEqual(frames, [
    { event: "step_start", data: '{"a":1}' },
    { event: "complete", data: '{"b":2}' },
  ]);
});

test("SSE parser joins multi-line data and handles CRLF", () => {
  const parser = createSseFrameParser();
  const frames = parser.feed("event: chunk\r\ndata: first\r\ndata: second\r\n\r\n");
  assert.deepEqual(frames, [{ event: "chunk", data: "first\nsecond" }]);
});

test("SSE parser does not emit a trailing partial frame", () => {
  const parser = createSseFrameParser();
  assert.deepEqual(parser.feed('event: complete\ndata: {"a":1}\n'), []);
});

test("SSE parser ignores comment and id lines", () => {
  const parser = createSseFrameParser();
  const frames = parser.feed(": keep-alive\nid: 3\nevent: chunk\ndata: x\n\n");
  assert.deepEqual(frames, [{ event: "chunk", data: "x" }]);
});

const completeTerminal = { type: "complete", result: { issues: [] }, reviewId: "r-1" };
const completeWithFinding = {
  type: "complete",
  result: { issues: [{ id: "i-1" }] },
  reviewId: "r-1",
};

test("complete + streamed + persisted + listed -> pass", () => {
  const { verdict, lines } = evaluateRun({
    sawNonTerminalEvent: true,
    terminal: completeWithFinding,
    timedOut: false,
    persisted: true,
    listed: true,
  });
  assert.equal(verdict, "pass");
  assert.deepEqual(lines, ["OK: live review e2e — completed, 1 issue(s), lens correctness"]);
});

test("a completed run with no findings warns but passes", () => {
  const { verdict, lines } = evaluateRun({
    sawNonTerminalEvent: true,
    terminal: completeTerminal,
    timedOut: false,
    persisted: true,
    listed: true,
  });
  assert.equal(verdict, "pass");
  assert.match(lines[1], /^WARN: the planted bug produced no findings/);
});

test("a schema-invalid stream payload fails a run that otherwise passed", () => {
  const { verdict, lines } = evaluateRun({
    sawNonTerminalEvent: true,
    terminal: completeWithFinding,
    timedOut: false,
    persisted: true,
    listed: true,
    schemaErrors: ["agent_progress.agent: Invalid input", "complete.result.issues.0.severity: bad"],
  });
  assert.equal(verdict, "fail");
  assert.equal(lines.length, 1);
  assert.match(lines[0], /2 stream payload\(s\) that do not match the published schema/);
  assert.match(lines[0], /agent_progress\.agent: Invalid input; complete\.result\.issues/);
});

test("only the first few schema errors are printed", () => {
  const { lines } = evaluateRun({
    sawNonTerminalEvent: true,
    terminal: completeWithFinding,
    timedOut: false,
    persisted: true,
    listed: true,
    schemaErrors: ["a", "b", "c", "d"],
  });
  assert.match(lines[0], /saw 4 stream payload\(s\).*: a; b; c$/);
});

test("a terminal error outranks schema errors", () => {
  const { lines } = evaluateRun({
    sawNonTerminalEvent: true,
    terminal: { type: "error", error: { code: "AI_ERROR", message: "upstream died" } },
    timedOut: false,
    persisted: false,
    listed: false,
    schemaErrors: ["chunk.content: Invalid input"],
  });
  assert.match(lines[0], /AI_ERROR: upstream died/);
});

test("complete with failed lenses -> pass with WARN lines", () => {
  const { verdict, lines } = evaluateRun({
    sawNonTerminalEvent: true,
    terminal: completeTerminal,
    timedOut: false,
    persisted: true,
    listed: true,
    failedLenses: ["detective: provider unavailable"],
  });
  assert.equal(verdict, "pass");
  assert.match(lines[1], /^WARN: 1 lens\(es\) failed honestly: detective: provider unavailable/);
});

test("terminal error -> fail with code and message", () => {
  const { verdict, lines } = evaluateRun({
    sawNonTerminalEvent: true,
    terminal: { type: "error", error: { code: "MODEL_INCOMPATIBLE", message: "no schema" } },
    timedOut: false,
    persisted: false,
    listed: false,
  });
  assert.equal(verdict, "fail");
  assert.match(lines[0], /MODEL_INCOMPATIBLE: no schema/);
  assert.equal(lines.length, 1);
});

test("rate-limited terminal error adds the model hint", () => {
  const { lines } = evaluateRun({
    sawNonTerminalEvent: true,
    terminal: { type: "error", error: { code: "PROVIDER_REJECTED", message: "429 too many" } },
    timedOut: false,
    persisted: false,
    listed: false,
  });
  assert.match(lines[1], /rate limit.*DIFFGAZER_LIVE_E2E_MODEL/);
});

test("non-rate-limit provider rejection does not add the rate limit hint", () => {
  const { lines } = evaluateRun({
    sawNonTerminalEvent: true,
    terminal: {
      type: "error",
      error: { code: "PROVIDER_REJECTED", message: "HTTP 401: rejected the credential" },
    },
    timedOut: false,
    persisted: false,
    listed: false,
  });
  assert.equal(lines.length, 1);
});

test("timeout -> fail", () => {
  const { verdict, lines } = evaluateRun({
    sawNonTerminalEvent: true,
    terminal: null,
    timedOut: true,
    persisted: false,
    listed: false,
  });
  assert.equal(verdict, "fail");
  assert.match(lines[0], /did not reach a terminal event/);
});

for (const { persisted, listed, missing } of [
  { persisted: false, listed: true, missing: "detail fetch" },
  { persisted: true, listed: false, missing: "history listing" },
  { persisted: false, listed: false, missing: "detail fetch and history listing" },
]) {
  test(`complete but persistence missing (${missing}) -> fail`, () => {
    const { verdict, lines } = evaluateRun({
      sawNonTerminalEvent: true,
      terminal: completeTerminal,
      timedOut: false,
      persisted,
      listed,
    });
    assert.equal(verdict, "fail");
    assert.equal(
      lines[0],
      `FAIL: live review e2e completed but persistence is missing (${missing}).`,
    );
  });
}

test("stream ends without a terminal event -> fail", () => {
  const { verdict, lines } = evaluateRun({
    sawNonTerminalEvent: true,
    terminal: null,
    timedOut: false,
    persisted: true,
    listed: true,
  });
  assert.equal(verdict, "fail");
  assert.match(lines[0], /stream ended without a terminal event/);
});

test("terminal complete without any non-terminal event -> fail", () => {
  const { verdict, lines } = evaluateRun({
    sawNonTerminalEvent: false,
    terminal: completeTerminal,
    timedOut: false,
    persisted: true,
    listed: true,
  });
  assert.equal(verdict, "fail");
  assert.match(lines[0], /without any non-terminal stream event/);
});
