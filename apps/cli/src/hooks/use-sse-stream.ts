import { useRef, useCallback } from "react";
import { type ZodSchema } from "zod";
import { parseSSEStream, type SSEParseResult } from "../lib/sse.js";
import { getErrorMessage, isAbortError } from "@repo/core";

/**
 * Standard error shape for SSE stream operations.
 * Matches the common error format used across feature schemas.
 */
export interface SSEStreamError {
  message: string;
  code: string;
}

/**
 * Base stream event interface that all SSE events must extend.
 * Events must have a discriminant `type` field.
 */
export interface BaseStreamEvent {
  type: string;
}

/**
 * Configuration for useSSEStream hook.
 *
 * @template TEvent - The discriminated union type for stream events
 */
export interface UseSSEStreamConfig<TEvent extends BaseStreamEvent> {
  /** Zod schema to validate incoming events */
  schema: ZodSchema<TEvent>;

  /**
   * Called for each validated event from the stream.
   * Return true to indicate this is a terminal event (complete/error).
   */
  onEvent: (event: TEvent) => boolean;

  /** Called when stream processing encounters an error */
  onError: (error: SSEStreamError) => void;

  /** Optional callback when SSE buffer exceeds maximum size */
  onBufferOverflow?: () => void;

  /**
   * Called when stream completes without a terminal event.
   * If not provided, defaults to calling onError with appropriate message.
   */
  onUnexpectedEnd?: () => void;
}

/**
 * Result returned from processStream function.
 */
export interface ProcessStreamResult {
  /** Whether stream completed successfully with a terminal event */
  success: boolean;
  /** Whether stream was aborted */
  aborted: boolean;
}

/**
 * Return type for useSSEStream hook.
 */
export interface UseSSEStreamReturn {
  /**
   * Process an SSE stream from a reader.
   * Handles parsing, validation, and error handling.
   */
  processStream: (
    reader: ReadableStreamDefaultReader<Uint8Array>
  ) => Promise<ProcessStreamResult>;

  /**
   * Abort the current stream processing.
   */
  abort: () => void;

  /**
   * Get an AbortSignal for use with fetch requests.
   * Creates a new AbortController if needed.
   */
  getSignal: () => AbortSignal;

  /**
   * Reset the abort controller for a new stream.
   * Call this before starting a new stream operation.
   */
  resetController: () => AbortController;
}

/**
 * Hook for processing Server-Sent Events (SSE) streams with Zod validation.
 *
 * Provides common functionality for SSE stream processing:
 * - Event parsing and validation via Zod schema
 * - Abort controller management
 * - Error handling for network, parsing, and buffer overflow errors
 * - Terminal event detection
 *
 * @example
 * ```tsx
 * const { processStream, resetController } = useSSEStream({
 *   schema: MyEventSchema,
 *   onEvent: (event) => {
 *     if (event.type === "chunk") {
 *       setContent(prev => prev + event.content);
 *       return false; // not terminal
 *     }
 *     if (event.type === "complete") {
 *       setResult(event.result);
 *       return true; // terminal
 *     }
 *     return event.type === "error"; // error is terminal
 *   },
 *   onError: (error) => setError(error),
 * });
 *
 * // In your fetch handler:
 * const controller = resetController();
 * const response = await fetch(url, { signal: controller.signal });
 * const reader = response.body.getReader();
 * await processStream(reader);
 * ```
 */
export function useSSEStream<TEvent extends BaseStreamEvent>(
  config: UseSSEStreamConfig<TEvent>
): UseSSEStreamReturn {
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
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>
    ): Promise<ProcessStreamResult> => {
      let receivedTerminal = false;

      try {
        const result: SSEParseResult = await parseSSEStream<TEvent>(reader, {
          parseEvent(jsonData) {
            const parseResult = schema.safeParse(jsonData);
            if (!parseResult.success) {
              console.error(
                "Failed to parse stream event:",
                parseResult.error.message
              );
              return undefined;
            }
            return parseResult.data;
          },
          onEvent(event) {
            const isTerminal = onEvent(event);
            if (isTerminal) {
              receivedTerminal = true;
            }
          },
          onBufferOverflow() {
            if (onBufferOverflow) {
              onBufferOverflow();
            } else {
              onError({
                message: "SSE buffer exceeded maximum size",
                code: "INTERNAL_ERROR",
              });
            }
            receivedTerminal = true;
          },
        });

        // Handle stream completing without terminal event
        if (result.completed && !receivedTerminal) {
          if (onUnexpectedEnd) {
            onUnexpectedEnd();
          } else {
            onError({
              message: "Stream ended unexpectedly",
              code: "INTERNAL_ERROR",
            });
          }
          return { success: false, aborted: false };
        }

        return { success: receivedTerminal, aborted: false };
      } catch (error) {
        if (isAbortError(error)) {
          return { success: false, aborted: true };
        }
        onError({
          message: getErrorMessage(error),
          code: "INTERNAL_ERROR",
        });
        return { success: false, aborted: false };
      }
    },
    [schema, onEvent, onError, onBufferOverflow, onUnexpectedEnd]
  );

  return {
    processStream,
    abort,
    getSignal,
    resetController,
  };
}
