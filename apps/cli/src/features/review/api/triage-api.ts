import { api } from "../../../lib/api.js";
import type { SavedTriageReview, TriageReviewMetadata } from "@repo/schemas/triage-storage";
import type { DrilldownResult, LensId, ProfileId } from "@repo/schemas/lens";
import type { TriageResult, TriageError } from "@repo/schemas/triage";
import type { AgentStreamEvent } from "@repo/schemas/agent-event";
import { FullTriageStreamEventSchema, type FullTriageStreamEvent } from "@repo/schemas/stream-events";
import { parseSSEStream, validateSchema, ok, err, type Result } from "@repo/core";

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

export async function streamTriage({
  staged = true,
  files,
  lenses,
  profile,
  signal,
}: StreamTriageRequest = {}): Promise<Response> {
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

  return api().stream("/triage/stream", { params, signal });
}

export async function streamTriageWithEvents(
  options: StreamTriageOptions
): Promise<Result<StreamTriageResult, StreamTriageError>> {
  const {
    staged = true,
    files,
    lenses,
    profile,
    signal,
    onAgentEvent,
    onChunk,
    onLensStart,
    onLensComplete,
  } = options;

  const response = await streamTriage({ staged, files, lenses, profile, signal });
  const reader = response.body?.getReader();

  if (!reader) {
    return err({ code: "STREAM_ERROR", message: "No response body" });
  }

  const agentEvents: AgentStreamEvent[] = [];
  let triageResult: TriageResult | null = null;
  let reviewId: string | null = null;
  let triageError: TriageError | null = null;

  await parseSSEStream<FullTriageStreamEvent>(reader, {
    parseEvent(jsonData) {
      const result = validateSchema(jsonData, FullTriageStreamEventSchema, (msg) => msg);
      if (!result.ok) {
        return undefined;
      }
      return result.value;
    },
    onEvent(event) {
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

export interface GetTriageReviewsRequest {
  projectPath: string;
}

export interface TriageReviewListResponse {
  reviews: TriageReviewMetadata[];
  warnings?: string[];
}

export async function getTriageReviews({
  projectPath,
}: GetTriageReviewsRequest): Promise<TriageReviewListResponse> {
  return api().get<TriageReviewListResponse>(
    `/triage/reviews?projectPath=${encodeURIComponent(projectPath)}`
  );
}

export async function getTriageReview(id: string): Promise<{ review: SavedTriageReview }> {
  return api().get<{ review: SavedTriageReview }>(`/triage/reviews/${id}`);
}

export async function deleteTriageReview(id: string): Promise<{ existed: boolean }> {
  return api().delete<{ existed: boolean }>(`/triage/reviews/${id}`);
}

export interface TriggerDrilldownRequest {
  reviewId: string;
  issueId: string;
}

export async function triggerDrilldown({
  reviewId,
  issueId,
}: TriggerDrilldownRequest): Promise<{ drilldown: DrilldownResult }> {
  return api().post<{ drilldown: DrilldownResult }>(
    `/triage/reviews/${reviewId}/drilldown`,
    { issueId }
  );
}
