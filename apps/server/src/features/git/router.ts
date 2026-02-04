import { Hono } from "hono";
import type { Context } from "hono";
import { ErrorCode } from "@repo/schemas/errors";
import { errorResponse } from "../../shared/lib/error-response.js";
import { getProjectRoot } from "../../shared/lib/request.js";
import { resolveGitService } from "./service.js";
import { GitDiffModeSchema, type GitDiffMode } from "./schemas.js";

const gitRouter = new Hono();

const resolveServiceOrResponse = async (c: Context) => {
  const projectRoot = getProjectRoot(c);
  const relativePath = c.req.query("path");
  const result = await resolveGitService({ basePath: projectRoot, relativePath });

  if (!result.ok) {
    const status = result.error.code === ErrorCode.GIT_NOT_FOUND ? 500 : 400;
    return { ok: false as const, response: errorResponse(c, result.error.message, result.error.code, status) };
  }

  return { ok: true as const, service: result.value };
};

gitRouter.get("/status", async (c): Promise<Response> => {
  const result = await resolveServiceOrResponse(c);
  if (!result.ok) return result.response;

  try {
    const status = await result.service.getStatus();
    if (!status.isGitRepo) {
      return errorResponse(c, "Not a git repository", ErrorCode.NOT_GIT_REPO, 400);
    }
    return c.json(status);
  } catch {
    return errorResponse(c, "Failed to retrieve git status", ErrorCode.COMMAND_FAILED, 500);
  }
});

gitRouter.get("/diff", async (c): Promise<Response> => {
  const result = await resolveServiceOrResponse(c);
  if (!result.ok) return result.response;

  const modeParam = c.req.query("mode");
  const stagedParam = c.req.query("staged");
  const parsedMode = modeParam ? GitDiffModeSchema.safeParse(modeParam) : null;
  let mode: GitDiffMode = "unstaged";
  if (parsedMode?.success) {
    mode = parsedMode.data;
  } else if (stagedParam === "true") {
    mode = "staged";
  }

  try {
    const status = await result.service.getStatus();
    if (!status.isGitRepo) {
      return errorResponse(c, "Not a git repository", ErrorCode.NOT_GIT_REPO, 400);
    }

    const diff = await result.service.getDiff(mode);
    return c.json({ diff, mode });
  } catch {
    return errorResponse(c, "Failed to retrieve git diff", ErrorCode.COMMAND_FAILED, 500);
  }
});

export { gitRouter };
