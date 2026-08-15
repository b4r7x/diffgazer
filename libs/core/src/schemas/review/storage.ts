import { z } from "zod";
import { canonicalJson } from "../canonical-json.js";
import { LensStatSchema } from "../events/agent.js";
import { UuidSchema } from "../fields.js";
import { SavedReviewExecutionSchemaVersionSchema } from "./enums.js";
import {
  ExecutionReceiptSchema,
  type ExecutionResult,
  ExecutionResultSchema,
  Sha256HexSchema,
  TerminalOutcomeSchema,
} from "./execution.js";
import { ReviewResultSchema, ReviewSeveritySchema } from "./issues.js";
import { LensIdSchema, ProfileIdSchema } from "./lens.js";

export const ReviewModeSchema = z.enum(["staged", "unstaged", "files"]);
export type ReviewMode = z.infer<typeof ReviewModeSchema>;

const CountFieldSchema = z.number().int().nonnegative();

const DiffStatsSchema = z.object({
  additions: CountFieldSchema,
  deletions: CountFieldSchema,
  sizeBytes: CountFieldSchema,
});

const DiffHunkSchema = z.object({
  oldStart: CountFieldSchema,
  oldCount: CountFieldSchema,
  newStart: CountFieldSchema,
  newCount: CountFieldSchema,
  content: z.string(),
});

const FileDiffSchema = z.object({
  filePath: z.string(),
  previousPath: z.string().nullable(),
  operation: z.enum(["add", "modify", "delete", "rename"]),
  hunks: z.array(DiffHunkSchema),
  rawDiff: z.string(),
  stats: DiffStatsSchema,
});

export const ParsedDiffSchema = z.object({
  files: z.array(FileDiffSchema),
  totalStats: z.object({
    filesChanged: CountFieldSchema,
    additions: CountFieldSchema,
    deletions: CountFieldSchema,
    totalSizeBytes: CountFieldSchema,
  }),
});

export const ReviewMetadataSchema = z
  .object({
    id: UuidSchema,
    projectPath: z.string(),
    createdAt: z.iso.datetime(),
    mode: ReviewModeSchema.optional(),
    staged: z.boolean().optional(),
    branch: z.string().nullable(),
    profile: ProfileIdSchema.nullable(),
    lenses: z.array(LensIdSchema),
    issueCount: CountFieldSchema,
    failedLensCount: CountFieldSchema.optional(),
    blockerCount: CountFieldSchema.default(0),
    highCount: CountFieldSchema.default(0),
    mediumCount: CountFieldSchema.default(0),
    lowCount: CountFieldSchema.default(0),
    nitCount: CountFieldSchema.default(0),
    fileCount: CountFieldSchema,
    durationMs: CountFieldSchema.optional(),
    terminalOutcome: TerminalOutcomeSchema.optional(),
  })
  .transform(({ staged, ...data }) => ({
    ...data,
    mode: data.mode ?? (staged ? "staged" : "unstaged"),
  }));
export type ReviewMetadata = z.infer<typeof ReviewMetadataSchema>;

export const ReviewGitContextSchema = z.object({
  branch: z.string().nullable(),
  commit: z.string().nullable(),
  fileCount: CountFieldSchema,
  additions: CountFieldSchema,
  deletions: CountFieldSchema,
});
export type ReviewGitContext = z.infer<typeof ReviewGitContextSchema>;

export const SavedReviewExecutionSnapshotSchema = z
  .strictObject({
    schemaVersion: SavedReviewExecutionSchemaVersionSchema,
    executionFingerprint: Sha256HexSchema,
    receipt: ExecutionReceiptSchema,
  })
  .refine((snapshot) => snapshot.executionFingerprint === snapshot.receipt.executionFingerprint, {
    path: ["executionFingerprint"],
    error: "Snapshot fingerprint must match the execution its receipt describes",
  })
  .readonly();
export type SavedReviewExecutionSnapshot = z.infer<typeof SavedReviewExecutionSnapshotSchema>;

function resultsMatch(
  left: z.infer<typeof ReviewResultSchema>,
  right: z.infer<typeof ReviewResultSchema>,
): boolean {
  return canonicalJson(left.issues) === canonicalJson(right.issues);
}

function validateSavedReviewExecution(
  review: {
    execution?: z.infer<typeof ExecutionResultSchema>;
    executionSnapshot?: SavedReviewExecutionSnapshot;
    result: z.infer<typeof ReviewResultSchema>;
  },
  context: z.RefinementCtx,
) {
  const receipt = review.executionSnapshot?.receipt ?? review.execution?.receipt;
  if (!receipt) return;

  if (
    review.execution &&
    review.executionSnapshot &&
    review.executionSnapshot.executionFingerprint !== review.execution.receipt.executionFingerprint
  ) {
    context.addIssue({
      code: "custom",
      message: "Execution snapshot fingerprint must match the durable receipt",
      path: ["executionSnapshot", "executionFingerprint"],
    });
  }

  if (receipt.outcome !== "completed" && review.result.issues.length > 0) {
    context.addIssue({
      code: "custom",
      message: "Non-completed terminal outcomes cannot carry review findings",
      path: ["result", "issues"],
    });
  }

  if (
    receipt.outcome === "completed" &&
    review.execution &&
    !resultsMatch(review.result, review.execution.result)
  ) {
    context.addIssue({
      code: "custom",
      message: "Completed review findings must match the immutable execution result",
      path: ["result", "issues"],
    });
  }
}

