import { realpath } from "node:fs/promises";
import { join, sep } from "node:path";
import type { AppError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { ErrorCode as ErrorCodeType } from "@diffgazer/core/schemas/errors";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { createGitService } from "../../shared/lib/git/service.js";
import { isRepoRelativePath } from "../../shared/lib/paths.js";

type GitService = ReturnType<typeof createGitService>;

interface ResolveGitServiceOptions {
  basePath: string;
  relativePath?: string;
}

export const resolveGitService = async (
  options: ResolveGitServiceOptions,
): Promise<Result<GitService, AppError<ErrorCodeType>>> => {
  const { basePath, relativePath } = options;

  if (relativePath && !isRepoRelativePath(relativePath)) {
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
