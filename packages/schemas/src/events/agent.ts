import { z } from "zod";
import { LensIdSchema, type LensId } from "../review/lens.js";
import { ReviewIssueSchema } from "../review/issues.js";

const AGENT_IDS = [
  "detective",
  "guardian",
  "optimizer",
  "simplifier",
  "tester",
] as const;

const AgentIdSchema = z.enum(AGENT_IDS);
export type AgentId = z.infer<typeof AgentIdSchema>;

export const LENS_TO_AGENT: Record<LensId, AgentId> = {
  correctness: "detective",
  security: "guardian",
  performance: "optimizer",
  simplicity: "simplifier",
  tests: "tester",
} as const;

const AgentMetaSchema = z.object({
  id: AgentIdSchema,
  lens: LensIdSchema,
  name: z.string(),
  badgeLabel: z.string().optional(),
  badgeVariant: z.enum(["success", "warning", "error", "info", "neutral"]).optional(),
  emoji: z.string().optional(),
  description: z.string(),
}).transform((data) => ({
  id: data.id,
  lens: data.lens,
  name: data.name,
  badgeLabel: data.badgeLabel ?? data.id.toUpperCase(),
  badgeVariant: data.badgeVariant ?? "info",
  description: data.description,
}));
type AgentMeta = z.infer<typeof AgentMetaSchema>;

export const AGENT_METADATA: Record<AgentId, AgentMeta> = {
  detective: {
    id: "detective",
    lens: "correctness",
    name: "Detective",
    badgeLabel: "DET",
    badgeVariant: "info",
    description: "Finds bugs and logic errors",
  },
  guardian: {
    id: "guardian",
    lens: "security",
    name: "Guardian",
    badgeLabel: "SEC",
    badgeVariant: "warning",
    description: "Identifies security vulnerabilities",
  },
  optimizer: {
    id: "optimizer",
    lens: "performance",
    name: "Optimizer",
    badgeLabel: "PERF",
    badgeVariant: "info",
    description: "Spots performance bottlenecks",
  },
  simplifier: {
    id: "simplifier",
    lens: "simplicity",
    name: "Simplifier",
    badgeLabel: "SIM",
    badgeVariant: "info",
    description: "Reduces complexity and improves readability",
  },
  tester: {
    id: "tester",
    lens: "tests",
    name: "Tester",
    badgeLabel: "TEST",
    badgeVariant: "info",
    description: "Evaluates test coverage and quality",
  },
} as const;

export const AGENT_STATUS = ["queued", "running", "complete", "error"] as const;
const AgentStatusSchema = z.enum(AGENT_STATUS);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const FileStartEventSchema = z
  .object({
    type: z.literal("file_start"),
    file: z.string(),
    index: z.number(),
    total: z.number(),
    timestamp: z.string(),
    agent: AgentIdSchema.optional(),
    scope: z.enum(["orchestrator", "agent"]).optional(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
    parentSpanId: z.string().optional(),
  })
;

export const FileCompleteEventSchema = z
  .object({
    type: z.literal("file_complete"),
    file: z.string(),
    index: z.number(),
    total: z.number(),
    timestamp: z.string(),
    agent: AgentIdSchema.optional(),
    scope: z.enum(["orchestrator", "agent"]).optional(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
    parentSpanId: z.string().optional(),
  })
;

export const OrchestratorStartEventSchema = z
  .object({
    type: z.literal("orchestrator_start"),
    agents: z.array(AgentMetaSchema),
    concurrency: z.number(),
    timestamp: z.string(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
  })
;

export const AgentQueuedEventSchema = z
  .object({
    type: z.literal("agent_queued"),
    agent: AgentMetaSchema,
    position: z.number(),
    total: z.number(),
    timestamp: z.string(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
  })
;

export const AgentStartEventSchema = z
  .object({
    type: z.literal("agent_start"),
    agent: AgentMetaSchema,
    timestamp: z.string(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
  })
;

export const AgentThinkingEventSchema = z
  .object({
    type: z.literal("agent_thinking"),
    agent: AgentIdSchema,
    thought: z.string(),
    timestamp: z.string(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
  })
;

export const AgentProgressEventSchema = z
  .object({
    type: z.literal("agent_progress"),
    agent: AgentIdSchema,
    progress: z.number().min(0).max(100),
    message: z.string().optional(),
    timestamp: z.string(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
  })
;

export const AgentErrorEventSchema = z
  .object({
    type: z.literal("agent_error"),
    agent: AgentIdSchema,
    error: z.string(),
    timestamp: z.string(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
  })
;

export const ToolCallEventSchema = z
  .object({
    type: z.literal("tool_call"),
    agent: AgentIdSchema,
    tool: z.string(),
    input: z.string(),
    timestamp: z.string(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
    parentSpanId: z.string().optional(),
  })
;

export const ToolResultEventSchema = z
  .object({
    type: z.literal("tool_result"),
    agent: AgentIdSchema,
    tool: z.string(),
    summary: z.string(),
    timestamp: z.string(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
    parentSpanId: z.string().optional(),
  })
;

export const ToolStartEventSchema = z
  .object({
    type: z.literal("tool_start"),
    agent: AgentIdSchema,
    tool: z.string(),
    input: z.string(),
    timestamp: z.string(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
    parentSpanId: z.string().optional(),
  })
;

export const ToolEndEventSchema = z
  .object({
    type: z.literal("tool_end"),
    agent: AgentIdSchema,
    tool: z.string(),
    summary: z.string(),
    status: z.enum(["success", "error"]),
    error: z.string().optional(),
    timestamp: z.string(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
    parentSpanId: z.string().optional(),
  })
;

export const IssueFoundEventSchema = z
  .object({
    type: z.literal("issue_found"),
    agent: AgentIdSchema,
    issue: ReviewIssueSchema,
    timestamp: z.string(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
  })
;

export const AgentCompleteEventSchema = z
  .object({
    type: z.literal("agent_complete"),
    agent: AgentIdSchema,
    issueCount: z.number(),
    timestamp: z.string(),
    durationMs: z.number().optional(),
    promptChars: z.number().optional(),
    outputChars: z.number().optional(),
    tokenEstimate: z.number().optional(),
    costUsd: z.number().optional(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
  })
;

export const LensStatSchema = z.object({
  lensId: LensIdSchema,
  issueCount: z.number(),
  status: z.enum(["success", "failed"]),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
});
export type LensStat = z.infer<typeof LensStatSchema>;

export const OrchestratorCompleteEventSchema = z
  .object({
    type: z.literal("orchestrator_complete"),
    summary: z.string(),
    totalIssues: z.number(),
    lensStats: z.array(LensStatSchema),
    filesAnalyzed: z.number(),
    timestamp: z.string(),
    traceId: z.string().optional(),
    spanId: z.string().optional(),
  })
;

const AgentStreamEventSchema = z.discriminatedUnion("type", [
  OrchestratorStartEventSchema,
  AgentQueuedEventSchema,
  FileStartEventSchema,
  FileCompleteEventSchema,
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
]);
export type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>;

const AgentStateSchema = z.object({
  id: AgentIdSchema,
  meta: AgentMetaSchema,
  status: AgentStatusSchema,
  progress: z.number().min(0).max(100),
  issueCount: z.number(),
  currentAction: z.string().optional(),
  lastToolCall: z.string().optional(),
  error: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});
export type AgentState = z.infer<typeof AgentStateSchema>;
