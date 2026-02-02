import { z } from "zod";
import {
  AgentStartEventSchema,
  AgentThinkingEventSchema,
  ToolCallEventSchema,
  ToolResultEventSchema,
  IssueFoundEventSchema,
  AgentCompleteEventSchema,
  OrchestratorCompleteEventSchema,
  FileStartEventSchema,
  FileCompleteEventSchema,
  type AgentStreamEvent,
} from "./agent-event.js";
import { EnrichProgressEventSchema, type EnrichEvent } from "./enrich-event.js";
import {
  TriageStreamEventSchema,
  type TriageStreamEvent as BaseTriageStreamEvent,
} from "./triage.js";
import {
  StepStartEventSchema,
  StepCompleteEventSchema,
  StepErrorEventSchema,
  ReviewStartedEventSchema,
  type StepEvent,
} from "./step-event.js";

export const FullTriageStreamEventSchema = z.discriminatedUnion("type", [
  ...TriageStreamEventSchema.options,
  AgentStartEventSchema,
  AgentThinkingEventSchema,
  ToolCallEventSchema,
  ToolResultEventSchema,
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

export type FullTriageStreamEvent = BaseTriageStreamEvent | AgentStreamEvent | StepEvent | EnrichEvent;
