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

export const FullTriageStreamEventSchema = z.discriminatedUnion("type", [
  ...TriageStreamEventSchema.options,
  AgentStartEventSchema,
  AgentThinkingEventSchema,
  ToolCallEventSchema,
  ToolResultEventSchema,
  IssueFoundEventSchema,
  AgentCompleteEventSchema,
  OrchestratorCompleteEventSchema,
]);

export type FullTriageStreamEvent = BaseTriageStreamEvent | AgentStreamEvent;
