export interface SSEWriter {
  writeSSE: (data: { event: string; data: string }) => Promise<void>;
}

export const writeSSEError = async (
  stream: SSEWriter,
  message: string,
  code: string,
): Promise<void> => {
  await stream.writeSSE({
    event: "error",
    data: JSON.stringify({ type: "error", error: { message, code } }),
  });
};
