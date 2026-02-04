import { z } from "zod";

export const GitDiffModeSchema = z.enum(["staged", "unstaged", "files"]);
export type GitDiffMode = z.infer<typeof GitDiffModeSchema>;
