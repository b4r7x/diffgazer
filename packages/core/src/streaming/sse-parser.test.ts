import { describe, it, expect, vi } from "vitest";
import { parseSSEStream, type SSEParserOptions } from "./sse-parser.js";

function createMockReader(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return {
    read: vi.fn(async () => {
      if (index >= chunks.length) {
        return { done: true as const, value: undefined };
      }
      const value = encoder.encode(chunks[index++]);
      return { done: false as const, value };
    }),
    cancel: vi.fn(),
    releaseLock: vi.fn(),
    closed: Promise.resolve(undefined),
  };
}

const identity = (data: unknown) => data;

describe("parseSSEStream", () => {
  describe("basic SSE parsing", () => {
    it("should parse single SSE event", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader(['data: {"type":"message","content":"hello"}\n']);

      const result = await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(result.completed).toBe(true);
      expect(onEvent).toHaveBeenCalledOnce();
      expect(onEvent).toHaveBeenCalledWith({ type: "message", content: "hello" });
    });

    it("should parse multiple SSE events", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: {"id":1}\n',
        'data: {"id":2}\n',
        'data: {"id":3}\n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledTimes(3);
      expect(onEvent).toHaveBeenNthCalledWith(1, { id: 1 });
      expect(onEvent).toHaveBeenNthCalledWith(2, { id: 2 });
      expect(onEvent).toHaveBeenNthCalledWith(3, { id: 3 });
    });

    it("should parse events in single chunk with multiple lines", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: {"id":1}\ndata: {"id":2}\ndata: {"id":3}\n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledTimes(3);
      expect(onEvent).toHaveBeenNthCalledWith(1, { id: 1 });
      expect(onEvent).toHaveBeenNthCalledWith(2, { id: 2 });
      expect(onEvent).toHaveBeenNthCalledWith(3, { id: 3 });
    });

    it("should handle events split across chunks", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: {"mes',
        'sage":"split',
        ' across chunks"}\n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledOnce();
      expect(onEvent).toHaveBeenCalledWith({ message: "split across chunks" });
    });

    it("should handle partial line at end of chunk", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: {"id":1}\ndata: {"id"',
        ':2}\n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledTimes(2);
      expect(onEvent).toHaveBeenNthCalledWith(1, { id: 1 });
      expect(onEvent).toHaveBeenNthCalledWith(2, { id: 2 });
    });

    it("should handle event in final buffer without newline", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: {"id":1}\n',
        'data: {"id":2}',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledTimes(2);
      expect(onEvent).toHaveBeenNthCalledWith(1, { id: 1 });
      expect(onEvent).toHaveBeenNthCalledWith(2, { id: 2 });
    });
  });

  describe("malformed input handling", () => {
    it("should ignore lines without data prefix", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        ': comment line\n',
        'event: message\n',
        'data: {"valid":true}\n',
        'id: 123\n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledOnce();
      expect(onEvent).toHaveBeenCalledWith({ valid: true });
    });

    it("should ignore data lines with invalid JSON", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: {invalid json\n',
        'data: {"valid":true}\n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledOnce();
      expect(onEvent).toHaveBeenCalledWith({ valid: true });
    });

    it("should ignore empty data lines", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: \n',
        'data: {"valid":true}\n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledOnce();
      expect(onEvent).toHaveBeenCalledWith({ valid: true });
    });

    it("should handle whitespace-only final buffer", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: {"id":1}\n',
        '   \n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledOnce();
    });

    it("should handle truncated JSON in final buffer", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: {"incomplete":',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).not.toHaveBeenCalled();
    });

    it("should handle empty stream", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([]);

      const result = await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(result.completed).toBe(true);
      expect(onEvent).not.toHaveBeenCalled();
    });
  });

  describe("buffer overflow handling", () => {
    it("should trigger overflow when buffer exceeds 1MB", async () => {
      const onEvent = vi.fn();
      const onBufferOverflow = vi.fn();
      const largeChunk = "x".repeat(1024 * 1024 + 1);
      const reader = createMockReader([largeChunk]);

      const result = await parseSSEStream(reader, {
        onEvent,
        parseEvent: identity,
        onBufferOverflow,
      });

      expect(result.completed).toBe(false);
      expect(onBufferOverflow).toHaveBeenCalledOnce();
      expect(reader.cancel).toHaveBeenCalledOnce();
    });

    it("should handle overflow callback being undefined", async () => {
      const onEvent = vi.fn();
      const largeChunk = "x".repeat(1024 * 1024 + 1);
      const reader = createMockReader([largeChunk]);

      const result = await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(result.completed).toBe(false);
      expect(reader.cancel).toHaveBeenCalledOnce();
    });

    it("should not overflow with buffer just under 1MB", async () => {
      const onEvent = vi.fn();
      const onBufferOverflow = vi.fn();
      const largeChunk = "x".repeat(1024 * 1024 - 100);
      const reader = createMockReader([largeChunk]);

      const result = await parseSSEStream(reader, {
        onEvent,
        parseEvent: identity,
        onBufferOverflow,
      });

      expect(result.completed).toBe(true);
      expect(onBufferOverflow).not.toHaveBeenCalled();
      expect(reader.cancel).not.toHaveBeenCalled();
    });

    it("should accumulate chunks until overflow", async () => {
      const onEvent = vi.fn();
      const onBufferOverflow = vi.fn();
      const chunkSize = 500 * 1024;
      const reader = createMockReader([
        "a".repeat(chunkSize),
        "b".repeat(chunkSize),
        "c".repeat(chunkSize),
      ]);

      const result = await parseSSEStream(reader, {
        onEvent,
        parseEvent: identity,
        onBufferOverflow,
      });

      expect(result.completed).toBe(false);
      expect(onBufferOverflow).toHaveBeenCalledOnce();
    });
  });

  describe("custom parseEvent handler", () => {
    it("should use custom parseEvent to transform events", async () => {
      const onEvent = vi.fn();
      const parseEvent = (data: unknown): string | undefined => {
        if (typeof data === "object" && data !== null && "message" in data) {
          return String((data as { message: string }).message).toUpperCase();
        }
        return undefined;
      };

      const reader = createMockReader(['data: {"message":"hello"}\n']);

      await parseSSEStream(reader, { onEvent, parseEvent });

      expect(onEvent).toHaveBeenCalledWith("HELLO");
    });

    it("should skip events when parseEvent returns undefined", async () => {
      const onEvent = vi.fn();
      const parseEvent = (data: unknown): { valid: boolean } | undefined => {
        if (
          typeof data === "object" &&
          data !== null &&
          "valid" in data &&
          (data as { valid: boolean }).valid
        ) {
          return data as { valid: boolean };
        }
        return undefined;
      };

      const reader = createMockReader([
        'data: {"valid":true}\n',
        'data: {"valid":false}\n',
        'data: {"valid":true}\n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent });

      expect(onEvent).toHaveBeenCalledTimes(2);
      expect(onEvent).toHaveBeenNthCalledWith(1, { valid: true });
      expect(onEvent).toHaveBeenNthCalledWith(2, { valid: true });
    });

    it("should handle parseEvent throwing errors", async () => {
      const onEvent = vi.fn();
      const parseEvent = (): never => {
        throw new Error("Parse error");
      };

      const reader = createMockReader(['data: {"message":"test"}\n']);

      await expect(parseSSEStream(reader, { onEvent, parseEvent })).rejects.toThrow(
        "Parse error"
      );
    });

    it("should pass raw data with identity parseEvent", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: {"message":"raw","count":42}\n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledWith({ message: "raw", count: 42 });
    });
  });

  describe("edge cases", () => {
    it("should handle Unicode characters in events", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: {"message":"Hello 世界 🌍"}\n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledWith({ message: "Hello 世界 🌍" });
    });

    it("should handle nested JSON objects", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: {"outer":{"inner":{"deep":"value"}}}\n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledWith({
        outer: { inner: { deep: "value" } },
      });
    });

    it("should handle arrays in JSON", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: {"items":[1,2,3],"names":["a","b"]}\n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledWith({
        items: [1, 2, 3],
        names: ["a", "b"],
      });
    });

    it("should handle escaped quotes in JSON strings", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: {"message":"She said \\"hello\\""}\n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledWith({ message: 'She said "hello"' });
    });

    it("should handle multiple consecutive newlines", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: {"id":1}\n\n\ndata: {"id":2}\n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledTimes(2);
    });

    it("should handle CRLF line endings", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: {"id":1}\r\n',
        'data: {"id":2}\r\n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledTimes(2);
    });

    it("should handle mixed LF and CRLF line endings", async () => {
      const onEvent = vi.fn();
      const reader = createMockReader([
        'data: {"id":1}\n',
        'data: {"id":2}\r\n',
        'data: {"id":3}\n',
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledTimes(3);
    });

    it("should handle very long single line without newline", async () => {
      const onEvent = vi.fn();
      const longMessage = "x".repeat(10000);
      const reader = createMockReader([
        `data: {"message":"${longMessage}"}`,
      ]);

      await parseSSEStream(reader, { onEvent, parseEvent: identity });

      expect(onEvent).toHaveBeenCalledWith({ message: longMessage });
    });
  });
});
