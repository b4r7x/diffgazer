import { z } from "zod";

export const GIT_FILE_STATUS_CODES = ["M", "T", "A", "D", "R", "C", "U", "?", "!", " "] as const;
const GitFileStatusCodeSchema = z.enum(GIT_FILE_STATUS_CODES);
export type GitFileStatusCode = z.infer<typeof GitFileStatusCodeSchema>;

export const GitFileEntrySchema = z.object({
  path: z.string(),
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

export const GitStatusSchema = z.object({
  isGitRepo: z.boolean(),
  branch: z.string().nullable(),
  remoteBranch: z.string().nullable(),
  ahead: z.number(),
  behind: z.number(),
  files: GitStatusFilesSchema,
  hasChanges: z.boolean(),
  conflicted: z.array(z.string()),
});
export type GitStatus = z.infer<typeof GitStatusSchema>;
