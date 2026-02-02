import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

interface UseFigletResult {
  text: string | null;
  isLoading: boolean;
  error: Error | null;
}

function computeInitialState(): UseFigletResult {
  return {
    text: null,
    isLoading: true,
    error: null,
  };
}

function computeSuccessState(text: string): UseFigletResult {
  return {
    text,
    isLoading: false,
    error: null,
  };
}

function computeErrorState(error: unknown): UseFigletResult {
  return {
    text: null,
    isLoading: false,
    error: error instanceof Error ? error : new Error(String(error)),
  };
}

describe("useFiglet - State Logic", () => {
  describe("computeInitialState", () => {
    it("returns loading state with null text", () => {
      const state = computeInitialState();

      expect(state.isLoading).toBe(true);
      expect(state.text).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe("computeSuccessState", () => {
    it("returns text after figlet loads", () => {
      const figletOutput = `
  _   _      _ _
 | | | | ___| | | ___
 | |_| |/ _ \\ | |/ _ \\
 |  _  |  __/ | | (_) |
 |_| |_|\\___|_|_|\\___/
`;
      const state = computeSuccessState(figletOutput);

      expect(state.isLoading).toBe(false);
      expect(state.text).toBe(figletOutput);
      expect(state.error).toBeNull();
    });

    it("handles empty string output", () => {
      const state = computeSuccessState("");

      expect(state.isLoading).toBe(false);
      expect(state.text).toBe("");
      expect(state.error).toBeNull();
    });
  });

  describe("computeErrorState", () => {
    it("handles Error objects gracefully", () => {
      const error = new Error("Font not found");
      const state = computeErrorState(error);

      expect(state.isLoading).toBe(false);
      expect(state.text).toBeNull();
      expect(state.error).toBe(error);
      expect(state.error?.message).toBe("Font not found");
    });

    it("converts string errors to Error objects", () => {
      const state = computeErrorState("Something went wrong");

      expect(state.isLoading).toBe(false);
      expect(state.text).toBeNull();
      expect(state.error).toBeInstanceOf(Error);
      expect(state.error?.message).toBe("Something went wrong");
    });

    it("converts unknown error types", () => {
      const state = computeErrorState({ code: 123 });

      expect(state.error).toBeInstanceOf(Error);
      expect(state.error?.message).toBe("[object Object]");
    });
  });

  describe("state transitions", () => {
    it("initial -> success flow", () => {
      let state = computeInitialState();
      expect(state.isLoading).toBe(true);
      expect(state.text).toBeNull();

      state = computeSuccessState("ASCII ART");
      expect(state.isLoading).toBe(false);
      expect(state.text).toBe("ASCII ART");
    });

    it("initial -> error flow", () => {
      let state = computeInitialState();
      expect(state.isLoading).toBe(true);

      state = computeErrorState(new Error("Failed"));
      expect(state.isLoading).toBe(false);
      expect(state.error?.message).toBe("Failed");
    });
  });

  describe("invariants", () => {
    it("text is always null when error is present", () => {
      const state = computeErrorState(new Error("error"));

      expect(state.text).toBeNull();
      expect(state.error).not.toBeNull();
    });

    it("error is always null when text is present", () => {
      const state = computeSuccessState("text");

      expect(state.text).not.toBeNull();
      expect(state.error).toBeNull();
    });

    it("isLoading is always false when result is ready", () => {
      const successState = computeSuccessState("text");
      const errorState = computeErrorState(new Error("err"));

      expect(successState.isLoading).toBe(false);
      expect(errorState.isLoading).toBe(false);
    });
  });
});
