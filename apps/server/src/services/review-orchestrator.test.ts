import { describe, it, expect } from "vitest";
import type { FileReviewResult } from "@repo/schemas/review";
import { parseFileReviewResult } from "./review-orchestrator.js";

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
      expect(result.parseErrorMessage).toBe("Unexpected token at position 0");
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
      },
      {
        name: "response with empty issues",
        input: JSON.stringify({
          summary: "Perfect code",
          issues: [],
          score: 10,
        }),
      },
      {
        name: "response with null score",
        input: JSON.stringify({
          summary: "Code reviewed",
          issues: [],
          score: null,
        }),
      },
    ];

    it.each(validResponses)("should parse $name without error", ({ input }) => {
      const result = parseFileReviewResult("test.ts", input);

      expect(result.parseError).toBe(false);
      expect(result.parseErrorMessage).toBeUndefined();
      expect(result.summary).toEqual(expect.any(String));
      expect(result.issues).toBeInstanceOf(Array);
    });
  });

  describe("invalid JSON responses that should set parseError: true", () => {
    const invalidResponses = [
      {
        name: "plain text (not JSON)",
        input: "This is just some text, not JSON at all",
      },
      {
        name: "JSON array instead of object",
        input: JSON.stringify([{ summary: "test" }]),
      },
      {
        name: "JSON null",
        input: "null",
      },
      {
        name: "empty string",
        input: "",
      },
      {
        name: "truncated JSON",
        input: '{"summary": "test", "issues": [',
      },
      {
        name: "missing summary field",
        input: JSON.stringify({ issues: [], score: 8 }),
      },
      {
        name: "summary is number instead of string",
        input: JSON.stringify({ summary: 123, issues: [], score: 8 }),
      },
      {
        name: "issues is object instead of array",
        input: JSON.stringify({ summary: "test", issues: {}, score: 8 }),
      },
      {
        name: "score is string instead of number",
        input: JSON.stringify({ summary: "test", issues: [], score: "8" }),
      },
      {
        name: "markdown wrapped JSON",
        input: "```json\n{\"summary\": \"test\", \"issues\": [], \"score\": 8}\n```",
      },
      {
        name: "AI explanation before JSON",
        input: "Here is my review:\n{\"summary\": \"test\", \"issues\": [], \"score\": 8}",
      },
    ];

    it.each(invalidResponses)("should set parseError for $name", ({ input }) => {
      const result = parseFileReviewResult("test.ts", input);

      expect(result.parseError).toBe(true);
      expect(result.parseErrorMessage).toMatch(/error|parse|invalid|unexpected|end/i);
      expect(result.summary).toContain("[Parse Error]");
      expect(result.issues).toEqual([]);
      expect(result.score).toBeNull();
    });
  });
});
