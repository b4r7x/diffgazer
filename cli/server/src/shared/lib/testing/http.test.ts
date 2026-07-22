import { describe, expect, it } from "vitest";
import { makeChunkedResponse } from "./http.js";

describe("makeChunkedResponse", () => {
  it("builds 64 KiB chunks and preserves response headers", async () => {
    const response = makeChunkedResponse("x".repeat(64 * 1024 + 1), {
      "x-test-header": "present",
    });
    const reader = response.body?.getReader();

    expect(response.headers.get("x-test-header")).toBe("present");
    expect(reader).toBeDefined();
    if (!reader) return;

    const first = await reader.read();
    const second = await reader.read();
    const end = await reader.read();
    expect(first.value).toHaveLength(64 * 1024);
    expect(second.value).toHaveLength(1);
    expect(end.done).toBe(true);
  });
});
