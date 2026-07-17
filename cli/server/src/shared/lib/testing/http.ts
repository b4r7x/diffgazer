const CHUNK_SIZE_BYTES = 64 * 1024;

export function makeChunkedResponse(text: string, headers?: Record<string, string>): Response {
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE_BYTES) {
          controller.enqueue(bytes.slice(offset, offset + CHUNK_SIZE_BYTES));
        }
        controller.close();
      },
    }),
    { status: 200, headers },
  );
}
