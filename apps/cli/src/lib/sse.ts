/**
 * Maximum buffer size for SSE stream processing (1 MB).
 *
 * This limit exists to protect against memory exhaustion from:
 * - Malformed SSE streams that never emit newlines (preventing line splitting)
 * - Runaway streams from misbehaving servers or network issues
 * - Potential denial-of-service from excessively large payloads
 *
 * 1 MB is generous for SSE data (typical events are < 1 KB) while still
 * providing a safety bound. If exceeded, the stream is cancelled gracefully.
 */
const MAX_BUFFER_SIZE = 1024 * 1024;

export interface SSEParserOptions<T> {
  onEvent: (data: T) => void;
  parseEvent?: (jsonData: unknown) => T | undefined;
  onBufferOverflow?: () => void;
}

export interface SSEParseResult {
  completed: boolean;
}

/**
 * Parse an SSE data line into JSON.
 * Returns undefined if the line is not a valid SSE data line or parsing fails.
 */
function parseSSELine(line: string): unknown | undefined {
  if (!line.startsWith("data: ")) return undefined;
  try {
    return JSON.parse(line.slice(6));
  } catch {
    const jsonStr = line.slice(6);
    console.debug(
      `Failed to parse SSE event: ${jsonStr.slice(0, 100)}${jsonStr.length > 100 ? "..." : ""}`
    );
    return undefined;
  }
}

/**
 * Parses an SSE stream and invokes the onEvent callback for each parsed event.
 *
 * @param reader - The ReadableStreamDefaultReader to read from
 * @param options - Configuration options for parsing
 * @returns Promise that resolves when the stream ends
 */
export async function parseSSEStream<T>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  options: SSEParserOptions<T>
): Promise<SSEParseResult> {
  const { onEvent, parseEvent, onBufferOverflow } = options;
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    if (buffer.length > MAX_BUFFER_SIZE) {
      reader.cancel();
      onBufferOverflow?.();
      return { completed: false };
    }

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const parsed = parseSSELine(line);
      if (parsed === undefined) continue;

      if (parseEvent) {
        const event = parseEvent(parsed);
        if (event !== undefined) {
          onEvent(event);
        }
      } else {
        onEvent(parsed as T);
      }
    }
  }

  return { completed: true };
}
