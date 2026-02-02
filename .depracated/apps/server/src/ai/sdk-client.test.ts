import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { createAIClient } from "./sdk-client.js";
import type { AIClientConfig, StreamCallbacks } from "./types.js";

vi.mock("ai", async () => {
  const mockGenerateObject = vi.fn();
  const mockStreamText = vi.fn();

  return {
    generateObject: mockGenerateObject,
    streamText: mockStreamText,
  };
});

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => ({ modelId: "gemini-2.5-flash" }))),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => vi.fn(() => ({ modelId: "gpt-4o" }))),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => vi.fn(() => ({ modelId: "claude-sonnet-4-20250514" }))),
}));

vi.mock("zhipu-ai-provider", () => ({
  createZhipu: vi.fn(() => vi.fn(() => ({ modelId: "glm-4.7" }))),
}));

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn(() => vi.fn(() => ({ modelId: "openai/gpt-4o" }))),
}));

const { generateObject, streamText } = await import("ai");
const mockGenerateObject = generateObject as ReturnType<typeof vi.fn>;
const mockStreamText = streamText as ReturnType<typeof vi.fn>;

describe("createAIClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("API key validation", () => {
    it("returns API_KEY_MISSING error when apiKey is missing or empty", () => {
      const result1 = createAIClient({ apiKey: "", provider: "gemini" });
      const result2 = createAIClient({ provider: "gemini" } as AIClientConfig);

      expect(result1.ok).toBe(false);
      expect(result2.ok).toBe(false);
      if (!result1.ok) {
        expect(result1.error.code).toBe("API_KEY_MISSING");
        expect(result1.error.message).toBe("gemini API key is required");
      }
    });

    it("creates client successfully with valid API key for gemini", () => {
      const result = createAIClient({ apiKey: "valid-api-key", provider: "gemini" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.provider).toBe("gemini");
      }
    });

    it("creates client successfully with valid API key for openai", () => {
      const result = createAIClient({ apiKey: "valid-api-key", provider: "openai" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.provider).toBe("openai");
      }
    });

    it("creates client successfully with valid API key for anthropic", () => {
      const result = createAIClient({ apiKey: "valid-api-key", provider: "anthropic" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.provider).toBe("anthropic");
      }
    });

    it("creates client successfully with valid API key for glm", () => {
      const result = createAIClient({ apiKey: "valid-api-key", provider: "glm" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.provider).toBe("glm");
      }
    });

    it("creates client successfully with valid API key for openrouter", () => {
      const result = createAIClient({ apiKey: "valid-api-key", provider: "openrouter", model: "openai/gpt-4o" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.provider).toBe("openrouter");
      }
    });
  });

  describe("GLM provider configuration", () => {
    it("creates client with coding endpoint by default", () => {
      const result = createAIClient({ apiKey: "test-key", provider: "glm" });
      expect(result.ok).toBe(true);
    });

    it("creates client with coding endpoint when specified", () => {
      const result = createAIClient({ apiKey: "test-key", provider: "glm", glmEndpoint: "coding" });
      expect(result.ok).toBe(true);
    });

    it("creates client with standard endpoint when specified", () => {
      const result = createAIClient({ apiKey: "test-key", provider: "glm", glmEndpoint: "standard" });
      expect(result.ok).toBe(true);
    });

    it("uses default glm model when model not specified", () => {
      const result = createAIClient({ apiKey: "test-key", provider: "glm" });
      expect(result.ok).toBe(true);
    });

    it("uses specified glm model when provided", () => {
      const result = createAIClient({ apiKey: "test-key", provider: "glm", model: "glm-4.6" });
      expect(result.ok).toBe(true);
    });
  });

  describe("OpenRouter provider configuration", () => {
    it("creates client with specified model", () => {
      const result = createAIClient({
        apiKey: "test-key",
        provider: "openrouter",
        model: "anthropic/claude-3-opus"
      });
      expect(result.ok).toBe(true);
    });

    it("uses empty string default when model not specified", () => {
      const result = createAIClient({ apiKey: "test-key", provider: "openrouter" });
      expect(result.ok).toBe(true);
    });
  });

  describe("generate method", () => {
    it("successfully generates and validates response", async () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      mockGenerateObject.mockResolvedValue({ object: { name: "John", age: 30 } });

      const client = createAIClient({ apiKey: "test-key", provider: "gemini" });
      expect(client.ok).toBe(true);

      if (client.ok) {
        const result = await client.value.generate("test prompt", schema);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual({ name: "John", age: 30 });
        }
      }
    });

    it("returns error when generateObject fails", async () => {
      const schema = z.object({ result: z.string() });
      mockGenerateObject.mockRejectedValue(new Error("API error"));

      const client = createAIClient({ apiKey: "test-key", provider: "gemini" });

      if (client.ok) {
        const result = await client.value.generate("test", schema);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("MODEL_ERROR");
        }
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

      mockGenerateObject.mockResolvedValue({ object: responseData });
      const client = createAIClient({ apiKey: "test-key", provider: "openai" });

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
      const mockTextStream = (async function* () {
        for (const text of chunks) {
          yield text;
        }
      })();

      mockStreamText.mockReturnValue({
        textStream: mockTextStream,
        finishReason: "stop",
        then: (resolve: (value: unknown) => void) => resolve({ finishReason: "stop" }),
      });

      const client = createAIClient({ apiKey: "test-key", provider: "anthropic" });

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
          finishReason: "stop",
        });
        expect(callbacks.onError).not.toHaveBeenCalled();
      }
    });

    it("handles truncated response (length finish reason)", async () => {
      const mockTextStream = (async function* () {
        yield "Some content";
      })();

      mockStreamText.mockReturnValue({
        textStream: mockTextStream,
        finishReason: "length",
        then: (resolve: (value: unknown) => void) => resolve({ finishReason: "length" }),
      });

      const client = createAIClient({ apiKey: "test-key", provider: "gemini" });

      if (client.ok) {
        const callbacks: StreamCallbacks = {
          onChunk: vi.fn(),
          onComplete: vi.fn(),
          onError: vi.fn(),
        };

        await client.value.generateStream("test prompt", callbacks);

        expect(callbacks.onComplete).toHaveBeenCalledWith("Some content", {
          truncated: true,
          finishReason: "length",
        });
      }
    });

    it("calls onError callback when stream throws error", async () => {
      const error = new Error("Stream error occurred");
      mockStreamText.mockImplementation(() => {
        throw error;
      });

      const client = createAIClient({ apiKey: "test-key", provider: "gemini" });

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
  });

  describe("error handling", () => {
    it("detects API key errors from various message formats", async () => {
      const schema = z.object({ result: z.string() });
      const errorMessages = ["Invalid API key provided", "api key not valid", "401 Unauthorized"];

      for (const message of errorMessages) {
        mockGenerateObject.mockRejectedValue(new Error(message));
        const client = createAIClient({ apiKey: "test-key", provider: "gemini" });

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
        mockGenerateObject.mockRejectedValue(new Error(message));
        const client = createAIClient({ apiKey: "test-key", provider: "openai" });

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
        mockGenerateObject.mockRejectedValue(new Error(message));
        const client = createAIClient({ apiKey: "test-key", provider: "anthropic" });

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
