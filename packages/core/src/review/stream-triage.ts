import type { LensId, ProfileId } from "@repo/schemas/lens";
import type { TriageResult, TriageError } from "@repo/schemas/triage";
import type { AgentStreamEvent } from "@repo/schemas/agent-event";
import type { FullTriageStreamEvent } from "@repo/schemas/full-triage-stream-event";
import type { StepEvent } from "@repo/schemas/step-event";
import { FullTriageStreamEventSchema } from "@repo/schemas/full-triage-stream-event";
import { parseSSEStream } from "../streaming/sse-parser.js";
import { ok, err, type Result } from "../result.js";

export interface StreamTriageRequest {
  staged?: boolean;
  files?: string[];
  lenses?: LensId[];
  profile?: ProfileId;
  signal?: AbortSignal;
}

export interface StreamTriageOptions extends StreamTriageRequest {
  onAgentEvent?: (event: AgentStreamEvent) => void;
  onStepEvent?: (event: StepEvent) => void;
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
  const { onAgentEvent, onStepEvent, onChunk, onLensStart, onLensComplete } = options;

  const agentEvents: AgentStreamEvent[] = [];
  let triageResult: TriageResult | null = null;
  let reviewId: string | null = null;
  let triageError: TriageError | null = null;

  await parseSSEStream<FullTriageStreamEvent>(reader, {
    parseEvent(jsonData: unknown) {
      const parseResult = FullTriageStreamEventSchema.safeParse(jsonData);
      return parseResult.success ? parseResult.data : undefined;
    },
    onEvent(event: FullTriageStreamEvent) {
      switch (event.type) {
        // Step events
        case "step_start":
        case "step_complete":
        case "step_error":
          onStepEvent?.(event);
          break;

        // Agent events - collect and forward
        case "agent_start":
        case "agent_thinking":
        case "tool_call":
        case "tool_result":
        case "issue_found":
        case "agent_complete":
        case "orchestrator_complete":
          agentEvents.push(event);
          onAgentEvent?.(event);
          break;

        // Triage stream events
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
