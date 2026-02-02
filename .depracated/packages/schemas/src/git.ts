import { z } from "zod";
import { createDomainErrorCodes, createDomainErrorSchema, type SharedErrorCode } from "./errors.js";

export const GIT_FILE_STATUS_CODES = ["M", "T", "A", "D", "R", "C", "U", "?", "!", " "] as const;
export const GitFileStatusCodeSchema = z.enum(GIT_FILE_STATUS_CODES);
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

export const GIT_SPECIFIC_CODES = [
  "NOT_GIT_REPO",
  "GIT_NOT_FOUND",
  "COMMAND_FAILED",
  "INVALID_PATH",
  "NOT_FOUND",
  "UNKNOWN",
] as const;
export type GitSpecificCode = (typeof GIT_SPECIFIC_CODES)[number];

export const GIT_ERROR_CODES = createDomainErrorCodes(GIT_SPECIFIC_CODES);
export const GitErrorCodeSchema = z.enum(GIT_ERROR_CODES as unknown as [string, ...string[]]);
export type GitErrorCode = SharedErrorCode | GitSpecificCode;

export const GitErrorSchema = createDomainErrorSchema(GIT_SPECIFIC_CODES, { includeDetails: true });
export type GitError = z.infer<typeof GitErrorSchema>;

export const GitDiffSchema = z.object({
  diff: z.string(),
  staged: z.boolean(),
});
export type GitDiff = z.infer<typeof GitDiffSchema>;
