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

export async function terminateProcess(
  child: ResultPromise,
  options: { forceKillMs: number },
): Promise<void> {
  const groupPid = process.platform === "win32" ? undefined : child.pid;
  const isGroupManaged = signalChild(child, "SIGTERM");
  const forceKillTimer = setTimeout(() => {
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
