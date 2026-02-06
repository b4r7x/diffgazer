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
} from "./agent.js";
import { EnrichProgressEventSchema, type EnrichEvent } from "./enrich.js";
import {
  ReviewStreamEventSchema,
  type ReviewStreamEvent as BaseReviewStreamEvent,
} from "../review/issues.js";
import {
  StepStartEventSchema,
  StepCompleteEventSchema,
  StepErrorEventSchema,
  ReviewStartedEventSchema,
  type StepEvent,
} from "./step.js";

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