const SavedReviewObjectSchema = z
  .object({
    metadata: ReviewMetadataSchema,
    result: ReviewResultSchema,
    execution: ExecutionResultSchema.optional(),
    // The versioned durable shape of a terminal execution. Every terminal
    // outcome — completed, cancelled, or failed — is represented here, so a
    // reader can read the outcome without re-deriving it from the raw receipt.
    executionSnapshot: SavedReviewExecutionSnapshotSchema.optional(),
    diff: ParsedDiffSchema.optional(),
    gitContext: ReviewGitContextSchema,
    lensStats: z.array(LensStatSchema).optional(),
    // Count of issues removed after streaming (silently dropped from the final
    // result) so the summary can surface "K below-threshold issue(s) hidden".
    droppedBelowThreshold: CountFieldSchema.optional(),
    droppedDuplicates: CountFieldSchema.optional(),
    // The severity floor those issues fell below, so the notice can name the
    // threshold the user can lower to surface them.
    minSeverity: ReviewSeveritySchema.optional(),
  })
  .superRefine(validateSavedReviewExecution);
export type SavedReview = z.infer<typeof SavedReviewObjectSchema>;

function toCanonicalExecutionResult(
  review: Pick<SavedReview, "execution" | "executionSnapshot" | "result">,
): ExecutionResult | undefined {
  const receipt = review.executionSnapshot?.receipt ?? review.execution?.receipt;
  if (!receipt) return undefined;

  if (receipt.outcome === "completed") {
    return {
      receipt,
      result: review.result,
    };
  }

  return {
    receipt,
    result: { issues: [] },
  };
}

/**
 * `executionSnapshot` is the durable half; `execution` is the runtime view a
 * reader derives from it, so the store omits `execution` when it serializes.
 */
function withDerivedSavedReviewExecution(review: SavedReview): SavedReview {
  const executionSnapshot =
    review.executionSnapshot ??
    (review.execution ? toSavedReviewExecutionSnapshot(review.execution) : undefined);
  const execution = toCanonicalExecutionResult({
    execution: review.execution,
    executionSnapshot,
    result: review.result,
  });

  return {
    ...review,
    ...(executionSnapshot ? { executionSnapshot } : {}),
    ...(execution ? { execution } : {}),
  };
}

export const SavedReviewSchema = SavedReviewObjectSchema.transform(withDerivedSavedReviewExecution);

export function toSavedReviewExecutionSnapshot(
  execution: z.infer<typeof ExecutionResultSchema>,
): SavedReviewExecutionSnapshot {
  return SavedReviewExecutionSnapshotSchema.parse({
    schemaVersion: 1,
    executionFingerprint: execution.receipt.executionFingerprint,
    receipt: execution.receipt,
  });
}

export function resolveSavedReviewExecutionSnapshot(
  review: Pick<SavedReview, "execution" | "executionSnapshot">,
): SavedReviewExecutionSnapshot | undefined {
  if (review.executionSnapshot) return review.executionSnapshot;
  if (!review.execution) return undefined;
  return toSavedReviewExecutionSnapshot(review.execution);
}

export const ReviewCursorSchema = z
  .string()
  .min(5)
  .max(512)
  .regex(/^dg1_[A-Za-z0-9_-]+$/);
export type ReviewCursor = z.infer<typeof ReviewCursorSchema>;

export const ReviewListWarningSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("unreadable_review"),
    reviewId: UuidSchema,
  }),
  z.strictObject({
    kind: z.literal("invalid_issues_dropped"),
    reviewId: UuidSchema,
    count: CountFieldSchema.positive(),
  }),
  // The salvaged record lost the execution receipt the durable snapshot carried,
  // so its outcome and trace are unavailable until the review is re-run.
  z.strictObject({
    kind: z.literal("invalid_execution_dropped"),
    reviewId: UuidSchema,
  }),
  z.strictObject({ kind: z.literal("index_build_failed") }),
  z.strictObject({ kind: z.literal("index_rewrite_failed") }),
]);
export type ReviewListWarning = z.infer<typeof ReviewListWarningSchema>;

export const ReviewsResponseSchema = z.object({
  reviews: z.array(ReviewMetadataSchema),
  nextCursor: ReviewCursorSchema.nullable().optional(),
  warnings: z.array(ReviewListWarningSchema).optional(),
});
export type ReviewsResponse = z.infer<typeof ReviewsResponseSchema>;

export const ReviewResponseSchema = z.object({
  review: SavedReviewSchema,
});
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;

export const ActiveReviewSessionSchema = z.object({
  reviewId: UuidSchema,
  mode: ReviewModeSchema,
  startedAt: z.iso.datetime(),
  headCommit: z.string(),
  statusHash: z.string(),
});
export type ActiveReviewSession = z.infer<typeof ActiveReviewSessionSchema>;

export const ActiveReviewSessionResponseSchema = z.object({
  session: ActiveReviewSessionSchema.nullable(),
});
export type ActiveReviewSessionResponse = z.infer<typeof ActiveReviewSessionResponseSchema>;

export const CreateReviewResponseSchema = z
  .object({
    reviewId: UuidSchema,
    session: ActiveReviewSessionSchema,
  })
  .refine((response) => response.reviewId === response.session.reviewId, {
    path: ["session", "reviewId"],
    error: "session.reviewId must match reviewId",
  });
export type CreateReviewResponse = z.infer<typeof CreateReviewResponseSchema>;
