import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSlo, summarizeStatuses } from "./benchmark-slo.mjs";

test("summarizeStatuses reports zero failures for an all-200 run", () => {
  const result = summarizeStatuses([200, 200, 200]);
  assert.equal(result.nonOkCount, 0);
  assert.equal(result.firstFailingStatus, null);
  assert.deepEqual(result.countsByStatus, { 200: 3 });
});

test("summarizeStatuses counts every earlier failure and retains the first even when the final request succeeds", () => {
  const result = summarizeStatuses([200, 401, 500, 401, 200]);
  assert.equal(result.nonOkCount, 3);
  assert.equal(result.firstFailingStatus, 401);
  assert.deepEqual(result.countsByStatus, { 200: 2, 401: 2, 500: 1 });
});

test("checkSlo records a functional failure when any non-200 response occurred", () => {
  const functionalFailures = [];
  const latencyBreaches = [];
  const result = {
    ...summarizeStatuses([200, 500, 200]),
    p95: 1,
    p99: 1,
    requestsPerSecond: 10000,
  };
  checkSlo({ functionalFailures, latencyBreaches }, "GET /health", result, {
    p95Ms: 50,
    p99Ms: 100,
    minRequestsPerSecond: 500,
  });
  assert.equal(functionalFailures.length, 1);
  assert.match(functionalFailures[0], /non-200/);
  assert.match(functionalFailures[0], /first 500/);
  assert.match(functionalFailures[0], /500:1/);
  assert.deepEqual(latencyBreaches, []);
});

test("checkSlo skips latency checks once a functional failure is recorded", () => {
  const functionalFailures = [];
  const latencyBreaches = [];
  const result = {
    ...summarizeStatuses([401]),
    p95: 9999,
    p99: 9999,
    requestsPerSecond: 0,
  };
  checkSlo({ functionalFailures, latencyBreaches }, "GET /api/config/init", result, {
    p95Ms: 50,
    p99Ms: 100,
    minRequestsPerSecond: 500,
  });
  assert.equal(functionalFailures.length, 1);
  assert.deepEqual(latencyBreaches, []);
});

test("checkSlo records nothing when an all-200 run is within every SLO", () => {
  const functionalFailures = [];
  const latencyBreaches = [];
  const result = {
    ...summarizeStatuses([200, 200]),
    p95: 10,
    p99: 20,
    requestsPerSecond: 10000,
  };
  checkSlo({ functionalFailures, latencyBreaches }, "GET /health", result, {
    p95Ms: 50,
    p99Ms: 100,
    minRequestsPerSecond: 500,
  });
  assert.deepEqual(functionalFailures, []);
  assert.deepEqual(latencyBreaches, []);
});

test("checkSlo records latency breaches when all responses are 200", () => {
  const functionalFailures = [];
  const latencyBreaches = [];
  const result = {
    ...summarizeStatuses([200, 200]),
    p95: 200,
    p99: 300,
    requestsPerSecond: 10,
  };
  checkSlo({ functionalFailures, latencyBreaches }, "GET /health", result, {
    p95Ms: 50,
    p99Ms: 100,
    minRequestsPerSecond: 500,
  });
  assert.deepEqual(functionalFailures, []);
  assert.deepEqual(latencyBreaches, [
    "GET /health p95 200.00ms exceeds SLO 50ms",
    "GET /health p99 300.00ms exceeds SLO 100ms",
    "GET /health 10 req/s is below SLO 500 req/s",
  ]);
});
