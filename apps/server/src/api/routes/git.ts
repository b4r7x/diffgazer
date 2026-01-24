import { Hono } from "hono";
import type { Context } from "hono";
import { join, sep } from "node:path";
import { realpath } from "node:fs/promises";
import { ErrorCode } from "@repo/schemas/errors";
import { getErrorMessage } from "@repo/core";
import { createGitService } from "../../services/git.js";
import { errorResponse, jsonOk } from "../../lib/response.js";
import { isRelativePath } from "../../lib/validation.js";

const git = new Hono();

type GitService = ReturnType<typeof createGitService>;

type GetGitServiceResult =
  | { ok: true; service: GitService }
  | { ok: false; response: Response };

async function getGitService(c: Context, path: string | undefined): Promise<GetGitServiceResult> {
  if (path && !isRelativePath(path)) {
    return { ok: false, response: errorResponse(c, "Invalid path", ErrorCode.INVALID_PATH, 400) };
  }

  const targetPath = path ? join(process.cwd(), path) : process.cwd();
  const realBasePath = await realpath(process.cwd()).catch(() => null);
  const realTargetPath = await realpath(targetPath).catch(() => null);

  if (!realBasePath || !realTargetPath ||
      (realTargetPath !== realBasePath && !realTargetPath.startsWith(realBasePath + sep))) {
    return { ok: false, response: errorResponse(c, "Invalid path", ErrorCode.INVALID_PATH, 400) };
  }

  const gitService = createGitService({ cwd: realTargetPath });

  if (!(await gitService.isGitInstalled())) {
    return { ok: false, response: errorResponse(c, "Git not installed", ErrorCode.GIT_NOT_FOUND, 500) };
  }

  return { ok: true, service: gitService };
}

git.get("/status", async (c) => {
  const result = await getGitService(c, c.req.query("path"));
  if (!result.ok) return result.response;

  try {
    const status = await result.service.getStatus();
    if (!status.isGitRepo) {
      return errorResponse(c, "Not a git repository", ErrorCode.NOT_GIT_REPO, 400);
    }
    return jsonOk(c, status);
  } catch (error) {
    console.error("Git status error:", getErrorMessage(error));
    return errorResponse(c, "Failed to retrieve git status", ErrorCode.COMMAND_FAILED, 500);
  }
});

git.get("/diff", async (c) => {
  const result = await getGitService(c, c.req.query("path"));
  if (!result.ok) return result.response;

  const staged = c.req.query("staged") === "true";

  try {
    const status = await result.service.getStatus();
    if (!status.isGitRepo) {
      return errorResponse(c, "Not a git repository", ErrorCode.NOT_GIT_REPO, 400);
    }

    const diff = await result.service.getDiff(staged);
    return jsonOk(c, { diff, staged });
  } catch (error) {
    console.error("Git diff error:", getErrorMessage(error));
    return errorResponse(c, "Failed to retrieve git diff", ErrorCode.COMMAND_FAILED, 500);
  }
});

export { git };
