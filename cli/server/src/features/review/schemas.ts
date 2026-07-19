import { posix } from "node:path";
import { UuidSchema } from "@diffgazer/core/schemas/fields";
import { LensIdSchema, ProfileIdSchema, ReviewModeSchema } from "@diffgazer/core/schemas/review";
import { z } from "zod";
import { isRepoRelativePath } from "../../shared/lib/paths.js";
import { isReviewCursor } from "./storage/review-cursor.js";

export const ReviewIdParamSchema = z.object({
  id: UuidSchema,
});

export const ContextRefreshSchema = z.object({
  force: z.boolean().optional(),
});

const MAX_LENSES = 10;
export const MAX_REVIEW_FILES = 200;
export const MAX_REVIEW_PATH_LENGTH = 500;

export const ActiveSessionQuerySchema = z.object({
  mode: ReviewModeSchema.optional(),
});

export const ReviewListQuerySchema = z.object({
  cursor: z
    .string()
    .min(5)
    .max(512)
    .regex(/^dg1_[A-Za-z0-9_-]+$/)
    .refine(isReviewCursor, { error: "Invalid review cursor" })
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Shared with features/git/service.ts: reject absolute paths, drive letters,
// `..` segments, and NUL before values reach `git diff -- <pathspecs>`.
// Non-ASCII is allowed because decoded git paths (F-090/F-013) are unicode.
const RepoRelativePathSchema = z
  .string()
  .min(1)
  .max(MAX_REVIEW_PATH_LENGTH)
  .refine(isRepoRelativePath, { error: "files[] entries must be repo-relative paths" });

function canonicalizeReviewFiles(files: string[]): string[] {
  const canonical = files.map((file) => {
    const normalized = posix.normalize(file.replaceAll("\\", "/"));
    if (normalized === "." || normalized === "./") return ".";
    return normalized.replace(/\/$/, "");
  });
  return [...new Set(canonical)].sort();
}

export const CreateReviewBodySchema = z
  .object({
    mode: ReviewModeSchema.optional(),
    profile: ProfileIdSchema.optional(),
    lenses: z
      .array(LensIdSchema)
      .transform((arr) => [...new Set(arr)])
      .pipe(z.array(LensIdSchema).max(MAX_LENSES))
      .transform((arr) => (arr.length === 0 ? undefined : arr))
      .optional(),
    files: z
      .array(RepoRelativePathSchema)
      .max(MAX_REVIEW_FILES)
      .transform(canonicalizeReviewFiles)
      .optional(),
  })
  .refine((data) => data.mode !== "files" || (Array.isArray(data.files) && data.files.length > 0), {
    error: "files[] must be non-empty when mode is 'files'",
    path: ["files"],
  });
