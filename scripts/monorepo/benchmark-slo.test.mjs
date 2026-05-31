import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSlo, summarizeStatuses } from "./artifacts/benchmark-slo.mjs";

test("summarizeStatuses reports zero failures for an all-200 run", () => {
  const result = summarizeStatuses([200, 200, 200]);
  assert.equal(result.nonOkCount, 0);
  assert.equal(result.firstFailingStatus, null);
  assert.deepEqual(result.countsByStatus, { 200: 3 });
});

test("summarizeStatuses tracks an earlier non-200 even when the final request is 200", () => {
  const result = summarizeStatuses([200, 500, 200, 200]);
  assert.equal(result.nonOkCount, 1);
  assert.equal(result.firstFailingStatus, 500);
  assert.deepEqual(result.countsByStatus, { 200: 3, 500: 1 });
});

test("summarizeStatuses counts every non-200 and keeps the first failing status", () => {
  const result = summarizeStatuses([401, 500, 401, 200]);
  assert.equal(result.nonOkCount, 3);
  assert.equal(result.firstFailingStatus, 401);
  assert.deepEqual(result.countsByStatus, { 200: 1, 401: 2, 500: 1 });
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
  assert.equal(latencyBreaches.length, 3);
});
