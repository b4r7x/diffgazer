import { join, sep } from "node:path";
import { realpath } from "node:fs/promises";
import { type Result, ok, err } from "@diffgazer/core/result";
import type { AppError } from "@diffgazer/core/errors";
import { ErrorCode } from "@diffgazer/schemas/errors";
import { createGitService } from "../../shared/lib/git/service.js";

const isRelativePath = (value: string): boolean => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[a-zA-Z]:/.test(value)) {
    return false;
  }
  if (value.includes("..") || value.includes("\0")) {
    return false;
  }
  return true;
};

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
