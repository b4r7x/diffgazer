import { useState, useRef } from "react";
import {
  type ReviewResult,
  type ReviewError,
  ReviewStreamEventSchema,
} from "@repo/schemas/review";
import { api } from "../../../lib/api.js";
import { getErrorMessage } from "@repo/core";

export type ReviewState =
  | { status: "idle" }
  | { status: "loading"; content: string }
  | { status: "success"; data: ReviewResult }
  | { status: "error"; error: ReviewError };

export function useReview() {
  const [state, setState] = useState<ReviewState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  async function startReview(staged = true) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setState({ status: "loading", content: "" });

    try {
      const res = await api().stream("/review/stream", {
        params: { staged: String(staged) },
        signal: abortRef.current.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) {
        setState({ status: "error", error: { message: "No response body", code: "INTERNAL_ERROR" } });
        return;
      }

      const decoder = new TextDecoder();
      const MAX_BUFFER_SIZE = 1024 * 1024;
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
            let parsed: unknown;
            try {
              parsed = JSON.parse(line.slice(6));
            } catch {
              parsed = undefined;
            }
            const parseResult = ReviewStreamEventSchema.safeParse(parsed);

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

      if (!receivedTerminal) {
        setState({ status: "error", error: { message: "Stream ended unexpectedly", code: "INTERNAL_ERROR" } });
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        setState({ status: "error", error: { message: getErrorMessage(error), code: "INTERNAL_ERROR" } });
      }
    }
  }

  function reset() {
    abortRef.current?.abort();
    setState({ status: "idle" });
  }

  return { state, startReview, reset };
}
