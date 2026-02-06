import type { LensId, ProfileId, ReviewMode } from "@stargazer/schemas/review";
import type { ReviewResult, ReviewError } from "@stargazer/schemas/review";
import type { AgentStreamEvent, EnrichEvent, FullReviewStreamEvent, StepEvent } from "@stargazer/schemas/events";
import { FullReviewStreamEventSchema } from "@stargazer/schemas/events";
import { parseSSEStream } from "../streaming/sse-parser.js";
import { ok, err, type Result } from "../result.js";

export interface StreamReviewRequest {
  mode?: ReviewMode;
  files?: string[];
  lenses?: LensId[];
  profile?: ProfileId;
  signal?: AbortSignal;
}

export interface StreamReviewOptions extends StreamReviewRequest {
  onAgentEvent?: (event: AgentStreamEvent) => void;
  onStepEvent?: (event: StepEvent) => void;
  onEnrichEvent?: (event: EnrichEvent) => void;
  onChunk?: (content: string) => void;
  onLensStart?: (lens: string, index: number, total: number) => void;
  onLensComplete?: (lens: string) => void;
}

export interface StreamReviewResult {
  result: ReviewResult;
  reviewId: string;
  agentEvents: AgentStreamEvent[];
}

export type StreamReviewError = ReviewError | { code: "STREAM_ERROR"; message: string };

export interface ReviewStreamController {
  stop: () => void;
}

export function buildReviewQueryParams(options: StreamReviewRequest): Record<string, string> {
  const { mode = "unstaged", files, lenses, profile } = options;
  const params: Record<string, string> = {
    mode,
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

export async function processReviewStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  options: Omit<StreamReviewOptions, keyof StreamReviewRequest>
): Promise<Result<StreamReviewResult, StreamReviewError>> {
  const { onAgentEvent, onStepEvent, onEnrichEvent, onChunk, onLensStart, onLensComplete } = options;

  const agentEvents: AgentStreamEvent[] = [];
  let reviewResult: ReviewResult | null = null;
  let reviewId: string | null = null;
  let reviewError: ReviewError | null = null;

  await parseSSEStream<FullReviewStreamEvent>(reader, {
    parseEvent(jsonData: unknown) {
      const parseResult = FullReviewStreamEventSchema.safeParse(jsonData);
      return parseResult.success ? parseResult.data : undefined;
    },
    onEvent(event: FullReviewStreamEvent) {
      switch (event.type) {
        // Step events
        case "review_started":
          reviewId = event.reviewId;
          onStepEvent?.(event);
          break;
        case "step_start":
        case "step_complete":
        case "step_error":
          onStepEvent?.(event);
          break;

        // Agent events - collect and forward
        case "agent_start":
        case "agent_queued":
        case "agent_thinking":
        case "agent_progress":
        case "agent_error":
        case "tool_call":
        case "tool_result":
        case "tool_start":
        case "tool_end":
        case "issue_found":
        case "agent_complete":
        case "orchestrator_start":
        case "orchestrator_complete":
        case "file_start":
        case "file_complete":
          agentEvents.push(event);
          onAgentEvent?.(event);
          break;

        // Enrich events
        case "enrich_progress":
          onEnrichEvent?.(event);
          break;

        // Review stream events
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
          reviewResult = event.result;
          reviewId = event.reviewId;
          break;
        case "error":
          reviewError = event.error;
          break;
      }
    },
  });

  if (reviewError) {
    return err(reviewError);
  }

  if (!reviewResult || !reviewId) {
    return err({ code: "STREAM_ERROR", message: "Stream ended without complete event" });
  }

  return ok({ result: reviewResult, reviewId, agentEvents });
}
