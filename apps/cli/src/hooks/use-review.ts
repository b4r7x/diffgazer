import { useState, useCallback, useRef } from "react";
import {
  type ReviewResult,
  type ReviewError,
  ReviewStreamEventSchema,
  ReviewErrorSchema,
} from "@repo/schemas/review";
import { z } from "zod";

export type ReviewState =
  | { status: "idle" }
  | { status: "loading"; content: string }
  | { status: "success"; data: ReviewResult }
  | { status: "error"; error: ReviewError };

const ErrorResponseSchema = z.object({
  error: ReviewErrorSchema.optional(),
});

export function useReview(baseUrl: string) {
  const [state, setState] = useState<ReviewState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const startReview = useCallback(async (staged = true) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setState({ status: "loading", content: "" });

    try {
      const res = await fetch(`${baseUrl}/review/stream?staged=${staged}`, { signal: abortRef.current.signal });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const parsed = ErrorResponseSchema.safeParse(json);
        const error = parsed.success ? parsed.data.error : undefined;
        setState({ status: "error", error: error ?? { message: `HTTP ${res.status}`, code: "INTERNAL_ERROR" } });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setState({ status: "error", error: { message: "No response body", code: "INTERNAL_ERROR" } });
        return;
      }

      const decoder = new TextDecoder();
      const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB
      let buffer = "", streamedContent = "";
      let receivedTerminal = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        if (buffer.length > MAX_BUFFER_SIZE) {
          reader.cancel();
          setState({ status: "error", error: { message: "SSE buffer exceeded maximum size", code: "INTERNAL_ERROR" } });
          return;
        }

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const parseResult = ReviewStreamEventSchema.safeParse(
              (() => {
                try {
                  return JSON.parse(line.slice(6));
                } catch {
                  return undefined;
                }
              })()
            );

            if (!parseResult.success) {
              console.error("Failed to parse stream event:", parseResult.error.message);
              continue;
            }

            const event = parseResult.data;
            if (event.type === "chunk") {
              streamedContent += event.content;
              setState({ status: "loading", content: streamedContent });
            } else if (event.type === "complete") {
              receivedTerminal = true;
              setState({ status: "success", data: event.result });
            } else if (event.type === "error") {
              receivedTerminal = true;
              setState({ status: "error", error: event.error });
            }
          }
        }
      }

      // Handle unexpected stream termination without a terminal event
      if (!receivedTerminal) {
        setState({ status: "error", error: { message: "Stream ended unexpectedly", code: "INTERNAL_ERROR" } });
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        setState({ status: "error", error: { message: String(error), code: "INTERNAL_ERROR" } });
      }
    }
  }, [baseUrl]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: "idle" });
  }, []);

  return { state, startReview, reset };
}
