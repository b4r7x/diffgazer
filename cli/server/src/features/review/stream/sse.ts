import type { ReviewError } from "@diffgazer/core/schemas/review";

export interface SSEWriter {
  writeSSE: (data: { event: string; data: string }) => Promise<void>;
}

export const writeSSEError = async (
  stream: SSEWriter,
  message: string,
  // Same wire contract as `reviewStreamError`: an out-of-union code is a
  // compile error here, so clients can always map what they receive.
  code: ReviewError["code"],
): Promise<void> => {
  await stream.writeSSE({
    event: "error",
    data: JSON.stringify({ type: "error", error: { message, code } }),
  });
};
