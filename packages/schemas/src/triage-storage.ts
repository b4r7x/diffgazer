import { z } from "zod";
import { UuidSchema, createdAtField } from "./errors.js";
import { TriageResultSchema } from "./triage.js";
import { LensIdSchema, ProfileIdSchema, DrilldownResultSchema } from "./lens.js";

const countField = z.number().int().nonnegative();

export const TriageReviewMetadataSchema = z
  .object({
    id: UuidSchema,
    projectPath: z.string(),
    ...createdAtField,
    staged: z.boolean(),
    branch: z.string().nullable(),
    profile: ProfileIdSchema.nullable(),
    lenses: z.array(LensIdSchema),
    issueCount: countField,
    // For backward compatibility: accept missing count fields, default to 0
    blockerCount: countField.optional(),
    highCount: countField.optional(),
    mediumCount: countField.optional(),
    lowCount: countField.optional(),
    nitCount: countField.optional(),
    fileCount: countField,
    durationMs: countField.optional(),
  })
  .transform((data) => ({
    ...data,
    blockerCount: data.blockerCount ?? 0,
    highCount: data.highCount ?? 0,
    mediumCount: data.mediumCount ?? 0,
    lowCount: data.lowCount ?? 0,
    nitCount: data.nitCount ?? 0,
  }));
export type TriageReviewMetadata = z.infer<typeof TriageReviewMetadataSchema>;

export const TriageGitContextSchema = z.object({
  branch: z.string().nullable(),
  commit: z.string().nullable(),
  fileCount: countField,
  additions: countField,
  deletions: countField,
});
export type TriageGitContext = z.infer<typeof TriageGitContextSchema>;

export const SavedTriageReviewSchema = z.object({
  metadata: TriageReviewMetadataSchema,
  result: TriageResultSchema,
  gitContext: TriageGitContextSchema,
  drilldowns: z.array(DrilldownResultSchema),
});
export type SavedTriageReview = z.infer<typeof SavedTriageReviewSchema>;
