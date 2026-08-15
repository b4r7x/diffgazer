import { execFile } from "node:child_process";
import type { ResultPromise } from "execa";

const GROUP_EXIT_POLL_MS = 25;

function isNoSuchProcess(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === "ESRCH";
}

function signalChild(child: ResultPromise, signal: "SIGTERM" | "SIGKILL"): boolean {
  // Detached children lead their own group; signal the group (negative pid) so a
  // wrapper-spawned grandchild dies too. Fall back to the direct child on Windows,
  // when no pid is available, or if the group is already gone.
  const { pid } = child;
  if (process.platform !== "win32" && pid !== undefined) {
    try {
      process.kill(-pid, signal);
      return true;
    } catch (error) {
      child.kill(signal);
      return !isNoSuchProcess(error);
    }
  }
  child.kill(signal);
  return false;
}

function isProcessGroupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return !isNoSuchProcess(error);
  }
}

async function waitForProcessGroupExit(pid: number): Promise<void> {
  while (isProcessGroupAlive(pid)) {
    await new Promise((resolve) => setTimeout(resolve, GROUP_EXIT_POLL_MS));
  }
}

/**
 * Windows has no process groups, so killing the `npx`/`pnpm` wrapper leaves its
 * Node grandchild holding the port. `taskkill /T` walks the real process tree;
 * a direct kill remains the fallback when taskkill is unavailable or the tree
 * is already gone.
 */
function forceKillWindowsTree(child: ResultPromise, pid: number): void {
  execFile("taskkill", ["/PID", String(pid), "/T", "/F"], (error) => {
    if (error) child.kill("SIGKILL");
  });
}

export async function terminateProcess(
  child: ResultPromise,
  options: { forceKillMs: number },
): Promise<void> {
  const isWindows = process.platform === "win32";
  const groupPid = isWindows ? undefined : child.pid;
  const isGroupManaged = signalChild(child, "SIGTERM");
  const forceKillTimer = setTimeout(() => {
    const { pid } = child;
    if (isWindows && pid !== undefined) {
      forceKillWindowsTree(child, pid);
      return;
    }
    signalChild(child, "SIGKILL");
  }, options.forceKillMs);

  try {
    await child;
  } catch {
    // Process exits with signal codes throw here; ignore expected shutdown errors.
  }

  if (isGroupManaged && groupPid !== undefined) {
    await waitForProcessGroupExit(groupPid);
  }
  clearTimeout(forceKillTimer);
}
