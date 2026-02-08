import { safeParseJson } from "../json.js";

const MAX_BUFFER_SIZE = 1024 * 1024;

export interface SSEParserOptions<T> {
  onEvent: (data: T) => void;
  parseEvent: (jsonData: unknown) => T | undefined;
  onBufferOverflow?: () => void;
}

export interface SSEParseResult {
  completed: boolean;
}

function parseSSELine(line: string): unknown | undefined {
  if (!line.startsWith("data: ")) return undefined;

  const jsonStr = line.slice(6);
  const result = safeParseJson(jsonStr, () => undefined);

  return result.ok ? result.value : undefined;
}

function emitParsedEvent<T>(
  parsed: unknown,
  onEvent: (data: T) => void,
  parseEvent: (jsonData: unknown) => T | undefined
): void {
  const event = parseEvent(parsed);
  if (event !== undefined) {
    onEvent(event);
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

    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;

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
