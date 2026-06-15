import { describe, expect, it } from "vitest";
import { MAX_RESPONSE_BYTES, readJsonResponseWithLimit } from "./http-json.js";

const chunkedResponse = (text: string, headers?: Record<string, string>): Response => {
  const bytes = new TextEncoder().encode(text);
  return {
    ok: true,
    status: 200,
    headers: new Headers(headers),
    body: new ReadableStream({
      start(controller) {
        let offset = 0;
        const chunkSize = 64 * 1024;
        while (offset < bytes.length) {
          controller.enqueue(bytes.slice(offset, offset + chunkSize));
          offset += chunkSize;
        }
        controller.close();
      },
    }),
  } as Response;
};

describe("readJsonResponseWithLimit", () => {
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
      chunkedResponse(`{"data":"${"x".repeat(MAX_RESPONSE_BYTES)}"}`),
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
      chunkedResponse("not json at all"),
      "OpenRouter models",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message.toLowerCase()).toContain("json");
  });

  it("decodes a streamed multi-byte payload split across chunks", async () => {
    const result = await readJsonResponseWithLimit(
      chunkedResponse(`{"text":"żółć ${"a".repeat(70 * 1024)}"}`),
      "models.dev catalog",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { text: string }).text.startsWith("żółć ")).toBe(true);
    }
  });
});
