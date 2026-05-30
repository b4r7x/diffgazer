import { describe, it, expect, vi } from "vitest";
import { parseSSEStream } from "./sse-parser";

function createMockReader(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return {
    read: vi.fn(async () => {
      if (index >= chunks.length) {
        return { done: true as const, value: undefined };
      }
      return { done: false as const, value: encoder.encode(chunks[index++]) };
    }),
    cancel: vi.fn(),
    releaseLock: vi.fn(),
    closed: Promise.resolve(undefined),
  };
}

const identity = (data: unknown) => data;

async function parseChunks<T = unknown>(
  chunks: string[],
  parseEvent: (data: unknown) => T | undefined = identity as (data: unknown) => T,
) {
  const events: T[] = [];
  const reader = createMockReader(chunks);
  const result = await parseSSEStream(reader, {
    parseEvent,
    onEvent: (event) => events.push(event),
  });
  return { events, reader, result };
}

describe("parseSSEStream", () => {
  it.each([
    {
      name: "single SSE event",
      chunks: ['data: {"type":"message","content":"hello"}\n'],
      events: [{ type: "message", content: "hello" }],
    },
    {
      name: "multiple chunks",
      chunks: ['data: {"id":1}\n', 'data: {"id":2}\n', 'data: {"id":3}\n'],
      events: [{ id: 1 }, { id: 2 }, { id: 3 }],
    },
    {
      name: "multiple lines in one chunk",
      chunks: ['data: {"id":1}\ndata: {"id":2}\ndata: {"id":3}\n'],
      events: [{ id: 1 }, { id: 2 }, { id: 3 }],
    },
    {
      name: "event split across chunks",
      chunks: ['data: {"mes', 'sage":"split', ' across chunks"}\n'],
      events: [{ message: "split across chunks" }],
    },
    {
      name: "partial line at end of chunk",
      chunks: ['data: {"id":1}\ndata: {"id"', ':2}\n'],
      events: [{ id: 1 }, { id: 2 }],
    },
    {
      name: "final event without newline",
      chunks: ['data: {"id":1}\n', 'data: {"id":2}'],
      events: [{ id: 1 }, { id: 2 }],
    },
    {
      name: "mixed LF and CRLF endings",
      chunks: ['data: {"id":1}\n', 'data: {"id":2}\r\n', 'data: {"id":3}\n'],
      events: [{ id: 1 }, { id: 2 }, { id: 3 }],
    },
  ])("parses $name", async ({ chunks, events }) => {
    const result = await parseChunks(chunks);

    expect(result.result.completed).toBe(true);
    expect(result.events).toEqual(events);
  });

  it("ignores non-data lines, invalid JSON, and empty payloads", async () => {
    const { events } = await parseChunks([
      ": comment line\n",
      "event: message\n",
      'data: {"valid":true}\n',
      "id: 123\n",
      "data: {invalid json\n",
      "data: \n",
      "   \n",
    ]);

    expect(events).toEqual([{ valid: true }]);
  });

  it("finishes cleanly for empty streams, whitespace, and truncated final JSON", async () => {
    await expect(parseChunks([])).resolves.toMatchObject({ events: [], result: { completed: true } });
    await expect(parseChunks(["   \n"])).resolves.toMatchObject({ events: [], result: { completed: true } });
    await expect(parseChunks(['data: {"incomplete":'])).resolves.toMatchObject({
      events: [],
      result: { completed: true },
    });
  });

  it("cancels parsing when the buffered data exceeds the limit", async () => {
    const onBufferOverflow = vi.fn();
    const chunkSize = 6 * 1024 * 1024;
    const reader = createMockReader(["a".repeat(chunkSize), "b".repeat(chunkSize), "c".repeat(chunkSize)]);
    const events: unknown[] = [];

    const result = await parseSSEStream(reader, {
      onEvent: (event) => events.push(event),
      parseEvent: identity,
      onBufferOverflow,
    });

    expect(result).toEqual({ completed: false });
    expect(events).toEqual([]);
    expect(onBufferOverflow).toHaveBeenCalledOnce();
    expect(reader.cancel).toHaveBeenCalledOnce();
  });

  it("does not require an overflow handler and leaves valid sub-limit data alone", async () => {
    const overflowReader = createMockReader(["x".repeat(16 * 1024 * 1024 + 1)]);
    const overflow = await parseSSEStream(overflowReader, {
      onEvent: () => undefined,
      parseEvent: identity,
    });

    expect(overflow).toEqual({ completed: false });
    expect(overflowReader.cancel).toHaveBeenCalledOnce();

    const underLimitReader = createMockReader(["x".repeat(16 * 1024 * 1024 - 100)]);
    const underLimit = await parseSSEStream(underLimitReader, {
      onEvent: () => undefined,
      parseEvent: identity,
      onBufferOverflow: vi.fn(),
    });

    expect(underLimit).toEqual({ completed: true });
    expect(underLimitReader.cancel).not.toHaveBeenCalled();
  });

  it("uses parseEvent to transform or skip parsed payloads", async () => {
    const parseEvent = (data: unknown): string | undefined => {
      if (typeof data === "object" && data !== null && "message" in data) {
        return String((data as { message: string }).message).toUpperCase();
      }
      return undefined;
    };

    const { events } = await parseChunks(
      ['data: {"message":"hello"}\n', 'data: {"valid":false}\n', 'data: {"message":"bye"}\n'],
      parseEvent,
    );

    expect(events).toEqual(["HELLO", "BYE"]);
  });

  it("propagates parseEvent failures", async () => {
    const parseEvent = (): never => {
      throw new Error("Parse error");
    };

    await expect(parseChunks(['data: {"message":"test"}\n'], parseEvent)).rejects.toThrow("Parse error");
  });

  it("parses long final lines without a trailing newline", async () => {
    const longMessage = "x".repeat(10000);
    const { events } = await parseChunks([`data: {"message":"${longMessage}"}`]);

    expect(events).toEqual([{ message: longMessage }]);
  });
});
