import type { createGitService } from "../../shared/lib/git/service.js";

export type GitService = ReturnType<typeof createGitService>;

export interface GitServiceError {
  code: string;
  message: string;
}
