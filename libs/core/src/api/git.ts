import { type GitStatus, GitStatusSchema } from "../schemas/git.js";
import type { ApiClient } from "./types.js";

/**
 * Porcelain rows for one working tree. Paths are bounded by the filesystem, so
 * even a repo-wide change set stays far inside this; a body past it is a sign
 * the response is not the status we asked for.
 */
export const GIT_STATUS_RESPONSE_MAX_BYTES = 2 * 1_024 * 1_024;

export function getGitStatus(client: ApiClient, signal?: AbortSignal): Promise<GitStatus> {
  return client.get<GitStatus>("/api/git/status", {
    maxResponseBytes: GIT_STATUS_RESPONSE_MAX_BYTES,
    ...(signal ? { signal } : {}),
    schema: (body) => GitStatusSchema.parse(body),
  });
}

export const bindGit = (client: ApiClient) => ({
  getGitStatus: (signal?: AbortSignal) => getGitStatus(client, signal),
});
