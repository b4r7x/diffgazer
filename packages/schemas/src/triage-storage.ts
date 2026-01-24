import { z } from "zod";
import { UuidSchema, createdAtField } from "./errors.js";
import { TriageResultSchema, TriageSeveritySchema } from "./triage.js";
import { LensIdSchema, ProfileIdSchema, DrilldownResultSchema } from "./lens.js";

export const TriageReviewMetadataSchema = z.object({
  id: UuidSchema,
  projectPath: z.string(),
  ...createdAtField,
  staged: z.boolean(),
  branch: z.string().nullable(),
  profile: ProfileIdSchema.nullable(),
  lenses: z.array(LensIdSchema),
  issueCount: z.number().int().nonnegative(),
  blockerCount: z.number().int().nonnegative(),
  highCount: z.number().int().nonnegative(),
  fileCount: z.number().int().nonnegative(),
});
export type TriageReviewMetadata = z.infer<typeof TriageReviewMetadataSchema>;

export const TriageGitContextSchema = z.object({
  branch: z.string().nullable(),
  commit: z.string().nullable(),
  fileCount: z.number().int().nonnegative(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
});
export type TriageGitContext = z.infer<typeof TriageGitContextSchema>;

export const SavedTriageReviewSchema = z.object({
  metadata: TriageReviewMetadataSchema,
  result: TriageResultSchema,
  gitContext: TriageGitContextSchema,
  drilldowns: z.array(DrilldownResultSchema),
});
export type SavedTriageReview = z.infer<typeof SavedTriageReviewSchema>;
