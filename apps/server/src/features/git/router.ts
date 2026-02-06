import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { ErrorCode } from "@stargazer/schemas/errors";
import { errorResponse, zodErrorHandler } from "../../shared/lib/http/response.js";
import { getProjectRoot } from "../../shared/lib/http/request.js";
import { requireRepoAccess } from "../../shared/middlewares/trust-guard.js";
import { resolveGitService } from "./service.js";
import { GitDiffQuerySchema } from "./schemas.js";

const gitRouter = new Hono();

gitRouter.use("*", requireRepoAccess);

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
  } catch (error) {
    console.error("[stargazer] git status error:", error);
    return errorResponse(c, "Failed to retrieve git status", ErrorCode.COMMAND_FAILED, 500);
  }
});

gitRouter.get("/diff", zValidator("query", GitDiffQuerySchema, zodErrorHandler), async (c): Promise<Response> => {
  const result = await resolveServiceOrResponse(c);
  if (!result.ok) return result.response;

  const { mode: modeParam } = c.req.valid("query");
  const mode = modeParam ?? "unstaged";

  try {
    const status = await result.service.getStatus();
    if (!status.isGitRepo) {
      return errorResponse(c, "Not a git repository", ErrorCode.NOT_GIT_REPO, 400);
    }

    const diff = await result.service.getDiff(mode);
    return c.json({ diff, mode });
  } catch (error) {
    console.error("[stargazer] git diff error:", error);
    return errorResponse(c, "Failed to retrieve git diff", ErrorCode.COMMAND_FAILED, 500);
  }
});

export { gitRouter };
