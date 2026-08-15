import { detectPackageManager } from "./detect.js";
import { installDepsWithSpinner } from "./package-manager.js";
import { heading } from "./terminal.js";

export async function installDeps(
  deps: string[],
  cwd: string,
  abortSignal?: AbortSignal,
): Promise<void> {
  if (deps.length === 0) return;

  heading("Installing dependencies...");
  const pm = detectPackageManager(cwd);
  const ok = await installDepsWithSpinner(pm, deps, cwd, abortSignal);
  if (!ok) {
    throw new Error("Dependency installation failed.");
  }
}
