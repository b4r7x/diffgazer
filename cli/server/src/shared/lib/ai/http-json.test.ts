import { describe, expect, it, vi } from "vitest";
import { makeChunkedResponse } from "../testing/http.js";
import {
  createResponseLimitingFetch,
  MAX_RESPONSE_BYTES,
  readJsonResponseWithLimit,
} from "./http-json.js";

function createNeverSettlingCancelBody(chunks: Uint8Array[]) {
  let index = 0;
  const cancel = vi.fn(() => new Promise<void>(() => {}));
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index++];
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel,
  });
  return { body, cancel };
}

async function settleWithin<T>(promise: Promise<T>, timeoutMs = 250): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("operation did not settle promptly")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

describe("createResponseLimitingFetch", () => {
  it("rejects a declared oversized body without awaiting upstream cancellation", async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const response = {
      body: { cancel },
      headers: new Headers({ "content-length": String(MAX_RESPONSE_BYTES + 1) }),
    } as unknown as Response;
    const fetcher = vi.fn(async () => response) as unknown as typeof fetch;

    await expect(
      settleWithin(createResponseLimitingFetch(fetcher)("https://example.test")),
    ).rejects.toThrow("response too large");
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
  });

  it("surfaces streamed overflow without awaiting reader cancellation", async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const read = vi
      .fn()
      .mockResolvedValueOnce({ done: false, value: new Uint8Array(MAX_RESPONSE_BYTES) })
      .mockResolvedValueOnce({ done: false, value: new Uint8Array(1) });
    const upstream = {
      body: { getReader: () => ({ read, cancel }) },
      headers: new Headers(),
      status: 200,
      statusText: "OK",
    } as unknown as Response;
    const fetcher = vi.fn(async () => upstream) as unknown as typeof fetch;
    const response = await createResponseLimitingFetch(fetcher)("https://example.test");

    await expect(settleWithin(response.arrayBuffer())).rejects.toThrow(
      `${MAX_RESPONSE_BYTES + 1} bytes`,
    );
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
  });

  it("passes input and init through to the injected fetcher for a successful small response", async () => {
    const upstream = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const fetcher = vi.fn(async () => upstream) as unknown as typeof fetch;
    const controller = new AbortController();
    const input = "https://example.test/small";
    const init: RequestInit = {
      method: "POST",
      headers: { "x-test-header": "distinctive-value" },
      body: JSON.stringify({ hello: "world" }),
      signal: controller.signal,
    };

    const response = await createResponseLimitingFetch(fetcher)(input, init);

    expect(fetcher).toHaveBeenCalledWith(input, init);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

describe("readJsonResponseWithLimit", () => {
  it("returns a declared-size error without awaiting body cancellation", async () => {
    const { body, cancel } = createNeverSettlingCancelBody([]);
    const response = new Response(body, {
      headers: { "content-length": String(MAX_RESPONSE_BYTES + 1) },
    });

    const result = await settleWithin(readJsonResponseWithLimit(response, "models.dev catalog"));

    expect(result.ok).toBe(false);
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
  });

  it("returns a streamed-size error without awaiting reader cancellation", async () => {
    const { body, cancel } = createNeverSettlingCancelBody([
      new Uint8Array(MAX_RESPONSE_BYTES),
      new Uint8Array(1),
    ]);

    const result = await settleWithin(
      readJsonResponseWithLimit(new Response(body), "models.dev catalog"),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain(`${MAX_RESPONSE_BYTES + 1} bytes`);
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
  });

  it("rejects a declared Content-Length over the ceiling before reading the body", async () => {
    const json = (): Promise<unknown> => {
      throw new Error("body must not be read");
    };
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": String(MAX_RESPONSE_BYTES + 1) }),
      json,
    } as unknown as Response;

    const result = await readJsonResponseWithLimit(response, "models.dev catalog");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("models.dev catalog response too large");
    }
  });

  it("rejects a chunked body over the ceiling without a Content-Length", async () => {
    const result = await readJsonResponseWithLimit(
      makeChunkedResponse(`{"data":"${"x".repeat(MAX_RESPONSE_BYTES)}"}`),
      "OpenRouter models",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("OpenRouter models response too large");
    }
  });

  it("parses a body-less response via response.json", async () => {
    const response = {
      ok: true,
      status: 200,
      headers: new Headers(),
      body: null,
      json: async () => ({ value: 42 }),
    } as unknown as Response;

    const result = await readJsonResponseWithLimit(response, "OpenRouter models");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ value: 42 });
  });

  it("reports a labelled error when a body-less response is not JSON", async () => {
    const response = {
      ok: true,
      status: 200,
      headers: new Headers(),
      body: null,
      json: async () => {
        throw new Error("boom");
      },
    } as unknown as Response;

    const result = await readJsonResponseWithLimit(response, "models.dev catalog");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("boom");
  });

  it("returns an error when the streamed body is not valid JSON", async () => {
    const result = await readJsonResponseWithLimit(
      makeChunkedResponse("not json at all"),
      "OpenRouter models",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message.toLowerCase()).toContain("json");
  });

  it("decodes a streamed multi-byte character split mid-codepoint across chunks", async () => {
    const text = `{"text":"żółć"}`;
    const bytes = new TextEncoder().encode(text);
    const asciiPrefix = new TextEncoder().encode(text.slice(0, text.indexOf("ż")));
    const firstByteOfZOffset = asciiPrefix.length;
    const firstChunk = bytes.slice(0, firstByteOfZOffset + 1);
    const secondChunk = bytes.slice(firstByteOfZOffset + 1);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(firstChunk);
        controller.enqueue(secondChunk);
        controller.close();
      },
    });

    const result = await readJsonResponseWithLimit(new Response(body), "models.dev catalog");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { text: string }).text).toBe("żółć");
    }
  });
});
