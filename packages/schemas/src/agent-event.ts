import { z } from "zod";
import { LensIdSchema, type LensId } from "./lens.js";

export const AGENT_IDS = [
  "detective",
  "guardian",
  "optimizer",
  "simplifier",
  "tester",
] as const;

export const AgentIdSchema = z.enum(AGENT_IDS);
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
  emoji: z.string(),
  description: z.string(),
});
export type AgentMeta = z.infer<typeof AgentMetaSchema>;

export const AGENT_METADATA: Record<AgentId, AgentMeta> = {
  detective: {
    id: "detective",
    lens: "correctness",
    name: "Detective",
    emoji: "🔍",
    description: "Finds bugs and logic errors",
  },
  guardian: {
    id: "guardian",
    lens: "security",
    name: "Guardian",
    emoji: "🔒",
    description: "Identifies security vulnerabilities",
  },
  optimizer: {
    id: "optimizer",
    lens: "performance",
    name: "Optimizer",
    emoji: "⚡",
    description: "Spots performance bottlenecks",
  },
  simplifier: {
    id: "simplifier",
    lens: "simplicity",
    name: "Simplifier",
    emoji: "✨",
    description: "Reduces complexity and improves readability",
  },
  tester: {
    id: "tester",
    lens: "tests",
    name: "Tester",
    emoji: "🧪",
    description: "Evaluates test coverage and quality",
  },
} as const;

export const AGENT_STATUS = ["queued", "running", "complete"] as const;
export const AgentStatusSchema = z.enum(AGENT_STATUS);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const AgentStartEventSchema = z.object({
  type: z.literal("agent_start"),
  agent: AgentMetaSchema,
  timestamp: z.string(),
});

export const AgentThinkingEventSchema = z.object({
  type: z.literal("agent_thinking"),
  agent: AgentIdSchema,
  thought: z.string(),
  timestamp: z.string(),
});

export const ToolCallEventSchema = z.object({
  type: z.literal("tool_call"),
  agent: AgentIdSchema,
  tool: z.string(),
  input: z.string(),
  timestamp: z.string(),
});

export const ToolResultEventSchema = z.object({
  type: z.literal("tool_result"),
  agent: AgentIdSchema,
  tool: z.string(),
  summary: z.string(),
  timestamp: z.string(),
});

export const IssueFoundEventSchema = z.object({
  type: z.literal("issue_found"),
  agent: AgentIdSchema,
  issue: z.object({
    id: z.string(),
    severity: z.string(),
    category: z.string(),
    title: z.string(),
    file: z.string(),
  }).passthrough(),
  timestamp: z.string(),
});

export const AgentCompleteEventSchema = z.object({
  type: z.literal("agent_complete"),
  agent: AgentIdSchema,
  issueCount: z.number(),
  timestamp: z.string(),
});

export const LensStatSchema = z.object({
  lensId: LensIdSchema,
  issueCount: z.number(),
  status: z.enum(["success", "failed"]),
});
export type LensStat = z.infer<typeof LensStatSchema>;

export const OrchestratorCompleteEventSchema = z.object({
  type: z.literal("orchestrator_complete"),
  summary: z.string(),
  totalIssues: z.number(),
  lensStats: z.array(LensStatSchema).optional(),
  filesAnalyzed: z.number().optional(),
  timestamp: z.string(),
});

export const AgentStreamEventSchema = z.discriminatedUnion("type", [
  AgentStartEventSchema,
  AgentThinkingEventSchema,
  ToolCallEventSchema,
  ToolResultEventSchema,
  IssueFoundEventSchema,
  AgentCompleteEventSchema,
  OrchestratorCompleteEventSchema,
]);
export type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>;

export const AgentStateSchema = z.object({
  id: AgentIdSchema,
  meta: AgentMetaSchema,
  status: AgentStatusSchema,
  progress: z.number().min(0).max(100),
  issueCount: z.number(),
  currentAction: z.string().optional(),
  lastToolCall: z.string().optional(),
});
export type AgentState = z.infer<typeof AgentStateSchema>;

