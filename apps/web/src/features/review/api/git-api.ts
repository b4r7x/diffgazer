import { api } from "@/lib/api";

export interface GitStatus {
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export async function getGitStatus(): Promise<GitStatus> {
  return api.get<GitStatus>("/git/status");
}

export async function getGitDiff(scope?: string): Promise<string> {
  return api.get<string>("/git/diff", scope ? { scope } : undefined);
}
