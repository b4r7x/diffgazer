import { showDryRunDeps, showDryRunPreview } from "../dry-run-preview.js";
import {
  type FileOp,
  formatWriteSummary,
  rollbackFiles,
  type WriteFilesResult,
  writeFilesWithRollback,
} from "../file-write-rollback.js";
import { installDeps } from "../install-deps.js";
import { restorePackageManagerFiles, snapshotPackageManagerFiles } from "../package-manager.js";
import { heading, info, newline, promptConfirm, success, warn } from "../terminal.js";

export interface ApplyInstallPlanOptions {
  cwd: string;
  yes: boolean;
  dryRun: boolean;
  overwrite: boolean;
  skipInstall?: boolean;
  confirmMessage: string;
  headingMessage: string;
  fileOps: FileOp[];
  missingDeps: string[];
  onDryRun?: () => void;
  onApplied?: (result: WriteFilesResult) => Promise<void> | void;
}

export async function applyInstallPlan(options: ApplyInstallPlanOptions): Promise<void> {
  if (options.dryRun) {
    handleDryRun(options);
    return;
  }

  if (!options.yes) {
    const proceed = await promptConfirm(options.confirmMessage);
    if (!proceed) return info("Cancelled.");
  }

  await writeAndInstall(options);
}

function handleDryRun(options: ApplyInstallPlanOptions): void {
  showDryRunPreview(options.fileOps, options.overwrite);
  showDryRunDeps(options.missingDeps);
  options.onDryRun?.();
  newline();
  info("(dry run - no changes made)");
}

async function writeAndInstall(options: ApplyInstallPlanOptions): Promise<void> {
  const { cwd, overwrite, skipInstall = false, fileOps, missingDeps } = options;

  const packageManagerSnapshot = snapshotPackageManagerFiles(cwd);
  heading(options.headingMessage);
  const writeResult = writeFilesWithRollback(fileOps, overwrite);
  try {
    await installOrSkip(missingDeps, cwd, skipInstall);
    await options.onApplied?.(writeResult);
  } catch (error) {
    warn("Rolling back install-plan changes after failure...");
    let packageManagerRollbackFailed = false;
    let packageManagerRollbackError: unknown;
    try {
      restorePackageManagerFiles(packageManagerSnapshot);
    } catch (rollbackError) {
      packageManagerRollbackFailed = true;
      packageManagerRollbackError = rollbackError;
    }
    rollbackFiles(writeResult.newFiles, writeResult.backups, writeResult.createdDirs);
    if (packageManagerRollbackFailed) {
      throw new AggregateError(
        [error, packageManagerRollbackError],
        "Install-plan failed and package-manager rollback was incomplete.",
      );
    }
    throw error;
  }

  newline();
  success(formatWriteSummary(writeResult));
  newline();
}

async function installOrSkip(
  missingDeps: string[],
  cwd: string,
  skipInstall: boolean,
): Promise<void> {
  const skip = skipInstall || isTruthyFlag(process.env.CLI_SKIP_INSTALL);
  if (!skip) {
    await installDeps(missingDeps, cwd);
    return;
  }
  if (missingDeps.length > 0) {
    showSkippedDependencies(missingDeps, skipInstall ? "--skip-install" : "CLI_SKIP_INSTALL");
  }
}

export function showSkippedDependencies(
  missingDeps: readonly string[],
  reason: "--skip-install" | "CLI_SKIP_INSTALL",
): void {
  heading("Dependency installation skipped");
  info(`Skipped via ${reason}. Install these packages manually when ready:`);
  for (const dep of missingDeps) info(`  ${dep}`);
}

function isTruthyFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
