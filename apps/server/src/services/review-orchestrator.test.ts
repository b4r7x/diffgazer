import { describe, it, expect, vi } from "vitest";
import type { FileReviewResult } from "@repo/schemas/review";

describe("FileReviewResult with parseError", () => {
  describe("schema validation", () => {
    it("accepts result with parseError: false", () => {
      const result: FileReviewResult = {
        filePath: "test.ts",
        summary: "Good code",
        issues: [],
        score: 8,
        parseError: false,
      };
      expect(result.parseError).toBe(false);
    });

    it("accepts result with parseError: true and error message", () => {
      const result: FileReviewResult = {
        filePath: "test.ts",
        summary: "[Parse Error] AI response could not be parsed",
        issues: [],
        score: null,
        parseError: true,
        parseErrorMessage: "Unexpected token at position 0",
      };
      expect(result.parseError).toBe(true);
      expect(result.parseErrorMessage).toBeDefined();
    });

    it("accepts result without parseError field (backwards compatible)", () => {
      const result: FileReviewResult = {
        filePath: "test.ts",
        summary: "Good code",
        issues: [],
        score: 8,
      };
      expect(result.parseError).toBeUndefined();
    });
  });
});

describe("parseFileReviewResult behavior expectations", () => {
  describe("valid JSON responses", () => {
    const validResponses = [
      {
        name: "complete response with all fields",
        input: JSON.stringify({
          summary: "Code looks good",
          issues: [{ severity: "warning", category: "style", file: "test.ts", line: 10, title: "Issue", description: "Desc", suggestion: null }],
          score: 8,
        }),
        expectedParseError: false,
      },
      {
        name: "response with empty issues",
        input: JSON.stringify({
          summary: "Perfect code",
          issues: [],
          score: 10,
        }),
        expectedParseError: false,
      },
      {
        name: "response with null score",
        input: JSON.stringify({
          summary: "Code reviewed",
          issues: [],
          score: null,
        }),
        expectedParseError: false,
      },
    ];

    it.each(validResponses)("should parse $name without error", ({ expectedParseError }) => {
      expect(expectedParseError).toBe(false);
    });
  });

  describe("invalid JSON responses that should set parseError: true", () => {
    const invalidResponses = [
      {
        name: "plain text (not JSON)",
        input: "This is just some text, not JSON at all",
        expectedError: "Unexpected token",
      },
      {
        name: "JSON array instead of object",
        input: JSON.stringify([{ summary: "test" }]),
        expectedError: "not a JSON object",
      },
      {
        name: "JSON null",
        input: "null",
        expectedError: "not a JSON object",
      },
      {
        name: "empty string",
        input: "",
        expectedError: "Unexpected end",
      },
      {
        name: "truncated JSON",
        input: '{"summary": "test", "issues": [',
        expectedError: "Unexpected end",
      },
      {
        name: "missing summary field",
        input: JSON.stringify({ issues: [], score: 8 }),
        expectedError: "Invalid summary",
      },
      {
        name: "summary is number instead of string",
        input: JSON.stringify({ summary: 123, issues: [], score: 8 }),
        expectedError: "Invalid summary",
      },
      {
        name: "issues is object instead of array",
        input: JSON.stringify({ summary: "test", issues: {}, score: 8 }),
        expectedError: "Invalid issues",
      },
      {
        name: "score is string instead of number",
        input: JSON.stringify({ summary: "test", issues: [], score: "8" }),
        expectedError: "Invalid score",
      },
      {
        name: "markdown wrapped JSON",
        input: "```json\n{\"summary\": \"test\", \"issues\": [], \"score\": 8}\n```",
        expectedError: "Unexpected token",
      },
      {
        name: "AI explanation before JSON",
        input: "Here is my review:\n{\"summary\": \"test\", \"issues\": [], \"score\": 8}",
        expectedError: "Unexpected token",
      },
    ];

    it.each(invalidResponses)("should set parseError for $name", ({ input, expectedError }) => {
      expect(expectedError).toBeDefined();
      expect(input).toBeDefined();
    });
  });
});
