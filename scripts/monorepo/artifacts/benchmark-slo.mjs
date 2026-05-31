// Pure helpers for the server benchmark's functional/latency gating. Kept here
// (separate from the server-driving harness) so the status-aggregation and SLO
// logic can be unit-tested without booting a live server.

// Aggregate every observed response status for a scenario. Returns the total
// count of non-200 responses plus the first non-200 status seen, so a single
// earlier error in a long run is not masked by a final 200.
export function summarizeStatuses(statuses) {
  let nonOkCount = 0;
  let firstFailingStatus = null;
  const countsByStatus = {};
  for (const status of statuses) {
    countsByStatus[status] = (countsByStatus[status] ?? 0) + 1;
    if (status !== 200) {
      nonOkCount += 1;
      if (firstFailingStatus === null) firstFailingStatus = status;
    }
  }
  return { nonOkCount, firstFailingStatus, countsByStatus };
}

function formatCountsByStatus(countsByStatus) {
  return Object.entries(countsByStatus)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([status, count]) => `${status}:${count}`)
    .join(", ");
}

// Functional failures (any non-200) always gate; latency/throughput breaches
// only gate under strict mode so machine-dependent timings do not flake CI.
export function checkSlo({ functionalFailures, latencyBreaches }, label, result, slo) {
  if (result.nonOkCount > 0) {
    functionalFailures.push(
      `${label} returned ${result.nonOkCount} non-200 response(s) `
      + `(first ${result.firstFailingStatus}; by status: ${formatCountsByStatus(result.countsByStatus)})`,
    );
    return;
  }
  if (result.p95 > slo.p95Ms) {
    latencyBreaches.push(`${label} p95 ${result.p95.toFixed(2)}ms exceeds SLO ${slo.p95Ms}ms`);
  }
  if (result.p99 > slo.p99Ms) {
    latencyBreaches.push(`${label} p99 ${result.p99.toFixed(2)}ms exceeds SLO ${slo.p99Ms}ms`);
  }
  if (result.requestsPerSecond < slo.minRequestsPerSecond) {
    latencyBreaches.push(
      `${label} ${result.requestsPerSecond.toFixed(0)} req/s is below SLO ${slo.minRequestsPerSecond} req/s`,
    );
  }
}
