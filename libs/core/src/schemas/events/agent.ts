import { z } from "zod";
import { BadgeVariantSchema } from "../presentation/log.js";
import { ReviewSeveritySchema } from "../review/enums.js";
import { ReviewIssueSchema } from "../review/issues.js";
import { type LensId, LensIdSchema } from "../review/lens.js";

const AGENT_IDS = [
  "detective",
  "guardian",
  "optimizer",
  "simplifier",
  "tester",
  "synthesizer",
] as const;
export type AgentId = (typeof AGENT_IDS)[number];

const AGENT_ID_SET = new Set<AgentId>(AGENT_IDS);

const AgentIdSchema = z.custom<AgentId>(
  (value): value is AgentId => typeof value === "string" && AGENT_ID_SET.has(value as AgentId),
  { error: "Invalid agent id" },
);

export const LENS_TO_AGENT = {
  correctness: "detective",
  security: "guardian",
  performance: "optimizer",
  simplicity: "simplifier",
  tests: "tester",
  synthesis: "synthesizer",
} as const satisfies Readonly<Record<LensId, AgentId>>;

const CountSchema = z.int().nonnegative();
const PositiveCountSchema = z.int().positive();
const CostUsdSchema = z.number().nonnegative();

function hasCanonicalAgentLensPair(id: AgentId, lens: LensId): boolean {
  return LENS_TO_AGENT[lens] === id;
}

const AgentMetaSchema = z
  .object({
    id: AgentIdSchema,
    lens: LensIdSchema,
    name: z.string(),
    badgeLabel: z.string().optional(),
    badgeVariant: BadgeVariantSchema.optional(),
    description: z.string(),
  })
  .superRefine((data, context) => {
    if (hasCanonicalAgentLensPair(data.id, data.lens)) return;
    context.addIssue({
      code: "custom",
      message: "lens must match the canonical agent id",
      path: ["lens"],
    });
  })
  .transform((data) => ({
    id: data.id,
    lens: data.lens,
    name: data.name,
    badgeLabel: data.badgeLabel ?? data.id.toUpperCase(),
    badgeVariant: data.badgeVariant ?? "info",
    description: data.description,
  }));
export type AgentMeta = z.infer<typeof AgentMetaSchema>;

export const AGENT_METADATA = {
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
  synthesizer: {
    id: "synthesizer",
    lens: "synthesis",
    name: "Synthesizer",
    badgeLabel: "SYN",
    badgeVariant: "info",
    description: "Connects findings across batches of a split diff",
  },
} as const satisfies { [Id in AgentId]: AgentMeta & { id: Id } };

const AGENT_STATUSES = ["queued", "running", "complete", "error"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

const OrchestratorStartEventSchema = z.object({
  type: z.literal("orchestrator_start"),
  agents: z.array(AgentMetaSchema),
  concurrency: PositiveCountSchema,
  requestedConcurrency: PositiveCountSchema.optional(),
  timestamp: z.string(),
});

const AgentQueuedEventSchema = z.object({
  type: z.literal("agent_queued"),
  agent: AgentMetaSchema,
  position: PositiveCountSchema,
  total: PositiveCountSchema,
  timestamp: z.string(),
});

const AgentStartEventSchema = z.object({
  type: z.literal("agent_start"),
  agent: AgentMetaSchema,
  timestamp: z.string(),
});

const AgentThinkingEventSchema = z.object({
  type: z.literal("agent_thinking"),
  agent: AgentIdSchema,
  thought: z.string(),
  timestamp: z.string(),
});

const AgentProgressEventSchema = z.object({
  type: z.literal("agent_progress"),
  agent: AgentIdSchema,
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  timestamp: z.string(),
});

const AgentErrorEventSchema = z.object({
  type: z.literal("agent_error"),
  agent: AgentIdSchema,
  error: z.string(),
  timestamp: z.string(),
});

// Honest per-lens diff-coverage progress. Drives the UI's files-k/n metric from
// real diff segmentation; the lens reads only the diff, never the file, so no
// fake file-read tool event is emitted.
const FileProgressEventSchema = z.object({
  type: z.literal("file_progress"),
  agent: AgentIdSchema,
  file: z.string(),
  completed: PositiveCountSchema,
  total: PositiveCountSchema,
  timestamp: z.string(),
});

const IssueFoundEventSchema = z.object({
  type: z.literal("issue_found"),
  agent: AgentIdSchema,
  issue: ReviewIssueSchema,
  timestamp: z.string(),
});

const AgentCompleteEventSchema = z.object({
  type: z.literal("agent_complete"),
  agent: AgentIdSchema,
  issueCount: CountSchema,
  timestamp: z.string(),
  durationMs: CountSchema.optional(),
  promptChars: CountSchema.optional(),
  outputChars: CountSchema.optional(),
  tokenEstimate: CountSchema.optional(),
  costUsd: CostUsdSchema.optional(),
});

export const LensStatSchema = z.object({
  lensId: LensIdSchema,
  issueCount: CountSchema,
  status: z.enum(["success", "failed"]),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  dispatches: z
    .array(
      z.object({
        batchIndex: CountSchema,
        startedAt: z.iso.datetime(),
        finishedAt: z.iso.datetime(),
        outcome: z.string(),
      }),
    )
    .optional(),
});
export type LensStat = z.infer<typeof LensStatSchema>;

const OrchestratorCompleteEventSchema = z.strictObject({
  type: z.literal("orchestrator_complete"),
  totalIssues: CountSchema,
  lensStats: z.array(LensStatSchema),
  filesAnalyzed: CountSchema,
  // Counts the dedup/filter passes removed from the streamed total so the UI can
  // explain why the live counter snaps down at `complete`.
  droppedDuplicates: CountSchema.optional(),
  droppedBelowThreshold: CountSchema.optional(),
  droppedIncompleteProviderIssues: CountSchema.optional(),
  // The resolved severity floor the dropped issues fell below, so the hidden-count
  // notice can name the threshold the user can lower to surface them.
  minSeverity: ReviewSeveritySchema.optional(),
  timestamp: z.string(),
});

export const AgentStreamEventSchema = z.discriminatedUnion("type", [
  OrchestratorStartEventSchema,
  AgentQueuedEventSchema,
  AgentStartEventSchema,
  AgentThinkingEventSchema,
  AgentProgressEventSchema,
  AgentErrorEventSchema,
  FileProgressEventSchema,
  IssueFoundEventSchema,
  AgentCompleteEventSchema,
  OrchestratorCompleteEventSchema,
]);
export type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>;

/**
 * Client review state, built by the reducer from already-parsed
 * `AgentStreamEvent` values. It never crosses a serialization boundary of its
 * own, so it is a plain type rather than a schema nothing parses.
 */
export interface AgentState {
  id: AgentId;
  meta: AgentMeta;
  status: AgentStatus;
  progress: number;
  issueCount: number;
  currentAction?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}
