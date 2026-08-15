import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { guardQueryState, matchQueryState, type QueryState } from "./match-query-state.js";

const handlers = {
  loading: () => "loading" as const,
  error: (err: Error) => `error:${err.message}` as const,
  success: (data: string) => `success:${data}` as const,
};

describe("matchQueryState", () => {
  it("renders loading while a query is fetching", () => {
    const query: QueryState<string> = {
      isLoading: true,
      error: null,
      data: undefined,
      fetchStatus: "fetching",
    };

    expect(matchQueryState(query, handlers)).toBe("loading");
  });

  it("renders the error branch over stale data on refetch failure", () => {
    const query: QueryState<string> = {
      isLoading: false,
      error: new Error("boom"),
      data: "stale",
      fetchStatus: "idle",
    };

    expect(matchQueryState(query, handlers)).toBe("error:boom");
  });

  it("renders success once data resolves", () => {
    const query: QueryState<string> = {
      isLoading: false,
      error: null,
      data: "models",
      fetchStatus: "idle",
    };

    expect(matchQueryState(query, handlers)).toBe("success:models");
  });

  it("renders nothing for a disabled, idle query instead of a perpetual spinner", () => {
    const query: QueryState<string> = {
      isLoading: false,
      error: null,
      data: undefined,
      fetchStatus: "idle",
    };

    expect(matchQueryState(query, handlers)).toBeNull();
  });

  it("renders loading while a query is paused before its first data resolves", () => {
    const query: QueryState<string> = {
      isLoading: false,
      error: null,
      data: undefined,
      fetchStatus: "paused",
    };

    expect(matchQueryState(query, handlers)).toBe("loading");
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
    const query: QueryState<string> = {
      isLoading: true,
      error: null,
      data: undefined,
      fetchStatus: "fetching",
    };

    expect(guardQueryState(query, guard)).toBe(loadingElement);
  });

  it("returns the error element on failure", () => {
    const query: QueryState<string> = {
      isLoading: false,
      error: new Error("nope"),
      data: undefined,
      fetchStatus: "idle",
    };

    expect(guardQueryState(query, guard)).toBe(errorElement);
  });

  it("returns null once data is available so the caller proceeds", () => {
    const query: QueryState<string> = {
      isLoading: false,
      error: null,
      data: "ready",
      fetchStatus: "idle",
    };

    expect(guardQueryState(query, guard)).toBeNull();
  });

  it("returns null for a disabled, idle query so it does not render a forever spinner", () => {
    const query: QueryState<string> = {
      isLoading: false,
      error: null,
      data: undefined,
      fetchStatus: "idle",
    };

    expect(guardQueryState(query, guard)).toBeNull();
  });

  it("returns the loading element while a query is paused before its first data resolves", () => {
    const query: QueryState<string> = {
      isLoading: false,
      error: null,
      data: undefined,
      fetchStatus: "paused",
    };

    expect(guardQueryState(query, guard)).toBe(loadingElement);
  });
});
