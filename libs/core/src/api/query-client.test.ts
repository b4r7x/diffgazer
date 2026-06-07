import { describe, expect, it } from "vitest";
import { createQueryClientBase } from "./query-client.js";

type RetryFn = (failureCount: number, error: unknown) => boolean;

function httpError(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

describe("createQueryClientBase", () => {
  it("applies the shared defaults when no overrides are given", () => {
    const queries = createQueryClientBase().getDefaultOptions().queries;
    expect(queries?.staleTime).toBe(60_000);

    const retry = queries?.retry as RetryFn;
    expect(retry(0, httpError(404))).toBe(false);
    expect(retry(0, httpError(500))).toBe(true);
    expect(retry(2, httpError(500))).toBe(false);
  });

  it("lets overrides replace query defaults", () => {
    const queries = createQueryClientBase({
      defaultOptions: { queries: { retry: 1, staleTime: 30_000, networkMode: "always" } },
    }).getDefaultOptions().queries;

    expect(queries?.retry).toBe(1);
    expect(queries?.staleTime).toBe(30_000);
    expect(queries?.networkMode).toBe("always");
  });

  it("merges mutation overrides alongside the query defaults", () => {
    const defaults = createQueryClientBase({
      defaultOptions: { mutations: { networkMode: "always" } },
    }).getDefaultOptions();

    expect(defaults.mutations?.networkMode).toBe("always");
    expect(defaults.queries?.staleTime).toBe(60_000);
  });
});
