import { realpath } from "node:fs/promises";
import type { AppError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { ErrorCode as ErrorCodeType } from "@diffgazer/core/schemas/errors";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { createGitService } from "../../shared/lib/git/service.js";

type GitService = ReturnType<typeof createGitService>;

export const resolveGitService = async (
  basePath: string,
): Promise<Result<GitService, AppError<ErrorCodeType>>> => {
  const realBasePath = await realpath(basePath).catch(() => null);
  if (!realBasePath) {
    return err({ code: ErrorCode.INVALID_PATH, message: "Invalid path" });
  }

  const gitService = createGitService({ cwd: realBasePath });

  if (!(await gitService.isGitInstalled())) {
    return err({ code: ErrorCode.GIT_NOT_FOUND, message: "Git not installed" });
  }

  return ok(gitService);
};
