import { detectPackageManager } from "./detect.js";
import { rollbackFiles, type WriteFilesResult } from "./file-write-rollback.js";
import { installDepsWithSpinner } from "./package-manager.js";
import { heading, warn } from "./terminal.js";

export async function installDepsWithRollback(
  deps: string[],
  cwd: string,
  writeResult: WriteFilesResult,
): Promise<void> {
  if (deps.length === 0) return;

  heading("Installing dependencies...");
  const pm = detectPackageManager(cwd);
  const ok = await installDepsWithSpinner(pm, deps, cwd);
  if (!ok) {
    warn("Rolling back written files due to dependency install failure...");
    rollbackFiles(writeResult.newFiles, writeResult.backups, writeResult.createdDirs);
    throw new Error("Dependency installation failed.");
  }
}
