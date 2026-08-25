import { z } from "zod";

export const GIT_FILE_STATUS_CODES = ["M", "T", "A", "D", "R", "C", "U", "?", "!", " "] as const;
export const GitFileStatusCodeSchema = z.enum(GIT_FILE_STATUS_CODES);
export type GitFileStatusCode = z.infer<typeof GitFileStatusCodeSchema>;

export const GitFileEntrySchema = z.object({
  path: z.string(),
  previousPath: z.string().optional(),
  indexStatus: GitFileStatusCodeSchema,
  workTreeStatus: GitFileStatusCodeSchema,
});
export type GitFileEntry = z.infer<typeof GitFileEntrySchema>;

export const GitStatusFilesSchema = z.object({
  staged: z.array(GitFileEntrySchema),
  unstaged: z.array(GitFileEntrySchema),
  untracked: z.array(GitFileEntrySchema),
});
export type GitStatusFiles = z.infer<typeof GitStatusFilesSchema>;

/**
 * Recorded as the branch when HEAD is detached. Porcelain reports `(detached)`, which is
 * itself a legal branch name, so the sentinel carries a space instead: `git check-ref-format`
 * rejects spaces in ref names, which keeps it out of the branch-name value domain.
 */
export const DETACHED_HEAD_BRANCH = "HEAD (detached)";

export const GitStatusSchema = z.object({
  isGitRepo: z.boolean(),
  /** Current branch, `DETACHED_HEAD_BRANCH` when HEAD is detached, `null` when unknown. */
  branch: z.string().nullable(),
  remoteBranch: z.string().nullable(),
  ahead: z.number(),
  behind: z.number(),
  files: GitStatusFilesSchema,
  hasChanges: z.boolean(),
  conflicted: z.array(z.string()),
});
export type GitStatus = z.infer<typeof GitStatusSchema>;
