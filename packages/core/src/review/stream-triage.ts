import type { LensId, ProfileId } from "@repo/schemas/lens";
import type { TriageResult, TriageError } from "@repo/schemas/triage";
import type { AgentStreamEvent } from "@repo/schemas/agent-event";
import type { FullTriageStreamEvent } from "@repo/schemas/full-triage-stream-event";
import { FullTriageStreamEventSchema } from "@repo/schemas/full-triage-stream-event";
import { parseSSEStream } from "../streaming/sse-parser.js";
import { ok, err, type Result } from "../result.js";

const AGENT_EVENT_TYPES = [
  "agent_start",
  "agent_thinking",
  "tool_call",
  "tool_result",
  "issue_found",
  "agent_complete",
  "orchestrator_complete",
] as const;

function isAgentEvent(event: FullTriageStreamEvent): event is AgentStreamEvent {
  return AGENT_EVENT_TYPES.includes(event.type as (typeof AGENT_EVENT_TYPES)[number]);
}

export interface StreamTriageRequest {
  staged?: boolean;
  files?: string[];
  lenses?: LensId[];
  profile?: ProfileId;
  signal?: AbortSignal;
}

export interface StreamTriageOptions extends StreamTriageRequest {
  onAgentEvent?: (event: AgentStreamEvent) => void;
  onChunk?: (content: string) => void;
  onLensStart?: (lens: string, index: number, total: number) => void;
  onLensComplete?: (lens: string) => void;
}

export interface StreamTriageResult {
  result: TriageResult;
  reviewId: string;
  agentEvents: AgentStreamEvent[];
}

export type StreamTriageError = TriageError | { code: "STREAM_ERROR"; message: string };

export interface TriageStreamController {
  stop: () => void;
}

export function buildTriageQueryParams(options: StreamTriageRequest): Record<string, string> {
  const { staged = true, files, lenses, profile } = options;
  const params: Record<string, string> = {
    staged: String(staged),
  };
  if (files && files.length > 0) {
    params.files = files.join(",");
  }
  if (lenses && lenses.length > 0) {
    params.lenses = lenses.join(",");
  }
  if (profile) {
    params.profile = profile;
  }
  return params;
}

export async function processTriageStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  options: Omit<StreamTriageOptions, keyof StreamTriageRequest>
): Promise<Result<StreamTriageResult, StreamTriageError>> {
  const { onAgentEvent, onChunk, onLensStart, onLensComplete } = options;

  const agentEvents: AgentStreamEvent[] = [];
  let triageResult: TriageResult | null = null;
  let reviewId: string | null = null;
  let triageError: TriageError | null = null;

  await parseSSEStream<FullTriageStreamEvent>(reader, {
    parseEvent(jsonData: unknown) {
      const parseResult = FullTriageStreamEventSchema.safeParse(jsonData);
      if (!parseResult.success) {
        return undefined;
      }
      return parseResult.data;
    },
    onEvent(event: FullTriageStreamEvent) {
      if (isAgentEvent(event)) {
        agentEvents.push(event);
        onAgentEvent?.(event);
        return;
      }

      switch (event.type) {
        case "chunk":
          onChunk?.(event.content);
          break;
        case "lens_start":
          onLensStart?.(event.lens, event.index, event.total);
          break;
        case "lens_complete":
          onLensComplete?.(event.lens);
          break;
        case "complete":
          triageResult = event.result;
          reviewId = event.reviewId;
          break;
        case "error":
          triageError = event.error;
          break;
      }
    },
  });

  if (triageError) {
    return err(triageError);
  }

  if (!triageResult || !reviewId) {
    return err({ code: "STREAM_ERROR", message: "Stream ended without complete event" });
  }

  return ok({ result: triageResult, reviewId, agentEvents });
}
