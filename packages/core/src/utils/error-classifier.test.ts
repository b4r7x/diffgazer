import { describe, expect, it } from "vitest";
import { createErrorClassifier } from "./error-classifier.js";

describe("createErrorClassifier", () => {
  it("matches error message against patterns", () => {
    const classifier = createErrorClassifier(
      [
        {
          patterns: ["not found", "404"],
          code: "NOT_FOUND",
          message: "Resource not found",
        },
        {
          patterns: ["timeout", "timed out"],
          code: "TIMEOUT",
          message: "Request timed out",
        },
      ],
      "UNKNOWN",
      (msg) => `Unknown error: ${msg}`
    );

    const result = classifier(new Error("File not found"));
    expect(result).toEqual({
      code: "NOT_FOUND",
      message: "Resource not found",
    });
  });

  it("matches case-insensitively", () => {
    const classifier = createErrorClassifier(
      [
        {
          patterns: ["network"],
          code: "NETWORK",
          message: "Network error",
        },
      ],
      "UNKNOWN",
      (msg) => `Unknown error: ${msg}`
    );

    const uppercase = classifier(new Error("NETWORK FAILURE"));
    const mixed = classifier(new Error("Network Error Occurred"));
    const lowercase = classifier(new Error("network timeout"));

    expect(uppercase).toEqual({ code: "NETWORK", message: "Network error" });
    expect(mixed).toEqual({ code: "NETWORK", message: "Network error" });
    expect(lowercase).toEqual({ code: "NETWORK", message: "Network error" });
  });

  it("returns default code and message when no patterns match", () => {
    const classifier = createErrorClassifier(
      [
        {
          patterns: ["timeout"],
          code: "TIMEOUT",
          message: "Request timed out",
        },
      ],
      "UNKNOWN",
      (msg) => `Failed: ${msg}`
    );

    const result = classifier(new Error("Something else happened"));
    expect(result).toEqual({
      code: "UNKNOWN",
      message: "Failed: Something else happened",
    });
  });

  it("handles empty patterns array", () => {
    const classifier = createErrorClassifier(
      [],
      "DEFAULT",
      (msg) => `Error: ${msg}`
    );

    const result = classifier(new Error("Any error"));
    expect(result).toEqual({
      code: "DEFAULT",
      message: "Error: Any error",
    });
  });

  it("returns first matching rule when multiple patterns could match", () => {
    const classifier = createErrorClassifier(
      [
        {
          patterns: ["network"],
          code: "NETWORK",
          message: "Network error",
        },
        {
          patterns: ["network timeout"],
          code: "TIMEOUT",
          message: "Timeout error",
        },
      ],
      "UNKNOWN",
      (msg) => `Unknown: ${msg}`
    );

    const result = classifier(new Error("Network timeout occurred"));
    expect(result).toEqual({
      code: "NETWORK",
      message: "Network error",
    });
  });

  it("matches any pattern in a rule's patterns array", () => {
    const classifier = createErrorClassifier(
      [
        {
          patterns: ["enoent", "not found", "does not exist"],
          code: "NOT_FOUND",
          message: "Resource not found",
        },
      ],
      "UNKNOWN",
      (msg) => `Unknown: ${msg}`
    );

    const enoent = classifier(new Error("ENOENT: no such file"));
    const notFound = classifier(new Error("File not found"));
    const doesNotExist = classifier(new Error("Path does not exist"));

    expect(enoent.code).toBe("NOT_FOUND");
    expect(notFound.code).toBe("NOT_FOUND");
    expect(doesNotExist.code).toBe("NOT_FOUND");
  });

  it("handles non-Error objects by extracting message", () => {
    const classifier = createErrorClassifier(
      [
        {
          patterns: ["invalid"],
          code: "INVALID",
          message: "Invalid input",
        },
      ],
      "UNKNOWN",
      (msg) => `Error: ${msg}`
    );

    const result = classifier("Invalid value provided");
    expect(result).toEqual({
      code: "INVALID",
      message: "Invalid input",
    });
  });

  it("preserves original error message in default handler", () => {
    const classifier = createErrorClassifier(
      [],
      "ERROR",
      (msg) => `Unexpected: ${msg}`
    );

    const result = classifier(new Error("Original message"));
    expect(result.message).toBe("Unexpected: Original message");
  });
});
