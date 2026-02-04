import type { SSEWriter } from "../ai/client.js";

export const writeSSEChunk = async (stream: SSEWriter, content: string): Promise<void> => {
  await stream.writeSSE({
    event: "chunk",
    data: JSON.stringify({ type: "chunk", content }),
  });
};

export const writeSSEComplete = async <T extends Record<string, unknown>>(
  stream: SSEWriter,
  data: T
): Promise<void> => {
  await stream.writeSSE({
    event: "complete",
    data: JSON.stringify({ type: "complete", ...data }),
  });
};

export const writeSSEError = async (
  stream: SSEWriter,
  message: string,
  code: string
): Promise<void> => {
  await stream.writeSSE({
    event: "error",
    data: JSON.stringify({ type: "error", error: { message, code } }),
  });
};
