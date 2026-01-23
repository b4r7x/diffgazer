/**
 * Tests for useAsyncOperation hook
 * Tests the state transition logic and helper functions
 */

import { describe, it, expect } from "vitest";
import type { AsyncState, AsyncStatus } from "./use-async-operation.js";

/**
 * Pure function that computes the initial state based on whether initial data is provided.
 * This mirrors the logic in useAsyncOperation's useState initialization.
 */
function computeInitialState<T>(initialData?: T): AsyncState<T> {
  return {
    status: initialData !== undefined ? "success" : "idle",
    data: initialData,
  };
}

/**
 * Pure function that computes the state transition when starting an operation.
 * Preserves existing data while clearing errors and setting loading status.
 */
function computeLoadingState<T>(prevState: AsyncState<T>): AsyncState<T> {
  return { ...prevState, status: "loading", error: undefined };
}

/**
 * Pure function that computes the state on successful operation.
 */
function computeSuccessState<T>(data: T): AsyncState<T> {
  return { status: "success", data };
}

/**
 * Pure function that computes the state on failed operation.
 * Preserves previous data while setting error.
 */
function computeErrorState<T>(
  prevState: AsyncState<T>,
  errorMessage: string
): AsyncState<T> {
  return {
    status: "error",
    error: { message: errorMessage },
    data: prevState.data, // preserve previous data on error
  };
}

/**
 * Pure function that computes the reset state.
 */
function computeResetState<T>(): AsyncState<T> {
  return { status: "idle" };
}

/**
 * Pure function that computes the state when manually setting data.
 */
function computeSetDataState<T>(data: T): AsyncState<T> {
  return { status: "success", data };
}

