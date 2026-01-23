import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { createGeminiClient } from "./gemini.js";
import type { AIClientConfig, StreamCallbacks } from "../types.js";

// Create mock functions that will be accessible in tests
const mockGenerateContent = vi.fn();
const mockGenerateContentStream = vi.fn();

// Mock the Google AI SDK
vi.mock("@google/genai", async () => {
  const actual = await vi.importActual<typeof import("@google/genai")>("@google/genai");

  // Create a proper constructor mock
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
    it("returns API_KEY_MISSING error when apiKey is empty string", () => {
      const config: AIClientConfig = {
        apiKey: "",
      };

      const result = createGeminiClient(config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("API_KEY_MISSING");
        expect(result.error.message).toBe("Gemini API key is required");
      }
    });

    it("returns API_KEY_MISSING error when apiKey is missing", () => {
      const config = {} as AIClientConfig;

      const result = createGeminiClient(config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("API_KEY_MISSING");
      }
    });

    it("creates client successfully with valid API key", () => {
      const config: AIClientConfig = {
        apiKey: "valid-api-key",
      };

      const result = createGeminiClient(config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.provider).toBe("gemini");
      }
    });
  });

  describe("model configuration", () => {
    it("uses default model when not specified", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const schema = z.object({ result: z.string() });
      mockGenerateContent.mockResolvedValue({
        text: '{"result":"test"}',
      });

      const result = createGeminiClient(config);
      expect(result.ok).toBe(true);

      if (result.ok) {
        await result.value.generate("test prompt", schema);

        expect(mockGenerateContent).toHaveBeenCalledWith({
          model: "gemini-2.5-flash",
          contents: "test prompt",
          config: expect.objectContaining({
            responseMimeType: "application/json",
          }),
        });
      }
    });

    it("uses custom model when specified", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
        model: "gemini-pro",
      };

      const schema = z.object({ result: z.string() });
      mockGenerateContent.mockResolvedValue({
        text: '{"result":"test"}',
      });

      const result = createGeminiClient(config);
      expect(result.ok).toBe(true);

      if (result.ok) {
        await result.value.generate("test prompt", schema);

        expect(mockGenerateContent).toHaveBeenCalledWith({
          model: "gemini-pro",
          contents: "test prompt",
          config: expect.any(Object),
        });
      }
    });

    it("uses custom temperature when specified", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
        temperature: 0.5,
      };

      const schema = z.object({ result: z.string() });
      mockGenerateContent.mockResolvedValue({
        text: '{"result":"test"}',
      });

      const result = createGeminiClient(config);
      expect(result.ok).toBe(true);

      if (result.ok) {
        await result.value.generate("test prompt", schema);

        expect(mockGenerateContent).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({
              temperature: 0.5,
            }),
          })
        );
      }
    });

    it("uses custom maxTokens when specified", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
        maxTokens: 1024,
      };

      const schema = z.object({ result: z.string() });
      mockGenerateContent.mockResolvedValue({
        text: '{"result":"test"}',
      });

      const result = createGeminiClient(config);
      expect(result.ok).toBe(true);

      if (result.ok) {
        await result.value.generate("test prompt", schema);

        expect(mockGenerateContent).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({
              maxOutputTokens: 1024,
            }),
          })
        );
      }
    });
  });

  describe("generate method", () => {
    it("successfully generates and validates response", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      mockGenerateContent.mockResolvedValue({
        text: '{"name":"John","age":30}',
      });

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const result = await client.value.generate("test prompt", schema);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual({
            name: "John",
            age: 30,
          });
        }
      }
    });

    it("returns PARSE_ERROR when response is invalid JSON", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const schema = z.object({ result: z.string() });
      mockGenerateContent.mockResolvedValue({
        text: "not valid json",
      });

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const result = await client.value.generate("test prompt", schema);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("PARSE_ERROR");
          expect(result.error.message).toBe("Failed to parse JSON response");
        }
      }
    });

    it("returns PARSE_ERROR when response doesn't match schema", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      mockGenerateContent.mockResolvedValue({
        text: '{"name":"John","age":"not a number"}',
      });

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const result = await client.value.generate("test prompt", schema);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("PARSE_ERROR");
          expect(result.error.message).toBe("Invalid response structure");
        }
      }
    });

  });

  describe("generateStream method", () => {
    it("successfully streams response with chunks", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const chunks = ["Hello", " ", "World"];
      const mockStream = (async function* () {
        for (const text of chunks) {
          yield { text, candidates: [{ finishReason: undefined }] };
        }
        yield { text: "", candidates: [{ finishReason: "STOP" }] };
      })();

      mockGenerateContentStream.mockResolvedValue(mockStream);

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const receivedChunks: string[] = [];
        let fullContent = "";
        let metadata = {};

        const callbacks: StreamCallbacks = {
          onChunk: vi.fn(async (chunk: string) => {
            receivedChunks.push(chunk);
          }),
          onComplete: vi.fn(async (content: string, meta?: any) => {
            fullContent = content;
            metadata = meta || {};
          }),
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

    it("handles SAFETY finish reason properly", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const mockStream = (async function* () {
        yield { text: "Some content", candidates: [{ finishReason: undefined }] };
        yield { text: "", candidates: [{ finishReason: "SAFETY" }] };
      })();

      mockGenerateContentStream.mockResolvedValue(mockStream);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

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
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const error = new Error("Stream error occurred");
      mockGenerateContentStream.mockRejectedValue(error);

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

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

    it("calls onError for rate limit errors during streaming", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const error = new Error("429: Rate limit exceeded");
      mockGenerateContentStream.mockRejectedValue(error);

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const callbacks: StreamCallbacks = {
          onChunk: vi.fn(),
          onComplete: vi.fn(),
          onError: vi.fn(),
        };

        await client.value.generateStream("test prompt", callbacks);

        expect(callbacks.onError).toHaveBeenCalledWith(error);
      }
    });

    it("uses responseSchema option when provided", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const mockStream = (async function* () {
        yield { text: '{"result":"test"}', candidates: [{ finishReason: "STOP" }] };
      })();

      mockGenerateContentStream.mockResolvedValue(mockStream);

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const callbacks: StreamCallbacks = {
          onChunk: vi.fn(),
          onComplete: vi.fn(),
          onError: vi.fn(),
        };

        const responseSchema = {
          type: "OBJECT",
          properties: {
            result: { type: "STRING" },
          },
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
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const mockStream = (async function* () {
        yield { text: "", candidates: [{ finishReason: undefined }] };
        yield { text: "Hello", candidates: [{ finishReason: undefined }] };
        yield { text: "", candidates: [{ finishReason: "STOP" }] };
      })();

      mockGenerateContentStream.mockResolvedValue(mockStream);

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const callbacks: StreamCallbacks = {
          onChunk: vi.fn(),
          onComplete: vi.fn(),
          onError: vi.fn(),
        };

        await client.value.generateStream("test prompt", callbacks);

        // onChunk should only be called for non-empty chunks
        expect(callbacks.onChunk).toHaveBeenCalledTimes(1);
        expect(callbacks.onChunk).toHaveBeenCalledWith("Hello");
        expect(callbacks.onComplete).toHaveBeenCalledWith("Hello", {
          truncated: false,
          finishReason: "STOP",
        });
      }
    });

    it("accumulates chunks correctly in order", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const chunks = ["The", " quick", " brown", " fox"];
      const mockStream = (async function* () {
        for (const text of chunks) {
          yield { text, candidates: [{ finishReason: undefined }] };
        }
        yield { text: "", candidates: [{ finishReason: "STOP" }] };
      })();

      mockGenerateContentStream.mockResolvedValue(mockStream);

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const callbacks: StreamCallbacks = {
          onChunk: vi.fn(),
          onComplete: vi.fn(),
          onError: vi.fn(),
        };

        await client.value.generateStream("test prompt", callbacks);

        expect(callbacks.onComplete).toHaveBeenCalledWith("The quick brown fox", {
          truncated: false,
          finishReason: "STOP",
        });
      }
    });

    it("handles stream with no finish reason", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const mockStream = (async function* () {
        yield { text: "Content", candidates: [{}] };
      })();

      mockGenerateContentStream.mockResolvedValue(mockStream);

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const callbacks: StreamCallbacks = {
          onChunk: vi.fn(),
          onComplete: vi.fn(),
          onError: vi.fn(),
        };

        await client.value.generateStream("test prompt", callbacks);

        expect(callbacks.onComplete).toHaveBeenCalledWith("Content", {
          truncated: false,
          finishReason: undefined,
        });
      }
    });

    it("tracks finish reason from last chunk only", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const mockStream = (async function* () {
        yield { text: "Part 1", candidates: [{ finishReason: "OTHER" }] };
        yield { text: " Part 2", candidates: [{ finishReason: "MAX_TOKENS" }] };
        yield { text: " Part 3", candidates: [{ finishReason: "STOP" }] };
      })();

      mockGenerateContentStream.mockResolvedValue(mockStream);

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const callbacks: StreamCallbacks = {
          onChunk: vi.fn(),
          onComplete: vi.fn(),
          onError: vi.fn(),
        };

        await client.value.generateStream("test prompt", callbacks);

        // Should use the LAST finish reason (STOP), not MAX_TOKENS
        expect(callbacks.onComplete).toHaveBeenCalledWith("Part 1 Part 2 Part 3", {
          truncated: false,
          finishReason: "STOP",
        });
      }
    });

    it("handles OTHER finish reason as blocked", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const mockStream = (async function* () {
        yield { text: "Some text", candidates: [{ finishReason: "OTHER" }] };
      })();

      mockGenerateContentStream.mockResolvedValue(mockStream);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const callbacks: StreamCallbacks = {
          onChunk: vi.fn(),
          onComplete: vi.fn(),
          onError: vi.fn(),
        };

        await client.value.generateStream("test prompt", callbacks);

        expect(consoleSpy).toHaveBeenCalledWith("[Gemini] Response blocked with reason: OTHER");
      }

      consoleSpy.mockRestore();
    });

    it("handles BLOCKLIST finish reason", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const mockStream = (async function* () {
        yield { text: "Blocked", candidates: [{ finishReason: "BLOCKLIST" }] };
      })();

      mockGenerateContentStream.mockResolvedValue(mockStream);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const callbacks: StreamCallbacks = {
          onChunk: vi.fn(),
          onComplete: vi.fn(),
          onError: vi.fn(),
        };

        await client.value.generateStream("test prompt", callbacks);

        expect(consoleSpy).toHaveBeenCalledWith("[Gemini] Response blocked with reason: BLOCKLIST");
      }

      consoleSpy.mockRestore();
    });
  });

  // Consolidated error handling tests for both generate and generateStream
  describe.each([
    {
      method: "generate" as const,
      mockFn: mockGenerateContent,
      executor: (client: any, schema: any) => client.generate("test prompt", schema)
    }
  ])("$method error handling", ({ method, mockFn, executor }) => {
    it("returns API_KEY_INVALID error for 401 responses", async () => {
      const config: AIClientConfig = {
        apiKey: "invalid-key",
      };

      const schema = z.object({ result: z.string() });
      mockFn.mockRejectedValue(new Error("401: Unauthorized - Invalid API key"));

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const result = await executor(client.value, schema);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("API_KEY_INVALID");
          expect(result.error.message).toBe("Invalid API key");
        }
      }
    });

    it("detects API key errors from various message formats", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const schema = z.object({ result: z.string() });

      const errorMessages = [
        "Invalid API key provided",
        "API key not valid",
        "401 Unauthorized",
      ];

      for (const message of errorMessages) {
        mockFn.mockRejectedValue(new Error(message));

        const client = createGeminiClient(config);
        expect(client.ok).toBe(true);

        if (client.ok) {
          const result = await executor(client.value, schema);

          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.code).toBe("API_KEY_INVALID");
          }
        }
      }
    });

    it("returns RATE_LIMITED error for 429 responses", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const schema = z.object({ result: z.string() });
      mockFn.mockRejectedValue(new Error("429: Too Many Requests - Rate limit exceeded"));

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const result = await executor(client.value, schema);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("RATE_LIMITED");
          expect(result.error.message).toBe("Rate limited");
        }
      }
    });

    it("detects rate limit errors from various message formats", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const schema = z.object({ result: z.string() });

      const errorMessages = [
        "429 Too Many Requests",
        "rate limit exceeded",
        "You have exceeded the rate limit",
      ];

      for (const message of errorMessages) {
        mockFn.mockRejectedValue(new Error(message));

        const client = createGeminiClient(config);
        expect(client.ok).toBe(true);

        if (client.ok) {
          const result = await executor(client.value, schema);

          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.code).toBe("RATE_LIMITED");
          }
        }
      }
    });

    it("returns MODEL_ERROR for other API errors", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const schema = z.object({ result: z.string() });
      mockFn.mockRejectedValue(new Error("500: Internal Server Error"));

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const result = await executor(client.value, schema);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("MODEL_ERROR");
          expect(result.error.message).toBe("500: Internal Server Error");
        }
      }
    });

    it("handles 400 Bad Request errors", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const schema = z.object({ result: z.string() });
      mockFn.mockRejectedValue(new Error("400: Bad Request - Invalid input"));

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const result = await executor(client.value, schema);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("MODEL_ERROR");
        }
      }
    });

    it("handles 403 Forbidden errors", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const schema = z.object({ result: z.string() });
      mockFn.mockRejectedValue(new Error("403: Forbidden - Access denied"));

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const result = await executor(client.value, schema);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("MODEL_ERROR");
        }
      }
    });
  });

  describe("JSON parsing edge cases", () => {
    it("handles response with null text", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const schema = z.object({ result: z.string() });
      mockGenerateContent.mockResolvedValue({
        text: null,
      });

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const result = await client.value.generate("test", schema);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("PARSE_ERROR");
        }
      }
    });

    it("handles response with undefined text", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const schema = z.object({ result: z.string() });
      mockGenerateContent.mockResolvedValue({});

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const result = await client.value.generate("test", schema);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("PARSE_ERROR");
        }
      }
    });

    it("truncates error details for long invalid JSON", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

      const schema = z.object({ result: z.string() });
      const longInvalidJson = "not json ".repeat(100);
      mockGenerateContent.mockResolvedValue({
        text: longInvalidJson,
      });

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const result = await client.value.generate("test", schema);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("PARSE_ERROR");
          // Details should be truncated to 200 characters
          expect(result.error.details?.length).toBeLessThanOrEqual(200);
        }
      }
    });
  });

  describe("complex schema validation", () => {
    it("validates complex nested objects", async () => {
      const config: AIClientConfig = {
        apiKey: "test-key",
      };

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

      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(responseData),
      });

      const client = createGeminiClient(config);
      expect(client.ok).toBe(true);

      if (client.ok) {
        const result = await client.value.generate("test", schema);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual(responseData);
        }
      }
    });
  });
});
