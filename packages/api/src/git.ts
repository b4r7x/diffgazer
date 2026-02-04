import type { ApiClient, GitDiffMode, GitDiffResponse, GitStatus } from "./types.js";

export async function getGitStatus(
  client: ApiClient,
  options: { path?: string } = {}
): Promise<GitStatus> {
  const params = options.path ? { path: options.path } : undefined;
  return client.get<GitStatus>("/api/git/status", params);
}

export async function getGitDiff(
  client: ApiClient,
  options: { mode?: GitDiffMode; staged?: boolean; path?: string } = {}
): Promise<GitDiffResponse> {
  const params: Record<string, string> = {};
  if (options.path) params.path = options.path;
  if (options.mode) {
    params.mode = options.mode;
  } else if (options.staged !== undefined) {
    params.staged = String(options.staged);
  }

  return client.get<GitDiffResponse>("/api/git/diff", params);
}

export const bindGit = (client: ApiClient) => ({
  getGitStatus: (options?: { path?: string }) => getGitStatus(client, options),
  getGitDiff: (options?: { mode?: GitDiffMode; staged?: boolean; path?: string }) =>
    getGitDiff(client, options),
});
