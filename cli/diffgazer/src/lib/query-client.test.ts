import { describe, expect, test } from "vitest";
import { createCliQueryClient } from "./query-client";

type RetryFn = (failureCount: number, error: unknown) => boolean;

function httpError(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

describe("createCliQueryClient", () => {
  test("never retries 4xx responses", () => {
    const retry = createCliQueryClient().getDefaultOptions().queries?.retry as RetryFn;
    expect(retry(0, httpError(403))).toBe(false);
    expect(retry(0, httpError(404))).toBe(false);
  });

  test("retries transient errors at most once", () => {
    const retry = createCliQueryClient().getDefaultOptions().queries?.retry as RetryFn;
    expect(retry(0, httpError(500))).toBe(true);
    expect(retry(1, httpError(500))).toBe(false);
  });
});
