import { existsSync } from "node:fs";
import pc from "picocolors";
import type { FileOp } from "./file-write-rollback.js";
import { fileAction, heading, info } from "./terminal.js";

export function showDryRunPreview(fileOps: FileOp[], overwrite: boolean): void {
  heading("Files that would be written:");
  for (const op of fileOps) {
    const exists = existsSync(op.targetPath);
    if (exists && !(op.overwrite ?? overwrite)) {
      fileAction(pc.dim("skip"), `${op.installDir}/${op.relativePath}`);
    } else {
      fileAction(pc.green(exists ? "~" : "+"), `${op.installDir}/${op.relativePath}`);
    }
  }
}

export function showDryRunDeps(missing: string[]): void {
  if (missing.length > 0) {
    heading("Packages that would be installed:");
    for (const dep of missing) info(`  ${dep}`);
  }
}
