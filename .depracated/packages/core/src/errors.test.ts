import { describe, expect, it } from "vitest";
import {
  createError,
  isNodeError,
  getErrorMessage,
  toError,
  isAbortError,
} from "./errors.js";
import { createErrnoException } from "./__test__/testing.js";

describe("createError", () => {
  it("creates error object with code and message", () => {
    const error = createError("VALIDATION_ERROR", "Invalid input");

    expect(error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Invalid input",
    });
  });

  it("includes optional details field", () => {
    const error = createError(
      "NETWORK_ERROR",
      "Request failed",
      "Connection timeout after 30s"
    );

    expect(error).toEqual({
      code: "NETWORK_ERROR",
      message: "Request failed",
      details: "Connection timeout after 30s",
    });
  });

  it("omits details when not provided", () => {
    const error = createError("ERROR", "Something failed");

    expect(error).toEqual({
      code: "ERROR",
      message: "Something failed",
    });
    expect(error.details).toBeUndefined();
  });
});

describe("isNodeError", () => {
  it("returns true for NodeJS.ErrnoException with matching code", () => {
    const nodeError = createErrnoException("File not found", "ENOENT");

    expect(isNodeError(nodeError, "ENOENT")).toBe(true);
  });

  it("returns false for NodeJS.ErrnoException with non-matching code", () => {
    const nodeError = createErrnoException("Permission denied", "EACCES");

    expect(isNodeError(nodeError, "ENOENT")).toBe(false);
  });

  it("returns false for regular Error without code property", () => {
    const error = new Error("Regular error");

    expect(isNodeError(error, "ENOENT")).toBe(false);
  });

  it("returns false for non-Error objects", () => {
    expect(isNodeError("string error", "ENOENT")).toBe(false);
    expect(isNodeError({ message: "object error" }, "ENOENT")).toBe(false);
    expect(isNodeError(null, "ENOENT")).toBe(false);
    expect(isNodeError(undefined, "ENOENT")).toBe(false);
  });

  it("detects ENOENT errors", () => {
    const enoent = createErrnoException("No such file", "ENOENT");

    expect(isNodeError(enoent, "ENOENT")).toBe(true);
  });

  it("detects EACCES errors", () => {
    const eacces = createErrnoException("Permission denied", "EACCES");

    expect(isNodeError(eacces, "EACCES")).toBe(true);
  });

  it("uses type guard correctly", () => {
    const error: unknown = createErrnoException("Test", "ENOENT");

    if (isNodeError(error, "ENOENT")) {
      expect(error.code).toBe("ENOENT");
    } else {
      throw new Error("Type guard failed");
    }
  });
});

describe("getErrorMessage", () => {
  it("extracts message from Error object", () => {
    const error = new Error("Something went wrong");

    expect(getErrorMessage(error)).toBe("Something went wrong");
  });

  it("converts string to string", () => {
    expect(getErrorMessage("Error string")).toBe("Error string");
  });

  it("converts non-Error objects to string", () => {
    expect(getErrorMessage({ code: 500 })).toBe("[object Object]");
    expect(getErrorMessage(42)).toBe("42");
    expect(getErrorMessage(true)).toBe("true");
  });

  it("handles null and undefined", () => {
    expect(getErrorMessage(null)).toBe("null");
    expect(getErrorMessage(undefined)).toBe("undefined");
  });

  it("handles custom Error subclasses", () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "CustomError";
      }
    }

    const error = new CustomError("Custom error message");
    expect(getErrorMessage(error)).toBe("Custom error message");
  });

  it("handles errors with empty messages", () => {
    const error = new Error("");
    expect(getErrorMessage(error)).toBe("");
  });
});

describe("toError", () => {
  it("returns Error unchanged when input is Error", () => {
    const original = new Error("Original error");
    const result = toError(original);

    expect(result).toBe(original);
    expect(result.message).toBe("Original error");
  });

  it("converts string to Error", () => {
    const result = toError("String error");

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("String error");
  });

  it("converts non-Error objects to Error", () => {
    const result = toError({ code: 404 });

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("[object Object]");
  });

  it("converts number to Error", () => {
    const result = toError(42);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("42");
  });

  it("converts null to Error", () => {
    const result = toError(null);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("null");
  });

  it("preserves Error subclass instances", () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "CustomError";
      }
    }

    const custom = new CustomError("Custom");
    const result = toError(custom);

    expect(result).toBe(custom);
    expect(result).toBeInstanceOf(CustomError);
  });
});

describe("isAbortError", () => {
  it("returns true for Error with AbortError name", () => {
    const error = new Error("Operation aborted");
    error.name = "AbortError";

    expect(isAbortError(error)).toBe(true);
  });

  it("returns false for regular Error", () => {
    const error = new Error("Regular error");

    expect(isAbortError(error)).toBe(false);
  });

  it("returns false for non-Error objects", () => {
    expect(isAbortError("error")).toBe(false);
    expect(isAbortError({ name: "AbortError" })).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });

  it("handles DOMException with AbortError name", () => {
    if (typeof DOMException !== "undefined") {
      const error = new DOMException("The operation was aborted", "AbortError");
      expect(isAbortError(error)).toBe(true);
    } else {
      const error = new Error("Aborted");
      error.name = "AbortError";
      expect(isAbortError(error)).toBe(true);
    }
  });

  it("returns false for errors with different names", () => {
    const error = new Error("Error");
    error.name = "TypeError";

    expect(isAbortError(error)).toBe(false);
  });

  it("works with AbortController signal errors", () => {
    const controller = new AbortController();
    controller.abort();

    const error = new Error("Signal aborted");
    error.name = "AbortError";

    expect(isAbortError(error)).toBe(true);
  });
});
