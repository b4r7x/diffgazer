import { z } from "zod";
import {
  createDomainErrorCodes,
  createDomainErrorSchema,
  type SharedErrorCode,
} from "./errors.js";

export const TRIAGE_SEVERITY = ["blocker", "high", "medium", "low", "nit"] as const;
export const TriageSeveritySchema = z.enum(TRIAGE_SEVERITY);
export type TriageSeverity = z.infer<typeof TriageSeveritySchema>;

export const TRIAGE_CATEGORY = [
  "correctness",
  "security",
  "performance",
  "api",
  "tests",
  "readability",
  "style",
] as const;
export const TriageCategorySchema = z.enum(TRIAGE_CATEGORY);
export type TriageCategory = z.infer<typeof TriageCategorySchema>;

export const EVIDENCE_TYPE = ["code", "doc", "trace", "external"] as const;
export const EvidenceTypeSchema = z.enum(EVIDENCE_TYPE);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const EvidenceRefSchema = z.object({
  type: EvidenceTypeSchema,
  title: z.string(),
  sourceId: z.string(),
  file: z.string().optional(),
  range: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  excerpt: z.string(),
  sha: z.string().optional(),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const TraceRefSchema = z.object({
  step: z.number(),
  tool: z.string(),
  inputSummary: z.string(),
  outputSummary: z.string(),
  timestamp: z.string(),
  artifacts: z.array(z.string()).optional(),
});
export type TraceRef = z.infer<typeof TraceRefSchema>;

export const FixPlanStepSchema = z.object({
  step: z.number(),
  action: z.string(),
  files: z.array(z.string()).optional(),
  risk: z.enum(["low", "medium", "high"]).optional(),
});
export type FixPlanStep = z.infer<typeof FixPlanStepSchema>;

export const TriageIssueSchema = z.object({
  id: z.string(),
  severity: TriageSeveritySchema,
  category: TriageCategorySchema,
  title: z.string(),
  file: z.string(),
  line_start: z.number().nullable(),
  line_end: z.number().nullable(),
  rationale: z.string(),
  recommendation: z.string(),
  suggested_patch: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  symptom: z.string(),
  whyItMatters: z.string(),
  fixPlan: z.array(FixPlanStepSchema).optional(),
  betterOptions: z.array(z.string()).optional(),
  testsToAdd: z.array(z.string()).optional(),
  evidence: z.array(EvidenceRefSchema),
  trace: z.array(TraceRefSchema).optional(),
});
export type TriageIssue = z.infer<typeof TriageIssueSchema>;

export const TriageResultSchema = z.object({
  summary: z.string(),
  issues: z.array(TriageIssueSchema),
});
export type TriageResult = z.infer<typeof TriageResultSchema>;

export const TRIAGE_SPECIFIC_CODES = ["NO_DIFF", "AI_ERROR", "GENERATION_FAILED"] as const;
export type TriageSpecificCode = (typeof TRIAGE_SPECIFIC_CODES)[number];

export const TRIAGE_ERROR_CODES = createDomainErrorCodes(TRIAGE_SPECIFIC_CODES);
export const TriageErrorCodeSchema = z.enum(TRIAGE_ERROR_CODES as unknown as [string, ...string[]]);
export type TriageErrorCode = SharedErrorCode | TriageSpecificCode;

export const TriageErrorSchema = createDomainErrorSchema(TRIAGE_SPECIFIC_CODES);
export type TriageError = z.infer<typeof TriageErrorSchema>;

export const TriageStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("chunk"), content: z.string() }),
  z.object({ type: z.literal("lens_start"), lens: z.string(), index: z.number(), total: z.number() }),
  z.object({ type: z.literal("lens_complete"), lens: z.string() }),
  z.object({ type: z.literal("complete"), result: TriageResultSchema, reviewId: z.string() }),
  z.object({ type: z.literal("error"), error: TriageErrorSchema }),
]);
export type TriageStreamEvent = z.infer<typeof TriageStreamEventSchema>;
