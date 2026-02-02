import { describe, it, expect, vi } from "vitest";
import { writeSSEChunk, writeSSEComplete, writeSSEError } from "./sse-helpers.js";
import type { SSEWriter } from "./ai-client.js";

describe("writeSSEChunk", () => {
  it("writes chunk event with formatted data", async () => {
    const mockWriter: SSEWriter = {
      writeSSE: vi.fn().mockResolvedValue(undefined),
    };

    await writeSSEChunk(mockWriter, "test content");

    expect(mockWriter.writeSSE).toHaveBeenCalledWith({
      event: "chunk",
      data: JSON.stringify({ type: "chunk", content: "test content" }),
    });
  });

  it("handles empty content", async () => {
    const mockWriter: SSEWriter = {
      writeSSE: vi.fn().mockResolvedValue(undefined),
    };

    await writeSSEChunk(mockWriter, "");

    expect(mockWriter.writeSSE).toHaveBeenCalledWith({
      event: "chunk",
      data: JSON.stringify({ type: "chunk", content: "" }),
    });
  });

  it("handles special characters in content", async () => {
    const mockWriter: SSEWriter = {
      writeSSE: vi.fn().mockResolvedValue(undefined),
    };

    await writeSSEChunk(mockWriter, 'content with "quotes" and \nnewlines');

    expect(mockWriter.writeSSE).toHaveBeenCalledWith({
      event: "chunk",
      data: JSON.stringify({
        type: "chunk",
        content: 'content with "quotes" and \nnewlines',
      }),
    });
  });

  it("propagates errors from writeSSE", async () => {
    const mockWriter: SSEWriter = {
      writeSSE: vi.fn().mockRejectedValue(new Error("Stream error")),
    };

    await expect(writeSSEChunk(mockWriter, "test")).rejects.toThrow("Stream error");
  });
});

describe("writeSSEComplete", () => {
  it("writes complete event with merged data", async () => {
    const mockWriter: SSEWriter = {
      writeSSE: vi.fn().mockResolvedValue(undefined),
    };

    await writeSSEComplete(mockWriter, { result: "success", count: 42 });

    expect(mockWriter.writeSSE).toHaveBeenCalledWith({
      event: "complete",
      data: JSON.stringify({ type: "complete", result: "success", count: 42 }),
    });
  });

  it("handles empty data object", async () => {
    const mockWriter: SSEWriter = {
      writeSSE: vi.fn().mockResolvedValue(undefined),
    };

    await writeSSEComplete(mockWriter, {});

    expect(mockWriter.writeSSE).toHaveBeenCalledWith({
      event: "complete",
      data: JSON.stringify({ type: "complete" }),
    });
  });

  it("handles complex nested data", async () => {
    const mockWriter: SSEWriter = {
      writeSSE: vi.fn().mockResolvedValue(undefined),
    };

    const complexData = {
      user: { name: "Alice", roles: ["admin", "user"] },
      metadata: { timestamp: 123456 },
    };

    await writeSSEComplete(mockWriter, complexData);

    expect(mockWriter.writeSSE).toHaveBeenCalledWith({
      event: "complete",
      data: JSON.stringify({ type: "complete", ...complexData }),
    });
  });

  it("propagates errors from writeSSE", async () => {
    const mockWriter: SSEWriter = {
      writeSSE: vi.fn().mockRejectedValue(new Error("Connection lost")),
    };

    await expect(writeSSEComplete(mockWriter, { status: "done" })).rejects.toThrow(
      "Connection lost"
    );
  });
});

describe("writeSSEError", () => {
  it("writes error event with message and code", async () => {
    const mockWriter: SSEWriter = {
      writeSSE: vi.fn().mockResolvedValue(undefined),
    };

    await writeSSEError(mockWriter, "Something went wrong", "INTERNAL_ERROR");

    expect(mockWriter.writeSSE).toHaveBeenCalledWith({
      event: "error",
      data: JSON.stringify({
        type: "error",
        error: { message: "Something went wrong", code: "INTERNAL_ERROR" },
      }),
    });
  });

  it("handles empty error message", async () => {
    const mockWriter: SSEWriter = {
      writeSSE: vi.fn().mockResolvedValue(undefined),
    };

    await writeSSEError(mockWriter, "", "UNKNOWN_ERROR");

    expect(mockWriter.writeSSE).toHaveBeenCalledWith({
      event: "error",
      data: JSON.stringify({
        type: "error",
        error: { message: "", code: "UNKNOWN_ERROR" },
      }),
    });
  });

  it("handles special characters in error message", async () => {
    const mockWriter: SSEWriter = {
      writeSSE: vi.fn().mockResolvedValue(undefined),
    };

    await writeSSEError(
      mockWriter,
      'Error: "validation" failed\nDetails: <script>',
      "VALIDATION_ERROR"
    );

    expect(mockWriter.writeSSE).toHaveBeenCalledWith({
      event: "error",
      data: JSON.stringify({
        type: "error",
        error: {
          message: 'Error: "validation" failed\nDetails: <script>',
          code: "VALIDATION_ERROR",
        },
      }),
    });
  });

  it("propagates errors from writeSSE", async () => {
    const mockWriter: SSEWriter = {
      writeSSE: vi.fn().mockRejectedValue(new Error("Write failed")),
    };

    await expect(
      writeSSEError(mockWriter, "Test error", "TEST_ERROR")
    ).rejects.toThrow("Write failed");
  });
});
