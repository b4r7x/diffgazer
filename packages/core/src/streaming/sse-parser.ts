import { safeParseJson } from "../json.js";
import { truncate } from "../strings.js";

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
  let chunkCount = 0;
  let lineCount = 0;
  let eventCount = 0;

  console.log("[SSE:STREAM_START]");

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log("[SSE:STREAM_DONE] chunks:", chunkCount, "lines:", lineCount, "events:", eventCount);
      break;
    }

    chunkCount++;
    const chunk = decoder.decode(value, { stream: true });
    console.log("[SSE:CHUNK]", chunkCount, "size:", chunk.length, "preview:", truncate(chunk.replace(/\n/g, "\\n"), 150));
    buffer += chunk;

    if (buffer.length > MAX_BUFFER_SIZE) {
      console.error("[SSE:BUFFER_OVERFLOW] size:", buffer.length);
      reader.cancel();
      onBufferOverflow?.();
      return { completed: false };
    }

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      lineCount++;
      if (line.trim()) {
        console.log("[SSE:LINE]", lineCount, "content:", truncate(line, 150));
      }
      const parsed = parseSSELine(line);
      if (parsed !== undefined) {
        eventCount++;
        console.log("[SSE:PARSED]", eventCount, "type:", (parsed as any)?.type);
        emitParsedEvent(parsed, onEvent, parseEvent);
      }
    }
  }

  if (buffer.trim()) {
    console.log("[SSE:FINAL_BUFFER]", truncate(buffer, 150));
    const parsed = parseSSELine(buffer);
    if (parsed !== undefined) {
      eventCount++;
      emitParsedEvent(parsed, onEvent, parseEvent);
    }
  }

  console.log("[SSE:STREAM_COMPLETE] total chunks:", chunkCount, "lines:", lineCount, "events:", eventCount);
  return { completed: true };
}
