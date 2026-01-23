import { useRef, useCallback } from "react";
import { type ZodSchema } from "zod";
import {
  getErrorMessage,
  isAbortError,
  parseSSEStream,
  type SSEParseResult,
  validateSchema,
} from "@repo/core";

export type SSEStreamError = {
  message: string;
  code: string;
};

type StreamConfig<TEvent extends { type: string }> = {
  schema: ZodSchema<TEvent>;
  onEvent: (event: TEvent) => boolean;
  onError: (error: SSEStreamError) => void;
  onBufferOverflow?: () => void;
  onUnexpectedEnd?: () => void;
};

export function useSSEStream<TEvent extends { type: string }>(
  config: StreamConfig<TEvent>
) {
  const { schema, onEvent, onError, onBufferOverflow, onUnexpectedEnd } = config;
  const abortRef = useRef<AbortController | null>(null);

  const resetController = useCallback((): AbortController => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current;
  }, []);

  const getSignal = useCallback((): AbortSignal => {
    if (!abortRef.current) {
      abortRef.current = new AbortController();
    }
    return abortRef.current.signal;
  }, []);

  const abort = useCallback((): void => {
    abortRef.current?.abort();
  }, []);

  const processStream = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
      let receivedTerminal = false;

      try {
        const result: SSEParseResult = await parseSSEStream<TEvent>(reader, {
          parseEvent(jsonData) {
            const result = validateSchema(jsonData, schema, (msg) => msg);
            if (!result.ok) {
              console.error("Failed to parse stream event:", result.error);
              return undefined;
            }
            return result.value;
          },
          onEvent(event) {
            if (onEvent(event)) {
              receivedTerminal = true;
            }
          },
          onBufferOverflow() {
            if (onBufferOverflow) {
              onBufferOverflow();
            } else {
              onError({ message: "SSE buffer exceeded maximum size", code: "INTERNAL_ERROR" });
            }
            receivedTerminal = true;
          },
        });

        if (result.completed && !receivedTerminal) {
          if (onUnexpectedEnd) {
            onUnexpectedEnd();
          } else {
            onError({ message: "Stream ended unexpectedly", code: "INTERNAL_ERROR" });
          }
          return { success: false, aborted: false };
        }

        return { success: receivedTerminal, aborted: false };
      } catch (error) {
        if (isAbortError(error)) {
          return { success: false, aborted: true };
        }
        onError({ message: getErrorMessage(error), code: "INTERNAL_ERROR" });
        return { success: false, aborted: false };
      }
    },
    [schema, onEvent, onError, onBufferOverflow, onUnexpectedEnd]
  );

  return { processStream, abort, getSignal, resetController };
}
