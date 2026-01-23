import { safeParseJson } from "../json.js";
import { truncate } from "../string.js";

const MAX_BUFFER_SIZE = 1024 * 1024;

export interface SSEParserOptions<T> {
  onEvent: (data: T) => void;
  parseEvent?: (jsonData: unknown) => T | undefined;
  onBufferOverflow?: () => void;
}

export interface SSEParseResult {
  completed: boolean;
}

function parseSSELine(line: string): unknown | undefined {
  if (!line.startsWith("data: ")) return undefined;

  const jsonStr = line.slice(6);
  const result = safeParseJson(jsonStr, (message, details) => {
    console.debug(`Failed to parse SSE event: ${truncate(jsonStr, 100)}${details ? ` (${details})` : ""}`);
    return undefined;
  });

  return result.ok ? result.value : undefined;
}

function emitParsedEvent<T>(
  parsed: unknown,
  onEvent: (data: T) => void,
  parseEvent?: (jsonData: unknown) => T | undefined
): void {
  if (parseEvent) {
    const event = parseEvent(parsed);
    if (event !== undefined) {
      onEvent(event);
    }
  } else {
    onEvent(parsed as T);
  }
}

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
      if (parsed !== undefined) {
        emitParsedEvent(parsed, onEvent, parseEvent);
      }
    }
  }

  if (buffer.trim()) {
    const parsed = parseSSELine(buffer);
    if (parsed !== undefined) {
      emitParsedEvent(parsed, onEvent, parseEvent);
    }
  }

  return { completed: true };
}
