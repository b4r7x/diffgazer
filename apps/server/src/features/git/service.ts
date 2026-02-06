import { join, sep } from "node:path";
import { realpath } from "node:fs/promises";
import { type Result, type AppError, ok, err } from "@stargazer/core";
import { ErrorCode } from "@stargazer/schemas/errors";
import { isRelativePath } from "../../shared/lib/validation.js";
import { createGitService } from "../../shared/lib/git/service.js";

type GitService = ReturnType<typeof createGitService>;

interface ResolveGitServiceOptions {
  basePath: string;
  relativePath?: string;
}

export const resolveGitService = async (
  options: ResolveGitServiceOptions
): Promise<Result<GitService, AppError>> => {
  const { basePath, relativePath } = options;

  if (relativePath && !isRelativePath(relativePath)) {
    return err({ code: ErrorCode.INVALID_PATH, message: "Invalid path" });
  }

  const targetPath = relativePath ? join(basePath, relativePath) : basePath;
  const realBasePath = await realpath(basePath).catch(() => null);
  const realTargetPath = await realpath(targetPath).catch(() => null);

  if (
    !realBasePath ||
    !realTargetPath ||
    (realTargetPath !== realBasePath && !realTargetPath.startsWith(realBasePath + sep))
  ) {
    return err({ code: ErrorCode.INVALID_PATH, message: "Invalid path" });
  }

  const gitService = createGitService({ cwd: realTargetPath });

  if (!(await gitService.isGitInstalled())) {
    return err({ code: ErrorCode.GIT_NOT_FOUND, message: "Git not installed" });
  }

  return ok(gitService);
};
