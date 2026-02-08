import type { SSEWriter } from "./types.js";

export type { SSEWriter } from "./types.js";

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
