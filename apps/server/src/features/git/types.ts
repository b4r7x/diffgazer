import type { createGitService } from "../../shared/lib/services/git.js";

export type GitService = ReturnType<typeof createGitService>;

export interface GitServiceError {
  code: string;
  message: string;
}
