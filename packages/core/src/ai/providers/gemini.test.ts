import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { createGeminiClient } from "./gemini.js";
import type { AIClientConfig, StreamCallbacks } from "../types.js";

const mockGenerateContent = vi.fn();
const mockGenerateContentStream = vi.fn();

vi.mock("@google/genai", async () => {
  const actual = await vi.importActual<typeof import("@google/genai")>("@google/genai");

  class MockGoogleGenAI {
    models = {
      generateContent: mockGenerateContent,
      generateContentStream: mockGenerateContentStream,
    };
  }

  return {
    ...actual,
    GoogleGenAI: MockGoogleGenAI,
  };
});

describe("createGeminiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("API key validation", () => {
    it("returns API_KEY_MISSING error when apiKey is missing or empty", () => {
      const result1 = createGeminiClient({ apiKey: "" });
      const result2 = createGeminiClient({} as AIClientConfig);

      expect(result1.ok).toBe(false);
      expect(result2.ok).toBe(false);
      if (!result1.ok) {
        expect(result1.error.code).toBe("API_KEY_MISSING");
        expect(result1.error.message).toBe("Gemini API key is required");
      }
    });

    it("creates client successfully with valid API key", () => {
      const result = createGeminiClient({ apiKey: "valid-api-key" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.provider).toBe("gemini");
      }
    });
  });

  describe("model configuration", () => {
    it("uses default model and applies custom config", async () => {
      const schema = z.object({ result: z.string() });
      mockGenerateContent.mockResolvedValue({ text: '{"result":"test"}' });

      const result1 = createGeminiClient({ apiKey: "test-key" });
      const result2 = createGeminiClient({ apiKey: "test-key", model: "gemini-pro", temperature: 0.5, maxTokens: 1024 });

      if (result1.ok) {
        await result1.value.generate("test prompt", schema);
        expect(mockGenerateContent).toHaveBeenCalledWith({
          model: "gemini-2.5-flash",
          contents: "test prompt",
          config: expect.objectContaining({
            responseMimeType: "application/json",
          }),
        });
      }

      if (result2.ok) {
        await result2.value.generate("test prompt", schema);
        expect(mockGenerateContent).toHaveBeenCalledWith({
          model: "gemini-pro",
          contents: "test prompt",
          config: expect.objectContaining({
            temperature: 0.5,
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
          }),
        });
      }
    });
  });

  describe("generate method", () => {
    it("successfully generates and validates response", async () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      mockGenerateContent.mockResolvedValue({ text: '{"name":"John","age":30}' });

      const client = createGeminiClient({ apiKey: "test-key" });
      expect(client.ok).toBe(true);

      if (client.ok) {
        const result = await client.value.generate("test prompt", schema);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual({ name: "John", age: 30 });
        }
      }
    });

    it("returns PARSE_ERROR for invalid JSON or schema mismatch", async () => {
      const schema = z.object({ name: z.string(), age: z.number() });

      mockGenerateContent.mockResolvedValue({ text: "not valid json" });
      const client1 = createGeminiClient({ apiKey: "test-key" });
      if (client1.ok) {
        const result1 = await client1.value.generate("test", schema);
        expect(result1.ok).toBe(false);
        if (!result1.ok) {
          expect(result1.error.code).toBe("PARSE_ERROR");
          expect(result1.error.message).toContain("Failed to parse JSON response");
        }
      }

      mockGenerateContent.mockResolvedValue({ text: '{"name":"John","age":"not a number"}' });
      const client2 = createGeminiClient({ apiKey: "test-key" });
      if (client2.ok) {
        const result2 = await client2.value.generate("test", schema);
        expect(result2.ok).toBe(false);
        if (!result2.ok) {
          expect(result2.error.code).toBe("PARSE_ERROR");
          expect(result2.error.message).toBe("Invalid response structure");
        }
      }
    });

    it("handles null or undefined text", async () => {
      const schema = z.object({ result: z.string() });

      mockGenerateContent.mockResolvedValue({ text: null });
      const client1 = createGeminiClient({ apiKey: "test-key" });
      if (client1.ok) {
        const result1 = await client1.value.generate("test", schema);
        expect(result1.ok).toBe(false);
        if (!result1.ok) expect(result1.error.code).toBe("PARSE_ERROR");
      }

      mockGenerateContent.mockResolvedValue({});
      const client2 = createGeminiClient({ apiKey: "test-key" });
      if (client2.ok) {
        const result2 = await client2.value.generate("test", schema);
        expect(result2.ok).toBe(false);
        if (!result2.ok) expect(result2.error.code).toBe("PARSE_ERROR");
      }
    });

    it("validates complex nested objects", async () => {
      const schema = z.object({
        summary: z.string(),
        issues: z.array(
          z.object({
            severity: z.enum(["critical", "warning", "suggestion"]),
            file: z.string().nullable(),
            line: z.number().nullable(),
          })
        ),
      });

      const responseData = {
        summary: "Test summary",
        issues: [
          { severity: "critical", file: "test.ts", line: 10 },
          { severity: "warning", file: null, line: null },
        ],
      };

      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(responseData) });
      const client = createGeminiClient({ apiKey: "test-key" });

      if (client.ok) {
        const result = await client.value.generate("test", schema);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toEqual(responseData);
      }
    });
  });

  describe("generateStream method", () => {
    it("successfully streams response with chunks", async () => {
      const chunks = ["Hello", " ", "World"];
      const mockStream = (async function* () {
        for (const text of chunks) {
          yield { text, candidates: [{ finishReason: undefined }] };
        }
        yield { text: "", candidates: [{ finishReason: "STOP" }] };
      })();

      mockGenerateContentStream.mockResolvedValue(mockStream);
      const client = createGeminiClient({ apiKey: "test-key" });

      if (client.ok) {
        const receivedChunks: string[] = [];
        const callbacks: StreamCallbacks = {
          onChunk: vi.fn(async (chunk: string) => {
            receivedChunks.push(chunk);
          }),
          onComplete: vi.fn(),
          onError: vi.fn(),
        };

        await client.value.generateStream("test prompt", callbacks);

        expect(callbacks.onChunk).toHaveBeenCalledTimes(3);
        expect(receivedChunks).toEqual(chunks);
        expect(callbacks.onComplete).toHaveBeenCalledWith("Hello World", {
          truncated: false,
          finishReason: "STOP",
        });
        expect(callbacks.onError).not.toHaveBeenCalled();
      }
    });

    it("handles blocked finish reasons", async () => {
      const mockStream = (async function* () {
        yield { text: "Some content", candidates: [{ finishReason: "SAFETY" }] };
      })();

      mockGenerateContentStream.mockResolvedValue(mockStream);
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const client = createGeminiClient({ apiKey: "test-key" });

      if (client.ok) {
        const callbacks: StreamCallbacks = {
          onChunk: vi.fn(),
          onComplete: vi.fn(),
          onError: vi.fn(),
        };

        await client.value.generateStream("test prompt", callbacks);

        expect(consoleSpy).toHaveBeenCalledWith("[Gemini] Response blocked with reason: SAFETY");
        expect(callbacks.onComplete).toHaveBeenCalledWith("Some content", {
          truncated: false,
          finishReason: "SAFETY",
        });
      }

      consoleSpy.mockRestore();
    });

    it("calls onError callback when stream throws error", async () => {
      const error = new Error("Stream error occurred");
      mockGenerateContentStream.mockRejectedValue(error);
      const client = createGeminiClient({ apiKey: "test-key" });

      if (client.ok) {
        const callbacks: StreamCallbacks = {
          onChunk: vi.fn(),
          onComplete: vi.fn(),
          onError: vi.fn(),
        };

        await client.value.generateStream("test prompt", callbacks);

        expect(callbacks.onError).toHaveBeenCalledWith(error);
        expect(callbacks.onComplete).not.toHaveBeenCalled();
      }
    });

    it("uses responseSchema option when provided", async () => {
      const mockStream = (async function* () {
        yield { text: '{"result":"test"}', candidates: [{ finishReason: "STOP" }] };
      })();

      mockGenerateContentStream.mockResolvedValue(mockStream);
      const client = createGeminiClient({ apiKey: "test-key" });

      if (client.ok) {
        const callbacks: StreamCallbacks = {
          onChunk: vi.fn(),
          onComplete: vi.fn(),
          onError: vi.fn(),
        };

        const responseSchema = {
          type: "OBJECT",
          properties: { result: { type: "STRING" } },
          required: ["result"],
        };

        await client.value.generateStream("test prompt", callbacks, { responseSchema });

        expect(mockGenerateContentStream).toHaveBeenCalledWith({
          model: "gemini-2.5-flash",
          contents: "test prompt",
          config: expect.objectContaining({
            responseMimeType: "application/json",
            responseSchema,
          }),
        });
      }
    });

    it("handles empty chunks correctly", async () => {
      const mockStream = (async function* () {
        yield { text: "", candidates: [{ finishReason: undefined }] };
        yield { text: "Hello", candidates: [{ finishReason: undefined }] };
        yield { text: "", candidates: [{ finishReason: "STOP" }] };
      })();

      mockGenerateContentStream.mockResolvedValue(mockStream);
      const client = createGeminiClient({ apiKey: "test-key" });

      if (client.ok) {
        const callbacks: StreamCallbacks = {
          onChunk: vi.fn(),
          onComplete: vi.fn(),
          onError: vi.fn(),
        };

        await client.value.generateStream("test prompt", callbacks);

        expect(callbacks.onChunk).toHaveBeenCalledTimes(1);
        expect(callbacks.onChunk).toHaveBeenCalledWith("Hello");
        expect(callbacks.onComplete).toHaveBeenCalledWith("Hello", {
          truncated: false,
          finishReason: "STOP",
        });
      }
    });

    it("tracks finish reason from last chunk", async () => {
      const mockStream = (async function* () {
        yield { text: "Part 1", candidates: [{ finishReason: "OTHER" }] };
        yield { text: " Part 2", candidates: [{ finishReason: "MAX_TOKENS" }] };
        yield { text: " Part 3", candidates: [{ finishReason: "STOP" }] };
      })();

      mockGenerateContentStream.mockResolvedValue(mockStream);
      const client = createGeminiClient({ apiKey: "test-key" });

      if (client.ok) {
        const callbacks: StreamCallbacks = {
          onChunk: vi.fn(),
          onComplete: vi.fn(),
          onError: vi.fn(),
        };

        await client.value.generateStream("test prompt", callbacks);

        expect(callbacks.onComplete).toHaveBeenCalledWith("Part 1 Part 2 Part 3", {
          truncated: false,
          finishReason: "STOP",
        });
      }
    });
  });

  describe("error handling", () => {
    it("detects API key errors from various message formats", async () => {
      const schema = z.object({ result: z.string() });
      const errorMessages = ["Invalid API key provided", "API key not valid", "401 Unauthorized"];

      for (const message of errorMessages) {
        mockGenerateContent.mockRejectedValue(new Error(message));
        const client = createGeminiClient({ apiKey: "test-key" });

        if (client.ok) {
          const result = await client.value.generate("test prompt", schema);
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.code).toBe("API_KEY_INVALID");
          }
        }
      }
    });

    it("detects rate limit errors from various message formats", async () => {
      const schema = z.object({ result: z.string() });
      const errorMessages = ["429 Too Many Requests", "rate limit exceeded"];

      for (const message of errorMessages) {
        mockGenerateContent.mockRejectedValue(new Error(message));
        const client = createGeminiClient({ apiKey: "test-key" });

        if (client.ok) {
          const result = await client.value.generate("test prompt", schema);
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.code).toBe("RATE_LIMITED");
            expect(result.error.message).toBe("Rate limited");
          }
        }
      }
    });

    it("returns MODEL_ERROR for other API errors", async () => {
      const schema = z.object({ result: z.string() });
      const errorMessages = ["500: Internal Server Error", "400: Bad Request", "403: Forbidden"];

      for (const message of errorMessages) {
        mockGenerateContent.mockRejectedValue(new Error(message));
        const client = createGeminiClient({ apiKey: "test-key" });

        if (client.ok) {
          const result = await client.value.generate("test prompt", schema);
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.code).toBe("MODEL_ERROR");
          }
        }
      }
    });
  });
});
