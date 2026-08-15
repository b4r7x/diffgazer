import { describe, expect, it, vi } from "vitest";
import { parseSSEStream } from "./sse-parser.js";

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

async function parseChunksWith<T>(chunks: string[], parseEvent: (data: unknown) => T | undefined) {
  const events: T[] = [];
  const reader = createMockReader(chunks);
  await parseSSEStream(reader, {
    parseEvent,
    onEvent: (event) => events.push(event),
  });
  return { events, reader };
}

const parseChunks = (chunks: string[]) => parseChunksWith(chunks, (data: unknown) => data);

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
      chunks: ['data: {"id":1}\ndata: {"id"', ":2}\n"],
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

    expect(result.events).toEqual(events);
    expect(result.reader.cancel).not.toHaveBeenCalled();
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
    await expect(parseChunks([])).resolves.toMatchObject({ events: [] });
    await expect(parseChunks(["   \n"])).resolves.toMatchObject({ events: [] });
    await expect(parseChunks(['data: {"incomplete":'])).resolves.toMatchObject({ events: [] });
  });

  it("cancels the reader when the buffered data exceeds the limit", async () => {
    const chunkSize = 6 * 1024 * 1024;
    const { events, reader } = await parseChunks([
      "a".repeat(chunkSize),
      "b".repeat(chunkSize),
      "c".repeat(chunkSize),
    ]);

    expect(events).toEqual([]);
    expect(reader.cancel).toHaveBeenCalledOnce();
  });

  it("leaves valid sub-limit data alone", async () => {
    const { reader } = await parseChunks(["x".repeat(16 * 1024 * 1024 - 100)]);

    expect(reader.cancel).not.toHaveBeenCalled();
  });

  it("uses parseEvent to transform or skip parsed payloads", async () => {
    const parseEvent = (data: unknown): string | undefined => {
      if (typeof data === "object" && data !== null && "message" in data) {
        return String(data.message).toUpperCase();
      }
      return undefined;
    };

    const { events } = await parseChunksWith(
      ['data: {"message":"hello"}\n', 'data: {"valid":false}\n', 'data: {"message":"bye"}\n'],
      parseEvent,
    );

    expect(events).toEqual(["HELLO", "BYE"]);
  });

  it("propagates parseEvent failures", async () => {
    const parseEvent = (): never => {
      throw new Error("Parse error");
    };

    await expect(parseChunksWith(['data: {"message":"test"}\n'], parseEvent)).rejects.toThrow(
      "Parse error",
    );
  });

  it("parses long final lines without a trailing newline", async () => {
    const longMessage = "x".repeat(10000);
    const { events } = await parseChunks([`data: {"message":"${longMessage}"}`]);

    expect(events).toEqual([{ message: longMessage }]);
  });

  it(
    "processes a fragmented near-limit line without rescanning retained chunks",
    { timeout: 2_000 },
    async () => {
      const fragment = "x".repeat(4 * 1024);
      const chunks = ["data: ", ...Array<string>(15 * 256).fill(fragment)];

      const { events, reader } = await parseChunks(chunks);

      expect(events).toEqual([]);
      expect(reader.cancel).not.toHaveBeenCalled();
    },
  );

  it("decodes a multi-byte character split across the final chunk boundary", async () => {
    // `é` (U+00E9) encodes to two bytes; split the SSE line so the second byte
    // arrives in the final chunk. Without the post-`done` decoder flush the
    // trailing byte is dropped and the JSON fails to parse.
    const encoder = new TextEncoder();
    const fullLine = encoder.encode('data: {"message":"é"}\n');
    const splitAt = fullLine.indexOf(0xa9); // the second byte of `é`
    const byteChunks = [fullLine.subarray(0, splitAt), fullLine.subarray(splitAt)];

    let index = 0;
    const reader: ReadableStreamDefaultReader<Uint8Array> = {
      read: vi.fn(async () => {
        const chunk = byteChunks[index++];
        if (chunk === undefined) {
          return { done: true as const, value: undefined };
        }
        return { done: false as const, value: chunk };
      }),
      cancel: vi.fn(),
      releaseLock: vi.fn(),
      closed: Promise.resolve(undefined),
    };

    const events: unknown[] = [];
    await parseSSEStream(reader, {
      parseEvent: (data: unknown) => data,
      onEvent: (event) => events.push(event),
    });

    expect(events).toEqual([{ message: "é" }]);
  });
});
