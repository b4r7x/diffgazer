import type { ResultPromise } from "execa";
import { afterEach, describe, expect, it, vi } from "vitest";
import { terminateProcess } from "./termination";

// Boundary mock: the Windows process-tree kill shells out to taskkill.
const execFileMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFile: execFileMock }));

const realPlatform = process.platform;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
}

function makeChild(pid: number): ResultPromise & { kill: ReturnType<typeof vi.fn> } {
  let settle: (() => void) | null = null;
  const promise = new Promise<void>((resolve) => {
    settle = resolve;
  });
  // A real wrapper child ignores SIGTERM long enough for the force timer to run.
  const child = Object.assign(promise, {
    pid,
    kill: vi.fn((signal: string) => {
      if (signal === "SIGKILL") settle?.();
      return true;
    }),
  });
  return child as unknown as ResultPromise & { kill: ReturnType<typeof vi.fn> };
}

afterEach(() => {
  setPlatform(realPlatform);
  vi.useRealTimers();
  execFileMock.mockReset();
});

describe("terminateProcess on Windows", () => {
  it("force-kills the whole process tree, not just the wrapper child", async () => {
    setPlatform("win32");
    vi.useFakeTimers();
    const child = makeChild(4242);

    const termination = terminateProcess(child, { forceKillMs: 50 });
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");

    await vi.advanceTimersByTimeAsync(50);
    expect(execFileMock).toHaveBeenCalledWith(
      "taskkill",
      ["/PID", "4242", "/T", "/F"],
      expect.any(Function),
    );

    const onDone = execFileMock.mock.calls[0]?.[2] as (error: Error | null) => void;
    onDone(new Error("taskkill unavailable"));
    expect(child.kill).toHaveBeenLastCalledWith("SIGKILL");

    await termination;
  });
});
