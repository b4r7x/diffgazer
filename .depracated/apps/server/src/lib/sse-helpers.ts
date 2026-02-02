import type { SSEWriter } from "./ai-client.js";

export async function writeSSEChunk(stream: SSEWriter, content: string): Promise<void> {
  await stream.writeSSE({
    event: "chunk",
    data: JSON.stringify({ type: "chunk", content }),
  });
}

export async function writeSSEComplete<T extends Record<string, unknown>>(
  stream: SSEWriter,
  data: T
): Promise<void> {
  await stream.writeSSE({
    event: "complete",
    data: JSON.stringify({ type: "complete", ...data }),
  });
}

export async function writeSSEError(
  stream: SSEWriter,
  message: string,
  code: string
): Promise<void> {
  await stream.writeSSE({
    event: "error",
    data: JSON.stringify({ type: "error", error: { message, code } }),
  });
}
