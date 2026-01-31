import { z } from "zod";
import {
  AgentStartEventSchema,
  AgentThinkingEventSchema,
  ToolCallEventSchema,
  ToolResultEventSchema,
  IssueFoundEventSchema,
  AgentCompleteEventSchema,
  OrchestratorCompleteEventSchema,
  type AgentStreamEvent,
} from "./agent-event.js";
import {
  TriageStreamEventSchema,
  type TriageStreamEvent as BaseTriageStreamEvent,
} from "./triage.js";
import {
  StepStartEventSchema,
  StepCompleteEventSchema,
  StepErrorEventSchema,
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
  StepStartEventSchema,
  StepCompleteEventSchema,
  StepErrorEventSchema,
]);

export type FullTriageStreamEvent = BaseTriageStreamEvent | AgentStreamEvent | StepEvent;
