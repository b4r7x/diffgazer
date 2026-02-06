import { z } from "zod";
import {
  OrchestratorStartEventSchema,
  AgentQueuedEventSchema,
  AgentStartEventSchema,
  AgentThinkingEventSchema,
  AgentProgressEventSchema,
  AgentErrorEventSchema,
  ToolCallEventSchema,
  ToolResultEventSchema,
  ToolStartEventSchema,
  ToolEndEventSchema,
  IssueFoundEventSchema,
  AgentCompleteEventSchema,
  OrchestratorCompleteEventSchema,
  FileStartEventSchema,
  FileCompleteEventSchema,
  type AgentStreamEvent,
} from "./agent-event.js";
import { EnrichProgressEventSchema, type EnrichEvent } from "./enrich-event.js";
import {
  ReviewStreamEventSchema,
  type ReviewStreamEvent as BaseReviewStreamEvent,
} from "./review.js";
import {
  StepStartEventSchema,
  StepCompleteEventSchema,
  StepErrorEventSchema,
  ReviewStartedEventSchema,
  type StepEvent,
} from "./step-event.js";

export const FullReviewStreamEventSchema = z.discriminatedUnion("type", [
  ...ReviewStreamEventSchema.options,
  OrchestratorStartEventSchema,
  AgentQueuedEventSchema,
  AgentStartEventSchema,
  AgentThinkingEventSchema,
  AgentProgressEventSchema,
  AgentErrorEventSchema,
  ToolCallEventSchema,
  ToolResultEventSchema,
  ToolStartEventSchema,
  ToolEndEventSchema,
  IssueFoundEventSchema,
  AgentCompleteEventSchema,
  OrchestratorCompleteEventSchema,
  FileStartEventSchema,
  FileCompleteEventSchema,
  ReviewStartedEventSchema,
  StepStartEventSchema,
  StepCompleteEventSchema,
  StepErrorEventSchema,
  EnrichProgressEventSchema,
]);

export type FullReviewStreamEvent = BaseReviewStreamEvent | AgentStreamEvent | StepEvent | EnrichEvent;
