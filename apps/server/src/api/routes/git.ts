import { Hono } from "hono";
import { join } from "node:path";
import { realpath } from "node:fs/promises";
import { createGitService } from "../../services/git.js";
import { errorResponse, successResponse } from "../../lib/response.js";

const git = new Hono();

function isValidRelativePath(path: string): boolean {
  const startsWithSlash = path.startsWith("/") || path.startsWith("\\");
  const hasDriveLetter = /^[a-zA-Z]:/.test(path);
  const hasTraversal = path.includes("..");
  const hasNullByte = path.includes("\x00");
  return !startsWithSlash && !hasDriveLetter && !hasTraversal && !hasNullByte;
}

git.get("/status", async (c) => {
  const path = c.req.query("path");

  if (path && !isValidRelativePath(path)) {
    return errorResponse(c, "Invalid path", "INVALID_PATH", 400);
  }

  const targetPath = path ? join(process.cwd(), path) : process.cwd();

  const realTargetPath = await realpath(targetPath).catch(() => null);
  const realBasePath = await realpath(process.cwd());

  if (!realTargetPath || !realTargetPath.startsWith(realBasePath)) {
    return errorResponse(c, "Invalid path", "INVALID_PATH", 400);
  }

  try {
    const gitService = createGitService({ cwd: realTargetPath });

    if (!(await gitService.isGitInstalled())) {
      return errorResponse(c, "Git not installed", "GIT_NOT_FOUND", 500);
    }

    const status = await gitService.getStatus();

    if (!status.isGitRepo) {
      return errorResponse(c, "Not a git repository", "NOT_GIT_REPO", 400);
    }

    return successResponse(c, status);
  } catch (error) {
    console.error("Git status error:", error);
    return errorResponse(c, "Failed to retrieve git status", "COMMAND_FAILED", 500);
  }
});

export { git };
