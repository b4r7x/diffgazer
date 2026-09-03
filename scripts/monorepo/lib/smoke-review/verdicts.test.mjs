import assert from "node:assert/strict";
import { test } from "node:test";
import { E2E_LENS, evaluateBatchingProof, evaluateRun, labelCellLines } from "./verdicts.mjs";

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
    lensStats: [
      {
        lensId: "correctness",
        status: "failed",
        errorCode: "PROVIDER_REJECTED",
        errorMessage: "provider unavailable",
        dispatches: [{ batchIndex: 0, outcome: "provider-rejected" }],
      },
    ],
  });
  assert.equal(verdict, "pass");
  assert.match(
    lines[1],
    /^WARN: 1 lens\(es\) failed honestly: correctness \(provider-rejected\): provider unavailable$/,
  );
});

test("a failed lens with no dispatch rows names its bridge errorCode", () => {
  const { lines } = evaluateRun({
    sawNonTerminalEvent: true,
    terminal: completeTerminal,
    timedOut: false,
    persisted: true,
    listed: true,
    lensStats: [
      {
        lensId: "guardian",
        status: "failed",
        errorCode: "BUDGET_EXHAUSTED",
        errorMessage: "Not dispatched — the review budget was exhausted.",
      },
    ],
  });
  assert.match(lines[1], /failed honestly: guardian \(BUDGET_EXHAUSTED\): Not dispatched/);
});

test("a lens that completed with a failed batch warns on its own line and passes", () => {
  const { verdict, lines } = evaluateRun({
    sawNonTerminalEvent: true,
    terminal: completeWithFinding,
    timedOut: false,
    persisted: true,
    listed: true,
    lensStats: [
      {
        lensId: "correctness",
        status: "success",
        errorCode: "STREAM_ERROR",
        errorMessage: "timed-out failure",
        dispatches: [
          { batchIndex: 0, outcome: "completed" },
          { batchIndex: 1, outcome: "timed-out" },
          { batchIndex: 1, outcome: "timed-out" },
        ],
      },
    ],
  });
  assert.equal(verdict, "pass");
  assert.equal(lines.length, 2);
  assert.ok(!lines.some((line) => /failed honestly/.test(line)));
  assert.match(
    lines[1],
    /^WARN: 1 lens\(es\) completed with a failed batch: correctness \(timed-out\): timed-out failure$/,
  );
});

test("a re-queued batch that later completed prints no lens line", () => {
  const { lines } = evaluateRun({
    sawNonTerminalEvent: true,
    terminal: completeWithFinding,
    timedOut: false,
    persisted: true,
    listed: true,
    lensStats: [
      {
        lensId: "correctness",
        status: "success",
        dispatches: [
          { batchIndex: 0, outcome: "provider-rejected" },
          { batchIndex: 1, outcome: "completed" },
          { batchIndex: 0, outcome: "completed" },
        ],
      },
    ],
  });
  assert.deepEqual(lines, ["OK: live review e2e — completed, 1 issue(s), lens correctness"]);
});