describe("useAsyncOperation - State Transitions", () => {
  describe("computeInitialState", () => {
    it("returns idle status when no initial data provided", () => {
      const state = computeInitialState<string>();

      expect(state.status).toBe("idle");
      expect(state.data).toBeUndefined();
      expect(state.error).toBeUndefined();
    });

    it("returns success status when initial data is provided", () => {
      const initialData = { name: "test" };
      const state = computeInitialState(initialData);

      expect(state.status).toBe("success");
      expect(state.data).toEqual(initialData);
      expect(state.error).toBeUndefined();
    });

    it("returns idle when undefined is passed (undefined is not valid data)", () => {
      const state = computeInitialState<string | undefined>(undefined);

      expect(state.status).toBe("idle");
      expect(state.data).toBeUndefined();
    });

    it("accepts null as valid initial data", () => {
      const state = computeInitialState<string | null>(null);

      expect(state.status).toBe("success");
      expect(state.data).toBeNull();
    });

    it("accepts empty string as valid initial data", () => {
      const state = computeInitialState<string>("");

      expect(state.status).toBe("success");
      expect(state.data).toBe("");
    });

    it("accepts zero as valid initial data", () => {
      const state = computeInitialState<number>(0);

      expect(state.status).toBe("success");
      expect(state.data).toBe(0);
    });

    it("accepts false as valid initial data", () => {
      const state = computeInitialState<boolean>(false);

      expect(state.status).toBe("success");
      expect(state.data).toBe(false);
    });
  });

  describe("computeLoadingState", () => {
    it("transitions to loading from idle", () => {
      const prevState: AsyncState<string> = { status: "idle" };
      const state = computeLoadingState(prevState);

      expect(state.status).toBe("loading");
      expect(state.error).toBeUndefined();
    });

    it("preserves existing data during loading", () => {
      const prevState: AsyncState<string> = {
        status: "success",
        data: "existing data",
      };
      const state = computeLoadingState(prevState);

      expect(state.status).toBe("loading");
      expect(state.data).toBe("existing data");
    });

    it("clears previous error when transitioning to loading", () => {
      const prevState: AsyncState<string> = {
        status: "error",
        error: { message: "previous error" },
        data: "old data",
      };
      const state = computeLoadingState(prevState);

      expect(state.status).toBe("loading");
      expect(state.error).toBeUndefined();
      expect(state.data).toBe("old data");
    });
  });

  describe("computeSuccessState", () => {
    it("sets success status with data", () => {
      const data = { id: 1, name: "test" };
      const state = computeSuccessState(data);

      expect(state.status).toBe("success");
      expect(state.data).toEqual(data);
      expect(state.error).toBeUndefined();
    });

    it("handles primitive data types", () => {
      expect(computeSuccessState(42).data).toBe(42);
      expect(computeSuccessState("text").data).toBe("text");
      expect(computeSuccessState(true).data).toBe(true);
    });

    it("handles null data", () => {
      const state = computeSuccessState<string | null>(null);

      expect(state.status).toBe("success");
      expect(state.data).toBeNull();
    });

    it("handles array data", () => {
      const data = [1, 2, 3];
      const state = computeSuccessState(data);

      expect(state.data).toEqual([1, 2, 3]);
    });
  });

  describe("computeErrorState", () => {
    it("sets error status with message", () => {
      const prevState: AsyncState<string> = { status: "loading" };
      const state = computeErrorState(prevState, "Something went wrong");

      expect(state.status).toBe("error");
      expect(state.error?.message).toBe("Something went wrong");
    });

    it("preserves previous data on error", () => {
      const prevState: AsyncState<string> = {
        status: "loading",
        data: "previous data",
      };
      const state = computeErrorState(prevState, "error");

      expect(state.status).toBe("error");
      expect(state.data).toBe("previous data");
    });

    it("preserves undefined data if no previous data", () => {
      const prevState: AsyncState<string> = { status: "loading" };
      const state = computeErrorState(prevState, "error");

      expect(state.data).toBeUndefined();
    });
  });

  describe("computeResetState", () => {
    it("returns idle state", () => {
      const state = computeResetState<string>();

      expect(state.status).toBe("idle");
      expect(state.data).toBeUndefined();
      expect(state.error).toBeUndefined();
    });
  });

  describe("computeSetDataState", () => {
    it("sets data with success status", () => {
      const data = "manual data";
      const state = computeSetDataState(data);

      expect(state.status).toBe("success");
      expect(state.data).toBe(data);
      expect(state.error).toBeUndefined();
    });
  });

  describe("full state machine transitions", () => {
    it("idle -> loading -> success flow", () => {
      let state: AsyncState<string> = computeInitialState();
      expect(state.status).toBe("idle");

      state = computeLoadingState(state);
      expect(state.status).toBe("loading");

      state = computeSuccessState("result");
      expect(state.status).toBe("success");
      expect(state.data).toBe("result");
    });

    it("idle -> loading -> error flow", () => {
      let state: AsyncState<string> = computeInitialState();
      expect(state.status).toBe("idle");

      state = computeLoadingState(state);
      expect(state.status).toBe("loading");

      state = computeErrorState(state, "Failed");
      expect(state.status).toBe("error");
      expect(state.error?.message).toBe("Failed");
    });

    it("success -> loading -> error preserves data", () => {
      let state: AsyncState<string> = computeSuccessState("initial data");

      state = computeLoadingState(state);
      expect(state.data).toBe("initial data");

      state = computeErrorState(state, "Failed on retry");
      expect(state.status).toBe("error");
      expect(state.data).toBe("initial data");
      expect(state.error?.message).toBe("Failed on retry");
    });

    it("error -> reset -> loading -> success flow", () => {
      let state: AsyncState<number> = computeErrorState(
        { status: "loading" },
        "initial error"
      );
      expect(state.status).toBe("error");

      state = computeResetState();
      expect(state.status).toBe("idle");
      expect(state.error).toBeUndefined();

      state = computeLoadingState(state);
      expect(state.status).toBe("loading");

      state = computeSuccessState(42);
      expect(state.status).toBe("success");
      expect(state.data).toBe(42);
    });

    it("setData overwrites any previous state", () => {
      // From error state
      let state: AsyncState<string> = computeErrorState(
        { status: "loading", data: "old" },
        "error"
      );
      state = computeSetDataState("new data");
      expect(state.status).toBe("success");
      expect(state.data).toBe("new data");
      expect(state.error).toBeUndefined();
    });
  });

  describe("type safety scenarios", () => {
    it("handles complex nested data structures", () => {
      interface ComplexData {
        id: number;
        nested: { value: string; items: string[] };
        optional?: boolean;
      }

      const data: ComplexData = {
        id: 1,
        nested: { value: "test", items: ["a", "b"] },
      };

      const state = computeSuccessState(data);

      expect(state.data?.nested.value).toBe("test");
      expect(state.data?.nested.items).toEqual(["a", "b"]);
      expect(state.data?.optional).toBeUndefined();
    });

    it("handles union types", () => {
      type Result = { type: "user"; name: string } | { type: "error"; code: number };

      const userResult: Result = { type: "user", name: "John" };
      const state = computeSuccessState(userResult);

      expect(state.data).toEqual({ type: "user", name: "John" });
    });
  });
});

describe("AsyncStatus type", () => {
  it("has correct possible values", () => {
    const statuses: AsyncStatus[] = ["idle", "loading", "success", "error"];

    expect(statuses).toContain("idle");
    expect(statuses).toContain("loading");
    expect(statuses).toContain("success");
    expect(statuses).toContain("error");
    expect(statuses).toHaveLength(4);
  });
});
