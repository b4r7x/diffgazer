import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import { getProjectRoot } from "../../shared/lib/http/request.js";
import { errorResponse, zodErrorHandler } from "../../shared/lib/http/response.js";
import { requireRepoAccess } from "../../shared/middlewares/trust-guard.js";
import { GitDiffQuerySchema } from "./schemas.js";
import { resolveGitService } from "./service.js";

const gitRouter = new Hono();

gitRouter.use("*", requireRepoAccess);

const resolveServiceOrResponse = async (c: Context) => {
  const projectRoot = getProjectRoot(c);
  const relativePath = c.req.query("path");
  const result = await resolveGitService({ basePath: projectRoot, relativePath });

  if (!result.ok) {
    const status = result.error.code === ErrorCode.GIT_NOT_FOUND ? 500 : 400;
    return {
      ok: false as const,
      response: errorResponse(c, result.error.message, result.error.code, status),
    };
  }

  return { ok: true as const, service: result.value };
};

gitRouter.get("/status", async (c): Promise<Response> => {
  const result = await resolveServiceOrResponse(c);
  if (!result.ok) return result.response;

  const statusResult = await result.service.getStatus();
  if (!statusResult.ok) {
    return errorResponse(c, statusResult.error.message, ErrorCode.COMMAND_FAILED, 500);
  }
  const status = statusResult.value;
  if (!status.isGitRepo) {
    return errorResponse(c, "Not a git repository", ErrorCode.NOT_GIT_REPO, 400);
  }
  return c.json(status);
});

gitRouter.get(
  "/diff",
  zValidator("query", GitDiffQuerySchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const result = await resolveServiceOrResponse(c);
    if (!result.ok) return result.response;

    const { mode: modeParam } = c.req.valid("query");
    const mode = modeParam ?? "unstaged";

    const diffResult = await result.service.getDiff(mode);
    if (!diffResult.ok) {
      return errorResponse(c, diffResult.error.message, ErrorCode.COMMAND_FAILED, 500);
    }
    return c.json({ diff: diffResult.value, mode });
  },
);

export { gitRouter };