test("missing persistence fails before any lens line", () => {
  const { verdict, lines } = evaluateRun({
    sawNonTerminalEvent: true,
    terminal: completeWithFinding,
    timedOut: false,
    persisted: false,
    listed: true,
    lensStats: [
      {
        lensId: "correctness",
        status: "failed",
        errorCode: "STREAM_ERROR",
        errorMessage: "stream died",
      },
    ],
  });
  assert.equal(verdict, "fail");
  assert.equal(lines.length, 1);
  assert.match(lines[0], /persistence is missing \(detail fetch\)/);
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

test("timeout reports the enforced per-scenario bound", () => {
  const { verdict, lines } = evaluateRun({
    sawNonTerminalEvent: true,
    terminal: null,
    timedOut: true,
    persisted: false,
    listed: false,
    timeoutMs: 1_200_000,
  });
  assert.equal(verdict, "fail");
  assert.match(lines[0], /did not reach a terminal event within 1200000ms/);
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

test("cell labels prefix verdict lines only", () => {
  const cell = { productId: "zai", scenarioId: "large" };
  assert.deepEqual(
    labelCellLines(
      ["OK: completed", "WARN: no findings", "FAIL: broke", "HINT: rerun", "NOTE: pinned"],
      cell,
    ),
    [
      "OK: (zai/large) completed",
      "WARN: (zai/large) no findings",
      "FAIL: (zai/large) broke",
      "HINT: rerun",
      "NOTE: pinned",
    ],
  );
});

const provenLensStats = [
  {
    lensId: E2E_LENS,
    dispatches: [
      { batchIndex: 0, outcome: "completed" },
      { batchIndex: 1, outcome: "completed" },
      { batchIndex: 2, outcome: "completed" },
    ],
  },
  { lensId: "synthesis", status: "success" },
];

test("batching proof passes clean, stating the observed batch count", () => {
  const { verdict, lines } = evaluateBatchingProof({
    sizeWarnings: [{ batchCount: 3 }],
    lensStats: provenLensStats,
    minBatchCount: 2,
  });
  assert.equal(verdict, "pass");
  assert.deepEqual(lines, ["OK: live review e2e — batching proven: 3 batches (>= 2) + synthesis"]);
});

test("batching proof fails without a size warning", () => {
  const { verdict, lines } = evaluateBatchingProof({
    sizeWarnings: [],
    lensStats: provenLensStats,
    minBatchCount: 2,
  });
  assert.equal(verdict, "fail");
  assert.match(lines[0], /no review_size_warning with batchCount >= 2/);
});

test("batching proof fails on a single-batch size warning", () => {
  const { verdict, lines } = evaluateBatchingProof({
    sizeWarnings: [{ batchCount: 1 }],
    lensStats: provenLensStats,
    minBatchCount: 2,
  });
  assert.equal(verdict, "fail");
  assert.match(lines[0], /no review_size_warning with batchCount >= 2/);
});

test("batching proof fails when dispatches miss batchIndex 1", () => {
  const { verdict, lines } = evaluateBatchingProof({
    sizeWarnings: [{ batchCount: 2 }],
    lensStats: [
      { lensId: E2E_LENS, dispatches: [{ batchIndex: 0, outcome: "completed" }] },
      { lensId: "synthesis", status: "success" },
    ],
    minBatchCount: 2,
  });
  assert.equal(verdict, "fail");
  assert.match(lines[0], /dispatches do not cover batchIndex 0\.\.1/);
});

test("batching proof fails without a synthesis row", () => {
  const { verdict, lines } = evaluateBatchingProof({
    sizeWarnings: [{ batchCount: 3 }],
    lensStats: [provenLensStats[0]],
    minBatchCount: 2,
  });
  assert.equal(verdict, "fail");
  assert.match(lines[0], /no lensId "synthesis" row/);
});

test("batching proof passes on a failed synthesis, warning with its errorCode", () => {
  const { verdict, lines } = evaluateBatchingProof({
    sizeWarnings: [{ batchCount: 2 }],
    lensStats: [
      {
        lensId: E2E_LENS,
        dispatches: [
          { batchIndex: 0, outcome: "completed" },
          { batchIndex: 1, outcome: "completed" },
        ],
      },
      { lensId: "synthesis", status: "failed", errorCode: "AI_ERROR" },
    ],
    minBatchCount: 2,
  });
  assert.equal(verdict, "pass");
  assert.match(lines[1], /^WARN: synthesis lens failed honestly \(AI_ERROR\)/);
});

test("large family: batching proof passes at minBatchCount 3 with batchIndex 0..2 covered", () => {
  const { verdict, lines } = evaluateBatchingProof({
    sizeWarnings: [{ batchCount: 3 }],
    lensStats: provenLensStats,
    minBatchCount: 3,
  });
  assert.equal(verdict, "pass");
  assert.deepEqual(lines, ["OK: live review e2e — batching proven: 3 batches (>= 3) + synthesis"]);
});

test("large family: batching proof fails at batchCount 2 against minBatchCount 3", () => {
  const { verdict, lines } = evaluateBatchingProof({
    sizeWarnings: [{ batchCount: 2 }],
    lensStats: provenLensStats,
    minBatchCount: 3,
  });
  assert.equal(verdict, "fail");
  assert.match(lines[0], /no review_size_warning with batchCount >= 3/);
});

test("large family: batching proof fails when dispatches miss batchIndex 2 against minBatchCount 3", () => {
  const { verdict, lines } = evaluateBatchingProof({
    sizeWarnings: [{ batchCount: 3 }],
    lensStats: [
      {
        lensId: E2E_LENS,
        dispatches: [
          { batchIndex: 0, outcome: "completed" },
          { batchIndex: 1, outcome: "completed" },
        ],
      },
      { lensId: "synthesis", status: "success" },
    ],
    minBatchCount: 3,
  });
  assert.equal(verdict, "fail");
  assert.match(lines[0], /dispatches do not cover batchIndex 0\.\.2/);
});

test("batching proof fails when a batchIndex has only non-completed dispatches", () => {
  const { verdict, lines } = evaluateBatchingProof({
    sizeWarnings: [{ batchCount: 2 }],
    lensStats: [
      {
        lensId: E2E_LENS,
        dispatches: [
          { batchIndex: 0, outcome: "completed" },
          { batchIndex: 1, outcome: "timed-out" },
        ],
      },
      { lensId: "synthesis", status: "success" },
    ],
    minBatchCount: 2,
  });
  assert.equal(verdict, "fail");
  assert.match(lines[0], /correctness lens completed dispatches do not cover batchIndex 0\.\.1/);
});

test("batching proof counts a re-queued batch that later completed", () => {
  const { verdict } = evaluateBatchingProof({
    sizeWarnings: [{ batchCount: 2 }],
    lensStats: [
      {
        lensId: E2E_LENS,
        dispatches: [
          { batchIndex: 0, outcome: "provider-rejected" },
          { batchIndex: 1, outcome: "completed" },
          { batchIndex: 0, outcome: "completed" },
        ],
      },
      { lensId: "synthesis", status: "success" },
    ],
    minBatchCount: 2,
  });
  assert.equal(verdict, "pass");
});

test("failed synthesis warns with its diagnostic cause code when a dispatch row carries one", () => {
  const { lines } = evaluateBatchingProof({
    sizeWarnings: [{ batchCount: 2 }],
    lensStats: [
      {
        lensId: E2E_LENS,
        dispatches: [
          { batchIndex: 0, outcome: "completed" },
          { batchIndex: 1, outcome: "completed" },
        ],
      },
      {
        lensId: "synthesis",
        status: "failed",
        errorCode: "STREAM_ERROR",
        dispatches: [{ batchIndex: 0, outcome: "timed-out" }],
      },
    ],
    minBatchCount: 2,
  });
  assert.match(lines[1], /^WARN: synthesis lens failed honestly \(timed-out\)/);
});

test("batching proof throws on a missing or sub-2 minBatchCount", () => {
  assert.throws(
    () => evaluateBatchingProof({ sizeWarnings: [{ batchCount: 3 }], lensStats: provenLensStats }),
    /minBatchCount/,
  );
  assert.throws(
    () =>
      evaluateBatchingProof({
        sizeWarnings: [{ batchCount: 3 }],
        lensStats: provenLensStats,
        minBatchCount: 1,
      }),
    /minBatchCount/,
  );
});
