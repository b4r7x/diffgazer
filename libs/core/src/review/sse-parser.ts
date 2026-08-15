import { safeParseJson } from "../json.js";

const MAX_BUFFER_SIZE = 16 * 1024 * 1024;

export interface SSEParserOptions<T> {
  onEvent: (data: T) => void;
  parseEvent: (jsonData: unknown) => T | undefined;
}

function parseSSELine(line: string): unknown | undefined {
  if (!line.startsWith("data: ")) return undefined;

  const jsonStr = line.slice(6);
  const result = safeParseJson(jsonStr);

  return result.ok ? result.value : undefined;
}

function emitParsedEvent<T>(
  parsed: unknown,
  onEvent: (data: T) => void,
  parseEvent: (jsonData: unknown) => T | undefined,
): void {
  const event = parseEvent(parsed);
  if (event !== undefined) {
    onEvent(event);
  }
}

export async function parseSSEStream<T>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  options: SSEParserOptions<T>,
): Promise<void> {
  const { onEvent, parseEvent } = options;
  const decoder = new TextDecoder();
  const lineChunks: string[] = [];
  let bufferedLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    const chunk = done ? decoder.decode() : decoder.decode(value, { stream: true });

    bufferedLength += chunk.length;

    // Cancelling the reader ends the outer stream without a complete event, which
    // is how the caller learns the stream failed.
    if (!done && bufferedLength > MAX_BUFFER_SIZE) {
      await reader.cancel();
      return;
    }

    let lineStart = 0;
    let newlineIndex = chunk.indexOf("\n");
    while (newlineIndex !== -1) {
      lineChunks.push(chunk.slice(lineStart, newlineIndex));
      const parsed = parseSSELine(lineChunks.join(""));
      lineChunks.length = 0;

      if (parsed !== undefined) {
        emitParsedEvent(parsed, onEvent, parseEvent);
      }

      lineStart = newlineIndex + 1;
      newlineIndex = chunk.indexOf("\n", lineStart);
    }

    if (lineStart < chunk.length) {
      lineChunks.push(chunk.slice(lineStart));
    }
    if (lineStart > 0) {
      bufferedLength = chunk.length - lineStart;
    }

    if (done) break;
  }

  const trailingLine = lineChunks.join("");
  if (trailingLine.trim()) {
    const parsed = parseSSELine(trailingLine);
    if (parsed !== undefined) {
      emitParsedEvent(parsed, onEvent, parseEvent);
    }
  }
}
