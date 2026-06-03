import { describe, expect, it } from "vitest";
import { createElement } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { guardQueryState, matchQueryState } from "./match-query-state.js";

type QueryShape<T> = Pick<
  UseQueryResult<T>,
  "isLoading" | "error" | "data" | "fetchStatus"
>;

function queryResult<T>(shape: QueryShape<T>): UseQueryResult<T> {
  return shape as UseQueryResult<T>;
}

const handlers = {
  loading: () => "loading" as const,
  error: (err: Error) => `error:${err.message}` as const,
  success: (data: string) => `success:${data}` as const,
};

describe("matchQueryState", () => {
  it("renders loading while a query is fetching", () => {
    const query = queryResult<string>({
      isLoading: true,
      error: null,
      data: undefined,
      fetchStatus: "fetching",
    });

    expect(matchQueryState(query, handlers)).toBe("loading");
  });

  it("renders the error branch over stale data on refetch failure", () => {
    const query = queryResult<string>({
      isLoading: false,
      error: new Error("boom"),
      data: "stale",
      fetchStatus: "idle",
    });

    expect(matchQueryState(query, handlers)).toBe("error:boom");
  });

  it("renders success once data resolves", () => {
    const query = queryResult<string>({
      isLoading: false,
      error: null,
      data: "models",
      fetchStatus: "idle",
    });

    expect(matchQueryState(query, handlers)).toBe("success:models");
  });

  it("renders nothing for a disabled, idle query instead of a perpetual spinner", () => {
    const query = queryResult<string>({
      isLoading: false,
      error: null,
      data: undefined,
      fetchStatus: "idle",
    });

    expect(matchQueryState(query, handlers)).toBeNull();
  });
});

describe("guardQueryState", () => {
  const loadingElement = createElement("span", null, "loading");
  const errorElement = createElement("span", null, "error");
  const guard = {
    loading: () => loadingElement,
    error: () => errorElement,
  };

  it("returns the loading element while a query is fetching", () => {
    const query = queryResult<string>({
      isLoading: true,
      error: null,
      data: undefined,
      fetchStatus: "fetching",
    });

    expect(guardQueryState(query, guard)).toBe(loadingElement);
  });

  it("returns the error element on failure", () => {
    const query = queryResult<string>({
      isLoading: false,
      error: new Error("nope"),
      data: undefined,
      fetchStatus: "idle",
    });

    expect(guardQueryState(query, guard)).toBe(errorElement);
  });

  it("returns null once data is available so the caller proceeds", () => {
    const query = queryResult<string>({
      isLoading: false,
      error: null,
      data: "ready",
      fetchStatus: "idle",
    });

    expect(guardQueryState(query, guard)).toBeNull();
  });

  it("returns null for a disabled, idle query so it does not render a forever spinner", () => {
    const query = queryResult<string>({
      isLoading: false,
      error: null,
      data: undefined,
      fetchStatus: "idle",
    });

    expect(guardQueryState(query, guard)).toBeNull();
  });
});
