import { z } from "zod";

export const GIT_FILE_STATUS_CODES = ["M", "T", "A", "D", "R", "C", "U", "?", "!", " "] as const;
export const GitFileStatusCodeSchema = z.enum(GIT_FILE_STATUS_CODES);
export type GitFileStatusCode = z.infer<typeof GitFileStatusCodeSchema>;

export const GitFileEntrySchema = z.object({
  path: z.string(),
  indexStatus: GitFileStatusCodeSchema,
  workTreeStatus: GitFileStatusCodeSchema,
  originalPath: z.string().optional(),
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

export const GIT_ERROR_CODES = [
  "NOT_GIT_REPO",
  "GIT_NOT_FOUND",
  "COMMAND_FAILED",
  "INVALID_PATH",
  "INTERNAL_ERROR",
  "NOT_FOUND",
  "UNKNOWN",
] as const;

export const GitErrorCodeSchema = z.enum(GIT_ERROR_CODES);
export type GitErrorCode = z.infer<typeof GitErrorCodeSchema>;

export const GitErrorSchema = z.object({
  message: z.string(),
  code: GitErrorCodeSchema,
  details: z.string().optional(),
});
export type GitError = z.infer<typeof GitErrorSchema>;

export const GitStatusResponseSchema = z.discriminatedUnion("success", [
  z.object({ success: z.literal(true), data: GitStatusSchema }),
  z.object({ success: z.literal(false), error: GitErrorSchema }),
]);
export type GitStatusResponse = z.infer<typeof GitStatusResponseSchema>;
